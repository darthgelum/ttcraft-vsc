<p align="center"><img src="media/logo.png" width="600" alt="TTCraft"></p>

<p align="center"><b>Edit the Lua scripts of your <a href="https://ttcraft.net">TTCraft</a> game tables in VS Code.</b><br>Real files, autocomplete, the table's console next to your code — and a folder your AI coding agent can work in.</p>

<p align="center"><a href="https://ttcraft.net/docs/vscode">Guide</a> · <a href="https://ttcraft.net/docs/scripting">Scripting reference</a> · <a href="https://ttcraft.net/docs/table-archives">Table archives</a> · <a href="https://github.com/darthgelum/ttcraft-vsc/issues">Report an issue</a></p>

## What you get

- 🎲 **Your tables in the sidebar.** Every table you manage, with its Global script, objects and library templates. Spawns and despawns show up live.
- 📄 **Scripts as real files.** A table's scripts are mirrored into a folder on disk, so the Lua language server, search, git and any tool that reads files can work with them.
- 💾 **Save is deploy.** `Ctrl+S` sends the script to the running table and it takes effect for every player at once. A script that does not compile is flagged on the offending line, and the previous version keeps running.
- 🖥️ **The console in the editor.** Everything scripts print, plus compile and runtime errors, arrives in the *TTCraft Table* output channel and in `.ttcraft/console.log`.
- ✨ **Autocomplete for the whole API.** Bundled definitions of `tw`, `self`, players, `JSON`, `Vector`, `Color` and every event callback, wired up for the [Lua](https://marketplace.visualstudio.com/items?itemName=sumneko.lua) extension.
- 🤖 **Made for AI agents.** The folder carries an `AGENTS.md` (and `CLAUDE.md`) that tells Copilot, Claude Code, Codex and friends what the files are, what saving does and where the API reference is.

## Getting started

1. **Install** the extension, and the Lua extension when it offers.
2. **Open a table in TTCraft.** Start it from the room page — the extension edits running tables. You need the *Manage table* permission in that room; owners and moderators have it.
3. **Sign in.** Click the TTCraft icon in the Activity Bar, then **Sign in**. A browser tab opens on ttcraft.net with a short code already filled in; approve it there. No password is typed into the editor, and the link can be revoked at any time from *Settings → Security* on ttcraft.net.
4. **Open a script.** Expand the table and click the Global script, an object or a template. Edit, save, watch the console.

## The table folder

Opening a script mirrors the table into one folder, the *table folder*, and adds it to your workspace:

| Path | What it is |
| --- | --- |
| `global.lua` | The table's Global script |
| `objects/<Name>__<guid>.lua` | One object's script |
| `templates/<Category>/…/<Name>__<id>.lua` | One library template's script, under its category |
| `.ttcraft/console.log` | The table's console, appended live |
| `.ttcraft/table.json` | Which table is here and whether it is connected |
| `AGENTS.md`, `CLAUDE.md` | Orientation for AI agents |
| `.luarc.json` | Wires the Lua language server to the bundled API |

**One folder holds one table.** Open a script on another table and the folder switches: the old table's editors close, its files are removed, and the new table's scripts take their place. Nothing is lost — every save already reached its table. The status bar shows which table is in the folder; click it to switch.

Only objects and templates that already have a script get a file. To start one, click the script-less object or template in the sidebar. Leave file names alone: the `__<id>` suffix is how a file finds its object, and deleting a file changes nothing on the table.

## Working with an AI agent

Point the agent at the table folder, or open VS Code on it. `AGENTS.md` tells it what the folder is, that saving pushes to the live table, where the console log is, and where the API definitions and the manual are. The manual is also served as markdown for agents at [ttcraft.net/llms.txt](https://ttcraft.net/llms.txt) and [ttcraft.net/llms-full.txt](https://ttcraft.net/llms-full.txt).

A loop that works: edit → save → read the tail of `.ttcraft/console.log` → adjust.

## Commands

All under **TTCraft:** in the Command Palette; most are also buttons in the sidebar.

| Command | What it does |
| --- | --- |
| Sign in / Sign out | Link or unlink VS Code and your TTCraft account |
| Open table | Mirror a whole table and open its Global script (button on the table's row) |
| Switch table | Pick another table for the folder (also the status bar item) |
| Close table | Disconnect and empty the folder |
| Refresh tables | Reconnect and re-pull every script |
| Show table console | Open the *TTCraft Table* output channel |

## Settings

| Setting | |
| --- | --- |
| `ttcraft.tableFolder` | Where the table's scripts are mirrored. Empty, the default, uses a folder in the extension's storage. Point it at an empty folder *inside* a project you already have open to keep the table's scripts next to your own files — and to avoid the restart described below. |
| `ttcraft.url` | Only for a development copy of TTCraft. Leave the default. |

## Good to know

- **The first table in a window may flash once.** VS Code restarts extensions when a window gets its first folder, or goes from one folder to several. The extension finishes the open after the restart, and a folder already in the workspace reconnects on its own when the window opens. A `ttcraft.tableFolder` inside an open project avoids this altogether.
- **Object scripts edited in the browser** are not pushed to the folder live. Press **Refresh** after editing the same script in both places. Template edits, spawns and despawns do arrive live.
- **Scripts only.** Objects, decks, zones, assets and the look of the table are made in the table itself; whole tables move as [table archives](https://ttcraft.net/docs/table-archives).
- **One window per folder.** Two VS Code windows on the same table folder would both push saves.

## Documentation

- [Scripting from VS Code](https://ttcraft.net/docs/vscode) — the full guide to this extension, including the sign-in and table protocol for anyone building their own tooling.
- [Table scripting](https://ttcraft.net/docs/scripting) — the model, handlers, the Global script, persistence, sandbox limits, and what is not available.
- Reference: [Events](https://ttcraft.net/docs/scripting-events) · [Objects](https://ttcraft.net/docs/scripting-objects) · [World](https://ttcraft.net/docs/scripting-world) · [Players and turns](https://ttcraft.net/docs/scripting-players) · [Custom UI](https://ttcraft.net/docs/scripting-ui) · [Recipes](https://ttcraft.net/docs/scripting-recipes)
- [Table archives](https://ttcraft.net/docs/table-archives) — how tables are saved, downloaded and loaded, and the archive format.
- [Getting started with TTCraft](https://ttcraft.net/docs/getting-started) — rooms, channels, tables and modules.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| The list is empty | You need *Manage table* in a room you belong to. The practice table is never listed. |
| *The table is not open* | Start the table from the room page, then expand it again. |
| *Your TTCraft session expired* | **Sign in** again. |
| *The table folder … is not empty* | `ttcraft.tableFolder` points at a folder with other files in it; use an empty one. |
| A save does nothing | Check the *TTCraft Table* output: a lost connection shows as *not saved*. **Refresh** reconnects. |

## Development

```bash
npm install
npm run compile   # or npm run watch, then F5 for an Extension Development Host
```

Bug reports and ideas: [github.com/darthgelum/ttcraft-vsc/issues](https://github.com/darthgelum/ttcraft-vsc/issues). MIT licensed.
