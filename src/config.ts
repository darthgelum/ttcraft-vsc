import * as vscode from 'vscode';

/** The configured TTCraft site base URL, without a trailing slash. */
export function baseUrl(): string {
  const raw = vscode.workspace.getConfiguration('ttcraft').get<string>('url', '').trim();
  return raw.replace(/\/+$/, '');
}
