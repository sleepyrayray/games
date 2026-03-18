import { fileURLToPath } from "node:url";
import { join } from "node:path";

import {
  FLOOR_LEVELS,
  POKEMON_TYPES,
  type TypeMetadataRecord,
} from "../../src/types/pokechamp-data.ts";

export const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const DATA_ROOT = join(PROJECT_ROOT, "data");
export const RAW_POKEAPI_DIR = join(DATA_ROOT, "raw", "pokeapi");
export const NORMALIZED_DATA_DIR = join(DATA_ROOT, "normalized");
export const RUNTIME_DATA_DIR = join(DATA_ROOT, "runtime");

export const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";
export const FETCH_CONCURRENCY = 8;

export const PREFERRED_LEARNSET_VERSION_GROUPS = [
  "scarlet-violet",
  "legends-arceus",
  "brilliant-diamond-and-shining-pearl",
  "sword-shield",
  "lets-go-pikachu-lets-go-eevee",
  "ultra-sun-ultra-moon",
  "sun-moon",
  "omega-ruby-alpha-sapphire",
  "x-y",
  "black-2-white-2",
  "black-white",
  "heartgold-soulsilver",
  "platinum",
  "diamond-pearl",
  "emerald",
  "firered-leafgreen",
  "ruby-sapphire",
  "crystal",
  "gold-silver",
  "yellow",
  "red-blue",
] as const;

export const REGIONAL_FORM_TOKENS = [
  "alola",
  "galar",
  "hisui",
  "paldea",
] as const;

export const ULTRA_BEAST_SPECIES = new Set([
  "nihilego",
  "buzzwole",
  "pheromosa",
  "xurkitree",
  "celesteela",
  "kartana",
  "guzzlord",
  "poipole",
  "naganadel",
  "stakataka",
  "blacephalon",
]);

export const PARADOX_SPECIES = new Set([
  "great-tusk",
  "scream-tail",
  "brute-bonnet",
  "flutter-mane",
  "slither-wing",
  "sandy-shocks",
  "roaring-moon",
  "iron-treads",
  "iron-bundle",
  "iron-hands",
  "iron-jugulis",
  "iron-moth",
  "iron-thorns",
  "iron-valiant",
  "walking-wake",
  "iron-leaves",
  "gouging-fire",
  "raging-bolt",
  "iron-boulder",
  "iron-crown",
]);

export const STARTER_SPECIES = {
  grass: [
    "bulbasaur",
    "chikorita",
    "treecko",
    "turtwig",
    "snivy",
    "chespin",
    "rowlet",
    "grookey",
    "sprigatito",
  ],
  fire: [
    "charmander",
    "cyndaquil",
    "torchic",
    "chimchar",
    "tepig",
    "fennekin",
    "litten",
    "scorbunny",
    "fuecoco",
  ],
  water: [
    "squirtle",
    "totodile",
    "mudkip",
    "piplup",
    "oshawott",
    "froakie",
    "popplio",
    "sobble",
    "quaxly",
  ],
} as const;

export const HIGH_VALUE_STATUS_MOVES = new Set([
  "agility",
  "amnesia",
  "bulk-up",
  "calm-mind",
  "coil",
  "curse",
  "dragon-dance",
  "hone-claws",
  "howl",
  "iron-defense",
  "leech-seed",
  "nasty-plot",
  "protect",
  "quiver-dance",
  "recover",
  "roost",
  "shell-smash",
  "sleep-powder",
  "slack-off",
  "soft-boiled",
  "spore",
  "stun-spore",
  "swords-dance",
  "thunder-wave",
  "toxic",
  "will-o-wisp",
  "work-up",
]);

export const CURATED_STATUS_MOVE_IDS = new Set([
  ...HIGH_VALUE_STATUS_MOVES,
  "charm",
  "fake-tears",
  "feather-dance",
  "glare",
  "hypnosis",
  "meditate",
  "metal-sound",
  "moonlight",
  "poison-powder",
  "rest",
  "screech",
  "sing",
  "synthesis",
  "yawn",
]);

export const BLOCKED_RECOMMENDED_MOVE_IDS = new Set([
  "assist",
  "celebrate",
  "copycat",
  "doom-desire",
  "double-team",
  "follow-me",
  "future-sight",
  "hold-hands",
  "mat-block",
  "me-first",
  "metronome",
  "mimic",
  "minimize",
  "mirror-move",
  "rage-powder",
  "sleep-talk",
  "splash",
  "spotlight",
  "teleport",
  "wide-guard",
]);

export const BLOCKED_RUNTIME_MOVE_IDS = new Set([
  "beat-up",
  "curse",
  "heal-pulse",
  "purify",
  "sketch",
  "splash",
  "teleport",
  "throat-chop",
  "transform",
]);

export const TYPE_METADATA: TypeMetadataRecord[] = [
  {
    typeId: "normal",
    name: "Normal",
    color: "#A8A77A",
    uiAccent: "#C8C898",
    floorTheme: {
      palette: ["#F4F1E8", "#C8C3B0", "#8D8874"],
      materialTags: ["tile", "plaster", "wood"],
      propTags: ["bench", "planter", "lamp"],
    },
  },
  {
    typeId: "fire",
    name: "Fire",
    color: "#EE8130",
    uiAccent: "#FFB067",
    floorTheme: {
      palette: ["#301814", "#A43D1C", "#F29C52"],
      materialTags: ["basalt", "metal", "ember"],
      propTags: ["torch", "furnace", "warning-sign"],
    },
  },
  {
    typeId: "water",
    name: "Water",
    color: "#6390F0",
    uiAccent: "#90B6FF",
    floorTheme: {
      palette: ["#10253C", "#2E67A6", "#8AD6E8"],
      materialTags: ["glass", "tile", "water"],
      propTags: ["tank", "pipe", "mist-vent"],
    },
  },
  {
    typeId: "electric",
    name: "Electric",
    color: "#F7D02C",
    uiAccent: "#FFE97A",
    floorTheme: {
      palette: ["#1D2230", "#D4A917", "#FFF0A2"],
      materialTags: ["metal", "cable", "neon"],
      propTags: ["generator", "coil", "warning-sign"],
    },
  },
  {
    typeId: "grass",
    name: "Grass",
    color: "#7AC74C",
    uiAccent: "#A9E07D",
    floorTheme: {
      palette: ["#162514", "#4A7A2C", "#B7E282"],
      materialTags: ["moss", "wood", "soil"],
      propTags: ["fern", "trellis", "stone-planter"],
    },
  },
  {
    typeId: "ice",
    name: "Ice",
    color: "#96D9D6",
    uiAccent: "#C8F4F1",
    floorTheme: {
      palette: ["#17313A", "#7EB8C9", "#D9FBFF"],
      materialTags: ["ice", "glass", "steel"],
      propTags: ["crystal", "snow-drift", "cold-lamp"],
    },
  },
  {
    typeId: "fighting",
    name: "Fighting",
    color: "#C22E28",
    uiAccent: "#E56660",
    floorTheme: {
      palette: ["#2D1616", "#8B2C2A", "#D8A06C"],
      materialTags: ["mat", "rope", "stone"],
      propTags: ["banner", "training-bag", "gong"],
    },
  },
  {
    typeId: "poison",
    name: "Poison",
    color: "#A33EA1",
    uiAccent: "#CF6CCC",
    floorTheme: {
      palette: ["#25142A", "#713277", "#D18FDF"],
      materialTags: ["glass", "sludge", "metal"],
      propTags: ["vat", "flask", "warning-light"],
    },
  },
  {
    typeId: "ground",
    name: "Ground",
    color: "#E2BF65",
    uiAccent: "#F4D892",
    floorTheme: {
      palette: ["#2C2116", "#9C6E34", "#E8C983"],
      materialTags: ["clay", "sand", "stone"],
      propTags: ["pillar", "dig-site", "crate"],
    },
  },
  {
    typeId: "flying",
    name: "Flying",
    color: "#A98FF3",
    uiAccent: "#D3C4FF",
    floorTheme: {
      palette: ["#1B2137", "#6E72C8", "#DFE6FF"],
      materialTags: ["cloud", "glass", "marble"],
      propTags: ["wind-vane", "banner", "sky-bridge"],
    },
  },
  {
    typeId: "psychic",
    name: "Psychic",
    color: "#F95587",
    uiAccent: "#FF9CBC",
    floorTheme: {
      palette: ["#2D1631", "#B04274", "#FFC5D7"],
      materialTags: ["glass", "velvet", "mirror"],
      propTags: ["orb", "screen", "sigil"],
    },
  },
  {
    typeId: "bug",
    name: "Bug",
    color: "#A6B91A",
    uiAccent: "#CFDD6A",
    floorTheme: {
      palette: ["#1E2410", "#667B1C", "#D2E38D"],
      materialTags: ["bark", "leaf", "resin"],
      propTags: ["lantern", "cocoon", "branch"],
    },
  },
  {
    typeId: "rock",
    name: "Rock",
    color: "#B6A136",
    uiAccent: "#D7C266",
    floorTheme: {
      palette: ["#221D16", "#7B6640", "#CDB585"],
      materialTags: ["slate", "ore", "stone"],
      propTags: ["monolith", "cart", "crystal-cluster"],
    },
  },
  {
    typeId: "ghost",
    name: "Ghost",
    color: "#735797",
    uiAccent: "#A08BC6",
    floorTheme: {
      palette: ["#141224", "#4C3A68", "#C4B8E8"],
      materialTags: ["veil", "stone", "candle"],
      propTags: ["lantern", "portrait", "archway"],
    },
  },
  {
    typeId: "dragon",
    name: "Dragon",
    color: "#6F35FC",
    uiAccent: "#A882FF",
    floorTheme: {
      palette: ["#171326", "#4B2AB1", "#D2C2FF"],
      materialTags: ["obsidian", "gold", "scale"],
      propTags: ["totem", "brazer", "crest"],
    },
  },
  {
    typeId: "dark",
    name: "Dark",
    color: "#705746",
    uiAccent: "#A08975",
    floorTheme: {
      palette: ["#151311", "#46392F", "#B7A791"],
      materialTags: ["leather", "iron", "smoke"],
      propTags: ["spotlight", "crate", "shutter"],
    },
  },
  {
    typeId: "steel",
    name: "Steel",
    color: "#B7B7CE",
    uiAccent: "#D8D8EA",
    floorTheme: {
      palette: ["#1D2129", "#6D7487", "#E3E6F2"],
      materialTags: ["steel", "glass", "mesh"],
      propTags: ["console", "catwalk", "robot-arm"],
    },
  },
  {
    typeId: "fairy",
    name: "Fairy",
    color: "#D685AD",
    uiAccent: "#F2B7D1",
    floorTheme: {
      palette: ["#2B1727", "#A95D87", "#F7D3E6"],
      materialTags: ["silk", "glass", "flower"],
      propTags: ["lantern", "ribbon", "fountain"],
    },
  },
];

export const FLOOR_LEVEL_DATASET = FLOOR_LEVELS.map((level, index) => ({
  floorNumber: index + 1,
  level,
}));

export const TYPE_ID_SET = new Set(POKEMON_TYPES);
