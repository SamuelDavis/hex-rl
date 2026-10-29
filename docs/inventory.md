# Inventory and Equipment

Research snapshot at `c7f5a85` (feat: remappable controls). Sources: [Sources](#sources).

## Models

- Kind vs instance: a kind is a static table row (`MONSTERS`, `SPELLS`, `src/game/spells.ts:21`); an instance carries identity and mutable state (`Monster`, `src/game/game.ts:66`). NetHack's object-type table is the same split (`objects.c` macros define kinds). [NetHack-objects.c]
- Appearance vs name: a kind has a true name and an appearance string; unidentified instances show the appearance. NetHack: `HELM("helmet", "plumed helmet", ...)`, `GLOVES("leather gloves", "old gloves", ...)`. [NetHack-objects.c]
- Stacking: Angband caps stacks per base: `default:max-stack:40`; potion base `# max-stack:20` is commented out and falls back to default. DCSS stacking not read. [Angband-object_base.txt]
- Table-driven kinds with weighted allocation: Angband `alloc:commonness:min to max` gives weight and depth range per kind. Commonness is a relative weight, not a rarity. [Angband-object.txt header]
- Class weights: NetHack picks a class by `mkobjprobs[]` (weights sum to 100: weapon 10, armor 10, food 20, tool 8, gem 8, potion 16, scroll 16, spellbook 4, wand 4, ring 3, amulet 1). [NetHack-mkobj.c:29-39]
- Brogue CE category weights `itemGenerationProbabilities` (order: gold, scroll, potion, staff, wand, weapon, armor, food, ring, charm, amulet, gem, key): `{50, 42, 52, 3, 3, 10, 8, 2, 3, 2, 0, 0, 0}`. [Brogue-GlobalsBrogue.c; Brogue-Items.c `pickItemCategory`]
- Weighted pick is already a hexrl primitive: `rng.weighted(pool, ...)` (`src/game/game.ts:275`) over `[kind, weight]` pairs (`src/game/monsters.ts:93`). Same shape as Angband `alloc` and Brogue category weights.

## Equipment slots (paper doll)

- NetHack: fixed slot masks `W_ARMH` (helmet), `W_ARMC` (cloak), `W_ARMG` (gloves), `W_ARMF` (boots), `W_ARMS` (shield), `W_ARMU` (shirt), driven by a `worn[]` table: `{ W_ARMH, &uarmh }` etc.; `setworn()` sets pointer and `owornmask` generically. Slot is data, not per-slot code. [NetHack-worn.c `setworn`]
- NetHack armour kinds carry `delay` and `ac` in the `ARMOR`/`HELM`/`GLOVES`/`BOOTS` macros; delay is a field of the kind. [NetHack-objects.c macro; NetHack-worn.c `m_dowear_type`]
- DCSS `armour_type` enum: body (`ARM_ROBE` … `ARM_CRYSTAL_PLATE_ARMOUR`), cloak, helmet (`ARM_HAT`, `ARM_HELMET`), gloves (`ARM_GLOVES`), boots (`ARM_BOOTS`), shield. [DCSS-item-prop-enum.h]
- Angband `type:` per kind (`helm`, `boots`, `gloves`, `soft armor`) links to a base in `object_base.txt` (`name:helm:Helm~`, `name:boots:Boot~`, `name:gloves:Glove~`). The equipment slot is derived from base type. [Angband-object.txt; Angband-object_base.txt]
- Equip timing: DCSS `do_equipment_change` halves time for fast equips; armour zeroes immediate time and queues `start_delay<EquipOnDelay>(ARMOUR_EQUIP_DELAY, …)`; the turn still ends. [DCSS-item-use.cc `do_equipment_change`]

## Chests and ground loot

- NetHack chests are containers: `CONTAINER("chest", …)` (`objects.c`); contents from `mkbox_cnts`: `n = box->olocked ? 7 : 5` for chest, `rn2(n + 1)` items, can be zero. [NetHack-mkobj.c:281-290]
- DCSS drops on death are ground objects: `place_corpse_or_gold` (50/50 `coinflip()` for corpse vs gold), with fallback to adjacent floor, else nothing. [DCSS-mon-death.cc `place_corpse_or_gold`]
- DCSS `maybe_drop_monster_organ`: hide drop `!one_chance_in(3)`, wand drop unconditional per `mons_class_leaves_wand`. Per-item-kind drop chances live in the monster-class code, not a central table. [DCSS-mon-death.cc]
- hexrl already has the ground-pile seam: `gold: ReadonlyMap<string, number>` keyed by hex (`src/game/game.ts:92`); pickup on step (`pickUpGold`, `game.ts:333-347`, called from `playerTurn`, `game.ts:404-407`).

## Potions and free actions

- DCSS `drink()` ends the turn: `you.turn_is_over = true;`, after `quaff_potion` (no time cost computed in `drink()`). [DCSS-item-use.cc `drink`]
- NetHack potions: `POTION("healing", "purple-red", 1, 0, 57, 100, CLR_MAGENTA)`; probability 57, cost 100 (`objects.c`). Quaffing is a move; not checked in source for this note.
- Angband `Cure Light Wounds`: `effect:HEAL_HP`, `dice:20`, `alloc:80:1 to 15` (`object.txt`). Effect is data, not code per kind.
- Turn-cost is a property of the action, not the item, in every source read: DCSS charges via `turn_is_over`; equip charges via `time_taken`. None of the sources read has a zero-cost consumable. Free-action semantics must be hexrl-specific.

## Name generation

- DCSS unidentified armour: `get_equip_desc` prefix (`embroidered`, `shiny`, `dyed`, `runed`, `glowing`); `pair of` for gloves and boots; base name via `item_base_name`; `%+d` enchant and ego suffix only when identified. [DCSS-item-name.cc `item_def::name_aux`]
- DCSS unidentified potions: `PQUAL(subtype_rnd)` + `PCOLOUR(subtype_rnd)` + `" potion"` (e.g. "bubbling blue potion"). Scrolls: `make_name(subtype_rnd, MNAME_SCROLL)`, seeded by `you.game_seed`, so names are reproducible per seed. [DCSS-item-name.cc]
- DCSS `make_name` builds syllables from consonant clusters and vowels, rejects < 4 chars (`"plog"` fallback), and rot13-checks banned words. [DCSS-item-name.cc `make_name`]
- Angband names are `name:` templates with `&` (article) and `~` (plural) markers: `name:& Pair~ of Leather Boots`, `name:Soft Leather Armour~`. [Angband-object.txt]
- Diablo-style affix naming: base type (`item_class`, `tags`, `drop_level`, `inventory_width/height`, `implicits`) is separate from affix mods. Base table: [RePoE-base_items.json]. Mod table (`mods.json`, `generation_type`, `spawn_weights`) not read: file exceeds fetch limit (10 MB). Affix-table claims unverified.
- hexrl's seeded RNG pattern for names: `rngOf(seed, "name").child(id)` mirrors `dropGold` (`game.ts:320`). Deterministic by construction; enforced by `determinismRules` (`eslint.config.js:12`).

## Patterns applied to hexrl

Current seams (`src/game/`):

- `Action = Direction | "wait" | Cast` (`game.ts:105`); `act` is the sole entry (`game.ts:703`). A quaff is a new `Action` member.
- `actOn` always reaches `endTurn` (`game.ts:686-701`); `endTurn` advances `turn`, runs monsters, regenerates, repopulates. Free actions must skip `endTurn`, not reuse `castSpell` (`game.ts:480-499`).
- `Loadout = readonly (SpellId | undefined)[]` (`session.ts:11`); `Intent` `equip` carries `spell: SpellId | undefined` (`session.ts:33-37`); `update` `equip` branch (`session.ts:87-92`). Slots generalise to a union of spell and potion references.
- `Command` (`mode.ts:17-22`) and `chosen()` (`mode.ts:34-44`) dispatch `slot` to a spell; potion slot needs a branch that returns `{ mode: EXPLORE, action: quaff }` without entering aim.
- `ControlId` `slot-${number}` (`controls.ts:4-10`) already bound to six keys; potions reuse slot controls; no new controls.
- `GameEvent` union (`game.ts:117-137`) is consumed by an exhaustive switch in `narration.ts:21-46`; new events force narration at compile time.
- UI: `SpellSlots` (`Pages/Game.tsx:361-385`) renders `spell ?? "—"` and cooldown; `SpellPicker` (`Pages/Game.tsx:388-425`) is the equip UI; header shows `Gold` (`Pages/Game.tsx:178`).
- Monster loot is data: `MONSTERS[kind].gold = { chance, min, max }` (`monsters.ts:7`); death path `attackMonster` → `dropGold` (`game.ts:349-370`, dropGold at `:359`).

Recommendations (not implemented):

- Loot as one ground object per hex: generalise `gold: Map<hexKey, number>` to `ground: Map<hexKey, Chest>`, `Chest = { gold: number; items: readonly Item[] }`. One pile per tile matches `gold` semantics; pickup moves whole pile to pack (extends `pickUpGold`, does not add a branch). Keep a pure `lootOf(seed, monster)` alongside `dropGold` (`game.ts:318`).
- Item model: discriminated union. `ItemKind` table as `as const satisfies` (like `SPELLS`, `spells.ts:21-46`): `{ kind: "potion"; restores: { hp?: number; mp?: number } }` and `{ kind: "equipment"; slot: Slot; base: string }`. Instances: potions stack as counts keyed by kind; equipment stays individual, each with a generated `name`. Invariant encoded in type, not runtime.
- Slots: `Slot = "helm" | "chest" | "pants" | "boots" | "gloves"` (user spec); `Equipment = Readonly<Record<Slot, Equipable | undefined>>`. Equip swaps; unequip returns to pack. Slot is data on the kind, not per-slot code (NetHack `worn[]` pattern).
- Free quaff: add `{ kind: "quaff"; item: PotionKind }` to `Action`. In `actOn`, quaff bypasses `endTurn`: effect applies, `events` recorded, `turn`/monsters/regen unchanged. Test: `turn` and `monsters` unchanged after quaff; monsters do not act. Reject with `Rejection` union additions (`"no-stock"`, `"full"` if HP/MP capped; decide).
- Names: pure `nameOf(seed, id, base)` in a new module using `rngOf(seed, "names").child(id)`; sets of material/adjective/base tables are data. Deep module: `item.ts` exposes `itemOf(seed, kind)` and `nameOf`, hiding table lookups.
- Equipment name prefix approach: DCSS's `shiny`/`dyed` cosmetic prefix on unidentified armour is the closest analogue to "Shiny helm". Name = `[adjective] [material] base` drawn from data tables, not generated syllables.
- Keep `equip` as an `Action` that spends a turn (as DCSS does) or as a Session intent (as spell loadout is today, `session.ts:87-92`). Decide before implementing; see Unresolved.
- Chest-as-container (open action) vs step-pickup: step-pickup is one-line extension of `pickUpGold`. Open action adds a turn-cost decision. Recommend step-pickup first.

## Sources

- NetHack-objects.c: NetHack 3.6, `src/objects.c`, `ARMOR`/`HELM`/`GLOVES`/`BOOTS`/`POTION`/`CONTAINER` macros and entries. https://github.com/NetHack/NetHack/blob/NetHack-3.6/src/objects.c (fetched; no line numbers).
- NetHack-mkobj.c: NetHack 3.6, `src/mkobj.c`, `mkobjprobs[]` (lines 29-39), `mkbox_cnts()` (lines 281-290). https://github.com/NetHack/NetHack/blob/NetHack-3.6/src/mkobj.c (line numbers approximate: counted from the fetched text).
- NetHack-worn.c: NetHack 3.6, `src/worn.c`, `setworn()`, `m_dowear_type()`. https://github.com/NetHack/NetHack/blob/NetHack-3.6/src/worn.c (fetched; no line numbers; `W_ARM*` mask definitions not in this file).
- DCSS-item-prop-enum.h: Crawl `master`, `crawl-ref/source/item-prop-enum.h`, `armour_type`. https://github.com/crawl/crawl/blob/master/crawl-ref/source/item-prop-enum.h (no line numbers; potion enums not present in this file; `POT_*` names unverified).
- DCSS-item-use.cc: Crawl `master`, `crawl-ref/source/item-use.cc`, `drink()`, `do_equipment_change()`. https://github.com/crawl/crawl/blob/master/crawl-ref/source/item-use.cc (fetched; truncated at 100k; no line numbers).
- DCSS-item-name.cc: Crawl `master`, `crawl-ref/source/item-name.cc`, `item_def::name_aux`, `make_name`. https://github.com/crawl/crawl/blob/master/crawl-ref/source/item-name.cc (fetched; truncated; `item_base_name` not read).
- DCSS-mon-death.cc: Crawl `master`, `crawl-ref/source/mon-death.cc`, `place_corpse_or_gold`, `maybe_drop_monster_organ`. https://github.com/crawl/crawl/blob/master/crawl-ref/source/mon-death.cc (fetched; truncated; `monster_die` drop logic partially read).
- Angband-object.txt: Angband `master`, `lib/gamedata/object.txt`, entries for Cure Light Wounds, Pair of Leather Boots, Leather Gloves, Metal Cap, Hard Leather Cap, Soft Leather Armour. https://github.com/angband/angband/blob/master/lib/gamedata/object.txt
- Angband-object_base.txt: Angband `master`, `lib/gamedata/object_base.txt`. https://github.com/angband/angband/blob/master/lib/gamedata/object_base.txt
- Brogue-Items.c: BrogueCE `master`, `src/brogue/Items.c`, `pickItemCategory()`. https://github.com/tmewett/BrogueCE/blob/master/src/brogue/Items.c (fetched first 100k chars only).
- Brogue-GlobalsBrogue.c: BrogueCE `master`, `src/variants/GlobalsBrogue.c`, `itemGenerationProbabilities_Brogue`. https://github.com/tmewett/BrogueCE/blob/master/src/variants/GlobalsBrogue.c (potion table truncated; healing frequency not read).
- RePoE-base_items.json: RePoE fork `lvlvllvlvllvlvl/RePoE`, `RePoE/data/base_items.json`. https://github.com/lvlvllvlvllvlvl/RePoE/blob/master/RePoE/data/base_items.json (fetched; 6.7 MB; read only the currency section; armour entries not seen).

Not used (fetch failed or not read): RePoE `mods.json` (exceeds 10 MB fetch limit); Brogue monster catalog carried-item fields (not in fetched range); DCSS quiver handling (not fetched); Diablo II data files (not fetched).

## Decisions

Override conflicting recommendations above. Implemented: `src/game/items.ts` (model, loot, names, capacity, overflow), `src/game/game.ts` (`Transfer`, `Bind`, `Quaff`, `Destroy` actions), `src/game/session.ts` (`isInventoryOpen`).

- Underfoot chest is `Where` `"ground"`, not `"chest"`: `"chest"` is a paper-doll place.
- Destroy spends a turn, like every other change to the world but quaffing.
- Transfer into the pack beyond capacity is rejected (`"full"`), unless capacity itself fell (bag removed); then the pack spills.

- Turn cost: every transfer is an `Action` that ends the turn: equip, unequip, loadout slot swap, chest→pack, pack→chest, drop. Replaces `session.ts:87-92` free `equip` intent.
- Quaff: free (skips `endTurn`); allowed at full HP/MP; no aim interaction, since aim is UI state (`mode.ts`) and the game only sees the quaff `Action`.
- Chest: a marker for "one or more items on this hex", not an item. Exists iff contents non-empty; no loot, no chest. Gold-only chest valid. Monster drop is one chest holding all rolled loot.
- Chest modal: stepping onto a chest opens it immediately; shows paper doll, pack, chest contents. Layout: stacked, phone-first: paper doll (collapsed `details`, one row per place), pack, chest; pack and chest lists capped at 33vh, scrolling. Per-item icon caps move an item to the list above or below (pack ↑ equips). No drag-and-drop or tap-to-move: arrows cover every move, on touch too. Player picks which items to take. "Take all" deferred. "Destroy" (deletes chest and contents) sits alone in a corner far from "dismiss". Dismissed modal reopens only after stepping off and back on.
- Drop: player can drop from pack via inventory screen, creating (or adding to) a chest at the player's hex.
- Capacity: size-based. Each item has a `size`; pack total ≤ capacity. Base capacity 6. Sizes: helm, boots, gloves 1; pants 2; chest 3; gold, potions, bags 0 (provisional).
- Bags: equipment in dedicated `bag` paper-doll slots (3), never the loadout. Raise capacity only while equipped: small +2, normal +4, large +6. On capacity decrease, drop pack items largest-size first (ties: seeded random) until within limit, into a chest at the player's hex.
- Paper doll: `helm`, `chest`, `pants`, `boots`, `gloves`, 3 × `bag`.
- Potion loadout slot: binds to potion kind; shows pack count; at 0 shows 0 and dims like a cooldown.
- Names: `[prefix] base [suffix]`, prefix and suffix optional. Base = item kind ("boots"); prefix = material ("leather"); suffix = quality (future, e.g. "of speed"); until stats exist, suffix = source monster ("of the goblin"). Example: "chain boots of the goblin".

## Unresolved

- Brogue potion frequency and monster carried-item chance values not verified; RePoE `mods.json` not read.
