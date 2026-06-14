/**
 * face.js — FaceMesh tracking and facial gesture/pose detection
 *
 * Detects:
 *   - MOUTH_OPEN / MOUTH_CLOSED
 *   - SMILE
 *   - LEFT_EYEBROW_RAISE
 *   - RIGHT_EYEBROW_RAISE
 *   - BLINK
 *   - HEAD_TILT_LEFT / HEAD_TILT_RIGHT
 *   - HEAD_NOD_UP / HEAD_NOD_DOWN
 */

// Key Landmark indices
const NOSE_TIP = 4;
const FOREHEAD = 10;
const CHIN = 152;
const MOUTH_TOP_INNER = 13;
const MOUTH_BOTTOM_INNER = 14;
const MOUTH_CORNER_LEFT = 61;
const MOUTH_CORNER_RIGHT = 291;

const EYE_L_TOP = 159;
const EYE_L_BOTTOM = 145;
const EYE_L_LEFT = 33;
const EYE_L_RIGHT = 133;
const EYEBROW_L = 70;

const EYE_R_TOP = 386;
const EYE_R_BOTTOM = 374;
const EYE_R_LEFT = 362;
const EYE_R_RIGHT = 263;
const EYEBROW_R = 300;

export function analyzeFace(landmarks) {
    if (!landmarks || landmarks.length === 0) return [];

    const events = [];

    // 1. Mouth Open vs Closed
    const mouthVert = Math.hypot(landmarks[MOUTH_TOP_INNER].x - landmarks[MOUTH_BOTTOM_INNER].x, landmarks[MOUTH_TOP_INNER].y - landmarks[MOUTH_BOTTOM_INNER].y);
    const mouthHoriz = Math.hypot(landmarks[MOUTH_CORNER_LEFT].x - landmarks[MOUTH_CORNER_RIGHT].x, landmarks[MOUTH_CORNER_LEFT].y - landmarks[MOUTH_CORNER_RIGHT].y);
    const mouthRatio = mouthVert / mouthHoriz;
    
    if (mouthRatio > 0.25) {
        events.push('MOUTH_OPEN');
    } else {
        events.push('MOUTH_CLOSED');
    }

    // 2. Smile Detection
    const mouthCenterY = (landmarks[MOUTH_TOP_INNER].y + landmarks[MOUTH_BOTTOM_INNER].y) / 2;
    const leftSmileDiff = mouthCenterY - landmarks[MOUTH_CORNER_LEFT].y;
    const rightSmileDiff = mouthCenterY - landmarks[MOUTH_CORNER_RIGHT].y;
    // Positive difference means corners are higher than center (y increases downwards)
    if (leftSmileDiff > 0.007 && rightSmileDiff > 0.007) {
        events.push('SMILE');
    }

    // 3. Eyebrow Raises
    const leftEyebrowDist = landmarks[EYE_L_TOP].y - landmarks[EYEBROW_L].y;
    const rightEyebrowDist = landmarks[EYE_R_TOP].y - landmarks[EYEBROW_R].y;
    
    if (leftEyebrowDist > 0.042) {
        events.push('LEFT_EYEBROW_RAISE');
    }
    if (rightEyebrowDist > 0.042) {
        events.push('RIGHT_EYEBROW_RAISE');
    }

    // 4. Blink Detection (Eye Aspect Ratio EAR)
    const earL = Math.hypot(landmarks[EYE_L_TOP].x - landmarks[EYE_L_BOTTOM].x, landmarks[EYE_L_TOP].y - landmarks[EYE_L_BOTTOM].y) / 
                 Math.hypot(landmarks[EYE_L_LEFT].x - landmarks[EYE_L_RIGHT].x, landmarks[EYE_L_LEFT].y - landmarks[EYE_L_RIGHT].y);
    const earR = Math.hypot(landmarks[EYE_R_TOP].x - landmarks[EYE_R_BOTTOM].x, landmarks[EYE_R_TOP].y - landmarks[EYE_R_BOTTOM].y) / 
                 Math.hypot(landmarks[EYE_R_LEFT].x - landmarks[EYE_R_RIGHT].x, landmarks[EYE_R_LEFT].y - landmarks[EYE_R_RIGHT].y);
    
    if (earL < 0.125 && earR < 0.125) {
        events.push('BLINK');
    }

    // 5. Head Tilt Angle (using eye corners)
    const eyeDx = landmarks[EYE_R_RIGHT].x - landmarks[EYE_L_LEFT].x;
    const eyeDy = landmarks[EYE_R_RIGHT].y - landmarks[EYE_L_LEFT].y;
    const tiltAngle = Math.atan2(eyeDy, eyeDx);
    
    if (tiltAngle > 0.09) {
        events.push('HEAD_TILT_RIGHT');
    } else if (tiltAngle < -0.09) {
        events.push('HEAD_TILT_LEFT');
    }

    // 6. Head Nod Up / Down (ratio of upper nose-to-forehead vs lower nose-to-chin)
    const upperNoseDist = landmarks[NOSE_TIP].y - landmarks[FOREHEAD].y;
    const lowerNoseDist = landmarks[CHIN].y - landmarks[NOSE_TIP].y;
    const nodRatio = upperNoseDist / lowerNoseDist;

    if (nodRatio > 1.35) {
        events.push('HEAD_NOD_DOWN');
    } else if (nodRatio < 0.95) {
        events.push('HEAD_NOD_UP');
    }

    return events;
}

export function startFaceTracking(videoElement, onFaceEvent) {
    const faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    let lastEvents = [];

    faceMesh.onResults((results) => {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return;
        }

        const landmarks = results.multiFaceLandmarks[0];
        const currentEvents = analyzeFace(landmarks);

        // Fire events that are newly active
        currentEvents.forEach(evt => {
            if (!lastEvents.includes(evt)) {
                onFaceEvent(evt, landmarks);
            }
        });

        lastEvents = currentEvents;
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
