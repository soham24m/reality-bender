/**
 * hands.js — Hand tracking and gesture recognition
 *
 * Detects 12 hand gestures:
 *   - FIST, OPEN_PALM, POINT, PINCH, PEACE, THUMBS_UP, THUMBS_DOWN,
 *     GUN_SHAPE, OK_SIGN, THREE_FINGERS, FOUR_FINGERS, CALL_ME
 *
 * Cooldown: 400ms per gesture.
 */

// Landmark constants
const THUMB_TIP = 4;
const THUMB_IP = 3;
const INDEX_TIP = 8;
const INDEX_PIP = 6;
const MIDDLE_TIP = 12;
const MIDDLE_PIP = 10;
const RING_TIP = 16;
const RING_PIP = 14;
const PINKY_TIP = 20;
const PINKY_PIP = 18;

function isExtended(landmarks, tipIdx, pipIdx) {
    return landmarks[tipIdx].y < landmarks[pipIdx].y;
}

/**
 * Classifies 21 hand landmarks into a specific gesture string or null.
 */
export function classifyHandGesture(landmarks) {
    if (!landmarks) return null;

    // Euclidean distance between thumb tip and index tip
    const dxThumbIndex = landmarks[THUMB_TIP].x - landmarks[INDEX_TIP].x;
    const dyThumbIndex = landmarks[THUMB_TIP].y - landmarks[INDEX_TIP].y;
    const distThumbIndex = Math.hypot(dxThumbIndex, dyThumbIndex);

    // Finger extensions
    const indexExtended = isExtended(landmarks, INDEX_TIP, INDEX_PIP);
    const middleExtended = isExtended(landmarks, MIDDLE_TIP, MIDDLE_PIP);
    const ringExtended = isExtended(landmarks, RING_TIP, RING_PIP);
    const pinkyExtended = isExtended(landmarks, PINKY_TIP, PINKY_PIP);

    // Thumb extension (check if thumb tip is further from wrist than thumb IP joint)
    const distTipWrist = Math.hypot(landmarks[THUMB_TIP].x - landmarks[0].x, landmarks[THUMB_TIP].y - landmarks[0].y);
    const distIPWrist = Math.hypot(landmarks[THUMB_IP].x - landmarks[0].x, landmarks[THUMB_IP].y - landmarks[0].y);
    const thumbExtended = distTipWrist > distIPWrist;

    // 1. OK_SIGN: Thumb and index finger touch in a circle, other three fingers extended
    if (distThumbIndex < 0.05 && middleExtended && ringExtended && pinkyExtended) {
        return 'OK_SIGN';
    }

    // 2. PINCH: Thumb and index finger are pinching (touching), others not all extended
    if (distThumbIndex < 0.05) {
        return 'PINCH';
    }

    // 3. CALL_ME: Thumb and pinky extended, other three curled
    if (thumbExtended && pinkyExtended && !indexExtended && !middleExtended && !ringExtended) {
        return 'CALL_ME';
    }

    // 4. GUN_SHAPE: Thumb and index extended, other three curled
    if (thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return 'GUN_SHAPE';
    }

    // 5. PEACE: Index and middle extended, ring and pinky curled
    if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
        return 'PEACE';
    }

    // 6. THREE_FINGERS: Index, middle, and ring extended, pinky curled
    if (indexExtended && middleExtended && ringExtended && !pinkyExtended) {
        return 'THREE_FINGERS';
    }

    // 7. FOUR_FINGERS: Index, middle, ring, pinky extended, thumb curled
    if (indexExtended && middleExtended && ringExtended && pinkyExtended && !thumbExtended) {
        return 'FOUR_FINGERS';
    }

    // 8. POINT: Only index finger extended
    if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return 'POINT';
    }

    // 9. THUMBS_UP: Thumb extended pointing upwards, other fingers curled
    if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended && landmarks[THUMB_TIP].y < landmarks[THUMB_IP].y) {
        return 'THUMBS_UP';
    }

    // 10. THUMBS_DOWN: Thumb extended pointing downwards, other fingers curled
    if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended && landmarks[THUMB_TIP].y > landmarks[THUMB_IP].y) {
        return 'THUMBS_DOWN';
    }

    // 11. FIST: All 4 fingers curled
    if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return 'FIST';
    }

    // 12. OPEN_PALM: All four fingers and thumb extended
    if (indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended) {
        return 'OPEN_PALM';
    }

    return null;
}

/**
 * Initializes and starts hand gesture tracking
 */
export function startHandTracking(videoElement, onGesture) {
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
    const COOLDOWN_MS = 400; // 400ms cooldown

    hands.onResults((results) => {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            return;
        }

        const landmarks = results.multiHandLandmarks[0];
        const gesture = classifyHandGesture(landmarks);

        if (gesture) {
            const now = performance.now();
            if (gesture !== lastGesture || (now - lastGestureTime >= COOLDOWN_MS)) {
                lastGesture = gesture;
                lastGestureTime = now;
                onGesture(gesture, landmarks); // pass landmarks for overlay drawing
            }
        }
    });

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 1280,
        height: 720
    });
    camera.start();
}
