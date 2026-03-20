# Who's the Spy? Portfolio Notes

This document is a portfolio-friendly summary of the project: what it is, why it was made, how it evolved, and what decisions shaped the final result.

## Project Summary

Who's the Spy? is a local multiplayer social deduction game built for one shared device. Players each receive a secret word from the same public theme, except one player, the spy, who gets a different word. Players give spoken hints in real life, vote in private on the device, and if the spy is caught, they get one final chance to guess the common word and steal the win.

## Quick Portfolio Description

Built a mobile-first party game around a shared-device flow, private word reveals, private voting, and fast replayability. The project focused on minimalist UI, smooth turn handoff, and clear social gameplay without over-designing the interface.

## Role

- Solo design and development
- Product thinking
- Rules/spec design
- UI/UX iteration
- Frontend implementation
- Content design for launch themes

## Core Goal

Make a party game that feels:

- easy to understand
- fast to set up
- safe to pass around on one device
- smooth on mobile
- minimal without feeling empty

The app was designed to support the real social interaction in the room, not compete with it.

## Design Direction And Inspiration

The project was driven more by product constraints and feel than by one specific visual reference.

Main influences:

- minimalist party-game UI
- mobile-first interaction design
- shared-device privacy patterns
- fast social games where the tension comes from the players, not from heavy interface effects

The visual direction intentionally stayed simple:

- centered layouts
- large tap targets
- short, readable copy
- minimal decoration
- subtle animation only when it improved clarity

## Main Constraints

- One shared device for all players
- Private information must not leak during pass-the-device moments
- Most sessions will happen on phones, but desktop still needs to work
- The game should support 3 to 10 players
- Setup should be quick enough for casual group play

## Process

### 1. Rules First

The project started by locking the full game flow before building screens. This included:

- all main screens from title to result
- public vs private information
- tie and revote behavior
- spy final guess behavior
- replay flow

This reduced drift and made later UI decisions easier.

### 2. Build The Full Loop Early

Instead of polishing one screen at a time in isolation, the first implementation focused on getting the entire game loop working:

- setup
- secret reveal
- hint round transition
- voting
- elimination
- spy guess
- result

That made it possible to test real pacing and identify where the shared-device flow felt awkward.

### 3. Mobile-First Polish

Once the loop worked, the main effort shifted to UX polish:

- simplifying the setup flow
- randomizing reveal order and theme order
- improving handoff screens
- making voting private and easy to understand
- tightening result and endgame screens
- making the UI feel stable during card transitions

### 4. Content Expansion

After the loop felt reliable, the word pools were expanded into launch-ready themes with 50 words each:

- Foods
- Animals
- Countries
- Jobs
- Home

This kept content work from happening too early, before the rules and pacing were stable.

## Important Product Decisions

### The Spy Is Not Explicitly Told They Are The Spy During Reveal

One of the most important gameplay choices was not labeling players as spy or non-spy during the secret reveal. Every player only sees their word.

Why it mattered:

- it keeps the reveal screen cleaner
- it creates a stronger social moment during live hinting
- the spy realizes they are the odd one out through play, not through UI copy

### Shared-Device Privacy Was A Core UX Problem

The game is simple mechanically, but the hard part is protecting secret information while passing one screen between people.

That led to features like:

- safe handoff screens
- locked reveal timing
- hidden state before pass-off
- private voting screens
- no vote counts or live result leaks

### Minimal Animation, But Not No Animation

Animation was only added where it improved clarity:

- pulsing tap cues
- a simple word reveal fade
- stable card positioning during reveal/handoff moments

Anything noisy or distracting was cut back.

## Technical Stack

- React
- TypeScript
- Vite
- GitHub Pages deployment

## Technical And UX Challenges Solved

### Shared-Device Flow

The hardest part of the project was not game logic alone, but making the pass-the-device experience feel safe and obvious.

### Private Reveal Pacing

The reveal needed to feel deliberate without becoming slow. Several versions were tried and simplified until the final interaction felt clean.

### Voting Clarity

The game needed private voting, tie handling, and revotes without overwhelming the player or exposing hidden information.

### Pages Deployment

The project also needed a reliable GitHub Pages setup with the correct production path and browser-safe build settings.

## Iteration Highlights

Some of the more meaningful refinements during development:

- moved from placeholder structure to full playable loop early
- simplified theme and setup screens
- made the UI mobile-first while still supporting desktop
- removed role labels from the reveal flow
- added accepted aliases for a small set of spy final guesses
- refined endgame clarity and winner messaging
- fixed card positioning, tap feel, and reveal flicker issues
- simplified theme labels for cleaner presentation

## Outcome

The final result is a lightweight, replayable social game with:

- a full round structure
- five launch themes
- private reveals and private voting
- tie and revote handling
- spy guess endgame
- mobile-first UI
- GitHub Pages deployment

## What Makes This Project Portfolio-Worthy

- Strong product thinking despite a small scope
- Clear UX focus around privacy and social play
- Multiple design decisions driven by actual play feel
- Good example of turning a simple idea into a polished, shippable loop

## Good Talking Points For A Portfolio

- Designing for one shared device instead of one player per device
- Treating privacy as a UX problem, not just a game-rule problem
- Keeping a minimalist interface while still making every next step obvious
- Using iteration to simplify the game instead of adding more features
- Prioritizing replayable content only after the loop felt solid

## What I Would Improve Next

If the project continued, the most natural next steps would be:

- more launch themes
- more playtesting for word-pair quality
- optional sound design
- a lightweight portfolio landing page or trailer section
- analytics or lightweight session logging for real playtest insights

## Short Blurb Option

Who's the Spy? is a mobile-first local multiplayer party game built around hidden words, spoken hints, and private voting on one shared device. I designed and built the full gameplay loop, focusing on shared-device privacy, fast setup, and a clean minimalist interface that stays out of the way of the social experience.

## Longer Blurb Option

Who's the Spy? is a social deduction game for 3 to 10 players where everyone plays on one shared device. I designed the rules, locked the screen flow, and built the full React/TypeScript implementation with private reveals, private voting, tie handling, spy endgame logic, and replayable launch themes. The project emphasized mobile-first UX, minimal visual design, and careful interaction design so hidden information stays private even while a group passes the device around in real life.
