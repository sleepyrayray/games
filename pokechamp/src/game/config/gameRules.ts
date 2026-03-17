import {
  FLOOR_LEVELS,
  POKEMON_TYPES,
  type FloorLevel,
  type PokemonTypeId,
} from "../../types/pokechamp-data";

export const GAME_TITLE = "PokeChamp";
export const GAME_SUBTITLE = "Tower Challenge Prototype";

export const GAME_VIEWPORT = {
  width: 1280,
  height: 720,
} as const;

export const FLOOR_COUNT = 18;

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
