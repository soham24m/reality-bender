/**
 * gestures.js — Gesture detection via MediaPipe Hands
 *
 * Uses the global `Hands` class loaded from the MediaPipe CDN.
 * Detects two gestures:
 *   • FIST       — all fingertips curled below their base knuckles
 *   • OPEN_PALM  — all fingers fully extended
 *
 * Landmark indices (per MediaPipe hand model):
 *   Thumb:   tip=4,  ip=3,   mcp=2
 *   Index:   tip=8,  pip=6,  mcp=5
 *   Middle:  tip=12, pip=10, mcp=9
 *   Ring:    tip=16, pip=14, mcp=13
 *   Pinky:   tip=20, pip=18, mcp=17
 *
 * A finger is "curled" when its tip.y > its pip.y (lower on screen = higher y).
 * A finger is "extended" when its tip.y < its pip.y.
 * Thumb uses tip.x vs ip.x relative to wrist to handle left/right hands.
 */

// ─── Landmark index constants ────────────────────────────────────────
const THUMB_TIP  = 4;
const THUMB_IP   = 3;
const WRIST      = 0;

const FINGER_TIPS = [8, 12, 16, 20];   // index, middle, ring, pinky
const FINGER_PIPS = [6, 10, 14, 18];   // corresponding PIP joints

// ─── Gesture classification ─────────────────────────────────────────

/**
 * Determines if the thumb is curled.
 * Uses horizontal distance: thumb tip should be closer to wrist than thumb IP.
 */
function isThumbCurled(landmarks) {
    const tipX   = landmarks[THUMB_TIP].x;
    const ipX    = landmarks[THUMB_IP].x;
    const wristX = landmarks[WRIST].x;

    // Thumb is curled when its tip is closer to (or past) the wrist than its IP joint
    return Math.abs(tipX - wristX) < Math.abs(ipX - wristX);
}

/**
 * Determines if a non-thumb finger is curled.
 * A finger is curled when its tip is below (higher y) its PIP joint.
 */
function isFingerCurled(landmarks, tipIdx, pipIdx) {
    return landmarks[tipIdx].y > landmarks[pipIdx].y;
}

/**
 * Classify the current hand pose into a gesture string.
 * @param {Array} landmarks — 21 normalized landmarks from MediaPipe
 * @returns {string|null} — "FIST", "OPEN_PALM", or null (unrecognized)
 */
function classifyGesture(landmarks) {
    const thumbCurled = isThumbCurled(landmarks);

    // Check all four fingers
    const fingersCurled = FINGER_TIPS.every((tipIdx, i) =>
        isFingerCurled(landmarks, tipIdx, FINGER_PIPS[i])
    );
    const fingersExtended = FINGER_TIPS.every((tipIdx, i) =>
        !isFingerCurled(landmarks, tipIdx, FINGER_PIPS[i])
    );

    // FIST — everything curled
    if (thumbCurled && fingersCurled) {
        return 'FIST';
    }

    // OPEN_PALM — everything extended
    if (!thumbCurled && fingersExtended) {
        return 'OPEN_PALM';
    }

    return null; // gesture not recognized
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Starts continuous hand tracking on the given video element.
 *
 * @param {HTMLVideoElement} videoElement — live webcam feed
 * @param {(gesture: string) => void} onGestureDetected — callback fired with gesture name
 */
export function startHandTracking(videoElement, onGestureDetected) {
    // `Hands` is loaded globally via CDN <script> in index.html
    const hands = new Hands({
        locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,            // single hand for now
        modelComplexity: 1,        // balanced accuracy/speed
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.6
    });

    // Process results on each frame
    hands.onResults((results) => {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            return; // no hand in frame
        }

        const landmarks = results.multiHandLandmarks[0];
        const gesture = classifyGesture(landmarks);

        if (gesture) {
            onGestureDetected(gesture);
        }
    });

    // Use MediaPipe's Camera utility to feed frames to the Hands model
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 1280,
        height: 720
    });

    camera.start();
    console.log('[gestures] Hand tracking started');
}
