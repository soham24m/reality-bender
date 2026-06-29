# Reality Bender

A gesture-controlled 3D combat arena built entirely in the browser. Use your webcam to cast spells, clear waves of enemies, and defeat the adaptive boss!

![Status](https://img.shields.io/badge/status-demo_ready-blue)

## Features
- **Gesture Control**: Pure MediaPipe coordinate tracking for precise gesture detection (Hands + FaceMesh) without black-box classification.
- **Adaptive Boss AI**: Tracks your gesture frequency to dynamically change attack patterns, counter-attack ability spam, and enrage after 90 seconds.
- **Minion Spawning**: Boss spawns orbiting minions at Phase 2 for added difficulty and chip damage.
- **Advanced Combos**: String specific gestures together (e.g. FIST + POINT) within 1 second for a massive Combo Strike.
- **Dynamic Difficulty**: Boss starting phase is dynamically calibrated based on how much damage you took in earlier waves.
- **Replayability**: Run again seamlessly without page reloads (state resetting implemented across all systems).
- **Procedural Audio**: Web Audio API generated sound effects (no external audio assets needed).
- **Cinematic Polish**: Slow-motion camera push-in on boss defeat, dynamic lighting, and screen shake.
- **Accessibility Support**: Falls back automatically to keyboard controls if camera permissions are denied or unavailable.

## Tech Stack
- **Graphics**: [Three.js](https://threejs.org/) (Vanilla WebGL, no shaders)
- **Computer Vision**: [MediaPipe](https://mediapipe.dev/) (Hands & FaceMesh via CDN)
- **Audio**: Web Audio API (Procedural Oscillators)
- **Architecture**: Vanilla ES6 JavaScript modules (no build steps, bundlers, or frameworks)

## Architecture Overview
- `src/main.js`: Bootstrapper and main `requestAnimationFrame` orchestrator. Coordinates state resets and overarching game loop logic.
- `src/scene.js`: Manages the Three.js scene, renderer, camera, lights, particles, slow-motion time dilation, and cinematic panning.
- `src/vision.js`: Interfaces with webcam and MediaPipe to translate physical coordinates into recognized gestures, handling fallback to keyboard if inaccessible.
- `src/combat.js`: Handles cooldowns, combos (including the 1-second Combo Strike window), damage calculation, projectiles, player HP, and difficulty tracking.
- `src/enemies.js`: Orchestrates the 4 pre-boss waves, spawning logic, enemy AI movement, and wave clear mechanics.
- `src/boss.js`: Manages the multi-phase adaptive boss behavior tree, minion spawning and orbiting logic, and phase transitions.
- `src/ui.js`: DOM manipulation for overlays (cooldown bars, pause menu, dynamic difficulty indicators, combo hints, and victory stats).
- `src/audio.js`: Synthesizes sound effects procedurally via AudioContext.

## How to Play
1. Run a local web server in this directory.
   ```bash
   python3 -m http.server 8000
   ```
2. Open `http://localhost:8000` in your browser.
3. Allow Camera permissions when prompted.
4. If camera fails or you prefer keyboard, use:
   - **F**: Quake (Fist)
   - **P**: Blast (Open Palm)
   - **L**: Laser (Point)
   - **M**: Heal (Mouth Open)
   - **S**: Freeze (Smile)
   - **Esc**: Pause Menu

## Project Scope & Limitations
- **No Textures**: The game uses basic geometry (Spheres, Icosahedrons) and raw materials by design to avoid external asset loading.
- **No Persistent Save Data**: Stats and scores are reset on a hard page reload; there is no database or `localStorage` implementation.
- **Performance**: While optimized, rendering MediaPipe and Three.js simultaneously can be demanding on low-end integrated GPUs.
