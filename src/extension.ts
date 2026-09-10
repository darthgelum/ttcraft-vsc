import * as vscode from 'vscode';
import { AuthManager } from './auth';
import { AuthError, DevApi, TableNotOpenError } from './api';
import { tableDir } from './config';
import { isUnder, TableFolder, type Target } from './folder';
import { diagnostics, tableConsole } from './log';
import { libraryDir, maybeRecommendLua } from './lua';
import { SessionManager } from './sessions';
import { TablesProvider, TtNode } from './tablesView';
import type { DevTable } from './types';

const WORKSPACE_FOLDER_NAME = 'TTCraft table';

// Adding the table folder to the workspace can restart the extension host
// (VS Code does that for the first folder of an empty window and for the
// single-folder → multi-root transition). The open that triggered it is
// parked here and finished by the next activation.
const PENDING_KEY = 'ttcraft.pendingOpen';
const PENDING_TTL_MS = 2 * 60 * 1000;

interface PendingOpen {
  table: DevTable;
  target: Target;
  at: number;
}

interface Ext {
  context: vscode.ExtensionContext;
  auth: AuthManager;
  api: DevApi;
  sessions: SessionManager;
  folder: TableFolder;
  tables: TablesProvider;
  status: vscode.StatusBarItem;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const auth = new AuthManager(context);
  const api = new DevApi(auth);
  const sessions = new SessionManager(api);
  const folder = new TableFolder(tableDir(context), libraryDir(context));
  const tables = new TablesProvider(api, auth, sessions, folder);
  const status = vscode.window.createStatusBarItem('ttcraft.table', vscode.StatusBarAlignment.Left, 50);
  status.name = 'TTCraft table';
  status.command = 'ttcraft.switchTable';
  const ext: Ext = { context, auth, api, sessions, folder, tables, status };

  // Live spawns/removals and workbench edits refresh the tree and the files.
  sessions.setChangeListener(() => {
    void folder.reconcile();
    tables.refresh();
  });

  await auth.syncContext();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('ttcraftTables', tables),
    auth.onDidChange(() => tables.refresh()),
    { dispose: () => sessions.disposeAll() },
    { dispose: () => folder.dispose() },
    { dispose: () => tableConsole.dispose() },
    diagnostics,
    status,

    vscode.commands.registerCommand('ttcraft.signIn', async () => {
      if (await auth.signIn()) {
        tables.refresh();
      }
    }),

    vscode.commands.registerCommand('ttcraft.signOut', async () => {
      // The folder stays in the workspace (removing it could restart the
      // extension host); its contents say the table is gone.
      await folder.close('signed out of TTCraft in VS Code');
      sessions.disposeAll();
      await auth.signOut();
      updateStatus(ext);
      tables.refresh();
    }),

    // Reconnect open sessions so objects spawned since connect pick up their
    // proper names and removals reconcile, then re-pull the mirrored files.
    vscode.commands.registerCommand('ttcraft.refreshTables', async () => {
      await sessions.resyncAll();
      try {
        await folder.refresh();
      } catch (e) {
        vscode.window.showWarningMessage(`Could not refresh the table folder: ${reasonOf(e)}`);
      }
      updateStatus(ext);
      tables.refresh();
    }),

    vscode.commands.registerCommand('ttcraft.openTable', (item?: TtNode) => {
      const table = tableOf(item);
      if (table) {
        void openEntity(ext, table, { kind: 'global' });
      }
    }),

    vscode.commands.registerCommand('ttcraft.openScript', (table: DevTable, target: Target) =>
      openEntity(ext, table, target),
    ),

    vscode.commands.registerCommand('ttcraft.switchTable', () => switchTable(ext)),

    vscode.commands.registerCommand('ttcraft.closeTable', async (item?: TtNode) => {
      const table = tableOf(item) ?? folder.activeTable();
      if (!table) {
        return;
      }
      if (folder.activeTable()?.id === table.id) {
        await folder.close();
      }
      sessions.close(table.id);
      updateStatus(ext);
      tables.refresh();
    }),

    vscode.commands.registerCommand('ttcraft.showConsole', () => tableConsole.show()),
  );

  updateStatus(ext);
  // Not awaited: activation must not wait on the network.
  void restore(ext);
}

export function deactivate(): void {
  // Subscriptions dispose the sessions, the folder watcher and the console.
}

/**
 * Pick up where the previous extension host left off: finish a parked open,
 * or reconnect the table the folder was mirroring when the host went away.
 */
async function restore(ext: Ext): Promise<void> {
  const { context, auth, sessions, folder, tables } = ext;
  if (!folderInWorkspace(folder.dir)) {
    return;
  }

  const pending = context.globalState.get<PendingOpen>(PENDING_KEY);
  if (pending) {
    await context.globalState.update(PENDING_KEY, undefined);
    if (Date.now() - pending.at < PENDING_TTL_MS) {
      await openEntity(ext, pending.table, pending.target);
      return;
    }
  }

  const marker = await folder.readMarker();
  if (!marker || marker.status === 'closed') {
    return;
  }
  if (!(await auth.isSignedIn())) {
    await folder.markDisconnected(marker.table, 'not signed in to TTCraft in VS Code');
    return;
  }

  const session = sessions.ensure(marker.table);
  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: `TTCraft: reconnecting ${session.label}…` },
      async () => {
        await session.ensureConnected();
        await folder.open(session);
      },
    );
  } catch (e) {
    const reason = e instanceof AuthError ? 'the TTCraft session expired' : reasonOf(e);
    await folder.markDisconnected(marker.table, reason);
    tableConsole.note(`[${session.label}] could not reconnect: ${reason}`);
  }
  updateStatus(ext);
  tables.refresh();
}

async function openEntity(ext: Ext, table: DevTable, target: Target): Promise<void> {
  const { context, sessions, folder, tables } = ext;
  const session = sessions.ensure(table);

  let uri: vscode.Uri;
  try {
    uri = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Opening ${session.label}…` },
      async () => {
        await session.ensureConnected();
        await folder.ensureDir();
        if (!folderInWorkspace(folder.dir)) {
          await context.globalState.update(PENDING_KEY, { table, target, at: Date.now() } satisfies PendingOpen);
          addWorkspaceFolder(folder.dir);
          // If the host survives this (already a multi-root workspace), the
          // open just continues below and the parked copy is discarded.
        }
        await folder.open(session);
        const file = await folder.fileFor(session, target);
        await context.globalState.update(PENDING_KEY, undefined);
        return file;
      },
    );
  } catch (e) {
    if (e instanceof TableNotOpenError) {
      vscode.window.showWarningMessage(e.message);
    } else if (e instanceof AuthError) {
      vscode.window.showWarningMessage('Your TTCraft session expired — sign in again.');
    } else {
      vscode.window.showErrorMessage(`Could not open the table: ${reasonOf(e)}`);
    }
    updateStatus(ext);
    tables.refresh();
    return;
  }

  updateStatus(ext);
  await maybeRecommendLua(context);
  tables.refresh();
  await vscode.window.showTextDocument(uri);
}

/** Quick pick over the tables the user may script; picking one mirrors it. */
async function switchTable(ext: Ext): Promise<void> {
  const { api, auth, folder } = ext;
  if (!(await auth.isSignedIn())) {
    await vscode.commands.executeCommand('ttcraft.signIn');
    return;
  }
  let list: DevTable[];
  try {
    list = await api.tables();
  } catch (e) {
    vscode.window.showErrorMessage(`Could not load tables: ${reasonOf(e)}`);
    return;
  }
  const activeId = folder.activeTable()?.id;
  const items = list
    .sort((a, b) => Number(b.running) - Number(a.running))
    .map((table) => ({
      label: `$(${table.id === activeId ? 'folder-active' : table.running ? 'circle-filled' : 'circle-outline'}) #${table.channel.slug}`,
      description: table.room.name + (table.running ? '' : ' · closed'),
      detail: table.id === activeId ? 'Currently in the table folder' : undefined,
      table,
    }));
  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: 'Pick a table to work on — it replaces the one in the table folder',
    matchOnDescription: true,
  });
  if (pick) {
    await openEntity(ext, pick.table, { kind: 'global' });
  }
}

function updateStatus(ext: Ext): void {
  const table = ext.folder.activeTable();
  void vscode.commands.executeCommand('setContext', 'ttcraft.tableOpen', table !== undefined);
  if (!table) {
    ext.status.hide();
    return;
  }
  ext.status.text = `$(table) ${table.room.name} / #${table.channel.slug}`;
  ext.status.tooltip = `TTCraft table folder: ${ext.folder.dir.fsPath}\nClick to switch to another table.`;
  ext.status.show();
}

function tableOf(item?: TtNode): DevTable | undefined {
  const info = item?.info;
  return info && 'table' in info ? info.table : undefined;
}

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// --- workspace folders ------------------------------------------------------

/** Is the table folder visible in this window — as a workspace folder or inside one? */
function folderInWorkspace(dir: vscode.Uri): boolean {
  return (vscode.workspace.workspaceFolders ?? []).some((f) => f.uri.fsPath === dir.fsPath || isUnder(dir, f.uri));
}

function addWorkspaceFolder(dir: vscode.Uri): void {
  const at = vscode.workspace.workspaceFolders?.length ?? 0;
  vscode.workspace.updateWorkspaceFolders(at, 0, { uri: dir, name: WORKSPACE_FOLDER_NAME });
}
