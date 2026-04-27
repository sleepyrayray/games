# Rainbow Comet

Rainbow Comet is a small Three.js visual experience about an endless comet flying through space. It is meant to be atmospheric and visual, with light interaction instead of traditional gameplay.

Planned game link: [https://sleepyrayray.github.io/games/rainbow-comet/](https://sleepyrayray.github.io/games/rainbow-comet/)

Project roadmap: [ROADMAP.md](ROADMAP.md)

Reference inspiration: [THREE.js particle stream by zadvorsky](https://codepen.io/zadvorsky/pen/qOYqGv)

## Core Idea

- Show a comet flying endlessly through deep space.
- Use a straight, particle-heavy tail inspired by the reference effect.
- Shift the tail through slow rainbow color phases, with each particle keeping the color it was born with.
- Let the user rotate the view around the comet from a steady camera distance.
- Focus on mood, motion, and polish over game systems.

## Visual Direction

- A dark space background with stars and faint dust.
- A glowing particle tail that feels smooth and alive.
- A faceted icy comet core so the effect reads as a real object instead of only a stream.
- Slow, elegant color transitions rather than fast flashing rainbow changes.
- No visible UI controls, menus, or buttons.

## Comet Note

A comet is not just a rock, but giving it a small rocky or icy 3D core is still a good idea for this project. In practice, the visual can use:

- a small 3D nucleus mesh for the comet body
- a bright glowing head around that core
- a long particle tail flowing behind it

That should make the scene read clearly as a comet while still keeping the stylized rainbow look.

## Planned Features

- Built with Vite and Three.js
- Endless looping flight animation
- User rotation at a fixed camera distance
- Slow per-particle rainbow gradient cycling
- Particle trail and glow
- Stars and faint space dust
- Simple responsive full-screen presentation

## Development

Install dependencies:

```sh
npm install
```

Start the local dev server:

```sh
npm run dev
```

The Vite app is configured for the GitHub Pages subpath, so the local URL is:

[http://localhost:5173/games/rainbow-comet/](http://localhost:5173/games/rainbow-comet/)

Build the production version:

```sh
npm run build
```

## Project Status

The project now has its initial Vite and Three.js scaffold. The first visual pass includes a fullscreen space scene, stars, faint dust, rotate-only OrbitControls with bounded rotation, a faceted icy comet nucleus with layered glow, and a straight shader-based particle tail.

The tail now uses per-particle birth colors: older particles keep earlier hues while newly spawned particles enter with newer hues, creating a gradual rainbow transition inspired by the reference. The first tail polish pass softened the head connection, added subtle drift, improved the taper, and switched the scene to steady responsive framing without user zoom.

The first comet body polish pass replaced the placeholder head with an irregular vertex-colored nucleus, a brighter inner glow, a wider soft coma, a tail-side glow, and a small rim light so the head stays readable while the rainbow hue changes.
