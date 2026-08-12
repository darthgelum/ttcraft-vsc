// Wire shapes shared across the extension. The TTCraft dev API is documented in
// its routes/dev.php + routes/devices.php; the table WS protocol in tableweb's
// server/commands_scripting.cpp and server/commands.cpp (hello/props).

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface DeviceTokenResponse {
  access_token: string;
  token_type: string;
  name: string;
  user: { id: number; username: string };
}

export interface DevTable {
  id: number;
  channel: { id: number; name: string; slug: string };
  room: { name: string; slug: string };
  status: string;
  running: boolean;
  last_activity_at: string | null;
}

export interface ConnectResponse {
  table_id: number;
  token: string;
  caps: string;
  ws_url: string;
  http_url: string;
  expires_in: number;
}

/** One scripted-capable object on the table, keyed for the virtual file system. */
export interface TableObject {
  /** Runtime id — the wire id for getscript/setscript. Changes across reconnects. */
  runtimeId: number;
  /** Stable identity — scripts persist by guid, so files are named after it. */
  guid: string;
  name: string;
  kind: string;
}

/**
 * A library/workbench template. Its Lua script lives inline (`script`); saving
 * it back goes through `libsave` as a whole-item replace, so the full object is
 * carried verbatim and only `script` is swapped.
 */
export interface TemplateItem {
  id: string;
  name?: string;
  category?: string;
  kind?: string;
  script?: string;
  [key: string]: unknown;
}

/** A custom effect — data only (an opaque client spec), listed but not scriptable. */
export interface EffectItem {
  id: string;
  name?: string;
  category?: string;
  deleted?: boolean;
}
