import {
  FLOOR_LEVELS,
  POKEMON_TYPES,
  type FloorLevel,
  type PokemonTypeId,
} from "../../types/pokechamp-data.ts";

export const GAME_TITLE = "PokeChamp";
export const GAME_SUBTITLE = "Tower Challenge Prototype";

export const GAME_VIEWPORT = {
  width: 1280,
  height: 720,
} as const;

export const FLOOR_COUNT = 18;

export const EARLY_FLOOR_PLAYER_BALANCE_BY_FLOOR = {
  1: {
    attack: 1.12,
    defense: 1.1,
    hp: 1.18,
    specialAttack: 1.12,
    specialDefense: 1.1,
    speed: 1.08,
  },
  2: {
    attack: 1.08,
    defense: 1.06,
    hp: 1.12,
    specialAttack: 1.08,
    specialDefense: 1.06,
    speed: 1.04,
  },
  3: {
    attack: 1.05,
    defense: 1.03,
    hp: 1.08,
    specialAttack: 1.05,
    specialDefense: 1.03,
    speed: 1.02,
  },
} as const;

export const FLOOR_LEVEL_BY_NUMBER = FLOOR_LEVELS.map((level, index) => ({
  floorNumber: index + 1,
  level,
})) satisfies ReadonlyArray<{
  floorNumber: number;
  level: FloorLevel;
}>;

export const TYPE_LABELS: Record<PokemonTypeId, string> = {
  normal: "Normal",
  fire: "Fire",
  water: "Water",
  electric: "Electric",
  grass: "Grass",
  ice: "Ice",
  fighting: "Fighting",
  poison: "Poison",
  ground: "Ground",
  flying: "Flying",
  psychic: "Psychic",
  bug: "Bug",
  rock: "Rock",
  ghost: "Ghost",
  dragon: "Dragon",
  dark: "Dark",
  steel: "Steel",
  fairy: "Fairy",
};

export const TYPE_BADGE_COLORS: Record<PokemonTypeId, number> = {
  normal: 0xa8a77a,
  fire: 0xee8130,
  water: 0x6390f0,
  electric: 0xf7d02c,
  grass: 0x7ac74c,
  ice: 0x96d9d6,
  fighting: 0xc22e28,
  poison: 0xa33ea1,
  ground: 0xe2bf65,
  flying: 0xa98ff3,
  psychic: 0xf95587,
  bug: 0xa6b91a,
  rock: 0xb6a136,
  ghost: 0x735797,
  dragon: 0x6f35fc,
  dark: 0x705746,
  steel: 0xb7b7ce,
  fairy: 0xd685ad,
};

export const TYPE_EFFECTIVENESS_BY_ATTACK_TYPE: Record<
  PokemonTypeId,
  Partial<Record<PokemonTypeId, number>>
> = {
  normal: {
    rock: 0.5,
    ghost: 0,
    steel: 0.5,
  },
  fire: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 2,
    bug: 2,
    rock: 0.5,
    dragon: 0.5,
    steel: 2,
  },
  water: {
    fire: 2,
    water: 0.5,
    grass: 0.5,
    ground: 2,
    rock: 2,
    dragon: 0.5,
  },
  electric: {
    water: 2,
    electric: 0.5,
    grass: 0.5,
    ground: 0,
    flying: 2,
    dragon: 0.5,
  },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    poison: 0.5,
    ground: 2,
    flying: 0.5,
    bug: 0.5,
    rock: 2,
    dragon: 0.5,
    steel: 0.5,
  },
  ice: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 0.5,
    ground: 2,
    flying: 2,
    dragon: 2,
    steel: 0.5,
  },
  fighting: {
    normal: 2,
    ice: 2,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2,
    ghost: 0,
    dark: 2,
    steel: 2,
    fairy: 0.5,
  },
  poison: {
    grass: 2,
    poison: 0.5,
    ground: 0.5,
    rock: 0.5,
    ghost: 0.5,
    steel: 0,
    fairy: 2,
  },
  ground: {
    fire: 2,
    electric: 2,
    grass: 0.5,
    poison: 2,
    flying: 0,
    bug: 0.5,
    rock: 2,
    steel: 2,
  },
  flying: {
    electric: 0.5,
    grass: 2,
    fighting: 2,
    bug: 2,
    rock: 0.5,
    steel: 0.5,
  },
  psychic: {
    fighting: 2,
    poison: 2,
    psychic: 0.5,
    dark: 0,
    steel: 0.5,
  },
  bug: {
    fire: 0.5,
    grass: 2,
    fighting: 0.5,
    poison: 0.5,
    flying: 0.5,
    psychic: 2,
    ghost: 0.5,
    dark: 2,
    steel: 0.5,
    fairy: 0.5,
  },
  rock: {
    fire: 2,
    ice: 2,
    fighting: 0.5,
    ground: 0.5,
    flying: 2,
    bug: 2,
    steel: 0.5,
  },
  ghost: {
    normal: 0,
    psychic: 2,
    ghost: 2,
    dark: 0.5,
  },
  dragon: {
    dragon: 2,
    steel: 0.5,
    fairy: 0,
  },
  dark: {
    fighting: 0.5,
    psychic: 2,
    ghost: 2,
    dark: 0.5,
    fairy: 0.5,
  },
  steel: {
    fire: 0.5,
    water: 0.5,
    electric: 0.5,
    ice: 2,
    rock: 2,
    steel: 0.5,
    fairy: 2,
  },
  fairy: {
    fire: 0.5,
    fighting: 2,
    poison: 0.5,
    dragon: 2,
    dark: 2,
    steel: 0.5,
  },
};

export function getSingleTypeEffectivenessMultiplier(
  attackType: PokemonTypeId,
  defenseType: PokemonTypeId,
): number {
  return TYPE_EFFECTIVENESS_BY_ATTACK_TYPE[attackType][defenseType] ?? 1;
}

export function getTypeEffectivenessMultiplier(
  attackType: PokemonTypeId,
  defenseTypes: readonly PokemonTypeId[],
): number {
  return defenseTypes.reduce(
    (multiplier, defenseType) =>
      multiplier * getSingleTypeEffectivenessMultiplier(attackType, defenseType),
    1,
  );
}

export function describeTypeEffectiveness(multiplier: number): string {
  if (multiplier === 0) {
    return "No effect";
  }

  if (multiplier >= 4) {
    return "Super effective x4";
  }

  if (multiplier > 1) {
    return "Super effective";
  }

  if (multiplier <= 0.25) {
    return "Not very effective x0.25";
  }

  if (multiplier < 1) {
    return "Not very effective";
  }

  return "Normal effectiveness";
}

export const FLOOR_THEME_ROTATION = [...POKEMON_TYPES];

export const PHASE_ONE_CHECKLIST = [
  "TypeScript + Vite project scaffold",
  "Phaser boot flow with two scenes",
  "Shared game rules from runtime data contracts",
  "Data and scripts folders ready for the importer",
] as const;

const FINAL_FLOOR_LEVEL =
  FLOOR_LEVELS[FLOOR_LEVELS.length - 1] ?? FLOOR_LEVELS[0];

export const PHASE_ONE_SUMMARY = {
  starterFloorLevel: FLOOR_LEVELS[0],
  finalFloorLevel: FINAL_FLOOR_LEVEL,
  typeCount: POKEMON_TYPES.length,
};
