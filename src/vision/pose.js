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

export function analyzePose(landmarks) {
    if (!landmarks || landmarks.length === 0) return [];

    const events = [];

    const leftWrist = landmarks[L_WRIST];
    const rightWrist = landmarks[R_WRIST];
    const leftShoulder = landmarks[L_SHOULDER];
    const rightShoulder = landmarks[R_SHOULDER];
    const leftHip = landmarks[L_HIP];
    const rightHip = landmarks[R_HIP];

    // Ensure all critical landmarks exist
    if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder || !leftHip || !rightHip) {
        return [];
    }

    // 1. Arms Raised (both wrist y values are higher on screen than shoulders)
    // Remember: y coordinate decreases as you go up
    if (leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y) {
        events.push('ARMS_RAISED');
    }

    // 2. Left Punch (Left wrist extended horizontally/vertically and depth z is closer to camera)
    const leftArmDist = Math.hypot(leftWrist.x - leftShoulder.x, leftWrist.y - leftShoulder.y);
    if (leftArmDist > 0.35 && leftWrist.z < leftShoulder.z - 0.22) {
        events.push('LEFT_PUNCH');
    }

    // 3. Right Punch (Right wrist extended and depth z is closer to camera)
    const rightArmDist = Math.hypot(rightWrist.x - rightShoulder.x, rightWrist.y - rightShoulder.y);
    if (rightArmDist > 0.35 && rightWrist.z < rightShoulder.z - 0.22) {
        events.push('RIGHT_PUNCH');
    }

    // 4. Crouch (Hips drop below y = 0.72)
    const hipsY = (leftHip.y + rightHip.y) / 2;
    if (hipsY > 0.72) {
        events.push('CROUCH');
    }

    // 5. Lean Left & Lean Right (Based on midpoint of shoulders relative to center x = 0.5)
    const shoulderMidpointX = (leftShoulder.x + rightShoulder.x) / 2;
    // Mirrored coordinates check
    if (shoulderMidpointX < 0.44) {
        events.push('LEAN_LEFT');
    } else if (shoulderMidpointX > 0.56) {
        events.push('LEAN_RIGHT');
    }

    return events;
}

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

    let lastEvents = [];

    pose.onResults((results) => {
        if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
            return;
        }

        const landmarks = results.poseLandmarks;
        const currentEvents = analyzePose(landmarks);

        currentEvents.forEach(evt => {
            if (!lastEvents.includes(evt)) {
                onPoseEvent(evt, landmarks);
            }
        });

        lastEvents = currentEvents;
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
