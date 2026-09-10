import * as fs from 'fs';
import * as vscode from 'vscode';

// The on-disk copy of the console: agents can't read the Output panel, so the
// active table's lines are also appended to <table folder>/.ttcraft/console.log.
const FILE_MAX_BYTES = 1024 * 1024;
const FILE_KEEP_BYTES = 256 * 1024;

/**
 * Per-table console: the table server broadcasts script print()/log()/error
 * output as {type:"log"} frames, which land here. One shared output channel,
 * prefixed by table, is simpler than juggling one channel per table.
 */
class Console {
  private channel = vscode.window.createOutputChannel('TTCraft Table', 'log');
  private file?: { path: string; table: string };
  private written = 0;
  /** Serializes appends and the occasional trim so they never interleave. */
  private queue: Promise<void> = Promise.resolve();

  line(table: string, level: string, message: string): void {
    const stamp = new Date().toISOString().slice(11, 19);
    const tag = level === 'error' ? 'ERROR' : level === 'info' ? 'info' : 'log';
    const text = `${stamp} [${table}] ${tag}: ${message}`;
    this.channel.appendLine(text);
    if (this.file?.table === table) {
      this.append(`${stamp} ${tag}: ${message}`);
    }
  }

  /** A line from the extension itself; `table` routes it into that table's log file. */
  note(message: string, table?: string): void {
    this.channel.appendLine(message);
    if (this.file && (table === undefined || table === this.file.table)) {
      this.append(`${new Date().toISOString().slice(11, 19)} ext: ${message}`);
    }
  }

  show(): void {
    this.channel.show(true);
  }

  /** Start mirroring one table's lines into a file (truncating what was there). */
  attachFile(path: string, table: string): void {
    this.file = { path, table };
    this.written = 0;
    this.queue = this.queue.then(() => fs.promises.writeFile(path, '')).catch(() => undefined);
  }

  detachFile(): void {
    this.file = undefined;
  }

  dispose(): void {
    this.channel.dispose();
  }

  private append(text: string): void {
    const file = this.file;
    if (!file) {
      return;
    }
    this.written += text.length + 1;
    const trim = this.written > FILE_MAX_BYTES;
    if (trim) {
      this.written = 0;
    }
    this.queue = this.queue
      .then(async () => {
        await fs.promises.appendFile(file.path, text + '\n');
        if (trim) {
          const all = await fs.promises.readFile(file.path);
          const tail = all.subarray(Math.max(0, all.length - FILE_KEEP_BYTES));
          await fs.promises.writeFile(file.path, tail);
          this.written = tail.length;
        }
      })
      .catch(() => undefined);
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
