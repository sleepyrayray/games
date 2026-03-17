import { join } from "node:path";

import {
  FETCH_CONCURRENCY,
  POKEAPI_BASE_URL,
  PREFERRED_LEARNSET_VERSION_GROUPS,
  RAW_POKEAPI_DIR,
} from "../shared/pipeline-config.ts";
import { sortRecordByKey, writeJsonFile } from "../shared/file-utils.ts";
import type {
  NamedApiResource,
  PokeApiEvolutionChain,
  PokeApiListResponse,
  PokeApiMove,
  PokeApiPokemon,
  PokeApiPokemonForm,
  PokeApiSnapshotManifest,
  PokeApiSpecies,
} from "../shared/pokeapi-types.ts";

const SPECIES_LIST_LIMIT = 2000;
const DEFAULT_RETRIES = 3;

async function main(): Promise<void> {
  console.log("Fetching species index from PokeAPI...");

  const speciesIndex = await fetchJson<PokeApiListResponse>(
    `${POKEAPI_BASE_URL}/pokemon-species?limit=${SPECIES_LIST_LIMIT}`,
  );

  const speciesResources = sortResources(speciesIndex.results);
  console.log(`Fetching ${speciesResources.length} species records...`);

  const species = await fetchResourceMap<PokeApiSpecies>(
    speciesResources,
    "species",
  );
  const pokemonResources = collectUniqueResources(
    Object.values(species).flatMap((entry) =>
      entry.varieties.map((variety) => variety.pokemon),
    ),
  );

  console.log(`Fetching ${pokemonResources.length} Pokemon variety records...`);
  const pokemon = await fetchResourceMap<PokeApiPokemon>(
    pokemonResources,
    "pokemon",
  );

  const nonDefaultPokemonResources = collectUniqueResources(
    Object.values(species).flatMap((entry) =>
      entry.varieties
        .filter((variety) => !variety.is_default)
        .map((variety) => variety.pokemon),
    ),
  );

  const pokemonFormResources = collectUniqueResources(
    nonDefaultPokemonResources.flatMap((resource) => {
      const pokemonRecord = pokemon[resource.name];

      return pokemonRecord?.forms ?? [];
    }),
  );

  console.log(
    `Fetching ${pokemonFormResources.length} non-default form records...`,
  );
  const pokemonForms = await fetchResourceMap<PokeApiPokemonForm>(
    pokemonFormResources,
    "pokemon-form",
  );

  const evolutionChainResources = collectUniqueResources(
    Object.values(species).map((entry) => ({
      name: parseResourceKey(entry.evolution_chain.url),
      url: entry.evolution_chain.url,
    })),
  );

  console.log(
    `Fetching ${evolutionChainResources.length} evolution chain records...`,
  );
  const evolutionChains = await fetchResourceMap<PokeApiEvolutionChain>(
    evolutionChainResources,
    "evolution-chain",
  );

  const moveResources = collectUniqueResources(
    Object.values(pokemon).flatMap((entry) =>
      entry.moves
        .filter((moveEntry) =>
          moveEntry.version_group_details.some(
            (detail) => detail.move_learn_method.name === "level-up",
          ),
        )
        .map((moveEntry) => moveEntry.move),
    ),
  );

  console.log(
    `Fetching ${moveResources.length} move records used by level-up learnsets...`,
  );
  const moves = await fetchResourceMap<PokeApiMove>(moveResources, "move");

  const manifest: PokeApiSnapshotManifest = {
    source: "pokeapi",
    apiBaseUrl: POKEAPI_BASE_URL,
    fetchedAt: new Date().toISOString(),
    preferredLearnsetVersionGroups: [...PREFERRED_LEARNSET_VERSION_GROUPS],
    counts: {
      species: Object.keys(species).length,
      pokemon: Object.keys(pokemon).length,
      pokemonForms: Object.keys(pokemonForms).length,
      moves: Object.keys(moves).length,
      evolutionChains: Object.keys(evolutionChains).length,
    },
  };

  console.log("Writing raw snapshot files...");

  await writeJsonFile(join(RAW_POKEAPI_DIR, "manifest.json"), manifest);
  await writeJsonFile(
    join(RAW_POKEAPI_DIR, "species.json"),
    sortRecordByKey(species),
  );
  await writeJsonFile(
    join(RAW_POKEAPI_DIR, "pokemon.json"),
    sortRecordByKey(pokemon),
  );
  await writeJsonFile(
    join(RAW_POKEAPI_DIR, "pokemon-forms.json"),
    sortRecordByKey(pokemonForms),
  );
  await writeJsonFile(
    join(RAW_POKEAPI_DIR, "moves.json"),
    sortRecordByKey(moves),
  );
  await writeJsonFile(
    join(RAW_POKEAPI_DIR, "evolution-chains.json"),
    sortRecordByKey(evolutionChains),
  );

  console.log("Raw PokeAPI snapshot complete.");
}

async function fetchResourceMap<T>(
  resources: NamedApiResource[],
  label: string,
): Promise<Record<string, T>> {
  const records: Record<string, T> = {};
  let completed = 0;

  await mapWithConcurrency(resources, FETCH_CONCURRENCY, async (resource) => {
    records[resource.name] = await fetchJson<T>(resource.url);
    completed += 1;

    if (completed % 50 === 0 || completed === resources.length) {
      console.log(`[${label}] ${completed}/${resources.length}`);
    }
  });

  return records;
}

async function fetchJson<T>(
  url: string,
  retries = DEFAULT_RETRIES,
): Promise<T> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status} for ${url}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (retries <= 1) {
      throw error;
    }

    await wait(300 * (DEFAULT_RETRIES - retries + 1));
    return fetchJson<T>(url, retries - 1);
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let index = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const currentIndex = index;
        index += 1;
        const item = items[currentIndex];

        if (item === undefined) {
          continue;
        }

        await worker(item, currentIndex);
      }
    }),
  );
}

function collectUniqueResources(
  resources: NamedApiResource[],
): NamedApiResource[] {
  const uniqueResources = new Map<string, NamedApiResource>();

  for (const resource of resources) {
    uniqueResources.set(resource.name, resource);
  }

  return sortResources([...uniqueResources.values()]);
}

function sortResources(resources: NamedApiResource[]): NamedApiResource[] {
  return [...resources].sort((left, right) => {
    const leftId = parseNumericId(left.url);
    const rightId = parseNumericId(right.url);

    if (leftId !== null && rightId !== null && leftId !== rightId) {
      return leftId - rightId;
    }

    return left.name.localeCompare(right.name, "en");
  });
}

function parseNumericId(url: string): number | null {
  const match = url.match(/\/(\d+)\/?$/u);

  return match ? Number(match[1]) : null;
}

function parseResourceKey(url: string): string {
  return String(parseNumericId(url) ?? url);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

await main();
