# Who's the Spy? V1 Spec

This document locks Phase 1 for v1. It defines the screen flow, rule behavior, information visibility, and UI tone so implementation can start without guesswork.

## Product Intent

The game should feel:

- Minimalist
- Quick to learn
- Smooth to pass around on one shared device
- Clear at every step

The app should support the real-life social gameplay, not compete with it.

## Locked Decisions

- No in-app timer for the hint round
- Neutral, clean on-screen copy
- Mobile-first UI with desktop support
- One shared device for all setup, reveals, voting, and endgame input
- Each player sees a handoff screen with their name first, then taps to reveal their word
- Reveal order is randomized each round
- The word reveal screen shows only the assigned word, not an explicit spy or non-spy label
- After seeing their word, the player taps the word card to hide it and advance to the next player
- Final spy guess must match the common word after case-insensitive comparison, with a small approved set of common variants accepted for specific words
- The app never shows vote counts or who voted for whom
- If only two active players remain and the spy is still in the game, the spy wins immediately

## Core Rules

- Supported player count is 3 to 10
- Exactly one player is the spy
- The group chooses one theme before the round starts
- Two different words are chosen at random from that theme
- One word becomes the common word for all non-spies
- The other word becomes the spy word for the spy
- Players reveal their words privately, one by one, on the shared device
- The app does not explicitly tell players whether they are the spy during the reveal flow
- The spoken hint round happens in real life and is not enforced by the app
- After the hint round, each active player votes privately on the shared device
- Players cannot vote for themselves
- Eliminated players are removed from future voting rounds
- If the eliminated player is the spy, the spy gets one final guess at the common word
- If the spy guesses correctly, the spy wins
- If the spy guesses incorrectly, the non-spy players win

## Turn Order

- Secret word reveals happen in a randomized order each round
- Voting order is randomized for each voting phase, skipping eliminated players
- Revotes also randomize voter order, skipping eliminated players

## Setup Validation

- Minimum players: 3
- Maximum players: 10
- Empty names are not allowed
- Duplicate names are not allowed
- Duplicate checking should ignore case and surrounding whitespace
- Theme selection is required before the round can start

## Public Vs Private Information

Public information:

- Title screen and instructions
- Available themes
- Player list during setup
- Which player's turn it is to reveal or vote
- The eliminated player after voting resolves
- Whether the game continues, goes to a revote, or ends
- The final winner and the final round reveal on the result screen

Private information:

- Each player's role
- Each player's word
- Each player's vote choice
- The spy's final typed guess until it is submitted

The UI should always return to a safe, non-secret state before the device is passed to the next player.
The app does not explicitly reveal any player's role during the initial word reveal flow.

## Screen Flow

### 1. Title Screen

Purpose: entry point to the game.

Main copy:

- Title: `Who's the Spy?`

Primary actions:

- `Play`
- `Instructions`

Notes:

- Keep this screen visually simple
- One strong primary action is enough

### 2. Instructions Screen

Purpose: explain the rules in a short, readable format.

Main copy:

- Title: `How to Play`
- Summary lines should explain theme selection, secret words, spoken hints, private voting, and the spy's final guess

Primary actions:

- `Back`

Notes:

- Keep the text short enough to scan quickly
- Avoid long paragraphs

### 3. Theme Selection Screen

Purpose: choose the round theme.

Main copy:

- Title: `Choose a Theme`

Primary actions:

- Select one theme card
- `Continue`
- `Back`

Validation copy:

- `Choose a theme to continue.`

Notes:

- Only one theme can be active at a time
- Launch themes are Foods, Animals, Countries, Jobs, and Home

### 4. Player Entry Screen

Purpose: collect the player list for the round.

Main copy:

- Title: `Add Players`
- Helper text: `3 to 10 players`

Primary actions:

- Enter player names
- `Add Player`
- `Start Round`
- `Pick Another Theme`

Validation copy:

- `Add at least 3 players.`
- `You can add up to 10 players.`
- `Each player needs a name.`
- `Player names must be unique.`

Notes:

- Names should be trimmed before validation and storage
- Player names are capped at 12 characters
- Keep the screen focused on speed and readability

### 5. Player Reveal Handoff Screen

Purpose: safely hand the device to the next player before any secret appears.

Main copy:

- Title: `Pass it to [Name]`, with the player name visually emphasized below the text
- Main card action: `Reveal your word`

Primary actions:

- Tap anywhere on the main card or button area to continue

Notes:

- This screen is safe to show publicly
- No role or word appears yet
- The main card should not repeat the player's name

### 6. Player Word Reveal Screen

Purpose: show the current player's word privately without explicitly revealing their role.

Main copy:

- Show the assigned word in large text
- Instruction: `Tap to hide and pass it on`

Primary actions:

- Tap the word card to hide it and advance

Notes:

- No spy or non-spy label appears on this screen
- There is no separate next-player button in v1
- The instruction is visible immediately and starts blinking once the card can be tapped
- If more players remain, tapping the word card advances to the next player's handoff screen
- If this is the last player, tapping the word card advances to the hint round screen

### 7. Hint Round Screen

Purpose: pause app interaction while the real-life hint round happens.

Main copy:

- Title: `Everyone drops one clue.`
- Line: `Say one clue each and vote when everyone is ready.`

Primary actions:

- `Continue to Voting`

Notes:

- No timer
- No speaking-order enforcement

### 8. Voting Handoff Screen

Purpose: safely hand the device to the current voter before vote options appear.

Main copy:

- Title: `Pass it to [Name]`, with the voter name visually emphasized below the text
- Main card action: `Open your ballot`
- Revote card action: `Open revote`

Primary actions:

- Tap anywhere on the main card or button area to continue

Notes:

- This screen is safe to show publicly
- No vote options appear until the tap
- The main card should not repeat the voter's name

### 9. Voting Screen

Purpose: collect one private vote from the current voter.

Main copy:

- Title: `[Name], who's the spy?`

Primary actions:

- Select one eligible player
- `Submit Vote`

Voting rules on this screen:

- The current voter cannot vote for themselves
- Eliminated players do not appear as options
- In a revote, only tied players appear as options
- In a revote, the current voter still cannot vote for themselves

Notes:

- The selected player should be visibly highlighted before submission
- Vote counts should never be shown
- After `Submit Vote`, advance to the next active voter's handoff screen
- After the final vote, resolve the round immediately

### 10. Tie Screen

Purpose: explain that the vote tied and tell players what happens next.

Main copy for first tie:

- Title: `Tie Vote`
- Line: `Revote between [names].`

Primary actions:

- `Start Revote`

Main copy for second tie:

- Title: `No Elimination`
- Line: `The revote tied again.`
- Line: `Start another hint round.`

Primary actions:

- `Back to Hint Round`

Notes:

- The tied players' names can be public
- A second tied vote ends the voting phase with no elimination

### 11. Elimination Screen

Purpose: reveal who was eliminated and where the game goes next.

Main copy if a non-spy is eliminated:

- Title: `[Name] was eliminated`
- Line: `The game continues.`

Primary actions:

- `Next Round`

Main copy if the spy is eliminated:

- Title: `[Name] was eliminated`
- Line: `[Name] was the spy.`
- Follow-up line: `[Name] gets one last shot to guess the common word.`

Primary actions:

- `Continue`

Notes:

- Do not show vote counts
- Do not show who voted for whom

### 12. Spy Guess Handoff Screen

Purpose: hand the device to the eliminated spy before the final guess input appears.

Main copy:

- Title: `Pass it to [Name]`, with the spy name visually emphasized below the text
- Main card action: `Make your guess`

Primary actions:

- Tap anywhere on the main card or button area to continue

### 13. Spy Guess Screen

Purpose: let the spy try to steal the win by guessing the common word.

Main copy:

- Line: `You were the spy.`
- Title: `Guess the common word`

Primary actions:

- Type a guess
- `Submit Guess`

Input rules:

- Compare using a case-insensitive match
- Trim surrounding whitespace before comparing
- Accept only a small approved set of common variants for specific words
- Do not accept broad fuzzy matches, open-ended synonyms, hints, or near-matches

Notes:

- If possible, disable autocorrect and auto-capitalization
- The guess stays private until submitted

### 14. Result Screen

Purpose: end the round clearly and support fast replay.

Main copy if the spy wins:

- Title: `Spy wins`

Main copy if the crew wins:

- Title: `Crew wins`

Round reveal:

- Show the common word
- Show the spy word
- The result note can name the spy and explain why the round ended

Primary actions:

- `Play Again`
- `Main Menu`

Replay behavior:

- `Play Again` starts a fresh setup flow with the previous player list preserved
- The player list should be editable before the next round starts

## Round Resolution Rules

### Role And Word Assignment

- Randomly choose one spy from the full player list
- Randomly choose two different words from the selected theme
- Assign the common word to every non-spy
- Assign the spy word to the spy

### Voting Resolution

- Collect one vote from every active player
- Count votes only after all active players have voted
- If one player has the highest vote total, that player is eliminated
- If multiple players share the highest vote total, trigger a revote

### Revote Rules

- All active players vote again
- Revote options are limited to the tied players only
- Self-voting is still not allowed
- If the revote produces one highest-voted player, eliminate that player
- If the revote ties again, eliminate no one and return to the hint round

### Continuing The Game

- If a non-spy is eliminated and more than two active players remain, start another hint round
- If a non-spy is eliminated and only two active players remain, the spy wins immediately
- If the spy is eliminated, go to the spy guess flow

### Final Guess Resolution

- If the submitted guess matches the common word after case-insensitive comparison, or matches an approved variant for that word, the spy wins
- Otherwise, the non-spies win

## Tone And UI Guardrails

- Use short, plain labels
- Avoid dramatic or playful flavor text in v1
- Design for phone-sized screens first, then scale the same layout up for desktop
- Prefer one clear action per screen
- Use large tap targets
- Keep transitions quick
- Never leave secret information visible longer than necessary
- Return to a neutral screen before handing the device to the next player whenever private input is involved
- Keep the reveal flow word-only so players are not explicitly told whether they are the spy

## Assumptions Locked For Now

- Each active player gives one spoken hint per hint round
- The app does not track hint content or speaking order
- There is no scoring system across rounds
- There is no scoreboard or stats screen in v1
- `Back` behavior during an active round does not need special support in v1 unless it becomes necessary during implementation
