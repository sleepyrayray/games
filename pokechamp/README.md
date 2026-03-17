# PokeChamp

PokeChamp is a small single-player Pokemon tower challenge game. The player creates a character, receives a starter Pokemon from the PokeChamp host, and then climbs an 18-floor building by defeating one trainer per floor in a 1v1 battle.

The hook is simple: every Pokemon can only be used once. After each win, the player chooses one of three reward Pokemon and then picks between two revealed type doors for the next floor. If the player loses a single battle, the run restarts from floor 1.

## Core Fantasy

- Climb the PokeChamp tower from floor 1 to floor 18.
- Beat one trainer for each of the 18 Pokemon types.
- Draft a new Pokemon after every victory.
- Adapt to future type matchups without repeating Pokemon.
- Finish the run and become the new PokeChamp.

## Why This Game Works

- It has a clean run structure: intro, 18-floor challenge, outro.
- It keeps battles readable because every fight is 1 Pokemon vs 1 Pokemon.
- It creates meaningful choices because every Pokemon is single-use.
- It adds strategy without heavy complexity by revealing two possible next floor types.
- It naturally supports replayability through randomized trainers, rewards, and type paths.

## Scope Direction

This project aims to feel like Pokemon without rebuilding every mainline mechanic.

Included:

- Accurate Pokemon species data
- Current typings, base stats, level-up learnsets, and evolution families
- Starter selection
- Arrow-key movement outside battle
- Mouse-driven move selection in battle
- Turn-based 1v1 battles
- Floor visuals themed around each floor's Pokemon type
- Floor progression from level 8 to level 70
- Reward drafting after each win
- No duplicate Pokemon during a single run

Explicitly excluded for the first version:

- Abilities
- Held items
- EVs and IVs
- Natures
- Breeding
- Weather and terrain
- Double battles
- Mega Evolution, Dynamax, Gigantamax, Terastallization, and similar battle power-up systems
- Legendary Pokemon, Mythical Pokemon, Ultra Beasts, and Paradox Pokemon

## Pokemon Data Strategy

The project should use one modern source of truth and then normalize it into a local game dataset.

Recommended source:

- [PokeAPI Docs](https://pokeapi.co/docs/v2) for species, forms, typings, stats, learnsets, moves, and evolution chains
- [PokeAPI Sprites](https://github.com/PokeAPI/sprites) for battle sprites and related sprite assets

Recommended approach:

1. Fetch current Pokemon data from the chosen API/source.
2. Convert it into a local normalized dataset used by the game at runtime.
3. Filter out excluded categories such as legendaries, mythicals, Ultra Beasts, Paradox Pokemon, and temporary battle-only forms.
4. Build game-specific derived fields such as legal battle form at a given level, curated 4-move battle movesets, and tower evolution fallback levels.
5. Pin the imported dataset to a project snapshot so runs stay consistent even if the external source changes later.

## Roster Rules

- Include regular species, baby Pokemon, cross-generation evolutions, and regional forms.
- Regional forms should be treated as valid roster entries when they have distinct official data.
- Temporary battle gimmick forms should be excluded.
- A Pokemon is eligible for a floor if at least one of its types matches that trainer's floor type.
- If a species appears anywhere in a run, all forms of that species should be removed from the remaining pool for that run.

## Battle Design Rules

- Every floor is one trainer battle.
- Every battle is exactly 1 Pokemon vs 1 Pokemon.
- The player's current Pokemon may only be used on that one floor.
- Winning grants a choice of 3 reward Pokemon.
- After choosing the reward Pokemon, the game reveals 2 possible types for the next floor.
- The player chooses which type door to enter next.
- Pokemon levels ramp from floor 1 level 8 to floor 18 level 70.
- Moves available to each Pokemon must be valid for that Pokemon at its battle level.

## World Presentation Rules

- Every floor should visually reflect its assigned Pokemon type.
- Type theming should come through in the palette, floor materials, props, lighting, signage, and trainer presentation.
- The player should be able to understand a floor's type identity at a glance, even before the battle starts.

## Recommended Tech Direction

Best fit for a first build:

- TypeScript
- Phaser 3
- Vite
- Local JSON data pipeline generated from the chosen Pokemon dataset

Why:

- Phaser is a good match for 2D movement, sprite animation, scene transitions, and a small custom battle UI.
- TypeScript will help a lot once the Pokemon dataset and rules become large.
- A browser game is quick to iterate on and easy to test.

## Art And Asset Note

Pokemon names, creatures, and many sprite resources are copyrighted. This project should be treated as a fan game prototype unless asset usage and distribution rights are reviewed carefully.

## Project Status

No gameplay code has been started yet. The current focus is pre-production:

- lock the rules
- define the data pipeline
- choose the exact battle simplifications
- decide the first playable milestone

See [docs/GAME_VISION.md](/Volumes/jon/Jon/projects/my-projects/codes/games/pokechamp/docs/GAME_VISION.md) for the detailed game vision and implementation plan.
See [docs/DATA_SPEC.md](/Volumes/jon/Jon/projects/my-projects/codes/games/pokechamp/docs/DATA_SPEC.md) for the proposed data model and runtime dataset structure.
See [docs/IMPLEMENTATION_ROADMAP.md](/Volumes/jon/Jon/projects/my-projects/codes/games/pokechamp/docs/IMPLEMENTATION_ROADMAP.md) for the recommended build order and milestones.
See [schemas/runtime/common.schema.json](/Volumes/jon/Jon/projects/my-projects/codes/games/pokechamp/schemas/runtime/common.schema.json) and the runtime schema files in [schemas/runtime](/Volumes/jon/Jon/projects/my-projects/codes/games/pokechamp/schemas/runtime) for the first JSON validation pass.
See [src/types/pokechamp-data.ts](/Volumes/jon/Jon/projects/my-projects/codes/games/pokechamp/src/types/pokechamp-data.ts) for the matching TypeScript data model.
