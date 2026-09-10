import { randomUUID } from 'crypto';
import WebSocket from 'ws';
import { tableConsole } from './log';
import { DevApi } from './api';
import type { DevTable, EffectItem, TableObject, TemplateItem } from './types';

interface Waiter<T> {
  resolve: (v: T) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

export interface ScriptResult {
  ok: boolean;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 12000;
const READY_TIMEOUT_MS = 15000;
const LIBRARY_TIMEOUT_MS = 3000;
const CHANGE_DEBOUNCE_MS = 400;

// Binary state channel (protocol/schema.mjs): delta = u16 changed, changed×35B
// records, u16 removed, removed×u32 ids, u32 simMs. We only read the removed ids.
const TAG_DELTA = 2;
const RECORD_SIZE = 35;

/**
 * One live connection to a table server. Speaks only the JSON side of the
 * protocol — script get/set, the library, and the log stream — and ignores the
 * binary keyframe/delta channels a scripting client doesn't need.
 *
 * Three things carry scripts: live objects (get/setscript, by runtime id →
 * stored by guid), the Global script (get/setglobalscript), and library
 * templates (script inline in the `library` message, saved via `libsave`).
 * Object files are keyed by guid and templates by their string id — both stable
 * across reconnects that renumber runtime ids.
 */
export class TableSession {
  private ws?: WebSocket;
  private connecting?: Promise<void>;
  private ready = false;
  private helloSeen = false;
  private propsSeen = false;
  private librarySeen = false;

  private readyResolve?: () => void;
  private readyReject?: (e: Error) => void;
  private readyTimer?: NodeJS.Timeout;
  private libraryWaiters: (() => void)[] = [];

  private readonly clientId = randomUUID();
  private readonly tabId = randomUUID();

  // Fired (debounced) when the entity set changes live — a spawn, a removal, or a
  // library edit — so the tree can refresh without the user reconnecting.
  private changeListener?: () => void;
  private changeTimer?: NodeJS.Timeout;

  private readonly namesById = new Map<number, { name: string; kind: string }>();
  private readonly byGuid = new Map<string, TableObject>();
  private readonly byId = new Map<number, TableObject>();
  private readonly templates = new Map<string, TemplateItem>();
  private effects: EffectItem[] = [];

  // Built-in template names/categories are i18n keys (e.g. "lib.cat.basics");
  // the table serves the same catalog the browser client uses, so fetch it and
  // resolve keys to English display text. Unknown strings (user-typed names)
  // pass through unchanged — same contract as the client's t().
  private httpUrl = '';
  private catalog: Record<string, string> = {};
  private localeReady: Promise<void> = Promise.resolve();

  private readonly scriptWaiters = new Map<number, Waiter<string>[]>();
  private readonly resultWaiters = new Map<number, Waiter<ScriptResult>[]>();
  private readonly libResultWaiters = new Map<string, Waiter<ScriptResult>[]>();

  constructor(readonly table: DevTable, private readonly api: DevApi) {}

  get label(): string {
    return `${this.table.room.name} / #${this.table.channel.slug}`;
  }

  async ensureConnected(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN && this.ready) {
      return;
    }
    if (!this.connecting) {
      this.connecting = this.doConnect().finally(() => {
        this.connecting = undefined;
      });
    }
    return this.connecting;
  }

  setChangeListener(fn: () => void): void {
    this.changeListener = fn;
  }

  /** Drop the socket and reconnect for a full resync (fresh names + removals). */
  async resync(): Promise<void> {
    this.ready = false;
    this.dropSocket();
    // The old socket will never answer these; failing them now beats making the
    // caller wait out the request timeout.
    this.rejectAll(new Error('Reconnecting to the table.'));
    await this.ensureConnected();
    this.changeListener?.();
  }

  // --- listings -------------------------------------------------------------

  listObjects(): TableObject[] {
    return [...this.byGuid.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async listTemplates(): Promise<TemplateItem[]> {
    await this.ensureLibrary();
    return [...this.templates.values()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }

  async listEffects(): Promise<EffectItem[]> {
    await this.ensureLibrary();
    return this.effects.filter((e) => !e.deleted).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }

  objectByGuid(guid: string): TableObject | undefined {
    return this.byGuid.get(guid);
  }

  template(id: string): TemplateItem | undefined {
    return this.templates.get(id);
  }

  /** Await the display-name catalog (resolves fast even if the fetch failed). */
  async whenLocalized(): Promise<void> {
    await this.localeReady;
  }

  /** Resolve an i18n key to display text; a non-key name passes through. */
  localizeName(name: string | undefined): string {
    const key = name ?? '';
    return this.catalog[key] ?? key;
  }

  /** The category path as resolved display segments (for a nested tree/folders). */
  categorySegments(category: string | undefined): string[] {
    if (!category) {
      return [];
    }
    return category.split('/').filter(Boolean).map((seg) => this.catalog[seg] ?? seg);
  }

  // --- scripts --------------------------------------------------------------

  async getGlobalScript(): Promise<string> {
    await this.ensureConnected();
    this.send({ type: 'getglobalscript' });
    return this.awaitReply(this.scriptWaiters, 0);
  }

  async setGlobalScript(code: string): Promise<ScriptResult> {
    await this.ensureConnected();
    this.send({ type: 'setglobalscript', code });
    return this.awaitReply(this.resultWaiters, 0);
  }

  async getObjectScript(guid: string): Promise<string> {
    await this.ensureConnected();
    const id = this.requireRuntimeId(guid);
    this.send({ type: 'getscript', id });
    return this.awaitReply(this.scriptWaiters, id);
  }

  async setObjectScript(guid: string, code: string): Promise<ScriptResult> {
    await this.ensureConnected();
    const id = this.requireRuntimeId(guid);
    this.send({ type: 'setscript', id, code });
    return this.awaitReply(this.resultWaiters, id);
  }

  /** A template's script is already in hand — it ships inside the library message. */
  async getTemplateScript(id: string): Promise<string> {
    await this.ensureLibrary();
    return String(this.templates.get(id)?.script ?? '');
  }

  /**
   * Save a template's script. `libsave` is a whole-item replace that resets name
   * and category to defaults when they're absent, so the full item is resent
   * with only `script` swapped.
   */
  async setTemplateScript(id: string, code: string): Promise<ScriptResult> {
    await this.ensureLibrary();
    const item = this.templates.get(id);
    if (!item) {
      throw new Error('That template is no longer in the library.');
    }
    this.send({ ...item, type: 'libsave', script: code });
    item.script = code;
    return this.awaitReply(this.libResultWaiters, id);
  }

  dispose(): void {
    if (this.changeTimer) {
      clearTimeout(this.changeTimer);
      this.changeTimer = undefined;
    }
    this.clearReady(new Error('The table session was closed.'));
    this.rejectAll(new Error('The table session was closed.'));
    this.dropSocket();
    this.ready = false;
  }

  /** Detach and close the current socket without tripping our own close handler. */
  private dropSocket(): void {
    const ws = this.ws;
    this.ws = undefined;
    ws?.removeAllListeners();
    ws?.close();
  }

  // --- connection -----------------------------------------------------------

  private async doConnect(): Promise<void> {
    const info = await this.api.connect(this.table.id);
    const url = info.ws_url + (info.ws_url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(info.token);

    this.httpUrl = info.http_url;
    this.localeReady = this.loadLocale();

    this.helloSeen = false;
    this.propsSeen = false;
    this.librarySeen = false;
    this.ready = false;
    this.namesById.clear();
    this.byGuid.clear();
    this.byId.clear();
    this.templates.clear();
    this.effects = [];

    await new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
      // On timeout the socket may still be open and listening — drop it, or it
      // lingers until the process exits and races the next connect.
      this.readyTimer = setTimeout(() => {
        this.dropSocket();
        this.clearReady(new Error('The table did not send its state in time.'));
      }, READY_TIMEOUT_MS);

      const ws = new WebSocket(url);
      this.ws = ws;
      let opened = false;

      ws.on('open', () => {
        opened = true;
        this.send({ type: 'identify', clientId: this.clientId, tabId: this.tabId });
        this.send({ type: 'liblist' }); // nudge the library push, in case
      });
      ws.on('message', (data, isBinary) => this.onMessage(data, isBinary));
      ws.on('error', (err) => {
        if (!opened) {
          this.clearReady(err instanceof Error ? err : new Error(String(err)));
        } else {
          tableConsole.note(`[${this.label}] connection error: ${errText(err)}`);
        }
      });
      ws.on('close', () => this.onClose(opened));
    });
  }

  private onClose(opened: boolean): void {
    if (opened) {
      tableConsole.note(`[${this.label}] disconnected from the table`);
    }
    this.ready = false;
    this.ws = undefined;
    this.rejectAll(new Error('The connection to the table closed.'));
    this.clearReady(new Error('The connection closed before the table sent its state.'));
  }

  private markReady(): void {
    if (this.ready || !this.helloSeen || !this.propsSeen) {
      return;
    }
    this.ready = true;
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = undefined;
    }
    const resolve = this.readyResolve;
    this.readyResolve = undefined;
    this.readyReject = undefined;
    resolve?.();
  }

  private clearReady(err: Error): void {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = undefined;
    }
    const reject = this.readyReject;
    this.readyResolve = undefined;
    this.readyReject = undefined;
    reject?.(err);
  }

  /** Resolve once the library has been received (nudged with liblist). */
  private async ensureLibrary(): Promise<void> {
    await this.ensureConnected();
    if (this.librarySeen) {
      return;
    }
    this.send({ type: 'liblist' });
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, LIBRARY_TIMEOUT_MS);
      this.libraryWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /** Fetch the table's English display catalog; failure leaves keys as-is. */
  private async loadLocale(): Promise<void> {
    if (!this.httpUrl) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${this.httpUrl}/locales/en.json`, { signal: controller.signal });
      if (res.ok) {
        this.catalog = (await res.json()) as Record<string, string>;
      }
    } catch {
      // offline or not served: names fall back to their keys
    } finally {
      clearTimeout(timer);
    }
  }

  // --- messages -------------------------------------------------------------

  private onMessage(data: WebSocket.RawData, isBinary: boolean): void {
    if (isBinary) {
      this.onBinary(data); // only to notice object removals
      return;
    }

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(toText(data));
    } catch {
      return;
    }

    switch (msg.type) {
      case 'hello':
        this.onHello(msg);
        break;
      case 'props':
        this.onProps(msg);
        break;
      case 'library':
        this.onLibrary(msg);
        break;
      case 'effects':
        this.effects = ((msg.items ?? []) as EffectItem[]).slice();
        this.fireChange();
        break;
      case 'script':
        this.settle(this.scriptWaiters, Number(msg.id ?? 0), String(msg.code ?? ''));
        break;
      case 'scriptresult':
        this.settle(this.resultWaiters, Number(msg.id ?? 0), {
          ok: Boolean(msg.ok),
          error: msg.error ? String(msg.error) : undefined,
        });
        break;
      case 'libresult':
        this.settle(this.libResultWaiters, String(msg.id ?? ''), {
          ok: Boolean(msg.ok),
          error: msg.error ? String(msg.error) : undefined,
        });
        break;
      case 'log':
        tableConsole.line(this.label, String(msg.level ?? 'log'), String(msg.msg ?? msg.key ?? ''));
        break;
      case 'kicked':
        tableConsole.note(`[${this.label}] the table server ended this session`);
        break;
    }
  }

  private onHello(msg: Record<string, unknown>): void {
    const game = (msg.game ?? {}) as { objects?: Record<string, { name?: string; type?: string }> };
    for (const [idStr, o] of Object.entries(game.objects ?? {})) {
      this.namesById.set(Number(idStr), { name: o.name ?? '', kind: o.type ?? '' });
    }
    this.helloSeen = true;
    this.mergeNames();
    this.markReady();
  }

  private onProps(msg: Record<string, unknown>): void {
    const wasReady = this.ready;
    const objects = (msg.objects ?? []) as Array<{ id: number; props?: { guid?: string; kind?: string } }>;
    let added = false;
    for (const o of objects) {
      const guid = o.props?.guid;
      if (!guid) {
        continue;
      }
      if (!this.byGuid.has(guid)) {
        added = true;
      }
      const named = this.namesById.get(o.id);
      const obj: TableObject = {
        runtimeId: o.id,
        guid,
        name: named?.name || o.props?.kind || 'object',
        kind: named?.kind || o.props?.kind || '',
      };
      this.byGuid.set(guid, obj);
      this.byId.set(o.id, obj);
    }
    this.propsSeen = true;
    this.markReady();
    // props after the initial snapshot is a live spawn/edit — refresh the tree.
    if (added && wasReady) {
      this.fireChange();
    }
  }

  /** Parse only the delta's removed-id list, to drop despawned objects live. */
  private onBinary(data: WebSocket.RawData): void {
    if (!this.ready) {
      return;
    }
    const buf = Array.isArray(data)
      ? Buffer.concat(data)
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(data as ArrayBuffer);
    if (buf.length < 3 || buf[0] !== TAG_DELTA) {
      return;
    }
    let offset = 1;
    const changed = buf.readUInt16LE(offset);
    offset += 2 + changed * RECORD_SIZE; // skip the changed records
    if (offset + 2 > buf.length) {
      return;
    }
    const removed = buf.readUInt16LE(offset);
    offset += 2;
    let pruned = false;
    for (let i = 0; i < removed && offset + 4 <= buf.length; i++) {
      const id = buf.readUInt32LE(offset);
      offset += 4;
      const obj = this.byId.get(id);
      if (obj) {
        this.byId.delete(id);
        this.byGuid.delete(obj.guid);
        pruned = true;
      }
    }
    if (pruned) {
      this.fireChange();
    }
  }

  private onLibrary(msg: Record<string, unknown>): void {
    const wasSeen = this.librarySeen;
    this.templates.clear();
    for (const item of (msg.items ?? []) as TemplateItem[]) {
      if (item?.id) {
        this.templates.set(item.id, item);
      }
    }
    this.librarySeen = true;
    const waiters = this.libraryWaiters;
    this.libraryWaiters = [];
    for (const w of waiters) {
      w();
    }
    // A later library push is a live workbench edit — refresh the tree.
    if (wasSeen) {
      this.fireChange();
    }
  }

  /** Coalesce bursts of changes into a single tree refresh. */
  private fireChange(): void {
    if (!this.ready || this.changeTimer) {
      return;
    }
    this.changeTimer = setTimeout(() => {
      this.changeTimer = undefined;
      this.changeListener?.();
    }, CHANGE_DEBOUNCE_MS);
  }

  /** hello can arrive after props for late spawns; keep names in sync either way. */
  private mergeNames(): void {
    for (const obj of this.byId.values()) {
      const named = this.namesById.get(obj.runtimeId);
      if (named?.name) {
        obj.name = named.name;
        obj.kind = named.kind || obj.kind;
        this.byGuid.set(obj.guid, obj);
      }
    }
  }

  // --- request plumbing -----------------------------------------------------

  private requireRuntimeId(guid: string): number {
    const obj = this.byGuid.get(guid);
    if (!obj) {
      throw new Error('That object is no longer on the table.');
    }
    return obj.runtimeId;
  }

  private awaitReply<K, T>(map: Map<K, Waiter<T>[]>, id: K): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const waiter: Waiter<T> = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const q = map.get(id);
          if (q) {
            const i = q.indexOf(waiter);
            if (i >= 0) {
              q.splice(i, 1);
            }
            if (q.length === 0) {
              map.delete(id);
            }
          }
          reject(new Error('The table did not answer in time.'));
        }, REQUEST_TIMEOUT_MS),
      };
      const q = map.get(id) ?? [];
      q.push(waiter);
      map.set(id, q);
    });
  }

  private settle<K, T>(map: Map<K, Waiter<T>[]>, id: K, value: T): void {
    const q = map.get(id);
    const waiter = q?.shift();
    // Drained queues would otherwise accumulate one entry per id ever asked for.
    if (q && q.length === 0) {
      map.delete(id);
    }
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(value);
    }
  }

  private rejectAll(err: Error): void {
    this.rejectMap(this.scriptWaiters, err);
    this.rejectMap(this.resultWaiters, err);
    this.rejectMap(this.libResultWaiters, err);
  }

  private rejectMap<K, T>(map: Map<K, Waiter<T>[]>, err: Error): void {
    for (const q of map.values()) {
      for (const w of q) {
        clearTimeout(w.timer);
        w.reject(err);
      }
    }
    map.clear();
  }

  private send(obj: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to the table.');
    }
    this.ws.send(JSON.stringify(obj));
  }
}

function toText(data: WebSocket.RawData): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8');
  }
  if (Buffer.isBuffer(data)) {
    return data.toString('utf8');
  }
  return Buffer.from(data as ArrayBuffer).toString('utf8');
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
