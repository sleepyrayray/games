# Rainbow Comet Roadmap

## Project Goal

Build a polished, purely visual Three.js experience where a glowing comet travels endlessly through space. The comet stays mostly centered while stars, faint dust, and a streaming particle tail create the feeling of endless forward motion.

The visual focus is a small rocky or icy comet nucleus with a bright glowing head and a straight particle tail. The tail should transition slowly through the colors of the rainbow by giving newly spawned particles new hues while older particles keep their previous hues, creating a gradual gradient through the stream.

Reference inspiration: [THREE.js particle stream by zadvorsky](https://codepen.io/zadvorsky/pen/qOYqGv)

## Confirmed Direction

- Use Vite and Three.js.
- Build a fullscreen visual experience, not a traditional game.
- Keep the experience purely visual with no visible UI controls.
- Allow the user to rotate around the comet from a steady camera distance.
- Use a straight streaming comet tail.
- Cycle the tail slowly through the rainbow with per-particle birth colors.
- Use stars only, with faint dust for depth.
- Balance performance for both mobile and desktop.
- Deploy through GitHub Pages.

## Current Progress

- Done: initial Vite and Three.js scaffold.
- Done: fullscreen canvas layout.
- Done: first scene foundation with camera, renderer, resize handling, lights, stars, faint dust, and OrbitControls.
- Done: first comet body polish with an irregular faceted nucleus, layered glow, tail-side glow, and rim light.
- Done: first straight streaming particle tail prototype.
- Done: per-particle tail color cycling where new particles receive newer hues.
- Done: first tail shape polish pass for softer drift, taper, and head connection.
- Done: steady responsive camera framing without user zoom.
- Done: bounded rotation so the comet and tail stay readable.
- Next: strengthen the endless travel illusion with background depth and motion polish.

## Phase 1: Project Setup

- Set up the project with Vite and Three.js.
- Add the core source structure for scripts, styles, and assets.
- Create a fullscreen canvas layout.
- Configure the app for the planned GitHub Pages path.
- Add basic build and preview scripts.

## Phase 2: Scene Foundation

- Create the Three.js renderer, scene, camera, and animation loop.
- Add responsive resize handling.
- Add OrbitControls for rotation without user zoom.
- Tune the camera framing so the comet is immediately visible.
- Add baseline lighting for the comet body and glow.

## Phase 3: Space Background

- Add a dark space background.
- Create a starfield with varied star sizes and depths.
- Add subtle faint dust particles for atmosphere.
- Animate the background elements to support the endless travel illusion.
- Make the background loop cleanly without obvious resets.

## Phase 4: Comet Body

- Create a small rocky or icy nucleus mesh.
- Give the nucleus subtle shape irregularity so it does not look like a perfect sphere.
- Add a glowing head around the nucleus.
- Add a soft front glow so the comet reads clearly from different camera angles.
- Add subtle comet body rotation.

## Phase 5: Particle Tail Prototype

- Build a straight streaming particle tail behind the comet.
- Use particles that regenerate continuously.
- Tune tail length, width, density, speed, and fade.
- Keep the comet centered while the tail motion suggests forward travel.
- Start with a balanced particle count that can run on mobile and desktop.

## Phase 6: Slow Rainbow Color Cycling

- Implement a slow color cycle through red, orange, yellow, green, blue, indigo, and violet.
- Give each particle the color phase active when it spawns.
- Let the tail form a gradual gradient as older particles move away from the comet.
- Let older particles fade naturally so transitions feel smooth.
- Avoid fast flashing or noisy rainbow effects.

## Phase 7: Endless Travel Illusion

- Keep the comet mostly centered in the scene.
- Move stars, dust, and particles to imply forward motion.
- Use looping positions or recycled particles to keep the effect endless.
- Add subtle variation so the loop does not feel mechanical.
- Verify that the motion still works after rotating the camera.

## Phase 8: Interaction Polish

- Keep the camera distance fixed so the comet and tail stay readable.
- Tune OrbitControls damping for smooth rotation.
- Prevent awkward camera angles where the comet or tail disappears.
- Keep all interaction direct through the canvas with no visible UI.
- Make touch controls feel acceptable on mobile.

## Phase 9: Performance Pass

- Cap device pixel ratio for stable performance.
- Tune particle count for mobile and desktop.
- Prefer efficient buffer geometry or shader-based particles if needed.
- Check animation smoothness on narrow and wide screens.
- Remove unnecessary allocations from the animation loop.

## Phase 10: Visual Polish

- Improve glow, particle softness, and tail fade.
- Tune star brightness and dust visibility.
- Adjust color timing until the rainbow transition feels calm and elegant.
- Refine camera position, comet size, and tail scale.
- Make the first version feel like a finished visual piece, not only a technical demo.

## Phase 11: Documentation and Deployment

- Update the README with setup, controls, and deployment notes.
- Build the production version.
- Deploy to GitHub Pages at the planned project URL:
  [https://sleepyrayray.github.io/games/rainbow-comet/](https://sleepyrayray.github.io/games/rainbow-comet/)
- Verify the deployed page on desktop and mobile.

## First Prototype Target

The first milestone is a working fullscreen scene with:

- a centered comet with a rocky or icy nucleus
- a bright glowing comet head
- a straight streaming particle tail
- slow per-particle rainbow gradient cycling
- stars and faint dust
- endless travel illusion
- rotate-only controls
- responsive mobile and desktop layout

## Later Ideas

- Optional ambient audio with mute support.
- Optional quality setting if performance needs it.
- Distant planet or nebula background as a future visual layer.
- Screenshot-friendly camera framing.
