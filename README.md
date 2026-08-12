# TTCraft VSC

Edit the Lua scripts on your [TTCraft](https://ttcraft.net) game tables straight from VS Code — a tree of your tables and their scriptable entities, real files on disk your AI agents can read and edit, core-API autocomplete, and the table's script console in the Output panel.

> Status: **early.** The core loop (sign in → open a table → edit and save scripts → watch the console) works. See [Limitations](#limitations).

## How it works

The extension talks to two things:

- **TTCraft** — only to sign in and to list the tables you may manage. Sign-in uses the OAuth Device Authorization Grant (like `gh auth login`): you approve the extension in your browser, no password is ever typed into the editor.
- **The table server** — over its own WebSocket protocol, to read and write scripts and stream the console. The extension is just another client of the same protocol the browser table uses; every action still runs through the server's permission checks.

Opening a table **materializes its scripts as real files on disk** and adds the folder to your workspace:

```
global.lua                         the table-level Global script
objects/<Name>__<guid>.lua         a live object's script
templates/<Category>/…/<Name>__<id>.lua   a library template's script, foldered by its category
.luarc.json                        points the Lua language server at the TTCraft API
```

Display names come from the table's own localization catalog (the same one the
browser uses), so built-in objects and templates read as real names rather than
i18n keys, and templates keep the library's category tree as nested folders.

Real files (rather than a virtual file system) are what let the **Lua language server** and **AI coding agents** (Copilot, Claude, …) see, read and edit the scripts — they work on the filesystem. Saving a file pushes the script to the live table; if it doesn't compile, the save surfaces the error as a diagnostic and the previously running version keeps running, exactly like editing in the browser.

The **Tables** view lists each table's entities:

- **Global script**, **Objects** and **Templates** are scriptable — they open as files.
- **Effects** and other workbench libraries are data-only — they just list.

The tree updates live as objects are spawned or removed on the table and as the library changes, so what you add in the app appears here. The refresh button forces a full resync (reconnect), which also gives objects spawned since you connected their proper names.

> An object's script and the script of the template it was spawned from are **independent** — editing one does not change the other.

## Setup

1. Set **Settings → Extensions → TTCraft → Url** to your site (default `http://localhost:8123`).
2. Open the **TTCraft** view in the Activity Bar and click **Sign in**. Approve the request in the browser tab that opens.
3. Expand a table to browse its objects and templates, then click one to open its script — or use **Open table** to add the whole folder and open `global.lua`.
4. Edit and save (`Ctrl+S`). Script output and errors appear in the **TTCraft Table** output channel (`TTCraft: Show table console`).

Install the **Lua** extension (`sumneko.lua`) when prompted for syntax highlighting and API autocomplete — the extension ships EmmyLua definitions for `tw`, the object and player handles, `JSON`/`Vector`/`Color`, and the event callbacks, and wires them up via a per-folder `.luarc.json`.

The table must already be open in TTCraft (start it from the room). You need the **Manage table** permission in the room for it to appear.

## Limitations

- The table has to be running; the extension does not boot a stopped table.
- Only objects and templates that already carry a script are materialized as files; open a script-less object from the tree to start one.
- Reopening the table refreshes the files from the server — since saves push immediately, there should be no unsynced local edits, but don't keep offline changes.
- Opening a table in an empty window adds the first workspace folder, which makes VS Code restart the extension host once.

## Development

```bash
npm install
npm run compile       # or: npm run watch
```

Press `F5` to launch an Extension Development Host.
