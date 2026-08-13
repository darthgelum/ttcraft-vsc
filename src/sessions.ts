import { DevApi } from './api';
import { TableSession } from './session';
import type { DevTable } from './types';

/** Owns the live table connections and hands them out by id. */
export class SessionManager {
  private readonly sessions = new Map<number, TableSession>();
  private changeListener?: () => void;

  constructor(private readonly api: DevApi) {}

  /** Notified when any session's entity set changes live (for tree refresh). */
  setChangeListener(fn: () => void): void {
    this.changeListener = fn;
    for (const session of this.sessions.values()) {
      session.setChangeListener(fn);
    }
  }

  ensure(table: DevTable): TableSession {
    let session = this.sessions.get(table.id);
    if (!session) {
      session = new TableSession(table, this.api);
      if (this.changeListener) {
        session.setChangeListener(this.changeListener);
      }
      this.sessions.set(table.id, session);
    }
    return session;
  }

  /** Reconnect every open session for a full resync (fire-and-forget). */
  resyncAll(): void {
    for (const session of this.sessions.values()) {
      void session.resync().catch(() => undefined);
    }
  }

  close(id: number): void {
    this.sessions.get(id)?.dispose();
    this.sessions.delete(id);
  }

  disposeAll(): void {
    for (const session of this.sessions.values()) {
      session.dispose();
    }
    this.sessions.clear();
  }
}
