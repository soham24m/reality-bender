# Reality Bender

A gesture-controlled 3D combat arena browser game. Play entirely through your webcam using hand and face tracking, or fall back to keyboard controls.

## Tech Stack
- **Three.js**: 3D rendering and physics.
- **MediaPipe**: Real-time hand and face tracking for gesture recognition.
- **Vanilla JavaScript**: Pure ES6 modules, no complex build systems needed.

## Status
![Status](https://img.shields.io/badge/status-demo_ready-blue)

## Features
- **Gesture Control**: Pure MediaPipe coordinate tracking for precise gesture detection without black-box classification.
- **Adaptive Boss AI**: Boss tracks your gesture frequency and timing to dynamically change its attack patterns, counter-attack, and enrage after 90 seconds.
- **Wave Progression**: Multi-stage combat with scaling enemies, ending with a boss fight.
- **Combo System**: Consecutive kills grant score multipliers.
- **Procedural Audio**: Web Audio API generated sound effects (no external audio assets).
- **Dynamic Environments**: Arena seamlessly transitions to a new visual theme in later waves.
- **Accessibility Support**: Falls back automatically to keyboard controls if camera permissions are denied or unavailable.

## How to Play
1. Run a local web server in this directory.
   - Using Python: `python3 -m http.server 8000`
   - Using Node: `npx serve`
2. Open your browser to `http://localhost:8000`.
3. Allow camera permissions when prompted.
4. Use gestures to fight enemies!
   - **Fist**: Quake (Heavy AOE)
   - **Open Palm**: Blast (Light AOE + Knockback)
   - **Point**: Laser (Single-target projectile)
   - **Mouth Open**: Heal
   - **Smile**: Freeze

*Keyboard fallback controls*: `F` (Fist), `P` (Palm), `L` (Point), `M` (Mouth Open), `S` (Smile).
