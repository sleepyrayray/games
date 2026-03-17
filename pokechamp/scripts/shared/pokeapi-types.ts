export interface NamedApiResource {
  name: string;
  url: string;
}

export interface UrlOnlyApiResource {
  url: string;
}

export interface ApiName {
  language: NamedApiResource;
  name: string;
}

export interface PokeApiListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: NamedApiResource[];
}

export interface PokeApiSpecies {
  id: number;
  name: string;
  names: ApiName[];
  is_baby: boolean;
  is_legendary: boolean;
  is_mythical: boolean;
  generation: NamedApiResource;
  evolves_from_species: NamedApiResource | null;
  evolution_chain: UrlOnlyApiResource;
  varieties: Array<{
    is_default: boolean;
    pokemon: NamedApiResource;
  }>;
}

export interface PokeApiPokemon {
  id: number;
  name: string;
  is_default: boolean;
  species: NamedApiResource;
  forms: NamedApiResource[];
  types: Array<{
    slot: number;
    type: NamedApiResource;
  }>;
  stats: Array<{
    base_stat: number;
    stat: NamedApiResource;
  }>;
  moves: Array<{
    move: NamedApiResource;
    version_group_details: Array<{
      level_learned_at: number;
      move_learn_method: NamedApiResource;
      order: number | null;
      version_group: NamedApiResource;
    }>;
  }>;
  sprites: {
    front_default: string | null;
    back_default: string | null;
    other?: {
      "official-artwork"?: {
        front_default: string | null;
      };
    };
  };
}

export interface PokeApiPokemonForm {
  name: string;
  form_name: string;
  names: ApiName[];
  form_names: ApiName[];
  is_battle_only: boolean;
  is_default: boolean;
  is_mega: boolean;
}

export interface PokeApiMove {
  id: number;
  name: string;
  names: ApiName[];
  accuracy: number | null;
  power: number | null;
  pp: number | null;
  priority: number;
  type: NamedApiResource;
  damage_class: NamedApiResource | null;
  target: NamedApiResource;
  meta: {
    ailment: NamedApiResource;
    ailment_chance: number;
    category: NamedApiResource;
    crit_rate: number;
    drain: number;
    flinch_chance: number;
    healing: number;
    max_hits: number | null;
    max_turns: number | null;
    min_hits: number | null;
    min_turns: number | null;
    stat_chance: number;
  } | null;
  stat_changes: Array<{
    change: number;
    stat: NamedApiResource;
  }>;
  effect_entries: Array<{
    effect: string;
    short_effect: string;
    language: NamedApiResource;
  }>;
}

export interface PokeApiEvolutionDetail {
  min_level: number | null;
  trigger: NamedApiResource | null;
  item: NamedApiResource | null;
  known_move: NamedApiResource | null;
  known_move_type: NamedApiResource | null;
  min_happiness: number | null;
  min_affection: number | null;
  min_beauty: number | null;
  location: NamedApiResource | null;
  party_species: NamedApiResource | null;
  party_type: NamedApiResource | null;
  relative_physical_stats: number | null;
  time_of_day: string;
  trade_species: NamedApiResource | null;
  needs_overworld_rain: boolean;
  turn_upside_down: boolean;
}

export interface PokeApiChainLink {
  is_baby: boolean;
  species: NamedApiResource;
  evolution_details: PokeApiEvolutionDetail[];
  evolves_to: PokeApiChainLink[];
}

export interface PokeApiEvolutionChain {
  id: number;
  baby_trigger_item: NamedApiResource | null;
  chain: PokeApiChainLink;
}

export interface PokeApiSnapshotManifest {
  source: "pokeapi";
  apiBaseUrl: string;
  fetchedAt: string;
  preferredLearnsetVersionGroups: string[];
  counts: {
    species: number;
    pokemon: number;
    pokemonForms: number;
    moves: number;
    evolutionChains: number;
  };
}
