import type {
  BattleReadyPokemonRecord,
  FloorLevel,
  MoveCategory,
  MoveId,
  MoveRecord,
  PokemonTypeId,
} from "../../types/pokechamp-data.ts";
import {
  describeTypeEffectiveness,
  getTypeEffectivenessMultiplier,
} from "../config/gameRules.ts";
import {
  createSeededRandom,
  type GeneratedBattlePokemon,
} from "./rulesSandbox.ts";

type BattleSide = "enemy" | "player";
type BattlePersistentStatus =
  | "burn"
  | "freeze"
  | "paralysis"
  | "poison"
  | "sleep";
type BattleStatId = Exclude<keyof BattleDerivedStats, "hp">;

const FALLBACK_MOVE_ID: MoveId = "__fallback-strike__";
const BURN_MOVE_IDS = new Set<MoveId>(["will-o-wisp"]);
const CONFUSION_MOVE_IDS = new Set<MoveId>([
  "confusion",
  "dizzy-punch",
  "dynamic-punch",
  "hurricane",
  "psybeam",
  "strange-steam",
  "water-pulse",
]);
const FREEZE_MOVE_IDS = new Set<MoveId>([
  "blizzard",
  "freeze-dry",
  "ice-beam",
  "ice-fang",
  "ice-punch",
  "powder-snow",
]);
const PARALYSIS_MOVE_IDS = new Set<MoveId>([
  "glare",
  "stun-spore",
  "thunder-wave",
]);
const POISON_MOVE_IDS = new Set<MoveId>(["poison-powder", "toxic"]);
const SEED_MOVE_IDS = new Set<MoveId>(["leech-seed"]);
const SLEEP_MOVE_IDS = new Set<MoveId>([
  "hypnosis",
  "sing",
  "sleep-powder",
  "spore",
]);
const YAWN_MOVE_IDS = new Set<MoveId>(["yawn"]);
const TRAP_MOVE_IDS = new Set<MoveId>([
  "bind",
  "clamp",
  "infestation",
  "sand-tomb",
  "whirlpool",
  "wrap",
]);
const SELF_TARGETING_MOVE_IDS = new Set<MoveId>([
  "agility",
  "amnesia",
  "bulk-up",
  "calm-mind",
  "coil",
  "dragon-dance",
  "harden",
  "heal-pulse",
  "hone-claws",
  "iron-defense",
  "milk-drink",
  "moonlight",
  "morning-sun",
  "nasty-plot",
  "protect",
  "purify",
  "quiver-dance",
  "recover",
  "roost",
  "shell-smash",
  "slack-off",
  "soft-boiled",
  "swords-dance",
  "synthesis",
  "work-up",
]);
const DREAM_EATER_MOVE_IDS = new Set<MoveId>(["dream-eater"]);
const DEFAULT_STATUS_DAMAGE_FRACTION = 0.125;
const DEFAULT_SEED_DAMAGE_FRACTION = 0.1;
const DEFAULT_CONFUSION_TURNS = 2;
const DEFAULT_FREEZE_TURNS = 1;
const DEFAULT_SLEEP_TURNS = 2;

interface BattleStatChangeRule {
  stages: number;
  stat: BattleStatId;
  target: "opponent" | "self";
}

const STAT_CHANGE_RULES: Partial<Record<MoveId, BattleStatChangeRule[]>> = {
  acid: [{ stages: -1, stat: "specialDefense", target: "opponent" }],
  "acid-spray": [{ stages: -2, stat: "specialDefense", target: "opponent" }],
  agility: [{ stages: 2, stat: "speed", target: "self" }],
  amnesia: [{ stages: 2, stat: "specialDefense", target: "self" }],
  "ancient-power": [
    { stages: 1, stat: "attack", target: "self" },
    { stages: 1, stat: "defense", target: "self" },
    { stages: 1, stat: "specialAttack", target: "self" },
    { stages: 1, stat: "specialDefense", target: "self" },
    { stages: 1, stat: "speed", target: "self" },
  ],
  "apple-acid": [{ stages: -1, stat: "specialDefense", target: "opponent" }],
  "armor-cannon": [
    { stages: -1, stat: "defense", target: "self" },
    { stages: -1, stat: "specialDefense", target: "self" },
  ],
  "aqua-step": [{ stages: 1, stat: "speed", target: "self" }],
  "aura-wheel": [{ stages: 1, stat: "speed", target: "self" }],
  "aurora-beam": [{ stages: -1, stat: "attack", target: "opponent" }],
  "breaking-swipe": [{ stages: -1, stat: "attack", target: "opponent" }],
  bubble: [{ stages: -1, stat: "speed", target: "opponent" }],
  "bubble-beam": [{ stages: -1, stat: "speed", target: "opponent" }],
  "bug-buzz": [{ stages: -1, stat: "specialDefense", target: "opponent" }],
  "bulk-up": [
    { stages: 1, stat: "attack", target: "self" },
    { stages: 1, stat: "defense", target: "self" },
  ],
  bulldoze: [{ stages: -1, stat: "speed", target: "opponent" }],
  "calm-mind": [
    { stages: 1, stat: "specialAttack", target: "self" },
    { stages: 1, stat: "specialDefense", target: "self" },
  ],
  "charge-beam": [{ stages: 1, stat: "specialAttack", target: "self" }],
  charm: [{ stages: -2, stat: "attack", target: "opponent" }],
  "clanging-scales": [{ stages: -1, stat: "defense", target: "self" }],
  "close-combat": [
    { stages: -1, stat: "defense", target: "self" },
    { stages: -1, stat: "specialDefense", target: "self" },
  ],
  coil: [
    { stages: 1, stat: "attack", target: "self" },
    { stages: 1, stat: "defense", target: "self" },
  ],
  crunch: [{ stages: -1, stat: "defense", target: "opponent" }],
  "crush-claw": [{ stages: -1, stat: "defense", target: "opponent" }],
  "dragon-dance": [
    { stages: 1, stat: "attack", target: "self" },
    { stages: 1, stat: "speed", target: "self" },
  ],
  "drum-beating": [{ stages: -1, stat: "speed", target: "opponent" }],
  "earth-power": [{ stages: -1, stat: "specialDefense", target: "opponent" }],
  "electro-shot": [{ stages: 1, stat: "specialAttack", target: "self" }],
  electroweb: [{ stages: -1, stat: "speed", target: "opponent" }],
  "energy-ball": [{ stages: -1, stat: "specialDefense", target: "opponent" }],
  "fake-tears": [{ stages: -2, stat: "specialDefense", target: "opponent" }],
  "feather-dance": [{ stages: -2, stat: "attack", target: "opponent" }],
  "fire-lash": [{ stages: -1, stat: "defense", target: "opponent" }],
  "flame-charge": [{ stages: 1, stat: "speed", target: "self" }],
  "flash-cannon": [{ stages: -1, stat: "specialDefense", target: "opponent" }],
  "grav-apple": [{ stages: -1, stat: "defense", target: "opponent" }],
  "hammer-arm": [{ stages: -1, stat: "speed", target: "self" }],
  harden: [{ stages: 1, stat: "defense", target: "self" }],
  "hone-claws": [{ stages: 1, stat: "attack", target: "self" }],
  "ice-hammer": [{ stages: -1, stat: "speed", target: "self" }],
  "icy-wind": [{ stages: -1, stat: "speed", target: "opponent" }],
  "iron-defense": [{ stages: 2, stat: "defense", target: "self" }],
  "iron-tail": [{ stages: -1, stat: "defense", target: "opponent" }],
  "leaf-storm": [{ stages: -2, stat: "specialAttack", target: "self" }],
  "leaf-tornado": [{ stages: -1, stat: "speed", target: "opponent" }],
  liquidation: [{ stages: -1, stat: "defense", target: "opponent" }],
  "low-sweep": [{ stages: -1, stat: "speed", target: "opponent" }],
  "lumina-crash": [{ stages: -2, stat: "specialDefense", target: "opponent" }],
  lunge: [{ stages: -1, stat: "attack", target: "opponent" }],
  "make-it-rain": [{ stages: -1, stat: "specialAttack", target: "self" }],
  "metal-claw": [{ stages: 1, stat: "attack", target: "self" }],
  "metal-sound": [{ stages: -2, stat: "specialDefense", target: "opponent" }],
  "meteor-mash": [{ stages: 1, stat: "attack", target: "self" }],
  moonblast: [{ stages: -1, stat: "specialAttack", target: "opponent" }],
  "mud-shot": [{ stages: -1, stat: "speed", target: "opponent" }],
  "mud-slap": [{ stages: -1, stat: "speed", target: "opponent" }],
  "muddy-water": [{ stages: -1, stat: "speed", target: "opponent" }],
  "mystical-fire": [{ stages: -1, stat: "specialAttack", target: "opponent" }],
  "nasty-plot": [{ stages: 2, stat: "specialAttack", target: "self" }],
  "night-daze": [{ stages: -1, stat: "speed", target: "opponent" }],
  octazooka: [{ stages: -1, stat: "speed", target: "opponent" }],
  overheat: [{ stages: -2, stat: "specialAttack", target: "self" }],
  "play-rough": [{ stages: -1, stat: "attack", target: "opponent" }],
  psychic: [{ stages: -1, stat: "specialDefense", target: "opponent" }],
  "quiver-dance": [
    { stages: 1, stat: "specialAttack", target: "self" },
    { stages: 1, stat: "specialDefense", target: "self" },
    { stages: 1, stat: "speed", target: "self" },
  ],
  "rapid-spin": [{ stages: 1, stat: "speed", target: "self" }],
  "razor-shell": [{ stages: -1, stat: "defense", target: "opponent" }],
  "rock-smash": [{ stages: -1, stat: "defense", target: "opponent" }],
  "rock-tomb": [{ stages: -1, stat: "speed", target: "opponent" }],
  screech: [{ stages: -2, stat: "defense", target: "opponent" }],
  "shadow-ball": [{ stages: -1, stat: "specialDefense", target: "opponent" }],
  "shadow-bone": [{ stages: -1, stat: "defense", target: "opponent" }],
  "shell-smash": [
    { stages: 2, stat: "attack", target: "self" },
    { stages: 2, stat: "specialAttack", target: "self" },
    { stages: 2, stat: "speed", target: "self" },
    { stages: -1, stat: "defense", target: "self" },
    { stages: -1, stat: "specialDefense", target: "self" },
  ],
  "silver-wind": [
    { stages: 1, stat: "attack", target: "self" },
    { stages: 1, stat: "defense", target: "self" },
    { stages: 1, stat: "specialAttack", target: "self" },
    { stages: 1, stat: "specialDefense", target: "self" },
    { stages: 1, stat: "speed", target: "self" },
  ],
  "skitter-smack": [{ stages: -1, stat: "specialAttack", target: "opponent" }],
  snarl: [{ stages: -1, stat: "specialAttack", target: "opponent" }],
  "spin-out": [{ stages: -2, stat: "speed", target: "self" }],
  "steel-wing": [{ stages: 1, stat: "defense", target: "self" }],
  "struggle-bug": [{ stages: -1, stat: "specialAttack", target: "opponent" }],
  superpower: [
    { stages: -1, stat: "attack", target: "self" },
    { stages: -1, stat: "defense", target: "self" },
  ],
  "swords-dance": [{ stages: 2, stat: "attack", target: "self" }],
  "syrup-bomb": [{ stages: -1, stat: "speed", target: "opponent" }],
  "trop-kick": [{ stages: -1, stat: "attack", target: "opponent" }],
  "work-up": [
    { stages: 1, stat: "attack", target: "self" },
    { stages: 1, stat: "specialAttack", target: "self" },
  ],
};

export const BATTLE_TURN_LIMIT = 12;

export type BattleOutcome = "enemy-win" | "player-win";

export interface BattleCombatantContext {
  generated: GeneratedBattlePokemon;
  moveRecords: MoveRecord[];
  record: BattleReadyPokemonRecord;
}

export interface BattleResolutionContext {
  floorLevel: FloorLevel;
  floorNumber: number;
  floorType: PokemonTypeId;
  playerName: string;
  runId: string;
  seed: string;
  usedSpeciesCount: number;
  enemy: BattleCombatantContext;
  player: BattleCombatantContext;
}

export interface BattleDerivedStats {
  attack: number;
  defense: number;
  hp: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface BattleStatStages {
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface BattlePersistentEffects {
  confusedTurnsRemaining: number;
  frozenTurnsRemaining: number;
  majorStatus: BattlePersistentStatus | null;
  seeded: boolean;
  sleepTurnsRemaining: number;
  yawnPending: boolean;
}

export interface BattleMovePlan {
  accuracy: number;
  category: MoveCategory;
  effectSummary: string | null;
  expectedDamage: number;
  estimatedHits: number;
  isFallback: boolean;
  moveId: string;
  moveName: string;
  power: number;
  priority: number;
  score: number;
  targetsSelf: boolean;
  typeEffectiveness: number;
  typeId: PokemonTypeId;
}

export interface BattleMoveChoice {
  disabledReason: string | null;
  isSelectable: boolean;
  plan: BattleMovePlan;
}

export interface BattleActionLog {
  actorSide: BattleSide;
  damage: number;
  hit: boolean;
  moveId: string;
  moveName: string;
  notes: string[];
  remainingHp: number;
  selfRemainingHp: number;
  skipped: boolean;
  targetsSelf: boolean;
  typeEffectiveness: number;
  usedFallback: boolean;
}

export interface BattleTurnLog {
  actions: BattleActionLog[];
  events: string[];
  turnNumber: number;
}

export interface BattleSessionState {
  enemyEffects: BattlePersistentEffects;
  enemyCurrentHp: number;
  enemyLastPlan: BattleMovePlan | null;
  enemyStats: BattleDerivedStats;
  enemyStatStages: BattleStatStages;
  outcome: BattleOutcome | null;
  playerEffects: BattlePersistentEffects;
  playerCurrentHp: number;
  playerLastPlan: BattleMovePlan | null;
  playerStats: BattleDerivedStats;
  playerStatStages: BattleStatStages;
  summary: string | null;
  turns: BattleTurnLog[];
  turnsResolved: number;
}

export interface BattleResolutionResult {
  enemyPlan: BattleMovePlan;
  enemyRemainingHp: number;
  enemyStats: BattleDerivedStats;
  outcome: BattleOutcome;
  playerPlan: BattleMovePlan;
  playerRemainingHp: number;
  playerStats: BattleDerivedStats;
  summary: string;
  turns: BattleTurnLog[];
  turnsResolved: number;
}

interface BattleSimulationState {
  effectsBySide: Record<BattleSide, BattlePersistentEffects>;
  hpBySide: Record<BattleSide, number>;
  plans: Record<BattleSide, BattleMovePlan>;
  protectedBySide: Record<BattleSide, boolean>;
  statStagesBySide: Record<BattleSide, BattleStatStages>;
  statsBySide: Record<BattleSide, BattleDerivedStats>;
  turnEvents: string[];
}

export function deriveBattleStats(
  record: BattleReadyPokemonRecord,
  level: number,
): BattleDerivedStats {
  return {
    hp: calculateHpStat(record.baseStats.hp, level),
    attack: calculateNonHpStat(record.baseStats.attack, level),
    defense: calculateNonHpStat(record.baseStats.defense, level),
    specialAttack: calculateNonHpStat(record.baseStats.specialAttack, level),
    specialDefense: calculateNonHpStat(record.baseStats.specialDefense, level),
    speed: calculateNonHpStat(record.baseStats.speed, level),
  };
}

export function createEmptyBattleEffects(): BattlePersistentEffects {
  return {
    confusedTurnsRemaining: 0,
    frozenTurnsRemaining: 0,
    majorStatus: null,
    seeded: false,
    sleepTurnsRemaining: 0,
    yawnPending: false,
  };
}

export function createEmptyBattleStatStages(): BattleStatStages {
  return {
    attack: 0,
    defense: 0,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0,
  };
}

function normalizeBattleEffects(
  effects: BattlePersistentEffects | null | undefined,
): BattlePersistentEffects {
  return {
    confusedTurnsRemaining: normalizePositiveInteger(
      effects?.confusedTurnsRemaining,
    ),
    frozenTurnsRemaining: normalizePositiveInteger(
      effects?.frozenTurnsRemaining,
    ),
    majorStatus: isBattlePersistentStatus(effects?.majorStatus)
      ? effects.majorStatus
      : null,
    seeded: Boolean(effects?.seeded),
    sleepTurnsRemaining: normalizePositiveInteger(effects?.sleepTurnsRemaining),
    yawnPending: Boolean(effects?.yawnPending),
  };
}

function normalizeBattleStatStages(
  stages: BattleStatStages | null | undefined,
): BattleStatStages {
  return {
    attack: normalizeStageValue(stages?.attack),
    defense: normalizeStageValue(stages?.defense),
    specialAttack: normalizeStageValue(stages?.specialAttack),
    specialDefense: normalizeStageValue(stages?.specialDefense),
    speed: normalizeStageValue(stages?.speed),
  };
}

function cloneBattleEffects(
  effects: BattlePersistentEffects | null | undefined,
): BattlePersistentEffects {
  return {
    ...normalizeBattleEffects(effects),
  };
}

function cloneBattleStatStages(
  stages: BattleStatStages | null | undefined,
): BattleStatStages {
  return {
    ...normalizeBattleStatStages(stages),
  };
}

export function normalizeBattleSessionState(
  state: BattleSessionState,
): BattleSessionState {
  return {
    ...state,
    enemyEffects: normalizeBattleEffects(state.enemyEffects),
    enemyStatStages: normalizeBattleStatStages(state.enemyStatStages),
    playerEffects: normalizeBattleEffects(state.playerEffects),
    playerStatStages: normalizeBattleStatStages(state.playerStatStages),
    turns: Array.isArray(state.turns)
      ? state.turns.map((turn) => ({
          ...turn,
          actions: Array.isArray(turn.actions)
            ? turn.actions.map((action) => ({
                ...action,
                notes: Array.isArray(action.notes) ? action.notes : [],
                selfRemainingHp:
                  typeof action.selfRemainingHp === "number"
                    ? action.selfRemainingHp
                    : 0,
                skipped: typeof action.skipped === "boolean" ? action.skipped : false,
                targetsSelf:
                  typeof action.targetsSelf === "boolean"
                    ? action.targetsSelf
                    : false,
              }))
            : [],
          events: Array.isArray(turn.events) ? turn.events : [],
        }))
      : [],
  };
}

export function createBattleSession(
  context: BattleResolutionContext,
): BattleSessionState {
  const playerStats = deriveBattleStats(
    context.player.record,
    context.player.generated.level,
  );
  const enemyStats = deriveBattleStats(
    context.enemy.record,
    context.enemy.generated.level,
  );

  return {
    enemyEffects: createEmptyBattleEffects(),
    enemyCurrentHp: enemyStats.hp,
    enemyLastPlan: null,
    enemyStats,
    enemyStatStages: createEmptyBattleStatStages(),
    outcome: null,
    playerEffects: createEmptyBattleEffects(),
    playerCurrentHp: playerStats.hp,
    playerLastPlan: null,
    playerStats,
    playerStatStages: createEmptyBattleStatStages(),
    summary: null,
    turns: [],
    turnsResolved: 0,
  };
}

export function buildBattleMoveChoices(options: {
  attacker: BattleCombatantContext;
  attackerCurrentHp?: number;
  attackerEffects?: BattlePersistentEffects;
  attackerStats: BattleDerivedStats;
  attackerStatStages?: BattleStatStages;
  defender: BattleCombatantContext;
  defenderCurrentHp?: number;
  defenderEffects?: BattlePersistentEffects;
  defenderStats: BattleDerivedStats;
  defenderStatStages?: BattleStatStages;
}): BattleMoveChoice[] {
  const choices = options.attacker.moveRecords.map((move) => {
    if (!move.allowedInGame) {
      return {
        disabledReason: "This move is excluded from the current prototype ruleset.",
        isSelectable: false,
        plan: toDisabledBattleMovePlan(move),
      };
    }

    return {
      disabledReason: null,
      isSelectable: true,
      plan: toBattleMovePlan({
        attacker: options.attacker,
        attackerCurrentHp:
          options.attackerCurrentHp ?? options.attackerStats.hp,
        attackerEffects: options.attackerEffects,
        attackerStats: options.attackerStats,
        attackerStatStages: options.attackerStatStages,
        defender: options.defender,
        defenderCurrentHp:
          options.defenderCurrentHp ?? options.defenderStats.hp,
        defenderEffects: options.defenderEffects,
        defenderStats: options.defenderStats,
        defenderStatStages: options.defenderStatStages,
        move,
      }),
    };
  });

  if (choices.some((choice) => choice.isSelectable)) {
    return choices;
  }

  return [
    ...choices,
    {
      disabledReason: null,
      isSelectable: true,
      plan: buildFallbackMovePlan(
        options.attacker,
        options.attackerStats,
        options.defender,
      ),
    },
  ];
}

export function selectBattleMove(options: {
  attacker: BattleCombatantContext;
  attackerCurrentHp?: number;
  attackerEffects?: BattlePersistentEffects;
  attackerStats: BattleDerivedStats;
  attackerStatStages?: BattleStatStages;
  defender: BattleCombatantContext;
  defenderCurrentHp?: number;
  defenderEffects?: BattlePersistentEffects;
  defenderStats: BattleDerivedStats;
  defenderStatStages?: BattleStatStages;
}): BattleMovePlan {
  const selectableChoices = buildBattleMoveChoices(options).filter(
    (choice) => choice.isSelectable,
  );
  let bestPlan = selectableChoices[0]?.plan ?? null;

  for (const choice of selectableChoices) {
    if (!bestPlan || choice.plan.score > bestPlan.score) {
      bestPlan = choice.plan;
    }
  }

  if (!bestPlan) {
    return buildFallbackMovePlan(
      options.attacker,
      options.attackerStats,
      options.defender,
    );
  }

  return bestPlan;
}

export function resolveBattleTurn(options: {
  context: BattleResolutionContext;
  playerMoveId: string;
  state: BattleSessionState;
}): BattleSessionState {
  if (options.state.outcome) {
    throw new Error("Cannot resolve another turn after the battle ends");
  }

  const playerPlan = resolveSelectedPlayerPlan({
    context: options.context,
    state: options.state,
    playerMoveId: options.playerMoveId,
  });
  const enemyPlan = selectBattleMove({
    attacker: options.context.enemy,
    attackerCurrentHp: options.state.enemyCurrentHp,
    attackerEffects: options.state.enemyEffects,
    attackerStats: options.state.enemyStats,
    attackerStatStages: options.state.enemyStatStages,
    defender: options.context.player,
    defenderCurrentHp: options.state.playerCurrentHp,
    defenderEffects: options.state.playerEffects,
    defenderStats: options.state.playerStats,
    defenderStatStages: options.state.playerStatStages,
  });
  const turnNumber = options.state.turnsResolved + 1;
  const simulationState: BattleSimulationState = {
    effectsBySide: {
      player: cloneBattleEffects(options.state.playerEffects),
      enemy: cloneBattleEffects(options.state.enemyEffects),
    },
    hpBySide: {
      player: options.state.playerCurrentHp,
      enemy: options.state.enemyCurrentHp,
    },
    plans: {
      player: playerPlan,
      enemy: enemyPlan,
    },
    protectedBySide: {
      player: false,
      enemy: false,
    },
    statStagesBySide: {
      player: cloneBattleStatStages(options.state.playerStatStages),
      enemy: cloneBattleStatStages(options.state.enemyStatStages),
    },
    statsBySide: {
      player: options.state.playerStats,
      enemy: options.state.enemyStats,
    },
    turnEvents: [],
  };
  const actions = simulateTurn(
    turnNumber,
    options.context,
    simulationState,
    createSeededRandom(`${options.context.seed}:turn-${turnNumber}:order`).next(),
  );
  const outcome =
    simulationState.hpBySide.player === 0 ||
    simulationState.hpBySide.enemy === 0 ||
    turnNumber >= BATTLE_TURN_LIMIT
      ? determineOutcome(options.context, simulationState)
      : null;

  return {
    enemyCurrentHp: simulationState.hpBySide.enemy,
    enemyEffects: cloneBattleEffects(simulationState.effectsBySide.enemy),
    enemyLastPlan: enemyPlan,
    enemyStats: options.state.enemyStats,
    enemyStatStages: cloneBattleStatStages(simulationState.statStagesBySide.enemy),
    outcome,
    playerEffects: cloneBattleEffects(simulationState.effectsBySide.player),
    playerCurrentHp: simulationState.hpBySide.player,
    playerLastPlan: playerPlan,
    playerStats: options.state.playerStats,
    playerStatStages: cloneBattleStatStages(
      simulationState.statStagesBySide.player,
    ),
    summary: outcome
      ? buildBattleSummary({
          context: options.context,
          outcome,
          simulationState,
          turnsResolved: turnNumber,
        })
      : null,
    turns: [
      ...options.state.turns,
      {
        actions,
        events: simulationState.turnEvents ?? [],
        turnNumber,
      },
    ],
    turnsResolved: turnNumber,
  };
}

export function resolveBattle(
  context: BattleResolutionContext,
): BattleResolutionResult {
  let state = createBattleSession(context);

  while (!state.outcome) {
    const playerPlan = selectBattleMove({
      attacker: context.player,
      attackerCurrentHp: state.playerCurrentHp,
      attackerEffects: state.playerEffects,
      attackerStats: state.playerStats,
      attackerStatStages: state.playerStatStages,
      defender: context.enemy,
      defenderCurrentHp: state.enemyCurrentHp,
      defenderEffects: state.enemyEffects,
      defenderStats: state.enemyStats,
      defenderStatStages: state.enemyStatStages,
    });

    state = resolveBattleTurn({
      context,
      playerMoveId: playerPlan.moveId,
      state,
    });
  }

  if (
    !state.outcome ||
    !state.summary ||
    !state.playerLastPlan ||
    !state.enemyLastPlan
  ) {
    throw new Error("Expected a completed battle result");
  }

  return {
    enemyPlan: state.enemyLastPlan,
    enemyRemainingHp: state.enemyCurrentHp,
    enemyStats: state.enemyStats,
    outcome: state.outcome,
    playerPlan: state.playerLastPlan,
    playerRemainingHp: state.playerCurrentHp,
    playerStats: state.playerStats,
    summary: state.summary,
    turns: state.turns,
    turnsResolved: state.turnsResolved,
  };
}

function buildBattleSummary(options: {
  context: BattleResolutionContext;
  outcome: BattleOutcome;
  simulationState: BattleSimulationState;
  turnsResolved: number;
}): string {
  const didKnockOut =
    options.simulationState.hpBySide.player === 0 ||
    options.simulationState.hpBySide.enemy === 0;

  if (options.outcome === "player-win") {
    return didKnockOut
      ? `${options.context.player.generated.name} knocks out ${options.context.enemy.generated.name} in ${options.turnsResolved} turns.`
      : `${options.context.player.generated.name} wins the simplified decision after ${options.turnsResolved} turns.`;
  }

  return didKnockOut
    ? `${options.context.enemy.generated.name} knocks out ${options.context.player.generated.name} in ${options.turnsResolved} turns.`
    : `${options.context.enemy.generated.name} wins the simplified decision after ${options.turnsResolved} turns.`;
}

function buildFallbackMovePlan(
  attacker: BattleCombatantContext,
  attackerStats: BattleDerivedStats,
  defender: BattleCombatantContext,
): BattleMovePlan {
  const category: MoveCategory =
    attackerStats.attack >= attackerStats.specialAttack ? "physical" : "special";
  const typeId = attacker.generated.types[0];
  const power = 40;
  const accuracy = 100;
  const typeEffectiveness = getTypeEffectivenessMultiplier(
    typeId,
    defender.generated.types,
  );

  return {
    accuracy,
    category,
    effectSummary: "Fallback strike covers unsupported move pools.",
    expectedDamage:
      typeEffectiveness === 0
        ? 0
        : Math.max(
            1,
            Math.floor(
              ((category === "physical" ? attackerStats.attack : attackerStats.specialAttack) /
                4) *
                typeEffectiveness,
            ),
          ),
    estimatedHits: 1,
    isFallback: true,
    moveId: FALLBACK_MOVE_ID,
    moveName: "Fallback Strike",
    power,
    priority: 0,
    score: typeEffectiveness === 0 ? -20 : power * typeEffectiveness,
    targetsSelf: false,
    typeEffectiveness,
    typeId,
  };
}

function calculateExpectedDamage(options: {
  accuracy: number;
  attackerStats: BattleDerivedStats;
  category: MoveCategory;
  defenderStats: BattleDerivedStats;
  estimatedHits?: number;
  level: number;
  power: number;
  stab: number;
  typeEffectiveness: number;
}): number {
  if (options.typeEffectiveness === 0) {
    return 0;
  }

  const attackStat =
    options.category === "physical"
      ? options.attackerStats.attack
      : options.attackerStats.specialAttack;
  const defenseStat =
    options.category === "physical"
      ? options.defenderStats.defense
      : options.defenderStats.specialDefense;
  const scaledDamage = calculateDamage({
    accuracy: 100,
    attackStat,
    defenseStat,
    level: options.level,
    power: options.power,
    stab: options.stab,
    typeEffectiveness: options.typeEffectiveness,
  });

  return Math.max(
    1,
    Math.floor(
      (scaledDamage * Math.max(1, options.estimatedHits ?? 1) * options.accuracy) / 100,
    ),
  );
}

function calculateDamage(options: {
  accuracy: number;
  attackStat: number;
  defenseStat: number;
  level: number;
  power: number;
  stab: number;
  typeEffectiveness: number;
}): number {
  if (options.typeEffectiveness === 0) {
    return 0;
  }

  const levelFactor = Math.floor((2 * options.level) / 5) + 2;
  const baseDamage =
    Math.floor(
      (levelFactor * Math.max(1, options.power) * options.attackStat) /
        Math.max(1, options.defenseStat) /
        50,
    ) + 2;
  const stabDamage = Math.floor(baseDamage * options.stab);
  const effectivenessAdjustedDamage = stabDamage * options.typeEffectiveness;
  const accuracyAdjustedDamage = Math.max(
    1,
    Math.floor((effectivenessAdjustedDamage * options.accuracy) / 100),
  );

  return accuracyAdjustedDamage;
}

function calculateHpStat(baseStat: number, level: number): number {
  return Math.floor((2 * baseStat * level) / 100) + level + 10;
}

function calculateNonHpStat(baseStat: number, level: number): number {
  return Math.floor((2 * baseStat * level) / 100) + 5;
}

function determineOutcome(
  context: BattleResolutionContext,
  simulationState: BattleSimulationState,
): BattleOutcome {
  if (
    simulationState.hpBySide.player > 0 &&
    simulationState.hpBySide.enemy === 0
  ) {
    return "player-win";
  }

  if (
    simulationState.hpBySide.enemy > 0 &&
    simulationState.hpBySide.player === 0
  ) {
    return "enemy-win";
  }

  const playerHpRatio =
    simulationState.hpBySide.player / simulationState.statsBySide.player.hp;
  const enemyHpRatio =
    simulationState.hpBySide.enemy / simulationState.statsBySide.enemy.hp;

  if (playerHpRatio !== enemyHpRatio) {
    return playerHpRatio > enemyHpRatio ? "player-win" : "enemy-win";
  }

  if (simulationState.hpBySide.player !== simulationState.hpBySide.enemy) {
    return simulationState.hpBySide.player > simulationState.hpBySide.enemy
      ? "player-win"
      : "enemy-win";
  }

  const playerScore = simulationState.plans.player.score;
  const enemyScore = simulationState.plans.enemy.score;

  if (playerScore !== enemyScore) {
    return playerScore > enemyScore ? "player-win" : "enemy-win";
  }

  const tieBreaker = createSeededRandom(`${context.seed}:sudden-death`).next();

  return tieBreaker >= 0.5 ? "player-win" : "enemy-win";
}

function resolveMoveExecution(options: {
  attacker: BattleCombatantContext;
  attackerSide: BattleSide;
  attackerStats: BattleDerivedStats;
  defender: BattleCombatantContext;
  defenderSide: BattleSide;
  defenderStats: BattleDerivedStats;
  level: number;
  movePlan: BattleMovePlan;
  simulationState: BattleSimulationState;
  turnSeed: string;
}): BattleActionLog {
  const notes: string[] = [];
  const actionRandom = createSeededRandom(options.turnSeed);
  const attackerEffects =
    options.simulationState.effectsBySide[options.attackerSide];
  const defenderEffects =
    options.simulationState.effectsBySide[options.defenderSide];
  const attackerStatStages =
    options.simulationState.statStagesBySide[options.attackerSide];
  const defenderStatStages =
    options.simulationState.statStagesBySide[options.defenderSide];
  const moveRecord = resolveMoveRecord(
    options.attacker,
    options.movePlan.moveId,
    options.movePlan,
  );
  const actualMoveRecord = moveRecord ?? createFallbackMoveRecord(options.movePlan);
  const actorName = options.attacker.generated.name;
  const defenderName = options.defender.generated.name;
  const isDamagingMove = !options.movePlan.targetsSelf && options.movePlan.power > 0;
  const startOfTurnResult = resolveStartOfTurnSkip({
    actionRandom,
    actorName,
    effects: attackerEffects,
    maxHp: options.attackerStats.hp,
  });

  if (startOfTurnResult.selfDamage > 0) {
    const selfDamage = Math.min(
      options.simulationState.hpBySide[options.attackerSide],
      startOfTurnResult.selfDamage,
    );

    options.simulationState.hpBySide[options.attackerSide] -= selfDamage;
    notes.push(`${actorName} took ${selfDamage} self-hit damage.`);
  }

  if (startOfTurnResult.skipReason) {
    notes.push(startOfTurnResult.skipReason);

    return {
      actorSide: options.attackerSide,
      damage: 0,
      hit: startOfTurnResult.selfDamage > 0,
      moveId: options.movePlan.moveId,
      moveName: options.movePlan.moveName,
      notes,
      remainingHp:
        options.simulationState.hpBySide[
          options.movePlan.targetsSelf ? options.attackerSide : options.defenderSide
        ],
      selfRemainingHp: options.simulationState.hpBySide[options.attackerSide],
      skipped: true,
      targetsSelf: options.movePlan.targetsSelf,
      typeEffectiveness: options.movePlan.typeEffectiveness,
      usedFallback: options.movePlan.isFallback,
    };
  }

  const hitRoll = Math.floor(actionRandom.next() * 100) + 1;
  const hit = hitRoll <= options.movePlan.accuracy;
  let damage = 0;

  if (!hit) {
    notes.push(`${options.movePlan.moveName} missed.`);
  } else if (actualMoveRecord.effectTag === "protect" && options.movePlan.targetsSelf) {
    options.simulationState.protectedBySide[options.attackerSide] = true;
    notes.push(`${actorName} braced behind Protect.`);
  } else if (
    !options.movePlan.targetsSelf &&
      options.simulationState.protectedBySide[options.defenderSide]
  ) {
    notes.push(`${defenderName} blocked the move with Protect.`);
  } else {
    const requiresSleepingTarget = DREAM_EATER_MOVE_IDS.has(actualMoveRecord.moveId);

    if (requiresSleepingTarget && defenderEffects.majorStatus !== "sleep") {
      notes.push(`${actualMoveRecord.name} only works on a sleeping target.`);

      return {
        actorSide: options.attackerSide,
        damage: 0,
        hit: true,
        moveId: options.movePlan.moveId,
        moveName: options.movePlan.moveName,
        notes,
        remainingHp: options.simulationState.hpBySide[options.defenderSide],
        selfRemainingHp: options.simulationState.hpBySide[options.attackerSide],
        skipped: false,
        targetsSelf: options.movePlan.targetsSelf,
        typeEffectiveness: options.movePlan.typeEffectiveness,
        usedFallback: options.movePlan.isFallback,
      };
    }

    const attackerModifiedStats = getModifiedBattleStats(
      options.attackerStats,
      attackerEffects,
      attackerStatStages,
    );
    const defenderModifiedStats = getModifiedBattleStats(
      options.defenderStats,
      defenderEffects,
      defenderStatStages,
    );

    if (isDamagingMove) {
      const hitCount = resolveActualHitCount(actualMoveRecord, actionRandom.next());

      if (hitCount > 1) {
        notes.push(`It hit ${hitCount} times.`);
      }

      damage =
        calculateDamage({
          accuracy: options.movePlan.accuracy,
          attackStat:
            options.movePlan.category === "physical"
              ? attackerModifiedStats.attack
              : attackerModifiedStats.specialAttack,
          defenseStat:
            options.movePlan.category === "physical"
              ? defenderModifiedStats.defense
              : defenderModifiedStats.specialDefense,
          level: options.level,
          power: options.movePlan.power,
          stab: options.attacker.generated.types.includes(options.movePlan.typeId)
            ? 1.2
            : 1,
          typeEffectiveness: options.movePlan.typeEffectiveness,
        }) * hitCount;
      options.simulationState.hpBySide[options.defenderSide] = Math.max(
        0,
        options.simulationState.hpBySide[options.defenderSide] - damage,
      );

      if (damage > 0 && actualMoveRecord.effectTag === "drain") {
        const healed = healBattleSide(
          options.simulationState,
          options.attackerSide,
          calculateScaledAmount(damage, Math.max(0, getMoveDrainRatio(actualMoveRecord))),
        );

        if (healed > 0) {
          notes.push(`${actorName} recovered ${healed} HP from the hit.`);
        }
      }

      if (damage > 0 && actualMoveRecord.effectTag === "recoil") {
        const recoil = Math.min(
          options.simulationState.hpBySide[options.attackerSide],
          calculateScaledAmount(
            damage,
            Math.abs(Math.min(0, getMoveDrainRatio(actualMoveRecord))),
          ),
        );

        if (recoil > 0) {
          options.simulationState.hpBySide[options.attackerSide] = Math.max(
            0,
            options.simulationState.hpBySide[options.attackerSide] - recoil,
          );
          notes.push(`${actorName} took ${recoil} recoil damage.`);
        }
      }
    }

    if (actualMoveRecord.effectTag === "heal") {
      const healingRatio =
        actualMoveRecord.moveId === "rest"
          ? 1
          : getMoveHealingRatio(actualMoveRecord);
      const healed = healBattleSide(
        options.simulationState,
        options.attackerSide,
        calculateScaledAmount(
          options.attackerStats.hp,
          healingRatio,
        ),
      );

      notes.push(
        healed > 0
          ? `${actorName} restored ${healed} HP.`
          : `${actorName} was already at full HP.`,
      );

      if (actualMoveRecord.moveId === "rest") {
        attackerEffects.majorStatus = "sleep";
        attackerEffects.sleepTurnsRemaining = DEFAULT_SLEEP_TURNS;
        attackerEffects.frozenTurnsRemaining = 0;
        notes.push(`${actorName} fell asleep after resting.`);
      }
    }

    const canApplyFollowUpEffects =
      actualMoveRecord.effectTag !== "protect" &&
      (actualMoveRecord.power <= 0 ||
        options.movePlan.targetsSelf ||
        damage > 0 ||
        actualMoveRecord.effectTag === "stat-boost");

    if (canApplyFollowUpEffects) {
      applyBattleMoveStatusEffects({
        actionRandom,
        defenderName,
        defenderSide: options.defenderSide,
        move: actualMoveRecord,
        notes,
        simulationState: options.simulationState,
      });
      applyBattleMoveStatChanges({
        actionRandom,
        attackerName: actorName,
        attackerSide: options.attackerSide,
        defenderName,
        defenderSide: options.defenderSide,
        move: actualMoveRecord,
        notes,
        simulationState: options.simulationState,
      });
    }
  }

  return {
    actorSide: options.attackerSide,
    damage,
    hit,
    moveId: options.movePlan.moveId,
    moveName: options.movePlan.moveName,
    notes,
    remainingHp:
      options.simulationState.hpBySide[
        options.movePlan.targetsSelf ? options.attackerSide : options.defenderSide
      ],
    selfRemainingHp: options.simulationState.hpBySide[options.attackerSide],
    skipped: false,
    targetsSelf: options.movePlan.targetsSelf,
    typeEffectiveness: options.movePlan.typeEffectiveness,
    usedFallback: options.movePlan.isFallback,
  };
}

function resolveSelectedPlayerPlan(options: {
  context: BattleResolutionContext;
  playerMoveId: string;
  state: BattleSessionState;
}): BattleMovePlan {
  const moveChoice = buildBattleMoveChoices({
    attacker: options.context.player,
    attackerCurrentHp: options.state.playerCurrentHp,
    attackerEffects: options.state.playerEffects,
    attackerStats: options.state.playerStats,
    attackerStatStages: options.state.playerStatStages,
    defender: options.context.enemy,
    defenderCurrentHp: options.state.enemyCurrentHp,
    defenderEffects: options.state.enemyEffects,
    defenderStats: options.state.enemyStats,
    defenderStatStages: options.state.enemyStatStages,
  }).find((choice) => choice.plan.moveId === options.playerMoveId);

  if (!moveChoice) {
    throw new Error(`Unknown player move choice "${options.playerMoveId}"`);
  }

  if (!moveChoice.isSelectable) {
    throw new Error(
      `Move "${moveChoice.plan.moveName}" is currently disabled in the battle prototype`,
    );
  }

  return moveChoice.plan;
}

function simulateTurn(
  turnNumber: number,
  context: BattleResolutionContext,
  simulationState: BattleSimulationState,
  tieBreakerRoll: number,
): BattleActionLog[] {
  const turnSeedBase = `${context.seed}:turn-${turnNumber}`;
  const firstActorSide = pickFirstActorSide(
    simulationState.plans,
    simulationState,
    tieBreakerRoll,
  );
  const secondActorSide = firstActorSide === "player" ? "enemy" : "player";
  const orderedSides: BattleSide[] = [firstActorSide, secondActorSide];
  const combatants = {
    player: context.player,
    enemy: context.enemy,
  } as const;
  const turnActions: BattleActionLog[] = [];

  for (const side of orderedSides) {
    const targetSide = side === "player" ? "enemy" : "player";

    if (
      simulationState.hpBySide[side] === 0 ||
      simulationState.hpBySide[targetSide] === 0
    ) {
      continue;
    }

    const action = resolveMoveExecution({
      attacker: combatants[side],
      attackerSide: side,
      attackerStats: simulationState.statsBySide[side],
      defender: combatants[targetSide],
      defenderSide: targetSide,
      defenderStats: simulationState.statsBySide[targetSide],
      level: combatants[side].generated.level,
      movePlan: simulationState.plans[side],
      simulationState,
      turnSeed: `${turnSeedBase}:${side}`,
    });

    turnActions.push(action);
  }

  resolveEndOfTurnEffects(context, simulationState);

  return turnActions;
}

function pickFirstActorSide(
  plans: Record<BattleSide, BattleMovePlan>,
  simulationState: BattleSimulationState,
  tieBreakerRoll: number,
): BattleSide {
  if (plans.player.priority !== plans.enemy.priority) {
    return plans.player.priority > plans.enemy.priority ? "player" : "enemy";
  }

  const playerSpeed = getModifiedBattleStats(
    simulationState.statsBySide.player,
    simulationState.effectsBySide.player,
    simulationState.statStagesBySide.player,
  ).speed;
  const enemySpeed = getModifiedBattleStats(
    simulationState.statsBySide.enemy,
    simulationState.effectsBySide.enemy,
    simulationState.statStagesBySide.enemy,
  ).speed;

  if (playerSpeed !== enemySpeed) {
    return playerSpeed > enemySpeed ? "player" : "enemy";
  }

  return tieBreakerRoll >= 0.5 ? "player" : "enemy";
}

function toBattleMovePlan(options: {
  attacker: BattleCombatantContext;
  attackerCurrentHp: number;
  attackerEffects?: BattlePersistentEffects;
  attackerStats: BattleDerivedStats;
  attackerStatStages?: BattleStatStages;
  defender: BattleCombatantContext;
  defenderCurrentHp: number;
  defenderEffects?: BattlePersistentEffects;
  defenderStats: BattleDerivedStats;
  defenderStatStages?: BattleStatStages;
  move: MoveRecord;
}): BattleMovePlan {
  const attackerEffects = normalizeBattleEffects(options.attackerEffects);
  const defenderEffects = normalizeBattleEffects(options.defenderEffects);
  const attackerStatStages = normalizeBattleStatStages(options.attackerStatStages);
  const defenderStatStages = normalizeBattleStatStages(options.defenderStatStages);
  const targetsSelf = shouldMoveTargetSelf(options.move);
  const accuracy = normalizeMoveAccuracy(options.move.accuracy);
  const stab =
    options.move.power > 0 &&
    options.attacker.generated.types.includes(options.move.type)
      ? 1.2
      : 1;
  const typeEffectiveness =
    options.move.power > 0 && !targetsSelf
      ? getTypeEffectivenessMultiplier(
          options.move.type,
          options.defender.generated.types,
        )
      : 1;
  const estimatedHits = getMoveEstimatedHits(options.move);
  const expectedDamage = calculateExpectedDamage({
    accuracy,
    attackerStats: getModifiedBattleStats(
      options.attackerStats,
      attackerEffects,
      attackerStatStages,
    ),
    category: options.move.category,
    defenderStats: getModifiedBattleStats(
      options.defenderStats,
      defenderEffects,
      defenderStatStages,
    ),
    estimatedHits,
    level: options.attacker.generated.level,
    power: options.move.power,
    stab,
    typeEffectiveness,
  });
  const effectSummary = buildMoveEffectSummary(options.move, estimatedHits);

  return {
    accuracy,
    category: options.move.category,
    effectSummary,
    expectedDamage,
    estimatedHits,
    isFallback: false,
    moveId: options.move.moveId,
    moveName: options.move.name,
    power: options.move.power,
    priority: options.move.priority,
    score: buildMoveScore({
      attackerCurrentHp: options.attackerCurrentHp,
      attackerEffects,
      attackerStats: options.attackerStats,
      attackerStatStages,
      defenderCurrentHp: options.defenderCurrentHp,
      defenderEffects,
      defenderStats: options.defenderStats,
      defenderStatStages,
      estimatedHits,
      expectedDamage,
      move: options.move,
      stab,
      targetsSelf,
      typeEffectiveness,
    }),
    targetsSelf,
    typeEffectiveness,
    typeId: options.move.type,
  };
}

function toDisabledBattleMovePlan(move: MoveRecord): BattleMovePlan {
  return {
    accuracy: normalizeMoveAccuracy(move.accuracy),
    category: move.category,
    effectSummary: "This move is outside the current battle ruleset.",
    expectedDamage: 0,
    estimatedHits: 1,
    isFallback: false,
    moveId: move.moveId,
    moveName: move.name,
    power: move.power,
    priority: move.priority,
    score: 0,
    targetsSelf: shouldMoveTargetSelf(move),
    typeEffectiveness: 1,
    typeId: move.type,
  };
}

function normalizeMoveAccuracy(accuracy: number): number {
  return accuracy > 0 ? accuracy : 100;
}

function buildEffectBonus(move: MoveRecord): number {
  switch (move.effectTag) {
    case "priority":
      return 5;
    case "drain":
      return 3;
    case "heal":
      return 2;
    case "multi-hit":
      return 3;
    case "recoil":
      return -2;
    case "stat-boost":
    case "stat-drop":
    case "status-apply":
      return 2;
    case "protect":
      return 1;
    default:
      return 0;
  }
}

function buildMoveScore(options: {
  attackerCurrentHp: number;
  attackerEffects: BattlePersistentEffects;
  attackerStats: BattleDerivedStats;
  attackerStatStages: BattleStatStages;
  defenderCurrentHp: number;
  defenderEffects: BattlePersistentEffects;
  defenderStats: BattleDerivedStats;
  defenderStatStages: BattleStatStages;
  estimatedHits: number;
  expectedDamage: number;
  move: MoveRecord;
  stab: number;
  targetsSelf: boolean;
  typeEffectiveness: number;
}): number {
  let score =
    options.expectedDamage +
    options.move.priority * 6 +
    buildEffectBonus(options.move) +
    (options.move.power > 0 && options.stab > 1 ? 4 : 0) +
    (options.move.power > 0 && !options.targetsSelf
      ? getTypeEffectivenessScoreBonus(options.typeEffectiveness)
      : 0);

  if (options.move.effectTag === "heal") {
    const missingHp = Math.max(0, options.attackerStats.hp - options.attackerCurrentHp);
    const healingRatio =
      options.move.moveId === "rest" ? 1 : getMoveHealingRatio(options.move);
    const sleepPenalty = options.move.moveId === "rest" ? 18 : 0;

    score +=
      missingHp === 0
        ? -10 - sleepPenalty
        : Math.floor(
            Math.min(
              missingHp,
              calculateScaledAmount(
                options.attackerStats.hp,
                healingRatio,
              ),
            ) *
              (options.attackerCurrentHp / options.attackerStats.hp < 0.4 ? 0.9 : 0.55),
          ) - sleepPenalty;
  }

  if (options.move.effectTag === "protect") {
    const hpRatio = options.attackerCurrentHp / options.attackerStats.hp;

    score += hpRatio < 0.35 ? 18 : hpRatio < 0.6 ? 9 : 3;
  }

  if (options.move.effectTag === "drain") {
    score += Math.floor(
      options.expectedDamage * Math.max(0, getMoveDrainRatio(options.move)) * 0.5,
    );

    if (
      DREAM_EATER_MOVE_IDS.has(options.move.moveId) &&
      options.defenderEffects.majorStatus !== "sleep"
    ) {
      score -= 80;
    }
  }

  if (options.move.effectTag === "recoil") {
    score -= Math.floor(
      options.expectedDamage *
        Math.abs(Math.min(0, getMoveDrainRatio(options.move))) *
        0.35,
    );
  }

  if (options.move.effectTag === "multi-hit" && options.estimatedHits > 1) {
    score += 4;
  }

  score += getStatChangeScore({
    attackerStatStages: options.attackerStatStages,
    defenderStatStages: options.defenderStatStages,
    move: options.move,
  });
  score += getStatusApplicationScore({
    defenderCurrentHp: options.defenderCurrentHp,
    defenderEffects: options.defenderEffects,
    move: options.move,
  });

  return Math.round(score);
}

function getStatChangeScore(options: {
  attackerStatStages: BattleStatStages;
  defenderStatStages: BattleStatStages;
  move: MoveRecord;
}): number {
  const rules = STAT_CHANGE_RULES[options.move.moveId] ?? [];

  if (rules.length === 0) {
    return 0;
  }

  const chanceFactor = getMoveStatChance(options.move) / 100;

  return Math.round(
    rules.reduce((sum, rule) => {
      const currentStage =
        rule.target === "self"
          ? options.attackerStatStages[rule.stat]
          : options.defenderStatStages[rule.stat];
      const roomToChange =
        rule.stages > 0 ? 6 - currentStage : currentStage - -6;

      if (roomToChange <= 0) {
        return sum;
      }

      const magnitude = Math.min(Math.abs(rule.stages), roomToChange);
      const beneficialDelta =
        rule.target === "self"
          ? Math.sign(rule.stages) * magnitude
          : Math.sign(-rule.stages) * magnitude;
      const statWeight =
        rule.stat === "speed"
          ? 7
          : rule.stat === "attack" || rule.stat === "specialAttack"
            ? 6
            : 5;

      return sum + beneficialDelta * statWeight * chanceFactor;
    }, 0),
  );
}

function getStatusApplicationScore(options: {
  defenderCurrentHp: number;
  defenderEffects: BattlePersistentEffects;
  move: MoveRecord;
}): number {
  const chanceFactor = getMoveAilmentChance(options.move) / 100;

  if (chanceFactor <= 0) {
    return 0;
  }

  if (
    (SEED_MOVE_IDS.has(options.move.moveId) || TRAP_MOVE_IDS.has(options.move.moveId)) &&
    !options.defenderEffects.seeded
  ) {
    return Math.round(10 * chanceFactor);
  }

  if (
    YAWN_MOVE_IDS.has(options.move.moveId) &&
    !options.defenderEffects.yawnPending &&
    options.defenderEffects.majorStatus !== "sleep"
  ) {
    return Math.round(8 * chanceFactor);
  }

  const supportedStatus = inferSupportedStatusFromMove(options.move);

  if (!supportedStatus) {
    return 0;
  }

  if (supportedStatus === "confusion") {
    return options.defenderEffects.confusedTurnsRemaining === 0
      ? Math.round(9 * chanceFactor)
      : 0;
  }

  if (options.defenderEffects.majorStatus) {
    return 0;
  }

  const baseScore =
    supportedStatus === "sleep"
      ? 14
      : supportedStatus === "freeze"
        ? 12
      : supportedStatus === "burn"
        ? 10
        : supportedStatus === "poison"
          ? 9
          : 8;

  return Math.round(
    baseScore * chanceFactor + Math.min(6, Math.floor(options.defenderCurrentHp / 20)),
  );
}

function buildMoveEffectSummary(
  move: MoveRecord,
  estimatedHits: number,
): string | null {
  switch (move.effectTag) {
    case "heal":
      return move.moveId === "rest"
        ? "Fully heals, then puts the user to sleep"
        : `Heals ${Math.round(getMoveHealingRatio(move) * 100)}% HP`;
    case "protect":
      return "Blocks direct damage for one turn";
    case "drain":
      return DREAM_EATER_MOVE_IDS.has(move.moveId)
        ? `Only works on sleeping targets • Recovers ${Math.round(getMoveDrainRatio(move) * 100)}% of dealt damage`
        : `Recovers ${Math.round(getMoveDrainRatio(move) * 100)}% of dealt damage`;
    case "recoil":
      return `Takes ${Math.round(Math.abs(getMoveDrainRatio(move)) * 100)}% recoil`;
    case "multi-hit":
      return estimatedHits > 1
        ? `Usually lands about ${estimatedHits} hits`
        : "Hits multiple times";
    case "stat-boost":
    case "stat-drop": {
      const rules = STAT_CHANGE_RULES[move.moveId] ?? [];
      const chance = getMoveStatChance(move);

      if (rules.length === 0) {
        return null;
      }

      return `${summarizeStatChangeRules(rules)}${chance < 100 ? ` (${chance}% chance)` : ""}`;
    }
    case "status-apply":
      if (SEED_MOVE_IDS.has(move.moveId) || TRAP_MOVE_IDS.has(move.moveId)) {
        return "Applies lingering end-of-turn drain";
      }
      if (YAWN_MOVE_IDS.has(move.moveId)) {
        return "Makes the foe drowsy for next turn";
      }
      {
        const supportedStatus = inferSupportedStatusFromMove(move);

        return supportedStatus
          ? `${toDisplayExtendedStatusLabel(supportedStatus)} chance ${getMoveAilmentChance(move)}%`
          : "Triggers a simplified secondary status when supported";
      }
    default:
      return null;
  }
}

function resolveEndOfTurnEffects(
  context: BattleResolutionContext,
  simulationState: BattleSimulationState,
): void {
  const combatants = {
    player: context.player,
    enemy: context.enemy,
  } as const;

  for (const side of ["player", "enemy"] as const) {
    const otherSide = side === "player" ? "enemy" : "player";
    const effects = simulationState.effectsBySide[side];
    const combatant = combatants[side];

    if (simulationState.hpBySide[side] <= 0) {
      effects.yawnPending = false;
      continue;
    }

    if (effects.yawnPending && effects.majorStatus !== "sleep") {
      effects.yawnPending = false;

      if (!effects.majorStatus) {
        effects.majorStatus = "sleep";
        effects.sleepTurnsRemaining = DEFAULT_SLEEP_TURNS;
        effects.frozenTurnsRemaining = 0;
        simulationState.turnEvents.push(
          `${combatant.generated.name} grew drowsy and fell asleep.`,
        );
      }
    }

    if (effects.majorStatus === "burn" || effects.majorStatus === "poison") {
      const statusDamage = Math.min(
        simulationState.hpBySide[side],
        calculateScaledAmount(
          simulationState.statsBySide[side].hp,
          DEFAULT_STATUS_DAMAGE_FRACTION,
        ),
      );

      if (statusDamage > 0) {
        simulationState.hpBySide[side] -= statusDamage;
        simulationState.turnEvents.push(
          `${combatant.generated.name} took ${statusDamage} damage from ${toDisplayBattleStatus(effects.majorStatus)}.`,
        );
      }
    }

    if (effects.seeded && simulationState.hpBySide[side] > 0) {
      const seedDamage = Math.min(
        simulationState.hpBySide[side],
        calculateScaledAmount(
          simulationState.statsBySide[side].hp,
          DEFAULT_SEED_DAMAGE_FRACTION,
        ),
      );

      if (seedDamage > 0) {
        simulationState.hpBySide[side] -= seedDamage;
        const healed = healBattleSide(simulationState, otherSide, seedDamage);
        const healNote =
          healed > 0
            ? ` and ${combatants[otherSide].generated.name} recovered ${healed} HP`
            : "";

        simulationState.turnEvents.push(
          `${combatant.generated.name} lost ${seedDamage} HP to lingering drain${healNote}.`,
        );
      }
    }

    if (simulationState.hpBySide[side] === 0) {
      simulationState.turnEvents.push(`${combatant.generated.name} fainted.`);
    }
  }
}

function applyBattleMoveStatusEffects(options: {
  actionRandom: ReturnType<typeof createSeededRandom>;
  defenderName: string;
  defenderSide: BattleSide;
  move: MoveRecord;
  notes: string[];
  simulationState: BattleSimulationState;
}): void {
  if (options.move.effectTag !== "status-apply") {
    return;
  }

  if (options.actionRandom.next() > getMoveAilmentChance(options.move) / 100) {
    return;
  }

  const defenderEffects = options.simulationState.effectsBySide[options.defenderSide];
  const supportedStatus = inferSupportedStatusFromMove(options.move);

  if (SEED_MOVE_IDS.has(options.move.moveId) || TRAP_MOVE_IDS.has(options.move.moveId)) {
    if (!defenderEffects.seeded) {
      defenderEffects.seeded = true;
      options.notes.push(`${options.defenderName} is marked for lingering drain.`);
    }

    return;
  }

  if (YAWN_MOVE_IDS.has(options.move.moveId)) {
    if (!defenderEffects.yawnPending && defenderEffects.majorStatus !== "sleep") {
      defenderEffects.yawnPending = true;
      options.notes.push(`${options.defenderName} grew drowsy.`);
    }

    return;
  }

  if (supportedStatus === "confusion") {
    if (defenderEffects.confusedTurnsRemaining > 0) {
      options.notes.push(`${options.defenderName} is already confused.`);
      return;
    }

    defenderEffects.confusedTurnsRemaining = DEFAULT_CONFUSION_TURNS;
    options.notes.push(`${options.defenderName} became confused.`);

    return;
  }

  if (!supportedStatus) {
    options.notes.push("Its extra ailment is outside the simplified ruleset.");
    return;
  }

  if (defenderEffects.majorStatus) {
    options.notes.push(`${options.defenderName} already has a major status.`);
    return;
  }

  defenderEffects.majorStatus = supportedStatus;
  defenderEffects.sleepTurnsRemaining = 0;
  defenderEffects.frozenTurnsRemaining = 0;

  if (supportedStatus === "sleep") {
    defenderEffects.sleepTurnsRemaining = DEFAULT_SLEEP_TURNS;
  }

  if (supportedStatus === "freeze") {
    defenderEffects.frozenTurnsRemaining = DEFAULT_FREEZE_TURNS;
    defenderEffects.sleepTurnsRemaining = 0;
  }

  options.notes.push(
    `${options.defenderName} was inflicted with ${toDisplayBattleStatus(supportedStatus)}.`,
  );
}

function applyBattleMoveStatChanges(options: {
  actionRandom: ReturnType<typeof createSeededRandom>;
  attackerName: string;
  attackerSide: BattleSide;
  defenderName: string;
  defenderSide: BattleSide;
  move: MoveRecord;
  notes: string[];
  simulationState: BattleSimulationState;
}): void {
  const rules = STAT_CHANGE_RULES[options.move.moveId] ?? [];

  if (rules.length === 0) {
    return;
  }

  if (options.actionRandom.next() > getMoveStatChance(options.move) / 100) {
    return;
  }

  for (const rule of rules) {
    const targetSide = rule.target === "self" ? options.attackerSide : options.defenderSide;
    const targetName = rule.target === "self" ? options.attackerName : options.defenderName;
    const stages = options.simulationState.statStagesBySide[targetSide];
    const previousValue = stages[rule.stat];
    const nextValue = normalizeStageValue(previousValue + rule.stages);

    if (nextValue === previousValue) {
      continue;
    }

    stages[rule.stat] = nextValue;
    options.notes.push(
      `${targetName}'s ${toDisplayStatId(rule.stat)} ${rule.stages > 0 ? "rose" : "fell"} to ${formatSignedStage(nextValue)}.`,
    );
  }
}

function resolveStartOfTurnSkip(options: {
  actionRandom: ReturnType<typeof createSeededRandom>;
  actorName: string;
  effects: BattlePersistentEffects;
  maxHp: number;
  notes?: string[];
}): { selfDamage: number; skipReason: string | null } {
  if (options.effects.majorStatus === "freeze" && options.effects.frozenTurnsRemaining > 0) {
    options.effects.frozenTurnsRemaining = Math.max(
      0,
      options.effects.frozenTurnsRemaining - 1,
    );

    if (options.effects.frozenTurnsRemaining === 0) {
      options.effects.majorStatus = null;
      return {
        selfDamage: 0,
        skipReason: `${options.actorName} thawed out after losing the turn.`,
      };
    }

    return {
      selfDamage: 0,
      skipReason: `${options.actorName} is frozen solid and cannot move.`,
    };
  }

  if (options.effects.majorStatus === "sleep" && options.effects.sleepTurnsRemaining > 0) {
    options.effects.sleepTurnsRemaining = Math.max(
      0,
      options.effects.sleepTurnsRemaining - 1,
    );

    if (options.effects.sleepTurnsRemaining === 0) {
      options.effects.majorStatus = null;
      return {
        selfDamage: 0,
        skipReason: `${options.actorName} slept through the turn, but will wake up next round.`,
      };
    }

    return {
      selfDamage: 0,
      skipReason: `${options.actorName} is asleep and cannot move.`,
    };
  }

  if (
    options.effects.majorStatus === "paralysis" &&
    options.actionRandom.next() < 0.25
  ) {
    return {
      selfDamage: 0,
      skipReason: `${options.actorName} is paralyzed and cannot move.`,
    };
  }

  if (options.effects.confusedTurnsRemaining > 0) {
    options.effects.confusedTurnsRemaining = Math.max(
      0,
      options.effects.confusedTurnsRemaining - 1,
    );

    if (options.actionRandom.next() < 0.33) {
      return {
        selfDamage: calculateScaledAmount(options.maxHp, 0.1),
        skipReason: `${options.actorName} hurt itself in confusion.`,
      };
    }
  }

  return {
    selfDamage: 0,
    skipReason: null,
  };
}

function resolveMoveRecord(
  attacker: BattleCombatantContext,
  moveId: string,
  movePlan: BattleMovePlan,
): MoveRecord | null {
  if (moveId === FALLBACK_MOVE_ID || movePlan.isFallback) {
    return null;
  }

  return attacker.moveRecords.find((move) => move.moveId === moveId) ?? null;
}

function createFallbackMoveRecord(movePlan: BattleMovePlan): MoveRecord {
  return {
    accuracy: movePlan.accuracy,
    allowedInGame: true,
    category: movePlan.category,
    effectTag: "none",
    moveId: FALLBACK_MOVE_ID,
    name: movePlan.moveName,
    power: movePlan.power,
    pp: 1,
    priority: movePlan.priority,
    target: movePlan.targetsSelf ? "self" : "opponent",
    type: movePlan.typeId,
  };
}

function resolveActualHitCount(move: MoveRecord, roll: number): number {
  if (move.effectTag !== "multi-hit") {
    return 1;
  }

  const maxHits = getMoveMaxHits(move);

  if (maxHits <= 2) {
    return 2;
  }

  if (maxHits === 3) {
    return roll < 0.5 ? 2 : 3;
  }

  const outcomes = Array.from(
    { length: Math.max(1, maxHits - 1) },
    (_, index) => index + 2,
  );
  const outcomeIndex = Math.min(
    outcomes.length - 1,
    Math.floor(roll * outcomes.length),
  );

  return outcomes[outcomeIndex] ?? 2;
}

function getMoveEstimatedHits(move: MoveRecord): number {
  if (move.effectTag !== "multi-hit") {
    return 1;
  }

  const maxHits = getMoveMaxHits(move);

  if (maxHits <= 2) {
    return 2;
  }

  if (maxHits === 3) {
    return 2;
  }

  return 3;
}

function getMoveHealingRatio(move: MoveRecord): number {
  return clampRatio(getNumericEffectData(move, "healing", 50) / 100);
}

function getMoveDrainRatio(move: MoveRecord): number {
  return getNumericEffectData(
    move,
    "drain",
    move.effectTag === "drain" ? 50 : move.effectTag === "recoil" ? -25 : 0,
  ) / 100;
}

function getMoveStatChance(move: MoveRecord): number {
  if (move.effectTag !== "stat-boost" && move.effectTag !== "stat-drop") {
    return 0;
  }

  return clampPercent(getNumericEffectData(move, "statChance", 100));
}

function getMoveAilmentChance(move: MoveRecord): number {
  if (move.effectTag !== "status-apply") {
    return 0;
  }

  return clampPercent(getNumericEffectData(move, "ailmentChance", 100));
}

function getMoveMaxHits(move: MoveRecord): number {
  return Math.max(2, Math.round(getNumericEffectData(move, "maxHits", 2)));
}

function shouldMoveTargetSelf(move: MoveRecord): boolean {
  return move.target === "self" || SELF_TARGETING_MOVE_IDS.has(move.moveId);
}

function inferSupportedStatusFromMove(
  move: MoveRecord,
): BattlePersistentStatus | "confusion" | null {
  if (BURN_MOVE_IDS.has(move.moveId) || move.type === "fire") {
    return "burn";
  }

  if (FREEZE_MOVE_IDS.has(move.moveId)) {
    return "freeze";
  }

  if (PARALYSIS_MOVE_IDS.has(move.moveId) || move.type === "electric") {
    return "paralysis";
  }

  if (POISON_MOVE_IDS.has(move.moveId) || move.type === "poison") {
    return "poison";
  }

  if (SLEEP_MOVE_IDS.has(move.moveId)) {
    return "sleep";
  }

  if (CONFUSION_MOVE_IDS.has(move.moveId)) {
    return "confusion";
  }

  return null;
}

function getModifiedBattleStats(
  stats: BattleDerivedStats,
  effects: BattlePersistentEffects,
  statStages: BattleStatStages,
): BattleDerivedStats {
  const normalizedEffects = normalizeBattleEffects(effects);
  const normalizedStages = normalizeBattleStatStages(statStages);

  return {
    hp: stats.hp,
    attack: applyStatMultiplier(
      applyStageMultiplier(stats.attack, normalizedStages.attack),
      normalizedEffects.majorStatus === "burn" ? 0.75 : 1,
    ),
    defense: applyStageMultiplier(stats.defense, normalizedStages.defense),
    specialAttack: applyStageMultiplier(
      stats.specialAttack,
      normalizedStages.specialAttack,
    ),
    specialDefense: applyStageMultiplier(
      stats.specialDefense,
      normalizedStages.specialDefense,
    ),
    speed: applyStatMultiplier(
      applyStageMultiplier(stats.speed, normalizedStages.speed),
      normalizedEffects.majorStatus === "paralysis" ? 0.75 : 1,
    ),
  };
}

function applyStageMultiplier(baseStat: number, stage: number): number {
  return Math.max(1, Math.floor(baseStat * getStageMultiplier(stage)));
}

function applyStatMultiplier(baseStat: number, multiplier: number): number {
  return Math.max(1, Math.floor(baseStat * multiplier));
}

function getStageMultiplier(stage: number): number {
  const normalizedStage = normalizeStageValue(stage);

  return normalizedStage >= 0
    ? (2 + normalizedStage) / 2
    : 2 / (2 + Math.abs(normalizedStage));
}

function healBattleSide(
  simulationState: BattleSimulationState,
  side: BattleSide,
  amount: number,
): number {
  const currentHp = simulationState.hpBySide[side];
  const maxHp = simulationState.statsBySide[side].hp;
  const healed = Math.max(0, Math.min(maxHp - currentHp, amount));

  if (healed > 0) {
    simulationState.hpBySide[side] = currentHp + healed;
  }

  return healed;
}

function calculateScaledAmount(baseAmount: number, ratio: number): number {
  return Math.max(1, Math.floor(baseAmount * ratio));
}

function summarizeStatChangeRules(rules: BattleStatChangeRule[]): string {
  return rules
    .map((rule) => {
      const direction = rule.stages > 0 ? "Raise" : "Lower";
      const target = rule.target === "self" ? "self" : "foe";

      return `${direction} ${target} ${toDisplayStatId(rule.stat)} ${formatSignedStage(rule.stages)}`;
    })
    .join(" • ");
}

function toDisplayBattleStatus(status: BattlePersistentStatus): string {
  switch (status) {
    case "freeze":
      return "freeze";
    default:
      return status;
  }
}

function toDisplayExtendedStatusLabel(
  status: BattlePersistentStatus | "confusion",
): string {
  return status === "confusion" ? "confusion" : toDisplayBattleStatus(status);
}

function toDisplayStatId(statId: BattleStatId): string {
  switch (statId) {
    case "attack":
      return "Atk";
    case "defense":
      return "Def";
    case "specialAttack":
      return "SpA";
    case "specialDefense":
      return "SpD";
    case "speed":
      return "Spe";
    default:
      return statId;
  }
}

function formatSignedStage(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function getNumericEffectData(
  move: MoveRecord,
  key: string,
  fallback: number,
): number {
  const value = move.effectData?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampRatio(value: number): number {
  return Math.max(-1, Math.min(2, value));
}

function normalizeStageValue(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(-6, Math.min(6, Math.round(value)));
}

function normalizePositiveInteger(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function isBattlePersistentStatus(
  value: unknown,
): value is BattlePersistentStatus {
  return (
    value === "burn" ||
    value === "freeze" ||
    value === "paralysis" ||
    value === "poison" ||
    value === "sleep"
  );
}

function getTypeEffectivenessScoreBonus(typeEffectiveness: number): number {
  if (typeEffectiveness === 0) {
    return -24;
  }

  if (typeEffectiveness >= 4) {
    return 12;
  }

  if (typeEffectiveness > 1) {
    return 6;
  }

  if (typeEffectiveness <= 0.25) {
    return -8;
  }

  if (typeEffectiveness < 1) {
    return -4;
  }

  return 0;
}

export function summarizeTypeEffectiveness(multiplier: number): string {
  return describeTypeEffectiveness(multiplier);
}
