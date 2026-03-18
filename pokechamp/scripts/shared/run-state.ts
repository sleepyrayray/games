import {
  FLOOR_LEVELS,
  POKEMON_TYPES,
  type BattlePokemonId,
  type CurrentRunPokemon,
  type DoorTypeSet,
  type PokemonTypeId,
  type RunStateRecord,
  type SpeciesId,
} from "../../src/types/pokechamp-data.ts";
import type {
  GeneratedBattlePokemon,
  GeneratedDoorOffer,
  GeneratedEncounter,
  GeneratedRewardOffer,
  GeneratedStarterChoice,
} from "./rules-sandbox.ts";

export interface CompletedRunRecord {
  finalFloorType: PokemonTypeId;
  playerHistory: RunStateRecord["playerHistory"];
  playerName: string;
  runId: string;
  seed: string;
  usedBattlePokemon: BattlePokemonId[];
  usedSpecies: SpeciesId[];
  winningPokemon: CurrentRunPokemon;
}

export interface CreateRunStateOptions {
  chosenFloorType: PokemonTypeId;
  chosenStarter: GeneratedStarterChoice;
  doorOffer: GeneratedDoorOffer;
  playerName: string;
  runId: string;
  seed: string;
}

export interface AdvanceRunStateAfterVictoryOptions {
  chosenNextFloorType: PokemonTypeId;
  chosenReward: GeneratedBattlePokemon;
  doorOffer: GeneratedDoorOffer;
  encounter: GeneratedEncounter;
  rewardOffer: GeneratedRewardOffer;
  state: RunStateRecord;
}

export interface CompleteRunAfterFinalVictoryOptions {
  encounter: GeneratedEncounter;
  state: RunStateRecord;
}

export function createRunState(options: CreateRunStateOptions): RunStateRecord {
  assertNonEmptyText(options.playerName, "playerName");
  assertNonEmptyText(options.runId, "runId");
  assertNonEmptyText(options.seed, "seed");
  assertDoorChoicePresent(options.doorOffer, options.chosenFloorType);

  if (options.doorOffer.nextFloorNumber !== 1) {
    throw new Error(
      `Expected an initial door offer for floor 1, received floor ${options.doorOffer.nextFloorNumber}`,
    );
  }

  return {
    runId: options.runId,
    playerName: options.playerName,
    currentFloor: 1,
    currentFloorType: options.chosenFloorType,
    usedSpecies: [options.chosenStarter.speciesId],
    usedBattlePokemon: [options.chosenStarter.battlePokemonId],
    playerHistory: [],
    currentPokemon: toCurrentRunPokemon(options.chosenStarter),
    nextDoorTypes: toDoorTypeSet(options.doorOffer),
    seed: options.seed,
  };
}

export function advanceRunStateAfterVictory(
  options: AdvanceRunStateAfterVictoryOptions,
): RunStateRecord {
  const { state } = options;

  if (state.currentFloor >= FLOOR_LEVELS.length) {
    throw new Error(
      `Cannot advance run state from floor ${state.currentFloor}; the tower only has ${FLOOR_LEVELS.length} floors`,
    );
  }

  if (options.encounter.floorNumber !== state.currentFloor) {
    throw new Error(
      `Encounter floor ${options.encounter.floorNumber} does not match current floor ${state.currentFloor}`,
    );
  }

  if (options.encounter.floorType !== state.currentFloorType) {
    throw new Error(
      `Encounter floor type ${options.encounter.floorType} does not match current floor type ${state.currentFloorType}`,
    );
  }

  if (
    options.rewardOffer.nextFloorNumber !== state.currentFloor + 1 ||
    options.doorOffer.nextFloorNumber !== state.currentFloor + 1
  ) {
    throw new Error(
      `Expected reward and door offers for floor ${state.currentFloor + 1}`,
    );
  }

  assertRewardChoicePresent(options.rewardOffer, options.chosenReward);
  assertDoorChoicePresent(options.doorOffer, options.chosenNextFloorType);

  const usedSpecies = appendUnique(
    appendUnique(
      state.usedSpecies,
      options.encounter.enemy.speciesId,
      "encounter species",
    ),
    options.chosenReward.speciesId,
    "reward species",
  );
  const usedBattlePokemon = appendUnique(
    appendUnique(
      state.usedBattlePokemon,
      options.encounter.enemy.battlePokemonId,
      "encounter battlePokemonId",
    ),
    options.chosenReward.battlePokemonId,
    "reward battlePokemonId",
  );
  const playerHistory = [
    ...state.playerHistory,
    {
      floor: state.currentFloor,
      floorType: state.currentFloorType,
      speciesId: state.currentPokemon.speciesId,
      formId: state.currentPokemon.formId,
      level: state.currentPokemon.level,
    },
  ];

  return {
    runId: state.runId,
    playerName: state.playerName,
    currentFloor: state.currentFloor + 1,
    currentFloorType: options.chosenNextFloorType,
    usedSpecies,
    usedBattlePokemon,
    playerHistory,
    currentPokemon: toCurrentRunPokemon(options.chosenReward),
    nextDoorTypes: toDoorTypeSet(options.doorOffer),
    seed: state.seed,
  };
}

export function completeRunAfterFinalVictory(
  options: CompleteRunAfterFinalVictoryOptions,
): CompletedRunRecord {
  const { state } = options;

  if (state.currentFloor !== FLOOR_LEVELS.length) {
    throw new Error(
      `Final victory can only be completed from floor ${FLOOR_LEVELS.length}, received floor ${state.currentFloor}`,
    );
  }

  if (options.encounter.floorNumber !== state.currentFloor) {
    throw new Error(
      `Encounter floor ${options.encounter.floorNumber} does not match current floor ${state.currentFloor}`,
    );
  }

  if (options.encounter.floorType !== state.currentFloorType) {
    throw new Error(
      `Encounter floor type ${options.encounter.floorType} does not match current floor type ${state.currentFloorType}`,
    );
  }

  const usedSpecies = appendUnique(
    state.usedSpecies,
    options.encounter.enemy.speciesId,
    "final encounter species",
  );
  const usedBattlePokemon = appendUnique(
    state.usedBattlePokemon,
    options.encounter.enemy.battlePokemonId,
    "final encounter battlePokemonId",
  );
  const playerHistory = [
    ...state.playerHistory,
    {
      floor: state.currentFloor,
      floorType: state.currentFloorType,
      speciesId: state.currentPokemon.speciesId,
      formId: state.currentPokemon.formId,
      level: state.currentPokemon.level,
    },
  ];

  return {
    finalFloorType: state.currentFloorType,
    playerHistory,
    playerName: state.playerName,
    runId: state.runId,
    seed: state.seed,
    usedBattlePokemon,
    usedSpecies,
    winningPokemon: cloneCurrentRunPokemon(state.currentPokemon),
  };
}

export function getBlockedSpeciesFromRunState(
  state: RunStateRecord,
): Set<SpeciesId> {
  return new Set(state.usedSpecies);
}

export function getRemainingFloorTypesFromRunState(
  state: RunStateRecord,
): Set<PokemonTypeId> {
  const remainingTypes = new Set<PokemonTypeId>(POKEMON_TYPES);

  for (const historyEntry of state.playerHistory) {
    remainingTypes.delete(historyEntry.floorType);
  }

  remainingTypes.delete(state.currentFloorType);

  return remainingTypes;
}

function appendUnique<T extends string>(
  values: readonly T[],
  nextValue: T,
  label: string,
): T[] {
  if (values.includes(nextValue)) {
    throw new Error(`Duplicate ${label} detected: ${nextValue}`);
  }

  return [...values, nextValue];
}

function assertDoorChoicePresent(
  doorOffer: GeneratedDoorOffer,
  chosenFloorType: PokemonTypeId,
): void {
  if (!doorOffer.choices.some((choice) => choice.typeId === chosenFloorType)) {
    throw new Error(
      `Chosen floor type ${chosenFloorType} was not present in the offered doors`,
    );
  }
}

function assertNonEmptyText(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
}

function assertRewardChoicePresent(
  rewardOffer: GeneratedRewardOffer,
  chosenReward: GeneratedBattlePokemon,
): void {
  if (
    !rewardOffer.choices.some(
      (choice) => choice.battlePokemonId === chosenReward.battlePokemonId,
    )
  ) {
    throw new Error(
      `Chosen reward ${chosenReward.battlePokemonId} was not present in the reward offer`,
    );
  }
}

function cloneCurrentRunPokemon(pokemon: CurrentRunPokemon): CurrentRunPokemon {
  return {
    speciesId: pokemon.speciesId,
    formId: pokemon.formId,
    level: pokemon.level,
    moves: [...pokemon.moves] as CurrentRunPokemon["moves"],
  };
}

function toCurrentRunPokemon(
  pokemon: GeneratedBattlePokemon,
): CurrentRunPokemon {
  return {
    speciesId: pokemon.speciesId,
    formId: pokemon.formId,
    level: pokemon.level as CurrentRunPokemon["level"],
    moves: [...pokemon.moves] as CurrentRunPokemon["moves"],
  };
}

function toDoorTypeSet(doorOffer: GeneratedDoorOffer): DoorTypeSet {
  const typeIds = doorOffer.choices.map((choice) => choice.typeId);
  const firstTypeId = typeIds[0];
  const secondTypeId = typeIds[1];

  if (!firstTypeId) {
    throw new Error("Expected at least one door type");
  }

  if (!secondTypeId) {
    return [firstTypeId];
  }

  return [firstTypeId, secondTypeId];
}
