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
import { HTMLDialog, HTMLIcon } from "@samueldavis/solidlib";
import {
  CONTROL_BY_ID,
  CONTROLS,
  DEFAULT_KEYMAP,
  intentOf,
  keyLabelOf,
  rebound,
  type ControlId,
  type Keymap,
} from "./controls";
import { drawScene, groundOffsetOf, screenRadiusOf } from "./draw";
import {
  cooldownOf,
  GOLD,
  isWrecked,
  isOver,
  MAX_HP,
  MAX_MP,
  visibleOf,
  type Ability,
  type Game as GameState,
  type GameEvent,
  type Where,
} from "../../game/game";
import { directionToward, hexKey, type Direction } from "../../game/hex";
import { narrationOf } from "./narration";
import {
  capacityOf,
  isPotion,
  loadOf,
  nameOf,
  PLACE_NAMES,
  placeFor,
  POTIONS,
  sizeOf,
  type Item,
  type PotionKind,
} from "../../game/items";
import { newSession, update, type Intent } from "./session";
import { fireballSplashOf, SPELL_IDS, SPELLS } from "../../game/spells";
import { sightOf, targetInView } from "./target";
import { Biome, SEA_LEVEL, surfaceOf } from "../../game/terrain";

const PAD_DIRECTIONS: readonly Direction[] = ["nw", "n", "ne", "sw", "s", "se"];

const ARROWS: Record<Direction, string> = {
  nw: "↖︎",
  n: "↑︎",
  ne: "↗︎",
  sw: "↙︎",
  s: "↓︎",
  se: "↘︎",
};

const TABS = ["Play", "Slots", "Pack", "Log", "Other"] as const;
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

  function bind(slot: number, ability: Ability | undefined) {
    dispatch({ kind: "bind", slot, ability });
    setEditing(undefined);
  }

  function restart() {
    setSession(newSession(randomSeed(), getRange()));
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (getEditing() || isRemapping() || getSession().isInventoryOpen) return;
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
              isAiming={isAiming()}
              keymap={getKeymap()}
              dispatch={dispatch}
              restart={restart}
            />
          </Match>
          <Match when={getTab() === "Slots"}>
            <SlotsPanel
              game={getGame()}
              keymap={getKeymap()}
              editSlot={(slot) => setEditing({ slot })}
            />
          </Match>
          <Match when={getTab() === "Pack"}>
            <InventoryPanel game={getGame()} dispatch={dispatch} />
          </Match>
          <Match when={getTab() === "Log"}>
            <LogPanel log={getSession().log} />
          </Match>
          <Match when={getTab() === "Other"}>
            <OtherPanel
              game={getGame()}
              keymap={getKeymap()}
              remap={() => setRemapping(true)}
              restart={restart}
            />
          </Match>
        </Switch>
      </footer>
      <HTMLDialog open={getEditing()} onClose={() => setEditing(undefined)}>
        {(editing) => (
          <AbilityPicker
            slot={editing().slot}
            bound={getGame().player.loadout[editing().slot]}
            bind={(ability) => bind(editing().slot, ability)}
          />
        )}
      </HTMLDialog>
      <HTMLDialog
        open={getSession().isInventoryOpen}
        onClose={() => dispatch({ kind: "dismiss" })}
      >
        <article>
          <header>
            <h3>Inventory</h3>
          </header>
          <InventoryPanel game={getGame()} dispatch={dispatch} />
          <footer>
            <button type="button" onClick={() => dispatch({ kind: "dismiss" })}>
              Dismiss
            </button>
          </footer>
        </article>
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
  isAiming: boolean;
  keymap: Keymap;
  dispatch: (intent: Intent) => void;
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
        keymap={props.keymap}
        dispatch={props.dispatch}
      />
      <div class="mb-(--pico-spacing) grid grid-cols-6 gap-(--pico-spacing)">
        <div class="col-span-3 grid grid-cols-3 gap-(--pico-spacing)">
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
        <div class="col-span-2 col-start-5 grid grid-cols-2 gap-(--pico-spacing)">
          <Show
            when={props.isAiming}
            fallback={
              <>
                <PadButton
                  control="wait"
                  keymap={props.keymap}
                  dispatch={props.dispatch}
                >
                  Wait
                </PadButton>
                <div />
              </>
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

const stockOf = (game: GameState, potion: PotionKind) =>
  game.player.pack.filter(
    (item) => item.kind === "potion" && item.potion === potion,
  ).length;

function SpellSlots(props: {
  game: GameState;
  keymap: Keymap;
  dispatch: (intent: Intent) => void;
}) {
  return (
    <div class="mb-(--pico-spacing) grid grid-cols-6 gap-(--pico-spacing)">
      <For each={props.game.player.loadout}>
        {(ability, slot) => {
          const getCooldown = () =>
            ability && !isPotion(ability) ? cooldownOf(props.game, ability) : 0;
          const getStock = () =>
            ability && isPotion(ability) ? stockOf(props.game, ability) : 1;
          const getHotkey = () => hotkeyOf(props.keymap, `slot-${slot() + 1}`);
          return (
            <button
              type="button"
              tabIndex={-1}
              class="relative m-0 aspect-square p-0 text-xs"
              classList={{
                "opacity-40 grayscale": getCooldown() > 0 || getStock() === 0,
              }}
              aria-label={`Slot ${slot() + 1} (${getHotkey()}): ${ability ?? "empty"}`}
              onClick={() => props.dispatch({ kind: "slot", slot: slot() })}
            >
              <Hotkey>{getHotkey()}</Hotkey>
              <Show when={getCooldown() > 0} fallback={ability ?? "—"}>
                <span class="text-2xl">{getCooldown()}</span>
              </Show>
              <Show when={ability && isPotion(ability)}>
                <span class="absolute right-1 bottom-0.5">×{getStock()}</span>
              </Show>
            </button>
          );
        }}
      </For>
    </div>
  );
}

function SlotsPanel(props: {
  game: GameState;
  keymap: Keymap;
  editSlot: (slot: number) => void;
}) {
  return (
    <>
      <p>
        <small>
          Choose what each slot does. Changing a slot spends a turn.
        </small>
      </p>
      <For each={props.game.player.loadout}>
        {(ability, slot) => (
          <button
            type="button"
            class="block w-full text-left"
            onClick={() => props.editSlot(slot())}
          >
            <kbd>{hotkeyOf(props.keymap, `slot-${slot() + 1}`)}</kbd> Slot{" "}
            {slot() + 1}: {ability ? abilityNameOf(ability) : "empty"}
          </button>
        )}
      </For>
    </>
  );
}

const abilityNameOf = (ability: Ability) =>
  isPotion(ability) ? `${ability} potion` : ability;

function AbilityPicker(props: {
  slot: number;
  bound: Ability | undefined;
  bind: (ability: Ability | undefined) => void;
}) {
  const option = (ability: Ability, detail: JSX.Element) => (
    <button
      type="button"
      class="block w-full text-left"
      classList={{ outline: props.bound !== ability }}
      onClick={() => props.bind(ability)}
    >
      {detail}
    </button>
  );
  return (
    <article>
      <header>
        <h3>Slot {props.slot + 1}</h3>
      </header>
      <For each={SPELL_IDS}>
        {(spell) =>
          option(
            spell,
            <>
              <strong>{spell}</strong> · {SPELLS[spell].mp} MP ·{" "}
              {SPELLS[spell].cooldown} turn cooldown
              <br />
              <small>{SPELLS[spell].summary}</small>
            </>,
          )
        }
      </For>
      <For each={Object.keys(POTIONS) as PotionKind[]}>
        {(potion) =>
          option(
            potion,
            <>
              <strong>{potion} potion</strong> · free action
              <br />
              <small>
                Restore {POTIONS[potion].hp || POTIONS[potion].mp}{" "}
                {POTIONS[potion].hp ? "HP" : "MP"}.
              </small>
            </>,
          )
        }
      </For>
      <footer>
        <small>Changing a slot spends a turn.</small>
        <button
          type="button"
          class="secondary"
          onClick={() => props.bind(undefined)}
        >
          Empty slot
        </button>
      </footer>
    </article>
  );
}

function InventoryPanel(props: {
  game: GameState;
  dispatch: (intent: Intent) => void;
}) {
  const getPlayer = () => props.game.player;
  const getChest = () => props.game.chests.get(hexKey(getPlayer().at));

  function Move(moveProps: {
    cargo: string;
    to: Where;
    icon: string;
    label: string;
  }) {
    return (
      <HTMLIcon
        type={moveProps.icon}
        data-cap="end"
        aria-label={moveProps.label}
        title={moveProps.label}
        onClick={() =>
          props.dispatch({
            kind: "transfer",
            cargo: moveProps.cargo,
            to: moveProps.to,
          })
        }
      />
    );
  }

  const label = (item: Item) => (
    <span>
      {nameOf(item)}
      <Show when={sizeOf(item) > 0}> ({sizeOf(item)})</Show>
    </span>
  );

  return (
    <>
      <Show when={getChest()}>
        <button
          type="button"
          class="secondary"
          onClick={() => props.dispatch({ kind: "destroy" })}
        >
          Destroy chest
        </button>
      </Show>
      <p>
        <small>Each move spends a turn.</small>
      </p>
      <details>
        <summary>Equipment</summary>
        <ul>
          <For each={PLACE_NAMES}>
            {(place) => (
              <li>
                <Show
                  when={getPlayer().equipment[place]}
                  fallback={<span>{place}: none</span>}
                >
                  {(item) => (
                    <>
                      <span>
                        {place}: {label(item())}
                      </span>
                      <Move
                        cargo={item().id}
                        to="pack"
                        icon="arrow_downward"
                        label={`Unequip ${nameOf(item())}`}
                      />
                    </>
                  )}
                </Show>
              </li>
            )}
          </For>
        </ul>
      </details>
      <section>
        <h4>
          Pack {loadOf(getPlayer().pack)}/{capacityOf(getPlayer().equipment)}
        </h4>
        <ul class="max-h-[33vh] overflow-y-auto">
          <Show when={getPlayer().gold > 0}>
            <li>
              <span>{getPlayer().gold} gold</span>
              <Move
                cargo={GOLD}
                to="ground"
                icon="arrow_downward"
                label="Drop gold"
              />
            </li>
          </Show>
          <For each={getPlayer().pack}>
            {(item) => (
              <li>
                {label(item)}
                <Show when={placeFor(item, getPlayer().equipment)}>
                  {(place) => (
                    <Move
                      cargo={item.id}
                      to={place()}
                      icon="arrow_upward"
                      label={`Equip ${nameOf(item)}`}
                    />
                  )}
                </Show>
                <Move
                  cargo={item.id}
                  to="ground"
                  icon="arrow_downward"
                  label={`Drop ${nameOf(item)}`}
                />
              </li>
            )}
          </For>
        </ul>
      </section>
      <section>
        <h4>{getChest() ? "Chest" : "Ground"}</h4>
        <ul class="max-h-[33vh] overflow-y-auto">
          <Show when={(getChest()?.gold ?? 0) > 0}>
            <li>
              <span>{getChest()?.gold} gold</span>
              <Move
                cargo={GOLD}
                to="pack"
                icon="arrow_upward"
                label="Take gold"
              />
            </li>
          </Show>
          <For each={getChest()?.items ?? []}>
            {(item) => (
              <li>
                {label(item)}
                <Move
                  cargo={item.id}
                  to="pack"
                  icon="arrow_upward"
                  label={`Take ${nameOf(item)}`}
                />
              </li>
            )}
          </For>
        </ul>
      </section>
    </>
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
      class={`relative m-0 aspect-square p-0 ${props.class ?? "text-xs"}`}
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
  game: GameState;
  keymap: Keymap;
  remap: () => void;
  restart: () => void;
}) {
  const key = (id: ControlId) => <kbd>{hotkeyOf(props.keymap, id)}</kbd>;
  const getTile = () => props.game.land.tileAt(props.game.player.at);
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
        slot, or tap it; choose what each slot holds, spell or potion, in the
        Slots tab (spends a turn); potions are drunk without spending a turn.
        Step onto a chest, open the Pack tab, or press {key("inventory")}, to
        equip gear and move loot between your pack and the ground (each move
        spends a turn). Aimed spells move their reticle with the movement keys;
        cast with {key("confirm")} or the slot's key again, or cancel with{" "}
        {key("cancel")}. Climb one block at a time; swim freely.
      </p>
      <button type="button" onClick={() => props.remap()}>
        Controls
      </button>
      <button type="button" onClick={() => props.restart()}>
        New world
      </button>
      <details>
        <summary>Debug</summary>
        <dl>
          <dt>Height</dt>
          <dd>{surfaceOf(getTile()) - SEA_LEVEL}</dd>
          <dt>Position</dt>
          <dd>
            {props.game.player.at.q}, {props.game.player.at.r}
          </dd>
          <dt>Seed</dt>
          <dd>{props.game.land.seed}</dd>
          <dt>Monsters awake</dt>
          <dd>{props.game.monsters.length}</dd>
          <dt>Monsters slain</dt>
          <dd>{props.game.kills}</dd>
        </dl>
      </details>
    </>
  );
}
