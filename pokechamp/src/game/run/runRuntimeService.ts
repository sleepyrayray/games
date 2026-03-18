import pokemonDataset from "../../../data/runtime/pokemon.json" with { type: "json" };
import floorLevelDataset from "../../../data/runtime/floor-levels.json" with {
  type: "json",
};
import movesDataset from "../../../data/runtime/moves.json" with { type: "json" };
import starterDataset from "../../../data/runtime/starters.json" with {
  type: "json",
};
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
} from "../../types/pokechamp-data.ts";
import {
  createBattleSession,
  normalizeBattleSessionState,
  type BattleCombatantContext,
  type BattleResolutionContext,
  type BattleSessionState,
} from "./battleResolution.ts";
import {
  createRunState,
  advanceRunStateAfterVictory,
  completeRunAfterFinalVictory,
  getBlockedSpeciesFromRunState,
  getRemainingFloorTypesFromRunState,
  type CompletedRunRecord,
} from "./runState.ts";
import {
  RulesSandbox,
  createSeededRandom,
  type GeneratedBattlePokemon,
  type GeneratedDoorOffer,
  type GeneratedEncounter,
  type GeneratedRewardOffer,
  type GeneratedStarterChoice,
  type GeneratedStarterOffer,
} from "./rulesSandbox.ts";

const DEFAULT_PLAYER_NAME = "Player";
const BATTLE_STATE_STORAGE_KEY = "pokechamp.battle-state.v1";
const PENDING_FLOOR_ADVANCE_STORAGE_KEY = "pokechamp.pending-floor-advance.v1";
const PREFERRED_PLAYER_NAME_STORAGE_KEY = "pokechamp.player-name.v1";
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

interface SavedBattleSessionRecord {
  battleState: BattleSessionState;
  enemyBattlePokemonId: string;
  floorNumber: number;
  playerBattlePokemonId: string;
  runId: string;
}

interface SavedPendingFloorAdvanceRecord {
  chosenRewardBattlePokemonId: string;
  currentEncounterBattlePokemonId: string;
  currentPlayerBattlePokemonId: string;
  doorOffer: GeneratedDoorOffer;
  floorNumber: number;
  rewardOffer: GeneratedRewardOffer;
  runId: string;
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

export interface BattleSessionContext {
  battleContext: BattleResolutionContext;
  battleState: BattleSessionState;
}

export type RunCheckpointStage =
  | "none"
  | "starter-draft"
  | "floor"
  | "battle"
  | "reward"
  | "door"
  | "final-victory";

export interface RunCheckpointSummary {
  battleSession: BattleSessionContext | null;
  currentFloor: CurrentFloorContext | null;
  pendingDoorChoice: PendingDoorChoiceContext | null;
  rewardContext: RewardDraftContext | null;
  stage: RunCheckpointStage;
  starterDraft: StarterDraftContext | null;
}

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
    moves: movesDataset as MoveRecord[],
    starters: starterDataset as StarterPoolRecord,
  });

  public beginStarterDraft(options: {
    clearSavedRun?: boolean;
    forceNew?: boolean;
    playerName?: string;
  } = {}): StarterDraftContext {
    const playerName = this.resolvePlayerName(options.playerName);

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

  public getCheckpointSummary(): RunCheckpointSummary {
    const starterDraft = this.getStarterDraft();
    const currentFloor = this.getCurrentFloorContext();

    if (!currentFloor) {
      return {
        battleSession: null,
        currentFloor: null,
        pendingDoorChoice: null,
        rewardContext: null,
        stage: starterDraft ? "starter-draft" : "none",
        starterDraft,
      };
    }

    const pendingDoorChoice = this.getPendingDoorChoiceContext();

    if (pendingDoorChoice) {
      return {
        battleSession: null,
        currentFloor,
        pendingDoorChoice,
        rewardContext: null,
        stage: "door",
        starterDraft,
      };
    }

    const battleSession = this.getBattleSession();

    if (battleSession?.battleState.outcome === "player-win") {
      return {
        battleSession,
        currentFloor,
        pendingDoorChoice: null,
        rewardContext:
          currentFloor.state.currentFloor === FLOOR_LEVELS.length
            ? null
            : this.getRewardDraftContext(),
        stage:
          currentFloor.state.currentFloor === FLOOR_LEVELS.length
            ? "final-victory"
            : "reward",
        starterDraft,
      };
    }

    if (battleSession) {
      return {
        battleSession,
        currentFloor,
        pendingDoorChoice: null,
        rewardContext: null,
        stage: "battle",
        starterDraft,
      };
    }

    return {
      battleSession: null,
      currentFloor,
      pendingDoorChoice: null,
      rewardContext: null,
      stage: "floor",
      starterDraft,
    };
  }

  public getPreferredPlayerName(): string {
    try {
      const storedValue = window.localStorage.getItem(
        PREFERRED_PLAYER_NAME_STORAGE_KEY,
      );

      return normalizePlayerName(storedValue);
    } catch {
      return DEFAULT_PLAYER_NAME;
    }
  }

  public setPreferredPlayerName(playerName: string): string {
    const normalizedName = normalizePlayerName(playerName);

    window.localStorage.setItem(
      PREFERRED_PLAYER_NAME_STORAGE_KEY,
      normalizedName,
    );

    return normalizedName;
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

    this.clearBattleSessionState();
    this.clearPendingDoorChoiceState();
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

    if (this.getPendingDoorChoiceContext()) {
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

  public beginOrResumeBattleSession(): BattleSessionContext | null {
    const battleContext = this.getBattleContext();

    if (!battleContext) {
      this.clearBattleSessionState();

      return null;
    }

    const savedSession = this.loadValidatedBattleSessionRecord(battleContext);

    if (savedSession) {
      return {
        battleContext,
        battleState: savedSession.battleState,
      };
    }

    const battleState = createBattleSession(battleContext);

    this.saveBattleSessionRecord({
      battleState,
      battleContext,
    });

    return {
      battleContext,
      battleState,
    };
  }

  public beginChallengeBattleSession(): BattleSessionContext | null {
    const battleContext = this.getBattleContext();

    if (!battleContext) {
      this.clearBattleSessionState();

      return null;
    }

    const savedSession = this.loadValidatedBattleSessionRecord(battleContext);

    if (savedSession && !savedSession.battleState.outcome) {
      return {
        battleContext,
        battleState: savedSession.battleState,
      };
    }

    if (savedSession?.battleState.outcome) {
      this.clearBattleSessionState();
    }

    const battleState = createBattleSession(battleContext);

    this.saveBattleSessionRecord({
      battleState,
      battleContext,
    });

    return {
      battleContext,
      battleState,
    };
  }

  public getBattleSession(): BattleSessionContext | null {
    const battleContext = this.getBattleContext();

    if (!battleContext) {
      this.clearBattleSessionState();

      return null;
    }

    const savedSession = this.loadValidatedBattleSessionRecord(battleContext);

    if (!savedSession) {
      return null;
    }

    return {
      battleContext,
      battleState: savedSession.battleState,
    };
  }

  public saveBattleSessionState(battleState: BattleSessionState): void {
    const battleContext = this.getBattleContext();

    if (!battleContext) {
      throw new Error("No active battle context exists to save");
    }

    this.saveBattleSessionRecord({
      battleState,
      battleContext,
    });
  }

  public clearBattleSessionState(): void {
    window.localStorage.removeItem(BATTLE_STATE_STORAGE_KEY);
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
    this.clearBattleSessionState();
    this.savePendingDoorChoiceRecord(this.pendingFloorAdvance);

    return this.pendingFloorAdvance;
  }

  public getPendingDoorChoiceContext(): PendingDoorChoiceContext | null {
    if (this.pendingFloorAdvance) {
      return this.pendingFloorAdvance;
    }

    const currentFloor = this.getCurrentFloorContext();

    if (!currentFloor) {
      this.clearPendingDoorChoiceState();

      return null;
    }

    const savedPendingChoice =
      this.loadValidatedPendingDoorChoiceRecord(currentFloor);

    if (!savedPendingChoice) {
      return null;
    }

    const chosenReward = savedPendingChoice.rewardOffer.choices.find(
      (choice) =>
        choice.battlePokemonId === savedPendingChoice.chosenRewardBattlePokemonId,
    );

    if (!chosenReward) {
      this.clearPendingDoorChoiceState();

      return null;
    }

    this.pendingFloorAdvance = {
      chosenReward,
      currentFloor,
      doorOffer: savedPendingChoice.doorOffer,
      rewardOffer: savedPendingChoice.rewardOffer,
    };

    return this.pendingFloorAdvance;
  }

  public advanceToNextFloor(chosenFloorType: PokemonTypeId): RunStateRecord {
    const pendingAdvance = this.getPendingDoorChoiceContext();

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
    this.clearPendingDoorChoiceState();
    this.clearBattleSessionState();

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
    this.clearBattleSessionState();
    this.clearPendingDoorChoiceState();
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

  private clearPendingDoorChoiceState(): void {
    window.localStorage.removeItem(PENDING_FLOOR_ADVANCE_STORAGE_KEY);
  }

  private loadBattleSessionRecord(): SavedBattleSessionRecord | null {
    try {
      const rawValue = window.localStorage.getItem(BATTLE_STATE_STORAGE_KEY);

      if (!rawValue) {
        return null;
      }

      const parsedValue = JSON.parse(rawValue) as unknown;

      if (!isSavedBattleSessionRecord(parsedValue)) {
        this.clearBattleSessionState();

        return null;
      }

      return parsedValue;
    } catch {
      this.clearBattleSessionState();

      return null;
    }
  }

  private loadPendingDoorChoiceRecord(): SavedPendingFloorAdvanceRecord | null {
    try {
      const rawValue = window.localStorage.getItem(
        PENDING_FLOOR_ADVANCE_STORAGE_KEY,
      );

      if (!rawValue) {
        return null;
      }

      const parsedValue = JSON.parse(rawValue) as unknown;

      if (!isSavedPendingFloorAdvanceRecord(parsedValue)) {
        this.clearPendingDoorChoiceState();

        return null;
      }

      return parsedValue;
    } catch {
      this.clearPendingDoorChoiceState();

      return null;
    }
  }

  private loadValidatedBattleSessionRecord(
    battleContext: BattleResolutionContext,
  ): SavedBattleSessionRecord | null {
    const savedSession = this.loadBattleSessionRecord();

    if (!savedSession) {
      return null;
    }

    if (
      savedSession.runId !== battleContext.runId ||
      savedSession.floorNumber !== battleContext.floorNumber ||
      savedSession.enemyBattlePokemonId !==
        battleContext.enemy.generated.battlePokemonId ||
      savedSession.playerBattlePokemonId !==
        battleContext.player.generated.battlePokemonId
    ) {
      this.clearBattleSessionState();

      return null;
    }

    return {
      ...savedSession,
      battleState: normalizeBattleSessionState(savedSession.battleState),
    };
  }

  private loadValidatedPendingDoorChoiceRecord(
    currentFloor: CurrentFloorContext,
  ): SavedPendingFloorAdvanceRecord | null {
    const savedPendingChoice = this.loadPendingDoorChoiceRecord();

    if (!savedPendingChoice) {
      return null;
    }

    if (
      savedPendingChoice.runId !== currentFloor.state.runId ||
      savedPendingChoice.floorNumber !== currentFloor.state.currentFloor ||
      savedPendingChoice.currentEncounterBattlePokemonId !==
        currentFloor.encounter.enemy.battlePokemonId ||
      savedPendingChoice.currentPlayerBattlePokemonId !==
        currentFloor.playerPokemon.battlePokemonId
    ) {
      this.clearPendingDoorChoiceState();

      return null;
    }

    return savedPendingChoice;
  }

  private saveBattleSessionRecord(options: {
    battleContext: BattleResolutionContext;
    battleState: BattleSessionState;
  }): void {
    const record: SavedBattleSessionRecord = {
      battleState: options.battleState,
      enemyBattlePokemonId: options.battleContext.enemy.generated.battlePokemonId,
      floorNumber: options.battleContext.floorNumber,
      playerBattlePokemonId: options.battleContext.player.generated.battlePokemonId,
      runId: options.battleContext.runId,
    };

    window.localStorage.setItem(BATTLE_STATE_STORAGE_KEY, JSON.stringify(record));
  }

  private savePendingDoorChoiceRecord(pendingAdvance: PendingFloorAdvance): void {
    const record: SavedPendingFloorAdvanceRecord = {
      chosenRewardBattlePokemonId: pendingAdvance.chosenReward.battlePokemonId,
      currentEncounterBattlePokemonId:
        pendingAdvance.currentFloor.encounter.enemy.battlePokemonId,
      currentPlayerBattlePokemonId:
        pendingAdvance.currentFloor.playerPokemon.battlePokemonId,
      doorOffer: pendingAdvance.doorOffer,
      floorNumber: pendingAdvance.currentFloor.state.currentFloor,
      rewardOffer: pendingAdvance.rewardOffer,
      runId: pendingAdvance.currentFloor.state.runId,
    };

    window.localStorage.setItem(
      PENDING_FLOOR_ADVANCE_STORAGE_KEY,
      JSON.stringify(record),
    );
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

  private resolvePlayerName(playerName?: string): string {
    if (playerName && playerName.trim().length > 0) {
      return this.setPreferredPlayerName(playerName);
    }

    return this.getPreferredPlayerName();
  }
}

function createRunSeed(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);

  return `${Date.now().toString(36)}-${randomPart}`;
}

function normalizePlayerName(playerName: string | null | undefined): string {
  const trimmedName = playerName?.trim();

  if (!trimmedName) {
    return DEFAULT_PLAYER_NAME;
  }

  return trimmedName.slice(0, 12);
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

function isBattleSessionState(value: unknown): value is BattleSessionState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<BattleSessionState>;

  return (
    typeof candidate.enemyCurrentHp === "number" &&
    typeof candidate.playerCurrentHp === "number" &&
    !!candidate.enemyStats &&
    typeof candidate.enemyStats === "object" &&
    !!candidate.playerStats &&
    typeof candidate.playerStats === "object" &&
    Array.isArray(candidate.turns) &&
    typeof candidate.turnsResolved === "number"
  );
}

function isSavedBattleSessionRecord(
  value: unknown,
): value is SavedBattleSessionRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SavedBattleSessionRecord>;

  return (
    typeof candidate.runId === "string" &&
    typeof candidate.floorNumber === "number" &&
    typeof candidate.playerBattlePokemonId === "string" &&
    typeof candidate.enemyBattlePokemonId === "string" &&
    isBattleSessionState(candidate.battleState)
  );
}

function isSavedPendingFloorAdvanceRecord(
  value: unknown,
): value is SavedPendingFloorAdvanceRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SavedPendingFloorAdvanceRecord>;

  return (
    typeof candidate.runId === "string" &&
    typeof candidate.floorNumber === "number" &&
    typeof candidate.chosenRewardBattlePokemonId === "string" &&
    typeof candidate.currentEncounterBattlePokemonId === "string" &&
    typeof candidate.currentPlayerBattlePokemonId === "string" &&
    !!candidate.rewardOffer &&
    typeof candidate.rewardOffer === "object" &&
    Array.isArray(candidate.rewardOffer.choices) &&
    !!candidate.doorOffer &&
    typeof candidate.doorOffer === "object" &&
    Array.isArray(candidate.doorOffer.choices)
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
