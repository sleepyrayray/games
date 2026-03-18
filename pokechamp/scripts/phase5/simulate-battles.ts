import { join } from "node:path";

import {
  BATTLE_TURN_LIMIT,
  createBattleSession,
  resolveBattleTurn,
  selectBattleMove,
  type BattleActionLog,
  type BattleCombatantContext,
  type BattleOutcome,
  type BattleResolutionContext,
  type BattleSessionState,
} from "../../src/game/run/battleResolution.ts";
import type {
  BattleReadyPokemonRecord,
  FloorLevelRecord,
  MoveRecord,
  PokemonTypeId,
  StarterPoolRecord,
} from "../../src/types/pokechamp-data.ts";
import { readJsonFile, sortRecordByKey, writeJsonFile } from "../shared/file-utils.ts";
import { RUNTIME_DATA_DIR } from "../shared/pipeline-config.ts";
import {
  RulesSandbox,
  simulateTowerRun,
  type GeneratedBattlePokemon,
  type SimulatedFloor,
  type SimulatedRun,
  type SimulationStrategy,
} from "../shared/rules-sandbox.ts";

type BattleSide = "enemy" | "player";
type BattleAlertKind =
  | "battle-exception"
  | "fallback-action"
  | "no-progress-loop"
  | "protect-loop"
  | "rest-loop"
  | "stalled-repeat-loop"
  | "turn-limit";

interface CliOptions {
  maxFallbackActions: number;
  maxNoProgressStreak: number;
  maxProtectUsesPerSide: number;
  maxRestUsesPerSide: number;
  maxStalledRepeatChain: number;
  maxTurnLimitRate: number;
  reportPath?: string;
  runs: number;
  sampleCount: number;
  seedPrefix: string;
  strategy: SimulationStrategy;
}

interface SimulationFailureSample {
  floorNumber?: number;
  kind: "battle-exception" | "generation-failure";
  message: string;
  seed: string;
}

interface BattleSimulationSample {
  seed: string;
  floorNumber: number;
  floorType: PokemonTypeId;
  playerBattlePokemonId: string;
  playerLevel: number;
  playerMoveSequence: string[];
  playerName: string;
  enemyBattlePokemonId: string;
  enemyLevel: number;
  enemyMoveSequence: string[];
  enemyName: string;
  outcome: BattleOutcome;
  turnsResolved: number;
  endedByTurnLimit: boolean;
  fallbackActions: number;
  longestNoProgressStreak: number;
  longestProtectChain: number;
  longestRestChain: number;
  longestStalledRepeatChain: number;
  maxProtectUsesPerSide: number;
  maxRestUsesPerSide: number;
  flags: BattleAlertKind[];
}

interface BattleSimulationSummary {
  averageFloorsCleared: number;
  alerts: string[];
  averageTurnsPerBattle: number;
  battleFailureCounts: Partial<Record<BattleAlertKind, number>>;
  battleExceptionCount: number;
  completedGeneratedRuns: number;
  enemyWins: number;
  fullTowerClearRate: number;
  fullTowerClears: number;
  generatedRunFailureCount: number;
  generatedRunFailureKinds: Record<string, number>;
  furthestFloorReached: number;
  lossFloorCounts: Record<string, number>;
  maxFallbackActionsObserved: number;
  maxNoProgressStreakObserved: number;
  maxProtectUsesPerSideObserved: number;
  maxRestUsesPerSideObserved: number;
  maxStalledRepeatChainObserved: number;
  playerWins: number;
  sampleFailures: SimulationFailureSample[];
  sampleFlaggedBattles: BattleSimulationSample[];
  strategy: SimulationStrategy;
  topMoves: Array<{ count: number; moveId: string }>;
  totalBattles: number;
  totalRuns: number;
  turnLimitBattles: number;
  turnLimitRate: number;
}

interface BattleSimulationRecord extends BattleSimulationSample {
  protectUsesBySide: Record<BattleSide, number>;
  restUsesBySide: Record<BattleSide, number>;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pokemon = await readJsonFile<BattleReadyPokemonRecord[]>(
    join(RUNTIME_DATA_DIR, "pokemon.json"),
  );
  const floorLevels = await readJsonFile<FloorLevelRecord[]>(
    join(RUNTIME_DATA_DIR, "floor-levels.json"),
  );
  const starters = await readJsonFile<StarterPoolRecord>(
    join(RUNTIME_DATA_DIR, "starters.json"),
  );
  const moves = await readJsonFile<MoveRecord[]>(
    join(RUNTIME_DATA_DIR, "moves.json"),
  );

  const sandbox = new RulesSandbox({
    pokemon,
    floorLevels,
    moves,
    starters,
  });
  const moveById = new Map(moves.map((move) => [move.moveId, move] as const));
  const recordByBattlePokemonId = new Map(
    pokemon.map((record) => [record.battlePokemonId, record] as const),
  );
  const battleRecords: BattleSimulationRecord[] = [];
  const failureSamples: SimulationFailureSample[] = [];
  const generatedRunFailureKinds = new Map<string, number>();
  const moveUsage = new Map<string, number>();
  let completedGeneratedRuns = 0;
  let fullTowerClears = 0;
  let battleExceptionCount = 0;
  const floorsClearedByRun: number[] = [];
  const lossFloorCounts = new Map<string, number>();

  for (let index = 0; index < options.runs; index += 1) {
    const seed = `${options.seedPrefix}-${String(index + 1).padStart(4, "0")}`;
    const generatedRun = simulateTowerRun(sandbox, {
      seed,
      strategy: options.strategy,
    });

    if (generatedRun.status === "failed") {
      generatedRunFailureKinds.set(
        generatedRun.failure.kind,
        (generatedRunFailureKinds.get(generatedRun.failure.kind) ?? 0) + 1,
      );
      collectFailureSample(failureSamples, options.sampleCount, {
        floorNumber: generatedRun.failure.floorNumber,
        kind: "generation-failure",
        message: generatedRun.failure.message,
        seed,
      });
      continue;
    }

    completedGeneratedRuns += 1;
    let didClearTower = true;
    let floorsClearedThisRun = 0;

    for (const floor of generatedRun.run.floors) {
      try {
        const battleRecord = simulateBattle({
          floor,
          moveById,
          recordByBattlePokemonId,
          run: generatedRun.run,
        });

        battleRecords.push(battleRecord);
        addMoveUsage(moveUsage, battleRecord.playerMoveSequence);
        addMoveUsage(moveUsage, battleRecord.enemyMoveSequence);

        if (battleRecord.outcome !== "player-win") {
          didClearTower = false;
          lossFloorCounts.set(
            String(floor.floorNumber),
            (lossFloorCounts.get(String(floor.floorNumber)) ?? 0) + 1,
          );
          break;
        }

        floorsClearedThisRun += 1;
      } catch (error) {
        didClearTower = false;
        battleExceptionCount += 1;
        lossFloorCounts.set(
          String(floor.floorNumber),
          (lossFloorCounts.get(String(floor.floorNumber)) ?? 0) + 1,
        );
        collectFailureSample(failureSamples, options.sampleCount, {
          floorNumber: floor.floorNumber,
          kind: "battle-exception",
          message: error instanceof Error ? error.message : "Unknown battle error",
          seed,
        });
        break;
      }
    }

    floorsClearedByRun.push(floorsClearedThisRun);

    if (didClearTower) {
      fullTowerClears += 1;
    }
  }

  const summary = buildSummary({
    battleRecords,
    completedGeneratedRuns,
    failureSamples,
    generatedRunFailureKinds,
    moveUsage,
    options,
    totalRuns: options.runs,
    fullTowerClears,
    battleExceptionCount,
    floorsClearedByRun,
    lossFloorCounts,
  });

  printSummary(summary);

  if (options.reportPath) {
    await writeJsonFile(options.reportPath, {
      generatedAt: new Date().toISOString(),
      summary,
    });
    console.log(`Wrote report to ${options.reportPath}`);
  }

  if (summary.alerts.length > 0) {
    process.exitCode = 1;
  }
}

function buildSummary(options: {
  battleRecords: BattleSimulationRecord[];
  battleExceptionCount: number;
  completedGeneratedRuns: number;
  failureSamples: SimulationFailureSample[];
  floorsClearedByRun: number[];
  fullTowerClears: number;
  generatedRunFailureKinds: Map<string, number>;
  lossFloorCounts: Map<string, number>;
  moveUsage: Map<string, number>;
  options: CliOptions;
  totalRuns: number;
}): BattleSimulationSummary {
  const battleFailureCounts = new Map<BattleAlertKind, number>();
  const flaggedBattles = options.battleRecords.filter(
    (record) => record.flags.length > 0,
  );
  let playerWins = 0;
  let enemyWins = 0;
  let totalTurns = 0;
  let turnLimitBattles = 0;
  let maxFallbackActionsObserved = 0;
  let maxNoProgressStreakObserved = 0;
  let maxProtectUsesPerSideObserved = 0;
  let maxRestUsesPerSideObserved = 0;
  let maxStalledRepeatChainObserved = 0;
  const furthestFloorReached = options.floorsClearedByRun.reduce(
    (highestFloor, floorsCleared) => Math.max(highestFloor, floorsCleared),
    0,
  );

  for (const record of options.battleRecords) {
    totalTurns += record.turnsResolved;
    maxFallbackActionsObserved = Math.max(
      maxFallbackActionsObserved,
      record.fallbackActions,
    );
    maxNoProgressStreakObserved = Math.max(
      maxNoProgressStreakObserved,
      record.longestNoProgressStreak,
    );
    maxProtectUsesPerSideObserved = Math.max(
      maxProtectUsesPerSideObserved,
      record.maxProtectUsesPerSide,
    );
    maxRestUsesPerSideObserved = Math.max(
      maxRestUsesPerSideObserved,
      record.maxRestUsesPerSide,
    );
    maxStalledRepeatChainObserved = Math.max(
      maxStalledRepeatChainObserved,
      record.longestStalledRepeatChain,
    );

    if (record.outcome === "player-win") {
      playerWins += 1;
    } else {
      enemyWins += 1;
    }

    if (record.endedByTurnLimit) {
      turnLimitBattles += 1;
    }

    for (const flag of record.flags) {
      battleFailureCounts.set(flag, (battleFailureCounts.get(flag) ?? 0) + 1);
    }
  }

  const totalBattles = options.battleRecords.length;
  const turnLimitRate = totalBattles === 0 ? 0 : turnLimitBattles / totalBattles;
  const alerts: string[] = [];

  if (options.generatedRunFailureKinds.size > 0) {
    alerts.push(
      `Encounter generation failed in ${sumMapValues(options.generatedRunFailureKinds)} run(s).`,
    );
  }

  if (options.battleExceptionCount > 0) {
    alerts.push(
      `Battle simulation hit ${options.battleExceptionCount} exception(s).`,
    );
  }

  if (maxFallbackActionsObserved > options.options.maxFallbackActions) {
    alerts.push(
      `Fallback actions peaked at ${maxFallbackActionsObserved}, above the allowed ${options.options.maxFallbackActions}.`,
    );
  }

  if (turnLimitRate > options.options.maxTurnLimitRate) {
    alerts.push(
      `Turn-limit battles reached ${formatPercent(turnLimitRate)}, above the allowed ${formatPercent(options.options.maxTurnLimitRate)}.`,
    );
  }

  if (maxNoProgressStreakObserved > options.options.maxNoProgressStreak) {
    alerts.push(
      `No-progress streaks peaked at ${maxNoProgressStreakObserved} turns, above the allowed ${options.options.maxNoProgressStreak}.`,
    );
  }

  if (
    maxProtectUsesPerSideObserved > options.options.maxProtectUsesPerSide
  ) {
    alerts.push(
      `Protect usage peaked at ${maxProtectUsesPerSideObserved} uses by one side in a single battle, above the allowed ${options.options.maxProtectUsesPerSide}.`,
    );
  }

  if (maxRestUsesPerSideObserved > options.options.maxRestUsesPerSide) {
    alerts.push(
      `Rest usage peaked at ${maxRestUsesPerSideObserved} uses by one side in a single battle, above the allowed ${options.options.maxRestUsesPerSide}.`,
    );
  }

  if (
    maxStalledRepeatChainObserved > options.options.maxStalledRepeatChain
  ) {
    alerts.push(
      `Repeated stalled move chains peaked at ${maxStalledRepeatChainObserved}, above the allowed ${options.options.maxStalledRepeatChain}.`,
    );
  }

  return {
    averageFloorsCleared:
      options.floorsClearedByRun.length === 0
        ? 0
        : options.floorsClearedByRun.reduce((sum, value) => sum + value, 0) /
          options.floorsClearedByRun.length,
    alerts,
    averageTurnsPerBattle: totalBattles === 0 ? 0 : totalTurns / totalBattles,
    battleFailureCounts: sortRecordByKey(
      Object.fromEntries(battleFailureCounts.entries()),
    ),
    battleExceptionCount: options.battleExceptionCount,
    completedGeneratedRuns: options.completedGeneratedRuns,
    enemyWins,
    fullTowerClearRate:
      options.completedGeneratedRuns === 0
        ? 0
        : options.fullTowerClears / options.completedGeneratedRuns,
    fullTowerClears: options.fullTowerClears,
    generatedRunFailureCount: sumMapValues(options.generatedRunFailureKinds),
    generatedRunFailureKinds: sortRecordByKey(
      Object.fromEntries(options.generatedRunFailureKinds.entries()),
    ),
    furthestFloorReached,
    lossFloorCounts: sortRecordByKey(
      Object.fromEntries(options.lossFloorCounts.entries()),
    ),
    maxFallbackActionsObserved,
    maxNoProgressStreakObserved,
    maxProtectUsesPerSideObserved,
    maxRestUsesPerSideObserved,
    maxStalledRepeatChainObserved,
    playerWins,
    sampleFailures: options.failureSamples.slice(0, options.options.sampleCount),
    sampleFlaggedBattles: flaggedBattles
      .sort(compareFlaggedBattles)
      .slice(0, options.options.sampleCount),
    strategy: options.options.strategy,
    topMoves: getTopMoves(options.moveUsage, 10),
    totalBattles,
    totalRuns: options.totalRuns,
    turnLimitBattles,
    turnLimitRate,
  };
}

function compareFlaggedBattles(
  left: BattleSimulationRecord,
  right: BattleSimulationRecord,
): number {
  if (left.flags.length !== right.flags.length) {
    return right.flags.length - left.flags.length;
  }

  if (left.longestNoProgressStreak !== right.longestNoProgressStreak) {
    return right.longestNoProgressStreak - left.longestNoProgressStreak;
  }

  if (left.turnsResolved !== right.turnsResolved) {
    return right.turnsResolved - left.turnsResolved;
  }

  return left.seed.localeCompare(right.seed, "en");
}

function simulateBattle(options: {
  floor: SimulatedFloor;
  moveById: ReadonlyMap<string, MoveRecord>;
  recordByBattlePokemonId: ReadonlyMap<string, BattleReadyPokemonRecord>;
  run: SimulatedRun;
}): BattleSimulationRecord {
  const runState = options.run.runStateHistory[options.floor.floorNumber - 1];

  if (!runState) {
    throw new Error(
      `Missing run state snapshot before floor ${options.floor.floorNumber}`,
    );
  }

  const context: BattleResolutionContext = {
    floorLevel: options.floor.floorLevel,
    floorNumber: options.floor.floorNumber,
    floorType: options.floor.floorType,
    playerName: runState.playerName,
    runId: runState.runId,
    seed: [options.run.seed, `floor-${options.floor.floorNumber}`, "battle"].join(":"),
    usedSpeciesCount: runState.usedSpecies.length,
    enemy: buildBattleCombatant(
      options.floor.encounter.enemy,
      options.recordByBattlePokemonId,
      options.moveById,
    ),
    player: buildBattleCombatant(
      options.floor.playerPokemon,
      options.recordByBattlePokemonId,
      options.moveById,
    ),
  };
  const moveSequenceBySide: Record<BattleSide, string[]> = {
    enemy: [],
    player: [],
  };
  const protectUsesBySide: Record<BattleSide, number> = {
    enemy: 0,
    player: 0,
  };
  const restUsesBySide: Record<BattleSide, number> = {
    enemy: 0,
    player: 0,
  };
  const currentProtectChainBySide: Record<BattleSide, number> = {
    enemy: 0,
    player: 0,
  };
  const currentRestChainBySide: Record<BattleSide, number> = {
    enemy: 0,
    player: 0,
  };
  const longestProtectChainBySide: Record<BattleSide, number> = {
    enemy: 0,
    player: 0,
  };
  const longestRestChainBySide: Record<BattleSide, number> = {
    enemy: 0,
    player: 0,
  };
  const currentStalledRepeatChainBySide: Record<BattleSide, number> = {
    enemy: 0,
    player: 0,
  };
  const longestStalledRepeatChainBySide: Record<BattleSide, number> = {
    enemy: 0,
    player: 0,
  };
  const previousMoveBySide: Record<BattleSide, string | null> = {
    enemy: null,
    player: null,
  };
  let fallbackActions = 0;
  let currentNoProgressStreak = 0;
  let longestNoProgressStreak = 0;
  let state = createBattleSession(context);

  while (!state.outcome) {
    const playerPlan = selectBattleMove({
      attacker: context.player,
      attackerCurrentHp: state.playerCurrentHp,
      attackerEffects: state.playerEffects,
      attackerLastPlan: state.playerLastPlan,
      attackerStats: state.playerStats,
      attackerStatStages: state.playerStatStages,
      defender: context.enemy,
      defenderCurrentHp: state.enemyCurrentHp,
      defenderEffects: state.enemyEffects,
      defenderStats: state.enemyStats,
      defenderStatStages: state.enemyStatStages,
      turnsResolved: state.turnsResolved,
    });
    const nextState = resolveBattleTurn({
      context,
      playerMoveId: playerPlan.moveId,
      state,
    });
    const turn = nextState.turns[nextState.turns.length - 1];

    if (!turn) {
      throw new Error(
        `Expected battle turn log for ${context.runId} floor ${context.floorNumber}`,
      );
    }

    const noProgress =
      buildProgressSignature(state) === buildProgressSignature(nextState);

    if (noProgress) {
      currentNoProgressStreak += 1;
      longestNoProgressStreak = Math.max(
        longestNoProgressStreak,
        currentNoProgressStreak,
      );
    } else {
      currentNoProgressStreak = 0;
    }

    for (const side of ["player", "enemy"] as const) {
      const action = getTurnAction(turn.actions, side);

      if (!action) {
        previousMoveBySide[side] = null;
        currentProtectChainBySide[side] = 0;
        currentRestChainBySide[side] = 0;
        currentStalledRepeatChainBySide[side] = 0;
        continue;
      }

      moveSequenceBySide[side].push(action.moveId);

      if (action.usedFallback) {
        fallbackActions += 1;
      }

      if (!action.skipped && action.moveId === "protect") {
        protectUsesBySide[side] += 1;
        currentProtectChainBySide[side] += 1;
      } else {
        currentProtectChainBySide[side] = 0;
      }

      if (!action.skipped && action.moveId === "rest") {
        restUsesBySide[side] += 1;
        currentRestChainBySide[side] += 1;
      } else {
        currentRestChainBySide[side] = 0;
      }

      longestProtectChainBySide[side] = Math.max(
        longestProtectChainBySide[side],
        currentProtectChainBySide[side],
      );
      longestRestChainBySide[side] = Math.max(
        longestRestChainBySide[side],
        currentRestChainBySide[side],
      );

      if (noProgress && previousMoveBySide[side] === action.moveId) {
        currentStalledRepeatChainBySide[side] += 1;
      } else if (noProgress) {
        currentStalledRepeatChainBySide[side] = 1;
      } else {
        currentStalledRepeatChainBySide[side] = 0;
      }

      longestStalledRepeatChainBySide[side] = Math.max(
        longestStalledRepeatChainBySide[side],
        currentStalledRepeatChainBySide[side],
      );
      previousMoveBySide[side] = action.moveId;
    }

    state = nextState;
  }

  const endedByTurnLimit =
    state.turnsResolved >= BATTLE_TURN_LIMIT &&
    state.playerCurrentHp > 0 &&
    state.enemyCurrentHp > 0;
  const maxProtectUsesPerSide = Math.max(
    protectUsesBySide.player,
    protectUsesBySide.enemy,
  );
  const maxRestUsesPerSide = Math.max(
    restUsesBySide.player,
    restUsesBySide.enemy,
  );
  const longestProtectChain = Math.max(
    longestProtectChainBySide.player,
    longestProtectChainBySide.enemy,
  );
  const longestRestChain = Math.max(
    longestRestChainBySide.player,
    longestRestChainBySide.enemy,
  );
  const longestStalledRepeatChain = Math.max(
    longestStalledRepeatChainBySide.player,
    longestStalledRepeatChainBySide.enemy,
  );
  const flags = buildBattleFlags({
    endedByTurnLimit,
    fallbackActions,
    longestNoProgressStreak,
    longestProtectChain,
    longestRestChain,
    longestStalledRepeatChain,
    maxProtectUsesPerSide,
    maxRestUsesPerSide,
  });

  return {
    seed: options.run.seed,
    floorNumber: options.floor.floorNumber,
    floorType: options.floor.floorType,
    playerBattlePokemonId: context.player.generated.battlePokemonId,
    playerLevel: context.player.generated.level,
    playerMoveSequence: moveSequenceBySide.player,
    playerName: context.player.generated.name,
    enemyBattlePokemonId: context.enemy.generated.battlePokemonId,
    enemyLevel: context.enemy.generated.level,
    enemyMoveSequence: moveSequenceBySide.enemy,
    enemyName: context.enemy.generated.name,
    outcome: state.outcome,
    turnsResolved: state.turnsResolved,
    endedByTurnLimit,
    fallbackActions,
    longestNoProgressStreak,
    longestProtectChain,
    longestRestChain,
    longestStalledRepeatChain,
    maxProtectUsesPerSide,
    maxRestUsesPerSide,
    flags,
    protectUsesBySide,
    restUsesBySide,
  };
}

function buildBattleFlags(options: {
  endedByTurnLimit: boolean;
  fallbackActions: number;
  longestNoProgressStreak: number;
  longestProtectChain: number;
  longestRestChain: number;
  longestStalledRepeatChain: number;
  maxProtectUsesPerSide: number;
  maxRestUsesPerSide: number;
}): BattleAlertKind[] {
  const flags = new Set<BattleAlertKind>();

  if (options.endedByTurnLimit) {
    flags.add("turn-limit");
  }

  if (options.fallbackActions > 0) {
    flags.add("fallback-action");
  }

  if (options.longestNoProgressStreak >= 3) {
    flags.add("no-progress-loop");
  }

  if (
    options.longestProtectChain >= 2 ||
    (options.maxProtectUsesPerSide >= 6 && options.longestNoProgressStreak >= 3)
  ) {
    flags.add("protect-loop");
  }

  if (
    options.longestRestChain >= 2 ||
    (options.maxRestUsesPerSide >= 3 && options.longestNoProgressStreak >= 3)
  ) {
    flags.add("rest-loop");
  }

  if (options.longestStalledRepeatChain >= 3) {
    flags.add("stalled-repeat-loop");
  }

  return [...flags].sort();
}

function buildBattleCombatant(
  generatedPokemon: GeneratedBattlePokemon,
  recordByBattlePokemonId: ReadonlyMap<string, BattleReadyPokemonRecord>,
  moveById: ReadonlyMap<string, MoveRecord>,
): BattleCombatantContext {
  const record = recordByBattlePokemonId.get(generatedPokemon.battlePokemonId);

  if (!record) {
    throw new Error(
      `Unable to resolve battle record for ${generatedPokemon.battlePokemonId}`,
    );
  }

  return {
    generated: generatedPokemon,
    moveRecords: generatedPokemon.moves.map((moveId) => {
      const moveRecord = moveById.get(moveId);

      if (!moveRecord) {
        throw new Error(
          `Unable to resolve move record ${moveId} for ${generatedPokemon.battlePokemonId}`,
        );
      }

      return moveRecord;
    }),
    record,
  };
}

function getTurnAction(
  actions: BattleActionLog[],
  side: BattleSide,
): BattleActionLog | null {
  return actions.find((action) => action.actorSide === side) ?? null;
}

function buildProgressSignature(state: BattleSessionState): string {
  return [
    state.playerCurrentHp,
    state.enemyCurrentHp,
    state.playerEffects.majorStatus ?? "-",
    state.playerEffects.confusedTurnsRemaining,
    state.playerEffects.frozenTurnsRemaining,
    state.playerEffects.seeded ? 1 : 0,
    state.playerEffects.sleepTurnsRemaining,
    state.playerEffects.yawnPending ? 1 : 0,
    state.enemyEffects.majorStatus ?? "-",
    state.enemyEffects.confusedTurnsRemaining,
    state.enemyEffects.frozenTurnsRemaining,
    state.enemyEffects.seeded ? 1 : 0,
    state.enemyEffects.sleepTurnsRemaining,
    state.enemyEffects.yawnPending ? 1 : 0,
    state.playerStatStages.attack,
    state.playerStatStages.defense,
    state.playerStatStages.specialAttack,
    state.playerStatStages.specialDefense,
    state.playerStatStages.speed,
    state.enemyStatStages.attack,
    state.enemyStatStages.defense,
    state.enemyStatStages.specialAttack,
    state.enemyStatStages.specialDefense,
    state.enemyStatStages.speed,
  ].join("|");
}

function addMoveUsage(
  moveUsage: Map<string, number>,
  moveSequence: readonly string[],
): void {
  for (const moveId of moveSequence) {
    moveUsage.set(moveId, (moveUsage.get(moveId) ?? 0) + 1);
  }
}

function collectFailureSample(
  samples: SimulationFailureSample[],
  sampleCount: number,
  sample: SimulationFailureSample,
): void {
  if (samples.length < sampleCount) {
    samples.push(sample);
  }
}

function getTopMoves(
  moveUsage: Map<string, number>,
  limit: number,
): Array<{ count: number; moveId: string }> {
  return [...moveUsage.entries()]
    .sort((left, right) => {
      if (left[1] !== right[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], "en");
    })
    .slice(0, limit)
    .map(([moveId, count]) => ({
      count,
      moveId,
    }));
}

function sumMapValues(map: ReadonlyMap<string, number>): number {
  let total = 0;

  for (const value of map.values()) {
    total += value;
  }

  return total;
}

function printSummary(summary: BattleSimulationSummary): void {
  console.log("Phase 5 runtime battle simulation");
  console.log(
    `- generated runs: ${summary.completedGeneratedRuns}/${summary.totalRuns} completed`,
  );
  console.log(`- total battles: ${summary.totalBattles}`);
  console.log(
    `- outcomes: player ${summary.playerWins}, enemy ${summary.enemyWins}, full clears ${summary.fullTowerClears} (${formatPercent(summary.fullTowerClearRate)})`,
  );
  console.log(
    `- run progression: average floors cleared ${summary.averageFloorsCleared.toFixed(2)}, furthest floor reached ${summary.furthestFloorReached}`,
  );
  if (Object.keys(summary.lossFloorCounts).length > 0) {
    console.log(`- loss floors: ${JSON.stringify(summary.lossFloorCounts)}`);
  }
  console.log(
    `- turn-limit battles: ${summary.turnLimitBattles} (${formatPercent(summary.turnLimitRate)})`,
  );
  console.log(
    `- average turns per battle: ${summary.averageTurnsPerBattle.toFixed(2)}`,
  );
  console.log(
    `- max no-progress streak: ${summary.maxNoProgressStreakObserved} turns`,
  );
  console.log(
    `- max Protect uses by one side in one battle: ${summary.maxProtectUsesPerSideObserved}`,
  );
  console.log(
    `- max Rest uses by one side in one battle: ${summary.maxRestUsesPerSideObserved}`,
  );
  console.log(
    `- max stalled repeated move chain: ${summary.maxStalledRepeatChainObserved}`,
  );
  console.log(
    `- max fallback actions in one battle: ${summary.maxFallbackActionsObserved}`,
  );

  if (Object.keys(summary.generatedRunFailureKinds).length > 0) {
    console.log(
      `- generation failures: ${JSON.stringify(summary.generatedRunFailureKinds)}`,
    );
  }

  if (Object.keys(summary.battleFailureCounts).length > 0) {
    console.log(
      `- flagged battle patterns: ${JSON.stringify(summary.battleFailureCounts)}`,
    );
  }

  if (summary.battleExceptionCount > 0) {
    console.log(`- battle exceptions: ${summary.battleExceptionCount}`);
  }

  if (summary.topMoves.length > 0) {
    console.log(
      `- most used moves: ${summary.topMoves
        .map((entry) => `${entry.moveId} (${entry.count})`)
        .join(", ")}`,
    );
  }

  if (summary.sampleFlaggedBattles.length > 0) {
    console.log("Sample flagged battles:");

    for (const sample of summary.sampleFlaggedBattles) {
      console.log(
        `- ${sample.seed} floor ${sample.floorNumber} ${sample.playerName} Lv.${sample.playerLevel} vs ${sample.enemyName} Lv.${sample.enemyLevel}: ${sample.flags.join(", ")} | turns ${sample.turnsResolved} | player [${sample.playerMoveSequence.join(", ")}] | enemy [${sample.enemyMoveSequence.join(", ")}]`,
      );
    }
  }

  if (summary.sampleFailures.length > 0) {
    console.log("Sample failures:");

    for (const failure of summary.sampleFailures) {
      console.log(
        `- ${failure.seed}${failure.floorNumber ? ` floor ${failure.floorNumber}` : ""}: ${failure.kind} - ${failure.message}`,
      );
    }
  }

  if (summary.alerts.length === 0) {
    console.log("- alerts: none");
    return;
  }

  console.log("Alerts:");

  for (const alert of summary.alerts) {
    console.log(`- ${alert}`);
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    maxFallbackActions: 0,
    maxNoProgressStreak: 3,
    maxProtectUsesPerSide: 6,
    maxRestUsesPerSide: 4,
    maxStalledRepeatChain: 3,
    maxTurnLimitRate: 0.08,
    runs: 100,
    sampleCount: 5,
    seedPrefix: "phase5-battle",
    strategy: "random",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--report") {
      options.reportPath = requireValue(argv[index + 1], arg);
      index += 1;
      continue;
    }

    if (arg === "--runs") {
      options.runs = parsePositiveInteger(requireValue(argv[index + 1], arg), arg);
      index += 1;
      continue;
    }

    if (arg === "--sample-count") {
      options.sampleCount = parsePositiveInteger(
        requireValue(argv[index + 1], arg),
        arg,
      );
      index += 1;
      continue;
    }

    if (arg === "--seed") {
      options.seedPrefix = requireValue(argv[index + 1], arg);
      index += 1;
      continue;
    }

    if (arg === "--strategy") {
      const strategy = requireValue(argv[index + 1], arg);

      if (strategy !== "random" && strategy !== "scarcity-first") {
        throw new Error(
          `Unsupported strategy "${strategy}". Expected "random" or "scarcity-first".`,
        );
      }

      options.strategy = strategy;
      index += 1;
      continue;
    }

    if (arg === "--max-turn-limit-rate") {
      options.maxTurnLimitRate = parseRatio(
        requireValue(argv[index + 1], arg),
        arg,
      );
      index += 1;
      continue;
    }

    if (arg === "--max-no-progress-streak") {
      options.maxNoProgressStreak = parsePositiveInteger(
        requireValue(argv[index + 1], arg),
        arg,
      );
      index += 1;
      continue;
    }

    if (arg === "--max-protect-uses") {
      options.maxProtectUsesPerSide = parsePositiveInteger(
        requireValue(argv[index + 1], arg),
        arg,
      );
      index += 1;
      continue;
    }

    if (arg === "--max-rest-uses") {
      options.maxRestUsesPerSide = parsePositiveInteger(
        requireValue(argv[index + 1], arg),
        arg,
      );
      index += 1;
      continue;
    }

    if (arg === "--max-stalled-repeat-chain") {
      options.maxStalledRepeatChain = parsePositiveInteger(
        requireValue(argv[index + 1], arg),
        arg,
      );
      index += 1;
      continue;
    }

    if (arg === "--max-fallback-actions") {
      options.maxFallbackActions = parsePositiveInteger(
        requireValue(argv[index + 1], arg),
        arg,
      );
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument "${arg}"`);
  }

  return options;
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected ${flag} to receive a positive integer, got "${value}"`);
  }

  return parsed;
}

function parseRatio(value: string, flag: string): number {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Expected ${flag} to receive a ratio between 0 and 1, got "${value}"`);
  }

  return parsed;
}

function requireValue(value: string | undefined, flag: string): string {
  if (!value) {
    throw new Error(`Expected a value after ${flag}`);
  }

  return value;
}

function printHelp(): void {
  console.log("Usage: npm run phase5:simulate -- [options]");
  console.log("");
  console.log("Options:");
  console.log("  --runs <n>                      Number of generated tower runs to inspect");
  console.log("  --sample-count <n>              Number of flagged samples to print and report");
  console.log("  --seed <prefix>                 Seed prefix for generated runs");
  console.log("  --strategy <random|scarcity-first>");
  console.log("  --report <path>                 Write the JSON report to disk");
  console.log("  --max-turn-limit-rate <ratio>   Allowed fraction of battles ending on the turn limit");
  console.log("  --max-no-progress-streak <n>    Allowed longest no-progress streak");
  console.log("  --max-protect-uses <n>          Allowed peak Protect uses by one side in one battle");
  console.log("  --max-rest-uses <n>             Allowed peak Rest uses by one side in one battle");
  console.log("  --max-stalled-repeat-chain <n>  Allowed longest stalled repeated-move chain");
  console.log("  --max-fallback-actions <n>      Allowed peak fallback actions in one battle");
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

await main();
