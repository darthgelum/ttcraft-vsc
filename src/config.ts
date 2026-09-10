import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

/** Where the extension points when the setting is missing or blanked out. */
const DEFAULT_URL = 'https://ttcraft.net';

/** The configured TTCraft site base URL, without a trailing slash. */
export function baseUrl(): string {
  const raw = vscode.workspace.getConfiguration('ttcraft').get<string>('url', '').trim();
  return (raw || DEFAULT_URL).replace(/\/+$/, '');
}

/**
 * The folder the active table is mirrored into. Empty setting → a folder under
 * the extension's global storage. A path inside an already-open workspace
 * folder is the way to avoid the workspace-folder change (and the extension
 * host restart it causes) entirely.
 */
export function tableDir(context: vscode.ExtensionContext): vscode.Uri {
  const raw = vscode.workspace.getConfiguration('ttcraft').get<string>('tableFolder', '').trim();
  if (!raw) {
    return vscode.Uri.joinPath(context.globalStorageUri, 'table');
  }
  const expanded = raw.replace(/^~(?=$|[\\/])/, os.homedir());
  return vscode.Uri.file(path.resolve(expanded));
}
