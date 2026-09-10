import * as vscode from 'vscode';
import { AuthError, DevApi } from './api';
import type { AuthManager } from './auth';
import type { TableFolder, Target } from './folder';
import { SessionManager } from './sessions';
import type { DevTable, TemplateItem } from './types';

type NodeInfo =
  | { kind: 'table'; table: DevTable }
  | { kind: 'global'; table: DevTable }
  | { kind: 'objects'; table: DevTable }
  | { kind: 'templates'; table: DevTable }
  | { kind: 'template-cat'; table: DevTable; path: string[] }
  | { kind: 'effects'; table: DevTable }
  | { kind: 'object'; table: DevTable; guid: string }
  | { kind: 'template'; table: DevTable; id: string }
  | { kind: 'effect' }
  | { kind: 'message' };

const { Collapsed, None } = vscode.TreeItemCollapsibleState;

export class TtNode extends vscode.TreeItem {
  constructor(readonly info: NodeInfo, label: string, state: vscode.TreeItemCollapsibleState) {
    super(label, state);
  }
}

/** Opens a scriptable entity's file. */
function openScript(table: DevTable, target: Target): vscode.Command {
  return { command: 'ttcraft.openScript', title: 'Open script', arguments: [table, target] };
}

/**
 * The TTCraft tree: tables → their Global script, objects, templates and
 * effects. Scriptable entities (global, objects, templates) open as files;
 * effects are data-only and just list.
 */
export class TablesProvider implements vscode.TreeDataProvider<TtNode> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;

  constructor(
    private readonly api: DevApi,
    private readonly auth: AuthManager,
    private readonly sessions: SessionManager,
    private readonly folder: TableFolder,
  ) {}

  refresh(): void {
    this.changed.fire();
  }

  getTreeItem(element: TtNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TtNode): Promise<TtNode[]> {
    if (!element) {
      return this.rootTables();
    }
    try {
      return await this.childrenOf(element.info);
    } catch (e) {
      // A disconnect or timeout mid-expand would otherwise render as an empty
      // section, which reads as "this table has none of these".
      return [warning(msg(e))];
    }
  }

  private childrenOf(info: NodeInfo): Promise<TtNode[]> {
    switch (info.kind) {
      case 'table':
        return this.tableSections(info.table);
      case 'objects':
        return this.objectLeaves(info.table);
      case 'templates':
        return this.templateChildren(info.table, []);
      case 'template-cat':
        return this.templateChildren(info.table, info.path);
      case 'effects':
        return this.effectLeaves(info.table);
      default:
        return Promise.resolve([]);
    }
  }

  private async rootTables(): Promise<TtNode[]> {
    if (!(await this.auth.isSignedIn())) {
      return [];
    }
    try {
      const tables = await this.api.tables();
      const activeId = this.folder.activeTable()?.id;
      return tables.map((table) => {
        const active = table.id === activeId;
        const node = new TtNode({ kind: 'table', table }, `#${table.channel.slug}`, Collapsed);
        node.description = table.room.name + (active ? ' · in workspace' : table.running ? '' : ' · closed');
        node.tooltip = `${table.room.name} / #${table.channel.slug}` + (active ? `\nMirrored in ${this.folder.dir.fsPath}` : '');
        node.contextValue = active ? 'table-open' : 'table';
        node.iconPath = new vscode.ThemeIcon(active ? 'folder-active' : table.running ? 'circle-filled' : 'circle-outline');
        return node;
      });
    } catch (e) {
      if (e instanceof AuthError) {
        await this.auth.signOut();
      } else {
        vscode.window.showErrorMessage(`Could not load tables: ${msg(e)}`);
      }
      return [];
    }
  }

  private async tableSections(table: DevTable): Promise<TtNode[]> {
    await this.sessions.ensure(table).ensureConnected();

    const global = new TtNode({ kind: 'global', table }, 'Global script', None);
    global.iconPath = new vscode.ThemeIcon('globe');
    global.command = openScript(table, { kind: 'global' });

    const objects = section({ kind: 'objects', table }, 'Objects', 'symbol-method');
    const templates = section({ kind: 'templates', table }, 'Templates', 'library');
    const effects = section({ kind: 'effects', table }, 'Effects', 'sparkle');

    return [global, objects, templates, effects];
  }

  private async objectLeaves(table: DevTable): Promise<TtNode[]> {
    const session = this.sessions.ensure(table);
    await session.ensureConnected();
    await session.whenLocalized();
    return session.listObjects().map((o) => {
      const name = session.localizeName(o.name);
      const node = new TtNode({ kind: 'object', table, guid: o.guid }, name, None);
      node.description = o.kind;
      node.tooltip = `${name} · ${o.guid}`;
      node.iconPath = new vscode.ThemeIcon('file-code');
      node.command = openScript(table, { kind: 'object', guid: o.guid });
      return node;
    });
  }

  /**
   * Templates as their library category tree: `prefix` is the raw category-key
   * path so far, its subfolders and the templates that sit exactly at it.
   */
  private async templateChildren(table: DevTable, prefix: string[]): Promise<TtNode[]> {
    const session = this.sessions.ensure(table);
    await session.ensureConnected();
    await session.whenLocalized();
    const templates = await session.listTemplates();

    const under = templates.filter((t) => startsWith(segsOf(t), prefix));

    const subKeys = new Set<string>();
    for (const t of under) {
      const segs = segsOf(t);
      if (segs.length > prefix.length) {
        subKeys.add(segs[prefix.length]);
      }
    }

    const folders = [...subKeys]
      .sort((a, b) => session.localizeName(a).localeCompare(session.localizeName(b)))
      .map((key) => {
        const node = new TtNode({ kind: 'template-cat', table, path: [...prefix, key] }, session.localizeName(key), Collapsed);
        node.iconPath = new vscode.ThemeIcon('folder');
        return node;
      });

    const leaves = under
      .filter((t) => segsOf(t).length === prefix.length)
      .sort((a, b) => session.localizeName(a.name).localeCompare(session.localizeName(b.name)))
      .map((t) => {
        const scripted = String(t.script ?? '').trim() !== '';
        const name = session.localizeName(t.name ?? t.id);
        const node = new TtNode({ kind: 'template', table, id: t.id }, name, None);
        node.tooltip = `${name} · ${t.id}`;
        node.iconPath = new vscode.ThemeIcon(scripted ? 'file-code' : 'file');
        node.command = openScript(table, { kind: 'template', id: t.id });
        return node;
      });

    return [...folders, ...leaves];
  }

  private async effectLeaves(table: DevTable): Promise<TtNode[]> {
    const session = this.sessions.ensure(table);
    const effects = await session.listEffects();
    // Data-only: no command, so these list but don't open.
    return effects.map((e) => {
      const node = new TtNode({ kind: 'effect' }, e.name ?? e.id, None);
      node.description = e.category;
      node.iconPath = new vscode.ThemeIcon('symbol-color');
      return node;
    });
  }
}

function section(info: NodeInfo, label: string, icon: string): TtNode {
  const node = new TtNode(info, label, Collapsed);
  node.iconPath = new vscode.ThemeIcon(icon);
  return node;
}

/** A dead-end node standing in for children that could not be loaded. */
function warning(text: string): TtNode {
  const node = new TtNode({ kind: 'message' }, text, None);
  node.iconPath = new vscode.ThemeIcon('warning');
  return node;
}

/** Raw category-key segments of a template ("lib.cat.basics/lib.cat.pets" → [...]). */
function segsOf(t: TemplateItem): string[] {
  return String(t.category ?? '').split('/').filter(Boolean);
}

function startsWith(segs: string[], prefix: string[]): boolean {
  return prefix.every((p, i) => segs[i] === p);
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
