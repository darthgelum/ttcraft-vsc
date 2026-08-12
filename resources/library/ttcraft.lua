---@meta
-- =============================================================================
-- TTCraft table-scripting API — LuaLS / EmmyLua definitions.
--
-- Generated from the authoritative sol2 C++ bindings in the tableweb engine
-- (core/src/script_bindings_*.cpp, script_engine.cpp, script_lua_util.cpp).
-- This file is a type-stub only: every function body is empty and it performs
-- no runtime work. Add it to `Lua.workspace.library` for completion + checking.
--
-- Conventions:
--   * Positions are metres; the table surface is y = 0.
--   * Rotations are Euler DEGREES in YXZ order.
--   * "Vector" returns are plain {x=,y=,z=} tables carrying the Vector metatable.
--   * Pose/scale setters accept (x,y,z) numbers OR a {x=,y=,z=} table; a partial
--     table patches only the components given.
--   * Where a parameter is "an object", a handle, a numeric id, or a guid string
--     are all accepted.
-- =============================================================================


-- =============================================================================
-- Vector — 3D vector helper (defined in the Lua preamble; math is pure Lua).
-- Callable: Vector(x, y, z) or Vector(t). Also Vector.new(...).
-- =============================================================================

---@class Vector
---@field x number
---@field y number
---@field z number
---@operator add(Vector): Vector
---@operator sub(Vector): Vector
---@operator mul(Vector|number): Vector
---@overload fun(x?: number, y?: number, z?: number): Vector
---@overload fun(source: Vector|number[]): Vector
Vector = {}

---Construct a vector from components or from a {x,y,z} / {[1],[2],[3]} table.
---@param x? number|Vector|number[]
---@param y? number
---@param z? number
---@return Vector
function Vector.new(x, y, z) end

---Distance between two vectors (accepts vectors or {x,y,z} tables).
---@param a Vector|table
---@param b Vector|table
---@return number
function Vector.distance(a, b) end

---The vector from a to b (b - a).
---@param a Vector|table
---@param b Vector|table
---@return Vector
function Vector.between(a, b) end

---@param o Vector
---@return Vector
function Vector:add(o) end

---@param o Vector
---@return Vector
function Vector:sub(o) end

---@param s number
---@return Vector
function Vector:scale(s) end

---@param o Vector
---@return number
function Vector:dot(o) end

---@param o Vector
---@return Vector
function Vector:cross(o) end

---@return number
function Vector:sqrMagnitude() end

---@return number
function Vector:magnitude() end

---@param o Vector
---@return number
function Vector:distance(o) end

---@return Vector
function Vector:normalized() end

---Normalize in place and return self.
---@return Vector
function Vector:normalize() end

---Linear interpolation toward o by t (0..1).
---@param o Vector
---@param t number
---@return Vector
function Vector:lerp(o, t) end

---@return Vector
function Vector:copy() end

---Unpack to x, y, z.
---@return number x, number y, number z
function Vector:get() end

---Lowercase alias of Vector.
vector = Vector


-- =============================================================================
-- Color — RGBA colour helper (defined in the Lua preamble). Components 0..1.
-- Callable: Color(r, g, b, a) or Color(t). Also Color.new(...).
-- =============================================================================

---@class Color
---@field r number
---@field g number
---@field b number
---@field a number
---@field Red Color
---@field Green Color
---@field Blue Color
---@field White Color
---@field Black Color
---@field Yellow Color
---@overload fun(r?: number, g?: number, b?: number, a?: number): Color
---@overload fun(source: Color|number[]): Color
Color = {}

---@param r? number|Color|number[]
---@param g? number
---@param b? number
---@param a? number
---@return Color
function Color.new(r, g, b, a) end

---Linear interpolation toward o by t (0..1).
---@param o Color
---@param t number
---@return Color
function Color:lerp(o, t) end

---8-hex-digit RRGGBBAA string (uppercase, no leading '#').
---@return string
function Color:toHex() end

---@return Color
function Color:copy() end


-- =============================================================================
-- Object — an object handle (the sol2 `ScriptHandle` usertype). `self` in an
-- object script and anything returned by tw.getObject / objectBelow / etc.
-- All methods are colon-called (obj:getPosition()).
-- =============================================================================

---@class Object
---@field use_gravity boolean Field alias for get/setUseGravity.
local Object = {}

-- --- identity & metadata ---------------------------------------------------

---Stable numeric id.
---@return integer
function Object:id() end

---String id / alias (defaults to the numeric id).
---@return string
function Object:guid() end

---Set a custom string id (must be unique).
---@param g string
function Object:setGuid(g) end

---Object kind: "die"|"chip"|"coin"|"deck"|"card"|"prop"|"tablet"|"counter"|"clock"|"note" ("" if the object is gone).
---@return string
function Object:kind() end

---@return string
function Object:getName() end
---@param name string
function Object:setName(name) end

---@return string
function Object:getDescription() end
---@param text string
function Object:setDescription(text) end

---@return string
function Object:getGMNotes() end
---@param text string
function Object:setGMNotes(text) end

-- --- per-player visibility --------------------------------------------------

---Hide this object entirely from the given player ids ({} clears).
---@param playerIds integer[]
function Object:setInvisibleTo(playerIds) end
---Show this object as an anonymous silhouette to the given player ids ({} clears).
---@param playerIds integer[]
function Object:setHiddenFrom(playerIds) end
---@return integer[]
function Object:getInvisibleTo() end
---@return integer[]
function Object:getHiddenFrom() end

-- --- transform --------------------------------------------------------------

---World position (alias of getPosition).
---@return Vector
function Object:position() end
---@return Vector
function Object:getPosition() end
---Teleport. Accepts (x,y,z) or a {x=,y=,z=} table (partial patches).
---@param x number|Vector|table
---@param y? number
---@param z? number
function Object:setPosition(x, y, z) end
---Move by a delta.
---@param x number|Vector|table
---@param y? number
---@param z? number
function Object:translate(x, y, z) end

---Server-side eased glide to a target position.
---@param pos Vector|table
---@param collide? boolean
---@param fast? boolean
function Object:setPositionSmooth(pos, collide, fast) end
---Server-side eased rotation to Euler degrees.
---@param rot Vector|table
---@param collide? boolean
---@param fast? boolean
function Object:setRotationSmooth(rot, collide, fast) end
---The active glide's target position, or nil when not gliding.
---@return Vector|nil
function Object:getPositionSmooth() end
---@return boolean
function Object:isSmoothMoving() end

---Euler degrees.
---@return Vector
function Object:getRotation() end
---@param x number|Vector|table
---@param y? number
---@param z? number
function Object:setRotation(x, y, z) end
---Rotate by a delta (Euler degrees).
---@param x number|Vector|table
---@param y? number
---@param z? number
function Object:rotate(x, y, z) end

---@return Vector
function Object:getScale() end
---@param x number|Vector|table
---@param y? number
---@param z? number
function Object:setScale(x, y, z) end

---Axis-aligned bounds: { center = Vector, size = Vector }.
---@return Bounds
function Object:getBounds() end

---Unit forward basis vector of the current rotation.
---@return Vector
function Object:getTransformForward() end
---@return Vector
function Object:getTransformUp() end
---@return Vector
function Object:getTransformRight() end

---Local point -> world (scale, rotation, position applied).
---@param x number|Vector|table
---@param y? number
---@param z? number
---@return Vector
function Object:localToWorld(x, y, z) end
---World point -> local (inverse of localToWorld).
---@param x number|Vector|table
---@param y? number
---@param z? number
---@return Vector
function Object:worldToLocal(x, y, z) end

-- --- physics ----------------------------------------------------------------

---@return Vector
function Object:getVelocity() end
---@param x number|Vector|table
---@param y? number
---@param z? number
function Object:setVelocity(x, y, z) end
---@return Vector
function Object:getAngularVelocity() end
---@param x number|Vector|table
---@param y? number
---@param z? number
function Object:setAngularVelocity(x, y, z) end
---Add to linear velocity (an impulse-style nudge).
---@param x number|Vector|table
---@param y? number
---@param z? number
function Object:addForce(x, y, z) end
---Add to angular velocity.
---@param x number|Vector|table
---@param y? number
---@param z? number
function Object:addTorque(x, y, z) end

---@return boolean
function Object:getUseGravity() end
---@param on boolean
function Object:setUseGravity(on) end

-- --- joints -----------------------------------------------------------------

---Joint this object to another. opts.type = "point"(default)|"fixed"|"hinge"|"distance"/"spring".
---Call with no argument to remove ALL of this object's joints.
---@param other? Object|integer|string
---@param opts? table
function Object:jointTo(other, opts) end
---Remove all of this object's joints.
function Object:removeJoints() end
---@return table joints List of { object = Object, type = string }.
function Object:getJoints() end

-- --- actions & lifecycle ----------------------------------------------------

---Animated turn-over.
function Object:flip() end
---Toss with an upward impulse and spin (works on any object).
function Object:roll() end
---@param on boolean
function Object:setLock(on) end
---@return boolean
function Object:isLocked() end
---Return to the captured home pose (default position/rotation), at rest.
function Object:reset() end
---Duplicate next to it; returns the new handle (nil if gone).
---@return Object|nil
function Object:clone() end
---Respawn in place: a full-fidelity copy (skin/script/guid/tags/vars kept),
---original removed. Returns the new handle (nil if gone).
---@return Object|nil
function Object:reload() end
---Dissolve the rigid group this object is welded into (if any).
function Object:ungroup() end
---Remove from the table (alias of destroy).
function Object:destruct() end
---Remove from the table.
function Object:destroy() end

-- --- home pose & drag behaviour --------------------------------------------

---@return Vector
function Object:getDefaultPosition() end
---@param x number|Vector|table
---@param y? number
---@param z? number
function Object:setDefaultPosition(x, y, z) end
---@return Vector
function Object:getDefaultRotation() end
---@param x number|Vector|table
---@param y? number
---@param z? number
function Object:setDefaultRotation(x, y, z) end
---@return Vector
function Object:getGrabRotation() end
---@param x number|Vector|table
---@param y? number
---@param z? number
function Object:setGrabRotation(x, y, z) end
---@return boolean
function Object:getRotateOnGrab() end
---@param v boolean
function Object:setRotateOnGrab(v) end
---@return boolean
function Object:getUprightOnGrab() end
---@param v boolean
function Object:setUprightOnGrab(v) end
---@return boolean
function Object:getCollideWhileDragging() end
---@param v boolean
function Object:setCollideWhileDragging(v) end
---@return boolean
function Object:getLiftOverObjects() end
---@param v boolean
function Object:setLiftOverObjects(v) end
---Lift height in metres; -1 uses the global default.
---@return number
function Object:getLiftHeight() end
---@param metres number
function Object:setLiftHeight(metres) end
---May the drawing tool draw on this object.
---@return boolean
function Object:getDrawable() end
---@param v boolean
function Object:setDrawable(v) end
---May a hand zone hold this object.
---@return boolean
function Object:getHandable() end
---@param v boolean
function Object:setHandable(v) end

-- --- queries ----------------------------------------------------------------

---Distance in metres to another object; -1 if unresolvable.
---@param other Object|integer|string
---@return number
function Object:distanceTo(other) end
---The object this one rests on, or nil.
---@return Object|nil
function Object:objectBelow() end
---The object resting on this one, or nil.
---@return Object|nil
function Object:objectAbove() end
---Player id holding this object, or nil.
---@return integer|nil
function Object:heldBy() end
---Cards/decks: boolean face-down state; nil for other kinds.
---@return boolean|nil
function Object:isFaceDown() end
---Scripting zones currently containing this object.
---@return Zone[]
function Object:getZones() end

-- --- tags -------------------------------------------------------------------

---@param tag string
function Object:addTag(tag) end
---@param tag string
function Object:removeTag(tag) end
---@param tag string
---@return boolean
function Object:hasTag(tag) end
---@return string[]
function Object:getTags() end
---Replace the whole tag set.
---@param tags string[]
function Object:setTags(tags) end
---@return boolean
function Object:hasAnyTag() end
---True if this and the other object share at least one tag.
---@param other Object
---@return boolean
function Object:hasMatchingTag(other) end

-- --- shared data & cross-script calls --------------------------------------

---Persist a primitive var (number/string/boolean; nil erases). Tables are ignored.
---@param key string
---@param value number|string|boolean|nil
function Object:setVar(key, value) end
---@param key string
---@return number|string|boolean|nil
function Object:getVar(key) end
---Store a whole table by value (nil clears). getTable returns an independent copy.
---@param key string
---@param value table|nil
function Object:setTable(key, value) end
---@param key string
---@return table|nil
function Object:getTable(key) end
---Call a global function in this object's script.
---@param fn string
---@param ... any
---@return any
function Object:call(fn, ...) end
---Register an event handler on this object (see event globals below for names).
---@param event string
---@param fn fun(...):any
function Object:on(event, fn) end

-- --- serialization ----------------------------------------------------------

---Full snapshot as a JSON string (decks include their cards).
---@return string
function Object:getJSON() end
---The snapshot decoded to a Lua table (nil if unavailable).
---@return table|nil
function Object:getData() end

-- --- per-object snap points -------------------------------------------------

---Replace this object's LOCAL snap points. Each entry:
---{ position={x,y,z}, rotation=yawDegrees?, range=metres?, tags={..}? }. nil/{} clears.
---@param points table[]
function Object:setSnapPoints(points) end
---@return table[]
function Object:getSnapPoints() end
function Object:clearSnapPoints() end

-- --- values, counters & clocks ---------------------------------------------

---Polymorphic value: counter number, clock seconds, die top face, coin side
---(1=heads/2=tails), or the nearest rotation-value entry; nil if none.
---@return number|string|boolean|nil
function Object:getValue() end
---Counter/clock: set the number/seconds. Else: turn to the orientation mapped to v.
---@param v number|string|boolean
function Object:setValue(v) end
---Counter: +1.
function Object:increment() end
---Counter: -1.
function Object:decrement() end
---Counter: back to 0. Clock: 0 and stopped.
function Object:clear() end
---Clock: reset to 0, count up, run.
function Object:startStopwatch() end
---Clock: set seconds, count down, run.
---@param seconds integer
function Object:startTimer(seconds) end
---Clock: toggle running.
function Object:pauseStart() end
---@return boolean
function Object:isRunning() end
---@return boolean
function Object:isCountingDown() end

-- --- rotation values --------------------------------------------------------

---Map orientations to values. Each entry: { value = any, rotation = {x,y,z} }. nil/{} clears.
---@param values table[]|nil
function Object:setRotationValues(values) end
---@return table[] values List of { value, rotation = Vector }.
function Object:getRotationValues() end
---Value of the entry nearest the current pose (nil if none).
---@return number|string|boolean|nil
function Object:getRotationValue() end

-- --- appearance -------------------------------------------------------------

---Render tint. Accepts "#rrggbb" or a {r,g,b} table (0..1).
---@param color string|table
function Object:setColorTint(color) end
---Current tint hex, or nil.
---@return string|nil
function Object:getColorTint() end
---Full PBR material patch (only the keys given change): metalness, roughness,
---envMapIntensity, clearcoat, clearcoatRoughness, tint, softTint, emissive,
---emissiveIntensity, transmission, ior, thickness, attenuationColor, attenuationDistance.
---@param opts table
function Object:setMaterial(opts) end
---@return table|nil
function Object:getMaterial() end
---Transient outline. color = "#rrggbb"/{r,g,b}; secs auto-clears (0/absent = until highlightOff).
---@param color string|table
---@param secs? number
function Object:highlightOn(color, secs) end
function Object:highlightOff() end

-- --- particle effects & sound ----------------------------------------------

---Attach a following particle effect (preset name); returns the effect id.
---@param preset string
---@param opts? table
---@return integer
function Object:createEffect(preset, opts) end
---Stop every effect attached to this object.
function Object:clearEffects() end
---One-shot sound positioned at this object. opts: { volume, rate, loop }.
---@param asset string
---@param opts? table
function Object:playSound(asset, opts) end

-- --- containers, decks & cards ---------------------------------------------

---Entry count (alias getQuantity).
---@return integer
function Object:count() end
---@return integer
function Object:getQuantity() end
---Container contents. Deck: { {index,code,name}, ... }; bag: { {index,name,kind,guid}, ... }.
---@return table[]
function Object:getObjects() end
---@param on boolean
function Object:setInfinite(on) end
---@return boolean
function Object:isInfinite() end
---@param on boolean
function Object:setRandomOrder(on) end
---@return boolean
function Object:isRandomOrder() end
---Deck: shuffle. Bag: shuffle entries.
function Object:shuffle() end
---Deck: shuffle. Bag: shuffle entries. Else: physical toss.
function Object:randomize() end
---Open a private deck search window for a player; fn(index, code) or fn(nil) on cancel.
---@param player Player|integer
---@param fn fun(index: integer|nil, code: integer|nil)
function Object:search(player, fn) end
---Deck: merge stacks (returns the surviving stack). Bag: swallow the object (returns the bag).
---@param other Object
---@return Object|nil
function Object:putObject(other) end
---Take one entry out. Options: { index=N (0-based), name="..", top=false, flip=true,
---position={}, rotation={}, smooth=true, callback=fun(o) }. Returns the taken handle.
---@param opts? table
---@return Object|nil
function Object:takeObject(opts) end
---Deal n cards onto the table (n default 1), optionally into a player's grip.
---@param n? integer
---@param player? integer
function Object:deal(n, player) end
---Draw n cards (default 1) concealed into a player's hand.
---@param player integer
---@param n? integer
function Object:dealToHand(player, n) end
---Deal the top card at the player's seat + offset (face up if flip). Returns the handle.
---@param offset Vector|table
---@param flip boolean
---@param player integer
---@return Object|nil
function Object:dealToColorWithOffset(offset, flip, player) end
---Cut n cards off the top; returns the new handles.
---@param n integer
---@return Object[]
function Object:cut(n) end
---Split the deck into n piles; returns the new handles.
---@param n integer
---@return Object[]
function Object:split(n) end
---Gather the touching pile into one face-down deck; returns the new deck (nil if none).
---@return Object|nil
function Object:group() end

-- --- multistate -------------------------------------------------------------

---Active state (1-based; 0 = none).
---@return integer
function Object:getStateId() end
---@return table[] states List of { id, label }.
function Object:getStates() end
---@param n integer
function Object:setState(n) end
---Switch to a random state.
function Object:shuffleStates() end
---Define the states (list of { label, tint, ... }).
---@param states table[]
function Object:setStates(states) end

-- --- per-object menu items & hotkeys ---------------------------------------

---Add a right-click menu entry. (label, fn) or a table { label, onClick, icon,
---category, toggle, checked, keepOpen, command }.
---@param labelOrOpts string|table
---@param fn? string
function Object:addContextMenuItem(labelOrOpts, fn) end
function Object:clearContextMenu() end
---Object-scoped hotkey: fires only while THIS object is hovered/focused. fn(player) runs here.
---@param key string
---@param fn string
---@param label? string
function Object:addHotkey(key, fn, label) end
function Object:clearHotkeys() end

-- --- tablet (scriptable board) elements ------------------------------------

---@param elementId string
---@param text any
function Object:setElementText(elementId, text) end
---@param elementId string
---@param value number
function Object:setElementValue(elementId, value) end
---@param elementId string
---@return number|nil
function Object:getElementValue(elementId) end
---@param elementId string
---@param tooltip any
function Object:setElementTooltip(elementId, tooltip) end
---@param elementId string
---@return string|nil
function Object:getElementTooltip(elementId) end
---@param elementId string
---@param entries string[]
function Object:setListEntries(elementId, entries) end
---@param elementId string
---@param entry any
function Object:addListEntry(elementId, entry) end
---@param elementId string
function Object:clearListEntries(elementId) end
---@param elementId string
---@return string[]
function Object:getListEntries(elementId) end


-- =============================================================================
-- Player — a player handle (the sol2 `PlayerHandle` usertype). Obtain via
-- tw.getPlayer(id). All methods are colon-called.
-- =============================================================================

---@class Player
local Player = {}

---Numeric player id.
---@return integer
function Player:id() end
---Seat colour name ("black" = GM).
---@return string
function Player:getColor() end
---@return string
function Player:getName() end
---Seat index.
---@return integer
function Player:getSeat() end
---True for a table manager (Owner/Admin).
---@return boolean
function Player:isHost() end
---List of capability names.
---@return string[]
function Player:getCaps() end
---Capability check: "play" | "edit" | "admin" | "owner" (implications applied).
---@param cap string
---@return boolean
function Player:can(cap) end
---Move the player to another seat colour; false if taken.
---@param color string
---@return boolean
function Player:changeColor(color) end

-- --- presence ---------------------------------------------------------------

---Cursor position on the table (Vector), or nil if off-table.
---@return Vector|nil
function Player:getPointerPosition() end
---The seat's facing yaw, degrees.
---@return number
function Player:getPointerRotation() end
---The object under their cursor, or nil.
---@return Object|nil
function Player:getHoverObject() end
---Handles the player has selected.
---@return Object[]
function Player:getSelectedObjects() end
---Handles the player is currently dragging.
---@return Object[]
function Player:getHoldingObjects() end
---Cards in this player's hand.
---@return integer
function Player:getHandCount() end
---Handles of the cards in their hand.
---@return Object[]
function Player:getHandObjects() end
---Their seat's dealing anchor (Vector).
---@return Vector
function Player:getHandPosition() end
---{ position, rotation, forward, right, up } — all Vectors.
---@return HandTransform
function Player:getHandTransform() end

-- --- messages & dialogs -----------------------------------------------------

---Console line to this player (alias broadcast).
---@param msg string
function Player:print(msg) end
---@param msg string
function Player:broadcast(msg) end
---@param text string
function Player:showInfoDialog(text) end
---OK/Cancel dialog; fn(ok).
---@param text string
---@param fn fun(ok: boolean)
function Player:showConfirmDialog(text, fn) end
---Text input; fn(ok, value).
---@param text string
---@param default? string
---@param fn fun(ok: boolean, value: string)
function Player:showInputDialog(text, default, fn) end
---Dropdown of options (1-based array); default is a 1-based index; fn(ok, choice-text).
---@param text string
---@param options string[]
---@param default? integer
---@param fn fun(ok: boolean, choice: string)
function Player:showOptionsDialog(text, options, default, fn) end
---Colour swatch picker (optional colour-name list; defaults to the seat palette); fn(ok, colorName).
---@param colors? string[]
---@param fn fun(ok: boolean, colorName: string)
function Player:showColorDialog(colors, fn) end
---Multi-line memo; fn(ok, text).
---@param text string
---@param default? string
---@param fn fun(ok: boolean, text: string)
function Player:showMemoDialog(text, default, fn) end
---Private pick from the player's own hand; fn(card) with the chosen card (fn(nil) on cancel).
---@param fn fun(card: Object|nil)
function Player:chooseInHand(fn) end

-- --- camera & pings ---------------------------------------------------------

---Move this player's camera. params: { position, pitch, yaw, distance }.
---@param params table
function Player:lookAt(params) end
---A brief ping ring. Accepts (x,y,z) or a Vector.
---@param x number|Vector|table
---@param y? number
---@param z? number
function Player:ping(x, y, z) end
---"top"/"topdown"/"overhead" | "front" | "side" | "default"/"free".
---@param mode string
function Player:setCameraMode(mode) end
---@return string
function Player:getCameraMode() end
---The camera modes setCameraMode accepts.
---@return string[]
function Player:getCameraModes() end
---Attach the camera to an object it follows. params: { object, pitch, yaw, distance }.
---@param params table
function Player:attachCameraToObject(params) end
function Player:detachCameraFromObject() end

-- --- tools ------------------------------------------------------------------

---Drive the player's active tool. toolId: "draw"/"zone"/"snap"/"measure"/
---"gizmoMove"/"gizmoRotate"/"gizmoScale"/"marker", or nil/"" for the pointer.
---@param toolId string|nil
---@param opts? table
function Player:setTool(toolId, opts) end
---The tool ids setTool accepts.
---@return string[]
function Player:getToolIds() end
---Tweak the current tool's options without switching tools.
---@param opts table
function Player:setToolOptions(opts) end

-- --- moderation -------------------------------------------------------------

---Disconnect this player from the table.
function Player:kick() end
---Freeze/unfreeze this player's game actions (default true).
---@param on? boolean
function Player:mute(on) end
---@return boolean
function Player:getMuted() end
---Black out / restore this player's view (default true).
---@param on? boolean
function Player:setBlindfolded(on) end
---@return boolean
function Player:getBlindfolded() end
---Raise to a table manager.
function Player:promote() end
---Drop from table manager.
function Player:demote() end


-- =============================================================================
-- Zone — a scripting-zone handle (the sol2 `ZoneHandle` usertype). Created via
-- tw.createZone. Zone events fire on the script that created it.
-- =============================================================================

---@class Zone
local Zone = {}

---@return integer
function Zone:id() end
---@return Vector
function Zone:getPosition() end
---@param x number|Vector|table
---@param y? number
---@param z? number
function Zone:setPosition(x, y, z) end
---Full box size.
---@return Vector
function Zone:getScale() end
---@param x number|Vector|table
---@param y? number
---@param z? number
function Zone:setScale(x, y, z) end
---Yaw about +Y, degrees.
---@return number
function Zone:getRotation() end
---@param degrees number
function Zone:setRotation(degrees) end
---Objects currently inside the zone.
---@return Object[]
function Zone:getObjects() end
---Make this a hidden zone: contents hidden from everyone but `owner`.
---mode "invisible"(default/true) hides; "hidden"/"masked" = grey silhouette; false/0 off.
---@param owner integer
---@param mode? boolean|string
function Zone:setHidden(owner, mode) end
---Force a re-layout now (LayoutZone).
function Zone:layout() end
---LayoutZone options as a table (spacing, perRow, direction, alternate, facing,
---hspread, vspread, combine, maxPerGroup, sort, layout).
---@return table
function Zone:getOptions() end
---@param options table
function Zone:setOptions(options) end
---Remove this zone.
function Zone:destroy() end


-- =============================================================================
-- Panel — the handle returned by tw.createPanel (a free-floating on-screen panel).
-- =============================================================================

---@class Panel
---@field id string
local Panel = {}

---Drive a control's value by element id.
---@param elementId string
---@param value any
function Panel:setValue(elementId, value) end
---@param title string
function Panel:setTitle(title) end
function Panel:close() end


-- =============================================================================
-- Structured result shapes (plain tables carrying the fields below).
-- =============================================================================

---@class Bounds
---@field center Vector
---@field size Vector

---@class RaycastHit
---@field object Object
---@field point Vector
---@field distance number

---@class HandTransform
---@field position Vector
---@field rotation Vector
---@field forward Vector
---@field right Vector
---@field up Vector


-- =============================================================================
-- tw — the global world table: object queries, spawning, grouping/clipboard,
-- zones, snap points, raycasts, UI, kv store, effects/sound, logging.
-- =============================================================================

tw = {}

-- --- object queries ---------------------------------------------------------

---Object by numeric id (nil if gone).
---@param id integer
---@return Object|nil
function tw.getObject(id) end
---Object by guid / string alias (nil if none).
---@param guid string
---@return Object|nil
function tw.getObjectFromGUID(guid) end
---All objects on the table.
---@return Object[]
function tw.getObjects() end
---Objects carrying the given tag.
---@param tag string
---@return Object[]
function tw.getObjectsWithTag(tag) end
---Objects carrying at least one of the given tags.
---@param tags string[]
---@return Object[]
function tw.getObjectsWithAnyTags(tags) end
---Objects carrying all of the given tags.
---@param tags string[]
---@return Object[]
function tw.getObjectsWithAllTags(tags) end

-- --- colours & spawn catalogues --------------------------------------------

---Seat-colour name -> { r, g, b } in 0..1 (unknown name -> grey).
---@param name string
---@return table
function tw.stringColorToRGB(name) end
---The seat-colour names stringColorToRGB / player:changeColor accept.
---@return string[]
function tw.getColorNames() end
---The `type` values tw.spawnObject accepts.
---@return string[]
function tw.getSpawnTypes() end

-- --- spawning ---------------------------------------------------------------

---Spawn a built-in object. params: { type="die", position={x,y,z}, code=0, faceUp=false }.
---@param params table
---@return Object|nil
function tw.spawnObject(params) end
---Spawn from a native snapshot. params: { json="..", position? }.
---@param params table
---@return Object|nil
function tw.spawnObjectJSON(params) end
---Spawn from a snapshot table. params: { data={..}, position? }.
---@param params table
---@return Object|nil
function tw.spawnObjectData(params) end
---Spawn a library template by id or gallery name. (name, {position=}) or ({template=, position=}).
---@param nameOrParams string|table
---@param opts? table
---@return Object|nil
function tw.spawnTemplate(nameOrParams, opts) end
---The library catalogue: { {id, name, category, kind}, ... } rows.
---@return table[]
function tw.getTemplates() end
---Spawn a scriptable board and seed its UI document. params: { position, document }.
---@param params table
---@return Object|nil
function tw.spawnTablet(params) end
---Remove an object (handle, id or guid).
---@param object Object|integer|string
function tw.destroyObject(object) end

-- --- grouping & clipboard ---------------------------------------------------

---Weld a list of objects into one rigid assembly; returns the new group id (0 = none).
---@param objects (Object|integer|string)[]
---@return integer
function tw.group(objects) end
---Dissolve the group any member belongs to.
---@param object Object|integer|string
function tw.ungroup(object) end
---Snapshot a set of objects to the clipboard (with offsets from the centroid).
---@param objects (Object|integer|string)[]
function tw.copy(objects) end
---Spawn a fresh copy of each clipboard entry at `position` + its offset. params: { position }.
---@param params? table
---@return Object[]
function tw.paste(params) end
---Distance in metres between two objects; -1 if unresolvable.
---@param a Object|integer|string
---@param b Object|integer|string
---@return number
function tw.distance(a, b) end

-- --- players ----------------------------------------------------------------

---Connected player ids.
---@return integer[]
function tw.getPlayers() end
---Seated player ids (same as getPlayers).
---@return integer[]
function tw.getSeatedPlayers() end
---Player handle for an id (nil if absent).
---@param id integer
---@return Player|nil
function tw.getPlayer(id) end

-- --- zones ------------------------------------------------------------------

---Create a scripting zone owned by this script. params: { position, scale (full box),
---tags?, layout?, owner?, hidden? }.
---@param params table
---@return Zone|nil
function tw.createZone(params) end

-- --- global snap points -----------------------------------------------------

---Replace the table's script snap points (editor snaps are kept). Each entry:
---{ position={x,y,z}, rotation=yawDegrees?, tags={..}?, range=metres? }.
---@param points table[]
function tw.setSnapPoints(points) end
function tw.clearSnapPoints() end
---@return table[]
function tw.getSnapPoints() end

-- --- raycasts ---------------------------------------------------------------

---Cast into the world. params: { shape="ray"|"sphere"|"box", origin, direction,
---size, maxDistance }. Returns hits { object, point, distance } sorted near->far.
---@param params table
---@return RaycastHit[]
function tw.cast(params) end

-- --- ribbon (client ribbon tabs/items) -------------------------------------

tw.ribbon = {}
---Add a ribbon tab of control groups. groups: { { group="Title", items={..} }, ... }.
---@param title string
---@param groups table[]
function tw.ribbon.addTab(title, groups) end
---Add a single item into an existing tab/group.
---@param tabId string
---@param group string
---@param item table
function tw.ribbon.addItem(tabId, group, item) end
---Clear this script's ribbon contributions.
function tw.ribbon.clear() end
---Drive a ribbon control's value by element id.
---@param elementId string
---@param value any
function tw.ribbon.setValue(elementId, value) end

-- --- corner UI panel (tw.setUI) --------------------------------------------

---Declarative on-screen panel. elements: list of control/text tables (button,
---toggle, slider, select, color, input, image, progress, text).
---@param elements table[]
function tw.setUI(elements) end
---Drive a setUI element by id (toggle on / slider|input|progress value / text label).
---@param elementId string
---@param value boolean|number|string
function tw.setUIValue(elementId, value) end
---Clear this script's corner UI.
function tw.clearUI() end

-- --- floating panels --------------------------------------------------------

---Create a free-floating panel. opts: { id, anchor, x, y, layout, title, elements }.
---Returns a Panel handle (:setValue/:setTitle/:close).
---@param opts table
---@return Panel
function tw.createPanel(opts) end
---Drive a panel control's value by id.
---@param panelId string
---@param elementId string
---@param value any
function tw.setPanelValue(panelId, elementId, value) end
---@param panelId string
function tw.closePanel(panelId) end

-- --- UI suppression ---------------------------------------------------------

---Suppress a base/native or script UI item by key (e.g. "tool:draw", "spawn:die", "toss").
---@param elementId string
function tw.hideUI(elementId) end
---Restore a previously hidden UI item.
---@param elementId string
function tw.showUI(elementId) end

-- --- hotkeys & table context menu ------------------------------------------

---Bind a keyboard key to a script callback function (by name). fn(player).
---@param key string
---@param fn string
---@param label? string
function tw.addHotkey(key, fn, label) end
function tw.clearHotkeys() end
---Add a table (empty-space right-click) menu item. (label, fn) or a table
---{ label, onClick, icon, category, toggle, checked, keepOpen, command }.
---@param labelOrOpts string|table
---@param fn? string
function tw.addContextMenuItem(labelOrOpts, fn) end
function tw.clearContextMenu() end

-- --- lighting shortcut ------------------------------------------------------

---Deep-merge a partial lighting config (see the Lighting table).
---@param config table
function tw.setLighting(config) end

-- --- messaging & logging ----------------------------------------------------

---Broadcast an info message to everyone.
---@param msg string
function tw.broadcastToAll(msg) end
---@param msg string
function tw.printToAll(msg) end
---Info message to one player.
---@param msg string
---@param player integer
function tw.printToColor(msg, player) end
---@param msg string
---@param player integer
function tw.broadcastToColor(msg, player) end
---Log a line to this script's console.
---@param ... any
function tw.log(...) end
---Log an error line to this script's console.
---@param ... any
function tw.logError(...) end

-- --- effects & sound --------------------------------------------------------

---One-shot world-space particle effect. opts: { preset, position, ... }. Returns the effect id.
---@param opts table
---@return integer
function tw.effect(opts) end
---Stop a specific effect by id.
---@param effectId integer
function tw.stopEffect(effectId) end
---The FX preset names tw.effect / obj:createEffect accept.
---@return string[]
function tw.getEffectPresets() end
---One-shot sound for everyone. opts: { asset, position?, objId?, volume?, rate?, loop? }.
---@param opts table
function tw.playSound(opts) end
---The table's uploaded audio: { {name, url, folder}, ... } rows.
---@return table[]
function tw.getSounds() end

-- --- persistent key-value & shared table store -----------------------------

---Persist a JSON-serialisable value under a key (bridged to the server db).
---@param key string
---@param value any
function tw.store(key, value) end
---Read a persisted value (nil if absent).
---@param key string
---@return any
function tw.get(key) end
---Delete a persisted key.
---@param key string
function tw.del(key) end
---Store a whole table shared across all scripts (nil clears).
---@param key string
---@param value table|nil
function tw.setTable(key, value) end
---Read a shared table (an independent copy; nil if absent).
---@param key string
---@return table|nil
function tw.getTable(key) end


-- =============================================================================
-- Turns — the turn-order system.
-- =============================================================================

Turns = {}
---@param on boolean
function Turns.enable(on) end
---@return boolean
function Turns.isEnabled() end
---Whose turn it is (player id; 0 = none).
---@return integer
function Turns.current() end
---@return integer[]
function Turns.order() end
---@param order integer[]
function Turns.setOrder(order) end
---Advance the turn (alias next).
function Turns.endTurn() end
function Turns.next() end
function Turns.previous() end
---Peek the next player id without moving.
---@return integer
function Turns.getNext() end
---Peek the previous player id without moving.
---@return integer
function Turns.getPrevious() end
---Advance, but only while passing is enabled.
function Turns.pass() end
---@param v boolean
function Turns.setReverse(v) end
---@return boolean
function Turns.getReverse() end
---@param v boolean
function Turns.setSkipEmpty(v) end
---@return boolean
function Turns.getSkipEmpty() end
---@param v boolean
function Turns.setDisableInteractions(v) end
---@return boolean
function Turns.getDisableInteractions() end
---@param v boolean
function Turns.setPassEnabled(v) end
---@return boolean
function Turns.getPassEnabled() end


-- =============================================================================
-- Grid — the table grid config.
-- =============================================================================

Grid = {}
---Patch the grid. o: { type, size, spacing, color, visible, snap } (only given keys change).
---@param o table
function Grid.set(o) end
---@param type string "rect" | "hex"
function Grid.setType(type) end
---@param on boolean
function Grid.setSnapping(on) end
---@param visible boolean
function Grid.setVisible(visible) end
---@return table
function Grid.get() end
---The `type` values Grid.setType accepts.
---@return string[]
function Grid.getTypes() end


-- =============================================================================
-- Hands — the hand-zone config.
-- =============================================================================

Hands = {}
---Patch hands. o: { enabled, hiding }.
---@param o table
function Hands.set(o) end
---@param enabled boolean
function Hands.setEnabled(enabled) end
---@param mode string "default" | "reverse" | "disable"
function Hands.setHiding(mode) end
---@return string
function Hands.getHiding() end
---@return boolean
function Hands.isEnabled() end
---The `hiding` values Hands.setHiding accepts.
---@return string[]
function Hands.getHidingModes() end


-- =============================================================================
-- Lighting — the table lighting (partial configs are deep-merged, server-authoritative).
-- =============================================================================

Lighting = {}
---Patch lighting. o may contain sun{intensity,color,azimuth,elevation},
---ambient{intensity,color}, hemisphere{sky,ground,intensity}, env, exposure.
---@param o table
function Lighting.set(o) end
---@param value number
function Lighting.setExposure(value) end
---@param preset string "studio" | "soft" | "night"
function Lighting.setEnv(preset) end
---@param sun table
function Lighting.setSun(sun) end
---@return table
function Lighting.get() end
---The env presets Lighting.setEnv accepts.
---@return string[]
function Lighting.getEnvPresets() end


-- =============================================================================
-- Music — shared, synchronised background music/ambience.
-- =============================================================================

Music = {}
---Set/start the main track. opts: { asset, loop?, volume?, rate?, offsetMs? }.
---@param opts table
function Music.play(opts) end
---Resume. scope: default = music only, "all", or "layers".
---@param scope? string
function Music.resume(scope) end
---Pause. scope: default = music only, "all", or "layers".
---@param scope? string
function Music.pause(scope) end
function Music.stop() end
---@param ms number
function Music.seek(ms) end
---@param volume number
function Music.setVolume(volume) end
---@param rate number
function Music.setRate(rate) end
---Play a layered sound over the main channel. opts: { asset, loop?, gain?, duck? }.
---@param opts table
function Music.layer(opts) end
---@param id string
function Music.stopLayer(id) end
function Music.stopLayers() end
---Update a layer. opts: { id, gain?, playing?, loop?, duck? }.
---@param opts table
function Music.setLayer(opts) end
---@param amount number
function Music.setDuck(amount) end
---The saved playlists: { {id, name, tracks}, ... } rows.
---@return table[]
function Music.getPlaylists() end


-- =============================================================================
-- Wait — timers and deferred callbacks. Each returns a timer id.
-- =============================================================================

Wait = {}
---Call fn after `seconds`, repeated `reps` times (default 1). Returns a timer id.
---@param fn fun()
---@param seconds number
---@param reps? integer
---@return integer
function Wait.time(fn, seconds, reps) end
---Call fn after `frames` frames (default 1). Returns a timer id.
---@param fn fun()
---@param frames? integer
---@return integer
function Wait.frames(fn, frames) end
---Call fn once `cond` returns truthy. Optional timeout (s) + onTimeout callback. Returns a timer id.
---@param fn fun()
---@param cond fun():boolean
---@param timeout? number
---@param onTimeout? fun()
---@return integer
function Wait.condition(fn, cond, timeout, onTimeout) end
---Cancel a timer by id.
---@param timerId integer
function Wait.stop(timerId) end
---Cancel all of this script's timers.
function Wait.stopAll() end


-- =============================================================================
-- JSON — encode/decode between Lua values and JSON strings.
-- =============================================================================

JSON = {}
---Encode a Lua value to a JSON string ("null" on failure).
---@param value any
---@return string
function JSON.encode(value) end
---Decode a JSON string to a Lua value (nil if invalid).
---@param s string
---@return any
function JSON.decode(s) end


-- =============================================================================
-- Globals
-- =============================================================================

---The object this script is attached to (nil in the Global and System scripts).
---@type Object
self = nil

---Log values to this script's console (sandboxed alias of Lua's print).
---@param ... any
function print(...) end


-- =============================================================================
-- Event callbacks — define these globals to handle events. `player` is a
-- numeric id (0 = the server). Object events fire on the object's script;
-- Global-script events fire on the Global script (which has no `self`).
-- Veto hooks (try*) run BEFORE the action; return false to cancel it.
-- =============================================================================

-- --- object lifecycle & pose ------------------------------------------------

---Every server frame (~60 Hz); dt in seconds.
---@param dt number
function onUpdate(dt) end
---Immediately after onUpdate, same cadence.
---@param dt number
function onFixedUpdate(dt) end
---Object: the script (re)compiles (`saved`=""), or restores (`saved`=last onSave string)
---if onSave is defined. Global: fires with no argument at (re)compile and server start.
---@param saved string
function onLoad(saved) end
---State capture: return a string to persist; fires on every snapshot/save/export.
---@return string
function onSave() end
---A tap — press and release without dragging.
---@param player integer
function onClick(player) end
---The object is grabbed (alias onPickUp); fires per carried stack/group member.
---@param player integer
function onDrag(player) end
---The object is released (after drop-snapping and hand capture).
---@param player integer
function onDrop(player) end
---The object is flipped over.
---@param player integer
function onFlip(player) end
---Rotated or aligned.
---@param player integer
function onRotate(player) end
---Position/rotation/scale set via the gizmo.
---@param player integer
function onSetpose(player) end
---The object is flicked / thrown (alias onObjectFlick).
---@param player integer
function onFlick(player) end
---A player's cursor comes to rest over the object (alias onObjectHover).
---@param player integer
function onHover(player) end
---A player peeks at the object (Alt-hover a card; alias onObjectPeek).
---@param player integer
function onPeek(player) end
---A player types a number while hovering the object (alias onObjectNumberTyped).
---@param player integer
---@param number integer
---@param alt boolean
function onNumberTyped(player, number, alt) end
---This object was spawned by a player (not fired for paste/container-take/script spawn).
---@param player integer
function onSpawn(player) end
---The object is deleted by a player (not by script destroy(), container puts, or rollback).
---@param player integer
function onDestroy(player) end
---@param player integer
function onLock(player) end
---@param player integer
function onUnlock(player) end
---Welded into a rigid group (fires on every member).
---@param player integer
function onGroup(player) end
---Released from a rigid group (fires on every member).
---@param player integer
function onUngroup(player) end
---This note's text was edited.
---@param player integer
function onNoteEdit(player) end
---The object is tossed (R key) — any kind, not just dice.
---@param player integer
function onRandomize(player) end
---A player switches the multistate (script setState does not re-fire it).
---@param oldId integer
function onStateChange(oldId) end
---This object's number moved. `value` = new number, `delta` = signed change.
---@param value number
---@param delta number
---@param player integer
function onCounterChange(value, delta, player) end

-- --- collisions -------------------------------------------------------------

---Another object starts overlapping (AABB, per-frame, only when a handler exists).
---@param other Object
function onCollisionEnter(other) end
---Keeps overlapping, each frame.
---@param other Object
function onCollisionStay(other) end
---Stops overlapping.
---@param other Object
function onCollisionExit(other) end

-- --- deck / card / container ------------------------------------------------

---The deck/container is shuffled (including zone-randomize).
---@param player integer
function onShuffle(player) end
---A card is drawn or revealed from the deck (`card` = the new card).
---@param card Object
---@param player integer
function onDraw(card, player) end
---Another stack was merged onto this (the surviving) stack.
---@param player integer
function onMerge(player) end
---This card enters a player's hand (`player` = the hand's owner).
---@param player integer
function onEnterHand(player) end
---This card is played out of the hand with the un-hand action.
---@param player integer
function onLeaveHand(player) end
---`obj` was put or merged into this container/deck.
---@param obj Object
---@param player integer
function onObjectEnterContainer(obj, player) end
---`obj` was taken, drawn or tipped out of this container/deck.
---@param obj Object
---@param player integer
function onObjectLeaveContainer(obj, player) end

-- --- zones (fire on the script that created the zone) -----------------------

---An object's centre enters the zone.
---@param zone Zone
---@param obj Object
function onObjectEnterZone(zone, obj) end
---An object leaves the zone.
---@param zone Zone
---@param obj Object
function onObjectLeaveZone(zone, obj) end
---A layout zone with sort="custom" asks you to reorder; return the reordered list.
---@param zone Zone
---@param objects Object[]
---@return Object[]
function onGroupSort(zone, objects) end

-- --- Global-script events ---------------------------------------------------

---A player joins (after their state sync).
---@param player integer
function onPlayerConnect(player) end
---A player leaves (still in the roster when it fires).
---@param player integer
function onPlayerDisconnect(player) end
---A player's seat colour changed.
---@param player integer
function onPlayerChangeColor(player) end
---A player's capabilities changed.
---@param player integer
function onPlayerChangeCaps(player) end
---The turn moved (`previous` is 0 for the first turn).
---@param current integer
---@param previous integer
function onPlayerTurn(current, previous) end

-- --- veto hooks (return false to cancel) ------------------------------------

---Cancel picking the object up (asked per carried stack/group member).
---@param player integer
---@return boolean|nil
function tryGrab(player) end
---Cancel flipping it.
---@param player integer
---@return boolean|nil
function tryFlip(player) end
---Cancel flicking it.
---@param player integer
---@return boolean|nil
function tryFlick(player) end
---Cancel rotating / aligning it.
---@param player integer
---@return boolean|nil
function tryRotate(player) end
---Cancel setting pose/scale via the gizmo.
---@param player integer
---@return boolean|nil
function trySetpose(player) end
---Cancel drawing/revealing/pulling/taking from this deck/container.
---@param player integer
---@return boolean|nil
function tryDraw(player) end
---Cancel taking this card into a hand (`player` = the prospective owner).
---@param player integer
---@return boolean|nil
function tryEnterHand(player) end
---Cancel merging `other` onto this stack (fires on the target).
---@param other Object
---@param player integer
---@return boolean|nil
function tryMerge(other, player) end
---Cancel putting `other` into this container (fires on the container).
---@param other Object
---@param player integer
---@return boolean|nil
function tryEnterContainer(other, player) end
---Cancel a player deleting the object (script destroy() and rollback bypass it).
---@param player integer
---@return boolean|nil
function tryRemove(player) end
---Cancel a player switching the multistate.
---@param player integer
---@return boolean|nil
function tryStateChange(player) end
---Global: cancel a player spawning objects. params = { kind, dieType, template, x, y, z }.
---@param params table
---@param player integer
---@return boolean|nil
function trySpawn(params, player) end
---Global: runs before ANY capability-gated player action. `action` = command name;
---`target` = the object handle or nil. Return false to cancel.
---@param player integer
---@param action string
---@param target Object|nil
---@return boolean|nil
function onPlayerAction(player, action, target) end
