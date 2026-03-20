# Who's the Spy?

Who's the Spy? is a small local multiplayer social deduction game built around hidden words, spoken hints, and elimination voting. Everyone plays on one shared device, but the actual hint-giving happens face to face in real life.

Planned game link: [https://sleepyrayray.github.io/games/whosthespy/](https://sleepyrayray.github.io/games/whosthespy/)

## Core Idea

- The game supports 3 to 10 players.
- Players choose a public theme before the game starts.
- One player is secretly the spy.
- The spy gets a different word from everyone else, but both words come from the same theme.
- Players reveal their words privately one by one on the shared device.
- The app shows only each player's word during reveal and does not explicitly say whether they are the spy.
- The app randomizes the order in which players check their words.
- Players then give spoken hints to each other in real life.
- After the hint round, everyone votes for who they think the spy is.
- If the spy is found, the spy gets one final chance to guess the common word and steal the win.

## Planned Menu Flow

- Title screen with the game name `Who's the Spy?`
- `Play` button
- `Instructions` button

## Planned Game Flow

1. Choose a theme.
2. Enter player names.
3. Start the game.
4. Show a clickable player card for the next player in a randomized reveal order.
5. The player taps their card to privately reveal their word.
6. The player taps their word to hide it and move to the next player's reveal card.
7. Once all players have seen their word, the app tells players to begin the real-life hint round.
8. After the hint round, each active player votes privately on the shared device by clicking another player's name.
9. The app reveals only the eliminated player, not the full vote tally.
10. If the eliminated player was not the spy, that player is out and the game continues.
11. If the eliminated player was the spy, the spy gets one chance to type the common word.
12. If the spy guesses the common word correctly, or matches a small accepted variant for that word, the spy wins. Otherwise the non-spy players win.
13. After game over, players can restart and play again.

## Rule Set

- One spy per game.
- 3 players is allowed, though larger groups will likely feel more social.
- Players cannot vote for themselves.
- Eliminated players cannot talk after being voted out.
- Speaking order during the hint round is not enforced by the app.
- The app does not explicitly tell players whether they are the spy during word reveal.
- The app should not show live voting results or vote counts.
- The app should only reveal the eliminated player after voting is complete.
- No difficulty modes are planned for the first version.

## Theme Content Plan

The first version should ship with five starting themes:

- Foods & Drinks
- Animals
- Countries
- Jobs
- Household Items

Each theme should contain 50 words.

The current design direction is:

- Pick one theme for the game.
- Randomly choose two different words from that theme's 50-word pool.
- One of those words becomes the common word for most players.
- The other becomes the spy word for the spy.

This is intentionally different from a fixed curated pair system. Instead of hand-authored pairs, the game creates a same-theme matchup by randomizing from the full theme pool.

## Design Note

Randomizing both words from the full theme pool should create a lot of variety, but it may also create uneven rounds. Some same-theme combinations will feel great, while others may be much harder or much easier than expected. If playtesting shows that the game feels too swingy, the content system can later move to curated pairs or add validation rules for safer matchups.

## Open Assumptions For Now

These details have not been fully locked yet, so this README assumes the simplest version for planning:

- If voting ends in a tie, the game should trigger a revote between tied players.
- If the revote also ties, no one is eliminated and another hint round begins.
- If the spy survives until only two players remain, the spy wins automatically.

## Project Status

This project is currently in planning and pre-production. The goal of the first playable version is a clean local multiplayer prototype with simple setup, private word reveals, secret voting, and fast replayability.
