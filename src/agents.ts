import type { DevTable } from './types';

export interface FolderInfo {
  site: string;
  table: DevTable;
  /** Absolute path of the bundled EmmyLua API stub. */
  libraryFile: string;
  /** 'connected' or a short reason why not. */
  status: string;
}

/**
 * AGENTS.md for the table folder. AI coding agents read it before touching the
 * files, so it says what the folder is, what saving does, and where the real
 * API reference lives — the things an agent otherwise guesses wrong.
 */
export function agentsMd(info: FolderInfo): string {
  const { site, table } = info;
  const connected = info.status === 'connected';
  return `# TTCraft table workspace

This folder is a **live mirror of the Lua scripts on one TTCraft game table**, kept in
sync by the TTCraft VS Code extension. It is not a project: there is no build step, no
package manager, no tests to run, and nothing here executes locally.

- Table: **${table.room.name} / #${table.channel.slug}** (table id ${table.id})
- Site: ${site}
- Status: ${connected ? 'connected — saves go to the running table' : `NOT connected (${info.status}) — the files may be stale and saves will fail`}

Machine-readable copy of this header: \`.ttcraft/table.json\`.

## Files

| Path | What it is |
| --- | --- |
| \`global.lua\` | The table's Global script — house rules, table-wide UI, zones, turn logic. |
| \`objects/<Name>__<guid>.lua\` | The script of one live object. \`<guid>\` is the object's stable identity; the name part is only for reading. |
| \`templates/<Category>/…/<Name>__<id>.lua\` | The script of a library template. Spawning a template copies its script onto the new object; the two are independent afterwards. |
| \`.ttcraft/console.log\` | The table's script console — \`print()\`/\`log()\` output, compile errors from saves, runtime errors — appended live. Read it after a save to see what happened. |
| \`.ttcraft/table.json\` | Which table this folder mirrors and whether the extension is connected. |
| \`.luarc.json\` | Points the Lua language server at the API definitions. Do not edit. |

Only objects and templates that already carry a script have a file here.

## How editing works

- **Saving a \`.lua\` file pushes it to the running table immediately.** There is no
  deploy, commit or upload step. Edits take effect for every player at once.
- A **compile error** is reported in the Problems panel and appended to
  \`.ttcraft/console.log\`; the previously running version keeps running until a good
  save lands.
- A **runtime error** disables that script until the next save. It shows up in
  \`.ttcraft/console.log\`, as does everything the script prints.
- To start a script on an object or template that has none, open it from the
  **TTCraft → Tables** view in VS Code. Do not invent file names: the \`__<id>\` suffix is
  how a file maps to its entity, and a made-up id is rejected.
- Do not create, rename, move or delete files by hand. Deleting a file deletes nothing on
  the table. Do not edit \`.ttcraft/\` or \`.luarc.json\`.
- **The table is the source of truth.** When the extension reconnects, refreshes or
  switches to another table, this folder is rebuilt from the server and anything that
  was never saved is gone.

## The API

- Full manual: ${site}/docs/scripting (markdown for agents: ${site}/llms-full.txt).
- Definitions of every function, with types and doc comments:
  \`${info.libraryFile}\` — read it before assuming an API exists.
- Coordinates are metres: the table's centre is the origin, the felt is \`y = 0\`, \`+x\` runs
  right and \`+z\` toward seat 0 at the near edge; keep everything within ±3 m. The table's
  size, outline, seats and named areas are read with the \`Table\` global and described as
  a table plan (\`Table.set\`): ${site}/docs/table-plan.
- Scripts run **on the server**, sandboxed: Lua 5.4 with \`base\`, \`math\`, \`string\`,
  \`table\` only. No \`require\`, no HTTP, no file or OS access, no client-side code.
- New objects come from \`tw.spawnObject\` (built-in kinds), \`tw.spawnTemplate\` (library
  templates) and \`tw.spawnObjectJSON\` (a snapshot from \`obj:getJSON()\`). Nothing is
  fetched from a URL.
- Models, images, PDFs and other assets are uploaded through the table's workbench in
  the browser, not from scripts and not through this folder. Whole tables move as
  archives: ${site}/docs/table-archives.

## Not possible from this folder

- Booting, closing or resetting the table, uploading assets, or changing anything that
  is not a script.
- Importing content from other virtual tabletops. A Tabletop Simulator save is not a
  supported input; see ${site}/docs/table-archives for what TTCraft can load.
`;
}

/** CLAUDE.md that defers to AGENTS.md, for tools that only read the former. */
export function claudeMd(): string {
  return '# TTCraft table workspace\n\nRead @AGENTS.md first — it explains what this folder is and what saving a file does.\n';
}
