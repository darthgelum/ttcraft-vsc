import * as os from 'os';
import * as vscode from 'vscode';
import { baseUrl } from './config';
import type { DeviceCodeResponse, DeviceTokenResponse } from './types';

const SECRET_KEY = 'ttcraft.devToken';

// The server's pacing numbers are advisory, and a missing or zero `interval`
// would turn the poll into a tight loop against the token endpoint.
const MIN_POLL_MS = 2000;
const MAX_WAIT_MS = 15 * 60 * 1000;

/**
 * Device Authorization Grant (RFC 8628): the extension never sees a password.
 * It asks TTCraft for a code, sends the user to the browser to approve, then
 * polls for a long-lived dev token kept in SecretStorage.
 */
export class AuthManager {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async token(): Promise<string | undefined> {
    return this.context.secrets.get(SECRET_KEY);
  }

  async isSignedIn(): Promise<boolean> {
    return (await this.token()) !== undefined;
  }

  /** Reflect the signed-in state into a context key the views/menus read. */
  async syncContext(): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'ttcraft.signedIn', await this.isSignedIn());
  }

  async signOut(): Promise<void> {
    await this.context.secrets.delete(SECRET_KEY);
    await this.syncContext();
    this.changed.fire();
  }

  async signIn(): Promise<boolean> {
    const base = baseUrl();

    let start: DeviceCodeResponse;
    try {
      const res = await fetch(`${base}/api/devices/code`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ client_name: `VS Code (${os.hostname()})` }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      start = (await res.json()) as DeviceCodeResponse;
    } catch (e) {
      vscode.window.showErrorMessage(`Could not reach TTCraft at ${base}: ${errText(e)}`);
      return false;
    }

    // The approval URL is server-supplied, so parse it before doing anything
    // else — Uri.parse throws on a malformed one.
    const approval = parseUri(start.verification_uri_complete) ?? parseUri(start.verification_uri);
    if (!approval) {
      vscode.window.showErrorMessage('TTCraft returned an approval link VS Code cannot open.');
      return false;
    }

    // Copy the code, open the approval page once, and leave a reminder with a
    // manual re-open in case the browser didn't launch.
    const code = String(start.user_code ?? '');
    await vscode.env.clipboard.writeText(code);
    await vscode.env.openExternal(approval);
    const reopen = 'Open browser';
    void vscode.window
      .showInformationMessage(`Approve the sign-in in your browser. The code ${code} is already on your clipboard.`, reopen)
      .then((pick) => {
        if (pick === reopen) {
          vscode.env.openExternal(approval);
        }
      });

    const token = await this.poll(base, start);
    if (!token) {
      return false;
    }

    await this.context.secrets.store(SECRET_KEY, token);
    await this.syncContext();
    this.changed.fire();
    return true;
  }

  private async poll(base: string, start: DeviceCodeResponse): Promise<string | undefined> {
    const deadline = Date.now() + clampWindow(start.expires_in);
    let interval = Math.max(MIN_POLL_MS, seconds(start.interval));

    return vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Waiting for approval in the browser…', cancellable: true },
      async (_progress, cancel) => {
        while (Date.now() < deadline && !cancel.isCancellationRequested) {
          await sleep(interval);
          if (cancel.isCancellationRequested) {
            return undefined;
          }

          let res: Response;
          try {
            res = await fetch(`${base}/api/devices/token`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ device_code: start.device_code }),
            });
          } catch {
            continue; // transient network blip: keep polling until the deadline
          }

          if (res.ok) {
            const body = (await res.json()) as DeviceTokenResponse;
            vscode.window.showInformationMessage(`Signed in to TTCraft as ${body.user.username}.`);
            return body.access_token;
          }

          const err = ((await res.json().catch(() => ({}))) as { error?: string }).error;
          if (err === 'authorization_pending') {
            continue;
          }
          if (err === 'slow_down') {
            interval += 5000;
            continue;
          }
          if (err === 'access_denied') {
            vscode.window.showWarningMessage('The sign-in was declined in the browser.');
            return undefined;
          }
          // expired_token / invalid_grant: nothing more to wait for.
          vscode.window.showWarningMessage('The sign-in code expired. Try again.');
          return undefined;
        }
        return undefined;
      },
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** A response field in seconds as milliseconds; anything unusable reads as 0. */
function seconds(value: number | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n * 1000 : 0;
}

/** How long to keep polling: what the server asked for, capped and never zero. */
function clampWindow(expiresIn: number | undefined): number {
  return Math.min(seconds(expiresIn) || MAX_WAIT_MS, MAX_WAIT_MS);
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function parseUri(value: string | undefined): vscode.Uri | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return vscode.Uri.parse(value, true);
  } catch {
    return undefined;
  }
}
