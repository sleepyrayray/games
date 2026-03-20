# Who's the Spy? Roadmap

This roadmap is meant to take the project from planning to a finished first playable version without drifting away from the original goal:

- Minimalist, simple presentation
- Smooth local multiplayer flow on one shared device
- Fast setup and fast replayability

## North Star

Build a clean party game that feels easy to pass around, easy to understand, and fast to replay. The interface should stay quiet and minimal while the real social play happens between people in the room.

## Core Product Goals

- Support 3 to 10 local players on one device
- Let players set up a round in under 2 minutes
- Keep private information hidden during shared-device play
- Make each step obvious so players do not need to ask what to do next
- Avoid visual clutter, but keep interactions responsive and satisfying

## Design Principles

- One clear action per screen
- Large tap targets and readable text
- Minimal animation, only where it improves clarity
- Neutral, simple visual style over decorative UI
- Short transitions so the game feels quick, not sluggish
- Hidden information should never be easy to reveal by accident

## Scope For V1

Included in v1:

- Title screen
- Instructions screen
- Theme selection
- Player name entry
- Secret role and word assignment
- Private word reveal flow
- Hint round transition screen
- Private voting flow
- Tie and revote handling
- Elimination handling
- Spy final guess flow
- Win/lose results screen
- Restart / play again flow
- Four launch themes with 50 words each

Not in v1:

- Online multiplayer
- AI moderation
- Difficulty settings
- Custom themes
- Sound-heavy presentation
- Accounts, profiles, or progression systems

## Development Phases

### Phase 1: Lock The Rules And UX Flow

Goal: remove ambiguity before implementation starts.

Tasks:

- Confirm the exact round structure from title screen to game over
- Lock all win/loss rules, especially tie behavior and endgame conditions
- Decide the exact copy shown on each major screen
- Sketch the full screen flow in low-fidelity wireframes
- Define what information is public vs private at every step

Definition of done:

- No major rule questions remain open for v1
- Every screen in the game exists as a rough wireframe
- The README and roadmap agree on the same rules

### Phase 2: Set Up The Project Foundation

Goal: create the smallest solid base for the game.

Tasks:

- Choose and initialize the final project structure
- Set up the basic app shell and screen routing/state flow
- Create shared game state models for players, themes, roles, votes, and rounds
- Add utility functions for random selection, validation, and round setup
- Prepare deployment basics for the planned GitHub Pages release

Definition of done:

- The app can boot and move between placeholder screens
- Core game data structures exist and are stable enough for the rest of development
- The project can be run locally and deployed reliably

### Phase 3: Build The Setup Flow

Goal: make starting a game quick and painless.

Tasks:

- Build the title screen
- Build the instructions screen
- Build the theme selection screen
- Build the player name entry screen
- Add validation for player count and empty/duplicate names
- Add a start-game action that creates a valid round state

Definition of done:

- A group can move from title screen to round setup without confusion
- Invalid setup states are blocked cleanly
- Starting a round always produces valid player and word assignments

### Phase 4: Build The Secret Reveal Flow

Goal: make the pass-the-device experience safe and smooth.

Tasks:

- Show one player at a time with a clear handoff screen
- Add a deliberate reveal interaction so words are not exposed too early
- Display the player's secret word clearly without explicitly labeling them as the spy or a non-spy
- Add a next-player flow that returns the screen to a safe hidden state
- Complete the loop until all players have seen their word

Definition of done:

- Players can pass one device around without accidental information leaks
- The reveal flow feels fast and consistent for every player
- The app reliably knows when the reveal phase is complete

### Phase 5: Build The Round Transition Layer

Goal: guide players cleanly between app-driven and real-life gameplay.

Tasks:

- Create a transition screen that instructs players to begin the spoken hint round
- Add a clear continue action to start voting when the group is ready
- Keep the screen simple so it supports the table conversation instead of competing with it

Definition of done:

- Players understand when the app pauses and when it expects input again
- The transition from hinting to voting feels intentional, not abrupt

### Phase 6: Build The Voting System

Goal: support private voting without exposing live results.

Tasks:

- Present one active voter at a time
- Prevent self-voting
- Prevent voting for already eliminated players
- Record votes privately without showing tally progress
- Reveal only the eliminated player after all votes are cast
- Add tie detection and the planned revote behavior

Definition of done:

- Voting works for every active player count
- No vote information leaks before the reveal moment
- Tie and revote rules behave exactly as designed

### Phase 7: Build Elimination And Endgame Logic

Goal: make the game rules complete and deterministic.

Tasks:

- Remove eliminated players from future voting rounds
- Handle the case where a non-spy is eliminated and the game continues
- Handle the case where the spy is eliminated
- Build the spy final guess input flow
- Resolve the final result correctly based on the spy’s guess
- Add the automatic spy win condition if only two players remain

Definition of done:

- Every round ends in a valid next state
- No endgame path leads to a dead end or ambiguous result
- The game can always reach a clean result screen

### Phase 8: Add Content For V1

Goal: make the game replayable enough for the first release.

Tasks:

- Add the five launch themes: Foods & Drinks, Animals, Countries, Jobs, and Household Items
- Add 50 words to each theme
- Validate that random same-theme pairings are not obviously broken too often
- Remove weak or confusing words found during test rounds

Definition of done:

- All launch themes are playable
- The word pool is large enough for repeated sessions
- Early playtests do not expose major content quality issues

### Phase 9: Polish For Feel And Clarity

Goal: preserve minimal visuals while improving moment-to-moment quality.

Tasks:

- Tighten spacing, typography, and button sizing
- Improve screen-to-screen pacing
- Reduce unnecessary steps or extra taps
- Add subtle transitions only where they help orientation
- Test readability at phone and small tablet sizes
- Make sure the app feels responsive even on slower devices

Definition of done:

- The UI looks clean without feeling empty
- The game feels quick to operate
- The interface supports the social experience instead of slowing it down

### Phase 10: Test, Fix, And Ship

Goal: stabilize the first public playable version.

Tasks:

- Test all main flows from setup to restart
- Test edge cases including minimum player count, maximum player count, duplicate names, tied votes, multiple elimination rounds, spy guess success/failure, and the last-two-players spy win condition
- Fix UX confusion found during playtesting
- Deploy to GitHub Pages
- Update README with final play instructions and live link

Definition of done:

- No blocking bugs remain in the core loop
- New players can complete a round without outside explanation
- The deployed version matches the intended v1 scope

## Suggested Milestone Order

1. Rules locked
2. Project foundation ready
3. Setup flow playable
4. Secret reveal flow playable
5. Voting and elimination working
6. Endgame logic complete
7. Content filled in
8. Polish pass complete
9. Playtest fixes complete
10. Release

## Quality Checklist

Use this checklist throughout development:

- Is this screen doing only one job?
- Can a new player understand the next action instantly?
- Could private information leak here?
- Is there any extra tap that can be removed?
- Does this feel fast on a shared device?
- Does this feature support the social game, or distract from it?

## Risks To Watch Early

- Random same-theme word pairings may create unfair rounds
- Shared-device reveals may accidentally expose secret information
- Voting UX may become slow or repetitive with larger groups
- Minimal UI may feel too plain unless spacing and pacing are handled carefully
- Edge-case rules may create confusing round transitions if not tested early

## Recommended Build Mindset

Start with the smallest full playable loop, then improve feel. Do not over-design the UI early. If forced to choose between more visuals and smoother flow, choose smoother flow every time.
