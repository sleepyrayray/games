export const POKEMON_TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;

export const FLOOR_LEVELS = [
  8,
  12,
  15,
  19,
  23,
  26,
  30,
  34,
  37,
  41,
  44,
  48,
  52,
  55,
  59,
  63,
  66,
  70,
] as const;

export const MOVE_CATEGORIES = ["physical", "special", "status"] as const;

export const MOVE_EFFECT_TAGS = [
  "none",
  "stat-boost",
  "stat-drop",
  "protect",
  "heal",
  "status-apply",
  "recoil",
  "drain",
  "priority",
  "multi-hit",
  "other",
] as const;

export const FORM_TAGS = ["default-form", "regional-form"] as const;

export type PokemonTypeId = (typeof POKEMON_TYPES)[number];
export type FloorLevel = (typeof FLOOR_LEVELS)[number];
export type MoveCategory = (typeof MOVE_CATEGORIES)[number];
export type MoveEffectTag = (typeof MOVE_EFFECT_TAGS)[number];
export type FormTag = (typeof FORM_TAGS)[number];
export type IdString = string;
export type MoveId = IdString;
export type SpeciesId = IdString;
export type FormId = IdString;
export type BattlePokemonId = IdString;
export type FamilyId = IdString;
export type EvolutionChainId = IdString;

export type MoveSet =
  | [MoveId]
  | [MoveId, MoveId]
  | [MoveId, MoveId, MoveId]
  | [MoveId, MoveId, MoveId, MoveId];

export interface StatBlock {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface SpriteSet {
  front: string;
  back?: string;
  icon?: string;
}

export interface SpeciesRecord {
  speciesId: SpeciesId;
  dexNumber: number;
  name: string;
  familyId: FamilyId;
  generation: number;
  isBaby: boolean;
  isLegendary: boolean;
  isMythical: boolean;
  isUltraBeast: boolean;
  isParadox: boolean;
  allowedInGame: boolean;
  starterEligible: boolean;
  forms: FormId[];
  evolutionChainId: EvolutionChainId;
}

export interface FormRecord {
  formId: FormId;
  speciesId: SpeciesId;
  name: string;
  formName: string;
  types: PokemonTypeId[];
  baseStats: StatBlock;
  sprite: SpriteSet;
  tags: FormTag[];
  allowedInGame: boolean;
}

export interface EvolutionRule {
  kind: "level" | "fallback-non-level";
  level: number;
}

export interface EvolutionStageWindowRecord {
  speciesId: SpeciesId;
  formId: FormId;
  familyId: FamilyId;
  minLevel: number;
  maxLevel: number;
  evolvesTo: SpeciesId[];
  evolutionRule: EvolutionRule;
}

export interface LearnsetEntry {
  moveId: MoveId;
  learnMethod: "level-up";
  learnLevel: number;
}

export interface LearnsetRecord {
  formId: FormId;
  learnset: LearnsetEntry[];
}

export interface CuratedBattleMovesetPoolRecord {
  formId: FormId;
  levelBand: FloorLevel;
  candidateMoves: MoveId[];
  recommendedMoves: MoveSet;
}

export interface MoveRecord {
  moveId: MoveId;
  name: string;
  type: PokemonTypeId;
  category: MoveCategory;
  power: number;
  accuracy: number;
  pp: number;
  priority: number;
  target: string;
  effectTag: MoveEffectTag;
  effectData?: Record<string, string | number | boolean>;
  allowedInGame: boolean;
}

export type MovesetsByFloorLevel = Partial<Record<FloorLevel, MoveSet>>;

export interface BattleReadyPokemonRecord {
  battlePokemonId: BattlePokemonId;
  speciesId: SpeciesId;
  formId: FormId;
  name: string;
  types: [PokemonTypeId] | [PokemonTypeId, PokemonTypeId];
  baseStats: StatBlock;
  legalLevelRange: {
    min: number;
    max: number;
  };
  floorTypes: [PokemonTypeId] | [PokemonTypeId, PokemonTypeId];
  movesetsByFloorLevel: MovesetsByFloorLevel;
  sprite: SpriteSet;
}

export interface TypeTheme {
  palette: string[];
  materialTags: string[];
  propTags: string[];
}

export interface TypeMetadataRecord {
  typeId: PokemonTypeId;
  name: string;
  color: string;
  uiAccent: string;
  floorTheme: TypeTheme;
}

export interface FloorLevelRecord {
  floorNumber: number;
  level: FloorLevel;
}

export interface StarterPoolRecord {
  grass: SpeciesId[];
  fire: SpeciesId[];
  water: SpeciesId[];
}

export interface PlayerHistoryEntry {
  floor: number;
  speciesId: SpeciesId;
  formId: FormId;
  level: FloorLevel;
}

export interface CurrentRunPokemon {
  speciesId: SpeciesId;
  formId: FormId;
  level: FloorLevel;
  moves: MoveSet;
}

export interface RunStateRecord {
  runId: string;
  playerName: string;
  currentFloor: number;
  usedSpecies: SpeciesId[];
  usedBattlePokemon: BattlePokemonId[];
  playerHistory: PlayerHistoryEntry[];
  currentPokemon: CurrentRunPokemon;
  nextDoorTypes: [PokemonTypeId, PokemonTypeId];
  seed: string;
}

export type PokemonDataset = BattleReadyPokemonRecord[];
export type MoveDataset = MoveRecord[];
export type TypeMetadataDataset = TypeMetadataRecord[];
export type FloorLevelDataset = FloorLevelRecord[];
