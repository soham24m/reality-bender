# Reality Bender

**Gesture-Controlled AI Combat Arena**

Reality Bender is a browser-based combat arena where you fight AI enemies using real hand gestures. No keyboard. No mouse. Just your hands, a webcam, and raw intent. Built from scratch with MediaPipe for gesture recognition, Three.js for 3D rendering, and Claude AI for adaptive enemy behavior.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Gesture Recognition | [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) |
| 3D Rendering | [Three.js](https://threejs.org/) |
| Voice Commands | Web Speech API |
| Enemy AI | Claude AI (Anthropic) |
| Platform | Vanilla JS — no frameworks, no build tools |

## Current Status

✅ **Day 1: Gesture Detection** — Webcam opens, hand is tracked in real-time, fist gesture detected and logged as SHOCKWAVE. Open palm also recognized. Gesture HUD rendered on canvas with cooldown logic.

## Run Locally

```bash
git clone https://github.com/soham24m/reality-bender.git
cd reality-bender
# Open index.html in a modern browser (Chrome recommended)
# Allow webcam access when prompted
```

No install. No build step. Just open and play.

## Roadmap

| Day | Milestone |
|-----|-----------|
| **Day 1** | ✅ Gesture detection — MediaPipe hand tracking + FIST/OPEN_PALM recognition |
| **Day 2** | Three.js arena — 3D scene, lighting, player presence |
| **Day 3** | Gesture → attack mapping — shockwave VFX, energy shield |
| **Day 4** | AI enemies — Claude-driven adaptive combat behavior |
| **Day 5** | Voice commands + polish — Web Speech API, sound, particles |

## License

MIT
