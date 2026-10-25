import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import {
  act,
  isOver,
  MAX_HP,
  newGame,
  visibleFrom,
  type Action,
} from "../game/game";
import {
  centerOf,
  CORNERS,
  directionBetween,
  hexesWithin,
  hexKey,
  type Hex,
} from "../game/hex";
import { LEVEL_RADIUS } from "../game/level";
import { MONSTERS } from "../game/monsters";

const KEYS: Record<string, Action> = {
  w: "n",
  e: "ne",
  d: "se",
  s: "s",
  a: "sw",
  q: "nw",
  " ": "wait",
  ".": "wait",
};

const HEXES = hexesWithin(LEVEL_RADIUS);
const CENTERS = HEXES.map(centerOf);
const MARGIN = 1;
const MIN_X = Math.min(...CENTERS.map(({ x }) => x)) - MARGIN;
const MIN_Y = Math.min(...CENTERS.map(({ y }) => y)) - MARGIN;
const VIEW_BOX = `${MIN_X} ${MIN_Y} ${-2 * MIN_X} ${-2 * MIN_Y}`;

const pointsOf = (hex: Hex) => {
  const { x, y } = centerOf(hex);
  return CORNERS.map((corner) => `${x + corner.x},${y + corner.y}`).join(" ");
};

const randomSeed = () => Math.floor(Math.random() * 0x7fffffff);

function Glyph(props: { at: Hex; glyph: string; fill: string }) {
  const center = () => centerOf(props.at);
  return (
    <text
      x={center().x}
      y={center().y}
      fill={props.fill}
      font-size="1.2"
      font-family="var(--pico-font-family-monospace)"
      font-weight="bold"
      text-anchor="middle"
      dominant-baseline="central"
      pointer-events="none"
    >
      {props.glyph}
    </text>
  );
}

export default function Game() {
  const [getGame, setGame] = createSignal(newGame(randomSeed()));
  const getVisible = createMemo(() =>
    visibleFrom(getGame().level, getGame().player.at),
  );
  const isVisible = (hex: Hex) => getVisible().has(hexKey(hex));

  function perform(action: Action) {
    setGame((game) => act(game, action));
  }

  function moveToward(hex: Hex) {
    const direction = directionBetween(getGame().player.at, hex);
    if (direction) perform(direction);
  }

  function onKeyDown(event: KeyboardEvent) {
    const action = KEYS[event.key.toLowerCase()];
    if (!action || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    perform(action);
  }

  window.addEventListener("keydown", onKeyDown);
  onCleanup(() => window.removeEventListener("keydown", onKeyDown));

  return (
    <article>
      <header>
        <hgroup>
          <h1>Depth {getGame().level.depth}</h1>
          <p>
            HP {Math.max(0, getGame().player.hp)}/{MAX_HP} · Turn{" "}
            {getGame().turn} · Seed {getGame().seed}
          </p>
        </hgroup>
        <progress value={getGame().player.hp} max={MAX_HP} />
      </header>
      <svg viewBox={VIEW_BOX} role="img" aria-label="Map">
        <For each={HEXES}>
          {(hex) => (
            <Show when={getGame().seen.has(hexKey(hex))}>
              <polygon
                points={pointsOf(hex)}
                fill={
                  getGame().level.floors.has(hexKey(hex))
                    ? "var(--pico-code-background-color)"
                    : "var(--pico-muted-color)"
                }
                stroke="var(--pico-muted-border-color)"
                stroke-width="0.05"
                opacity={isVisible(hex) ? 1 : 0.4}
                onClick={() => moveToward(hex)}
              />
            </Show>
          )}
        </For>
        <Show when={getGame().seen.has(hexKey(getGame().level.stairs))}>
          <Glyph
            at={getGame().level.stairs}
            glyph=">"
            fill="var(--pico-ins-color)"
          />
        </Show>
        <For each={getGame().monsters.filter(({ at }) => isVisible(at))}>
          {(monster) => (
            <Glyph
              at={monster.at}
              glyph={MONSTERS[monster.kind].glyph}
              fill="var(--pico-del-color)"
            />
          )}
        </For>
        <Glyph at={getGame().player.at} glyph="@" fill="var(--pico-primary)" />
      </svg>
      <ul>
        <For each={getGame().log}>{(message) => <li>{message}</li>}</For>
      </ul>
      <footer>
        <Show
          when={isOver(getGame())}
          fallback={
            <small>
              Move <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>A</kbd>{" "}
              <kbd>S</kbd> <kbd>D</kbd> or click a neighboring hex; wait{" "}
              <kbd>Space</kbd>. Bump monsters to attack.
            </small>
          }
        >
          <p>
            You died on depth {getGame().level.depth}.{" "}
            <button
              type="button"
              onClick={() => setGame(newGame(randomSeed()))}
            >
              New game
            </button>
          </p>
        </Show>
      </footer>
    </article>
  );
}
