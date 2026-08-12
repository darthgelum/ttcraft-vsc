import * as vscode from 'vscode';

/**
 * Per-table console: the table server broadcasts script print()/log()/error
 * output as {type:"log"} frames, which land here. One shared output channel,
 * prefixed by table, is simpler than juggling one channel per table.
 */
class Console {
  private channel = vscode.window.createOutputChannel('TTCraft Table', 'log');

  line(table: string, level: string, message: string): void {
    const stamp = new Date().toISOString().slice(11, 19);
    const tag = level === 'error' ? 'ERROR' : level === 'info' ? 'info' : 'log';
    this.channel.appendLine(`${stamp} [${table}] ${tag}: ${message}`);
  }

  note(message: string): void {
    this.channel.appendLine(message);
  }

  show(): void {
    this.channel.show(true);
  }

  dispose(): void {
    this.channel.dispose();
  }
}

export const tableConsole = new Console();

/**
 * Compile/runtime errors reported by setscript surface as diagnostics on the
 * offending file, so a failed save reads like a normal language error.
 */
export const diagnostics = vscode.languages.createDiagnosticCollection('ttcraft');

/** Parse a leading `chunk:line:` (e.g. `@objects/<guid>.lua:12: msg`) if present. */
export function errorLine(message: string): number {
  const m = message.match(/:(\d+):/);
  return m ? Math.max(0, parseInt(m[1], 10) - 1) : 0;
}
