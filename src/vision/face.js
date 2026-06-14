/**
 * face.js — Expanded Facial Expression Detection with MediaPipe FaceMesh
 * 
 * Continuous expressions stream every frame with a confidence score [0.0 - 1.0].
 * Discrete expressions (blinks, winks, nods) trigger once on activation with a cooldown.
 */

// Key FaceMesh Landmark Indices (from 468 landmarks)
// 1: Nose tip
// 10: Forehead
// 13: Upper lip (inner)
// 14: Lower lip (inner)
// 33: Left eye corner (outer)
// 61: Left mouth corner
// 70: Left eyebrow inner
// 116: Left cheek
// 145: Left eye bottom
// 152: Chin
// 159: Left eye top
// 263: Right eye corner (outer)
// 291: Right mouth corner
// 300: Right eyebrow inner
// 345: Right cheek
// 374: Right eye bottom
// 386: Right eye top
// 168: Nose bridge top

export function analyzeFace(landmarks) {
    if (!landmarks || landmarks.length === 0) return {};

    const expressions = {};

    // Helper to calculate Euclidean distance in 2D
    const dist2D = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

    // 1. SMILE
    const smileDist = dist2D(landmarks[61], landmarks[291]);
    // Base threshold: > 0.42. Max stretch: ~0.52.
    expressions['SMILE'] = Math.min(1.0, Math.max(0.0, (smileDist - 0.42) / 0.10));

    // 2. FROWN
    // Horizontal distance < 0.36 AND corners pulled downward
    const cornersY = (landmarks[61].y + landmarks[291].y) / 2;
    const mouthCenterY = (landmarks[13].y + landmarks[14].y) / 2;
    const isCornersDownward = cornersY > mouthCenterY + 0.005;
    if (smileDist < 0.36 && isCornersDownward) {
        expressions['FROWN'] = Math.min(1.0, Math.max(0.0, (0.36 - smileDist) / 0.06));
    } else {
        expressions['FROWN'] = 0.0;
    }

    // 3. MOUTH_OPEN
    const mouthOpenDist = Math.abs(landmarks[13].y - landmarks[14].y);
    expressions['MOUTH_OPEN'] = Math.min(1.0, Math.max(0.0, (mouthOpenDist - 0.04) / 0.04));

    // 4. MOUTH_CLOSED
    expressions['MOUTH_CLOSED'] = Math.min(1.0, Math.max(0.0, (0.01 - mouthOpenDist) / 0.007));

    // 5. LIP_PURSE
    // Horizontal distance < 0.30 AND lips forward (z difference)
    const lipsZ = (landmarks[13].z + landmarks[14].z) / 2;
    const cornersZ = (landmarks[61].z + landmarks[291].z) / 2;
    const areLipsForward = lipsZ < cornersZ - 0.01; // Negative z is closer to camera
    if (smileDist < 0.30 && areLipsForward) {
        expressions['LIP_PURSE'] = Math.min(1.0, Math.max(0.0, (0.30 - smileDist) / 0.05));
    } else {
        expressions['LIP_PURSE'] = 0.0;
    }

    // 6. JAW_DROP
    expressions['JAW_DROP'] = Math.min(1.0, Math.max(0.0, (mouthOpenDist - 0.08) / 0.07));

    // Eye vertical distances for winks/blinks
    const leftEyeVert = Math.abs(landmarks[159].y - landmarks[145].y);
    const rightEyeVert = Math.abs(landmarks[386].y - landmarks[374].y);

    // 7. LEFT_WINK (Discrete)
    expressions['LEFT_WINK'] = (leftEyeVert < 0.01 && rightEyeVert > 0.02) ? 1.0 : 0.0;

    // 8. RIGHT_WINK (Discrete)
    expressions['RIGHT_WINK'] = (rightEyeVert < 0.01 && leftEyeVert > 0.02) ? 1.0 : 0.0;

    // 9. BOTH_BLINK (Discrete)
    expressions['BOTH_BLINK'] = (leftEyeVert < 0.01 && rightEyeVert < 0.01) ? 1.0 : 0.0;

    // Eyebrow raise calculations (y decreases upwards)
    const leftBrowRaise = landmarks[159].y - landmarks[70].y;
    const rightBrowRaise = landmarks[386].y - landmarks[300].y;

    // 10. LEFT_BROW_RAISE
    expressions['LEFT_BROW_RAISE'] = Math.min(1.0, Math.max(0.0, (leftBrowRaise - 0.04) / 0.03));

    // 11. RIGHT_BROW_RAISE
    expressions['RIGHT_BROW_RAISE'] = Math.min(1.0, Math.max(0.0, (rightBrowRaise - 0.04) / 0.03));

    // 12. BOTH_BROWS_RAISE
    expressions['BOTH_BROWS_RAISE'] = Math.min(1.0, Math.max(0.0, (Math.min(leftBrowRaise, rightBrowRaise) - 0.04) / 0.03));

    // 13. BROWS_FURROW
    const browDist = dist2D(landmarks[70], landmarks[300]);
    // Normal brow distance ~ 0.085. Furrow < 0.065
    expressions['BROWS_FURROW'] = Math.min(1.0, Math.max(0.0, (0.085 - browDist) / 0.025));

    // 14. HEAD_TILT_LEFT / HEAD_TILT_RIGHT
    const faceCenter = (landmarks[33].x + landmarks[263].x) / 2;
    const noseOffset = landmarks[1].x - faceCenter;
    // Offset > 0.08
    expressions['HEAD_TILT_RIGHT'] = Math.min(1.0, Math.max(0.0, (noseOffset - 0.08) / 0.08));
    expressions['HEAD_TILT_LEFT'] = Math.min(1.0, Math.max(0.0, (-noseOffset - 0.08) / 0.08));

    // 15. HEAD_NOD_DOWN / HEAD_NOD_UP (Discrete)
    const upperNoseDist = landmarks[1].y - landmarks[10].y;
    const lowerNoseDist = landmarks[152].y - landmarks[1].y;
    const nodRatio = upperNoseDist / lowerNoseDist;
    expressions['HEAD_NOD_DOWN'] = nodRatio > 1.35 ? 1.0 : 0.0;
    expressions['HEAD_NOD_UP'] = nodRatio < 0.90 ? 1.0 : 0.0;

    // 16. CHEEK_PUFF
    const cheekDist = dist2D(landmarks[116], landmarks[345]);
    // Normal cheek-to-cheek distance ~ 0.44. Expands to > 0.50
    expressions['CHEEK_PUFF'] = Math.min(1.0, Math.max(0.0, (cheekDist - 0.45) / 0.07));

    // 17. NOSE_SCRUNCH
    // Distance between bridge 168 and nose tip area. Compresses under scrunch.
    const noseScrunchDist = dist2D(landmarks[168], landmarks[1]);
    // Normal ~ 0.11. Compresses to < 0.08.
    expressions['NOSE_SCRUNCH'] = Math.min(1.0, Math.max(0.0, (0.11 - noseScrunchDist) / 0.035));

    return expressions;
}

export function startFaceTracking(videoElement, onExpression) {
    const faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    // Tracking discrete event cooldowns
    const discreteEvents = ['LEFT_WINK', 'RIGHT_WINK', 'BOTH_BLINK', 'HEAD_NOD_DOWN', 'HEAD_NOD_UP'];
    const cooldowns = {};
    const COOLDOWN_MS = 600;

    faceMesh.onResults((results) => {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return;
        }

        const landmarks = results.multiFaceLandmarks[0];
        const expressionScores = analyzeFace(landmarks);
        const now = Date.now();

        // 1. Process continuous and discrete expressions
        Object.entries(expressionScores).forEach(([type, confidence]) => {
            const isDiscrete = discreteEvents.includes(type);

            if (isDiscrete) {
                if (confidence > 0.7) {
                    const lastTime = cooldowns[type] || 0;
                    if (now - lastTime > COOLDOWN_MS) {
                        cooldowns[type] = now;
                        onExpression({
                            type,
                            confidence,
                            landmarks,
                            timestamp: now
                        });
                    }
                }
            } else {
                // Continuous expression: send every frame if confidence is above 0.1
                if (confidence > 0.1) {
                    onExpression({
                        type,
                        confidence,
                        landmarks,
                        timestamp: now
                    });
                }
            }
        });
    });

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await faceMesh.send({ image: videoElement });
        },
        width: 1280,
        height: 720
    });
    camera.start();
}
