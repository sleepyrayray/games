import { join } from "node:path";

import {
  FLOOR_LEVELS,
  MOVE_CATEGORIES,
  MOVE_EFFECT_TAGS,
  POKEMON_TYPES,
  type BattleReadyPokemonRecord,
  type FloorLevelRecord,
  type MoveRecord,
  type StarterPoolRecord,
  type TypeMetadataRecord,
} from "../../src/types/pokechamp-data.ts";
import {
  NORMALIZED_DATA_DIR,
  RUNTIME_DATA_DIR,
} from "../shared/pipeline-config.ts";
import { readJsonFile } from "../shared/file-utils.ts";

interface ValidationMetadata {
  excludedSpecies: string[];
  excludedForms: string[];
}

interface EvolutionWindowRecord {
  speciesId: string;
  formId: string;
  familyId: string;
  minLevel: number;
  maxLevel: number;
  evolvesTo: string[];
}

const POKEMON_TYPE_SET = new Set<string>(POKEMON_TYPES);

async function main(): Promise<void> {
  console.log("Loading normalized and runtime datasets...");

  const metadata = await readJsonFile<ValidationMetadata>(
    join(NORMALIZED_DATA_DIR, "metadata.json"),
  );
  const evolutionWindows = await readJsonFile<EvolutionWindowRecord[]>(
    join(NORMALIZED_DATA_DIR, "evolution-windows.json"),
  );
  const runtimePokemon = await readJsonFile<BattleReadyPokemonRecord[]>(
    join(RUNTIME_DATA_DIR, "pokemon.json"),
  );
  const runtimeMoves = await readJsonFile<MoveRecord[]>(
    join(RUNTIME_DATA_DIR, "moves.json"),
  );
  const runtimeTypes = await readJsonFile<TypeMetadataRecord[]>(
    join(RUNTIME_DATA_DIR, "types.json"),
  );
  const runtimeStarters = await readJsonFile<StarterPoolRecord>(
    join(RUNTIME_DATA_DIR, "starters.json"),
  );
  const runtimeFloorLevels = await readJsonFile<FloorLevelRecord[]>(
    join(RUNTIME_DATA_DIR, "floor-levels.json"),
  );

  validateMoves(runtimeMoves);
  validateTypes(runtimeTypes);
  validateFloorLevels(runtimeFloorLevels);
  validateStarters(runtimeStarters);
  validatePokemon(runtimePokemon, runtimeMoves, metadata);
  validateEvolutionWindows(evolutionWindows);

  console.log("Runtime validation passed.");
  console.log(
    `Validated ${runtimePokemon.length} runtime Pokemon, ${runtimeMoves.length} runtime moves, and ${runtimeFloorLevels.length} floor levels.`,
  );
}

function validatePokemon(
  pokemonRecords: BattleReadyPokemonRecord[],
  moveRecords: MoveRecord[],
  metadata: ValidationMetadata,
): void {
  const seenBattlePokemonIds = new Set<string>();
  const moveIds = new Set(moveRecords.map((moveRecord) => moveRecord.moveId));
  const moveById = new Map(
    moveRecords.map((moveRecord) => [moveRecord.moveId, moveRecord] as const),
  );
  const excludedSpecies = new Set(metadata.excludedSpecies);
  const excludedForms = new Set(metadata.excludedForms);
  const blockedFormFragments = ["-mega", "-gmax", "-totem", "-cap"];

  for (const pokemonRecord of pokemonRecords) {
    assertValidId(pokemonRecord.battlePokemonId, "battlePokemonId");
    assertValidId(pokemonRecord.speciesId, "speciesId");
    assertValidId(pokemonRecord.formId, "formId");
    assert(pokemonRecord.name.length > 0, "Pokemon name must be non-empty");
    assert(
      !seenBattlePokemonIds.has(pokemonRecord.battlePokemonId),
      `Duplicate battlePokemonId ${pokemonRecord.battlePokemonId}`,
    );
    seenBattlePokemonIds.add(pokemonRecord.battlePokemonId);
    assert(
      !excludedSpecies.has(pokemonRecord.speciesId),
      `Excluded species leaked into runtime: ${pokemonRecord.speciesId}`,
    );
    assert(
      !excludedForms.has(pokemonRecord.formId),
      `Excluded form leaked into runtime: ${pokemonRecord.formId}`,
    );
    assert(
      !blockedFormFragments.some((fragment) =>
        pokemonRecord.formId.includes(fragment),
      ),
      `Blocked special form leaked into runtime: ${pokemonRecord.formId}`,
    );
    assertTypes(pokemonRecord.types, `Pokemon ${pokemonRecord.formId}`);
    assertTypes(
      pokemonRecord.floorTypes,
      `Pokemon ${pokemonRecord.formId} floorTypes`,
    );
    assert(
      pokemonRecord.floorTypes.join(",") === pokemonRecord.types.join(","),
      `floorTypes must match types for ${pokemonRecord.formId}`,
    );
    assert(
      Number.isInteger(pokemonRecord.legalLevelRange.min) &&
        Number.isInteger(pokemonRecord.legalLevelRange.max) &&
        pokemonRecord.legalLevelRange.min >= 1 &&
        pokemonRecord.legalLevelRange.max <= 100 &&
        pokemonRecord.legalLevelRange.min <= pokemonRecord.legalLevelRange.max,
      `Invalid legal level range for ${pokemonRecord.formId}`,
    );
    assertStatBlock(
      pokemonRecord.baseStats,
      `Pokemon ${pokemonRecord.formId} baseStats`,
    );
    assert(
      typeof pokemonRecord.sprite.front === "string" &&
        pokemonRecord.sprite.front.length > 0,
      `Missing front sprite for ${pokemonRecord.formId}`,
    );

    const legalFloorLevels = FLOOR_LEVELS.filter(
      (level) =>
        level >= pokemonRecord.legalLevelRange.min &&
        level <= pokemonRecord.legalLevelRange.max,
    );
    const movesetEntries = Object.entries(
      pokemonRecord.movesetsByFloorLevel,
    ).sort(([leftKey], [rightKey]) => Number(leftKey) - Number(rightKey));

    assert(
      legalFloorLevels.length > 0,
      `Runtime Pokemon ${pokemonRecord.formId} has no legal tower floor levels`,
    );
    assert(
      movesetEntries.length === legalFloorLevels.length,
      `Runtime Pokemon ${pokemonRecord.formId} is missing movesets for one or more legal floors`,
    );

    for (const [floorLevelKey, moveSet] of movesetEntries) {
      const floorLevel = Number(floorLevelKey);

      assert(
        FLOOR_LEVELS.includes(floorLevel as (typeof FLOOR_LEVELS)[number]),
        `Unexpected floor level key ${floorLevelKey} on ${pokemonRecord.formId}`,
      );
      assert(
        legalFloorLevels.includes(floorLevel as (typeof FLOOR_LEVELS)[number]),
        `Floor level ${floorLevelKey} is outside the legal range for ${pokemonRecord.formId}`,
      );
      assert(
        moveSet.length >= 1 && moveSet.length <= 4,
        `Moveset for ${pokemonRecord.formId} at ${floorLevelKey} must contain 1-4 moves`,
      );
      assert(
        moveSet.some((moveId) => moveById.get(moveId)?.allowedInGame),
        `Moveset for ${pokemonRecord.formId} at ${floorLevelKey} must contain at least one allowed move`,
      );
      assert(
        new Set(moveSet).size === moveSet.length,
        `Moveset for ${pokemonRecord.formId} at ${floorLevelKey} contains duplicates`,
      );

      for (const moveId of moveSet) {
        assertValidId(
          moveId,
          `moveId in ${pokemonRecord.formId} @ ${floorLevelKey}`,
        );
        assert(
          moveIds.has(moveId),
          `Runtime Pokemon ${pokemonRecord.formId} references missing move ${moveId}`,
        );
      }
    }
  }
}

function validateMoves(moveRecords: MoveRecord[]): void {
  const seenMoveIds = new Set<string>();

  for (const moveRecord of moveRecords) {
    assertValidId(moveRecord.moveId, "moveId");
    assert(
      moveRecord.name.length > 0,
      `Move ${moveRecord.moveId} must have a name`,
    );
    assert(
      !seenMoveIds.has(moveRecord.moveId),
      `Duplicate moveId ${moveRecord.moveId} in runtime moves`,
    );
    seenMoveIds.add(moveRecord.moveId);
    assert(
      POKEMON_TYPES.includes(moveRecord.type),
      `Move ${moveRecord.moveId} has unsupported type ${moveRecord.type}`,
    );
    assert(
      MOVE_CATEGORIES.includes(moveRecord.category),
      `Move ${moveRecord.moveId} has unsupported category ${moveRecord.category}`,
    );
    assert(
      MOVE_EFFECT_TAGS.includes(moveRecord.effectTag),
      `Move ${moveRecord.moveId} has unsupported effectTag ${moveRecord.effectTag}`,
    );
    assert(
      Number.isInteger(moveRecord.power) && moveRecord.power >= 0,
      `Move ${moveRecord.moveId} must have non-negative integer power`,
    );
    assert(
      Number.isInteger(moveRecord.accuracy) &&
        moveRecord.accuracy >= 1 &&
        moveRecord.accuracy <= 100,
      `Move ${moveRecord.moveId} must have accuracy between 1 and 100`,
    );
    assert(
      Number.isInteger(moveRecord.pp) && moveRecord.pp >= 1,
      `Move ${moveRecord.moveId} must have positive pp`,
    );
    assert(
      Number.isInteger(moveRecord.priority),
      `Move ${moveRecord.moveId} must have integer priority`,
    );
    assert(
      typeof moveRecord.target === "string" && moveRecord.target.length > 0,
      `Move ${moveRecord.moveId} must have a target`,
    );
    assert(
      typeof moveRecord.allowedInGame === "boolean",
      `Move ${moveRecord.moveId} must declare allowedInGame`,
    );
  }
}

function validateTypes(typeRecords: TypeMetadataRecord[]): void {
  assert(
    typeRecords.length === POKEMON_TYPES.length,
    `Expected ${POKEMON_TYPES.length} type records, received ${typeRecords.length}`,
  );

  for (const typeRecord of typeRecords) {
    assert(
      POKEMON_TYPES.includes(typeRecord.typeId),
      `Unsupported type record ${typeRecord.typeId}`,
    );
    assert(
      typeRecord.name.length > 0,
      `Type ${typeRecord.typeId} must have a name`,
    );
    assertHexColor(typeRecord.color, `Type ${typeRecord.typeId} color`);
    assertHexColor(typeRecord.uiAccent, `Type ${typeRecord.typeId} uiAccent`);
    assert(
      typeRecord.floorTheme.palette.length >= 1,
      `Type ${typeRecord.typeId} must have at least one palette color`,
    );
    for (const paletteColor of typeRecord.floorTheme.palette) {
      assertHexColor(paletteColor, `Palette color for ${typeRecord.typeId}`);
    }
  }
}

function validateStarters(starterPool: StarterPoolRecord): void {
  for (const [starterType, speciesIds] of Object.entries(starterPool)) {
    assert(
      speciesIds.length >= 1,
      `Starter pool ${starterType} must not be empty`,
    );
    assert(
      new Set(speciesIds).size === speciesIds.length,
      `Starter pool ${starterType} contains duplicates`,
    );
    for (const speciesId of speciesIds) {
      assertValidId(speciesId, `starter speciesId (${starterType})`);
    }
  }
}

function validateFloorLevels(floorLevels: FloorLevelRecord[]): void {
  assert(
    floorLevels.length === FLOOR_LEVELS.length,
    `Expected ${FLOOR_LEVELS.length} floor levels, received ${floorLevels.length}`,
  );

  for (let index = 0; index < floorLevels.length; index += 1) {
    const floorLevel = floorLevels[index];
    const expectedLevel = FLOOR_LEVELS[index];

    assert(
      floorLevel !== undefined,
      `Missing floor level record at index ${index}`,
    );
    assert(
      expectedLevel !== undefined,
      `Missing expected floor level at index ${index}`,
    );

    assert(
      floorLevel.floorNumber === index + 1,
      `Floor number mismatch at index ${index}: expected ${index + 1}, received ${floorLevel.floorNumber}`,
    );
    assert(
      floorLevel.level === expectedLevel,
      `Floor level mismatch at floor ${floorLevel.floorNumber}: expected ${expectedLevel}, received ${floorLevel.level}`,
    );
  }
}

function validateEvolutionWindows(
  evolutionWindows: EvolutionWindowRecord[],
): void {
  const windowsByFormId = new Map<string, EvolutionWindowRecord[]>();

  for (const evolutionWindow of evolutionWindows) {
    assertValidId(evolutionWindow.speciesId, "evolutionWindow speciesId");
    assertValidId(evolutionWindow.formId, "evolutionWindow formId");
    assertValidId(evolutionWindow.familyId, "evolutionWindow familyId");
    assert(
      Number.isInteger(evolutionWindow.minLevel) &&
        Number.isInteger(evolutionWindow.maxLevel) &&
        evolutionWindow.minLevel >= 1 &&
        evolutionWindow.maxLevel >= evolutionWindow.minLevel,
      `Invalid evolution window for ${evolutionWindow.formId}`,
    );

    const existing = windowsByFormId.get(evolutionWindow.formId) ?? [];
    existing.push(evolutionWindow);
    windowsByFormId.set(evolutionWindow.formId, existing);
  }

  for (const [formId, formWindows] of windowsByFormId) {
    assert(
      formWindows.length === 1,
      `Form ${formId} should only have one evolution window`,
    );
  }
}

function assertTypes(types: readonly string[], label: string): void {
  assert(
    types.length >= 1 && types.length <= 2,
    `${label} must have one or two types`,
  );
  assert(
    new Set(types).size === types.length,
    `${label} contains duplicate types`,
  );

  for (const typeId of types) {
    assert(
      POKEMON_TYPE_SET.has(typeId),
      `${label} has unsupported type ${typeId}`,
    );
  }
}

function assertStatBlock(
  statBlock: BattleReadyPokemonRecord["baseStats"],
  label: string,
): void {
  for (const [statName, statValue] of Object.entries(statBlock)) {
    assert(
      Number.isInteger(statValue) && statValue >= 1,
      `${label} has invalid ${statName} value ${statValue}`,
    );
  }
}

function assertHexColor(value: string, label: string): void {
  assert(
    /^#[0-9A-Fa-f]{6}$/u.test(value),
    `${label} must be a 6-digit hex color`,
  );
}

function assertValidId(value: string, label: string): void {
  assert(
    /^[a-z0-9-]+$/u.test(value),
    `${label} must match ^[a-z0-9-]+$: ${value}`,
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

await main();
