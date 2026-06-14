/**
 * gestures.js — Gesture detection via MediaPipe Hands
 *
 * Uses the global `Hands` class loaded from the MediaPipe CDN.
 * Detects four gestures:
 *   • FIST       — all 4 fingertips curled below their PIP joints
 *   • OPEN_PALM  — all 4 fingertips extended above their PIP joints
 *   • POINT      — only the index fingertip is extended above its PIP joint
 *   • PINCH      — the distance between thumb tip and index tip is less than 0.05
 *
 * Landmark indices (per MediaPipe hand model):
 *   Thumb:   tip=4,  ip=3,   mcp=2
 *   Index:   tip=8,  pip=6,  mcp=5
 *   Middle:  tip=12, pip=10, mcp=9
 *   Ring:    tip=16, pip=14, mcp=13
 *   Pinky:   tip=20, pip=18, mcp=17
 *
 * Coordinates are normalized (0 to 1). The y-coordinate increases downwards,
 * so "above" means a smaller y-value and "below" means a larger y-value.
 */

// Landmark index constants
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const INDEX_PIP = 6;
const MIDDLE_TIP = 12;
const MIDDLE_PIP = 10;
const RING_TIP = 16;
const RING_PIP = 14;
const PINKY_TIP = 20;
const PINKY_PIP = 18;

/**
 * Helper to check if a finger is extended (tip is above PIP joint).
 */
function isExtended(landmarks, tipIdx, pipIdx) {
    return landmarks[tipIdx].y < landmarks[pipIdx].y;
}

/**
 * Classify the hand Pose landmarks into a gesture.
 * Checks for PINCH, POINT, FIST, and OPEN_PALM.
 */
function classifyGesture(landmarks) {
    // 1. PINCH Detection: Measure 2D Euclidean distance between thumb tip and index tip.
    // If distance is less than 0.05, it is classified as a PINCH.
    const dx = landmarks[THUMB_TIP].x - landmarks[INDEX_TIP].x;
    const dy = landmarks[THUMB_TIP].y - landmarks[INDEX_TIP].y;
    const pinchDistance = Math.hypot(dx, dy);

    if (pinchDistance < 0.05) {
        return 'PINCH';
    }

    // Check extension state of the four non-thumb fingers
    const indexExtended = isExtended(landmarks, INDEX_TIP, INDEX_PIP);
    const middleExtended = isExtended(landmarks, MIDDLE_TIP, MIDDLE_PIP);
    const ringExtended = isExtended(landmarks, RING_TIP, RING_PIP);
    const pinkyExtended = isExtended(landmarks, PINKY_TIP, PINKY_PIP);

    // 2. POINT Detection: Only the index finger is extended, and middle, ring, pinky are curled.
    if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return 'POINT';
    }

    // 3. FIST Detection: All four fingers (index, middle, ring, pinky) are curled (not extended).
    if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return 'FIST';
    }

    // 4. OPEN_PALM Detection: All four fingers (index, middle, ring, pinky) are extended.
    if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
        return 'OPEN_PALM';
    }

    return null; // unrecognized gesture
}

/**
 * Starts continuous hand tracking on the given video element.
 *
 * @param {HTMLVideoElement} videoElement — live webcam feed
 * @param {(gesture: string) => void} onGestureDetected — callback fired with gesture name
 */
export function startHandTracking(videoElement, onGestureDetected) {
    // `Hands` and `Camera` are loaded globally via CDNs in index.html
    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.6
    });

    let lastGesture = null;
    let lastGestureTime = 0;
    const COOLDOWN_MS = 500;

    // Process hand landmarks on each frame
    hands.onResults((results) => {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            return; // no hand detected in the current frame
        }

        const landmarks = results.multiHandLandmarks[0];
        const gesture = classifyGesture(landmarks);

        if (gesture) {
            const now = performance.now();
            // Fire if the gesture has changed, or if 500ms cooldown has elapsed for the same gesture
            if (gesture !== lastGesture || (now - lastGestureTime >= COOLDOWN_MS)) {
                lastGesture = gesture;
                lastGestureTime = now;
                onGestureDetected(gesture);
            }
        }
    });

    // Feed frames from the webcam video element into the hands model
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 1280,
        height: 720
    });

    camera.start();
    console.log('[gestures] MediaPipe Hands tracking started');
}
