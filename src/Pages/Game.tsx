import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { drawScene, groundOffsetOf, screenRadiusOf } from "../game/draw";
import {
  act,
  isOver,
  MAX_HP,
  newGame,
  visibleOf,
  type Action,
  type Game as GameState,
} from "../game/game";
import { directionToward, type Direction } from "../game/hex";
import {
  nextTarget,
  sightOf,
  targetInView,
  tracked,
  type Target,
} from "../game/target";
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

const TARGET_KEY = "t";

const ARROWS: Record<Direction, string> = {
  nw: "↖︎",
  n: "↑︎",
  ne: "↗︎",
  sw: "↙︎",
  s: "↓︎",
  se: "↘︎",
};

const TABS = ["Play", "Log", "Other", "Debug"] as const;
type Tab = (typeof TABS)[number];

const BIOME_NAMES = Object.fromEntries(
  Object.entries(Biome).map(([name, biome]) => [biome, name]),
);

const randomSeed = () => Math.floor(Math.random() * 0x7fffffff);

const explore = (seed: number) => ({
  seed,
  game: newGame(createTerrain(seed)),
  target: undefined as Target | undefined,
});

export default function Game() {
  const [getState, setState] = createSignal(explore(randomSeed()));
  const [getTab, setTab] = createSignal<Tab>("Play");
  const [getSize, setSize] = createSignal({ width: 0, height: 0 });
  const [getCanvas, setCanvas] = createSignal<HTMLCanvasElement>();
  const getGame = () => getState().game;
  const getTile = () => getGame().land.tileAt(getGame().player.at);
  const getVisible = createMemo(() => visibleOf(getGame()));
  const getRange = createMemo(() => screenRadiusOf(getSize()));
  const getTargetMark = createMemo(() => {
    const { game, target } = getState();
    if (!target) return undefined;
    const monster = targetInView(game, getRange(), target);
    return monster
      ? { kind: "seen" as const, at: monster.at, sight: sightOf(game, monster) }
      : { kind: "remembered" as const, at: target.lastSeen };
  });

  function cycleTarget() {
    setState((state) => ({
      ...state,
      target: nextTarget(state.game, getRange(), state.target),
    }));
  }

  function perform(action: Action) {
    setState((state) => {
      const game = act(state.game, action);
      const target = state.target && tracked(game, getRange(), state.target);
      return { ...state, game, target };
    });
  }

  function restart() {
    setState(explore(randomSeed()));
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === TARGET_KEY) {
      event.preventDefault();
      cycleTarget();
      return;
    }
    const action = KEYS[key];
    if (!action) return;
    event.preventDefault();
    perform(action);
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
      player,
      monsters,
      visible: getVisible(),
      target: getTargetMark(),
      seen,
      width,
      height,
    });
  });

  return (
    <article class="mx-auto max-w-lg">
      <header>
        <div>
          <h1>{BIOME_NAMES[getTile().biome]}</h1>
          <p data-cap="end">
            HP {Math.max(0, getGame().player.hp)}/{MAX_HP} · Turn{" "}
            {getGame().turn}
          </p>
        </div>
        <progress value={Math.max(0, getGame().player.hp)} max={MAX_HP} />
      </header>
      <canvas
        ref={setCanvas}
        class="block aspect-square w-full touch-manipulation"
        aria-label="World"
        onClick={onTap}
      />
      <footer>
        <div role="group">
          <For each={TABS}>
            {(tab) => (
              <button
                type="button"
                aria-current={getTab() === tab}
                onClick={() => setTab(tab)}
              >
                {tab}
              </button>
            )}
          </For>
        </div>
        <Switch>
          <Match when={getTab() === "Play"}>
            <PlayPanel
              game={getGame()}
              perform={perform}
              restart={restart}
              cycleTarget={cycleTarget}
            />
          </Match>
          <Match when={getTab() === "Log"}>
            <LogPanel log={getGame().log} />
          </Match>
          <Match when={getTab() === "Other"}>
            <OtherPanel restart={restart} />
          </Match>
          <Match when={getTab() === "Debug"}>
            <dl>
              <dt>Height</dt>
              <dd>{surfaceOf(getTile()) - SEA_LEVEL}</dd>
              <dt>Position</dt>
              <dd>
                {getGame().player.at.q}, {getGame().player.at.r}
              </dd>
              <dt>Seed</dt>
              <dd>{getState().seed}</dd>
              <dt>Monsters awake</dt>
              <dd>{getGame().monsters.length}</dd>
              <dt>Monsters slain</dt>
              <dd>{getGame().slain.size}</dd>
            </dl>
          </Match>
        </Switch>
      </footer>
    </article>
  );
}

function PlayPanel(props: {
  game: GameState;
  perform: (action: Action) => void;
  restart: () => void;
  cycleTarget: () => void;
}) {
  return (
    <Show
      when={!isOver(props.game)}
      fallback={
        <>
          <p>You died after {props.game.turn} turns.</p>
          <button type="button" onClick={() => props.restart()}>
            New world
          </button>
        </>
      }
    >
      <MovePad perform={props.perform} />
      <div role="group">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Wait (Space)"
          onClick={() => props.perform("wait")}
        >
          Wait
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Next target (${TARGET_KEY.toUpperCase()})`}
          onClick={() => props.cycleTarget()}
        >
          Target
        </button>
      </div>
    </Show>
  );
}

function MovePad(props: { perform: (direction: Direction) => void }) {
  return (
    <div class="mx-auto mb-(--pico-spacing) grid w-fit grid-cols-[repeat(3,4rem)] gap-(--pico-spacing)">
      <For each={Object.entries(MOVE_KEYS)}>
        {([key, direction]) => (
          <button
            type="button"
            tabIndex={-1}
            class="m-0 aspect-square p-0 text-2xl"
            aria-label={`Move ${direction} (${key.toUpperCase()})`}
            onClick={() => props.perform(direction)}
          >
            {ARROWS[direction]}
          </button>
        )}
      </For>
    </div>
  );
}

function LogPanel(props: { log: readonly string[] }) {
  const [getList, setList] = createSignal<HTMLUListElement>();
  createEffect(
    on([getList, () => props.log], ([list]) => {
      if (list) list.scrollTop = list.scrollHeight;
    }),
  );
  return (
    <ul ref={setList} class="h-[5lh] overflow-y-auto">
      <For each={props.log}>{(message) => <li>{message}</li>}</For>
    </ul>
  );
}

function OtherPanel(props: { restart: () => void }) {
  return (
    <>
      <p>
        Face a direction, then step that way: tap toward it, use the Play
        buttons, or press <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>A</kbd>{" "}
        <kbd>S</kbd> <kbd>D</kbd>; wait with <kbd>Space</kbd>. Bump monsters to
        attack. Press <kbd>T</kbd> to cycle through monsters in view and see
        what each can see. Climb one block at a time; swim freely.
      </p>
      <button type="button" onClick={() => props.restart()}>
        New world
      </button>
    </>
  );
}
