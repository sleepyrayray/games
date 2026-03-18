import pokemonDataset from "../../data/runtime/pokemon.json" with {
  type: "json",
};
import {
  buildBattleMoveChoices,
  createBattleSession,
  resolveBattleTurn,
  type BattleCombatantContext,
  type BattleResolutionContext,
  type BattleSessionState,
} from "../../src/game/run/battleResolution.ts";
import type { GeneratedBattlePokemon } from "../../src/game/run/rulesSandbox.ts";
import type {
  BattleReadyPokemonRecord,
  MoveRecord,
  PokemonTypeId,
} from "../../src/types/pokechamp-data.ts";

function main(): void {
  assertHealingMoveRestoresHp();
  assertProtectBlocksDamage();
  assertStatBoostsImproveFutureDamage();
  assertStatDropsImproveFutureDamage();
  assertPoisonAppliesResidualDamage();

  console.log("Phase 5 battle validation passed.");
  console.log("- heal moves restore HP");
  console.log("- Protect blocks direct damage");
  console.log("- stat boosts and drops persist into future move planning");
  console.log("- poison-style status effects apply residual end-of-turn damage");
}

function assertHealingMoveRestoresHp(): void {
  const context = buildTestContext({
    enemyMoves: [createRecoverMove()],
    playerMoves: [createRecoverMove()],
    seed: "phase5-heal",
  });
  const initialState = createBattleSession(context);
  const damagedState: BattleSessionState = {
    ...initialState,
    playerCurrentHp: Math.floor(initialState.playerStats.hp / 2),
  };
  const nextState = resolveBattleTurn({
    context,
    playerMoveId: "recover",
    state: damagedState,
  });

  assert(
    nextState.playerCurrentHp > damagedState.playerCurrentHp,
    "Expected Recover to restore the player's HP",
  );
  assert(
    nextState.turns[0]?.actions
      .flatMap((action) => action.notes)
      .some((note) => note.includes("restored")),
    "Expected the battle log to mention restored HP",
  );
}

function assertProtectBlocksDamage(): void {
  const context = buildTestContext({
    enemyMoves: [createStrikeMove()],
    playerMoves: [createProtectMove()],
    seed: "phase5-protect",
  });
  const initialState = createBattleSession(context);
  const nextState = resolveBattleTurn({
    context,
    playerMoveId: "protect",
    state: initialState,
  });
  const enemyAction = nextState.turns[0]?.actions.find(
    (action) => action.actorSide === "enemy",
  );

  assert(
    nextState.playerCurrentHp === initialState.playerStats.hp,
    "Expected Protect to keep the player at full HP against a direct attack",
  );
  assert(
    enemyAction?.notes.some((note) => note.includes("Protect")) ?? false,
    "Expected the enemy action log to mention Protect blocking the move",
  );
}

function assertStatBoostsImproveFutureDamage(): void {
  const context = buildTestContext({
    enemyMoves: [createRecoverMove()],
    playerMoves: [createSwordsDanceMove(), createStrikeMove()],
    seed: "phase5-boost",
  });
  const initialState = createBattleSession(context);
  const baselineDamage = resolveMovePlan(
    context,
    initialState,
    "__phase5-strike__",
  ).expectedDamage;
  const boostedState = resolveBattleTurn({
    context,
    playerMoveId: "swords-dance",
    state: initialState,
  });
  const boostedDamage = resolveMovePlan(
    context,
    boostedState,
    "__phase5-strike__",
  ).expectedDamage;

  assert(
    boostedState.playerStatStages.attack === 2,
    "Expected Swords Dance to raise the player's Attack by two stages",
  );
  assert(
    boostedDamage > baselineDamage,
    "Expected the post-boost strike plan to deal more damage",
  );
}

function assertStatDropsImproveFutureDamage(): void {
  const context = buildTestContext({
    enemyMoves: [createRecoverMove()],
    playerMoves: [createScreechMove(), createStrikeMove()],
    seed: "phase5-drop",
  });
  const initialState = createBattleSession(context);
  const baselineDamage = resolveMovePlan(
    context,
    initialState,
    "__phase5-strike__",
  ).expectedDamage;
  const droppedState = resolveBattleTurn({
    context,
    playerMoveId: "screech",
    state: initialState,
  });
  const droppedDamage = resolveMovePlan(
    context,
    droppedState,
    "__phase5-strike__",
  ).expectedDamage;

  assert(
    droppedState.enemyStatStages.defense === -2,
    "Expected Screech to lower the enemy's Defense by two stages",
  );
  assert(
    droppedDamage > baselineDamage,
    "Expected the follow-up strike plan to improve after the defense drop",
  );
}

function assertPoisonAppliesResidualDamage(): void {
  const context = buildTestContext({
    enemyMoves: [createRecoverMove()],
    playerMoves: [createToxicMove()],
    seed: "phase5-poison",
  });
  const initialState = createBattleSession(context);
  const nextState = resolveBattleTurn({
    context,
    playerMoveId: "toxic",
    state: initialState,
  });

  assert(
    nextState.enemyEffects.majorStatus === "poison",
    "Expected Toxic to apply poison in the simplified battle rules",
  );
  assert(
    nextState.enemyCurrentHp < nextState.enemyStats.hp,
    "Expected poison to chip enemy HP at end of turn",
  );
}

function resolveMovePlan(
  context: BattleResolutionContext,
  state: BattleSessionState,
  moveId: string,
) {
  const choice = buildBattleMoveChoices({
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
  }).find((entry) => entry.plan.moveId === moveId);

  if (!choice) {
    throw new Error(`Expected move choice ${moveId} to exist`);
  }

  return choice.plan;
}

function buildTestContext(options: {
  enemyMoves: MoveRecord[];
  playerMoves: MoveRecord[];
  seed: string;
}): BattleResolutionContext {
  return {
    floorLevel: 48,
    floorNumber: 1,
    floorType: "normal",
    playerName: "Validator",
    runId: `phase5-${options.seed}`,
    seed: options.seed,
    usedSpeciesCount: 0,
    enemy: buildSyntheticCombatantContext(
      ["rock"],
      options.enemyMoves,
      "Enemy Tester",
      48,
    ),
    player: buildSyntheticCombatantContext(
      ["normal"],
      options.playerMoves,
      "Player Tester",
      50,
    ),
  };
}

function buildSyntheticCombatantContext(
  types: readonly PokemonTypeId[],
  moveRecords: MoveRecord[],
  name: string,
  level: number,
): BattleCombatantContext {
  const templateRecord = getTemplateBattlePokemonRecord();
  const resolvedTypes =
    types.length === 1
      ? ([types[0] ?? "normal"] as [PokemonTypeId])
      : ([types[0] ?? "normal", types[1] ?? types[0] ?? "normal"] as [
          PokemonTypeId,
          PokemonTypeId,
        ]);
  const record: BattleReadyPokemonRecord = {
    ...templateRecord,
    floorTypes: resolvedTypes,
    types: resolvedTypes,
  };
  const generated: GeneratedBattlePokemon = {
    battlePokemonId: `${templateRecord.battlePokemonId}:${name}:${moveRecords.map((move) => move.moveId).join("-")}`,
    speciesId: templateRecord.speciesId,
    formId: templateRecord.formId,
    name,
    level,
    types: resolvedTypes,
    floorTypes: resolvedTypes,
    moves: moveRecords.map((move) => move.moveId) as GeneratedBattlePokemon["moves"],
  };

  return {
    generated,
    moveRecords,
    record,
  };
}

function createRecoverMove(): MoveRecord {
  return {
    accuracy: 100,
    allowedInGame: true,
    category: "status",
    effectTag: "heal",
    effectData: {
      healing: 50,
    },
    moveId: "recover",
    name: "Recover",
    power: 0,
    pp: 10,
    priority: 0,
    target: "self",
    type: "normal",
  };
}

function createProtectMove(): MoveRecord {
  return {
    accuracy: 100,
    allowedInGame: true,
    category: "status",
    effectTag: "protect",
    moveId: "protect",
    name: "Protect",
    power: 0,
    pp: 10,
    priority: 4,
    target: "self",
    type: "normal",
  };
}

function createStrikeMove(): MoveRecord {
  return {
    accuracy: 100,
    allowedInGame: true,
    category: "physical",
    effectTag: "none",
    moveId: "__phase5-strike__",
    name: "Phase 5 Strike",
    power: 75,
    pp: 20,
    priority: 0,
    target: "opponent",
    type: "normal",
  };
}

function createSwordsDanceMove(): MoveRecord {
  return {
    accuracy: 100,
    allowedInGame: true,
    category: "status",
    effectTag: "stat-boost",
    moveId: "swords-dance",
    name: "Swords Dance",
    power: 0,
    pp: 20,
    priority: 0,
    target: "self",
    type: "normal",
  };
}

function createScreechMove(): MoveRecord {
  return {
    accuracy: 100,
    allowedInGame: true,
    category: "status",
    effectTag: "stat-drop",
    moveId: "screech",
    name: "Screech",
    power: 0,
    pp: 20,
    priority: 0,
    target: "opponent",
    type: "normal",
  };
}

function createToxicMove(): MoveRecord {
  return {
    accuracy: 100,
    allowedInGame: true,
    category: "status",
    effectTag: "status-apply",
    moveId: "toxic",
    name: "Toxic",
    power: 0,
    pp: 10,
    priority: 0,
    target: "opponent",
    type: "poison",
  };
}

function getTemplateBattlePokemonRecord(): BattleReadyPokemonRecord {
  const templateRecord = (pokemonDataset as BattleReadyPokemonRecord[])[0];

  if (!templateRecord) {
    throw new Error("Expected at least one battle-ready Pokemon record");
  }

  return templateRecord;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main();
