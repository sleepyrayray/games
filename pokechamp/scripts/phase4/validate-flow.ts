import movesDataset from "../../data/runtime/moves.json" with { type: "json" };
import pokemonDataset from "../../data/runtime/pokemon.json" with {
  type: "json",
};
import {
  buildBattleMoveChoices,
  deriveBattleStats,
  resolveBattleTurn,
  type BattleCombatantContext,
} from "../../src/game/run/battleResolution.ts";
import {
  RunRuntimeService,
  type BattleSessionContext,
  type RunCheckpointStage,
} from "../../src/game/run/runRuntimeService.ts";
import type { GeneratedBattlePokemon } from "../../src/game/run/rulesSandbox.ts";
import type {
  BattleReadyPokemonRecord,
  MoveRecord,
} from "../../src/types/pokechamp-data.ts";

interface FlowResult {
  chosenDoorType: string;
  chosenReward: string;
  chosenStarter: string;
  draftAttempts: number;
  floorOneEnemy: string;
  floorTwoEnemy: string;
  verifiedStages: RunCheckpointStage[];
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  public get length(): number {
    return this.values.size;
  }

  public clear(): void {
    this.values.clear();
  }

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const moveById = new Map(
  (movesDataset as MoveRecord[]).map((move) => [move.moveId, move]),
);
const pokemonById = new Map(
  (pokemonDataset as BattleReadyPokemonRecord[]).map((pokemon) => [
    pokemon.battlePokemonId,
    pokemon,
  ]),
);

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const storage = new MemoryStorage();
  installWindow(storage);
  assertAllowedUtilityMovesRemainSelectable();
  const results: FlowResult[] = [];

  for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
    storage.clear();
    results.push(runSingleFlow(runIndex + 1, options.maxDraftAttempts));
  }

  const averageDraftAttempts =
    results.reduce((sum, result) => sum + result.draftAttempts, 0) /
    results.length;

  console.log("Phase 4 flow validation passed.");
  console.log(`Successful flows: ${results.length} / ${options.runs}`);
  console.log(
    `Average draft attempts before a first-floor win: ${averageDraftAttempts.toFixed(2)}`,
  );

  results.forEach((result, index) => {
    console.log(
      [
        `Flow ${index + 1}: starter ${result.chosenStarter}`,
        `floor 1 enemy ${result.floorOneEnemy}`,
        `reward ${result.chosenReward}`,
        `door ${result.chosenDoorType}`,
        `floor 2 enemy ${result.floorTwoEnemy}`,
        `stages ${result.verifiedStages.join(" -> ")}`,
      ].join(" | "),
    );
  });
}

function runSingleFlow(
  flowNumber: number,
  maxDraftAttempts: number,
): FlowResult {
  attemptLoop: for (let attempt = 1; attempt <= maxDraftAttempts; attempt += 1) {
    let runtime = resetRuntimeSingleton();

    runtime.clearRunState();
    const playerName = runtime.setPreferredPlayerName(`Phase4-${flowNumber}`);
    const draft = runtime.beginStarterDraft({
      clearSavedRun: true,
      forceNew: true,
      playerName,
    });
    const verifiedStages: RunCheckpointStage[] = ["starter-draft"];
    const chosenStarter = chooseStrongestCandidate(draft.starterOffer.choices);

    runtime.startRunFromStarter(chosenStarter.battlePokemonId);
    assertStage(runtime, "floor");
    verifiedStages.push("floor");
    const floorOne = runtime.getCurrentFloorContext();

    if (!floorOne) {
      throw new Error("Expected floor 1 context after starting the run");
    }

    assert(
      floorOne.encounter.enemy.level === floorOne.playerPokemon.level - 2,
      "Expected floor 1 enemy level to be 2 below the player's partner",
    );

    let battleSession = runtime.beginOrResumeBattleSession();

    if (!battleSession) {
      throw new Error("Expected a battle session after starting the run");
    }

    assertStage(runtime, "battle");
    verifiedStages.push("battle");

    const firstTurnState = resolveBestTurn(battleSession);

    if (firstTurnState.outcome === "enemy-win") {
      runtime.clearRunState();

      continue;
    }

    runtime.saveBattleSessionState(firstTurnState);
    runtime = resetRuntimeSingleton();

    const reloadedBattle = runtime.getBattleSession();

    if (!reloadedBattle) {
      throw new Error("Expected a saved battle session after reloading");
    }

    assert(
      reloadedBattle.battleState.turnsResolved === firstTurnState.turnsResolved,
      "Expected the reloaded battle to preserve turns resolved",
    );

    battleSession = reloadedBattle;

    while (!battleSession.battleState.outcome) {
      const nextState = resolveBestTurn(battleSession);

      if (nextState.outcome === "enemy-win") {
        runtime.clearRunState();

        continue attemptLoop;
      }

      runtime.saveBattleSessionState(nextState);
      battleSession = {
        battleContext: battleSession.battleContext,
        battleState: nextState,
      };
    }

    assert(
      battleSession.battleState.outcome === "player-win",
      "Expected a victorious battle path before entering rewards",
    );
    assertStage(runtime, "reward");
    verifiedStages.push("reward");

    runtime = resetRuntimeSingleton();
    assertStage(runtime, "reward");

    const rewardContext = runtime.getRewardDraftContext();

    if (!rewardContext) {
      throw new Error("Expected a reward draft after a victorious battle");
    }

    assert(
      rewardContext.rewardOffer.choices.length === 3,
      "Expected exactly 3 reward choices",
    );
    assert(
      rewardContext.rewardOffer.choices.every(
        (choice) => choice.level === rewardContext.rewardOffer.nextFloorLevel,
      ),
      "Expected every reward choice to match the next floor level",
    );

    const chosenReward = chooseStrongestCandidate(rewardContext.rewardOffer.choices);

    runtime.chooseReward(chosenReward.battlePokemonId);
    assertStage(runtime, "door");
    verifiedStages.push("door");
    assert(
      runtime.getRewardDraftContext() === null,
      "Expected the reward draft to lock once a reward is chosen",
    );

    runtime = resetRuntimeSingleton();
    assertStage(runtime, "door");
    assert(
      runtime.getRewardDraftContext() === null,
      "Expected the locked reward checkpoint to stay one-way after reload",
    );

    const pendingDoorChoice = runtime.getPendingDoorChoiceContext();

    if (!pendingDoorChoice) {
      throw new Error("Expected a pending door choice after selecting a reward");
    }

    const chosenDoor = pendingDoorChoice.doorOffer.choices[0];

    runtime.advanceToNextFloor(chosenDoor.typeId);
    assertStage(runtime, "floor");
    verifiedStages.push("floor");

    runtime = resetRuntimeSingleton();
    assertStage(runtime, "floor");

    const floorTwo = runtime.getCurrentFloorContext();

    if (!floorTwo) {
      throw new Error("Expected floor 2 context after advancing the run");
    }

    assert(floorTwo.state.currentFloor === 2, "Expected the run to advance to floor 2");
    assert(
      floorTwo.playerPokemon.level === floorTwo.floorLevel,
      "Expected the chosen reward to become the next floor's level-matched partner",
    );
    assert(
      floorTwo.encounter.enemy.level === floorTwo.playerPokemon.level - 2,
      "Expected floor 2 enemy level to be 2 below the player's partner",
    );
    assert(
      new Set(floorTwo.state.usedSpecies).size === floorTwo.state.usedSpecies.length,
      "Expected used species to remain unique after the floor advance",
    );

    const floorTwoBattle = runtime.beginOrResumeBattleSession();

    if (!floorTwoBattle) {
      throw new Error("Expected a second-floor battle session");
    }

    assertStage(runtime, "battle");
    verifiedStages.push("battle");
    assert(
      floorTwoBattle.battleState.outcome === null &&
        floorTwoBattle.battleState.turnsResolved === 0,
      "Expected floor 2 battles to begin at the live interactive turn state",
    );

    const floorTwoTurn = resolveBestTurn(floorTwoBattle);

    if (floorTwoTurn.outcome === "enemy-win") {
      runtime.clearRunState();

      continue attemptLoop;
    }

    runtime.saveBattleSessionState(floorTwoTurn);
    runtime = resetRuntimeSingleton();

    const resumedSecondFloorBattle = runtime.getBattleSession();

    if (!resumedSecondFloorBattle) {
      throw new Error("Expected floor 2 battle progress to survive a reload");
    }

    assert(
      resumedSecondFloorBattle.battleState.turnsResolved ===
        floorTwoTurn.turnsResolved,
      "Expected the floor 2 battle checkpoint to persist after reload",
    );

    return {
      chosenDoorType: chosenDoor.typeId,
      chosenReward: chosenReward.name,
      chosenStarter: chosenStarter.name,
      draftAttempts: attempt,
      floorOneEnemy: rewardContext.currentFloor.encounter.enemy.name,
      floorTwoEnemy: floorTwo.encounter.enemy.name,
      verifiedStages,
    };
  }

  throw new Error(
    `Unable to find a victorious first-floor flow within ${maxDraftAttempts} draft attempts`,
  );
}

function assertAllowedUtilityMovesRemainSelectable(): void {
  const candidate = findUtilityMoveCandidate();

  if (!candidate) {
    throw new Error("Expected at least one allowed utility move in the runtime data");
  }

  const combatant = buildCombatantContext(candidate.record, candidate.level);
  const choices = buildBattleMoveChoices({
    attacker: combatant,
    attackerStats: deriveBattleStats(candidate.record, candidate.level),
    defender: combatant,
    defenderStats: deriveBattleStats(candidate.record, candidate.level),
  });

  candidate.utilityMoveIds.forEach((moveId) => {
    const choice = choices.find((entry) => entry.plan.moveId === moveId);

    assert(
      !!choice?.isSelectable,
      `Expected allowed utility move ${moveId} to stay selectable in the prototype battle UI`,
    );
  });
}

function resolveBestTurn(
  battleSession: BattleSessionContext,
) {
  const selectableMove = buildBattleMoveChoices({
    attacker: battleSession.battleContext.player,
    attackerStats: battleSession.battleState.playerStats,
    defender: battleSession.battleContext.enemy,
    defenderStats: battleSession.battleState.enemyStats,
  })
    .filter((choice) => choice.isSelectable)
    .sort((left, right) => right.plan.score - left.plan.score)[0];

  if (!selectableMove) {
    throw new Error("Expected at least one selectable player move");
  }

  return resolveBattleTurn({
    context: battleSession.battleContext,
    playerMoveId: selectableMove.plan.moveId,
    state: battleSession.battleState,
  });
}

function chooseStrongestCandidate<
  Candidate extends { battlePokemonId: string; name: string },
>(choices: readonly Candidate[]): Candidate {
  const bestCandidate = [...choices].sort(
    (left, right) => scoreCandidate(right.battlePokemonId) - scoreCandidate(left.battlePokemonId),
  )[0];

  if (!bestCandidate) {
    throw new Error("Expected at least one candidate choice");
  }

  return bestCandidate;
}

function buildCombatantContext(
  record: BattleReadyPokemonRecord,
  level: number,
): BattleCombatantContext {
  const moves =
    record.movesetsByFloorLevel[
      level as keyof typeof record.movesetsByFloorLevel
    ];

  if (!moves) {
    throw new Error(
      `Expected a moveset for ${record.battlePokemonId} at level ${level}`,
    );
  }

  const generated: GeneratedBattlePokemon = {
    battlePokemonId: record.battlePokemonId,
    speciesId: record.speciesId,
    formId: record.formId,
    name: record.name,
    level,
    types: record.types,
    floorTypes: record.floorTypes,
    moves: [...moves] as GeneratedBattlePokemon["moves"],
  };
  const moveRecords = generated.moves
    .map((moveId) => moveById.get(moveId))
    .filter((move): move is MoveRecord => !!move);

  return {
    generated,
    moveRecords,
    record,
  };
}

function findUtilityMoveCandidate():
  | {
      level: number;
      record: BattleReadyPokemonRecord;
      utilityMoveIds: string[];
    }
  | null {
  for (const record of pokemonById.values()) {
    const availableLevels = Object.keys(record.movesetsByFloorLevel)
      .map((level) => Number.parseInt(level, 10))
      .filter((level) => Number.isFinite(level))
      .sort((left, right) => left - right);

    for (const level of availableLevels) {
      const moveset = record.movesetsByFloorLevel[
        level as keyof typeof record.movesetsByFloorLevel
      ];

      if (!moveset) {
        continue;
      }

      const utilityMoveIds = moveset.filter((moveId) => {
        const move = moveById.get(moveId);

        return !!move && move.allowedInGame && (move.category === "status" || move.power <= 0);
      });

      if (utilityMoveIds.length > 0) {
        return {
          level,
          record,
          utilityMoveIds,
        };
      }
    }
  }

  return null;
}

function scoreCandidate(battlePokemonId: string): number {
  const pokemon = pokemonById.get(battlePokemonId);

  if (!pokemon) {
    return Number.NEGATIVE_INFINITY;
  }

  const baseStatTotal =
    pokemon.baseStats.hp +
    pokemon.baseStats.attack +
    pokemon.baseStats.defense +
    pokemon.baseStats.specialAttack +
    pokemon.baseStats.specialDefense +
    pokemon.baseStats.speed;
  const movePowerTotal = Object.values(pokemon.movesetsByFloorLevel)
    .flat()
    .reduce((total, moveId) => total + (moveById.get(moveId)?.power ?? 0), 0);

  return baseStatTotal * 10 + movePowerTotal;
}

function resetRuntimeSingleton(): RunRuntimeService {
  (
    RunRuntimeService as unknown as {
      instance: RunRuntimeService | null;
    }
  ).instance = null;

  return RunRuntimeService.getInstance();
}

function installWindow(storage: Storage): void {
  (
    globalThis as typeof globalThis & {
      window: Window & typeof globalThis;
    }
  ).window = {
    localStorage: storage,
  } as Window & typeof globalThis;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertStage(
  runtime: RunRuntimeService,
  expectedStage: RunCheckpointStage,
): void {
  const actualStage = runtime.getCheckpointSummary().stage;

  assert(
    actualStage === expectedStage,
    `Expected checkpoint stage "${expectedStage}", received "${actualStage}"`,
  );
}

function parseArgs(argv: string[]): {
  maxDraftAttempts: number;
  runs: number;
} {
  const runs = getNumericArg(argv, "--runs", 3);
  const maxDraftAttempts = getNumericArg(argv, "--max-draft-attempts", 40);

  assert(runs > 0, "Expected --runs to be at least 1");
  assert(maxDraftAttempts > 0, "Expected --max-draft-attempts to be at least 1");

  return {
    maxDraftAttempts,
    runs,
  };
}

function getNumericArg(
  argv: string[],
  flag: string,
  fallback: number,
): number {
  const index = argv.indexOf(flag);

  if (index === -1) {
    return fallback;
  }

  const rawValue = argv[index + 1];
  const parsedValue = Number.parseInt(rawValue ?? "", 10);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`Expected a number after ${flag}`);
  }

  return parsedValue;
}

main();
