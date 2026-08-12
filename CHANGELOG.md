# Changelog

## 0.1.0

- Initial version (TTCraft VSC).
- Device-flow sign-in against TTCraft (RFC 8628); dev token stored in SecretStorage.
- Tables tree listing each table's scriptable entities (Global script, objects, templates) and data-only ones (effects).
- Scripts materialized as real files on disk so the Lua language server and AI agents can read and edit them; saves push to the live table, compile errors surface as diagnostics.
- Bundled EmmyLua/LuaLS definitions for the core API (`tw`, object/player handles, `JSON`/`Vector`/`Color`, events), wired via a per-folder `.luarc.json`; recommends the Lua extension when absent.
- Table script console streamed to an output channel.
