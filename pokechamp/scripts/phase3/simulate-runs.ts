import { join } from "node:path";

import type {
  BattleReadyPokemonRecord,
  FloorLevelRecord,
  StarterPoolRecord,
} from "../../src/types/pokechamp-data.ts";
import {
  RulesSandbox,
  simulateTowerRun,
  type RunFailure,
  type SimulatedRun,
  type SimulatedRunResult,
  type SimulationStrategy,
} from "../shared/rules-sandbox.ts";
import { readJsonFile, writeJsonFile } from "../shared/file-utils.ts";
import { RUNTIME_DATA_DIR } from "../shared/pipeline-config.ts";

interface CliOptions {
  reportPath?: string;
  runs: number;
  sampleCount: number;
  seedPrefix: string;
  strategy: SimulationStrategy;
}

interface EncounterPoolObservation {
  count: number;
  floorNumber: number;
  floorType: string;
  formCount: number;
  seed: string;
}

interface RewardPoolObservation {
  count: number;
  floorNumber: number;
  formCount: number;
  nextFloorNumber: number;
  seed: string;
}

interface DoorPoolObservation {
  availableEncounterSpeciesCount: number;
  floorNumber: number;
  nextFloorNumber: number;
  typeId: string;
  viableTypeCount: number;
  seed: string;
}

interface SimulationSummary {
  completedRuns: number;
  failedRuns: number;
  failureCounts: Partial<Record<RunFailure["kind"], number>>;
  smallestDoorChoicePool: DoorPoolObservation | null;
  smallestEncounterPool: EncounterPoolObservation | null;
  smallestRewardPool: RewardPoolObservation | null;
  strategy: SimulationStrategy;
  totalRuns: number;
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

  const sandbox = new RulesSandbox({
    pokemon,
    floorLevels,
    starters,
  });
  const results = Array.from({ length: options.runs }, (_, index) =>
    simulateTowerRun(sandbox, {
      seed: `${options.seedPrefix}-${String(index + 1).padStart(4, "0")}`,
      strategy: options.strategy,
    }),
  );
  const summary = buildSummary(results, options.strategy);
  const sampleSuccesses = results
    .filter(
      (
        result,
      ): result is Extract<SimulatedRunResult, { status: "completed" }> =>
        result.status === "completed",
    )
    .slice(0, options.sampleCount)
    .map((result) => summarizeRun(result.run));
  const sampleFailures = results
    .filter(
      (result): result is Extract<SimulatedRunResult, { status: "failed" }> =>
        result.status === "failed",
    )
    .slice(0, options.sampleCount)
    .map((result) => ({
      seed: result.run.seed,
      failure: result.failure,
      partialRun: summarizeRun(result.run),
    }));

  printSummary(summary, sampleSuccesses, sampleFailures);

  if (options.reportPath) {
    await writeJsonFile(options.reportPath, {
      generatedAt: new Date().toISOString(),
      summary,
      sampleFailures,
      sampleSuccesses,
    });
    console.log(`Wrote report to ${options.reportPath}`);
  }

  if (summary.failedRuns > 0) {
    process.exitCode = 1;
  }
}

function buildSummary(
  results: SimulatedRunResult[],
  strategy: SimulationStrategy,
): SimulationSummary {
  const failureCounts: SimulationSummary["failureCounts"] = {};
  let smallestDoorChoicePool: DoorPoolObservation | null = null;
  let smallestEncounterPool: EncounterPoolObservation | null = null;
  let smallestRewardPool: RewardPoolObservation | null = null;
  let completedRuns = 0;
  let failedRuns = 0;

  for (const result of results) {
    if (result.status === "completed") {
      completedRuns += 1;
    } else {
      failedRuns += 1;
      failureCounts[result.failure.kind] =
        (failureCounts[result.failure.kind] ?? 0) + 1;
    }

    for (const floor of result.run.floors) {
      if (
        smallestEncounterPool === null ||
        floor.encounter.availableSpeciesCount < smallestEncounterPool.count
      ) {
        smallestEncounterPool = {
          count: floor.encounter.availableSpeciesCount,
          floorNumber: floor.floorNumber,
          floorType: floor.floorType,
          formCount: floor.encounter.availableFormCount,
          seed: result.run.seed,
        };
      }

      const rewardOffer = floor.rewardOffer;

      if (
        rewardOffer &&
        (smallestRewardPool === null ||
          rewardOffer.availableSpeciesCount < smallestRewardPool.count)
      ) {
        smallestRewardPool = {
          count: rewardOffer.availableSpeciesCount,
          floorNumber: floor.floorNumber,
          formCount: rewardOffer.availableFormCount,
          nextFloorNumber: rewardOffer.nextFloorNumber,
          seed: result.run.seed,
        };
      }

      const doorOffer = floor.doorOffer;

      if (!doorOffer) {
        continue;
      }

      for (const doorChoice of doorOffer.choices) {
        if (
          smallestDoorChoicePool === null ||
          doorChoice.availableEncounterSpeciesCount <
            smallestDoorChoicePool.availableEncounterSpeciesCount
        ) {
          smallestDoorChoicePool = {
            availableEncounterSpeciesCount:
              doorChoice.availableEncounterSpeciesCount,
            floorNumber: floor.floorNumber,
            nextFloorNumber: doorOffer.nextFloorNumber,
            typeId: doorChoice.typeId,
            viableTypeCount: doorOffer.viableTypeCount,
            seed: result.run.seed,
          };
        }
      }
    }
  }

  return {
    completedRuns,
    failedRuns,
    failureCounts,
    smallestDoorChoicePool,
    smallestEncounterPool,
    smallestRewardPool,
    strategy,
    totalRuns: results.length,
  };
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    runs: 250,
    sampleCount: 3,
    seedPrefix: "phase3",
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
      options.runs = parsePositiveInteger(
        requireValue(argv[index + 1], arg),
        arg,
      );
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

    throw new Error(`Unknown argument "${arg}"`);
  }

  return options;
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(
      `Expected a positive integer for ${flag}, received "${value}"`,
    );
  }

  return parsedValue;
}

function printHelp(): void {
  console.log(
    "Usage: node --experimental-strip-types ./scripts/phase3/simulate-runs.ts [options]",
  );
  console.log("");
  console.log("Options:");
  console.log("  --runs <count>           Number of simulated runs to execute");
  console.log(
    "  --seed <prefix>          Seed prefix used to derive deterministic run seeds",
  );
  console.log("  --strategy <mode>        random | scarcity-first");
  console.log(
    "  --sample-count <count>   Number of sample runs/failures to print",
  );
  console.log(
    "  --report <path>          Write a JSON report to the given path",
  );
}

function printSummary(
  summary: SimulationSummary,
  sampleSuccesses: ReturnType<typeof summarizeRun>[],
  sampleFailures: Array<{
    failure: RunFailure;
    partialRun: ReturnType<typeof summarizeRun>;
    seed: string;
  }>,
): void {
  console.log(
    `Simulated ${summary.totalRuns} runs with strategy "${summary.strategy}".`,
  );
  console.log(
    `Completed: ${summary.completedRuns} | Failed: ${summary.failedRuns}`,
  );

  if (summary.smallestEncounterPool) {
    console.log(
      `Smallest encounter pool: ${summary.smallestEncounterPool.count} species (${summary.smallestEncounterPool.formCount} forms) on floor ${summary.smallestEncounterPool.floorNumber} ${summary.smallestEncounterPool.floorType} [seed ${summary.smallestEncounterPool.seed}]`,
    );
  }

  if (summary.smallestRewardPool) {
    console.log(
      `Smallest reward pool: ${summary.smallestRewardPool.count} species (${summary.smallestRewardPool.formCount} forms) after floor ${summary.smallestRewardPool.floorNumber} for floor ${summary.smallestRewardPool.nextFloorNumber} [seed ${summary.smallestRewardPool.seed}]`,
    );
  }

  if (summary.smallestDoorChoicePool) {
    console.log(
      `Smallest offered door encounter pool: ${summary.smallestDoorChoicePool.availableEncounterSpeciesCount} species on floor ${summary.smallestDoorChoicePool.floorNumber} -> ${summary.smallestDoorChoicePool.nextFloorNumber} (${summary.smallestDoorChoicePool.typeId}, ${summary.smallestDoorChoicePool.viableTypeCount} viable next types total) [seed ${summary.smallestDoorChoicePool.seed}]`,
    );
  }

  if (summary.failedRuns === 0) {
    console.log(
      "No duplicate species, illegal encounters, duplicate reward typings, missing reward choices, or dead-end floors were detected.",
    );
  } else {
    console.log("Failure counts:");

    for (const [failureKind, count] of Object.entries(
      summary.failureCounts,
    ).sort(([leftKind], [rightKind]) =>
      leftKind.localeCompare(rightKind, "en"),
    )) {
      console.log(`  ${failureKind}: ${count}`);
    }
  }

  if (sampleSuccesses.length > 0) {
    console.log("");
    console.log("Sample completed runs:");

    for (const sampleRun of sampleSuccesses) {
      console.log(
        `  ${sampleRun.seed}: starter ${sampleRun.starter ?? "n/a"} | floors ${sampleRun.floorTypes.join(" -> ")}`,
      );
    }
  }

  if (sampleFailures.length > 0) {
    console.log("");
    console.log("Sample failures:");

    for (const sampleFailure of sampleFailures) {
      const floorLabel =
        sampleFailure.failure.floorNumber === undefined
          ? "setup"
          : `floor ${sampleFailure.failure.floorNumber}`;

      console.log(
        `  ${sampleFailure.seed}: [${sampleFailure.failure.kind}] ${floorLabel} - ${sampleFailure.failure.message}`,
      );
    }
  }
}

function requireValue(value: string | undefined, flag: string): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function summarizeRun(run: SimulatedRun): {
  chosenRewards: string[];
  completedRun: SimulatedRun["completedRun"];
  encounterSpecies: string[];
  floorTypes: string[];
  runStateHistory: SimulatedRun["runStateHistory"];
  seed: string;
  starter: string | null;
} {
  return {
    chosenRewards: run.floors
      .map((floor) => floor.chosenReward?.battlePokemonId ?? null)
      .filter(
        (battlePokemonId): battlePokemonId is string =>
          battlePokemonId !== null,
      ),
    encounterSpecies: run.floors.map(
      (floor) => floor.encounter.enemy.battlePokemonId,
    ),
    floorTypes: run.floors.map((floor) => floor.floorType),
    completedRun: run.completedRun,
    runStateHistory: run.runStateHistory,
    seed: run.seed,
    starter: run.chosenStarter?.battlePokemonId ?? null,
  };
}

void main();
