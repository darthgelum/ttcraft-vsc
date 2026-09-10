import * as vscode from 'vscode';

// The Lua language server (sumneko/LuaLS). If present, we point its
// `workspace.library` at our bundled API definitions via a per-folder
// .luarc.json so tw.*, the object handle, etc. autocomplete — without touching
// the user's global settings.
const LUA_EXT = 'sumneko.lua';
const RECOMMENDED_KEY = 'ttcraft.luaRecommended';

function hasLua(): boolean {
  return vscode.extensions.getExtension(LUA_EXT) !== undefined;
}

/** Offer to install the Lua extension once, unless it's already there. */
export async function maybeRecommendLua(context: vscode.ExtensionContext): Promise<void> {
  if (hasLua() || context.globalState.get<boolean>(RECOMMENDED_KEY)) {
    return;
  }
  await context.globalState.update(RECOMMENDED_KEY, true);

  const install = 'Install';
  const pick = await vscode.window.showInformationMessage(
    'Install the Lua extension to get syntax highlighting and autocomplete for TTCraft scripts.',
    install,
    'Not now',
  );
  if (pick === install) {
    await vscode.commands.executeCommand('workbench.extensions.installExtension', LUA_EXT);
  }
}

/**
 * Contents of a `.luarc.json` for a materialized table folder: it aims the Lua
 * language server at our shipped definitions and declares the injected globals
 * (`self` and the event callbacks) so they don't read as undefined.
 */
export function luarc(libraryDir: string): string {
  return JSON.stringify(
    {
      'runtime.version': 'Lua 5.4',
      'workspace.library': [libraryDir],
      'diagnostics.globals': ['self', 'tw', 'JSON', 'Vector', 'Color'],
    },
    null,
    2,
  );
}

/** Absolute path to the bundled EmmyLua/LuaLS definitions folder. */
export function libraryDir(context: vscode.ExtensionContext): string {
  return context.asAbsolutePath('resources/library');
}
