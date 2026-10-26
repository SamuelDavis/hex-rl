import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
} from "solid-js";
import { drawScene, fogTint, groundOffsetOf } from "../game/draw";
import { directionToward, type Direction } from "../game/hex";
import { act, isOver, MAX_HP, newGame, type Action } from "../game/game";
import { visibleFrom } from "../game/sight";
import { Biome, createTerrain, SEA_LEVEL, surfaceOf } from "../game/terrain";

const MOVE_KEYS: Record<string, Direction> = {
  q: "nw",
  w: "n",
  e: "ne",
  a: "sw",
  s: "s",
  d: "se",
};

const KEYS: Record<string, Action> = {
  ...MOVE_KEYS,
  " ": "wait",
  ".": "wait",
};

const ARROWS: Record<Direction, string> = {
  nw: "↖\uFE0E",
  n: "↑\uFE0E",
  ne: "↗\uFE0E",
  sw: "↙\uFE0E",
  s: "↓\uFE0E",
  se: "↘\uFE0E",
};

const BIOME_NAMES = Object.fromEntries(
  Object.entries(Biome).map(([name, biome]) => [biome, name]),
);

const OVERLAY_STYLE = {
  background: fogTint(0.3),
  "--pico-border-color": "transparent",
  color: "white",
  "--pico-color": "white",
  "--pico-accordion-close-summary-color": "white",
  "--pico-accordion-open-summary-color": "white",
  "--pico-accordion-active-summary-color": "white",
};

const BUTTON_STYLE = { ...OVERLAY_STYLE, background: fogTint(0.6) };

const randomSeed = () => Math.floor(Math.random() * 0x7fffffff);

const explore = (seed: number) => ({
  seed,
  game: newGame(createTerrain(seed)),
});

export default function Game() {
  const [getState, setState] = createSignal(explore(randomSeed()));
  const [getSize, setSize] = createSignal({ width: 0, height: 0 });
  const [getCanvas, setCanvas] = createSignal<HTMLCanvasElement>();
  const [getLog, setLog] = createSignal<HTMLUListElement>();
  const getGame = () => getState().game;
  const getHp = () => Math.max(0, getGame().player.hp);
  const getTile = () => getGame().land.tileAt(getGame().player.at);
  const getVisible = createMemo(() =>
    visibleFrom(getGame().land.tileAt, getGame().player.at),
  );

  function onKeyDown(event: KeyboardEvent) {
    const action = KEYS[event.key.toLowerCase()];
    if (!action || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    perform(action);
  }

  function perform(action: Action) {
    setState((state) => ({ ...state, game: act(state.game, action) }));
  }

  function onTap(event: MouseEvent & { currentTarget: HTMLCanvasElement }) {
    const { left, top, width, height } =
      event.currentTarget.getBoundingClientRect();
    const fromPlayer = {
      x: event.clientX - left - width / 2,
      y: event.clientY - top - height / 2,
    };
    perform(directionToward(groundOffsetOf(fromPlayer)));
  }

  window.addEventListener("keydown", onKeyDown);
  onCleanup(() => window.removeEventListener("keydown", onKeyDown));

  createEffect(
    on([getLog, () => getGame().log], ([log]) => {
      if (log) log.scrollTop = log.scrollHeight;
    }),
  );

  createEffect(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const observer = new ResizeObserver(() =>
      setSize({ width: canvas.clientWidth, height: canvas.clientHeight }),
    );
    observer.observe(canvas);
    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const { width, height } = getSize();
    const { land, player, monsters, seen } = getGame();
    const ratio = window.devicePixelRatio;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d")!;
    context.scale(ratio, ratio);
    drawScene(context, {
      tileAt: land.tileAt,
      player: player.at,
      monsters,
      visible: getVisible(),
      seen,
      width,
      height,
    });
  });

  return (
    <article>
      <header>
        <hgroup>
          <h1>{BIOME_NAMES[getTile().biome]}</h1>
          <p>
            HP {getHp()}/{MAX_HP} · Height {surfaceOf(getTile()) - SEA_LEVEL} ·
            Turn {getGame().turn} · Position {getGame().player.at.q},{" "}
            {getGame().player.at.r} · Seed {getState().seed}
          </p>
        </hgroup>
        <progress value={getHp()} max={MAX_HP} />
      </header>
      <div class="relative">
        <canvas
          ref={setCanvas}
          class="block h-[70vh] w-full touch-manipulation"
          aria-label="World"
          onClick={onTap}
        />
        <div class="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-end gap-2 md:flex-row md:justify-between">
          <details
            open
            class="order-last m-0 w-full rounded px-3 py-2 text-sm text-shadow-md text-shadow-black md:pointer-events-auto md:order-first md:w-1/2 lg:w-1/4"
            style={OVERLAY_STYLE}
          >
            <summary class="pointer-events-auto">Log</summary>
            <ul
              ref={setLog}
              class="m-0 h-[5lh] overflow-y-auto wrap-break-word"
            >
              <For each={getGame().log}>
                {(message) => <li class="mb-0">{message}</li>}
              </For>
            </ul>
          </details>
          <div class="pointer-events-auto grid shrink-0 grid-cols-3 gap-1 text-shadow-md text-shadow-black">
            <For each={Object.entries(MOVE_KEYS)}>
              {([key, direction]) => (
                <button
                  type="button"
                  tabIndex={-1}
                  class="m-0 size-11 p-0 text-xl"
                  style={BUTTON_STYLE}
                  aria-label={`Move ${direction} (${key.toUpperCase()})`}
                  onClick={() => perform(direction)}
                >
                  {ARROWS[direction]}
                </button>
              )}
            </For>
            <button
              type="button"
              tabIndex={-1}
              class="col-span-3 m-0 h-11 p-0"
              style={BUTTON_STYLE}
              aria-label="Wait (Space)"
              onClick={() => perform("wait")}
            >
              Wait
            </button>
          </div>
        </div>
      </div>
      <footer>
        <Show
          when={isOver(getGame())}
          fallback={
            <small>
              Tap toward a direction, or press <kbd>Q</kbd> <kbd>W</kbd>{" "}
              <kbd>E</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>; wait{" "}
              <kbd>Space</kbd>. Bump monsters to attack. Climb one block at a
              time; swim freely.
            </small>
          }
        >
          <p>You died after {getGame().turn} turns.</p>
        </Show>{" "}
        <button type="button" onClick={() => setState(explore(randomSeed()))}>
          New world
        </button>
      </footer>
    </article>
  );
}
