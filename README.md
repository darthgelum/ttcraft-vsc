# TTCraft VSC

Edit the Lua scripts on your [TTCraft](https://ttcraft.net) game tables straight from VS Code — a tree of your tables and their scriptable entities, real files on disk your AI agents can read and edit, core-API autocomplete, and the table's script console in the Output panel and in a file.

> Status: **early.** The core loop (sign in → open a table → edit and save scripts → watch the console) works. See [Limitations](#limitations). The full guide lives in the TTCraft manual: [Scripting from VS Code](https://ttcraft.net/docs/vscode).

## How it works

The extension talks to two things:

- **TTCraft** — only to sign in and to list the tables you may manage. Sign-in uses the OAuth Device Authorization Grant (like `gh auth login`): you approve the extension in your browser, no password is ever typed into the editor.
- **The table server** — over its own WebSocket protocol, to read and write scripts and stream the console. The extension is just another client of the same protocol the browser table uses; every action still runs through the server's permission checks.

Opening a table **mirrors its scripts as real files** into one folder — the *table folder* — and adds that folder to your workspace:

```
AGENTS.md, CLAUDE.md               what this folder is, for AI agents
global.lua                         the table-level Global script
objects/<Name>__<guid>.lua         a live object's script
templates/<Category>/…/<Name>__<id>.lua   a library template's script, foldered by its category
.ttcraft/table.json                which table is mirrored, and whether it is connected
.ttcraft/console.log               the table's script console, appended live
.luarc.json                        points the Lua language server at the TTCraft API
```

**One folder, one table.** Opening a script on a different table switches the folder: editors on the old table's files close, its files are removed, and the new table's scripts come in. Nothing is lost — the table is the source of truth and saves push immediately — and an AI agent working in the folder never sees two tables mixed together. The status bar shows which table is in the folder; click it to switch.

Display names come from the table's own localization catalog (the same one the browser uses), so built-in objects and templates read as real names rather than i18n keys, and templates keep the library's category tree as nested folders.

Real files (rather than a virtual file system) are what let the **Lua language server** and **AI coding agents** (Copilot, Claude, Codex, …) see, read and edit the scripts — they work on the filesystem. Saving a file pushes the script to the live table; if it doesn't compile, the save surfaces the error as a diagnostic (and a line in `.ttcraft/console.log`) and the previously running version keeps running, exactly like editing in the browser.

The **Tables** view lists each table's entities:

- **Global script**, **Objects** and **Templates** are scriptable — they open as files.
- **Effects** and other workbench libraries are data-only — they just list.

The tree updates live as objects are spawned or removed on the table and as the library changes, so what you add in the app appears here; a despawned object's file disappears, a template edited in the browser is rewritten. The refresh button forces a full resync (reconnect and re-pull every script), which also gives objects spawned since you connected their proper names.

> An object's script and the script of the template it was spawned from are **independent** — editing one does not change the other.

## Setup

1. Set **Settings → Extensions → TTCraft → Url** to your site (default `https://ttcraft.net`).
2. Open the **TTCraft** view in the Activity Bar and click **Sign in**. Approve the request in the browser tab that opens.
3. Expand a table to browse its objects and templates, then click one to open its script — or use **Open table** to mirror the whole table and open `global.lua`.
4. Edit and save (`Ctrl+S`). Script output and errors appear in the **TTCraft Table** output channel (`TTCraft: Show table console`) and in `.ttcraft/console.log`.

Install the **Lua** extension (`sumneko.lua`) when prompted for syntax highlighting and API autocomplete — the extension ships EmmyLua definitions for `tw`, the object and player handles, `JSON`/`Vector`/`Color`, and the event callbacks, and wires them up via the folder's `.luarc.json`.

The table must already be open in TTCraft (start it from the room). You need the **Manage table** permission in the room for it to appear.

### The table folder and workspace restarts

By default the table folder lives under the extension's storage and is added to your workspace the first time you open a table. VS Code restarts all extensions when a window gets its first folder, and reloads the window when a single-folder workspace becomes a multi-root one — so that first open may flash. The extension takes it in stride: the open you started is finished after the restart, and a table folder that is already in the workspace reconnects on its own whenever the window opens.

To avoid the restart entirely, set **Settings → TTCraft → Table Folder** to an empty folder *inside* a workspace folder you already have open (say `my-game/table`). Nothing is added to the workspace then, and your agent sees the table's scripts next to your own files. The folder must be empty when first used; the extension owns its contents from then on.

Neither closing the table nor signing out removes the folder from the workspace (that could restart extensions too); they empty it and leave a note in `AGENTS.md` and `.ttcraft/table.json` saying no table is connected.

## Working with AI agents

Point the agent at the table folder (or open VS Code on it). `AGENTS.md` there explains the files, that saving pushes to the live table, where the console log is, and where the API reference is — including the absolute path of the bundled `ttcraft.lua` definitions, which is the most precise description of the scripting API an agent can read. The manual is also served as markdown for agents at `/llms.txt` and `/llms-full.txt` on your TTCraft site.

## Limitations

- The table has to be running; the extension does not boot a stopped table.
- Only objects and templates that already carry a script are materialized as files; open a script-less object from the tree to start one.
- Scripts only. Assets, zones, decks, the table's look and everything else live in the app; whole tables move as archives (see the manual's *Table archives* page).
- Object scripts edited in the browser are not pushed to the folder live — use **Refresh**.
- Two VS Code windows mirroring the same folder will both push saves; keep one.

## Development

```bash
npm install
npm run compile       # or: npm run watch
```

Press `F5` to launch an Extension Development Host.
