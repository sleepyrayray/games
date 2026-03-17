# PokeChamp Game Vision

## One-Sentence Pitch

PokeChamp is a replayable 18-floor Pokemon tower run where the player must win a chain of 1v1 battles, drafting one new Pokemon after each victory and never reusing a Pokemon within the same run.

## Design Goals

- Keep the game simple enough to ship.
- Preserve the feel of Pokemon through authentic species data.
- Make every floor choice matter.
- Reward adaptation instead of grinding.
- Keep runs short, tense, and replayable.

## Player Fantasy

The player arrives at the PokeChamp building hoping to become the next champion. The host welcomes them, introduces the challenge, offers a starter Pokemon, and sends them into the tower. Every floor is a trial. Every win gives a new ally. Every loss sends the player back to the lobby.

## Run Structure

### 1. Intro

- Short opening story
- Character creation
- PokeChamp host introduction
- Starter selection
- Player begins outside or inside the building entrance

### 2. Floor Loop

Each floor follows this loop:

1. Enter floor.
2. Move the character to the trainer.
3. Click the trainer to begin battle.
4. Play a short battle intro animation.
5. Resolve a 1v1 turn-based fight.
6. If the player loses, the run ends and restarts from floor 1.
7. If the player wins, show 3 reward Pokemon.
8. Player chooses 1 reward Pokemon.
9. Reveal 2 type doors for the next floor.
10. Player chooses the next challenge type.
11. Continue upward.

### 3. Ending

- Player defeats floor 18
- Host acknowledges the new PokeChamp
- Outro shows the full chain of 18 Pokemon used in the winning run
- End screen offers play again

## Core Rules

- The challenge lasts exactly 18 floors.
- Each floor represents one of the 18 Pokemon types.
- Each floor has exactly one trainer.
- Each battle is exactly 1 Pokemon vs 1 Pokemon.
- The player can only use one Pokemon on one floor, then that Pokemon is retired for the rest of the run.
- The next floor's Pokemon comes from the post-battle reward choice.
- No Pokemon duplication is allowed anywhere in a single run.
- A failed battle means full run failure.

## Starter Rule

The player should receive a standard starter choice:

- 1 Grass starter
- 1 Fire starter
- 1 Water starter

Recommended version for replayability:

- Randomly choose the three starters from the official starter families, while preserving the Grass / Fire / Water trio structure.
- All starter offers should be first-stage forms only.
- Starter battle level is floor 1 level, which is level 8.

## Floor Type Rule

- Each trainer is assigned one primary floor type.
- A Pokemon is valid for that floor if it has the assigned type in any slot.
- Dual-type Pokemon are fully valid.
- Example: Bulbasaur can appear on either a Grass floor or a Poison floor.
- Each floor's environment design should also reflect its assigned type.

## Level Curve

The level curve should ramp evenly from level 8 to level 70 across 18 floors.

Recommended floor levels:

| Floor | Level |
| ----- | ----- |
| 1     | 8     |
| 2     | 12    |
| 3     | 15    |
| 4     | 19    |
| 5     | 23    |
| 6     | 26    |
| 7     | 30    |
| 8     | 34    |
| 9     | 37    |
| 10    | 41    |
| 11    | 44    |
| 12    | 48    |
| 13    | 52    |
| 14    | 55    |
| 15    | 59    |
| 16    | 63    |
| 17    | 66    |
| 18    | 70    |

This keeps the progression close to linear while still producing clean whole-number battle levels.

## Pokemon Inclusion Policy

Include:

- Standard Pokemon species
- Baby Pokemon
- Cross-generation evolutions and pre-evolutions
- Regional forms

Exclude:

- Legendary Pokemon
- Mythical Pokemon
- Ultra Beasts
- Paradox Pokemon
- Mega forms
- Gigantamax forms
- Dynamax-only states
- Terastallization and other temporary battle-only transformations

Implementation note:

- Legendary and Mythical filtering can come from source data flags.
- Ultra Beast and Paradox filtering will likely need a small curated denylist in the import pipeline.

Open design choice for later:

- Whether to include all non-regional alternate forms in version 1, or to start with default forms plus regional forms only

Recommended version 1 rule:

- Include default forms and regional forms.
- Leave other alternate forms for a later milestone unless they are easy to normalize cleanly.

## No-Duplicate Rule

The game should enforce run-wide uniqueness.

Recommended rule:

- Once a Pokemon is used by either the player or an enemy trainer, it is removed from all remaining pools for that run.
- To avoid near-duplicates, if one form of a species is used, all other forms of that same species should also be removed for that run.

This keeps each run feeling like a true draft sequence instead of a repeat parade.

## Evolution Rule

The battle form shown at a given level should always make sense. A lower-stage Pokemon should not appear above the point where it would reasonably have evolved, and a higher-stage Pokemon should not appear below the point where it should exist.

### Canonical Level Evolutions

- If a Pokemon evolves by level-up in the main games, keep the official level requirement.
- Example:
  - Bulbasaur is valid below level 16
  - Ivysaur is valid from level 16 to 31
  - Venusaur is valid from level 32 upward

### Fallback Rule For Special Evolutions

Some Pokemon evolve by trade, stones, friendship, time of day, specific moves, locations, held items, or other special conditions. PokeChamp should convert those into simple tower-friendly level thresholds.

Recommended universal fallback:

- First evolution by any non-level method becomes available at level 18.
- Second or final evolution by any non-level method becomes available at level 36.
- If a species already has an official level-up evolution, the official level always wins.

Examples under this rule:

- Pichu -> Pikachu at level 18
- Pikachu -> Raichu at level 36
- Eevee special evolutions become available at the assigned fallback threshold for their stage
- Trade evolutions such as Kadabra -> Alakazam become level 36 evolutions
- Special later evolutions such as Primeape -> Annihilape can use the second-stage fallback if no clean level rule exists in the source data

This rule is not perfectly canon, but it is easy to explain, easy to implement, and consistent across the full roster.

## Moveset Rule

The game should use official move data, but not blindly dump weak or redundant moves into battle.

Recommended moveset policy:

- Every battle-ready Pokemon gets up to 4 moves.
- Moves must be legal for that Pokemon at its battle level in the chosen source data.
- Prioritize strong same-type attacks first.
- Then add useful coverage attacks.
- Then optionally add one setup or tactical non-damaging move if it has real battle value.
- Avoid clearly obsolete filler when a stronger same-role move is already legal at that level.
- Avoid field-only or gimmick-only moves that add no value in a stripped-down 1v1 battle system.

Examples of acceptable tactical moves:

- Swords Dance
- Dragon Dance
- Nasty Plot
- Agility
- Calm Mind
- Protect

Examples of mechanics to avoid in version 1:

- Complex move interactions that rely on larger systems not implemented yet
- Passive battle systems that assume abilities, weather, terrain, held items, or doubles

## Battle System Scope

Keep the first battle system intentionally trimmed.

Include:

- HP
- Attack, Defense, Special Attack, Special Defense, Speed
- Type effectiveness
- Accuracy
- Critical hits if desired
- Turn order based on Speed
- Basic status effects only if they are worth the complexity

Do not include in version 1:

- Abilities
- Held items
- EVs
- IVs
- Natures
- Weather
- Terrain
- Entry hazards unless deliberately added later

## Trainer Generation Rule

Each floor trainer should be generated from the remaining valid roster pool.

Trainer generation inputs:

- Remaining unused Pokemon
- Assigned floor type
- Floor level
- Evolution legality at that level
- Curated battle-ready move list at that level

Trainer result:

- One Pokemon matching the floor type
- One legal battle form for the floor level
- One generated moveset based on the move-selection rules

## Reward Generation Rule

After each win, the player is offered 3 reward Pokemon.

Recommended reward constraints:

- All 3 must come from the remaining unused roster
- All 3 must be legal at the next floor level band
- Try to vary types so the choice feels meaningful
- Avoid offering only obvious dead picks against both visible next doors when possible

The player chooses first, then the next two type doors are shown.

## Data Pipeline Plan

Version 1 should not call an external Pokemon API during normal gameplay. Instead, build a local data snapshot.

Recommended pipeline:

1. Pull current species, forms, stats, types, evolution chains, and learnsets from the chosen source.
2. Normalize that data into project-owned JSON files.
3. Apply the project's inclusion and exclusion rules.
4. Derive evolution legality windows.
5. Derive curated battle-ready move pools by level.
6. Export a final compact runtime dataset for the game client.

Benefits:

- Faster game load
- No runtime API dependency
- Easier debugging
- Stable balancing
- Easier future patches

## Presentation Notes

Overworld:

- Top-down movement with arrow keys
- Player starts outside or in front of the building
- Each floor can be visually simple
- Every floor should have strong type-themed art direction

Floor theming rules:

- A floor's palette, textures, props, and architectural details should communicate its type immediately.
- Trainer styling should support the same type identity.
- The theming should be readable and bold, not subtle enough to be mistaken for a neutral hallway.
- Floors do not need unique large maps, but they should feel distinct from one another.

Examples:

- Fire floor: warm lighting, ember tones, metal or volcanic accents
- Water floor: cool palette, reflective surfaces, aquatic shapes
- Electric floor: neon highlights, cables, hazard stripes, bright contrast
- Ghost floor: dim lighting, eerie silhouettes, worn textures

Battle presentation:

- Click trainer to engage
- Quick transition animation
- Player trainer slides to left
- Enemy trainer slides to right
- Both throw out Pokemon
- Battle sprites appear
- HP bars and names appear
- Move buttons appear at the bottom

This keeps the feel recognizable without requiring a full classic battle UI clone.

## Recommended Technical Direction

Recommended first implementation:

- Web game
- TypeScript
- Phaser 3
- Generated local JSON data files

Why this is the best first step:

- Fast iteration
- Easy sprite handling
- Simple keyboard and mouse input
- Clean scene separation for intro, overworld, battle, rewards, and outro

## Production Risks

The biggest risks are not graphics or movement. They are rules and data consistency.

Main risks:

- Cleanly filtering the roster
- Normalizing forms and edge-case evolutions
- Building smart legal movesets without feeling random or dumb
- Enforcing no-duplicate generation all the way through a run
- Keeping the battle system simple without feeling shallow

## Suggested Milestones

### Milestone 1

- Finalize rules document
- Lock inclusion and exclusion lists
- Pick source-of-truth Pokemon dataset
- Define evolution fallback rule
- Define move selection rules

### Milestone 2

- Build data import script
- Generate normalized local dataset
- Validate roster, forms, levels, and legal moves

### Milestone 3

- Build floor flow without art polish
- Starter selection
- Basic movement
- One working battle scene
- Reward choice flow

### Milestone 4

- Full 18-floor run
- Type doors
- Outro and run history display
- Final balancing pass

## Final Product Vision

The finished game should feel like a tight, readable Pokemon challenge run: easy to understand, hard to master, and fun to replay because each climb tells a different story through the 18 Pokemon the player was forced to trust along the way.
