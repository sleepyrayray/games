import {
  FLOOR_LEVELS,
  POKEMON_TYPES,
  type BattleReadyPokemonRecord,
  type FloorLevel,
  type FloorLevelRecord,
  type MoveRecord,
  type MoveSet,
  type PokemonDataset,
  type PokemonTypeId,
  type RunStateRecord,
  type SpeciesId,
  type StarterPoolRecord,
} from "../../src/types/pokechamp-data.ts";
import {
  advanceRunStateAfterVictory,
  completeRunAfterFinalVictory,
  createRunState,
  getBlockedSpeciesFromRunState,
  getRemainingFloorTypesFromRunState,
  type CompletedRunRecord,
} from "./run-state.ts";

const STARTER_TYPES = ["grass", "fire", "water"] as const;
const ENEMY_LEVEL_OFFSET = 2;
const TYPE_INDEX = new Map(
  POKEMON_TYPES.map((typeId, index) => [typeId, index] as const),
);

type StarterType = (typeof STARTER_TYPES)[number];

interface SpeciesBucket {
  speciesId: SpeciesId;
  records: BattleReadyPokemonRecord[];
}

export interface RandomSource {
  next(): number;
}

export interface RulesSandboxData {
  pokemon: PokemonDataset;
  floorLevels: FloorLevelRecord[];
  moves: MoveRecord[];
  starters: StarterPoolRecord;
}

export interface GeneratedBattlePokemon {
  battlePokemonId: string;
  speciesId: SpeciesId;
  formId: string;
  name: string;
  level: number;
  types: BattleReadyPokemonRecord["types"];
  floorTypes: BattleReadyPokemonRecord["floorTypes"];
  moves: MoveSet;
}

export interface GeneratedStarterChoice extends GeneratedBattlePokemon {
  starterType: StarterType;
}

export interface GeneratedStarterOffer {
  floorNumber: 1;
  level: FloorLevel;
  choices: [
    GeneratedStarterChoice,
    GeneratedStarterChoice,
    GeneratedStarterChoice,
  ];
}

export interface GeneratedEncounter {
  floorNumber: number;
  floorType: PokemonTypeId;
  availableSpeciesCount: number;
  availableFormCount: number;
  enemy: GeneratedBattlePokemon;
}

export interface GeneratedRewardOffer {
  nextFloorNumber: number;
  nextFloorLevel: FloorLevel;
  availableSpeciesCount: number;
  availableFormCount: number;
  choices: [
    GeneratedBattlePokemon,
    GeneratedBattlePokemon,
    GeneratedBattlePokemon,
  ];
}

export interface GeneratedDoorChoice {
  typeId: PokemonTypeId;
  availableEncounterSpeciesCount: number;
  availableEncounterFormCount: number;
}

export interface GeneratedDoorOffer {
  nextFloorNumber: number;
  nextFloorLevel: FloorLevel;
  viableTypeCount: number;
  choices: [GeneratedDoorChoice] | [GeneratedDoorChoice, GeneratedDoorChoice];
}

export interface SimulatedFloor {
  floorNumber: number;
  floorLevel: FloorLevel;
  floorType: PokemonTypeId;
  playerPokemon: GeneratedBattlePokemon;
  encounter: GeneratedEncounter;
  rewardOffer?: GeneratedRewardOffer;
  chosenReward?: GeneratedBattlePokemon;
  doorOffer?: GeneratedDoorOffer;
  chosenNextFloorType?: PokemonTypeId;
}

export type RunFailureKind =
  | "invalid-data"
  | "invalid-starter"
  | "duplicate-species"
  | "missing-encounter"
  | "illegal-encounter"
  | "missing-reward-choices"
  | "illegal-reward"
  | "dead-end-floor";

export interface RunFailure {
  kind: RunFailureKind;
  message: string;
  floorNumber?: number;
  details?: Record<string, unknown>;
}

export type SimulationStrategy = "random" | "scarcity-first";

export interface SimulateTowerRunOptions {
  seed: string;
  strategy?: SimulationStrategy;
}

export interface SimulatedRun {
  completedRun: CompletedRunRecord | null;
  seed: string;
  strategy: SimulationStrategy;
  starterOffer: GeneratedStarterOffer | null;
  chosenStarter: GeneratedStarterChoice | null;
  floors: SimulatedFloor[];
  runStateHistory: RunStateRecord[];
  usedSpecies: SpeciesId[];
}

export type SimulatedRunResult =
  | {
      status: "completed";
      run: SimulatedRun;
    }
  | {
      status: "failed";
      run: SimulatedRun;
      failure: RunFailure;
    };

class RulesSandboxError extends Error {
  readonly details?: Record<string, unknown>;
  readonly floorNumber?: number;
  readonly kind: RunFailureKind;

  constructor(
    kind: RunFailureKind,
    message: string,
    options: {
      details?: Record<string, unknown>;
      floorNumber?: number;
    } = {},
  ) {
    super(message);
    this.name = "RulesSandboxError";
    this.kind = kind;
    this.details = options.details;
    this.floorNumber = options.floorNumber;
  }
}

export class RulesSandbox {
  private readonly encounterPoolsByLevelAndType = new Map<
    FloorLevel,
    Map<PokemonTypeId, SpeciesBucket[]>
  >();
  private readonly data: RulesSandboxData;
  private readonly floorLevelByNumber = new Map<number, FloorLevel>();
  private readonly moveById: ReadonlyMap<string, MoveRecord>;
  private readonly rewardPoolsByLevel = new Map<FloorLevel, SpeciesBucket[]>();
  private readonly starterPoolsByType: Record<StarterType, SpeciesBucket[]>;

  constructor(data: RulesSandboxData) {
    this.data = data;
    this.moveById = new Map(data.moves.map((move) => [move.moveId, move] as const));
    this.validateFloorLevels();

    for (const level of FLOOR_LEVELS) {
      const legalRewardRecords = this.data.pokemon
        .filter((record) => isRecordLegalAtLevel(record, level))
        .sort(compareBattlePokemonRecords);
      const encounterLevel = getEncounterLevelForFloorLevel(level);
      const legalEncounterRecords = this.data.pokemon
        .filter((record) => isRecordLegalAtLevel(record, encounterLevel))
        .sort(compareBattlePokemonRecords);

      this.rewardPoolsByLevel.set(level, bucketRecordsBySpecies(legalRewardRecords));

      const encounterPoolsByType = new Map<PokemonTypeId, SpeciesBucket[]>();

      for (const typeId of POKEMON_TYPES) {
        const typeRecords = legalEncounterRecords.filter((record) =>
          record.floorTypes.includes(typeId),
        );
        encounterPoolsByType.set(typeId, bucketRecordsBySpecies(typeRecords));
      }

      this.encounterPoolsByLevelAndType.set(level, encounterPoolsByType);
    }

    this.starterPoolsByType = {
      grass: this.buildStarterBuckets("grass"),
      fire: this.buildStarterBuckets("fire"),
      water: this.buildStarterBuckets("water"),
    };
  }

  generateStarterOffer({
    blockedSpecies,
    rng,
  }: {
    blockedSpecies: ReadonlySet<SpeciesId>;
    rng: RandomSource;
  }): GeneratedStarterOffer {
    const starterLevel = this.getFloorLevel(1);
    const choices = STARTER_TYPES.map((starterType) => {
      const candidates = filterBucketsByBlockedSpecies(
        this.starterPoolsByType[starterType],
        blockedSpecies,
      );
      const preferredCandidates = this.getPreferredStarterBuckets(
        candidates,
        starterLevel,
      );

      if (preferredCandidates.length === 0) {
        throw new RulesSandboxError(
          "invalid-starter",
          `No legal ${starterType} starter candidates remain`,
          {
            details: {
              blockedSpeciesCount: blockedSpecies.size,
              starterType,
            },
          },
        );
      }

      const chosenBucket = pickOne(preferredCandidates, rng);
      const chosenRecord = pickOne(chosenBucket.records, rng);

      return {
        ...toGeneratedBattlePokemon(chosenRecord, starterLevel),
        starterType,
      };
    }) as GeneratedStarterOffer["choices"];

    assertUniqueSpecies(
      choices.map((choice) => choice.speciesId),
      "Starter offer produced duplicate species",
      "invalid-starter",
    );

    return {
      floorNumber: 1,
      level: starterLevel,
      choices,
    };
  }

  generateEncounter({
    blockedSpecies,
    floorNumber,
    floorType,
    rng,
  }: {
    blockedSpecies: ReadonlySet<SpeciesId>;
    floorNumber: number;
    floorType: PokemonTypeId;
    rng: RandomSource;
  }): GeneratedEncounter {
    const floorLevel = this.getFloorLevel(floorNumber);
    const encounterLevel = getEncounterLevelForFloorLevel(floorLevel);
    const candidateBuckets = this.getEncounterCandidateBuckets(
      floorLevel,
      floorType,
      blockedSpecies,
    );

    if (candidateBuckets.length === 0) {
      throw new RulesSandboxError(
        "missing-encounter",
        `No legal encounter candidates remain for floor ${floorNumber} (${floorType})`,
        {
          details: {
            blockedSpeciesCount: blockedSpecies.size,
            encounterLevel,
            floorLevel,
            floorType,
          },
          floorNumber,
        },
      );
    }

    const chosenBucket = pickOne(candidateBuckets, rng);
    const chosenRecord = pickOne(chosenBucket.records, rng);
    const enemy = toGeneratedBattlePokemon(chosenRecord, encounterLevel);

    if (!enemy.floorTypes.includes(floorType)) {
      throw new RulesSandboxError(
        "illegal-encounter",
        `Encounter ${enemy.battlePokemonId} does not match floor type ${floorType}`,
        {
          details: {
            battlePokemonId: enemy.battlePokemonId,
            enemyFloorTypes: enemy.floorTypes,
            floorType,
          },
          floorNumber,
        },
      );
    }

    if (blockedSpecies.has(enemy.speciesId)) {
      throw new RulesSandboxError(
        "duplicate-species",
        `Encounter ${enemy.battlePokemonId} re-used blocked species ${enemy.speciesId}`,
        {
          details: {
            battlePokemonId: enemy.battlePokemonId,
            speciesId: enemy.speciesId,
          },
          floorNumber,
        },
      );
    }

    return {
      floorNumber,
      floorType,
      availableSpeciesCount: candidateBuckets.length,
      availableFormCount: countRecords(candidateBuckets),
      enemy,
    };
  }

  generateRewardOffer({
    blockedSpecies,
    nextFloorNumber,
    remainingFloorTypes,
    rng,
  }: {
    blockedSpecies: ReadonlySet<SpeciesId>;
    nextFloorNumber: number;
    remainingFloorTypes: ReadonlySet<PokemonTypeId>;
    rng: RandomSource;
  }): GeneratedRewardOffer {
    const nextFloorLevel = this.getFloorLevel(nextFloorNumber);
    const candidateBuckets = this.getRewardCandidateBuckets(
      nextFloorLevel,
      blockedSpecies,
      remainingFloorTypes,
      nextFloorNumber,
    );

    if (candidateBuckets.length < 3) {
      throw new RulesSandboxError(
        "missing-reward-choices",
        `Only ${candidateBuckets.length} legal reward species remain for floor ${nextFloorNumber}`,
        {
          details: {
            availableSpeciesCount: candidateBuckets.length,
            availableFormCount: countRecords(candidateBuckets),
            blockedSpeciesCount: blockedSpecies.size,
            nextFloorLevel,
            nextFloorNumber,
            remainingFloorTypes: sortTypeIds([...remainingFloorTypes]),
          },
          floorNumber: nextFloorNumber - 1,
        },
      );
    }

    const preferredCandidateBuckets = this.getPreferredRewardCandidateBuckets(
      candidateBuckets,
      nextFloorLevel,
      nextFloorNumber,
    );
    const choices =
      this.selectRewardChoicesWithUniqueTypes(
        preferredCandidateBuckets,
        nextFloorLevel,
        rng,
      ) ??
      (preferredCandidateBuckets === candidateBuckets
        ? null
        : this.selectRewardChoicesWithUniqueTypes(
            candidateBuckets,
            nextFloorLevel,
            rng,
          ));

    if (!choices) {
      throw new RulesSandboxError(
        "missing-reward-choices",
        `Could not form 3 legal reward choices with unique typings for floor ${nextFloorNumber}`,
        {
          details: {
            availableSpeciesCount: candidateBuckets.length,
            availableFormCount: countRecords(candidateBuckets),
            blockedSpeciesCount: blockedSpecies.size,
            distinctTypingCount: countDistinctRewardTypingKeys(candidateBuckets),
            nextFloorLevel,
            nextFloorNumber,
            remainingFloorTypes: sortTypeIds([...remainingFloorTypes]),
          },
          floorNumber: nextFloorNumber - 1,
        },
      );
    }

    assertUniqueSpecies(
      choices.map((choice) => choice.speciesId),
      "Reward offer produced duplicate species",
      "illegal-reward",
      nextFloorNumber - 1,
    );
    assertUniqueRewardTypes(choices, nextFloorNumber - 1);

    for (const choice of choices) {
      if (blockedSpecies.has(choice.speciesId)) {
        throw new RulesSandboxError(
          "duplicate-species",
          `Reward ${choice.battlePokemonId} re-used blocked species ${choice.speciesId}`,
          {
            details: {
              battlePokemonId: choice.battlePokemonId,
              speciesId: choice.speciesId,
            },
            floorNumber: nextFloorNumber - 1,
          },
        );
      }
    }

    return {
      nextFloorNumber,
      nextFloorLevel,
      availableSpeciesCount: candidateBuckets.length,
      availableFormCount: countRecords(candidateBuckets),
      choices,
    };
  }

  generateDoorOffer({
    blockedSpecies,
    nextFloorNumber,
    remainingFloorTypes,
    rng,
  }: {
    blockedSpecies: ReadonlySet<SpeciesId>;
    nextFloorNumber: number;
    remainingFloorTypes: ReadonlySet<PokemonTypeId>;
    rng: RandomSource;
  }): GeneratedDoorOffer {
    const nextFloorLevel = this.getFloorLevel(nextFloorNumber);
    const viableChoices = this.getViableFloorTypeChoices(
      nextFloorLevel,
      blockedSpecies,
      remainingFloorTypes,
    );
    const requiredChoiceCount = Math.min(2, remainingFloorTypes.size);

    if (viableChoices.length < requiredChoiceCount) {
      throw new RulesSandboxError(
        "dead-end-floor",
        `Only ${viableChoices.length} viable next floor types remain for floor ${nextFloorNumber}`,
        {
          details: {
            nextFloorLevel,
            nextFloorNumber,
            remainingFloorTypes: sortTypeIds([...remainingFloorTypes]),
            viableChoices,
          },
          floorNumber: nextFloorNumber - 1,
        },
      );
    }

    const sampledChoices = sampleWithoutReplacement(
      viableChoices,
      requiredChoiceCount,
      rng,
    ).sort(compareDoorChoices) as GeneratedDoorOffer["choices"];

    return {
      nextFloorNumber,
      nextFloorLevel,
      viableTypeCount: viableChoices.length,
      choices: sampledChoices,
    };
  }

  getFloorLevel(floorNumber: number): FloorLevel {
    const floorLevel = this.floorLevelByNumber.get(floorNumber);

    if (floorLevel === undefined) {
      throw new RulesSandboxError(
        "invalid-data",
        `Unknown floor number ${floorNumber}`,
        {
          details: {
            floorNumber,
          },
        },
      );
    }

    return floorLevel;
  }

  getViableFloorTypeChoices(
    floorLevel: FloorLevel,
    blockedSpecies: ReadonlySet<SpeciesId>,
    remainingFloorTypes: ReadonlySet<PokemonTypeId>,
  ): GeneratedDoorChoice[] {
    return sortTypeIds([...remainingFloorTypes])
      .map((typeId) => {
        const candidateBuckets = this.getEncounterCandidateBuckets(
          floorLevel,
          typeId,
          blockedSpecies,
        );

        if (candidateBuckets.length === 0) {
          return null;
        }

        return {
          typeId,
          availableEncounterSpeciesCount: candidateBuckets.length,
          availableEncounterFormCount: countRecords(candidateBuckets),
        };
      })
      .filter((choice): choice is GeneratedDoorChoice => choice !== null)
      .sort(compareDoorChoices);
  }

  private buildStarterBuckets(starterType: StarterType): SpeciesBucket[] {
    const starterLevel = this.getFloorLevel(1);
    const rewardBuckets = this.rewardPoolsByLevel.get(starterLevel);

    if (!rewardBuckets) {
      throw new RulesSandboxError(
        "invalid-data",
        `Missing reward pool for starter level ${starterLevel}`,
      );
    }

    return this.data.starters[starterType]
      .map((speciesId) => {
        const bucket = rewardBuckets.find(
          (rewardBucket) => rewardBucket.speciesId === speciesId,
        );

        if (!bucket) {
          throw new RulesSandboxError(
            "invalid-data",
            `Starter species ${speciesId} is not legal at level ${starterLevel}`,
            {
              details: {
                speciesId,
                starterType,
              },
            },
          );
        }

        return bucket;
      })
      .sort(compareSpeciesBuckets);
  }

  private getPreferredStarterBuckets(
    candidateBuckets: SpeciesBucket[],
    starterLevel: FloorLevel,
  ): SpeciesBucket[] {
    const preferredBuckets = candidateBuckets
      .map((bucket) => ({
        speciesId: bucket.speciesId,
        records: bucket.records.filter((record) =>
          isPreferredStarterRecord(record, starterLevel, this.moveById),
        ),
      }))
      .filter((bucket) => bucket.records.length > 0);

    return preferredBuckets.length > 0 ? preferredBuckets : candidateBuckets;
  }

  private getPreferredRewardCandidateBuckets(
    candidateBuckets: SpeciesBucket[],
    nextFloorLevel: FloorLevel,
    nextFloorNumber: number,
  ): SpeciesBucket[] {
    if (nextFloorNumber > 3) {
      return candidateBuckets;
    }

    const preferredBuckets = candidateBuckets
      .map((bucket) => ({
        speciesId: bucket.speciesId,
        records: bucket.records.filter((record) =>
          isPreferredEarlyRewardRecord(record, nextFloorLevel, this.moveById),
        ),
      }))
      .filter((bucket) => bucket.records.length > 0);

    if (
      preferredBuckets.length < 3 ||
      countDistinctRewardTypingKeys(preferredBuckets) < 3
    ) {
      return candidateBuckets;
    }

    return preferredBuckets;
  }

  private getEncounterCandidateBuckets(
    floorLevel: FloorLevel,
    floorType: PokemonTypeId,
    blockedSpecies: ReadonlySet<SpeciesId>,
  ): SpeciesBucket[] {
    const encounterPoolsByType =
      this.encounterPoolsByLevelAndType.get(floorLevel);
    const encounterBuckets = encounterPoolsByType?.get(floorType);

    if (!encounterBuckets) {
      throw new RulesSandboxError(
        "invalid-data",
        `Missing encounter pool for level ${floorLevel} and type ${floorType}`,
        {
          details: {
            floorLevel,
            floorType,
          },
        },
      );
    }

    return filterBucketsByBlockedSpecies(encounterBuckets, blockedSpecies);
  }

  private getRewardCandidateBuckets(
    nextFloorLevel: FloorLevel,
    blockedSpecies: ReadonlySet<SpeciesId>,
    remainingFloorTypes: ReadonlySet<PokemonTypeId>,
    nextFloorNumber: number,
  ): SpeciesBucket[] {
    const rewardBuckets = this.rewardPoolsByLevel.get(nextFloorLevel);

    if (!rewardBuckets) {
      throw new RulesSandboxError(
        "invalid-data",
        `Missing reward pool for floor level ${nextFloorLevel}`,
        {
          details: {
            nextFloorLevel,
          },
        },
      );
    }

    const requiredChoiceCount = Math.min(2, remainingFloorTypes.size);

    return filterBucketsByBlockedSpecies(rewardBuckets, blockedSpecies)
      .filter((bucket) => {
        const blockedSpeciesAfterChoice = cloneSetWithSpecies(
          blockedSpecies,
          bucket.speciesId,
        );
        const viableTypes = this.getViableFloorTypeChoices(
          nextFloorLevel,
          blockedSpeciesAfterChoice,
          remainingFloorTypes,
        );

        return viableTypes.length >= requiredChoiceCount;
      })
      .sort(compareSpeciesBuckets)
      .map((bucket) => {
        if (bucket.records.length === 0) {
          throw new RulesSandboxError(
            "illegal-reward",
            `Reward species ${bucket.speciesId} has no legal forms at floor ${nextFloorNumber}`,
            {
              details: {
                nextFloorLevel,
                nextFloorNumber,
                speciesId: bucket.speciesId,
              },
              floorNumber: nextFloorNumber - 1,
            },
          );
        }

        return bucket;
      });
  }

  private selectRewardChoicesWithUniqueTypes(
    candidateBuckets: SpeciesBucket[],
    nextFloorLevel: FloorLevel,
    rng: RandomSource,
  ): GeneratedRewardOffer["choices"] | null {
    const shuffledBuckets = sampleWithoutReplacement(
      candidateBuckets,
      candidateBuckets.length,
      rng,
    ).map((bucket) => ({
      speciesId: bucket.speciesId,
      records: getDistinctTypingRecords(bucket, rng),
    }));
    const selectedRecords = selectUniqueTypeRewardRecords({
      buckets: shuffledBuckets,
      selectedRecords: [],
      startIndex: 0,
      usedTypes: new Set(),
    });

    if (!selectedRecords) {
      return null;
    }

    return selectedRecords.map((record) =>
      toGeneratedBattlePokemon(record, nextFloorLevel),
    ) as GeneratedRewardOffer["choices"];
  }

  private validateFloorLevels(): void {
    const sortedFloorLevels = [...this.data.floorLevels].sort(
      (left, right) => left.floorNumber - right.floorNumber,
    );

    if (sortedFloorLevels.length !== FLOOR_LEVELS.length) {
      throw new RulesSandboxError(
        "invalid-data",
        `Expected ${FLOOR_LEVELS.length} floor levels, received ${sortedFloorLevels.length}`,
      );
    }

    for (const [index, floorRecord] of sortedFloorLevels.entries()) {
      const expectedLevel = FLOOR_LEVELS[index];
      const expectedFloorNumber = index + 1;

      if (
        expectedLevel === undefined ||
        floorRecord.floorNumber !== expectedFloorNumber ||
        floorRecord.level !== expectedLevel
      ) {
        throw new RulesSandboxError(
          "invalid-data",
          `Floor level mismatch at floor ${expectedFloorNumber}`,
          {
            details: {
              actual: floorRecord,
              expectedFloorNumber,
              expectedLevel,
            },
          },
        );
      }

      this.floorLevelByNumber.set(floorRecord.floorNumber, floorRecord.level);
    }
  }
}

export function createSeededRandom(seed: string): RandomSource {
  const seedGenerator = xmur3(seed);
  const nextValue = mulberry32(seedGenerator());

  return {
    next: () => nextValue(),
  };
}

export function simulateTowerRun(
  sandbox: RulesSandbox,
  options: SimulateTowerRunOptions,
): SimulatedRunResult {
  const strategy = options.strategy ?? "random";
  const rng = createSeededRandom(options.seed);
  const run: SimulatedRun = {
    completedRun: null,
    seed: options.seed,
    strategy,
    starterOffer: null,
    chosenStarter: null,
    floors: [],
    runStateHistory: [],
    usedSpecies: [],
  };
  let currentRunState: RunStateRecord | null = null;

  try {
    const starterOffer = sandbox.generateStarterOffer({
      blockedSpecies: new Set<SpeciesId>(),
      rng,
    });
    const chosenStarter = selectStarterChoice(starterOffer, rng);
    const initialBlockedSpecies = new Set<SpeciesId>([chosenStarter.speciesId]);
    const initialDoorOffer = sandbox.generateDoorOffer({
      blockedSpecies: initialBlockedSpecies,
      nextFloorNumber: 1,
      remainingFloorTypes: new Set<PokemonTypeId>(POKEMON_TYPES),
      rng,
    });
    const chosenInitialFloorType = selectDoorChoice(
      initialDoorOffer,
      rng,
      strategy,
    ).typeId;

    run.starterOffer = starterOffer;
    run.chosenStarter = chosenStarter;
    currentRunState = createRunState({
      chosenFloorType: chosenInitialFloorType,
      chosenStarter,
      doorOffer: initialDoorOffer,
      playerName: "Simulation",
      runId: `sim-${options.seed}`,
      seed: options.seed,
    });
    run.runStateHistory.push(currentRunState);

    let currentPokemon: GeneratedBattlePokemon = chosenStarter;

    for (
      let floorNumber = 1;
      floorNumber <= FLOOR_LEVELS.length;
      floorNumber += 1
    ) {
      if (!currentRunState) {
        throw new Error("Missing run state before floor simulation");
      }

      const floorLevel = sandbox.getFloorLevel(floorNumber);
      const blockedSpecies = getBlockedSpeciesFromRunState(currentRunState);

      const encounter = sandbox.generateEncounter({
        blockedSpecies,
        floorNumber,
        floorType: currentRunState.currentFloorType,
        rng,
      });

      const floorRecord: SimulatedFloor = {
        floorNumber,
        floorLevel,
        floorType: currentRunState.currentFloorType,
        playerPokemon: currentPokemon,
        encounter,
      };

      if (floorNumber < FLOOR_LEVELS.length) {
        const nextFloorNumber = floorNumber + 1;
        const remainingFloorTypes =
          getRemainingFloorTypesFromRunState(currentRunState);
        const blockedSpeciesAfterEncounter = cloneSetWithSpecies(
          blockedSpecies,
          encounter.enemy.speciesId,
        );
        const rewardOffer = sandbox.generateRewardOffer({
          blockedSpecies: blockedSpeciesAfterEncounter,
          nextFloorNumber,
          remainingFloorTypes,
          rng,
        });
        const chosenReward = selectRewardChoice(
          rewardOffer,
          sandbox,
          blockedSpeciesAfterEncounter,
          remainingFloorTypes,
          rng,
          strategy,
        );
        const blockedSpeciesAfterReward = cloneSetWithSpecies(
          blockedSpeciesAfterEncounter,
          chosenReward.speciesId,
        );

        const doorOffer = sandbox.generateDoorOffer({
          blockedSpecies: blockedSpeciesAfterReward,
          nextFloorNumber,
          remainingFloorTypes,
          rng,
        });
        const chosenNextFloorType = selectDoorChoice(
          doorOffer,
          rng,
          strategy,
        ).typeId;

        floorRecord.rewardOffer = rewardOffer;
        floorRecord.chosenReward = chosenReward;
        floorRecord.doorOffer = doorOffer;
        floorRecord.chosenNextFloorType = chosenNextFloorType;

        currentRunState = advanceRunStateAfterVictory({
          chosenNextFloorType,
          chosenReward,
          doorOffer,
          encounter,
          rewardOffer,
          state: currentRunState,
        });
        run.runStateHistory.push(currentRunState);
        currentPokemon = chosenReward;
      } else {
        run.completedRun = completeRunAfterFinalVictory({
          encounter,
          state: currentRunState,
        });
        run.usedSpecies = [...run.completedRun.usedSpecies];
      }

      run.floors.push(floorRecord);
    }

    if (run.completedRun === null && currentRunState) {
      run.usedSpecies = [...currentRunState.usedSpecies];
    }

    return {
      status: "completed",
      run,
    };
  } catch (error) {
    if (currentRunState) {
      run.usedSpecies = [...currentRunState.usedSpecies];
    }

    if (error instanceof RulesSandboxError) {
      return {
        status: "failed",
        run,
        failure: {
          kind: error.kind,
          message: error.message,
          floorNumber: error.floorNumber,
          details: error.details,
        },
      };
    }

    if (error instanceof Error) {
      return {
        status: "failed",
        run,
        failure: {
          kind: "invalid-data",
          message: error.message,
        },
      };
    }

    throw error;
  }
}

function assertUniqueSpecies(
  speciesIds: SpeciesId[],
  message: string,
  kind: RunFailureKind,
  floorNumber?: number,
): void {
  if (new Set(speciesIds).size !== speciesIds.length) {
    throw new RulesSandboxError(kind, message, {
      details: {
        speciesIds,
      },
      floorNumber,
    });
  }
}

function bucketRecordsBySpecies(
  records: BattleReadyPokemonRecord[],
): SpeciesBucket[] {
  const bucketsBySpecies = new Map<SpeciesId, BattleReadyPokemonRecord[]>();

  for (const record of records) {
    const existingRecords = bucketsBySpecies.get(record.speciesId);

    if (existingRecords) {
      existingRecords.push(record);
      continue;
    }

    bucketsBySpecies.set(record.speciesId, [record]);
  }

  return [...bucketsBySpecies.entries()]
    .map(([speciesId, bucketRecords]) => ({
      speciesId,
      records: [...bucketRecords].sort(compareBattlePokemonRecords),
    }))
    .sort(compareSpeciesBuckets);
}

function cloneMoveSet(moveSet: MoveSet): MoveSet {
  return [...moveSet] as MoveSet;
}

function cloneSetWithSpecies(
  blockedSpecies: ReadonlySet<SpeciesId>,
  speciesId: SpeciesId,
): Set<SpeciesId> {
  const clonedSpecies = new Set(blockedSpecies);

  clonedSpecies.add(speciesId);

  return clonedSpecies;
}

function compareBattlePokemonRecords(
  left: BattleReadyPokemonRecord,
  right: BattleReadyPokemonRecord,
): number {
  return left.battlePokemonId.localeCompare(right.battlePokemonId, "en");
}

function compareDoorChoices(
  left: GeneratedDoorChoice,
  right: GeneratedDoorChoice,
): number {
  const leftIndex = TYPE_INDEX.get(left.typeId) ?? Number.MAX_SAFE_INTEGER;
  const rightIndex = TYPE_INDEX.get(right.typeId) ?? Number.MAX_SAFE_INTEGER;

  return leftIndex - rightIndex;
}

function compareSpeciesBuckets(
  left: SpeciesBucket,
  right: SpeciesBucket,
): number {
  return left.speciesId.localeCompare(right.speciesId, "en");
}

function countRecords(buckets: SpeciesBucket[]): number {
  return buckets.reduce(
    (recordCount, bucket) => recordCount + bucket.records.length,
    0,
  );
}

function countDistinctRewardTypingKeys(buckets: SpeciesBucket[]): number {
  return new Set(
    buckets.flatMap((bucket) =>
      bucket.records.map((record) => toTypingKey(record.types)),
    ),
  ).size;
}

function filterBucketsByBlockedSpecies(
  buckets: SpeciesBucket[],
  blockedSpecies: ReadonlySet<SpeciesId>,
): SpeciesBucket[] {
  return buckets.filter((bucket) => !blockedSpecies.has(bucket.speciesId));
}

interface BattlePressureProfile {
  bestPower: number;
  bestStabPower: number;
  damagingMoveCount: number;
}

function buildBattlePressureProfile(
  record: BattleReadyPokemonRecord,
  level: number,
  moveById: ReadonlyMap<string, MoveRecord>,
): BattlePressureProfile {
  const moves = resolveMoveSetForLevel(record, level);
  let bestPower = 0;
  let bestStabPower = 0;
  let damagingMoveCount = 0;

  for (const moveId of moves ?? []) {
    const move = moveById.get(moveId);

    if (!move || move.power <= 0) {
      continue;
    }

    damagingMoveCount += 1;
    bestPower = Math.max(bestPower, move.power);

    if (record.types.includes(move.type)) {
      bestStabPower = Math.max(bestStabPower, move.power);
    }
  }

  return {
    bestPower,
    bestStabPower,
    damagingMoveCount,
  };
}

function isPreferredStarterRecord(
  record: BattleReadyPokemonRecord,
  level: number,
  moveById: ReadonlyMap<string, MoveRecord>,
): boolean {
  return buildBattlePressureProfile(record, level, moveById).bestStabPower >= 40;
}

function isPreferredEarlyRewardRecord(
  record: BattleReadyPokemonRecord,
  level: number,
  moveById: ReadonlyMap<string, MoveRecord>,
): boolean {
  const pressure = buildBattlePressureProfile(record, level, moveById);

  return (
    pressure.damagingMoveCount > 0 &&
    (
      pressure.bestStabPower >= 40 ||
      pressure.bestPower >= 60 ||
      pressure.damagingMoveCount >= 2
    )
  );
}

function isRecordLegalAtLevel(
  record: BattleReadyPokemonRecord,
  level: number,
): boolean {
  return (
    level >= record.legalLevelRange.min &&
    level <= record.legalLevelRange.max &&
    resolveMoveSetForLevel(record, level) !== null
  );
}

function getDistinctTypingRecords(
  bucket: SpeciesBucket,
  rng: RandomSource,
): BattleReadyPokemonRecord[] {
  const recordsByTypingKey = new Map<string, BattleReadyPokemonRecord[]>();

  for (const record of bucket.records) {
    const typingKey = toTypingKey(record.types);
    const existingRecords = recordsByTypingKey.get(typingKey) ?? [];

    existingRecords.push(record);
    recordsByTypingKey.set(typingKey, existingRecords);
  }

  return sampleWithoutReplacement(
    [...recordsByTypingKey.values()],
    recordsByTypingKey.size,
    rng,
  ).map((records) => pickOne(records, rng));
}

function hasTypeOverlap(
  typeIds: readonly PokemonTypeId[],
  usedTypes: ReadonlySet<PokemonTypeId>,
): boolean {
  return typeIds.some((typeId) => usedTypes.has(typeId));
}

function selectUniqueTypeRewardRecords(options: {
  buckets: SpeciesBucket[];
  selectedRecords: BattleReadyPokemonRecord[];
  startIndex: number;
  usedTypes: Set<PokemonTypeId>;
}): BattleReadyPokemonRecord[] | null {
  if (options.selectedRecords.length === 3) {
    return [...options.selectedRecords];
  }

  const remainingNeeded = 3 - options.selectedRecords.length;

  for (
    let bucketIndex = options.startIndex;
    bucketIndex <= options.buckets.length - remainingNeeded;
    bucketIndex += 1
  ) {
    const bucket = options.buckets[bucketIndex];

    if (!bucket) {
      continue;
    }

    for (const record of bucket.records) {
      if (hasTypeOverlap(record.types, options.usedTypes)) {
        continue;
      }

      options.selectedRecords.push(record);

      for (const typeId of record.types) {
        options.usedTypes.add(typeId);
      }

      const nestedSelection = selectUniqueTypeRewardRecords({
        buckets: options.buckets,
        selectedRecords: options.selectedRecords,
        startIndex: bucketIndex + 1,
        usedTypes: options.usedTypes,
      });

      if (nestedSelection) {
        return nestedSelection;
      }

      options.selectedRecords.pop();

      for (const typeId of record.types) {
        options.usedTypes.delete(typeId);
      }
    }
  }

  return null;
}

function assertUniqueRewardTypes(
  choices: readonly GeneratedBattlePokemon[],
  floorNumber: number,
): void {
  const seenTypes = new Set<PokemonTypeId>();
  const duplicateTypes = new Set<PokemonTypeId>();

  for (const choice of choices) {
    for (const typeId of choice.types) {
      if (seenTypes.has(typeId)) {
        duplicateTypes.add(typeId);
      }

      seenTypes.add(typeId);
    }
  }

  if (duplicateTypes.size === 0) {
    return;
  }

  throw new RulesSandboxError(
    "illegal-reward",
    `Reward offer repeated typing across choices: ${sortTypeIds([...duplicateTypes]).join(", ")}`,
    {
      details: {
        duplicateTypes: sortTypeIds([...duplicateTypes]),
        rewardChoices: choices.map((choice) => ({
          battlePokemonId: choice.battlePokemonId,
          types: [...choice.types],
        })),
      },
      floorNumber,
    },
  );
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let candidate = Math.imul(state ^ (state >>> 15), 1 | state);

    candidate ^=
      candidate + Math.imul(candidate ^ (candidate >>> 7), 61 | candidate);

    return ((candidate ^ (candidate >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne<T>(items: readonly T[], rng: RandomSource): T {
  const item = items[Math.floor(rng.next() * items.length)];

  if (item === undefined) {
    throw new RulesSandboxError(
      "invalid-data",
      "Attempted to choose from an empty collection",
    );
  }

  return item;
}

function sampleWithoutReplacement<T>(
  items: readonly T[],
  count: number,
  rng: RandomSource,
): T[] {
  if (count > items.length) {
    throw new RulesSandboxError(
      "invalid-data",
      `Cannot sample ${count} items from a pool of ${items.length}`,
      {
        details: {
          count,
          poolSize: items.length,
        },
      },
    );
  }

  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(rng.next() * (index + 1));
    const currentItem = shuffled[index];
    const nextItem = shuffled[randomIndex];

    shuffled[index] = nextItem as T;
    shuffled[randomIndex] = currentItem as T;
  }

  return shuffled.slice(0, count);
}

function selectDoorChoice(
  doorOffer: GeneratedDoorOffer,
  rng: RandomSource,
  strategy: SimulationStrategy,
): GeneratedDoorChoice {
  if (strategy === "random") {
    return pickOne(doorOffer.choices, rng);
  }

  const sortedChoices = [...doorOffer.choices].sort((left, right) => {
    if (
      left.availableEncounterSpeciesCount !==
      right.availableEncounterSpeciesCount
    ) {
      return (
        left.availableEncounterSpeciesCount -
        right.availableEncounterSpeciesCount
      );
    }

    return compareDoorChoices(left, right);
  });

  return sortedChoices[0] ?? pickOne(doorOffer.choices, rng);
}

function selectRewardChoice(
  rewardOffer: GeneratedRewardOffer,
  sandbox: RulesSandbox,
  blockedSpecies: ReadonlySet<SpeciesId>,
  remainingFloorTypes: ReadonlySet<PokemonTypeId>,
  rng: RandomSource,
  strategy: SimulationStrategy,
): GeneratedBattlePokemon {
  if (strategy === "random") {
    return pickOne(rewardOffer.choices, rng);
  }

  const scoredChoices = rewardOffer.choices.map((choice) => {
    const blockedAfterChoice = cloneSetWithSpecies(
      blockedSpecies,
      choice.speciesId,
    );
    const viableNextTypes = sandbox.getViableFloorTypeChoices(
      rewardOffer.nextFloorLevel,
      blockedAfterChoice,
      remainingFloorTypes,
    );
    const encounterSpeciesCount = viableNextTypes.reduce(
      (totalCount, viableType) =>
        totalCount + viableType.availableEncounterSpeciesCount,
      0,
    );

    return {
      choice,
      encounterSpeciesCount,
      viableNextTypeCount: viableNextTypes.length,
    };
  });

  scoredChoices.sort((left, right) => {
    if (left.viableNextTypeCount !== right.viableNextTypeCount) {
      return right.viableNextTypeCount - left.viableNextTypeCount;
    }

    if (left.encounterSpeciesCount !== right.encounterSpeciesCount) {
      return right.encounterSpeciesCount - left.encounterSpeciesCount;
    }

    return left.choice.battlePokemonId.localeCompare(
      right.choice.battlePokemonId,
      "en",
    );
  });

  return scoredChoices[0]?.choice ?? pickOne(rewardOffer.choices, rng);
}

function selectStarterChoice(
  starterOffer: GeneratedStarterOffer,
  rng: RandomSource,
): GeneratedStarterChoice {
  return pickOne(starterOffer.choices, rng);
}

function sortTypeIds(typeIds: PokemonTypeId[]): PokemonTypeId[] {
  return [...typeIds].sort((left, right) => {
    const leftIndex = TYPE_INDEX.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = TYPE_INDEX.get(right) ?? Number.MAX_SAFE_INTEGER;

    return leftIndex - rightIndex;
  });
}

function toTypingKey(typeIds: readonly PokemonTypeId[]): string {
  return sortTypeIds([...typeIds]).join("/");
}

function toGeneratedBattlePokemon(
  record: BattleReadyPokemonRecord,
  level: number,
): GeneratedBattlePokemon {
  const moves = resolveMoveSetForLevel(record, level);

  if (!moves) {
    throw new RulesSandboxError(
      "invalid-data",
      `Pokemon ${record.battlePokemonId} has no legal moveset at level ${level}`,
      {
        details: {
          battlePokemonId: record.battlePokemonId,
          level,
        },
      },
    );
  }

  return {
    battlePokemonId: record.battlePokemonId,
    speciesId: record.speciesId,
    formId: record.formId,
    name: record.name,
    level,
    types: [...record.types] as GeneratedBattlePokemon["types"],
    floorTypes: [...record.floorTypes] as GeneratedBattlePokemon["floorTypes"],
    moves,
  };
}

function getEncounterLevelForFloorLevel(floorLevel: FloorLevel): number {
  return Math.max(1, floorLevel - ENEMY_LEVEL_OFFSET);
}

function resolveMoveSetForLevel(
  record: BattleReadyPokemonRecord,
  targetLevel: number,
): MoveSet | null {
  const exactMoves = record.movesetsByFloorLevel[targetLevel as FloorLevel];

  if (exactMoves) {
    return cloneMoveSet(exactMoves);
  }

  const availableLevels = Object.keys(record.movesetsByFloorLevel)
    .map((level) => Number.parseInt(level, 10))
    .filter((level) => Number.isFinite(level))
    .sort((left, right) => left - right);

  if (availableLevels.length === 0) {
    return null;
  }

  const lowerOrEqualLevels = availableLevels.filter((level) => level <= targetLevel);
  const chosenLevel =
    lowerOrEqualLevels[lowerOrEqualLevels.length - 1] ?? availableLevels[0];
  const moves = record.movesetsByFloorLevel[chosenLevel as FloorLevel];

  return moves ? cloneMoveSet(moves) : null;
}

function xmur3(seed: string): () => number {
  let hash = 1779033703 ^ seed.length;

  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);

    return (hash ^= hash >>> 16) >>> 0;
  };
}
