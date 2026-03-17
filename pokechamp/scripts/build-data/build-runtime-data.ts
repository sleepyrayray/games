import { join } from "node:path";

import {
  FLOOR_LEVELS,
  type BattleReadyPokemonRecord,
  type CuratedBattleMovesetPoolRecord,
  type EvolutionRule,
  type EvolutionStageWindowRecord,
  type FloorLevel,
  type FormRecord,
  type MoveEffectTag,
  type MoveRecord,
  type MoveSet,
  type MovesetsByFloorLevel,
  type PokemonTypeId,
  type SpeciesRecord,
  type StatBlock,
} from "../../src/types/pokechamp-data.ts";
import {
  FLOOR_LEVEL_DATASET,
  HIGH_VALUE_STATUS_MOVES,
  NORMALIZED_DATA_DIR,
  PARADOX_SPECIES,
  PREFERRED_LEARNSET_VERSION_GROUPS,
  RAW_POKEAPI_DIR,
  REGIONAL_FORM_TOKENS,
  RUNTIME_DATA_DIR,
  STARTER_SPECIES,
  TYPE_ID_SET,
  TYPE_METADATA,
  ULTRA_BEAST_SPECIES,
} from "../shared/pipeline-config.ts";
import { readJsonFile, writeJsonFile } from "../shared/file-utils.ts";
import type {
  ApiName,
  PokeApiChainLink,
  PokeApiEvolutionChain,
  PokeApiEvolutionDetail,
  PokeApiMove,
  PokeApiPokemon,
  PokeApiPokemonForm,
  PokeApiSnapshotManifest,
  PokeApiSpecies,
} from "../shared/pokeapi-types.ts";

interface RawSnapshot {
  manifest: PokeApiSnapshotManifest;
  species: Record<string, PokeApiSpecies>;
  pokemon: Record<string, PokeApiPokemon>;
  pokemonForms: Record<string, PokeApiPokemonForm>;
  moves: Record<string, PokeApiMove>;
  evolutionChains: Record<string, PokeApiEvolutionChain>;
}

interface SpeciesStageWindow {
  speciesId: string;
  familyId: string;
  evolutionChainId: string;
  minLevel: number;
  maxLevel: number;
  evolvesTo: string[];
  evolutionRule: EvolutionRule;
}

interface NormalizedEvolutionChainNode {
  speciesId: string;
  isBaby: boolean;
  minLevel: number;
  maxLevel: number;
  evolvesTo: string[];
  evolutionRule: EvolutionRule;
  childRules: Array<{
    speciesId: string;
    kind: EvolutionRule["kind"];
    level: number;
    trigger: string;
  }>;
}

interface NormalizedEvolutionChainRecord {
  evolutionChainId: string;
  familyId: string;
  rootSpeciesId: string;
  nodes: NormalizedEvolutionChainNode[];
}

interface NormalizedMetadata {
  source: "pokeapi";
  apiBaseUrl: string;
  fetchedAt: string;
  builtAt: string;
  preferredLearnsetVersionGroups: string[];
  selectedLearnsetVersionGroups: Record<string, string>;
  excludedSpecies: string[];
  excludedForms: string[];
  skippedRuntimeForms: Array<{
    formId: string;
    reason: string;
  }>;
  counts: {
    species: number;
    forms: number;
    learnsets: number;
    moves: number;
    evolutionWindows: number;
    movesetPools: number;
    runtimePokemon: number;
    runtimeMoves: number;
  };
}

interface EvolutionIndex {
  chains: NormalizedEvolutionChainRecord[];
  stageWindowsBySpecies: Map<string, SpeciesStageWindow>;
  familyIdBySpecies: Map<string, string>;
  evolutionChainIdBySpecies: Map<string, string>;
}

async function main(): Promise<void> {
  console.log("Loading raw PokeAPI snapshot...");
  const rawSnapshot = await loadRawSnapshot();

  console.log("Normalizing evolution chains...");
  const evolutionIndex = buildEvolutionIndex(rawSnapshot.evolutionChains);

  console.log("Normalizing species and forms...");
  const excludedSpecies: string[] = [];
  const excludedForms: string[] = [];
  const speciesRecords: SpeciesRecord[] = Object.values(rawSnapshot.species)
    .sort((left, right) => left.id - right.id)
    .map((species) => {
      const speciesId = species.name;
      const allowedInGame = isAllowedSpecies(species);

      if (!allowedInGame) {
        excludedSpecies.push(speciesId);
      }

      return {
        speciesId,
        dexNumber: species.id,
        name: getEnglishName(species.names, speciesId),
        familyId:
          evolutionIndex.familyIdBySpecies.get(speciesId) ??
          `${speciesId}-family`,
        generation: parseGeneration(species.generation.name),
        isBaby: species.is_baby,
        isLegendary: species.is_legendary,
        isMythical: species.is_mythical,
        isUltraBeast: ULTRA_BEAST_SPECIES.has(speciesId),
        isParadox: PARADOX_SPECIES.has(speciesId),
        allowedInGame,
        starterEligible:
          allowedInGame &&
          Object.values(STARTER_SPECIES).some((starterList) =>
            starterList.some(
              (starterSpeciesId) => starterSpeciesId === speciesId,
            ),
          ),
        forms: [],
        evolutionChainId:
          evolutionIndex.evolutionChainIdBySpecies.get(speciesId) ??
          `chain-${species.evolution_chain.url.match(/\/(\d+)\/?$/u)?.[1] ?? species.id}`,
      };
    });

  const speciesById = new Map(
    speciesRecords.map((speciesRecord) => [
      speciesRecord.speciesId,
      speciesRecord,
    ]),
  );

  const formRecords: FormRecord[] = [];

  for (const species of Object.values(rawSnapshot.species).sort(
    (left, right) => left.id - right.id,
  )) {
    const speciesRecord = speciesById.get(species.name);

    if (!speciesRecord) {
      continue;
    }

    const sortedVarieties = [...species.varieties].sort((left, right) =>
      left.pokemon.url.localeCompare(right.pokemon.url, "en"),
    );

    for (const variety of sortedVarieties) {
      const pokemonRecord = rawSnapshot.pokemon[variety.pokemon.name];

      if (!pokemonRecord) {
        throw new Error(
          `Missing raw Pokemon record for ${variety.pokemon.name}`,
        );
      }

      const pokemonFormName = pokemonRecord.forms[0]?.name;
      const pokemonForm = pokemonFormName
        ? rawSnapshot.pokemonForms[pokemonFormName]
        : undefined;
      const formTag = classifyAllowedForm(
        variety.is_default,
        pokemonRecord.name,
        pokemonForm,
      );

      if (!speciesRecord.allowedInGame || !formTag) {
        excludedForms.push(pokemonRecord.name);
        continue;
      }

      const formRecord: FormRecord = {
        formId: pokemonRecord.name,
        speciesId: pokemonRecord.species.name,
        name:
          formTag === "regional-form" && pokemonForm
            ? getEnglishName(pokemonForm.names, pokemonRecord.name)
            : speciesRecord.name,
        formName:
          formTag === "regional-form" && pokemonForm
            ? getEnglishName(
                pokemonForm.form_names,
                pokemonForm.form_name || pokemonRecord.name,
              )
            : "",
        types: parseTypes(pokemonRecord),
        baseStats: parseStatBlock(pokemonRecord.stats),
        sprite: selectSpriteSet(pokemonRecord),
        tags: [formTag],
        allowedInGame: true,
      };

      formRecords.push(formRecord);
      speciesRecord.forms.push(formRecord.formId);
    }

    speciesRecord.forms.sort((left, right) => left.localeCompare(right, "en"));
  }

  console.log("Normalizing learnsets...");
  const selectedLearnsetVersionGroups: Record<string, string> = {};
  const learnsetRecords = formRecords
    .map((formRecord) => {
      const pokemonRecord = rawSnapshot.pokemon[formRecord.formId];

      if (!pokemonRecord) {
        throw new Error(`Missing raw Pokemon record for ${formRecord.formId}`);
      }

      const selectedVersionGroup = chooseVersionGroup(pokemonRecord);

      if (selectedVersionGroup) {
        selectedLearnsetVersionGroups[formRecord.formId] = selectedVersionGroup;
      }

      return {
        formId: formRecord.formId,
        learnset: buildLearnsetEntries(pokemonRecord, selectedVersionGroup),
      };
    })
    .sort((left, right) => left.formId.localeCompare(right.formId, "en"));

  console.log("Normalizing move records...");
  const learnsetMoveIds = new Set(
    learnsetRecords.flatMap((record) =>
      record.learnset.map((entry) => entry.moveId),
    ),
  );

  const moveRecords: MoveRecord[] = [...learnsetMoveIds]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((moveId) => {
      const move = rawSnapshot.moves[moveId];

      if (!move) {
        throw new Error(`Missing raw move record for ${moveId}`);
      }

      return normalizeMoveRecord(move);
    });

  const moveRecordById = new Map(
    moveRecords.map((moveRecord) => [moveRecord.moveId, moveRecord]),
  );
  const learnsetByFormId = new Map(
    learnsetRecords.map((learnsetRecord) => [
      learnsetRecord.formId,
      learnsetRecord,
    ]),
  );

  console.log("Deriving evolution windows and first-pass movesets...");
  const evolutionWindowRecords: EvolutionStageWindowRecord[] = [];
  const movesetPoolRecords: CuratedBattleMovesetPoolRecord[] = [];
  const runtimePokemonRecords: BattleReadyPokemonRecord[] = [];
  const skippedRuntimeForms: Array<{ formId: string; reason: string }> = [];

  for (const formRecord of formRecords.sort((left, right) =>
    left.formId.localeCompare(right.formId, "en"),
  )) {
    const stageWindow =
      evolutionIndex.stageWindowsBySpecies.get(formRecord.speciesId) ??
      fallbackStageWindow(formRecord.speciesId);

    const evolutionWindow: EvolutionStageWindowRecord = {
      speciesId: formRecord.speciesId,
      formId: formRecord.formId,
      familyId: stageWindow.familyId,
      minLevel: stageWindow.minLevel,
      maxLevel: stageWindow.maxLevel,
      evolvesTo: [...stageWindow.evolvesTo],
      evolutionRule: stageWindow.evolutionRule,
    };

    evolutionWindowRecords.push(evolutionWindow);

    const legalFloorLevels = FLOOR_LEVELS.filter(
      (level) =>
        level >= evolutionWindow.minLevel && level <= evolutionWindow.maxLevel,
    );

    if (legalFloorLevels.length === 0) {
      skippedRuntimeForms.push({
        formId: formRecord.formId,
        reason: "No legal tower floor levels in the 8-70 curve.",
      });
      continue;
    }

    const learnsetRecord = learnsetByFormId.get(formRecord.formId);
    const movesetsByFloorLevel: MovesetsByFloorLevel = {};
    let missingMovesets = false;

    for (const floorLevel of legalFloorLevels) {
      const legalMoves = getLegalMoveRecords(
        learnsetRecord?.learnset ?? [],
        moveRecordById,
        floorLevel,
      );
      const candidateMoves = rankMoves(legalMoves, formRecord.types)
        .slice(0, 8)
        .map((move) => move.moveId);
      const recommendedMoves = selectRecommendedMoves(
        legalMoves,
        formRecord.types,
      ).map((move) => move.moveId);

      if (recommendedMoves.length === 0) {
        missingMovesets = true;
        skippedRuntimeForms.push({
          formId: formRecord.formId,
          reason: `No legal level-up moves at floor level ${floorLevel}.`,
        });
        break;
      }

      const recommendedMoveSet = toMoveSet(recommendedMoves);
      movesetsByFloorLevel[floorLevel] = recommendedMoveSet;
      movesetPoolRecords.push({
        formId: formRecord.formId,
        levelBand: floorLevel,
        candidateMoves,
        recommendedMoves: recommendedMoveSet,
      });
    }

    if (missingMovesets) {
      continue;
    }

    runtimePokemonRecords.push({
      battlePokemonId: formRecord.formId,
      speciesId: formRecord.speciesId,
      formId: formRecord.formId,
      name: formRecord.name,
      types: toTypeTuple(formRecord.types),
      baseStats: formRecord.baseStats,
      legalLevelRange: {
        min: evolutionWindow.minLevel,
        max: evolutionWindow.maxLevel,
      },
      floorTypes: toTypeTuple(formRecord.types),
      movesetsByFloorLevel,
      sprite: formRecord.sprite,
    });
  }

  runtimePokemonRecords.sort((left, right) =>
    left.battlePokemonId.localeCompare(right.battlePokemonId, "en"),
  );

  const runtimeMoveIds = new Set(
    runtimePokemonRecords.flatMap((pokemonRecord) =>
      Object.values(pokemonRecord.movesetsByFloorLevel).flatMap(
        (moveSet) => moveSet,
      ),
    ),
  );

  const runtimeMoves = moveRecords.filter((moveRecord) =>
    runtimeMoveIds.has(moveRecord.moveId),
  );

  const starters = {
    grass: STARTER_SPECIES.grass.filter((speciesId) =>
      isStarterAvailable(speciesById, speciesId),
    ),
    fire: STARTER_SPECIES.fire.filter((speciesId) =>
      isStarterAvailable(speciesById, speciesId),
    ),
    water: STARTER_SPECIES.water.filter((speciesId) =>
      isStarterAvailable(speciesById, speciesId),
    ),
  };

  const normalizedMetadata: NormalizedMetadata = {
    source: rawSnapshot.manifest.source,
    apiBaseUrl: rawSnapshot.manifest.apiBaseUrl,
    fetchedAt: rawSnapshot.manifest.fetchedAt,
    builtAt: new Date().toISOString(),
    preferredLearnsetVersionGroups: [...PREFERRED_LEARNSET_VERSION_GROUPS],
    selectedLearnsetVersionGroups,
    excludedSpecies: [...excludedSpecies].sort((left, right) =>
      left.localeCompare(right, "en"),
    ),
    excludedForms: [...new Set(excludedForms)].sort((left, right) =>
      left.localeCompare(right, "en"),
    ),
    skippedRuntimeForms: [...skippedRuntimeForms].sort((left, right) =>
      left.formId.localeCompare(right.formId, "en"),
    ),
    counts: {
      species: speciesRecords.length,
      forms: formRecords.length,
      learnsets: learnsetRecords.length,
      moves: moveRecords.length,
      evolutionWindows: evolutionWindowRecords.length,
      movesetPools: movesetPoolRecords.length,
      runtimePokemon: runtimePokemonRecords.length,
      runtimeMoves: runtimeMoves.length,
    },
  };

  console.log("Writing normalized datasets...");
  await writeJsonFile(
    join(NORMALIZED_DATA_DIR, "metadata.json"),
    normalizedMetadata,
  );
  await writeJsonFile(
    join(NORMALIZED_DATA_DIR, "species.json"),
    speciesRecords,
  );
  await writeJsonFile(join(NORMALIZED_DATA_DIR, "forms.json"), formRecords);
  await writeJsonFile(
    join(NORMALIZED_DATA_DIR, "learnsets.json"),
    learnsetRecords,
  );
  await writeJsonFile(join(NORMALIZED_DATA_DIR, "moves.json"), moveRecords);
  await writeJsonFile(
    join(NORMALIZED_DATA_DIR, "evolution-chains.json"),
    evolutionIndex.chains,
  );
  await writeJsonFile(
    join(NORMALIZED_DATA_DIR, "evolution-windows.json"),
    evolutionWindowRecords,
  );
  await writeJsonFile(
    join(NORMALIZED_DATA_DIR, "moveset-pools.json"),
    movesetPoolRecords,
  );

  console.log("Writing runtime datasets...");
  await writeJsonFile(
    join(RUNTIME_DATA_DIR, "pokemon.json"),
    runtimePokemonRecords,
  );
  await writeJsonFile(join(RUNTIME_DATA_DIR, "moves.json"), runtimeMoves);
  await writeJsonFile(join(RUNTIME_DATA_DIR, "types.json"), TYPE_METADATA);
  await writeJsonFile(join(RUNTIME_DATA_DIR, "starters.json"), starters);
  await writeJsonFile(
    join(RUNTIME_DATA_DIR, "floor-levels.json"),
    FLOOR_LEVEL_DATASET,
  );

  console.log(
    `Build complete. Runtime exports: ${runtimePokemonRecords.length} Pokemon, ${runtimeMoves.length} moves.`,
  );
}

async function loadRawSnapshot(): Promise<RawSnapshot> {
  return {
    manifest: await readJsonFile<PokeApiSnapshotManifest>(
      join(RAW_POKEAPI_DIR, "manifest.json"),
    ),
    species: await readJsonFile<Record<string, PokeApiSpecies>>(
      join(RAW_POKEAPI_DIR, "species.json"),
    ),
    pokemon: await readJsonFile<Record<string, PokeApiPokemon>>(
      join(RAW_POKEAPI_DIR, "pokemon.json"),
    ),
    pokemonForms: await readJsonFile<Record<string, PokeApiPokemonForm>>(
      join(RAW_POKEAPI_DIR, "pokemon-forms.json"),
    ),
    moves: await readJsonFile<Record<string, PokeApiMove>>(
      join(RAW_POKEAPI_DIR, "moves.json"),
    ),
    evolutionChains: await readJsonFile<Record<string, PokeApiEvolutionChain>>(
      join(RAW_POKEAPI_DIR, "evolution-chains.json"),
    ),
  };
}

function buildEvolutionIndex(
  rawEvolutionChains: Record<string, PokeApiEvolutionChain>,
): EvolutionIndex {
  const stageWindowsBySpecies = new Map<string, SpeciesStageWindow>();
  const familyIdBySpecies = new Map<string, string>();
  const evolutionChainIdBySpecies = new Map<string, string>();
  const chains = Object.values(rawEvolutionChains)
    .sort((left, right) => left.id - right.id)
    .map((rawChain) => {
      const evolutionChainId = `chain-${rawChain.id}`;
      const rootSpeciesId = rawChain.chain.species.name;
      const familyId = `${rootSpeciesId}-family`;
      const nodes: NormalizedEvolutionChainNode[] = [];

      visitChainLink(
        rawChain.chain,
        0,
        1,
        familyId,
        evolutionChainId,
        stageWindowsBySpecies,
        familyIdBySpecies,
        evolutionChainIdBySpecies,
        nodes,
      );

      nodes.sort(
        (left, right) =>
          left.minLevel - right.minLevel ||
          left.speciesId.localeCompare(right.speciesId, "en"),
      );

      return {
        evolutionChainId,
        familyId,
        rootSpeciesId,
        nodes,
      };
    });

  return {
    chains,
    stageWindowsBySpecies,
    familyIdBySpecies,
    evolutionChainIdBySpecies,
  };
}

function visitChainLink(
  chainLink: PokeApiChainLink,
  depth: number,
  minLevel: number,
  familyId: string,
  evolutionChainId: string,
  stageWindowsBySpecies: Map<string, SpeciesStageWindow>,
  familyIdBySpecies: Map<string, string>,
  evolutionChainIdBySpecies: Map<string, string>,
  nodes: NormalizedEvolutionChainNode[],
): void {
  const childRules = chainLink.evolves_to.map((child) => {
    const rule = deriveEvolutionRule(child.evolution_details, depth + 1);

    return {
      speciesId: child.species.name,
      trigger: child.evolution_details[0]?.trigger?.name ?? "none",
      rule,
      child,
    };
  });
  const earliestRule = childRules.reduce<EvolutionRule | null>(
    (currentBest, childRule) => {
      if (!currentBest || childRule.rule.level < currentBest.level) {
        return childRule.rule;
      }

      return currentBest;
    },
    null,
  ) ?? { kind: "level", level: 101 };
  const maxLevel =
    childRules.length > 0 ? Math.max(minLevel, earliestRule.level - 1) : 100;
  const node: NormalizedEvolutionChainNode = {
    speciesId: chainLink.species.name,
    isBaby: chainLink.is_baby,
    minLevel,
    maxLevel,
    evolvesTo: childRules.map((childRule) => childRule.speciesId),
    evolutionRule: earliestRule,
    childRules: childRules.map((childRule) => ({
      speciesId: childRule.speciesId,
      kind: childRule.rule.kind,
      level: childRule.rule.level,
      trigger: childRule.trigger,
    })),
  };

  nodes.push(node);
  familyIdBySpecies.set(node.speciesId, familyId);
  evolutionChainIdBySpecies.set(node.speciesId, evolutionChainId);
  stageWindowsBySpecies.set(node.speciesId, {
    speciesId: node.speciesId,
    familyId,
    evolutionChainId,
    minLevel,
    maxLevel,
    evolvesTo: [...node.evolvesTo],
    evolutionRule: earliestRule,
  });

  for (const childRule of childRules) {
    visitChainLink(
      childRule.child,
      depth + 1,
      childRule.rule.level,
      familyId,
      evolutionChainId,
      stageWindowsBySpecies,
      familyIdBySpecies,
      evolutionChainIdBySpecies,
      nodes,
    );
  }
}

function deriveEvolutionRule(
  evolutionDetails: PokeApiEvolutionDetail[],
  childDepth: number,
): EvolutionRule {
  const levelRequirements = evolutionDetails
    .map((detail) => detail.min_level)
    .filter((minLevel): minLevel is number => minLevel !== null)
    .sort((left, right) => left - right);

  if (levelRequirements.length > 0) {
    return {
      kind: "level",
      level: levelRequirements[0]!,
    };
  }

  return {
    kind: "fallback-non-level",
    level: childDepth <= 1 ? 18 : 36,
  };
}

function isAllowedSpecies(species: PokeApiSpecies): boolean {
  return (
    !species.is_legendary &&
    !species.is_mythical &&
    !ULTRA_BEAST_SPECIES.has(species.name) &&
    !PARADOX_SPECIES.has(species.name)
  );
}

function parseGeneration(generationName: string): number {
  const generationMap: Record<string, number> = {
    "generation-i": 1,
    "generation-ii": 2,
    "generation-iii": 3,
    "generation-iv": 4,
    "generation-v": 5,
    "generation-vi": 6,
    "generation-vii": 7,
    "generation-viii": 8,
    "generation-ix": 9,
  };

  return generationMap[generationName] ?? 0;
}

function classifyAllowedForm(
  isDefaultVariety: boolean,
  pokemonName: string,
  pokemonForm: PokeApiPokemonForm | undefined,
): "default-form" | "regional-form" | null {
  if (pokemonForm?.is_battle_only || pokemonForm?.is_mega) {
    return null;
  }

  if (isDefaultVariety) {
    return "default-form";
  }

  const tokens = pokemonName.split("-");
  const blockedRegionalTokens = new Set(["cap", "totem"]);

  return REGIONAL_FORM_TOKENS.some((token) => tokens.includes(token)) &&
    !tokens.some((token) => blockedRegionalTokens.has(token))
    ? "regional-form"
    : null;
}

function parseTypes(pokemonRecord: PokeApiPokemon): PokemonTypeId[] {
  return [...pokemonRecord.types]
    .sort((left, right) => left.slot - right.slot)
    .map((entry) => {
      if (!TYPE_ID_SET.has(entry.type.name as PokemonTypeId)) {
        throw new Error(
          `Unsupported type ${entry.type.name} for ${pokemonRecord.name}`,
        );
      }

      return entry.type.name as PokemonTypeId;
    });
}

function parseStatBlock(stats: PokeApiPokemon["stats"]): StatBlock {
  const statMap = new Map(
    stats.map((entry) => [entry.stat.name, entry.base_stat]),
  );

  return {
    hp: statMap.get("hp") ?? 1,
    attack: statMap.get("attack") ?? 1,
    defense: statMap.get("defense") ?? 1,
    specialAttack: statMap.get("special-attack") ?? 1,
    specialDefense: statMap.get("special-defense") ?? 1,
    speed: statMap.get("speed") ?? 1,
  };
}

function selectSpriteSet(pokemonRecord: PokeApiPokemon): FormRecord["sprite"] {
  const front =
    pokemonRecord.sprites.other?.["official-artwork"]?.front_default ??
    pokemonRecord.sprites.front_default;

  if (!front) {
    throw new Error(`Missing front sprite for ${pokemonRecord.name}`);
  }

  return {
    front,
    back: pokemonRecord.sprites.back_default ?? undefined,
    icon: pokemonRecord.sprites.front_default ?? undefined,
  };
}

function chooseVersionGroup(pokemonRecord: PokeApiPokemon): string | null {
  const versionGroups = new Set<string>();

  for (const moveEntry of pokemonRecord.moves) {
    for (const detail of moveEntry.version_group_details) {
      if (detail.move_learn_method.name === "level-up") {
        versionGroups.add(detail.version_group.name);
      }
    }
  }

  for (const versionGroup of PREFERRED_LEARNSET_VERSION_GROUPS) {
    if (versionGroups.has(versionGroup)) {
      return versionGroup;
    }
  }

  const fallbackVersionGroup = [...versionGroups].sort((left, right) =>
    left.localeCompare(right, "en"),
  )[0];

  return fallbackVersionGroup ?? null;
}

function buildLearnsetEntries(
  pokemonRecord: PokeApiPokemon,
  selectedVersionGroup: string | null,
): Array<{
  moveId: string;
  learnMethod: "level-up";
  learnLevel: number;
}> {
  if (!selectedVersionGroup) {
    return [];
  }

  const learnLevelsByMove = new Map<string, number>();

  for (const moveEntry of pokemonRecord.moves) {
    const matchingDetails = moveEntry.version_group_details.filter(
      (detail) =>
        detail.move_learn_method.name === "level-up" &&
        detail.version_group.name === selectedVersionGroup,
    );

    if (matchingDetails.length === 0) {
      continue;
    }

    const normalizedLevel = matchingDetails.reduce((lowestLevel, detail) => {
      const detailLevel = Math.max(1, detail.level_learned_at || 1);

      return Math.min(lowestLevel, detailLevel);
    }, Number.POSITIVE_INFINITY);
    const existingLevel = learnLevelsByMove.get(moveEntry.move.name);

    if (existingLevel === undefined || normalizedLevel < existingLevel) {
      learnLevelsByMove.set(moveEntry.move.name, normalizedLevel);
    }
  }

  return [...learnLevelsByMove.entries()]
    .sort(
      ([leftMoveId, leftLevel], [rightMoveId, rightLevel]) =>
        leftLevel - rightLevel || leftMoveId.localeCompare(rightMoveId, "en"),
    )
    .map(([moveId, learnLevel]) => ({
      moveId,
      learnMethod: "level-up" as const,
      learnLevel,
    }));
}

function normalizeMoveRecord(move: PokeApiMove): MoveRecord {
  const effectData: Record<string, string | number | boolean> = {};

  if (move.meta?.ailment_chance) {
    effectData.ailmentChance = move.meta.ailment_chance;
  }

  if (move.meta?.stat_chance) {
    effectData.statChance = move.meta.stat_chance;
  }

  if (move.meta?.drain) {
    effectData.drain = move.meta.drain;
  }

  if (move.meta?.healing) {
    effectData.healing = move.meta.healing;
  }

  if (move.meta?.max_hits) {
    effectData.maxHits = move.meta.max_hits;
  }

  return {
    moveId: move.name,
    name: getEnglishName(move.names, move.name),
    type: move.type.name as PokemonTypeId,
    category:
      move.damage_class?.name === "physical" ||
      move.damage_class?.name === "special" ||
      move.damage_class?.name === "status"
        ? move.damage_class.name
        : "status",
    power: move.power ?? 0,
    accuracy: move.accuracy ?? 100,
    pp: move.pp ?? 1,
    priority: move.priority,
    target: normalizeMoveTarget(move.target.name),
    effectTag: deriveEffectTag(move),
    effectData: Object.keys(effectData).length > 0 ? effectData : undefined,
    allowedInGame: isAllowedMove(move),
  };
}

function normalizeMoveTarget(targetName: string): string {
  const targetAliases: Record<string, string> = {
    "selected-pokemon": "opponent",
    "all-other-pokemon": "opponent",
    "random-opponent": "opponent",
    "all-opponents": "opponent",
    "opponents-field": "opponent",
    user: "self",
    "user-or-ally": "self",
    "users-field": "self-field",
    "entire-field": "field",
    ally: "ally",
    "all-allies": "ally",
    "user-and-allies": "ally",
  };

  return targetAliases[targetName] ?? targetName;
}

function deriveEffectTag(move: PokeApiMove): MoveEffectTag {
  if (move.name === "protect") {
    return "protect";
  }

  if ((move.meta?.max_hits ?? 0) > 1) {
    return "multi-hit";
  }

  if ((move.meta?.drain ?? 0) > 0) {
    return "drain";
  }

  if ((move.meta?.drain ?? 0) < 0) {
    return "recoil";
  }

  if (move.priority > 0) {
    return "priority";
  }

  if ((move.meta?.healing ?? 0) > 0) {
    return "heal";
  }

  const totalStatChange = move.stat_changes.reduce(
    (total, statChange) => total + statChange.change,
    0,
  );

  if (totalStatChange > 0) {
    return "stat-boost";
  }

  if (totalStatChange < 0) {
    return "stat-drop";
  }

  if (
    move.meta?.ailment?.name &&
    move.meta.ailment.name !== "none" &&
    move.meta.ailment.name !== "unknown"
  ) {
    return "status-apply";
  }

  if (move.damage_class?.name === "status") {
    return "other";
  }

  return "none";
}

function isAllowedMove(move: PokeApiMove): boolean {
  const blockedTargets = new Set(["ally", "all-allies", "user-and-allies"]);
  const blockedMetaCategories = new Set(["whole-field-effect"]);

  return (
    !blockedTargets.has(move.target.name) &&
    !blockedMetaCategories.has(move.meta?.category.name ?? "")
  );
}

function getLegalMoveRecords(
  learnset: Array<{ moveId: string; learnLevel: number }>,
  moveRecordById: Map<string, MoveRecord>,
  floorLevel: FloorLevel,
): MoveRecord[] {
  const legalMoves = learnset
    .filter((learnsetEntry) => learnsetEntry.learnLevel <= floorLevel)
    .map((learnsetEntry) => moveRecordById.get(learnsetEntry.moveId))
    .filter((moveRecord): moveRecord is MoveRecord => moveRecord !== undefined);

  const allowedMoves = legalMoves.filter(
    (moveRecord) => moveRecord.allowedInGame,
  );

  return allowedMoves.length > 0 ? allowedMoves : legalMoves;
}

function rankMoves(
  moveRecords: MoveRecord[],
  types: PokemonTypeId[],
): MoveRecord[] {
  return [...moveRecords].sort((left, right) => {
    const scoreDifference = scoreMove(right, types) - scoreMove(left, types);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const powerDifference = right.power - left.power;

    if (powerDifference !== 0) {
      return powerDifference;
    }

    return left.moveId.localeCompare(right.moveId, "en");
  });
}

function selectRecommendedMoves(
  moveRecords: MoveRecord[],
  types: PokemonTypeId[],
): MoveRecord[] {
  const rankedMoves = rankMoves(moveRecords, types);
  const damagingMoves = rankedMoves.filter(
    (moveRecord) => moveRecord.category !== "status" && moveRecord.power > 0,
  );
  const statusMoves = rankedMoves.filter(
    (moveRecord) => moveRecord.category === "status",
  );
  const recommended: MoveRecord[] = [];
  const selectedMoveIds = new Set<string>();

  const addMove = (moveRecord: MoveRecord | undefined): void => {
    if (
      !moveRecord ||
      selectedMoveIds.has(moveRecord.moveId) ||
      recommended.length >= 4
    ) {
      return;
    }

    if (isRedundantDamagingMove(moveRecord, recommended)) {
      return;
    }

    selectedMoveIds.add(moveRecord.moveId);
    recommended.push(moveRecord);
  };

  addMove(damagingMoves.find((moveRecord) => types.includes(moveRecord.type)));
  addMove(
    damagingMoves.find(
      (moveRecord) =>
        !selectedMoveIds.has(moveRecord.moveId) &&
        (!types.includes(moveRecord.type) ||
          moveRecord.type !== recommended[0]?.type),
    ),
  );
  addMove(
    damagingMoves.find((moveRecord) => !selectedMoveIds.has(moveRecord.moveId)),
  );
  addMove(
    statusMoves.find(
      (moveRecord) =>
        HIGH_VALUE_STATUS_MOVES.has(moveRecord.moveId) ||
        moveRecord.effectTag === "heal" ||
        moveRecord.effectTag === "protect" ||
        moveRecord.effectTag === "status-apply" ||
        moveRecord.effectTag === "stat-boost",
    ),
  );

  for (const moveRecord of rankedMoves) {
    addMove(moveRecord);
  }

  return recommended.slice(0, 4);
}

function scoreMove(moveRecord: MoveRecord, types: PokemonTypeId[]): number {
  const stabBonus = types.includes(moveRecord.type) ? 35 : 0;
  const accuracyScore = moveRecord.accuracy;
  const priorityScore =
    moveRecord.priority > 0 ? 20 + moveRecord.priority * 5 : 0;
  const damageScore =
    moveRecord.category === "status"
      ? 0
      : moveRecord.power * 2 + accuracyScore + stabBonus + priorityScore;

  if (moveRecord.category !== "status") {
    return damageScore;
  }

  let utilityScore = 25;

  if (HIGH_VALUE_STATUS_MOVES.has(moveRecord.moveId)) {
    utilityScore += 65;
  }

  if (moveRecord.effectTag === "heal") {
    utilityScore += 35;
  }

  if (moveRecord.effectTag === "protect") {
    utilityScore += 30;
  }

  if (moveRecord.effectTag === "status-apply") {
    utilityScore += 28;
  }

  if (moveRecord.effectTag === "stat-boost") {
    utilityScore += 26;
  }

  if (moveRecord.effectTag === "stat-drop") {
    utilityScore += 18;
  }

  return utilityScore + accuracyScore;
}

function isRedundantDamagingMove(
  candidateMove: MoveRecord,
  selectedMoves: MoveRecord[],
): boolean {
  if (candidateMove.category === "status" || candidateMove.power <= 0) {
    return false;
  }

  return selectedMoves.some(
    (selectedMove) =>
      selectedMove.category !== "status" &&
      selectedMove.type === candidateMove.type &&
      selectedMove.category === candidateMove.category &&
      selectedMove.power >= candidateMove.power &&
      selectedMove.accuracy >= candidateMove.accuracy,
  );
}

function toMoveSet(moveIds: string[]): MoveSet {
  if (moveIds.length < 1 || moveIds.length > 4) {
    throw new Error(
      `MoveSet must contain 1-4 moves, received ${moveIds.length}`,
    );
  }

  return moveIds as MoveSet;
}

function toTypeTuple(
  types: PokemonTypeId[],
): [PokemonTypeId] | [PokemonTypeId, PokemonTypeId] {
  if (types.length === 1) {
    const [firstType] = types;

    if (!firstType) {
      throw new Error("Expected one Pokemon type but found none");
    }

    return [firstType];
  }

  if (types.length === 2) {
    const [firstType, secondType] = types;

    if (!firstType || !secondType) {
      throw new Error("Expected two Pokemon types but found a missing value");
    }

    return [firstType, secondType];
  }

  throw new Error(
    `Pokemon must have one or two types, received ${types.length}`,
  );
}

function fallbackStageWindow(speciesId: string): SpeciesStageWindow {
  return {
    speciesId,
    familyId: `${speciesId}-family`,
    evolutionChainId: `chain-${speciesId}`,
    minLevel: 1,
    maxLevel: 100,
    evolvesTo: [],
    evolutionRule: {
      kind: "level",
      level: 101,
    },
  };
}

function getEnglishName(
  names: ApiName[] | undefined,
  fallbackId: string,
): string {
  const englishName = names?.find(
    (nameEntry) => nameEntry.language.name === "en",
  )?.name;

  return englishName ?? humanizeId(fallbackId);
}

function humanizeId(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isStarterAvailable(
  speciesById: Map<string, SpeciesRecord>,
  speciesId: string,
): boolean {
  const speciesRecord = speciesById.get(speciesId);

  return Boolean(
    speciesRecord?.allowedInGame && speciesRecord.forms.includes(speciesId),
  );
}

await main();
