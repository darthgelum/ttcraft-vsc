import { baseUrl } from './config';
import type { AuthManager } from './auth';
import type { ConnectResponse, DevTable } from './types';

/** Thrown when the dev token is missing or rejected — the caller re-prompts sign-in. */
export class AuthError extends Error {}

/** Thrown when a table exists but is not currently open on the server. */
export class TableNotOpenError extends Error {}

/** Client for the token-authenticated TTCraft dev API (routes/dev.php). */
export class DevApi {
  constructor(private readonly auth: AuthManager) {}

  async tables(): Promise<DevTable[]> {
    const body = await this.get<{ tables: DevTable[] }>('/api/dev/tables');
    return body.tables;
  }

  /**
   * A fresh short-lived WS token for one table. Called before every (re)connect,
   * since the token lives ~120s.
   */
  async connect(tableId: number): Promise<ConnectResponse> {
    const token = await this.auth.token();
    if (!token) {
      throw new AuthError('Not signed in.');
    }

    const res = await fetch(`${this.base()}/api/dev/tables/${tableId}/connect`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    });

    if (res.status === 401) {
      throw new AuthError('Session expired.');
    }
    if (res.status === 409) {
      throw new TableNotOpenError('The table is not open. Open it from the room in TTCraft, then reconnect.');
    }
    if (!res.ok) {
      throw new Error(`connect failed: HTTP ${res.status}`);
    }

    return (await res.json()) as ConnectResponse;
  }

  private async get<T>(path: string): Promise<T> {
    const token = await this.auth.token();
    if (!token) {
      throw new AuthError('Not signed in.');
    }

    const res = await fetch(`${this.base()}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    });

    if (res.status === 401) {
      throw new AuthError('Session expired.');
    }
    if (!res.ok) {
      throw new Error(`GET ${path} failed: HTTP ${res.status}`);
    }

    return (await res.json()) as T;
  }

  private base(): string {
    return baseUrl();
  }
}
