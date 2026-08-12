import * as vscode from 'vscode';

/** Where the extension points when the setting is missing or blanked out. */
const DEFAULT_URL = 'https://ttcraft.net';

/** The configured TTCraft site base URL, without a trailing slash. */
export function baseUrl(): string {
  const raw = vscode.workspace.getConfiguration('ttcraft').get<string>('url', '').trim();
  return (raw || DEFAULT_URL).replace(/\/+$/, '');
}
