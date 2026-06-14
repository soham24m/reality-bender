/**
 * tracker.js — Unified Human Interaction System Tracker
 *
 * Coordinates MediaPipe Hands, FaceMesh, and Pose in parallel
 * off a single webcam frame. Dispatches all events through
 * a unified interaction stream.
 */

import { classifyHandGesture } from './hands.js';
import { analyzeFace }         from './face.js';
import { analyzePose }         from './pose.js';

// Global references to landmarks updated on each frame (consumed by overlay)
export let currentHandsLandmarks = null;
export let currentFaceLandmarks  = null;
export let currentPoseLandmarks  = null;

/**
 * Starts simultaneously tracking hands, face, and pose.
 *
 * @param {HTMLVideoElement} videoElement — the webcam stream
 * @param {(event: Object) => void} onInteraction — callback for unified events
 */
export async function startFullTracking(videoElement, onInteraction) {
    console.log('[tracker] Initializing MediaPipe models...');

    // 1. Initialize Hands Model
    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.6
    });
    await hands.initialize();
    console.log("Hands ready");

    // 2. Initialize FaceMesh Model
    const faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    await faceMesh.initialize();
    console.log("Face ready");

    // 3. Initialize Pose Model
    const pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    await pose.initialize();
    console.log("Pose ready");

    // Cooldown states and past state lists
    let lastHandGesture = null;
    let lastHandGestureTime = 0;
    const HAND_COOLDOWN_MS = 400; // 400ms cooldown for hand gestures

    let lastFaceEvents = [];
    let lastPoseEvents = [];

    // --- OnResults Callback bindings ---
    hands.onResults((results) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            currentHandsLandmarks = results.multiHandLandmarks[0];
            const gesture = classifyHandGesture(currentHandsLandmarks);
            
            if (gesture) {
                const now = performance.now();
                if (gesture !== lastHandGesture || (now - lastHandGestureTime >= HAND_COOLDOWN_MS)) {
                    lastHandGesture = gesture;
                    lastHandGestureTime = now;
                    onInteraction({
                        type: gesture,
                        source: 'HAND',
                        confidence: 1.0,
                        timestamp: Date.now()
                    });
                }
            }
        } else {
            currentHandsLandmarks = null;
        }
    });

    faceMesh.onResults((results) => {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            currentFaceLandmarks = results.multiFaceLandmarks[0];
            const faceEvents = analyzeFace(currentFaceLandmarks);

            // Emit face events on change
            faceEvents.forEach((evt) => {
                if (!lastFaceEvents.includes(evt)) {
                    onInteraction({
                        type: evt,
                        source: 'FACE',
                        confidence: 1.0,
                        timestamp: Date.now()
                    });
                }
            });
            lastFaceEvents = faceEvents;
        } else {
            currentFaceLandmarks = null;
        }
    });

    pose.onResults((results) => {
        if (results.poseLandmarks && results.poseLandmarks.length > 0) {
            currentPoseLandmarks = results.poseLandmarks;
            const poseEvents = analyzePose(currentPoseLandmarks);

            // Emit pose events on change
            poseEvents.forEach((evt) => {
                if (!lastPoseEvents.includes(evt)) {
                    onInteraction({
                        type: evt,
                        source: 'BODY',
                        confidence: 1.0,
                        timestamp: Date.now()
                    });
                }
            });
            lastPoseEvents = poseEvents;
        } else {
            currentPoseLandmarks = null;
        }
    });

    // --- Start a single Camera feed in parallel ---
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            // Process the frame across all three models concurrently
            await Promise.all([
                hands.send({ image: videoElement }),
                faceMesh.send({ image: videoElement }),
                pose.send({ image: videoElement })
            ]);
        },
        width: 1280,
        height: 720
    });

    camera.start();
    console.log('[tracker] Unified multi-model camera pipeline is running');
}
