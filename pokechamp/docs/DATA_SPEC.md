# PokeChamp Data Specification

## Purpose

This document defines the proposed data model for PokeChamp. The goal is to take current official Pokemon data from a source such as PokeAPI, normalize it, and export a compact local dataset that the game can use without runtime API calls.

This is not meant to mirror PokeAPI field-for-field. It is meant to describe the game-owned data we actually need.

Concrete first-pass artifacts now exist here:

- [schemas/runtime/common.schema.json](/Volumes/jon/Jon/projects/my-projects/codes/games/pokechamp/schemas/runtime/common.schema.json)
- [src/types/pokechamp-data.ts](/Volumes/jon/Jon/projects/my-projects/codes/games/pokechamp/src/types/pokechamp-data.ts)

## Data Design Goals

- Keep runtime data small and predictable.
- Separate imported source data from game-derived data.
- Make battle generation deterministic once a run starts.
- Make evolution legality and moveset legality easy to check.
- Keep room for future expansion without blocking version 1.

## Data Layers

Recommended data pipeline layers:

1. Raw import data
   Source snapshots pulled from the external Pokemon dataset.
2. Normalized source data
   Clean project-owned records for species, forms, moves, types, stats, and evolution chains.
3. Game-derived data
   Fields computed specifically for PokeChamp, such as legal battle form windows, curated move pools, and eligibility flags.
4. Runtime data
   Compact JSON files loaded by the game client.

## Recommended Directory Structure

```text
data/
  raw/
  normalized/
  runtime/
scripts/
  import/
  build-data/
src/
  data/
```

Suggested outputs:

- `data/raw/`: unmodified source snapshots
- `data/normalized/`: cleaned intermediate records
- `data/runtime/pokemon.json`: battle-ready Pokemon entries
- `data/runtime/moves.json`: runtime move definitions
- `data/runtime/floors.json`: level curve and type metadata
- `data/runtime/starters.json`: allowed starter pool

Current schema coverage:

- runtime Pokemon dataset
- runtime moves dataset
- runtime type metadata dataset
- starter pool dataset
- floor level dataset
- run state dataset

## Runtime Data Model

The game should not build battle logic from deeply nested source records at runtime. It should load compact records shaped for actual gameplay.

### 1. Pokemon Species Record

One record per base species.

```json
{
  "speciesId": "bulbasaur",
  "dexNumber": 1,
  "name": "Bulbasaur",
  "familyId": "bulbasaur-family",
  "generation": 1,
  "isBaby": false,
  "isLegendary": false,
  "isMythical": false,
  "isUltraBeast": false,
  "isParadox": false,
  "allowedInGame": true,
  "starterEligible": true,
  "forms": ["bulbasaur"],
  "evolutionChainId": "chain-1"
}
```

Required fields:

- `speciesId`: stable internal id
- `dexNumber`: National Dex number
- `name`: display name
- `familyId`: shared id for all members of the line
- `generation`: introduction generation
- inclusion flags
- `allowedInGame`: result after all filters
- `starterEligible`: whether the species can appear in starter selection
- `forms`: valid runtime form ids for this species
- `evolutionChainId`: link to normalized evolution chain data

### 2. Pokemon Form Record

One record per playable form included in the game.

```json
{
  "formId": "raichu-alola",
  "speciesId": "raichu",
  "name": "Raichu",
  "formName": "Alolan",
  "types": ["electric", "psychic"],
  "baseStats": {
    "hp": 60,
    "attack": 85,
    "defense": 50,
    "specialAttack": 95,
    "specialDefense": 85,
    "speed": 110
  },
  "sprite": {
    "front": "sprites/pokemon/raichu-alola.png",
    "back": "sprites/pokemon/back/raichu-alola.png",
    "icon": "sprites/icons/raichu-alola.png"
  },
  "tags": ["regional-form"],
  "allowedInGame": true
}
```

Required fields:

- `formId`
- `speciesId`
- `name`
- `formName`
- `types`
- `baseStats`
- `sprite`
- `tags`
- `allowedInGame`

Notes:

- Version 1 should include default forms and regional forms.
- If a species is blocked for a run, all its forms should be considered blocked.

### 3. Evolution Stage Window Record

This is the most important derived structure for battle legality.

```json
{
  "speciesId": "ivysaur",
  "formId": "ivysaur",
  "familyId": "bulbasaur-family",
  "minLevel": 16,
  "maxLevel": 31,
  "evolvesTo": ["venusaur"],
  "evolutionRule": {
    "kind": "level",
    "level": 32
  }
}
```

Purpose:

- Tell the generator whether this species or form can appear at a given floor level.
- Prevent cases like Bulbasaur appearing at level 40.
- Support the fallback rule for special evolutions.

Required fields:

- `speciesId`
- `formId`
- `familyId`
- `minLevel`
- `maxLevel`
- `evolvesTo`
- `evolutionRule`

### 4. Move Record

One record per move allowed in runtime battle logic.

```json
{
  "moveId": "flamethrower",
  "name": "Flamethrower",
  "type": "fire",
  "category": "special",
  "power": 90,
  "accuracy": 100,
  "pp": 15,
  "priority": 0,
  "target": "opponent",
  "effectTag": "none",
  "allowedInGame": true
}
```

Required fields:

- `moveId`
- `name`
- `type`
- `category`
- `power`
- `accuracy`
- `pp`
- `priority`
- `target`
- `effectTag`
- `allowedInGame`

Notes:

- Field-only moves and other unusable moves can be marked `allowedInGame: false`.
- Status and setup moves should remain available if they make sense in a 1v1 battle context.

### 5. Learnset Record

This is normalized source data describing which moves are legal by level.

```json
{
  "formId": "charmeleon",
  "learnset": [
    {
      "moveId": "ember",
      "learnMethod": "level-up",
      "learnLevel": 1
    },
    {
      "moveId": "flame-burst",
      "learnMethod": "level-up",
      "learnLevel": 24
    }
  ]
}
```

Required fields:

- `formId`
- `learnset`

Each learnset entry should include:

- `moveId`
- `learnMethod`
- `learnLevel`

Version 1 rule:

- Use only level-up moves for move legality and moveset building.
- Ignore TM, tutor, egg, and event move sources unless you deliberately expand scope later.

### 6. Curated Battle Moveset Pool Record

This is a game-derived helper record, not raw source data.

```json
{
  "formId": "wartortle",
  "levelBand": 24,
  "candidateMoves": [
    "water-pulse",
    "bite",
    "rapid-spin",
    "protect",
    "aqua-tail"
  ],
  "recommendedMoves": ["water-pulse", "bite", "protect", "aqua-tail"]
}
```

Purpose:

- Precompute smart battle-ready options.
- Avoid rebuilding move rankings during every encounter generation.

Required fields:

- `formId`
- `levelBand`
- `candidateMoves`
- `recommendedMoves`

Notes:

- `recommendedMoves` should contain up to 4 moves.
- `levelBand` can match exact floor levels or broader ranges if that simplifies generation.

### 7. Battle-Ready Pokemon Record

This is the main runtime entry used by encounter generation.

```json
{
  "battlePokemonId": "floor-legal-ivysaur",
  "speciesId": "ivysaur",
  "formId": "ivysaur",
  "name": "Ivysaur",
  "types": ["grass", "poison"],
  "baseStats": {
    "hp": 60,
    "attack": 62,
    "defense": 63,
    "specialAttack": 80,
    "specialDefense": 80,
    "speed": 60
  },
  "legalLevelRange": {
    "min": 16,
    "max": 31
  },
  "floorTypes": ["grass", "poison"],
  "movesetsByFloorLevel": {
    "19": ["razor-leaf", "poison-powder", "sleep-powder", "take-down"],
    "23": ["razor-leaf", "seed-bomb", "sleep-powder", "take-down"]
  },
  "sprite": {
    "front": "sprites/pokemon/ivysaur.png",
    "back": "sprites/pokemon/back/ivysaur.png"
  }
}
```

Required fields:

- `battlePokemonId`
- `speciesId`
- `formId`
- `name`
- `types`
- `baseStats`
- `legalLevelRange`
- `floorTypes`
- `movesetsByFloorLevel`
- `sprite`

Notes:

- This record is optimized for the actual game loop.
- The generator should not need to inspect full evolution chains once this file exists.

### 8. Type Metadata Record

```json
{
  "typeId": "electric",
  "name": "Electric",
  "color": "#F8D030",
  "uiAccent": "#FFE56A",
  "floorTheme": {
    "palette": ["#1E2430", "#F8D030", "#FFF2A8"],
    "materialTags": ["metal", "cable", "neon"],
    "propTags": ["generator", "warning-sign", "coil"]
  }
}
```

Purpose:

- Support floor theming rules consistently.
- Give both encounter generation and scene art direction a single type metadata source.

### 9. Floor Definition Record

```json
{
  "floorNumber": 7,
  "level": 30,
  "trainerTypeOptions": ["ground", "steel"],
  "chosenType": "ground",
  "themeType": "ground"
}
```

Notes:

- `trainerTypeOptions` exists only once the run has revealed the next doors.
- `chosenType` becomes fixed when the player picks one door.
- `themeType` should match the chosen floor type.

### 10. Starter Pool Record

```json
{
  "grass": ["bulbasaur", "chikorita", "treecko"],
  "fire": ["charmander", "cyndaquil", "torchic"],
  "water": ["squirtle", "totodile", "mudkip"]
}
```

Version 1 recommendation:

- Keep the pool split by Grass, Fire, and Water.
- All starters must be first-stage forms only.
- Exclude regional variants from the starter pool unless explicitly desired later.

### 11. Run State Record

This is the minimum save shape needed for a run in progress.

```json
{
  "runId": "run-20260317-001",
  "playerName": "Ray",
  "currentFloor": 5,
  "usedSpecies": ["bulbasaur", "pidgeotto", "magnemite", "croconaw"],
  "usedBattlePokemon": ["bulbasaur", "pidgeotto", "magnemite", "croconaw"],
  "playerHistory": [
    {
      "floor": 1,
      "speciesId": "bulbasaur",
      "formId": "bulbasaur",
      "level": 8
    }
  ],
  "currentPokemon": {
    "speciesId": "croconaw",
    "formId": "croconaw",
    "level": 23,
    "moves": ["water-gun", "bite", "scary-face", "ice-fang"]
  },
  "nextDoorTypes": ["rock", "flying"],
  "seed": "tower-seed-123"
}
```

Purpose:

- Resume a run
- Reconstruct prior choices
- Enforce no-duplicate species rules
- Replay the winning team in the outro

## Import Rules

The import step should:

- fetch source species, forms, moves, learnsets, evolution chains, and sprites
- map source fields to internal ids
- filter excluded roster categories
- build evolution legality windows
- build curated legal move pools by floor level
- export compact runtime JSON

## Filtering Rules

Version 1 roster filtering should remove:

- Legendary species
- Mythical species
- Ultra Beasts
- Paradox Pokemon
- Mega forms
- Gigantamax forms
- Dynamax-only states
- Temporary battle-only transformation states

Version 1 form filtering should keep:

- Default forms
- Regional forms

## Evolution Conversion Rules

The data pipeline should convert source evolution methods into PokeChamp legality windows.

Rules:

- Official level-up evolutions keep their official minimum levels.
- First non-level evolution in a family defaults to level 18.
- Second or final non-level evolution defaults to level 36.
- If multiple source methods exist, the pipeline should choose the earliest valid tower rule.
- Every included battle form must end with one clear legal min and max level range.

## Moveset Curation Rules

The data pipeline should produce a recommended moveset for each legal floor level.

Ranking priorities:

1. Same-type attack bonus moves with solid power and accuracy
2. High-value coverage attacks
3. One tactical move if it has clear value in a stripped-down 1v1 ruleset
4. Avoid redundant weaker moves when a better legal move exists already

Suggested output:

- Keep a broader `candidateMoves` list for debugging and tuning
- Export only the chosen `recommendedMoves` to the game runtime if you want a smaller final payload

## Validation Checklist

Before runtime data is accepted, validate:

- excluded Pokemon are not present
- excluded forms are not present
- every battle-ready Pokemon has at least 1 legal floor
- every battle-ready Pokemon has at least 1 usable move at every legal floor level
- no legal level range overlaps incorrectly within the same family
- floor type eligibility matches the Pokemon's actual types
- every sprite path resolves correctly

## Version 1 Non-Goals

Do not store or simulate these in the first runtime model unless they become necessary:

- abilities
- held items
- EVs
- IVs
- natures
- weather
- terrain
- breeding data
- contest-only or field-only mechanics

## Open Questions

These can stay unresolved briefly, but they should be decided before building the importer:

- Whether to keep alternate non-regional forms out of version 1 entirely
- Whether to include status conditions at launch
- Whether move PP matters in a one-battle-per-Pokemon structure
- Whether critical hits should be in the first playable slice
