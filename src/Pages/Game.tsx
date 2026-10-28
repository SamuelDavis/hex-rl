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
import { drawScene, groundOffsetOf, screenRadiusOf } from "../game/draw";
import {
  cooldownOf,
  isWrecked,
  isOver,
  MAX_HP,
  MAX_MP,
  visibleOf,
  type Game as GameState,
  type GameEvent,
} from "../game/game";
import { directionToward, hexKey, type Direction } from "../game/hex";
import { narrationOf } from "../game/narration";
import {
  newSession,
  SLOT_COUNT,
  update,
  type Intent,
  type Loadout,
} from "../game/session";
import {
  fireballSplashOf,
  SPELL_IDS,
  SPELLS,
  type SpellId,
} from "../game/spells";
import { sightOf, targetInView } from "../game/target";
import { Biome, SEA_LEVEL, surfaceOf } from "../game/terrain";

const MOVE_KEYS: Record<string, Direction> = {
  q: "nw",
  w: "n",
  e: "ne",
  a: "sw",
  s: "s",
  d: "se",
};

const TARGET_KEY = "t";
const SLOT_KEYS = Array.from({ length: SLOT_COUNT }, (_, slot) =>
  String(slot + 1),
);

const WAIT: Intent = { kind: "wait" };
const CYCLE_TARGET: Intent = { kind: "cycleTarget" };
const CONFIRM: Intent = { kind: "confirm" };
const CANCEL: Intent = { kind: "cancel" };

const KEYS: Record<string, Intent> = {
  ...Object.fromEntries(
    Object.entries(MOVE_KEYS).map(([key, direction]) => [
      key,
      { kind: "move", direction },
    ]),
  ),
  ...Object.fromEntries(
    SLOT_KEYS.map((key, slot) => [key, { kind: "slot", slot }]),
  ),
  " ": WAIT,
  ".": WAIT,
  [TARGET_KEY]: CYCLE_TARGET,
  enter: CONFIRM,
  escape: CANCEL,
};

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

export default function Game() {
  const [getSession, setSession] = createSignal(newSession(randomSeed(), 0));
  const [getTab, setTab] = createSignal<Tab>("Play");
  const [getSize, setSize] = createSignal({ width: 0, height: 0 });
  const [getCanvas, setCanvas] = createSignal<HTMLCanvasElement>();
  const [getEditing, setEditing] = createSignal<{ slot: number }>();
  const dispatch = (intent: Intent) =>
    setSession((session) => update(session, intent));
  const getGame = () => getSession().game;
  const getTile = () => getGame().land.tileAt(getGame().player.at);
  const getVisible = createMemo(() => visibleOf(getGame()));
  const getRange = createMemo(() => screenRadiusOf(getSize()));
  const isAiming = () => getSession().mode.kind === "aim";
  const getTargetMark = createMemo(() => {
    const { game, range, target } = getSession();
    if (!target) return undefined;
    const monster = targetInView(game, range, target);
    return monster
      ? { kind: "seen" as const, at: monster.at, sight: sightOf(game, monster) }
      : { kind: "remembered" as const, at: target.lastSeen };
  });

  const getAimMark = createMemo(() => {
    const { mode } = getSession();
    if (mode.kind !== "aim") return undefined;
    const area = [mode.at, ...fireballSplashOf(mode.at)];
    return { at: mode.at, area: new Set(area.map(hexKey)) };
  });

  createEffect(on(getRange, (range) => dispatch({ kind: "view", range })));

  function equip(slot: number, spell: SpellId | undefined) {
    dispatch({ kind: "equip", slot, spell });
    setEditing(undefined);
  }

  function restart() {
    setSession(newSession(randomSeed(), getRange()));
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey || getEditing()) return;
    const intent = KEYS[event.key.toLowerCase()];
    if (!intent) return;
    event.preventDefault();
    dispatch(intent);
  }

  function onTap(event: MouseEvent & { currentTarget: HTMLCanvasElement }) {
    const { left, top, width, height } =
      event.currentTarget.getBoundingClientRect();
    const fromPlayer = {
      x: event.clientX - left - width / 2,
      y: event.clientY - top - height / 2,
    };
    dispatch({
      kind: "move",
      direction: directionToward(groundOffsetOf(fromPlayer)),
    });
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
    const game = getGame();
    const { land, player, monsters, gold, seen } = game;
    const ratio = window.devicePixelRatio;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d")!;
    context.scale(ratio, ratio);
    drawScene(context, {
      tileAt: land.tileAt,
      spawnersIn: land.spawnersIn,
      isWrecked: (spawner) => isWrecked(game, spawner),
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
              loadout={getSession().loadout}
              isAiming={isAiming()}
              dispatch={dispatch}
              editSlot={(slot) => setEditing({ slot })}
              restart={restart}
            />
          </Match>
          <Match when={getTab() === "Log"}>
            <LogPanel log={getSession().log} />
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
              <dd>{getGame().land.seed}</dd>
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
            equipped={getSession().loadout[editing().slot]}
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
  dispatch: (intent: Intent) => void;
  editSlot: (slot: number) => void;
  restart: () => void;
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
                onPress={() => props.dispatch({ kind: "move", direction })}
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
              <PadButton
                label="Wait (Space)"
                onPress={() => props.dispatch(WAIT)}
              >
                Wait
              </PadButton>
            }
          >
            <PadButton
              label="Cast (Enter)"
              onPress={() => props.dispatch(CONFIRM)}
            >
              Cast
            </PadButton>
            <PadButton
              label="Cancel (Escape)"
              onPress={() => props.dispatch(CANCEL)}
            >
              Cancel
            </PadButton>
          </Show>
          <PadButton
            label={`Next target (${TARGET_KEY.toUpperCase()})`}
            onPress={() => props.dispatch(CYCLE_TARGET)}
          >
            Target
          </PadButton>
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

function LogPanel(props: { log: readonly GameEvent[] }) {
  const [getList, setList] = createSignal<HTMLUListElement>();
  createEffect(
    on([getList, () => props.log], ([list]) => {
      if (list) list.scrollTop = list.scrollHeight;
    }),
  );
  return (
    <ul ref={setList} class="h-[5lh] overflow-y-auto">
      <For each={props.log}>{(event) => <li>{narrationOf(event)}</li>}</For>
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
        and see what each can see, even while aiming. Press <kbd>1</kbd>–
        <kbd>6</kbd> to cast the spell in that slot; tap a slot to change its
        spell. Aimed spells move their reticle with the movement keys; cast with{" "}
        <kbd>Enter</kbd> or the slot's key again, or cancel with <kbd>Esc</kbd>.
        Climb one block at a time; swim freely.
      </p>
      <button type="button" onClick={() => props.restart()}>
        New world
      </button>
    </>
  );
}
