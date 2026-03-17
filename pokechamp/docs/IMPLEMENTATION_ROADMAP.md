# PokeChamp Implementation Roadmap

## Purpose

This roadmap breaks PokeChamp into practical build phases. The goal is to reduce risk by solving the hardest systems first: data normalization, encounter legality, and one complete playable loop.

## Build Philosophy

- Build the data pipeline before the full game.
- Prove the rules with one playable vertical slice.
- Keep the first battle system deliberately smaller than mainline Pokemon.
- Expand breadth only after the core loop feels good.

## Success Criteria

Version 1 is successful if the player can:

- create a character
- pick a starter
- enter themed floors
- fight one trainer per floor in 1v1 battles
- choose one of three reward Pokemon after each win
- choose between two next-floor type doors
- complete or fail an 18-floor run with no duplicate species

## Phase 0: Pre-Production Lock

Goal:

- Finish the design rules before implementation starts.

Deliverables:

- [GAME_VISION.md](/Volumes/jon/Jon/projects/my-projects/codes/games/pokechamp/docs/GAME_VISION.md)
- [DATA_SPEC.md](/Volumes/jon/Jon/projects/my-projects/codes/games/pokechamp/docs/DATA_SPEC.md)
- [schemas/runtime/common.schema.json](/Volumes/jon/Jon/projects/my-projects/codes/games/pokechamp/schemas/runtime/common.schema.json)
- [src/types/pokechamp-data.ts](/Volumes/jon/Jon/projects/my-projects/codes/games/pokechamp/src/types/pokechamp-data.ts)
- Final call on:
  - evolution fallback levels
  - starter pool policy
  - regional form policy
  - move curation policy
  - duplicate-removal rule

Exit criteria:

- No major rule contradictions remain in the docs.
- The runtime data fields are clear enough to implement without guessing.

## Phase 1: Project Setup

Goal:

- Create the codebase foundation.

Recommended stack:

- TypeScript
- Vite
- Phaser 3

Tasks:

1. Initialize the project.
2. Add a folder structure for `src`, `data`, `scripts`, and `public`.
3. Add linting and formatting.
4. Add a simple scene boot flow.
5. Add a shared config file for constants such as floor levels and type ids.

Exit criteria:

- The project runs locally.
- A blank Phaser scene renders successfully.

## Phase 2: Data Import Pipeline

Goal:

- Build the Pokemon dataset that the game will use.

Tasks:

1. Write import scripts for source Pokemon data.
2. Normalize species, forms, types, moves, learnsets, and evolution chains.
3. Add roster filtering for excluded categories.
4. Add form filtering for allowed forms.
5. Derive legal evolution windows.
6. Derive curated movesets by floor level.
7. Export compact runtime JSON files.

Recommended outputs:

- `data/runtime/pokemon.json`
- `data/runtime/moves.json`
- `data/runtime/types.json`
- `data/runtime/starters.json`
- `data/runtime/floor-levels.json`

Exit criteria:

- Runtime data builds successfully from scripts.
- Random spot checks confirm correct species inclusion, level legality, and moveset legality.

## Phase 3: Rules Sandbox

Goal:

- Verify the rules in code before building full presentation.

Tasks:

1. Implement a pure data-driven encounter generator.
2. Implement no-duplicate species tracking.
3. Implement floor type selection and legality filtering.
4. Implement reward generation with 3 valid choices.
5. Simulate multiple runs from a script or test harness.

Why this matters:

- This phase catches balancing and data bugs early.
- It lets you debug encounter quality without fighting UI at the same time.

Exit criteria:

- Simulated runs produce legal encounters and rewards.
- No duplicate species appear in a full run simulation.
- Every generated Pokemon has a legal level form and usable moves.

## Phase 4: Vertical Slice

Goal:

- Build one complete playable loop with minimal polish.

Scope:

- intro
- character naming or simple character selection
- starter selection
- one themed floor
- one trainer interaction
- one full battle
- one reward selection
- reveal next two type doors

Tasks:

1. Build boot, intro, and starter scenes.
2. Build a simple overworld movement scene.
3. Build one type-themed floor scene.
4. Build trainer interaction and battle transition.
5. Build battle UI with HP bars and move buttons.
6. Resolve turn order, damage, victory, and defeat.
7. Build reward-choice UI.
8. Build next-door reveal UI.

Exit criteria:

- A player can complete one floor from start to finish with no manual setup.

## Phase 5: Full Battle System Pass

Goal:

- Make the battle system stable enough for all 18 floors.

Tasks:

1. Finalize stat calculations for the simplified ruleset.
2. Finalize move execution and targeting.
3. Add type effectiveness handling.
4. Decide whether to keep critical hits and status effects in version 1.
5. Add battle logs, animations, and failure handling.

Recommended version 1 minimum:

- direct damage moves
- stat boosts and drops that matter immediately
- simple protection moves if supported

Exit criteria:

- The battle system can handle a representative set of moves without breaking the run loop.

## Phase 6: Full Tower Flow

Goal:

- Expand the vertical slice into the complete 18-floor game.

Tasks:

1. Implement floor progression from 1 through 18.
2. Implement random next-door type selection.
3. Generate one legal trainer Pokemon per floor.
4. Generate three legal reward Pokemon after each win.
5. Track player history for the winning team showcase.
6. Add run restart on defeat.

Exit criteria:

- A full run can start at floor 1 and end at floor 18.

## Phase 7: Floor Art Direction Pass

Goal:

- Make the type identity of each floor obvious and memorable.

Tasks:

1. Define a type theme sheet for all 18 types.
2. Assign palette, texture, lighting, and prop tags per type.
3. Build reusable floor decoration kits.
4. Add trainer styling cues by type.
5. Ensure each floor reads clearly even with simple geometry.

Deliverable:

- A lightweight style guide for all 18 floor types.

Exit criteria:

- Players can immediately recognize a floor's type from the environment.

## Phase 8: Outro And Run Summary

Goal:

- Finish the run with a satisfying ending.

Tasks:

1. Show the player becoming PokeChamp.
2. Display all 18 Pokemon used in the winning run.
3. Add replay option.
4. Save or display run seed if useful for debugging or sharing.

Exit criteria:

- The game has a clean beginning, middle, and end.

## Phase 9: Balancing And Polish

Goal:

- Improve replay quality and reduce frustrating outcomes.

Tasks:

1. Tune reward generation quality.
2. Tune move curation heuristics.
3. Tune floor difficulty spikes.
4. Improve scene transitions and animations.
5. Tighten UI clarity and readability.

Watchouts:

- reward choices that are all bad
- early floors that are too swingy
- legal but boring movesets
- overuse of certain common species

## Testing Strategy

Use three layers of testing:

1. Data validation tests
   Validate imports, legal ranges, movesets, and filters.
2. Simulation tests
   Run many generated tower runs without UI.
3. Playtests
   Verify whether decisions feel fair and readable.

Recommended first automated checks:

- no excluded species in runtime data
- no duplicate species in simulated runs
- every legal encounter has at least one damaging move unless intentionally tactical
- all 18 floors can be generated consistently

## Suggested Order Of Work Right Now

If implementation starts next, this is the best immediate order:

1. Set up the TypeScript + Phaser project.
2. Build the data importer and runtime JSON export.
3. Build a rules sandbox that simulates runs.
4. Build the one-floor vertical slice.
5. Expand to full tower flow.

## Definition Of Done For First Playable

The first truly useful milestone is not "the project compiles." It is this:

- A player can launch the game, choose a starter, enter a clearly themed floor, fight one trainer in a legal 1v1 battle, win or lose, and if they win, choose one of three legal reward Pokemon and see the next two type doors.

Once that works, the rest of the game becomes an expansion problem instead of a design problem.
