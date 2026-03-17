import pokemonDataset from "../../../data/runtime/pokemon.json";
import floorLevelDataset from "../../../data/runtime/floor-levels.json";
import movesDataset from "../../../data/runtime/moves.json";
import starterDataset from "../../../data/runtime/starters.json";
import {
  FLOOR_LEVELS,
  POKEMON_TYPES,
  type BattleReadyPokemonRecord,
  type FloorLevel,
  type FloorLevelRecord,
  type MoveRecord,
  type PokemonTypeId,
  type RunStateRecord,
  type StarterPoolRecord,
} from "../../types/pokechamp-data";
import type {
  BattleCombatantContext,
  BattleResolutionContext,
} from "./battleResolution";
import {
  createRunState,
  advanceRunStateAfterVictory,
  completeRunAfterFinalVictory,
  getBlockedSpeciesFromRunState,
  getRemainingFloorTypesFromRunState,
  type CompletedRunRecord,
} from "./runState";
import {
  RulesSandbox,
  createSeededRandom,
  type GeneratedBattlePokemon,
  type GeneratedDoorOffer,
  type GeneratedEncounter,
  type GeneratedRewardOffer,
  type GeneratedStarterChoice,
  type GeneratedStarterOffer,
} from "./rulesSandbox";

const DEFAULT_PLAYER_NAME = "Player";
const RUN_STATE_STORAGE_KEY = "pokechamp.run-state.v1";

interface PendingStarterDraft {
  playerName: string;
  seed: string;
  starterOffer: GeneratedStarterOffer;
}

interface PendingFloorAdvance {
  chosenReward: GeneratedBattlePokemon;
  currentFloor: CurrentFloorContext;
  doorOffer: GeneratedDoorOffer;
  rewardOffer: GeneratedRewardOffer;
}

export type StarterDraftContext = PendingStarterDraft;

export interface CurrentFloorContext {
  encounter: GeneratedEncounter;
  floorLevel: FloorLevel;
  playerPokemon: GeneratedBattlePokemon;
  state: RunStateRecord;
}

export interface RewardDraftContext {
  currentFloor: CurrentFloorContext;
  rewardOffer: GeneratedRewardOffer;
}

export type PendingDoorChoiceContext = PendingFloorAdvance;

export class RunRuntimeService {
  private static instance: RunRuntimeService | null = null;

  public static getInstance(): RunRuntimeService {
    if (!RunRuntimeService.instance) {
      RunRuntimeService.instance = new RunRuntimeService();
    }

    return RunRuntimeService.instance;
  }

  private pendingFloorAdvance: PendingFloorAdvance | null = null;
  private pendingStarterDraft: PendingStarterDraft | null = null;
  private readonly moveById = new Map(
    (movesDataset as MoveRecord[]).map((moveRecord) => [moveRecord.moveId, moveRecord]),
  );
  private readonly sandbox = new RulesSandbox({
    pokemon: pokemonDataset as BattleReadyPokemonRecord[],
    floorLevels: floorLevelDataset as FloorLevelRecord[],
    starters: starterDataset as StarterPoolRecord,
  });

  public beginStarterDraft(options: {
    clearSavedRun?: boolean;
    forceNew?: boolean;
    playerName?: string;
  } = {}): StarterDraftContext {
    const playerName = options.playerName?.trim() || DEFAULT_PLAYER_NAME;

    if (options.clearSavedRun) {
      this.clearRunState();
    }

    if (!options.forceNew && this.pendingStarterDraft) {
      return this.pendingStarterDraft;
    }

    const seed = createRunSeed();
    const starterOffer = this.sandbox.generateStarterOffer({
      blockedSpecies: new Set(),
      rng: createSeededRandom(this.buildStageSeed(seed, "starter-offer")),
    });

    this.pendingStarterDraft = {
      playerName,
      seed,
      starterOffer,
    };

    return this.pendingStarterDraft;
  }

  public getStarterDraft(): StarterDraftContext | null {
    return this.pendingStarterDraft;
  }

  public startRunFromStarter(
    battlePokemonId: string,
  ): { openingDoorOffer: GeneratedDoorOffer; runState: RunStateRecord } {
    const draft = this.pendingStarterDraft;

    if (!draft) {
      throw new Error("No pending starter draft exists");
    }

    const chosenStarter = this.findStarterChoice(
      draft.starterOffer,
      battlePokemonId,
    );
    const openingDoorOffer = this.sandbox.generateDoorOffer({
      blockedSpecies: new Set([chosenStarter.speciesId]),
      nextFloorNumber: 1,
      remainingFloorTypes: new Set<PokemonTypeId>(POKEMON_TYPES),
      rng: createSeededRandom(this.buildStageSeed(draft.seed, "opening-doors")),
    });
    const chosenOpeningType = pickOne(
      openingDoorOffer.choices,
      createSeededRandom(this.buildStageSeed(draft.seed, "opening-choice")),
    ).typeId;
    const runState = createRunState({
      chosenFloorType: chosenOpeningType,
      chosenStarter,
      doorOffer: openingDoorOffer,
      playerName: draft.playerName,
      runId: `run-${draft.seed}`,
      seed: draft.seed,
    });

    this.saveRunState(runState);
    this.pendingStarterDraft = null;

    return {
      openingDoorOffer,
      runState,
    };
  }

  public getRunState(): RunStateRecord | null {
    return this.loadRunState();
  }

  public getCurrentFloorContext(): CurrentFloorContext | null {
    const state = this.loadRunState();

    if (!state) {
      return null;
    }

    const floorLevel = this.sandbox.getFloorLevel(state.currentFloor);
    const playerPokemon = this.resolveCurrentPokemon(state);
    const encounter = this.sandbox.generateEncounter({
      blockedSpecies: getBlockedSpeciesFromRunState(state),
      floorNumber: state.currentFloor,
      floorType: state.currentFloorType,
      rng: createSeededRandom(
        this.buildStageSeed(state.seed, `floor-${state.currentFloor}`, "encounter"),
      ),
    });

    return {
      encounter,
      floorLevel,
      playerPokemon,
      state,
    };
  }

  public getRewardDraftContext(): RewardDraftContext | null {
    const currentFloor = this.getCurrentFloorContext();

    if (!currentFloor) {
      return null;
    }

    if (currentFloor.state.currentFloor >= FLOOR_LEVELS.length) {
      return null;
    }

    const blockedSpecies = getBlockedSpeciesFromRunState(currentFloor.state);
    const blockedSpeciesAfterEncounter = new Set(blockedSpecies);

    blockedSpeciesAfterEncounter.add(currentFloor.encounter.enemy.speciesId);

    const rewardOffer = this.sandbox.generateRewardOffer({
      blockedSpecies: blockedSpeciesAfterEncounter,
      nextFloorNumber: currentFloor.state.currentFloor + 1,
      remainingFloorTypes: getRemainingFloorTypesFromRunState(
        currentFloor.state,
      ),
      rng: createSeededRandom(
        this.buildStageSeed(
          currentFloor.state.seed,
          `floor-${currentFloor.state.currentFloor}`,
          "reward-offer",
        ),
      ),
    });

    return {
      currentFloor,
      rewardOffer,
    };
  }

  public getBattleContext(): BattleResolutionContext | null {
    const currentFloor = this.getCurrentFloorContext();

    if (!currentFloor) {
      return null;
    }

    return {
      floorLevel: currentFloor.floorLevel,
      floorNumber: currentFloor.state.currentFloor,
      floorType: currentFloor.state.currentFloorType,
      playerName: currentFloor.state.playerName,
      runId: currentFloor.state.runId,
      seed: this.buildStageSeed(
        currentFloor.state.seed,
        `floor-${currentFloor.state.currentFloor}`,
        "battle",
      ),
      usedSpeciesCount: currentFloor.state.usedSpecies.length,
      enemy: this.buildBattleCombatant(currentFloor.encounter.enemy),
      player: this.buildBattleCombatant(currentFloor.playerPokemon),
    };
  }

  public chooseReward(battlePokemonId: string): PendingDoorChoiceContext {
    const rewardDraft = this.getRewardDraftContext();

    if (!rewardDraft) {
      throw new Error("No reward offer is available for the current run state");
    }

    const chosenReward = this.findBattlePokemonChoice(
      rewardDraft.rewardOffer.choices,
      battlePokemonId,
    );
    const blockedSpecies = getBlockedSpeciesFromRunState(
      rewardDraft.currentFloor.state,
    );
    const blockedSpeciesAfterEncounter = new Set(blockedSpecies);

    blockedSpeciesAfterEncounter.add(rewardDraft.currentFloor.encounter.enemy.speciesId);

    const blockedSpeciesAfterReward = new Set(blockedSpeciesAfterEncounter);

    blockedSpeciesAfterReward.add(chosenReward.speciesId);

    const doorOffer = this.sandbox.generateDoorOffer({
      blockedSpecies: blockedSpeciesAfterReward,
      nextFloorNumber: rewardDraft.currentFloor.state.currentFloor + 1,
      remainingFloorTypes: getRemainingFloorTypesFromRunState(
        rewardDraft.currentFloor.state,
      ),
      rng: createSeededRandom(
        this.buildStageSeed(
          rewardDraft.currentFloor.state.seed,
          `floor-${rewardDraft.currentFloor.state.currentFloor}`,
          "door-offer",
          chosenReward.battlePokemonId,
        ),
      ),
    });

    this.pendingFloorAdvance = {
      chosenReward,
      currentFloor: rewardDraft.currentFloor,
      doorOffer,
      rewardOffer: rewardDraft.rewardOffer,
    };

    return this.pendingFloorAdvance;
  }

  public getPendingDoorChoiceContext(): PendingDoorChoiceContext | null {
    return this.pendingFloorAdvance;
  }

  public advanceToNextFloor(chosenFloorType: PokemonTypeId): RunStateRecord {
    const pendingAdvance = this.pendingFloorAdvance;

    if (!pendingAdvance) {
      throw new Error("No pending next-floor choice exists");
    }

    const nextRunState = advanceRunStateAfterVictory({
      chosenNextFloorType: chosenFloorType,
      chosenReward: pendingAdvance.chosenReward,
      doorOffer: pendingAdvance.doorOffer,
      encounter: pendingAdvance.currentFloor.encounter,
      rewardOffer: pendingAdvance.rewardOffer,
      state: pendingAdvance.currentFloor.state,
    });

    this.saveRunState(nextRunState);
    this.pendingFloorAdvance = null;

    return nextRunState;
  }

  public completeCurrentRun(): {
    completedRun: CompletedRunRecord;
    currentFloor: CurrentFloorContext;
  } | null {
    const currentFloor = this.getCurrentFloorContext();

    if (!currentFloor) {
      return null;
    }

    const completedRun = completeRunAfterFinalVictory({
      encounter: currentFloor.encounter,
      state: currentFloor.state,
    });

    this.clearRunState();

    return {
      completedRun,
      currentFloor,
    };
  }

  public clearRunState(): void {
    this.pendingFloorAdvance = null;
    this.pendingStarterDraft = null;
    window.localStorage.removeItem(RUN_STATE_STORAGE_KEY);
  }

  public hasSavedRun(): boolean {
    return this.loadRunState() !== null;
  }

  private buildStageSeed(baseSeed: string, ...parts: Array<string>): string {
    return [baseSeed, ...parts].join(":");
  }

  private findBattlePokemonChoice(
    choices: readonly GeneratedBattlePokemon[],
    battlePokemonId: string,
  ): GeneratedBattlePokemon {
    const choice = choices.find(
      (candidate) => candidate.battlePokemonId === battlePokemonId,
    );

    if (!choice) {
      throw new Error(`Unknown battlePokemonId "${battlePokemonId}"`);
    }

    return choice;
  }

  private findStarterChoice(
    offer: GeneratedStarterOffer,
    battlePokemonId: string,
  ): GeneratedStarterChoice {
    const choice = offer.choices.find(
      (candidate) => candidate.battlePokemonId === battlePokemonId,
    );

    if (!choice) {
      throw new Error(`Unknown starter battlePokemonId "${battlePokemonId}"`);
    }

    return choice;
  }

  private buildBattleCombatant(
    generatedPokemon: GeneratedBattlePokemon,
  ): BattleCombatantContext {
    const record = (pokemonDataset as BattleReadyPokemonRecord[]).find(
      (candidate) => candidate.battlePokemonId === generatedPokemon.battlePokemonId,
    );

    if (!record) {
      throw new Error(
        `Unable to resolve battle-ready record for ${generatedPokemon.battlePokemonId}`,
      );
    }

    const moveRecords = generatedPokemon.moves.map((moveId) => {
      const moveRecord = this.moveById.get(moveId);

      if (!moveRecord) {
        throw new Error(`Unable to resolve move record for ${moveId}`);
      }

      return moveRecord;
    });

    return {
      generated: generatedPokemon,
      moveRecords,
      record,
    };
  }

  private resolveCurrentPokemon(state: RunStateRecord): GeneratedBattlePokemon {
    const exactRecord = (
      pokemonDataset as BattleReadyPokemonRecord[]
    ).find((record) => {
      const movesetAtLevel = record.movesetsByFloorLevel[state.currentPokemon.level];

      return (
        record.speciesId === state.currentPokemon.speciesId &&
        record.formId === state.currentPokemon.formId &&
        record.legalLevelRange.min <= state.currentPokemon.level &&
        record.legalLevelRange.max >= state.currentPokemon.level &&
        !!movesetAtLevel &&
        movesetAtLevel.length === state.currentPokemon.moves.length &&
        movesetAtLevel.every(
          (moveId, index) => moveId === state.currentPokemon.moves[index],
        )
      );
    });
    const fallbackRecord = (
      pokemonDataset as BattleReadyPokemonRecord[]
    ).find(
      (record) =>
        record.speciesId === state.currentPokemon.speciesId &&
        record.formId === state.currentPokemon.formId &&
        record.legalLevelRange.min <= state.currentPokemon.level &&
        record.legalLevelRange.max >= state.currentPokemon.level,
    );
    const resolvedRecord = exactRecord ?? fallbackRecord;

    if (!resolvedRecord) {
      throw new Error(
        `Unable to resolve current run Pokemon for ${state.currentPokemon.speciesId}/${state.currentPokemon.formId} at level ${state.currentPokemon.level}`,
      );
    }

    return {
      battlePokemonId: resolvedRecord.battlePokemonId,
      speciesId: resolvedRecord.speciesId,
      formId: resolvedRecord.formId,
      name: resolvedRecord.name,
      level: state.currentPokemon.level,
      types: resolvedRecord.types,
      floorTypes: resolvedRecord.floorTypes,
      moves: [...state.currentPokemon.moves],
    };
  }

  private loadRunState(): RunStateRecord | null {
    try {
      const rawValue = window.localStorage.getItem(RUN_STATE_STORAGE_KEY);

      if (!rawValue) {
        return null;
      }

      const parsedValue = JSON.parse(rawValue) as unknown;

      if (!isRunStateRecord(parsedValue)) {
        window.localStorage.removeItem(RUN_STATE_STORAGE_KEY);

        return null;
      }

      return parsedValue;
    } catch {
      window.localStorage.removeItem(RUN_STATE_STORAGE_KEY);

      return null;
    }
  }

  private saveRunState(state: RunStateRecord): void {
    window.localStorage.setItem(RUN_STATE_STORAGE_KEY, JSON.stringify(state));
  }
}

function createRunSeed(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);

  return `${Date.now().toString(36)}-${randomPart}`;
}

function isRunStateRecord(value: unknown): value is RunStateRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RunStateRecord>;

  return (
    typeof candidate.runId === "string" &&
    typeof candidate.playerName === "string" &&
    typeof candidate.currentFloor === "number" &&
    typeof candidate.currentFloorType === "string" &&
    Array.isArray(candidate.usedSpecies) &&
    Array.isArray(candidate.usedBattlePokemon) &&
    Array.isArray(candidate.playerHistory) &&
    !!candidate.currentPokemon &&
    typeof candidate.currentPokemon === "object" &&
    Array.isArray(candidate.currentPokemon.moves) &&
    Array.isArray(candidate.nextDoorTypes) &&
    typeof candidate.seed === "string"
  );
}

function pickOne<T>(
  items: readonly T[],
  randomSource: { next(): number },
): T {
  const item = items[Math.floor(randomSource.next() * items.length)];

  if (item === undefined) {
    throw new Error("Attempted to choose from an empty collection");
  }

  return item;
}
