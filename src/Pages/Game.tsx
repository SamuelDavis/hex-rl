import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
} from "solid-js";
import { drawScene, fogTint } from "../game/draw";
import { act, isOver, MAX_HP, newGame, type Action } from "../game/game";
import { visibleFrom } from "../game/sight";
import { Biome, createTerrain, SEA_LEVEL, surfaceOf } from "../game/terrain";

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

const BIOME_NAMES = Object.fromEntries(
  Object.entries(Biome).map(([name, biome]) => [biome, name]),
);

const LOG_STYLE = {
  background: fogTint(0.3),
  color: "white",
  "--pico-color": "white",
  "--pico-accordion-close-summary-color": "white",
  "--pico-accordion-open-summary-color": "white",
  "--pico-accordion-active-summary-color": "white",
};

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
    setState((state) => ({ ...state, game: act(state.game, action) }));
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
          class="block h-[70vh] w-full"
          aria-label="World"
        />
        <details
          open
          class="absolute bottom-3 left-3 m-0 w-1/4 rounded px-3 py-2 text-sm"
          style={LOG_STYLE}
        >
          <summary>Log</summary>
          <ul ref={setLog} class="m-0 h-[5lh] overflow-y-auto wrap-break-word">
            <For each={getGame().log}>
              {(message) => <li class="mb-0">{message}</li>}
            </For>
          </ul>
        </details>
      </div>
      <footer>
        <Show
          when={isOver(getGame())}
          fallback={
            <small>
              Move <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>A</kbd>{" "}
              <kbd>S</kbd> <kbd>D</kbd>; wait <kbd>Space</kbd>. Bump monsters to
              attack. Climb one block at a time; swim freely.
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
