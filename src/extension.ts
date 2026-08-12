import * as vscode from 'vscode';
import { AuthManager } from './auth';
import { AuthError, DevApi, TableNotOpenError } from './api';
import { diagnostics, tableConsole } from './log';
import { libraryDir, maybeRecommendLua } from './lua';
import { MirrorManager, type Target } from './mirror';
import { SessionManager } from './sessions';
import { TablesProvider, TtNode } from './tablesView';
import type { DevTable } from './types';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const auth = new AuthManager(context);
  const api = new DevApi(auth);
  const sessions = new SessionManager(api);
  const mirror = new MirrorManager(context, libraryDir(context));
  const tables = new TablesProvider(api, auth, sessions, mirror);

  // Live spawns/removals and workbench edits refresh the tree on their own.
  sessions.setChangeListener(() => tables.refresh());

  await auth.syncContext();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('ttcraftTables', tables),
    auth.onDidChange(() => tables.refresh()),
    { dispose: () => sessions.disposeAll() },
    { dispose: () => mirror.disposeAll() },
    { dispose: () => tableConsole.dispose() },
    diagnostics,

    vscode.commands.registerCommand('ttcraft.signIn', async () => {
      if (await auth.signIn()) {
        tables.refresh();
      }
    }),

    vscode.commands.registerCommand('ttcraft.signOut', async () => {
      removeFoldersUnder(mirror.rootDir());
      sessions.disposeAll();
      // closeAll, not disposeAll: signing out should take the mirrored scripts
      // off disk too, not just stop watching them.
      mirror.closeAll();
      await auth.signOut();
      tables.refresh();
    }),

    // Re-read the tree; also reconnect open tables so objects spawned since
    // connect pick up their proper names and any removals reconcile.
    vscode.commands.registerCommand('ttcraft.refreshTables', () => {
      sessions.resyncAll();
      tables.refresh();
    }),

    vscode.commands.registerCommand('ttcraft.openTable', (item?: TtNode) => {
      const table = tableOf(item);
      if (table) {
        void openEntity(context, sessions, mirror, tables, table, { kind: 'global' });
      }
    }),

    vscode.commands.registerCommand('ttcraft.openScript', (table: DevTable, target: Target) =>
      openEntity(context, sessions, mirror, tables, table, target),
    ),

    vscode.commands.registerCommand('ttcraft.closeTable', (item?: TtNode) => {
      const table = tableOf(item);
      if (!table) {
        return;
      }
      removeFolder(mirror.dirFor(table.id));
      mirror.close(table.id);
      sessions.close(table.id);
      tables.refresh();
    }),

    vscode.commands.registerCommand('ttcraft.showConsole', () => tableConsole.show()),
  );
}

export function deactivate(): void {
  // Subscriptions dispose the sessions, mirrors and console.
}

async function openEntity(
  context: vscode.ExtensionContext,
  sessions: SessionManager,
  mirror: MirrorManager,
  tables: TablesProvider,
  table: DevTable,
  target: Target,
): Promise<void> {
  const session = sessions.ensure(table);

  let uri: vscode.Uri;
  try {
    uri = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Opening ${session.label}…` },
      async () => {
        await session.ensureConnected();
        // Add the folder before materialize() creates its watcher, so edits are
        // watched from within a workspace folder.
        const dir = await mirror.ensureDir(table.id);
        ensureFolder(dir, session.label);
        return mirror.fileFor(session, target);
      },
    );
  } catch (e) {
    if (e instanceof TableNotOpenError) {
      vscode.window.showWarningMessage(e.message);
    } else if (e instanceof AuthError) {
      vscode.window.showWarningMessage('Your TTCraft session expired — sign in again.');
    } else {
      vscode.window.showErrorMessage(`Could not open: ${e instanceof Error ? e.message : String(e)}`);
    }
    return;
  }

  await maybeRecommendLua(context);
  tables.refresh();
  await vscode.window.showTextDocument(uri);
}

function tableOf(item?: TtNode): DevTable | undefined {
  const info = item?.info;
  return info && 'table' in info ? info.table : undefined;
}

function ensureFolder(dir: vscode.Uri, name: string): void {
  if ((vscode.workspace.workspaceFolders ?? []).some((f) => f.uri.fsPath === dir.fsPath)) {
    return;
  }
  const at = vscode.workspace.workspaceFolders?.length ?? 0;
  vscode.workspace.updateWorkspaceFolders(at, 0, { uri: dir, name });
}

function removeFolder(dir: vscode.Uri): void {
  const folder = (vscode.workspace.workspaceFolders ?? []).find((f) => f.uri.fsPath === dir.fsPath);
  if (folder) {
    vscode.workspace.updateWorkspaceFolders(folder.index, 1);
  }
}

/** Drop every workspace folder that lives under our storage root (sign-out tidy). */
function removeFoldersUnder(root: vscode.Uri): void {
  const under = (vscode.workspace.workspaceFolders ?? []).filter((f) => f.uri.fsPath.startsWith(root.fsPath));
  for (const folder of under.sort((a, b) => b.index - a.index)) {
    vscode.workspace.updateWorkspaceFolders(folder.index, 1);
  }
}
