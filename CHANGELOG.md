# Changelog

## 0.2.0

- **One table folder.** The open table is mirrored into a single folder (`ttcraft.tableFolder`, default under the extension's storage) instead of one workspace folder per table. Opening a script on another table switches the folder: the old table's files and editors go away, the new table's come in. Agents working in the folder never see two tables at once.
- **Survives the extension-host restart.** Adding the folder to a window can restart extensions (VS Code does that for an empty window's first folder and for the single-folder → multi-root step). The open that triggered it is finished by the next activation, and a folder that is already in the workspace reconnects on startup. Putting `ttcraft.tableFolder` inside an open workspace folder avoids the restart altogether.
- `AGENTS.md`, `CLAUDE.md` and `.ttcraft/table.json` are written into the folder so an AI agent knows what it is looking at; the table console is also appended to `.ttcraft/console.log`.
- Despawned objects lose their file live; templates edited in the browser update live; **Refresh** re-pulls every script.
- **Switch table** command (status bar item and view toolbar).
- Sign-out and Close no longer remove workspace folders.

## 0.1.0

- Initial version (TTCraft VSC).
- Device-flow sign-in against TTCraft (RFC 8628); dev token stored in SecretStorage.
- Tables tree listing each table's scriptable entities (Global script, objects, templates) and data-only ones (effects).
- Scripts materialized as real files on disk so the Lua language server and AI agents can read and edit them; saves push to the live table, compile errors surface as diagnostics.
- Bundled EmmyLua/LuaLS definitions for the core API (`tw`, object/player handles, `JSON`/`Vector`/`Color`, events), wired via a per-folder `.luarc.json`; recommends the Lua extension when absent.
- Table script console streamed to an output channel.
