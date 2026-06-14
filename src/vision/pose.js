/**
 * pose.js — Pose tracking and body movement detection
 *
 * Detects:
 *   - ARMS_RAISED (both arms above shoulders)
 *   - LEFT_PUNCH (left wrist extended forward and far from left shoulder)
 *   - RIGHT_PUNCH (right wrist extended forward and far from right shoulder)
 *   - CROUCH (hips drop low on the screen)
 *   - LEAN_LEFT / LEAN_RIGHT (body centerline leans away from center)
 */

// Key Pose landmark indices
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_WRIST = 15;
const R_WRIST = 16;
const L_HIP = 23;
const R_HIP = 24;

let armsRaisedFrames = 0;

export function analyzePose(landmarks) {
    if (!landmarks || landmarks.length === 0) return [];

    const events = [];

    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder || !leftHip || !rightHip) {
        return [];
    }

    // BOTH_ARMS_RAISED: Both wrists y position above both shoulders y position
    // Trigger when true for 3 consecutive frames
    if (leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y) {
        armsRaisedFrames++;
        if (armsRaisedFrames >= 3) {
            events.push('BOTH_ARMS_RAISED');
        }
    } else {
        armsRaisedFrames = 0;
    }

    // LEFT_PUNCH: Left wrist x is significantly to the right of left shoulder x
    // Left wrist y is near shoulder height
    if (leftWrist.x > leftShoulder.x + 0.1 && Math.abs(leftWrist.y - leftShoulder.y) < 0.15) {
        events.push('LEFT_PUNCH');
    }

    // RIGHT_PUNCH: Right wrist x is significantly to the left of right shoulder x
    // Right wrist y is near shoulder height
    if (rightWrist.x < rightShoulder.x - 0.1 && Math.abs(rightWrist.y - rightShoulder.y) < 0.15) {
        events.push('RIGHT_PUNCH');
    }

    // LEAN_LEFT: Shoulder midpoint x shifts left from center by more than 0.15
    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
    if (shoulderMidX < 0.35) { // 0.5 - 0.15
        events.push('LEAN_LEFT');
    } 
    // LEAN_RIGHT: Same but right
    else if (shoulderMidX > 0.65) { // 0.5 + 0.15
        events.push('LEAN_RIGHT');
    }

    // CROUCH: Hip landmarks y value drops below a threshold compared to shoulder landmarks
    // (e.g., hips and shoulders get closer together vertically)
    const hipsY = (leftHip.y + rightHip.y) / 2;
    const shouldersY = (leftShoulder.y + rightShoulder.y) / 2;
    if (Math.abs(hipsY - shouldersY) < 0.25) {
        events.push('CROUCH');
    }

    return events;
}

let poseCooldowns = {};

export function startPoseTracking(videoElement, onPoseEvent) {
    const pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults((results) => {
        if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
            return;
        }

        const landmarks = results.poseLandmarks;
        const currentEvents = analyzePose(landmarks);
        const now = performance.now();

        currentEvents.forEach(evt => {
            const lastTime = poseCooldowns[evt] || 0;
            if (now - lastTime > 500) { // 500ms cooldown
                console.log(`[Pose Event] ${evt}`);
                onPoseEvent(evt, landmarks);
                poseCooldowns[evt] = now;
            }
        });
    });

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await pose.send({ image: videoElement });
        },
        width: 1280,
        height: 720
    });
    camera.start();
}
