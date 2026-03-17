import type {
  BattleReadyPokemonRecord,
  FloorLevel,
  MoveCategory,
  MoveId,
  MoveRecord,
  PokemonTypeId,
} from "../../types/pokechamp-data";
import {
  createSeededRandom,
  type GeneratedBattlePokemon,
} from "./rulesSandbox";

type BattleSide = "enemy" | "player";

const FALLBACK_MOVE_ID: MoveId = "__fallback-strike__";
const UNSUPPORTED_MOVE_REASON = "Status and utility moves arrive later.";

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

export interface BattleMovePlan {
  accuracy: number;
  category: MoveCategory;
  expectedDamage: number;
  isFallback: boolean;
  moveId: string;
  moveName: string;
  power: number;
  priority: number;
  score: number;
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
  remainingHp: number;
  usedFallback: boolean;
}

export interface BattleTurnLog {
  actions: BattleActionLog[];
  turnNumber: number;
}

export interface BattleSessionState {
  enemyCurrentHp: number;
  enemyLastPlan: BattleMovePlan | null;
  enemyStats: BattleDerivedStats;
  outcome: BattleOutcome | null;
  playerCurrentHp: number;
  playerLastPlan: BattleMovePlan | null;
  playerStats: BattleDerivedStats;
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
  hpBySide: Record<BattleSide, number>;
  plans: Record<BattleSide, BattleMovePlan>;
  statsBySide: Record<BattleSide, BattleDerivedStats>;
}

export function deriveBattleStats(
  record: BattleReadyPokemonRecord,
  level: FloorLevel,
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

export function createBattleSession(
  context: BattleResolutionContext,
): BattleSessionState {
  const playerStats = deriveBattleStats(context.player.record, context.floorLevel);
  const enemyStats = deriveBattleStats(context.enemy.record, context.floorLevel);

  return {
    enemyCurrentHp: enemyStats.hp,
    enemyLastPlan: null,
    enemyStats,
    outcome: null,
    playerCurrentHp: playerStats.hp,
    playerLastPlan: null,
    playerStats,
    summary: null,
    turns: [],
    turnsResolved: 0,
  };
}

export function buildBattleMoveChoices(options: {
  attacker: BattleCombatantContext;
  attackerStats: BattleDerivedStats;
  defender: BattleCombatantContext;
  defenderStats: BattleDerivedStats;
}): BattleMoveChoice[] {
  const choices = options.attacker.moveRecords.map((move) => {
    if (!move.allowedInGame) {
      return {
        disabledReason: "This move is excluded from the current prototype ruleset.",
        isSelectable: false,
        plan: toDisabledBattleMovePlan(move),
      };
    }

    if (move.category === "status" || move.power <= 0) {
      return {
        disabledReason: UNSUPPORTED_MOVE_REASON,
        isSelectable: false,
        plan: toDisabledBattleMovePlan(move),
      };
    }

    return {
      disabledReason: null,
      isSelectable: true,
      plan: toBattleMovePlan({
        attacker: options.attacker,
        attackerStats: options.attackerStats,
        defenderStats: options.defenderStats,
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
      plan: buildFallbackMovePlan(options.attacker, options.attackerStats),
    },
  ];
}

export function selectBattleMove(options: {
  attacker: BattleCombatantContext;
  attackerStats: BattleDerivedStats;
  defender: BattleCombatantContext;
  defenderStats: BattleDerivedStats;
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
    return buildFallbackMovePlan(options.attacker, options.attackerStats);
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
    attackerStats: options.state.enemyStats,
    defender: options.context.player,
    defenderStats: options.state.playerStats,
  });
  const turnNumber = options.state.turnsResolved + 1;
  const simulationState: BattleSimulationState = {
    hpBySide: {
      player: options.state.playerCurrentHp,
      enemy: options.state.enemyCurrentHp,
    },
    plans: {
      player: playerPlan,
      enemy: enemyPlan,
    },
    statsBySide: {
      player: options.state.playerStats,
      enemy: options.state.enemyStats,
    },
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
    enemyLastPlan: enemyPlan,
    enemyStats: options.state.enemyStats,
    outcome,
    playerCurrentHp: simulationState.hpBySide.player,
    playerLastPlan: playerPlan,
    playerStats: options.state.playerStats,
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
      attackerStats: state.playerStats,
      defender: context.enemy,
      defenderStats: state.enemyStats,
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
): BattleMovePlan {
  const category: MoveCategory =
    attackerStats.attack >= attackerStats.specialAttack ? "physical" : "special";
  const typeId = attacker.generated.types[0];
  const power = 40;
  const accuracy = 100;

  return {
    accuracy,
    category,
    expectedDamage: Math.max(
      8,
      Math.floor(
        (category === "physical"
          ? attackerStats.attack
          : attackerStats.specialAttack) / 4,
      ),
    ),
    isFallback: true,
    moveId: FALLBACK_MOVE_ID,
    moveName: "Fallback Strike",
    power,
    priority: 0,
    score: power,
    typeId,
  };
}

function calculateExpectedDamage(options: {
  accuracy: number;
  attackerStats: BattleDerivedStats;
  category: MoveCategory;
  defenderStats: BattleDerivedStats;
  level: FloorLevel;
  power: number;
  stab: number;
}): number {
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
  });

  return Math.max(1, Math.floor((scaledDamage * options.accuracy) / 100));
}

function calculateDamage(options: {
  accuracy: number;
  attackStat: number;
  defenseStat: number;
  level: FloorLevel;
  power: number;
  stab: number;
}): number {
  const levelFactor = Math.floor((2 * options.level) / 5) + 2;
  const baseDamage =
    Math.floor(
      (levelFactor * Math.max(1, options.power) * options.attackStat) /
        Math.max(1, options.defenseStat) /
        50,
    ) + 2;
  const stabDamage = Math.floor(baseDamage * options.stab);
  const accuracyAdjustedDamage = Math.max(
    1,
    Math.floor((stabDamage * options.accuracy) / 100),
  );

  return accuracyAdjustedDamage;
}

function calculateHpStat(baseStat: number, level: FloorLevel): number {
  return Math.floor((2 * baseStat * level) / 100) + level + 10;
}

function calculateNonHpStat(baseStat: number, level: FloorLevel): number {
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
  level: FloorLevel;
  movePlan: BattleMovePlan;
  simulationState: BattleSimulationState;
  turnRandom: number;
}): BattleActionLog {
  const hitRoll = Math.floor(options.turnRandom * 100) + 1;
  const hit = hitRoll <= options.movePlan.accuracy;
  let damage = 0;

  if (hit) {
    damage = calculateDamage({
      accuracy: options.movePlan.accuracy,
      attackStat:
        options.movePlan.category === "physical"
          ? options.attackerStats.attack
          : options.attackerStats.specialAttack,
      defenseStat:
        options.movePlan.category === "physical"
          ? options.defenderStats.defense
          : options.defenderStats.specialDefense,
      level: options.level,
      power: options.movePlan.power,
      stab: options.attacker.generated.types.includes(options.movePlan.typeId)
        ? 1.2
        : 1,
    });
    options.simulationState.hpBySide[options.defenderSide] = Math.max(
      0,
      options.simulationState.hpBySide[options.defenderSide] - damage,
    );
  }

  return {
    actorSide: options.attackerSide,
    damage,
    hit,
    moveId: options.movePlan.moveId,
    moveName: options.movePlan.moveName,
    remainingHp: options.simulationState.hpBySide[options.defenderSide],
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
    attackerStats: options.state.playerStats,
    defender: options.context.enemy,
    defenderStats: options.state.enemyStats,
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
    simulationState.statsBySide,
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
      level: context.floorLevel,
      movePlan: simulationState.plans[side],
      simulationState,
      turnRandom: createSeededRandom(`${turnSeedBase}:${side}`).next(),
    });

    turnActions.push(action);
  }

  return turnActions;
}

function pickFirstActorSide(
  plans: Record<BattleSide, BattleMovePlan>,
  statsBySide: Record<BattleSide, BattleDerivedStats>,
  tieBreakerRoll: number,
): BattleSide {
  if (plans.player.priority !== plans.enemy.priority) {
    return plans.player.priority > plans.enemy.priority ? "player" : "enemy";
  }

  if (statsBySide.player.speed !== statsBySide.enemy.speed) {
    return statsBySide.player.speed > statsBySide.enemy.speed ? "player" : "enemy";
  }

  return tieBreakerRoll >= 0.5 ? "player" : "enemy";
}

function toBattleMovePlan(options: {
  attacker: BattleCombatantContext;
  attackerStats: BattleDerivedStats;
  defenderStats: BattleDerivedStats;
  move: MoveRecord;
}): BattleMovePlan {
  const stab = options.attacker.generated.types.includes(options.move.type) ? 1.2 : 1;
  const expectedDamage = calculateExpectedDamage({
    accuracy: options.move.accuracy,
    attackerStats: options.attackerStats,
    category: options.move.category,
    defenderStats: options.defenderStats,
    level: options.attacker.generated.level,
    power: options.move.power,
    stab,
  });
  const score =
    expectedDamage +
    options.move.priority * 6 +
    buildEffectBonus(options.move) +
    (stab > 1 ? 4 : 0);

  return {
    accuracy: options.move.accuracy,
    category: options.move.category,
    expectedDamage,
    isFallback: false,
    moveId: options.move.moveId,
    moveName: options.move.name,
    power: options.move.power,
    priority: options.move.priority,
    score,
    typeId: options.move.type,
  };
}

function toDisabledBattleMovePlan(move: MoveRecord): BattleMovePlan {
  return {
    accuracy: move.accuracy,
    category: move.category,
    expectedDamage: 0,
    isFallback: false,
    moveId: move.moveId,
    moveName: move.name,
    power: move.power,
    priority: move.priority,
    score: 0,
    typeId: move.type,
  };
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
