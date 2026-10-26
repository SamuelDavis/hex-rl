import { createEffect, createSignal, onCleanup } from "solid-js";
import { drawScene } from "../game/draw";
import { stepFrom } from "../game/explorer";
import type { Direction } from "../game/hex";
import { Biome, createTerrain, SEA_LEVEL, surfaceOf } from "../game/terrain";

const KEYS: Record<string, Direction> = {
  w: "n",
  e: "ne",
  d: "se",
  s: "s",
  a: "sw",
  q: "nw",
};

const BIOME_NAMES = Object.fromEntries(
  Object.entries(Biome).map(([name, biome]) => [biome, name]),
);

const randomSeed = () => Math.floor(Math.random() * 0x7fffffff);

const explore = (seed: number) => {
  const terrain = createTerrain(seed);
  return { seed, terrain, player: terrain.spawn };
};

export default function Game() {
  const [getState, setState] = createSignal(explore(randomSeed()));
  const [getSize, setSize] = createSignal({ width: 0, height: 0 });
  const getTile = () => getState().terrain.tileAt(getState().player);
  const [getCanvas, setCanvas] = createSignal<HTMLCanvasElement>();

  function onKeyDown(event: KeyboardEvent) {
    const direction = KEYS[event.key.toLowerCase()];
    if (!direction || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    setState((state) => ({
      ...state,
      player: stepFrom(state.terrain.tileAt, state.player, direction),
    }));
  }

  window.addEventListener("keydown", onKeyDown);
  onCleanup(() => window.removeEventListener("keydown", onKeyDown));

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
    const { terrain, player } = getState();
    const ratio = window.devicePixelRatio;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d")!;
    context.scale(ratio, ratio);
    drawScene(context, { tileAt: terrain.tileAt, player, width, height });
  });

  return (
    <article>
      <header>
        <hgroup>
          <h1>{BIOME_NAMES[getTile().biome]}</h1>
          <p>
            Height {surfaceOf(getTile()) - SEA_LEVEL} · Position{" "}
            {getState().player.q}, {getState().player.r} · Seed{" "}
            {getState().seed}
          </p>
        </hgroup>
      </header>
      <canvas
        ref={setCanvas}
        class="block h-[70vh] w-full"
        aria-label="World"
      />
      <footer>
        <small>
          Move <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>A</kbd> <kbd>S</kbd>{" "}
          <kbd>D</kbd>. Climb one block at a time; swim freely.
        </small>{" "}
        <button type="button" onClick={() => setState(explore(randomSeed()))}>
          New world
        </button>
      </footer>
    </article>
  );
}
