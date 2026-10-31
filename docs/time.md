# Time

Contract for what drives ticks: clock modes, input buffers, multiplayer turn timers. Host code (`Session` now, the host peer later), outside `src/game/`, which only exposes `tick(world, intents)` and `act` ([architecture.md](architecture.md#ticks)).

Status: decided, not built. Follows the architecture migration.

## Clock

Players set the timing; the game never adjusts it.

| Mode | Ticks fire | Free Deeds |
|---|---|---|
| Paused | never | rejected: nothing fires |
| Turn-based | `TURN_TIMER` after the first seat submits; seats without an Intent pass | at once |
| Real-time | every 1/N s, N configurable; seats without an Intent pass | at once |

- Turn-based with one seat and a zero timer is today's behaviour: the tick fires on input.
- `TURN_TIMER` and N are host settings, like the clock mode.

## Input buffer

Each seat queues turn-spending Intents; the host dispatches the head into `tick`'s Intent map, one per tick. [Input-Buffer]

- Capacity `BUFFER_TICKS` (2). Queuing into a full buffer is rejected.
- Escape dequeues the last Intent. The UI may show the queue.
- Free Deeds skip the buffer and go straight to `act`; they never count toward capacity.
- The buffer is host state, not world state: input, not consequence.

## Multiplayer

- Peers send Intents to the host, which buffers them per seat. Clock and timer are the host's.
- Turn-based: the first submission starts `TURN_TIMER`; when it ends every seat's head Intent is dispatched and the rest pass.

## Sources

- Input-Buffer: https://daposto.medium.com/game-networking-6-event-input-command-ring-buffer-priority-queue-4ec1b0d985fc ; https://serverside.com/blog/game-server-latency
