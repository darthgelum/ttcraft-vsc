import * as path from 'path';
import * as vscode from 'vscode';
import { diagnostics, errorLine, tableConsole } from './log';
import { luarc } from './lua';
import type { ScriptResult, TableSession } from './session';

export type Target =
  | { kind: 'global' }
  | { kind: 'object'; guid: string }
  | { kind: 'template'; id: string };

interface Mirror {
  dir: vscode.Uri;
  watcher: vscode.FileSystemWatcher;
  /** fsPath → last content we wrote or pushed, to ignore our own write echoes. */
  synced: Map<string, string>;
}

const PROBE_CONCURRENCY = 8;

/**
 * Materializes a table's scripts as real files on disk so the Lua language
 * server and AI agents (which work on the filesystem, not VS Code virtual
 * schemes) can see and edit them. Saving a file pushes it back to the table;
 * a compile error becomes a diagnostic and the previous version keeps running.
 *
 *   global.lua                    the Global script
 *   objects/<Name>__<guid>.lua    a live object's script
 *   templates/<Name>__<id>.lua    a library template's script
 */
export class MirrorManager {
  private readonly mirrors = new Map<number, Mirror>();
  /** In-flight materializations, so concurrent opens share one build. */
  private readonly building = new Map<number, Promise<vscode.Uri>>();
  private readonly root: vscode.Uri;

  constructor(context: vscode.ExtensionContext, private readonly libraryDir: string) {
    this.root = vscode.Uri.joinPath(context.globalStorageUri, 'tables');
  }

  rootDir(): vscode.Uri {
    return this.root;
  }

  dirFor(tableId: number): vscode.Uri {
    return vscode.Uri.joinPath(this.root, String(tableId));
  }

  isMaterialized(tableId: number): boolean {
    return this.mirrors.has(tableId);
  }

  /** Create the table's folder on disk (so it can be added as a workspace folder). */
  async ensureDir(tableId: number): Promise<vscode.Uri> {
    const dir = this.dirFor(tableId);
    await vscode.workspace.fs.createDirectory(dir);
    return dir;
  }

  /** Write the scripted entities to disk and start watching for edits. */
  materialize(session: TableSession): Promise<vscode.Uri> {
    const existing = this.mirrors.get(session.table.id);
    if (existing) {
      return Promise.resolve(existing.dir);
    }

    // Opening two entities on the same table at once would otherwise build the
    // mirror twice; the loser's watcher would leak and double every push.
    let building = this.building.get(session.table.id);
    if (!building) {
      building = this.build(session).finally(() => this.building.delete(session.table.id));
      this.building.set(session.table.id, building);
    }
    return building;
  }

  private async build(session: TableSession): Promise<vscode.Uri> {
    const dir = this.dirFor(session.table.id);
    await session.whenLocalized();

    const synced = new Map<string, string>();
    await this.write(vscode.Uri.joinPath(dir, '.luarc.json'), luarc(this.libraryDir), synced);
    await this.write(vscode.Uri.joinPath(dir, 'global.lua'), await session.getGlobalScript(), synced);

    // Templates keep the library's category tree as nested folders.
    for (const t of await session.listTemplates()) {
      const code = String(t.script ?? '');
      if (code.trim() !== '') {
        await this.write(this.templateUri(dir, session, t.id), code, synced);
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
        await this.write(this.objectUri(dir, session, o.guid), code, synced);
      }
    });

    // Created after the initial writes so materialization doesn't echo back.
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(dir, '**/*.lua'));
    const onEdit = (uri: vscode.Uri) => void this.onEdit(session, dir, uri, synced);
    watcher.onDidChange(onEdit);
    watcher.onDidCreate(onEdit);

    this.mirrors.set(session.table.id, { dir, watcher, synced });
    return dir;
  }

  /** Ensure one entity's file exists (creating it for a script-less object), and return it. */
  async fileFor(session: TableSession, target: Target): Promise<vscode.Uri> {
    await this.materialize(session);
    const mirror = this.mirrors.get(session.table.id)!;
    const uri = this.uriFor(mirror.dir, session, target);
    if (!mirror.synced.has(uri.fsPath)) {
      await this.write(uri, await this.currentCode(session, target), mirror.synced);
    }
    return uri;
  }

  close(tableId: number): void {
    const mirror = this.mirrors.get(tableId);
    if (!mirror) {
      return;
    }
    mirror.watcher.dispose();
    this.mirrors.delete(tableId);
    clearDiagnosticsUnder(mirror.dir);
    void vscode.workspace.fs.delete(mirror.dir, { recursive: true, useTrash: false }).then(undefined, () => undefined);
  }

  /** Close every mirror and delete its files — sign-out, not shutdown. */
  closeAll(): void {
    for (const id of [...this.mirrors.keys()]) {
      this.close(id);
    }
  }

  /** Stop watching but leave the files alone (the extension is going away). */
  disposeAll(): void {
    for (const id of [...this.mirrors.keys()]) {
      this.mirrors.get(id)?.watcher.dispose();
    }
    this.mirrors.clear();
  }

  // --- syncing --------------------------------------------------------------

  private async onEdit(session: TableSession, dir: vscode.Uri, uri: vscode.Uri, synced: Map<string, string>): Promise<void> {
    const target = targetOf(dir, uri);
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
      tableConsole.note(`[${session.label}] ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    if (result.ok) {
      diagnostics.delete(uri);
      return;
    }

    const message = result.error || 'The table rejected the script.';
    const line = errorLine(message);
    diagnostics.set(uri, [
      new vscode.Diagnostic(new vscode.Range(line, 0, line, 200), message, vscode.DiagnosticSeverity.Error),
    ]);
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

  private uriFor(dir: vscode.Uri, session: TableSession, target: Target): vscode.Uri {
    switch (target.kind) {
      case 'global':
        return vscode.Uri.joinPath(dir, 'global.lua');
      case 'object':
        return this.objectUri(dir, session, target.guid);
      case 'template':
        return this.templateUri(dir, session, target.id);
    }
  }

  private objectUri(dir: vscode.Uri, session: TableSession, guid: string): vscode.Uri {
    return vscode.Uri.joinPath(dir, 'objects', objectFile(guid, session.localizeName(session.objectByGuid(guid)?.name)));
  }

  private templateUri(dir: vscode.Uri, session: TableSession, id: string): vscode.Uri {
    const t = session.template(id);
    const segments = session.categorySegments(t?.category).map(sanitize);
    return vscode.Uri.joinPath(dir, 'templates', ...segments, templateFile(id, session.localizeName(t?.name)));
  }

  private async write(uri: vscode.Uri, content: string, synced: Map<string, string>): Promise<void> {
    synced.set(uri.fsPath, content);
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
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

/** Drop stale script errors for a mirror we're about to delete. */
function clearDiagnosticsUnder(dir: vscode.Uri): void {
  const stale: vscode.Uri[] = [];
  diagnostics.forEach((uri) => {
    if (uri.fsPath.startsWith(dir.fsPath)) {
      stale.push(uri);
    }
  });
  for (const uri of stale) {
    diagnostics.delete(uri);
  }
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
