import type {
  BattleReadyPokemonRecord,
  FloorLevel,
  MoveCategory,
  MoveRecord,
  PokemonTypeId,
} from "../../types/pokechamp-data";
import {
  createSeededRandom,
  type GeneratedBattlePokemon,
} from "./rulesSandbox";

type BattleSide = "enemy" | "player";

const FALLBACK_MOVE_ID = "__fallback-strike__";
const MAX_BATTLE_TURNS = 12;

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

export interface BattleResolutionResult {
  enemyPlan: BattleMovePlan;
  enemyRemainingHp: number;
  enemyStats: BattleDerivedStats;
  outcome: "enemy-win" | "player-win";
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

export function selectBattleMove(options: {
  attacker: BattleCombatantContext;
  attackerStats: BattleDerivedStats;
  defender: BattleCombatantContext;
  defenderStats: BattleDerivedStats;
}): BattleMovePlan {
  const damagingMoves = options.attacker.moveRecords.filter(
    (move) => move.allowedInGame && move.power > 0 && move.category !== "status",
  );

  if (damagingMoves.length === 0) {
    return buildFallbackMovePlan(options.attacker, options.attackerStats);
  }

  let bestPlan: BattleMovePlan | null = null;

  for (const move of damagingMoves) {
    const plan = toBattleMovePlan({
      attacker: options.attacker,
      attackerStats: options.attackerStats,
      defenderStats: options.defenderStats,
      move,
    });

    if (!bestPlan || plan.score > bestPlan.score) {
      bestPlan = plan;
    }
  }

  if (!bestPlan) {
    return buildFallbackMovePlan(options.attacker, options.attackerStats);
  }

  return bestPlan;
}

export function resolveBattle(
  context: BattleResolutionContext,
): BattleResolutionResult {
  const rng = createSeededRandom(context.seed);
  const playerStats = deriveBattleStats(context.player.record, context.floorLevel);
  const enemyStats = deriveBattleStats(context.enemy.record, context.floorLevel);
  const playerPlan = selectBattleMove({
    attacker: context.player,
    attackerStats: playerStats,
    defender: context.enemy,
    defenderStats: enemyStats,
  });
  const enemyPlan = selectBattleMove({
    attacker: context.enemy,
    attackerStats: enemyStats,
    defender: context.player,
    defenderStats: playerStats,
  });
  const simulationState: BattleSimulationState = {
    hpBySide: {
      player: playerStats.hp,
      enemy: enemyStats.hp,
    },
    plans: {
      player: playerPlan,
      enemy: enemyPlan,
    },
    statsBySide: {
      player: playerStats,
      enemy: enemyStats,
    },
  };
  const turns: BattleTurnLog[] = [];

  for (let turnNumber = 1; turnNumber <= MAX_BATTLE_TURNS; turnNumber += 1) {
    const actions = simulateTurn(turnNumber, context, simulationState, rng.next());

    turns.push({
      actions,
      turnNumber,
    });

    if (
      simulationState.hpBySide.player === 0 ||
      simulationState.hpBySide.enemy === 0
    ) {
      break;
    }
  }

  const outcome = determineOutcome(context, simulationState);
  const turnsResolved = turns.length;

  return {
    enemyPlan,
    enemyRemainingHp: simulationState.hpBySide.enemy,
    enemyStats,
    outcome,
    playerPlan,
    playerRemainingHp: simulationState.hpBySide.player,
    playerStats,
    summary: buildBattleSummary({
      context,
      outcome,
      simulationState,
      turnsResolved,
    }),
    turns,
    turnsResolved,
  };
}

function buildBattleSummary(options: {
  context: BattleResolutionContext;
  outcome: BattleResolutionResult["outcome"];
  simulationState: BattleSimulationState;
  turnsResolved: number;
}): string {
  if (options.outcome === "player-win") {
    return `${options.context.player.generated.name} defeats ${options.context.enemy.generated.name} in ${options.turnsResolved} turns.`;
  }

  return `${options.context.enemy.generated.name} defeats ${options.context.player.generated.name} in ${options.turnsResolved} turns.`;
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
): BattleResolutionResult["outcome"] {
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

    if (simulationState.hpBySide[side] === 0 || simulationState.hpBySide[targetSide] === 0) {
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
