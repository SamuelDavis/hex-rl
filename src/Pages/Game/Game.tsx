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
import { HTMLDialog, HTMLIcon, persist } from "@samueldavis/solidlib";
import {
  CONTROL_BY_ID,
  CONTROLS,
  DEFAULT_KEYMAP,
  inputOf,
  keyLabelOf,
  rebound,
  type ControlId,
  type Input,
  type Keymap,
} from "./controls";
import { messageOf, slotted, STARTING_LOADOUT, type Loadout } from "./loadout";
import { drawScene, groundOffsetOf, screenRadiusOf } from "./draw";
import { CANVAS_THEMES } from "./canvasTheme";
import { useAppState } from "../../AppState";
import {
  cooldownOf,
  creaturesOf,
  has,
  masteryOf,
  playerOf,
  remainingOf,
  GOLD,
  isWrecked,
  isOver,
  levelOf,
  MAX_HP,
  MAX_MP,
  spellLevelOf,
  unlocksOf,
  visibleOf,
  unreadinessOf,
  whoOf,
  XP_PER_LEVEL,
  type Game as GameState,
  type GameEvent,
  type Creature,
  type Where,
  type With,
} from "../../game/game";
import {
  directionToward,
  hexKey,
  type Direction,
  type Hex,
} from "../../game/hex";
import { bountyOf, narrationOf, placeOf, whoNameOf } from "./narration";
import {
  capacityOf,
  loadOf,
  nameOf,
  offerOf,
  PLACE_NAMES,
  priceOf,
  placeFor,
  sizeOf,
  type Item,
  type PotionKind,
} from "../../game/items";
import { conversantOf, newSession, update, type Message } from "./session";
import { intervalOf, TURN_BASED, type Speed } from "./clock";
import {
  ABILITY_IDS,
  abilityOf,
  isSpell,
  SPELL_IDS,
  type AbilityId,
} from "../../game/content/abilities";
import { SERVICES } from "../../game/content/creatures";
import type { ConditionId } from "../../game/content/conditions";
import { areaOf } from "../../game/effects";
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

const MENU = ["Slots", "Pack", "Spells", "Log", "Other"] as const;
type MenuItem = (typeof MENU)[number];
type Panel = Exclude<MenuItem, "Pack">;

const CONDITION_NAMES: Record<ConditionId, string> = {
  bleed: "Bleeding",
  stun: "Stunned",
  paralysis: "Paralyzed",
  regeneration: "Regenerating",
  "mana regeneration": "Regenerating mana",
};

const BIOME_NAMES = Object.fromEntries(
  Object.entries(Biome).map(([name, biome]) => [biome, name]),
);

const randomSeed = () => Math.floor(Math.random() * 0x7fffffff);

/** How far from the origin a random starting position may be, in hexes. */
const RANDOM_REACH = 1000;

const randomPosition = (): Hex => {
  const coordinate = () =>
    Math.floor(Math.random() * (2 * RANDOM_REACH + 1)) - RANDOM_REACH;
  return { q: coordinate(), r: coordinate() };
};

export default function Game() {
  const { getTheme } = useAppState();
  const [getSession, setSession] = createSignal(newSession(randomSeed(), 0));
  const [getPanel, setPanel] = createSignal<Panel>();
  const [getSize, setSize] = createSignal({ width: 0, height: 0 });
  const [getCanvas, setCanvas] = createSignal<HTMLCanvasElement>();
  const [getEditing, setEditing] = createSignal<{ slot: number }>();
  const [getKeymap, setKeymap] = persist(createSignal(DEFAULT_KEYMAP), {
    key: "keymap",
    decode: (json): Keymap => ({ ...DEFAULT_KEYMAP, ...JSON.parse(json) }),
  });
  const [getLoadout, setLoadout] = createSignal(STARTING_LOADOUT);
  const [getSpeed, setSpeed] = persist(createSignal<Speed>(TURN_BASED), {
    key: "speed",
    decode: (json): Speed => ({ ...TURN_BASED, ...JSON.parse(json) }),
  });
  const [isRemapping, setRemapping] = createSignal(false);
  const dispatch = (message: Message) =>
    setSession((session) => update(session, message));
  const press = (input: Input) => {
    const message = messageOf(getLoadout(), input);
    if (message) dispatch(message);
  };
  const getGame = () => getSession().game;
  const getTile = () => getGame().land.tileAt(playerOf(getGame()).at);
  const getVisible = createMemo(() => visibleOf(getGame()));
  const getRange = createMemo(() => screenRadiusOf(getSize()));
  const isAiming = () => getSession().mode.kind === "aim";
  const getConversant = () => conversantOf(getSession());
  const getTargetMark = createMemo(() => {
    const { game, range, target } = getSession();
    if (!target) return undefined;
    const creature = targetInView(game, range, target);
    return creature
      ? {
          kind: "seen" as const,
          at: creature.at,
          sight: sightOf(game, creature),
        }
      : { kind: "remembered" as const, at: target.lastSeen };
  });

  const getStatus = () =>
    conditionsOf(getGame())
      .map(([condition, turns]) => `${CONDITION_NAMES[condition]} ${turns}`)
      .join(" · ");

  const getAimMark = createMemo(() => {
    const { mode, game } = getSession();
    if (mode.kind !== "aim") return undefined;
    const area = abilityOf(mode.ability).effects.flatMap((effect) =>
      effect.kind === "damage"
        ? areaOf(effect.area, playerOf(game), mode.at)
        : [],
    );
    return { at: mode.at, area: new Set(area.map(hexKey)) };
  });

  createEffect(on(getRange, (range) => dispatch({ kind: "view", range })));
  createEffect(on(getSpeed, (speed) => dispatch({ kind: "speed", speed })));
  const getInterval = createMemo(() => intervalOf(getSession().speed));
  createEffect(
    on(getInterval, (interval) => {
      if (interval === undefined) return;
      const timer = setInterval(() => dispatch({ kind: "tick" }), interval);
      onCleanup(() => clearInterval(timer));
    }),
  );

  function bind(slot: number, ability: AbilityId | undefined) {
    setLoadout((loadout) => slotted(loadout, slot, ability));
    dispatch({ kind: "prepare" });
    setEditing(undefined);
  }

  const [isStarting, setStarting] = createSignal(false);
  const [getLastStart, setLastStart] = persist(
    createSignal<Start | undefined>(undefined),
    { key: "start" },
  );

  function start({ seed, at }: Start) {
    setLastStart({ seed, at });
    setSession(newSession(seed, getRange(), at));
    dispatch({ kind: "speed", speed: getSpeed() });
    setLoadout(STARTING_LOADOUT);
    setStarting(false);
    setPanel(undefined);
  }

  function open(item: MenuItem) {
    if (item === "Pack") dispatch({ kind: "inventory" });
    else setPanel(item);
  }

  const restart = () => setStarting(true);

  function onKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (
      getPanel() ||
      getEditing() ||
      isRemapping() ||
      getSession().isInventoryOpen ||
      isStarting() ||
      getConversant()
    )
      return;
    const input = inputOf(getKeymap(), event.key);
    if (!input) return;
    event.preventDefault();
    press(input);
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
    const { land, chests, seen } = game;
    const player = playerOf(game);
    const ratio = window.devicePixelRatio;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d")!;
    context.scale(ratio, ratio);
    drawScene(context, {
      theme: CANVAS_THEMES[getTheme()],
      tileAt: land.tileAt,
      spawnersIn: land.spawnersIn,
      isWrecked: (spawner) => isWrecked(game, spawner),
      player,
      creatures: creaturesOf(game),
      chests,
      visible: getVisible(),
      target: getTargetMark(),
      aim: getAimMark(),
      bounty: player.bounty?.isSlain ? undefined : player.bounty?.at,
      seen,
      width,
      height,
    });
  });

  return (
    <article class="mx-auto max-w-lg">
      <header>
        <nav>
          <ul>
            <li>
              <h1 class="mb-0">{BIOME_NAMES[getTile().biome]}</h1>
            </li>
            <li>
              Level {levelOf(playerOf(getGame()))} · Gold{" "}
              {playerOf(getGame()).gold}
            </li>
            <Show when={getSession().queue.length}>
              {(queued) => <li>Queued {queued()}</li>}
            </Show>
          </ul>
          <ul>
            <li>
              <Menu unlocks={unlocksOf(playerOf(getGame()))} open={open} />
            </li>
          </ul>
        </nav>
        <div class="grid grid-cols-3 gap-(--pico-spacing)">
          <Meter
            label="HP"
            value={Math.max(0, playerOf(getGame()).hp)}
            max={MAX_HP}
          />
          <Meter
            label="MP"
            class="[--pico-progress-color:var(--mana-color)]"
            value={playerOf(getGame()).mp}
            max={MAX_MP}
          />
          <Meter
            label="XP"
            class="[--pico-progress-color:var(--xp-color)]"
            value={playerOf(getGame()).xp % XP_PER_LEVEL}
            max={XP_PER_LEVEL}
          />
        </div>
        <Show when={getStatus()}>
          <p>
            <small>{getStatus()}</small>
          </p>
        </Show>
        <Show when={playerOf(getGame()).bounty}>
          {(bounty) => (
            <p data-cap="end">
              <small>
                Bounty:{" "}
                {bounty().isSlain
                  ? "slain; return to a bailiff"
                  : bountyOf(bounty().kind, bounty().at)}{" "}
                · you are at {placeOf(playerOf(getGame()).at)}
              </small>
            </p>
          )}
        </Show>
      </header>
      <canvas
        ref={setCanvas}
        class="block aspect-square w-full touch-manipulation"
        aria-label="World"
        onClick={onTap}
      />
      <footer>
        <PlayPanel
          game={getGame()}
          isAiming={isAiming()}
          loadout={getLoadout()}
          keymap={getKeymap()}
          press={press}
          restart={restart}
        />
      </footer>
      <HTMLDialog open={getPanel()} onClose={() => setPanel(undefined)}>
        {(panel) => (
          <article>
            <header>
              <h3>{panel()}</h3>
            </header>
            <Switch>
              <Match when={panel() === "Slots"}>
                <SlotsPanel
                  loadout={getLoadout()}
                  keymap={getKeymap()}
                  editSlot={(slot) => setEditing({ slot })}
                />
              </Match>
              <Match when={panel() === "Spells"}>
                <SpellsPanel game={getGame()} dispatch={dispatch} />
              </Match>
              <Match when={panel() === "Log"}>
                <LogPanel log={getSession().log} />
              </Match>
              <Match when={panel() === "Other"}>
                <OtherPanel
                  game={getGame()}
                  keymap={getKeymap()}
                  speed={getSpeed()}
                  setSpeed={setSpeed}
                  remap={() => setRemapping(true)}
                  restart={restart}
                />
              </Match>
            </Switch>
            <footer>
              <button type="button" onClick={() => setPanel(undefined)}>
                Close
              </button>
            </footer>
          </article>
        )}
      </HTMLDialog>
      <HTMLDialog open={getEditing()} onClose={() => setEditing(undefined)}>
        {(editing) => (
          <AbilityPicker
            game={getGame()}
            slot={editing().slot}
            bound={getLoadout()[editing().slot]}
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
      <HTMLDialog
        open={getConversant()}
        onClose={() => dispatch({ kind: "dismiss" })}
      >
        {(conversant) => (
          <article>
            <header>
              <h3 class="capitalize">
                {whoNameOf(whoOf(getGame(), conversant().id))}
              </h3>
            </header>
            <Switch>
              <Match
                when={
                  SERVICES[conversant().kind] === "trade" &&
                  has(conversant(), "wares", "purse") &&
                  conversant()
                }
              >
                {(trader) => (
                  <TradePanel
                    game={getGame()}
                    trader={trader() as Creature & With<"wares" | "purse">}
                    dispatch={dispatch}
                  />
                )}
              </Match>
              <Match when={SERVICES[conversant().kind] === "bounty"}>
                <BountyPanel game={getGame()} />
              </Match>
            </Switch>
            <footer>
              <button
                type="button"
                onClick={() => dispatch({ kind: "dismiss" })}
              >
                Farewell
              </button>
            </footer>
          </article>
        )}
      </HTMLDialog>
      <HTMLDialog open={isStarting()} onClose={() => setStarting(false)}>
        <NewWorld
          initial={getLastStart()}
          start={start}
          cancel={() => setStarting(false)}
        />
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
  loadout: Loadout;
  press: (input: Input) => void;
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
        press={props.press}
      />
      <div class="mb-(--pico-spacing) grid grid-cols-6 gap-(--pico-spacing)">
        <div class="col-span-3 grid grid-cols-3 gap-(--pico-spacing)">
          <For each={PAD_DIRECTIONS}>
            {(direction) => (
              <PadButton
                class="text-2xl"
                control={`move-${direction}`}
                keymap={props.keymap}
                press={props.press}
              >
                {ARROWS[direction]}
              </PadButton>
            )}
          </For>
        </div>
        <div class="col-span-2 col-start-5 grid grid-cols-2 gap-(--pico-spacing)">
          <PadButton control="target" keymap={props.keymap} press={props.press}>
            Target
          </PadButton>
          <Show
            when={props.isAiming}
            fallback={
              <PadButton
                control="interact"
                keymap={props.keymap}
                press={props.press}
              >
                Interact
              </PadButton>
            }
          >
            <PadButton
              control="confirm"
              keymap={props.keymap}
              press={props.press}
            >
              Cast
            </PadButton>
          </Show>
          <div />
          <Show
            when={props.isAiming}
            fallback={
              <PadButton
                control="wait"
                keymap={props.keymap}
                press={props.press}
              >
                Wait
              </PadButton>
            }
          >
            <PadButton
              control="cancel"
              keymap={props.keymap}
              press={props.press}
            >
              Cancel
            </PadButton>
          </Show>
        </div>
      </div>
    </Show>
  );
}

/** Conditions that wear off, with the turns each lasts at most. */
const conditionsOf = (game: GameState) => {
  const { conditions } = playerOf(game);
  return [...conditions.keys()]
    .map((id) => [id, remainingOf(conditions, id)] as const)
    .filter(([, turns]) => turns > 0 && Number.isFinite(turns));
};

const stockOf = (game: GameState, potion: PotionKind | undefined) =>
  playerOf(game).pack.filter(
    (item) => item.kind === "potion" && item.potion === potion,
  ).length;

const tallyOf = (game: GameState, ability: AbilityId) =>
  isSpell(ability)
    ? String(spellLevelOf(playerOf(game), ability))
    : `×${stockOf(game, abilityOf(ability).consumes)}`;

function SpellSlots(props: {
  game: GameState;
  loadout: Loadout;
  keymap: Keymap;
  press: (input: Input) => void;
}) {
  return (
    <div class="mb-(--pico-spacing) grid grid-cols-6 gap-(--pico-spacing)">
      <For each={props.loadout}>
        {(ability, slot) => {
          const getCooldown = () =>
            ability ? cooldownOf(props.game, playerOf(props.game), ability) : 0;
          const getHotkey = () => hotkeyOf(props.keymap, `slot-${slot() + 1}`);
          return (
            <button
              type="button"
              tabIndex={-1}
              class="relative m-0 flex aspect-square flex-col items-center justify-center p-0 text-xs"
              classList={{
                "opacity-40 grayscale":
                  ability !== undefined &&
                  unreadinessOf(props.game, playerOf(props.game), ability) !==
                    undefined,
              }}
              aria-label={`Slot ${slot() + 1} (${getHotkey()}): ${ability ?? "empty"}`}
              onClick={() => props.press({ kind: "slot", slot: slot() })}
            >
              <Hotkey>{getHotkey()}</Hotkey>
              <Show when={ability} fallback="—">
                {(bound) => (
                  <>
                    <Show
                      when={getCooldown() > 0}
                      fallback={<AbilityIcon ability={bound()} />}
                    >
                      <span class="text-2xl">{getCooldown()}</span>
                    </Show>
                    <span class="absolute inset-x-0 bottom-0.5 text-center">
                      {bound()}
                    </span>
                    <Count>{tallyOf(props.game, bound())}</Count>
                  </>
                )}
              </Show>
            </button>
          );
        }}
      </For>
    </div>
  );
}

function SlotsPanel(props: {
  loadout: Loadout;
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
      <For each={props.loadout}>
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

const abilityNameOf = (ability: AbilityId) =>
  abilityOf(ability).consumes ? `${ability} potion` : ability;

const costOf = (ability: AbilityId) => {
  const { spendsTurn, mp, cooldown } = abilityOf(ability);
  return spendsTurn ? `${mp} MP · ${cooldown} turn cooldown` : "free action";
};

const isKnown = (game: GameState, ability: AbilityId) =>
  masteryOf(playerOf(game), ability) > 0;

function AbilityPicker(props: {
  game: GameState;
  slot: number;
  bound: AbilityId | undefined;
  bind: (ability: AbilityId | undefined) => void;
}) {
  return (
    <article>
      <header>
        <h3>Slot {props.slot + 1}</h3>
      </header>
      <For each={ABILITY_IDS.filter((ability) => isKnown(props.game, ability))}>
        {(ability) => (
          <button
            type="button"
            class="w-full text-left"
            classList={{ outline: props.bound !== ability }}
            onClick={() => props.bind(ability)}
          >
            <AbilityCard ability={ability} />
          </button>
        )}
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

function SpellsPanel(props: {
  game: GameState;
  dispatch: (message: Message) => void;
}) {
  const getUnlocks = () => unlocksOf(playerOf(props.game));
  return (
    <>
      <p>
        <small>
          <Show
            when={getUnlocks() > 0}
            fallback="Gain a level to learn or raise a spell."
          >
            Choose {getUnlocks()} more: each level learns a spell or raises one,
            scaling its effect. Bind learned spells in Slots.
          </Show>
        </small>
      </p>
      <For each={SPELL_IDS}>
        {(spell) => {
          const getLevel = () => spellLevelOf(playerOf(props.game), spell);
          return (
            <button
              type="button"
              class="w-full text-left outline"
              classList={{ "opacity-40 grayscale": getUnlocks() === 0 }}
              onClick={() => props.dispatch({ kind: "learn", spell })}
            >
              <AbilityCard ability={spell}>
                {" "}
                · {getLevel() > 0 ? `Level ${getLevel()}` : "Unlearned"}
                <Show when={getUnlocks() > 0}> → Level {getLevel() + 1}</Show>
              </AbilityCard>
            </button>
          );
        }}
      </For>
    </>
  );
}

function InventoryPanel(props: {
  game: GameState;
  dispatch: (message: Message) => void;
}) {
  const getPlayer = () => playerOf(props.game);
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
      <details open>
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
        <Show when={getChest()}>
          <button
            type="button"
            onClick={() => props.dispatch({ kind: "take-all" })}
          >
            Take all
          </button>
        </Show>
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

function TradePanel(props: {
  game: GameState;
  trader: Creature & With<"wares" | "purse">;
  dispatch: (message: Message) => void;
}) {
  const getPlayer = () => playerOf(props.game);
  const trade = (item: Item) =>
    props.dispatch({ kind: "trade", trader: props.trader.id, item: item.id });

  function Deal(dealProps: {
    item: Item;
    icon: string;
    verb: string;
    price: number;
  }) {
    const label = () =>
      `${dealProps.verb} ${nameOf(dealProps.item)} for ${dealProps.price} gold`;
    return (
      <li>
        <span>
          {nameOf(dealProps.item)}
          <Show when={sizeOf(dealProps.item) > 0}>
            {" "}
            ({sizeOf(dealProps.item)})
          </Show>{" "}
          · {dealProps.price} gold
        </span>
        <HTMLIcon
          type={dealProps.icon}
          data-cap="end"
          aria-label={label()}
          title={label()}
          onClick={() => trade(dealProps.item)}
        />
      </li>
    );
  }

  return (
    <>
      <p>
        <small>Each trade spends a turn.</small>
      </p>
      <section>
        <h4>
          Pack {loadOf(getPlayer().pack)}/{capacityOf(getPlayer().equipment)} ·{" "}
          {getPlayer().gold} gold
        </h4>
        <ul class="max-h-[33vh] overflow-y-auto">
          <For each={getPlayer().pack}>
            {(item) => (
              <Deal
                item={item}
                icon="arrow_downward"
                verb="Sell"
                price={offerOf(item)}
              />
            )}
          </For>
        </ul>
      </section>
      <section>
        <h4>Wares · {props.trader.gold} gold</h4>
        <ul class="max-h-[33vh] overflow-y-auto">
          <For each={props.trader.wares}>
            {(item) => (
              <Deal
                item={item}
                icon="arrow_upward"
                verb="Buy"
                price={priceOf(item)}
              />
            )}
          </For>
        </ul>
      </section>
    </>
  );
}

function BountyPanel(props: { game: GameState }) {
  const getReward = () =>
    props.game.events.find((event) => event.kind === "rewarded");
  return (
    <>
      <Show when={getReward()}>
        {(reward) => <p>Well done. Here is {reward().gold} gold.</p>}
      </Show>
      <Show
        when={playerOf(props.game).bounty}
        fallback={<p>I have no work for you.</p>}
      >
        {(bounty) => (
          <p>
            Go and {bountyOf(bounty().kind, bounty().at)}, then return to me or
            any bailiff. You are at {placeOf(playerOf(props.game).at)}.
          </p>
        )}
      </Show>
    </>
  );
}

interface Start {
  readonly seed: number;
  readonly at: Hex;
}

/** Chooses a seed and a starting position, prefilled with the last used (else a random seed at the origin). */
function NewWorld(props: {
  initial: Start | undefined;
  start: (start: Start) => void;
  cancel: () => void;
}) {
  const [getSeed, setSeed] = createSignal(props.initial?.seed ?? randomSeed());
  const [getAt, setAt] = createSignal(props.initial?.at ?? { q: 0, r: 0 });

  function submit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const numberOf = (name: string) => Math.trunc(Number(form.get(name)));
    props.start({
      seed: numberOf("seed"),
      at: { q: numberOf("q"), r: numberOf("r") },
    });
  }

  return (
    <article>
      <header>
        <h3>New world</h3>
      </header>
      <form id="new-world" onSubmit={submit}>
        <label for="new-world-seed">Seed</label>
        <fieldset role="group">
          <input
            id="new-world-seed"
            type="number"
            name="seed"
            required
            value={getSeed()}
            onInput={(event) => setSeed(Number(event.currentTarget.value))}
          />
          <button
            type="button"
            class="secondary"
            onClick={() => setSeed(randomSeed())}
          >
            Random
          </button>
        </fieldset>
        <label for="new-world-q">Position (q, r)</label>
        <fieldset role="group">
          <input
            id="new-world-q"
            type="number"
            name="q"
            aria-label="q"
            required
            value={getAt().q}
            onInput={(event) =>
              setAt({ ...getAt(), q: Number(event.currentTarget.value) })
            }
          />
          <input
            type="number"
            name="r"
            aria-label="r"
            required
            value={getAt().r}
            onInput={(event) =>
              setAt({ ...getAt(), r: Number(event.currentTarget.value) })
            }
          />
          <button
            type="button"
            class="secondary"
            onClick={() => setAt(randomPosition())}
          >
            Random
          </button>
        </fieldset>
        <small>
          Starts on the nearest dry, treeless hex to the position. Monsters
          still grow stronger with distance from where the world begins.
        </small>
      </form>
      <footer>
        <button type="button" class="secondary" onClick={() => props.cancel()}>
          Cancel
        </button>
        <button type="submit" form="new-world">
          Start
        </button>
      </footer>
    </article>
  );
}

const hotkeyOf = (keymap: Keymap, id: ControlId) => keyLabelOf(keymap[id]);

const ABILITY_ICONS: Record<AbilityId, string> = {
  cleave: "swords",
  fireball: "local_fire_department",
  heal: "healing",
  strike: "bolt",
  health: "medication_liquid",
  mana: "science",
  "summon cubs": "pets",
  bleed: "water_drop",
  stun: "star",
  paralyze: "lock",
  restock: "inventory_2",
};

function AbilityIcon(props: { ability: AbilityId; cap?: "start" }) {
  return (
    <HTMLIcon
      type={ABILITY_ICONS[props.ability]}
      class="text-2xl"
      data-cap={props.cap}
    />
  );
}

/** An ability's list entry, its icon the left cap; `children` follow the name. */
function AbilityCard(props: { ability: AbilityId; children?: JSX.Element }) {
  return (
    <>
      <AbilityIcon ability={props.ability} cap="start" />
      <span>
        <strong>{abilityNameOf(props.ability)}</strong>
        {props.children}
        <br />
        <small>{abilityOf(props.ability).summary}</small>
        <br />
        <small>{costOf(props.ability)}</small>
      </span>
    </>
  );
}

function Menu(props: { unlocks: number; open: (item: MenuItem) => void }) {
  const [getDetails, setDetails] = createSignal<HTMLDetailsElement>();
  function choose(event: MouseEvent, item: MenuItem) {
    event.preventDefault();
    getDetails()?.removeAttribute("open");
    props.open(item);
  }
  return (
    <details ref={setDetails} class="dropdown">
      <summary>
        Menu
        <Show when={props.unlocks}>{(unlocks) => <> ({unlocks()})</>}</Show>
      </summary>
      <ul dir="rtl">
        <For each={MENU}>
          {(item) => (
            <li dir="ltr">
              <a href="#" onClick={(event) => choose(event, item)}>
                {item}
                <Show when={item === "Spells" && props.unlocks}>
                  {(unlocks) => <> ({unlocks()})</>}
                </Show>
              </a>
            </li>
          )}
        </For>
      </ul>
    </details>
  );
}

function Meter(props: {
  label: string;
  value: number;
  max: number;
  class?: string;
}) {
  return (
    <div class="flex items-center gap-(--pico-spacing)">
      <small class="whitespace-nowrap">
        {props.label} {props.value}/{props.max}
      </small>
      <progress
        class={`m-0 min-w-0 flex-1 ${props.class ?? ""}`}
        value={props.value}
        max={props.max}
      />
    </div>
  );
}

function Count(props: { children: JSX.Element }) {
  return <span class="absolute top-0.5 right-1 text-xs">{props.children}</span>;
}

function Hotkey(props: { children: string }) {
  return <span class="absolute top-0.5 left-1 text-xs">{props.children}</span>;
}

function PadButton(props: {
  control: ControlId;
  keymap: Keymap;
  press: (input: Input) => void;
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
      onClick={() => props.press(getControl().input)}
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
    <ul ref={setList} class="max-h-[60vh] overflow-y-auto">
      <For each={props.log}>{(event) => <li>{narrationOf(event)}</li>}</For>
    </ul>
  );
}

function SpeedControl(props: {
  speed: Speed;
  setSpeed: (speed: Speed) => void;
}) {
  return (
    <>
      <label for="speed">Ticks per second (0: turn-based)</label>
      <fieldset role="group">
        <input
          id="speed"
          type="number"
          min="0"
          step="any"
          value={props.speed.ticksPerSecond}
          onChange={(event) => {
            const ticksPerSecond = event.currentTarget.valueAsNumber;
            if (Number.isFinite(ticksPerSecond) && ticksPerSecond >= 0)
              props.setSpeed({ ...props.speed, ticksPerSecond });
          }}
        />
        <button
          type="button"
          aria-pressed={props.speed.isPaused}
          aria-label={props.speed.isPaused ? "Resume" : "Pause"}
          onClick={() =>
            props.setSpeed({ ...props.speed, isPaused: !props.speed.isPaused })
          }
        >
          <HTMLIcon type={props.speed.isPaused ? "play_arrow" : "pause"} />
        </button>
      </fieldset>
    </>
  );
}

function OtherPanel(props: {
  game: GameState;
  keymap: Keymap;
  speed: Speed;
  setSpeed: (speed: Speed) => void;
  remap: () => void;
  restart: () => void;
}) {
  const key = (id: ControlId) => <kbd>{hotkeyOf(props.keymap, id)}</kbd>;
  const getTile = () => props.game.land.tileAt(playerOf(props.game).at);
  return (
    <>
      <div class="flex flex-wrap gap-(--pico-spacing)">
        <button type="button" onClick={() => props.remap()}>
          Controls
        </button>
        <button type="button" onClick={() => props.restart()}>
          New world
        </button>
      </div>
      <SpeedControl speed={props.speed} setSpeed={props.setSpeed} />
      <details>
        <summary>Help</summary>
        <p>
          Face a direction, then step that way: tap toward it, use the buttons,
          or press {key("move-nw")} {key("move-n")} {key("move-ne")}{" "}
          {key("move-sw")} {key("move-s")} {key("move-se")}; wait with{" "}
          {key("wait")}. Bump monsters to attack, and their dens, camps,
          villages, mines and caves to wreck them until they heal. Press{" "}
          {key("target")} to cycle through monsters and townsfolk in view and
          see what each can see, even while aiming. Press {key("slot-1")}–
          {key("slot-6")} to cast the spell in that slot, or tap it; choose what
          each slot holds, spell or potion, in Slots (spends a turn); potions
          are drunk without spending a turn. Step onto a chest, open Pack, or
          press {key("inventory")}, to equip gear and move loot between your
          pack and the ground (each move spends a turn). Aimed spells move their
          reticle with the movement keys; cast with {key("confirm")} or the
          slot's key again, or cancel with {key("cancel")}. Slaying monsters
          earns experience; each level learns or raises a spell in Spells.
          Monsters grow stronger, and their tricks (summoning, bleeding,
          stunning, paralysis) worse, farther from where you set out. Climb one
          block at a time; swim freely. Set the speed above in ticks per second
          (0 is turn-based: a tick on each action that spends one), or pause; in
          real time, turn-spending actions queue (up to two) for the next tick,
          and {key("cancel")} drops the last one queued. Towns spawn a bailiff,
          a reeve and peasants, who fight monsters; bump one, or target one
          beside you and press
          {key("interact")}, to interact: a reeve trades, a bailiff posts
          bounties on ever-farther lairs.
        </p>
      </details>
      <details open>
        <summary>Debug</summary>
        <dl>
          <dt>Height</dt>
          <dd>{surfaceOf(getTile()) - SEA_LEVEL}</dd>
          <dt>Position</dt>
          <dd>
            {playerOf(props.game).at.q}, {playerOf(props.game).at.r}
          </dd>
          <dt>Seed</dt>
          <dd>{props.game.land.seed}</dd>
          <dt>Monsters awake</dt>
          <dd>{creaturesOf(props.game).length}</dd>
          <dt>Turn</dt>
          <dd>{props.game.turn}</dd>
          <dt>Monsters slain</dt>
          <dd>{playerOf(props.game).kills}</dd>
        </dl>
      </details>
    </>
  );
}
