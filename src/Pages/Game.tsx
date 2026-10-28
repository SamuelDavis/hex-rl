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
import {
  CONTROL_BY_ID,
  CONTROLS,
  DEFAULT_KEYMAP,
  intentOf,
  keyLabelOf,
  rebound,
  type ControlId,
  type Keymap,
} from "../game/controls";
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
import { newSession, update, type Intent, type Loadout } from "../game/session";
import {
  fireballSplashOf,
  SPELL_IDS,
  SPELLS,
  type SpellId,
} from "../game/spells";
import { sightOf, targetInView } from "../game/target";
import { Biome, SEA_LEVEL, surfaceOf } from "../game/terrain";

const PAD_DIRECTIONS: readonly Direction[] = ["nw", "n", "ne", "sw", "s", "se"];

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
  const [getKeymap, setKeymap] = createSignal(DEFAULT_KEYMAP);
  const [isRemapping, setRemapping] = createSignal(false);
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
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (getEditing() || isRemapping()) return;
    const intent = intentOf(getKeymap(), event.key);
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
    const { land, player, monsters, chests, seen } = game;
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
      chests,
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
              keymap={getKeymap()}
              dispatch={dispatch}
              editSlot={(slot) => setEditing({ slot })}
              restart={restart}
            />
          </Match>
          <Match when={getTab() === "Log"}>
            <LogPanel log={getSession().log} />
          </Match>
          <Match when={getTab() === "Other"}>
            <OtherPanel
              keymap={getKeymap()}
              remap={() => setRemapping(true)}
              restart={restart}
            />
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
      <HTMLDialog open={isRemapping()} onClose={() => setRemapping(false)}>
        <KeymapEditor
          keymap={getKeymap()}
          bind={(id, key) => setKeymap((keymap) => rebound(keymap, id, key))}
          reset={() => setKeymap(DEFAULT_KEYMAP)}
          close={() => setRemapping(false)}
        />
      </HTMLDialog>
    </article>
  );
}

function PlayPanel(props: {
  game: GameState;
  loadout: Loadout;
  isAiming: boolean;
  keymap: Keymap;
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
        keymap={props.keymap}
        editSlot={props.editSlot}
      />
      <div class="mb-(--pico-spacing) flex items-center justify-between">
        <div class="grid grid-cols-[repeat(3,4rem)] gap-(--pico-spacing)">
          <For each={PAD_DIRECTIONS}>
            {(direction) => (
              <PadButton
                class="text-2xl"
                control={`move-${direction}`}
                keymap={props.keymap}
                dispatch={props.dispatch}
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
                control="wait"
                keymap={props.keymap}
                dispatch={props.dispatch}
              >
                Wait
              </PadButton>
            }
          >
            <PadButton
              control="confirm"
              keymap={props.keymap}
              dispatch={props.dispatch}
            >
              Cast
            </PadButton>
            <PadButton
              control="cancel"
              keymap={props.keymap}
              dispatch={props.dispatch}
            >
              Cancel
            </PadButton>
          </Show>
          <PadButton
            control="target"
            keymap={props.keymap}
            dispatch={props.dispatch}
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
  keymap: Keymap;
  editSlot: (slot: number) => void;
}) {
  return (
    <div class="mb-(--pico-spacing) grid grid-cols-6 gap-(--pico-spacing)">
      <For each={props.loadout}>
        {(spell, slot) => {
          const getCooldown = () => (spell ? cooldownOf(props.game, spell) : 0);
          const getHotkey = () => hotkeyOf(props.keymap, `slot-${slot() + 1}`);
          return (
            <button
              type="button"
              tabIndex={-1}
              class="relative m-0 aspect-square p-0 text-xs"
              classList={{ "opacity-40 grayscale": getCooldown() > 0 }}
              aria-label={`Slot ${slot() + 1} (${getHotkey()}): ${spell ?? "empty"}`}
              onClick={() => props.editSlot(slot())}
            >
              <Hotkey>{getHotkey()}</Hotkey>
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
        <h3>Slot {props.slot + 1}</h3>
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

const hotkeyOf = (keymap: Keymap, id: ControlId) => keyLabelOf(keymap[id]);

function Hotkey(props: { children: string }) {
  return <span class="absolute top-0.5 left-1 text-xs">{props.children}</span>;
}

function PadButton(props: {
  control: ControlId;
  keymap: Keymap;
  dispatch: (intent: Intent) => void;
  class?: string;
  children: JSX.Element;
}) {
  const getControl = () => CONTROL_BY_ID[props.control];
  const getHotkey = () => hotkeyOf(props.keymap, props.control);
  return (
    <button
      type="button"
      tabIndex={-1}
      class={`relative m-0 aspect-square p-0 ${props.class ?? ""}`}
      aria-label={`${getControl().label} (${getHotkey()})`}
      onClick={() => props.dispatch(getControl().intent)}
    >
      <Hotkey>{getHotkey()}</Hotkey>
      {props.children}
    </button>
  );
}

function KeymapEditor(props: {
  keymap: Keymap;
  bind: (id: ControlId, key: string) => void;
  reset: () => void;
  close: () => void;
}) {
  function capture(id: ControlId, event: KeyboardEvent) {
    if (event.key === "Tab" || event.ctrlKey || event.metaKey || event.altKey)
      return;
    event.preventDefault();
    props.bind(id, event.key);
  }

  return (
    <article>
      <header>
        <h3>Controls</h3>
      </header>
      <For each={CONTROLS}>
        {({ id, label }) => (
          <label class="grid grid-cols-[1fr_8rem] items-center">
            {label}
            <input
              readOnly
              value={hotkeyOf(props.keymap, id)}
              onKeyDown={(event) => capture(id, event)}
            />
          </label>
        )}
      </For>
      <footer>
        <button type="button" class="secondary" onClick={() => props.reset()}>
          Reset
        </button>
        <button type="button" onClick={() => props.close()}>
          Done
        </button>
      </footer>
    </article>
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

function OtherPanel(props: {
  keymap: Keymap;
  remap: () => void;
  restart: () => void;
}) {
  const key = (id: ControlId) => <kbd>{hotkeyOf(props.keymap, id)}</kbd>;
  return (
    <>
      <p>
        Face a direction, then step that way: tap toward it, use the Play
        buttons, or press {key("move-nw")} {key("move-n")} {key("move-ne")}{" "}
        {key("move-sw")} {key("move-s")} {key("move-se")}; wait with{" "}
        {key("wait")}. Bump monsters to attack, and their dens, camps, villages,
        mines and caves to wreck them until they heal. Press {key("target")} to
        cycle through monsters in view and see what each can see, even while
        aiming. Press {key("slot-1")}–{key("slot-6")} to cast the spell in that
        slot; tap a slot to change its spell. Aimed spells move their reticle
        with the movement keys; cast with {key("confirm")} or the slot's key
        again, or cancel with {key("cancel")}. Climb one block at a time; swim
        freely.
      </p>
      <button type="button" onClick={() => props.remap()}>
        Controls
      </button>
      <button type="button" onClick={() => props.restart()}>
        New world
      </button>
    </>
  );
}
