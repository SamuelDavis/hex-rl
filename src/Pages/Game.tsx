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
  type JSX,
} from "solid-js";
import { HTMLDialog } from "@samueldavis/solidlib";
import { aimed, startAim } from "../game/aim";
import { drawScene, groundOffsetOf, screenRadiusOf } from "../game/draw";
import {
  act,
  cooldownOf,
  isWrecked,
  isOver,
  MAX_HP,
  MAX_MP,
  newGame,
  unreadyReasonOf,
  visibleOf,
  type Action,
  type Game as GameState,
} from "../game/game";
import { directionToward, hexKey, type Direction, type Hex } from "../game/hex";
import {
  fireballSplashOf,
  SPELL_IDS,
  SPELLS,
  type SpellId,
} from "../game/spells";
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
const CAST_KEY = "enter";
const CANCEL_KEY = "escape";
const SLOT_KEYS = ["1", "2", "3", "4", "5", "6"] as const;

type Loadout = readonly (SpellId | undefined)[];

const STARTING_LOADOUT: Loadout = SLOT_KEYS.map((_, slot) => SPELL_IDS[slot]);

interface Aiming {
  readonly spell: SpellId;
  readonly range: number;
  readonly at: Hex;
}

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
  aiming: undefined as Aiming | undefined,
});

export default function Game() {
  const [getState, setState] = createSignal(explore(randomSeed()));
  const [getTab, setTab] = createSignal<Tab>("Play");
  const [getSize, setSize] = createSignal({ width: 0, height: 0 });
  const [getCanvas, setCanvas] = createSignal<HTMLCanvasElement>();
  const [getLoadout, setLoadout] = createSignal(STARTING_LOADOUT);
  const [getEditing, setEditing] = createSignal<{ slot: number }>();
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

  const getAimMark = createMemo(() => {
    const aiming = getState().aiming;
    if (!aiming) return undefined;
    const area = [aiming.at, ...fireballSplashOf(aiming.at)];
    return { at: aiming.at, area: new Set(area.map(hexKey)) };
  });
  const getTargetAt = () => {
    const mark = getTargetMark();
    return mark?.kind === "seen" ? mark.at : undefined;
  };

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
      return { ...state, game, target, aiming: undefined };
    });
  }

  function steer(direction: Direction) {
    const { game, aiming } = getState();
    if (!aiming) return perform(direction);
    const at = aimed(game, aiming.range, aiming.at, direction);
    setState((state) => ({ ...state, aiming: { ...aiming, at } }));
  }

  function castAimed() {
    const aiming = getState().aiming;
    if (aiming) perform({ spell: aiming.spell, at: aiming.at });
  }

  function cancelAim() {
    setState((state) => ({ ...state, aiming: undefined }));
  }

  function castSlot(slot: number) {
    const spell = getLoadout()[slot];
    if (!spell) return;
    const { game, aiming } = getState();
    if (aiming?.spell === spell) return castAimed();
    const { aim } = SPELLS[spell];
    if (aim.kind !== "hex" || unreadyReasonOf(game, spell))
      return perform({ spell, at: getTargetAt() });
    const at = startAim(game, aim.range, getTargetAt());
    setState((state) => ({
      ...state,
      aiming: { spell, range: aim.range, at },
    }));
  }

  function equip(slot: number, spell: SpellId | undefined) {
    setLoadout((loadout) =>
      loadout.map((equipped, index) => (index === slot ? spell : equipped)),
    );
    setEditing(undefined);
  }

  function restart() {
    setState(explore(randomSeed()));
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey || getEditing()) return;
    if (handleKey(event.key.toLowerCase())) event.preventDefault();
  }

  function handleKey(key: string): boolean {
    const slot = SLOT_KEYS.indexOf(key as (typeof SLOT_KEYS)[number]);
    const direction = MOVE_KEYS[key];
    const isAiming = getState().aiming !== undefined;
    if (slot !== -1) castSlot(slot);
    else if (key === TARGET_KEY) cycleTarget();
    else if (direction) steer(direction);
    else if (isAiming && key === CAST_KEY) castAimed();
    else if (isAiming && key === CANCEL_KEY) cancelAim();
    else if (!isAiming && KEYS[key]) perform(KEYS[key]);
    else return false;
    return true;
  }

  function onTap(event: MouseEvent & { currentTarget: HTMLCanvasElement }) {
    const { left, top, width, height } =
      event.currentTarget.getBoundingClientRect();
    const fromPlayer = {
      x: event.clientX - left - width / 2,
      y: event.clientY - top - height / 2,
    };
    steer(directionToward(groundOffsetOf(fromPlayer)));
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
    const { land, player, monsters, gold, seen } = getGame();
    const ratio = window.devicePixelRatio;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d")!;
    context.scale(ratio, ratio);
    drawScene(context, {
      tileAt: land.tileAt,
      spawnersIn: land.spawnersIn,
      isWrecked: (spawner) => isWrecked(getGame(), spawner),
      player,
      monsters,
      gold,
      visible: getVisible(),
      target: getTargetMark(),
      aim: getAimMark(),
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
            HP {Math.max(0, getGame().player.hp)}/{MAX_HP} · MP{" "}
            {getGame().player.mp}/{MAX_MP} · Gold {getGame().player.gold} · Turn{" "}
            {getGame().turn}
          </p>
        </div>
        <progress value={Math.max(0, getGame().player.hp)} max={MAX_HP} />
        <progress
          class="[--pico-progress-color:hsl(215_85%_55%)]"
          value={getGame().player.mp}
          max={MAX_MP}
        />
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
              loadout={getLoadout()}
              isAiming={getState().aiming !== undefined}
              perform={perform}
              steer={steer}
              castAimed={castAimed}
              cancelAim={cancelAim}
              editSlot={(slot) => setEditing({ slot })}
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
              <dd>{getGame().kills}</dd>
            </dl>
          </Match>
        </Switch>
      </footer>
      <HTMLDialog open={getEditing()} onClose={() => setEditing(undefined)}>
        {(editing) => (
          <SpellPicker
            slot={editing().slot}
            equipped={getLoadout()[editing().slot]}
            equip={(spell) => equip(editing().slot, spell)}
          />
        )}
      </HTMLDialog>
    </article>
  );
}

function PlayPanel(props: {
  game: GameState;
  loadout: Loadout;
  isAiming: boolean;
  perform: (action: Action) => void;
  steer: (direction: Direction) => void;
  castAimed: () => void;
  cancelAim: () => void;
  editSlot: (slot: number) => void;
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
      <SpellSlots
        game={props.game}
        loadout={props.loadout}
        editSlot={props.editSlot}
      />
      <div class="mb-(--pico-spacing) flex items-center justify-between">
        <div class="grid grid-cols-[repeat(3,4rem)] gap-(--pico-spacing)">
          <For each={Object.entries(MOVE_KEYS)}>
            {([key, direction]) => (
              <PadButton
                class="text-2xl"
                label={`Move ${direction} (${key.toUpperCase()})`}
                onPress={() => props.steer(direction)}
              >
                {ARROWS[direction]}
              </PadButton>
            )}
          </For>
        </div>
        <div class="grid grid-cols-[4rem] gap-(--pico-spacing)">
          <Show
            when={props.isAiming}
            fallback={
              <>
                <PadButton
                  label="Wait (Space)"
                  onPress={() => props.perform("wait")}
                >
                  Wait
                </PadButton>
                <PadButton
                  label={`Next target (${TARGET_KEY.toUpperCase()})`}
                  onPress={() => props.cycleTarget()}
                >
                  Target
                </PadButton>
              </>
            }
          >
            <PadButton label="Cast (Enter)" onPress={() => props.castAimed()}>
              Cast
            </PadButton>
            <PadButton
              label="Cancel (Escape)"
              onPress={() => props.cancelAim()}
            >
              Cancel
            </PadButton>
          </Show>
        </div>
      </div>
    </Show>
  );
}

function SpellSlots(props: {
  game: GameState;
  loadout: Loadout;
  editSlot: (slot: number) => void;
}) {
  return (
    <div class="mb-(--pico-spacing) grid grid-cols-6 gap-(--pico-spacing)">
      <For each={props.loadout}>
        {(spell, slot) => {
          const getCooldown = () => (spell ? cooldownOf(props.game, spell) : 0);
          return (
            <button
              type="button"
              tabIndex={-1}
              class="relative m-0 aspect-square p-0 text-xs"
              classList={{ "opacity-40 grayscale": getCooldown() > 0 }}
              aria-label={`Slot ${SLOT_KEYS[slot()]}: ${spell ?? "empty"}`}
              onClick={() => props.editSlot(slot())}
            >
              <span class="absolute top-0.5 left-1">{SLOT_KEYS[slot()]}</span>
              <Show when={getCooldown() > 0} fallback={spell ?? "—"}>
                <span class="text-2xl">{getCooldown()}</span>
              </Show>
            </button>
          );
        }}
      </For>
    </div>
  );
}

function SpellPicker(props: {
  slot: number;
  equipped: SpellId | undefined;
  equip: (spell: SpellId | undefined) => void;
}) {
  return (
    <article>
      <header>
        <h3>Slot {SLOT_KEYS[props.slot]}</h3>
      </header>
      <For each={SPELL_IDS}>
        {(spell) => (
          <button
            type="button"
            class="block w-full text-left"
            classList={{ outline: props.equipped !== spell }}
            onClick={() => props.equip(spell)}
          >
            <strong>{spell}</strong> · {SPELLS[spell].mp} MP ·{" "}
            {SPELLS[spell].cooldown} turn cooldown
            <br />
            <small>{SPELLS[spell].summary}</small>
          </button>
        )}
      </For>
      <footer>
        <button
          type="button"
          class="secondary"
          onClick={() => props.equip(undefined)}
        >
          Empty slot
        </button>
      </footer>
    </article>
  );
}

function PadButton(props: {
  label: string;
  onPress: () => void;
  class?: string;
  children: JSX.Element;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      class={`m-0 aspect-square p-0 ${props.class ?? ""}`}
      aria-label={props.label}
      onClick={() => props.onPress()}
    >
      {props.children}
    </button>
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
        attack, and their dens, camps, villages, mines and caves to wreck them
        until they heal. Press <kbd>T</kbd> to cycle through monsters in view
        and see what each can see. Press <kbd>1</kbd>–<kbd>6</kbd> to cast the
        spell in that slot; tap a slot to change its spell. Aimed spells move
        their reticle with the movement keys; cast with <kbd>Enter</kbd> or the
        slot's key again, or cancel with <kbd>Esc</kbd>. Climb one block at a
        time; swim freely.
      </p>
      <button type="button" onClick={() => props.restart()}>
        New world
      </button>
    </>
  );
}
