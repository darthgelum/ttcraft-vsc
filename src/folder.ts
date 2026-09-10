import * as path from 'path';
import * as vscode from 'vscode';
import { agentsMd, claudeMd } from './agents';
import { baseUrl } from './config';
import { diagnostics, errorLine, tableConsole } from './log';
import { luarc } from './lua';
import type { ScriptResult, TableSession } from './session';
import type { DevTable } from './types';

export type Target =
  | { kind: 'global' }
  | { kind: 'object'; guid: string }
  | { kind: 'template'; id: string };

/** `.ttcraft/table.json` — what the folder mirrors, readable by agents and by the next extension host. */
export interface Marker {
  format: 'ttcraft-table';
  site: string;
  table: DevTable;
  /**
   * connected: mirrored live. disconnected: the last reconnect failed (retried
   * on the next activation). closed: the user closed it — not retried.
   */
  status: 'connected' | 'disconnected' | 'closed';
  /** Why not connected, when status says so. */
  reason?: string;
  updatedAt: string;
}

interface Active {
  session: TableSession;
  watcher: vscode.FileSystemWatcher;
  /** fsPath → last content we wrote or pushed, to ignore our own write echoes. */
  synced: Map<string, string>;
}

const PROBE_CONCURRENCY = 8;
const META_DIR = '.ttcraft';
const MARKER = 'table.json';
const CONSOLE_LOG = 'console.log';

/** Everything the extension ever writes into the folder; nothing else is ever deleted. */
const OWNED = ['global.lua', 'objects', 'templates', '.luarc.json', 'AGENTS.md', 'CLAUDE.md', META_DIR];

/**
 * One folder, one table. The active table's scripts are materialized as real
 * files so the Lua language server and AI agents (which work on the
 * filesystem, not VS Code virtual schemes) can see and edit them; saving a file
 * pushes it back to the table, a compile error becomes a diagnostic and the
 * previous version keeps running.
 *
 *   global.lua                              the Global script
 *   objects/<Name>__<guid>.lua              a live object's script
 *   templates/<Category>/…/<Name>__<id>.lua a library template's script
 *   .ttcraft/table.json, console.log        the marker and the console mirror
 *   AGENTS.md, CLAUDE.md, .luarc.json       orientation for agents and LuaLS
 *
 * Switching to another table wipes the scripts and rebuilds the folder, so an
 * agent working in it never sees two tables at once. The folder itself is
 * never added or removed from the workspace here: that is the caller's
 * business, because changing workspace folders can restart the extension host.
 */
export class TableFolder {
  private active?: Active;
  /** In-flight build, so concurrent opens share one and reconcile stays out. */
  private building?: Promise<void>;

  constructor(
    readonly dir: vscode.Uri,
    private readonly libraryDir: string,
  ) {}

  activeTable(): DevTable | undefined {
    return this.active?.session.table;
  }

  /** Create the folder (so it can be added to the workspace) and refuse one we don't own. */
  async ensureDir(): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.dir);
    const entries = await vscode.workspace.fs.readDirectory(this.dir);
    const foreign = entries.filter(([name]) => !OWNED.includes(name));
    if (foreign.length > 0 && !entries.some(([name]) => name === META_DIR)) {
      throw new Error(
        `The table folder ${this.dir.fsPath} is not empty and was not created by TTCraft. ` +
          'Point the ttcraft.tableFolder setting at an empty folder.',
      );
    }
  }

  /** The marker the last extension host left behind, if any. */
  async readMarker(): Promise<Marker | undefined> {
    try {
      const raw = await vscode.workspace.fs.readFile(this.metaUri(MARKER));
      const marker = JSON.parse(Buffer.from(raw).toString('utf8')) as Marker;
      return marker?.format === 'ttcraft-table' && typeof marker.table?.id === 'number' ? marker : undefined;
    } catch {
      return undefined;
    }
  }

  /** Make `session`'s table the one in the folder, rebuilding it if it's a different table. */
  async open(session: TableSession): Promise<void> {
    if (this.active?.session === session) {
      return;
    }
    if (this.building) {
      await this.building;
      if (this.active?.session === session) {
        return;
      }
    }
    this.building = this.switchTo(session).finally(() => {
      this.building = undefined;
    });
    return this.building;
  }

  /** Ensure one entity's file exists (creating it for a script-less object), and return it. */
  async fileFor(session: TableSession, target: Target): Promise<vscode.Uri> {
    await this.open(session);
    const active = this.active!;
    const uri = this.uriFor(session, target);
    if (!active.synced.has(uri.fsPath)) {
      await this.write(uri, await this.currentCode(session, target), active.synced);
    }
    return uri;
  }

  /** Re-pull every script from the server (after a resync). */
  async refresh(): Promise<void> {
    const session = this.active?.session;
    if (!session || this.building) {
      return;
    }
    this.building = this.switchTo(session).finally(() => {
      this.building = undefined;
    });
    return this.building;
  }

  /**
   * Live changes: an object despawned → its file goes; a template edited in the
   * browser → its file follows. Object scripts edited in the browser are not
   * broadcast, so those wait for a refresh.
   */
  async reconcile(): Promise<void> {
    const active = this.active;
    if (!active || this.building) {
      return;
    }
    const session = active.session;
    for (const uri of await this.luaFilesUnder(vscode.Uri.joinPath(this.dir, 'objects'))) {
      const target = targetOf(this.dir, uri);
      if (target?.kind === 'object' && !session.objectByGuid(target.guid)) {
        await this.remove(uri, active.synced);
      }
    }
    for (const uri of await this.luaFilesUnder(vscode.Uri.joinPath(this.dir, 'templates'))) {
      const target = targetOf(this.dir, uri);
      if (target?.kind !== 'template') {
        continue;
      }
      const code = String(session.template(target.id)?.script ?? '');
      if (code.trim() === '') {
        await this.remove(uri, active.synced);
      } else if (active.synced.get(uri.fsPath) !== code) {
        await this.write(uri, code, active.synced);
      }
    }
  }

  /** Stop mirroring on the user's say-so: drop the scripts, leave a marker saying so. */
  async close(reason = 'closed from VS Code'): Promise<void> {
    const active = this.active;
    if (!active) {
      return;
    }
    this.stopWatching();
    await this.wipeScripts();
    await this.writeOrientation(active.session.table, 'closed', reason);
  }

  /** Note in the marker that the last known table could not be reconnected. */
  async markDisconnected(table: DevTable, reason: string): Promise<void> {
    this.stopWatching();
    await this.wipeScripts();
    await this.writeOrientation(table, 'disconnected', reason);
  }

  /** Stop watching but leave the files alone (the extension host is going away). */
  dispose(): void {
    this.stopWatching();
  }

  // --- building -------------------------------------------------------------

  private async switchTo(session: TableSession): Promise<void> {
    if (this.active && this.active.session !== session) {
      await closeTabsUnder(this.dir);
    }
    this.stopWatching();
    await session.whenLocalized();
    await this.wipeScripts();
    try {
      await this.build(session);
    } catch (e) {
      // Half a table is worse than none: an agent would read it as whole.
      await this.wipeScripts();
      await this.writeOrientation(session.table, 'disconnected', e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  private async build(session: TableSession): Promise<void> {
    const synced = new Map<string, string>();
    await this.writeOrientation(session.table, 'connected');
    await this.write(vscode.Uri.joinPath(this.dir, '.luarc.json'), luarc(this.libraryDir), synced);
    await this.write(vscode.Uri.joinPath(this.dir, 'global.lua'), await session.getGlobalScript(), synced);

    // Templates keep the library's category tree as nested folders.
    for (const t of await session.listTemplates()) {
      const code = String(t.script ?? '');
      if (code.trim() !== '') {
        await this.write(this.templateUri(session, t.id), code, synced);
      }
    }

    // Objects don't advertise whether they carry a script, so probe them — but
    // only materialize the ones that do, to keep the tree readable.
    await mapLimit(session.listObjects(), PROBE_CONCURRENCY, async (o) => {
      let code = '';
      try {
        code = await session.getObjectScript(o.guid);
      } catch {
        return;
      }
      if (code.trim() !== '') {
        await this.write(this.objectUri(session, o.guid), code, synced);
      }
    });

    // Created after the initial writes so materialization doesn't echo back.
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this.dir, '**/*.lua'));
    const onEdit = (uri: vscode.Uri) => void this.onEdit(session, uri, synced);
    watcher.onDidChange(onEdit);
    watcher.onDidCreate(onEdit);

    this.active = { session, watcher, synced };
    tableConsole.attachFile(this.metaUri(CONSOLE_LOG).fsPath, session.label);
    tableConsole.note(`[${session.label}] table folder ready: ${this.dir.fsPath}`, session.label);
  }

  private stopWatching(): void {
    if (!this.active) {
      return;
    }
    this.active.watcher.dispose();
    this.active = undefined;
    tableConsole.detachFile();
    clearDiagnosticsUnder(this.dir);
  }

  private async wipeScripts(): Promise<void> {
    for (const name of ['global.lua', 'objects', 'templates']) {
      await vscode.workspace.fs
        .delete(vscode.Uri.joinPath(this.dir, name), { recursive: true, useTrash: false })
        .then(undefined, () => undefined);
    }
  }

  /** Marker, AGENTS.md and CLAUDE.md — the files that tell a reader what this folder is. */
  private async writeOrientation(table: DevTable, status: Marker['status'], reason?: string): Promise<void> {
    const site = baseUrl();
    const marker: Marker = {
      format: 'ttcraft-table',
      site,
      table,
      status,
      reason: status === 'connected' ? undefined : reason ?? status,
      updatedAt: new Date().toISOString(),
    };
    await vscode.workspace.fs.createDirectory(this.metaUri());
    await this.writePlain(this.metaUri(MARKER), JSON.stringify(marker, null, 2) + '\n');
    const libraryFile = path.join(this.libraryDir, 'ttcraft.lua');
    const summary = status === 'connected' ? 'connected' : marker.reason ?? status;
    await this.writePlain(vscode.Uri.joinPath(this.dir, 'AGENTS.md'), agentsMd({ site, table, libraryFile, status: summary }));
    await this.writePlain(vscode.Uri.joinPath(this.dir, 'CLAUDE.md'), claudeMd());
  }

  // --- syncing --------------------------------------------------------------

  private async onEdit(session: TableSession, uri: vscode.Uri, synced: Map<string, string>): Promise<void> {
    const target = targetOf(this.dir, uri);
    if (!target) {
      return;
    }

    let content: string;
    try {
      content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
    } catch {
      return;
    }
    const previous = synced.get(uri.fsPath);
    if (previous === content) {
      return; // our own write, not a user edit
    }
    synced.set(uri.fsPath, content);

    const file = path.relative(this.dir.fsPath, uri.fsPath);
    let result: ScriptResult;
    try {
      result = await this.push(session, target, content);
    } catch (e) {
      // Nothing reached the table, so forget the optimistic entry — otherwise an
      // identical re-save would read as our own echo and never be pushed.
      if (previous === undefined) {
        synced.delete(uri.fsPath);
      } else {
        synced.set(uri.fsPath, previous);
      }
      tableConsole.note(`[${session.label}] ${file}: not saved — ${e instanceof Error ? e.message : String(e)}`, session.label);
      return;
    }

    if (result.ok) {
      diagnostics.delete(uri);
      tableConsole.note(`[${session.label}] ${file}: saved to the table`, session.label);
      return;
    }

    const message = result.error || 'The table rejected the script.';
    const line = errorLine(message);
    diagnostics.set(uri, [
      new vscode.Diagnostic(new vscode.Range(line, 0, line, 200), message, vscode.DiagnosticSeverity.Error),
    ]);
    tableConsole.note(`[${session.label}] ${file}: rejected — ${message}`, session.label);
    vscode.window.showWarningMessage(`${path.basename(uri.fsPath)}: ${message}`);
  }

  private push(session: TableSession, target: Target, code: string): Promise<ScriptResult> {
    switch (target.kind) {
      case 'global':
        return session.setGlobalScript(code);
      case 'object':
        return session.setObjectScript(target.guid, code);
      case 'template':
        return session.setTemplateScript(target.id, code);
    }
  }

  private currentCode(session: TableSession, target: Target): Promise<string> {
    switch (target.kind) {
      case 'global':
        return session.getGlobalScript();
      case 'object':
        return session.getObjectScript(target.guid);
      case 'template':
        return session.getTemplateScript(target.id);
    }
  }

  private uriFor(session: TableSession, target: Target): vscode.Uri {
    switch (target.kind) {
      case 'global':
        return vscode.Uri.joinPath(this.dir, 'global.lua');
      case 'object':
        return this.objectUri(session, target.guid);
      case 'template':
        return this.templateUri(session, target.id);
    }
  }

  private objectUri(session: TableSession, guid: string): vscode.Uri {
    return vscode.Uri.joinPath(this.dir, 'objects', objectFile(guid, session.localizeName(session.objectByGuid(guid)?.name)));
  }

  private templateUri(session: TableSession, id: string): vscode.Uri {
    const t = session.template(id);
    const segments = session.categorySegments(t?.category).map(sanitize);
    return vscode.Uri.joinPath(this.dir, 'templates', ...segments, templateFile(id, session.localizeName(t?.name)));
  }

  private metaUri(name?: string): vscode.Uri {
    return name ? vscode.Uri.joinPath(this.dir, META_DIR, name) : vscode.Uri.joinPath(this.dir, META_DIR);
  }

  private async write(uri: vscode.Uri, content: string, synced: Map<string, string>): Promise<void> {
    synced.set(uri.fsPath, content);
    await this.writePlain(uri, content);
  }

  private async writePlain(uri: vscode.Uri, content: string): Promise<void> {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
  }

  private async remove(uri: vscode.Uri, synced: Map<string, string>): Promise<void> {
    synced.delete(uri.fsPath);
    diagnostics.delete(uri);
    await vscode.workspace.fs.delete(uri, { useTrash: false }).then(undefined, () => undefined);
  }

  private async luaFilesUnder(dir: vscode.Uri): Promise<vscode.Uri[]> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
      return [];
    }
    const found: vscode.Uri[] = [];
    for (const [name, type] of entries) {
      const child = vscode.Uri.joinPath(dir, name);
      if (type === vscode.FileType.Directory) {
        found.push(...(await this.luaFilesUnder(child)));
      } else if (name.toLowerCase().endsWith('.lua')) {
        found.push(child);
      }
    }
    return found;
  }
}

// --- file naming: <sanitized name>__<stable id>.lua -------------------------

function objectFile(guid: string, name?: string): string {
  return `${sanitize(name)}__${guid}.lua`;
}

function templateFile(id: string, name?: string): string {
  return `${sanitize(name)}__${id}.lua`;
}

/**
 * Names and category segments come off the wire, so this has to produce a
 * single, inert path component: trailing dots and spaces are illegal on
 * Windows, and stripping them also collapses `.`/`..` — which would otherwise
 * survive as a path hop out of the mirror directory — down to the fallback.
 */
function sanitize(name: string | undefined): string {
  return (
    (name ?? '')
      .replace(/[^\w .-]/g, '_')
      .replace(/_+/g, '_')
      .trim()
      .replace(/[. ]+$/, '') || 'item'
  );
}

/** Drop stale script errors for files we're about to delete. */
function clearDiagnosticsUnder(dir: vscode.Uri): void {
  const stale: vscode.Uri[] = [];
  diagnostics.forEach((uri) => {
    if (isUnder(uri, dir)) {
      stale.push(uri);
    }
  });
  for (const uri of stale) {
    diagnostics.delete(uri);
  }
}

/** Close editors on the outgoing table's files so they don't show the incoming table's. */
async function closeTabsUnder(dir: vscode.Uri): Promise<void> {
  const tabs = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => tab.input instanceof vscode.TabInputText && isUnder(tab.input.uri, dir));
  if (tabs.length > 0) {
    await vscode.window.tabGroups.close(tabs, true);
  }
}

export function isUnder(uri: vscode.Uri, dir: vscode.Uri): boolean {
  const rel = path.relative(dir.fsPath, uri.fsPath);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function targetOf(dir: vscode.Uri, uri: vscode.Uri): Target | undefined {
  const rel = path.relative(dir.fsPath, uri.fsPath).split(path.sep).join('/');
  if (rel === 'global.lua') {
    return { kind: 'global' };
  }
  if (rel.startsWith('objects/')) {
    return { kind: 'object', guid: idPart(rel) };
  }
  if (rel.startsWith('templates/')) {
    return { kind: 'template', id: idPart(rel) };
  }
  return undefined;
}

/** The stable id is everything after the last `__`, before `.lua`. */
function idPart(rel: string): string {
  const base = rel.slice(rel.lastIndexOf('/') + 1).replace(/\.lua$/i, '');
  const i = base.lastIndexOf('__');
  return i >= 0 ? base.slice(i + 2) : base;
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await fn(item);
    }
  });
  await Promise.all(workers);
}
