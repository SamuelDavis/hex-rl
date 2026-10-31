# Time

Contract for what drives ticks: speed, input buffers, multiplayer turn timers. Host code (`Session`, `src/Pages/Game/session.ts`, and `src/Pages/Game/clock.ts` now; the host peer later), outside `src/game/`, which only exposes `tick(game, intents)`, `immediate` and `act` ([architecture.md](architecture.md#ticks)).

Status: built for one seat; multiplayer turn timers are not.

## Speed

The player sets the speed (`Speed`, `SPEEDS`; the select beside the place name, persisted); the game never adjusts it.

| Speed | Ticks fire | Free Deeds |
|---|---|---|
| Paused | never | dropped: nothing fires |
| Turn-based | when the player submits a turn-spending Intent (`act`) | at once |
| N ticks/s | every 1/N s (`intervalOf`), whatever is queued; a seat with nothing queued passes | at once (`immediate`) |

- Multiplayer turn-based (not built): the first submission starts `TURN_TIMER`; when it ends every seat's head Intent is dispatched and the rest pass. `TURN_TIMER` is a host setting, like the speed.

## Input buffer

Each seat queues turn-spending Intents; the host dispatches the head into `tick`'s Intent map, one per tick. [Input-Buffer]

- Capacity `BUFFER_TICKS` (2). Queuing into a full buffer is rejected.
- Cancel (Escape by default), outside aiming, drops the last queued Intent. The header shows how many are queued.
- An Intent that would be rejected now is rejected at once, not queued; one that becomes invalid by its tick is rejected then.
- Changing speed clears the queue.
- Free Deeds skip the buffer and resolve at once (`immediate`); they never count toward capacity.
- The buffer is host state, not world state: input, not consequence.

## Multiplayer

- Peers send Intents to the host, which buffers them per seat. Speed and timer are the host's.

## Sources

- Input-Buffer: https://daposto.medium.com/game-networking-6-event-input-command-ring-buffer-priority-queue-4ec1b0d985fc ; https://serverside.com/blog/game-server-latency
