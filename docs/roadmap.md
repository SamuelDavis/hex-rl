# Roadmap

Planned features, as asked for; none committed to an order. Each names where it lands in the architecture ([architecture.md](architecture.md)), so it extends what exists rather than adding a parallel path.

| Feature | Status | Lands in |
|---|---|---|
| Conditions beyond afflictions: heal-over-time, countdowns, conditions on any entity (fireball setting a camp on fire) | Architecture ready; none added | Rows in `CONDITIONS`; a `condition` effect on an ability ([Recipes](architecture.md#recipes)) |
| Attributes | Not started | Fields in a component (`Stats`), read where used; condition and equipment modifiers when the first one appears |
| More complex spawning, e.g. lairs keeping their boss alive like towns | Strategies built | `Recruiting` variants and `Boss.spawns` in `content/creatures.ts`, cases in `actions/spawning.ts` |
| More variety of NPCs | Nobles and outposts' folk added; no services | Rows in `content/creatures.ts`; components in `archetypes.ts`; services in `SERVICES` |
| Radiant quests from bailiffs, beyond bounties | Bounties only | Today the `questing` component and `quests.ts`; possibly conditions with data and event reactions once a second quest kind exists |
| Many factions | Two (`wild`, `town`) | Rows in `FACTIONS`; `relationOf` is the only hostility check |
| Multiplayer: peer-to-peer, host-authoritative, simplified MMO | Not started; design kept open | Seats per player: make `playerOf`, `isOver`, `vision`, `immediate` and `act` per seat; serialise state; per-seat event delivery ([architecture.md](architecture.md#multiplayer)) |
| Automatic turns: paused, turn-based, N ticks per second, input buffer | Built for one seat | `Session`, `clock.ts` ([time.md](time.md)) |
| Multi-turn actions, cancellable | Not started | A condition gating other Deeds whose effect fires when due; cancelling removes it |
| Multiplayer turn-based: the first submission starts a configurable timer; at its end all seats' Intents dispatch, the rest pass | Not started | Host time driver ([time.md](time.md#multiplayer)) |
| Selective persistence of unloaded chunks, if keeping everything grows too large (towns always persist) | Not needed yet; all persists | Per-kind persistence rule in `systems/chunks.ts` |
| Interactions with barons and dukes | Not designed; they exist as stronger townsfolk | `SERVICES` |
| AI that focuses on sources of incoming damage before spawners | Approximated: foes that can fight come first | A component remembering recent attackers, read by `mindOf` |
