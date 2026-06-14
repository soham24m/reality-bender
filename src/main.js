import { startFaceTracking } from './vision/face.js';
import { 
    initDeformation, 
    updateDeformation, 
    setDeformationMode 
} from './vision/deformation.js';
import { startCamera } from './vision/camera.js';

// DOM Elements
const video = document.getElementById('webcam');
const deformationCanvas = document.getElementById('deformationCanvas');
const statusDot = document.getElementById('statusDot');
const expressionText = document.getElementById('expressionText');
const fpsCounter = document.getElementById('fpsCounter');
const effectPill = document.getElementById('effectPill');

// State
let lastLandmarks = null;
let lastExpressions = {};
let lastFaceDetectionTime = 0;
let flashTimeout = null;
let pillTimeout = null;

// FPS counter variables
let frameCount = 0;
let lastFpsTime = performance.now();

// Adjust canvas scale dynamically
function resizeCanvas() {
    deformationCanvas.width = window.innerWidth;
    deformationCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/**
 * Maps expressions to user-friendly effect names
 */
const EFFECT_NAMES = {
    'SMILE': 'Mouth Pull',
    'FROWN': 'Mouth Sad Pull',
    'MOUTH_OPEN': 'Mouth Expansion',
    'MOUTH_CLOSED': 'Lips Sealed',
    'LIP_PURSE': 'Lip Purse Warping',
    'JAW_DROP': 'Dramatic Jaw Stretch',
    'LEFT_WINK': 'Left Eye Wink',
    'RIGHT_WINK': 'Right Eye Wink',
    'BOTH_BLINK': 'Double Blink Mode',
    'LEFT_BROW_RAISE': 'Left Brow Lift',
    'RIGHT_BROW_RAISE': 'Right Brow Lift',
    'BOTH_BROWS_RAISE': 'Double Brow Lift',
    'BROWS_FURROW': 'Forehead Compression',
    'HEAD_TILT_LEFT': 'Face Left Stretch',
    'HEAD_TILT_RIGHT': 'Face Right Stretch',
    'HEAD_NOD_DOWN': 'Nod Down Distortion',
    'HEAD_NOD_UP': 'Nod Up Distortion',
    'CHEEK_PUFF': 'Radial Cheek Expansion',
    'NOSE_SCRUNCH': 'Nose Bridge Compression'
};

/**
 * Handle incoming face expression data
 */
function handleFaceExpression(event) {
    const { type, confidence, landmarks, timestamp } = event;
    
    lastLandmarks = landmarks;
    lastFaceDetectionTime = timestamp;
    lastExpressions[type] = confidence;

    // Trigger visual dot flash (200ms white flash)
    if (confidence > 0.6) {
        statusDot.classList.add('flash');
        if (flashTimeout) clearTimeout(flashTimeout);
        flashTimeout = setTimeout(() => {
            statusDot.classList.remove('flash');
        }, 200);

        // Update Dock text
        expressionText.textContent = `${type} (${Math.round(confidence * 100)}%)`;

        // Update effect name floating pill
        const effectName = EFFECT_NAMES[type] || type;
        effectPill.textContent = effectName;
        effectPill.classList.add('visible');

        // Reset pill fade-out timer
        if (pillTimeout) clearTimeout(pillTimeout);
        pillTimeout = setTimeout(() => {
            effectPill.classList.remove('visible');
        }, 2000);
    }
}

/**
 * Animation loop to run spring physics and canvas rendering at 60 FPS
 */
function tick(timestamp) {
    // 1. Calculate FPS
    frameCount++;
    const elapsed = timestamp - lastFpsTime;
    if (elapsed >= 1000) {
        const fps = Math.round((frameCount * 1000) / elapsed);
        fpsCounter.textContent = `${fps} fps`;
        frameCount = 0;
        lastFpsTime = timestamp;
    }

    // 2. Check if face is actively tracked (received message in last 1.5 seconds)
    const isFaceTracked = lastLandmarks && (performance.now() - lastFaceDetectionTime < 1500);

    if (isFaceTracked) {
        statusDot.classList.add('active');
        
        // Feed deformation engine with current physics target and coefficients
        updateDeformation(lastLandmarks, lastExpressions);
        
        // Decay continuous expressions slightly so they return to rest if not refreshed
        Object.keys(lastExpressions).forEach(key => {
            lastExpressions[key] *= 0.85; 
            if (lastExpressions[key] < 0.05) delete lastExpressions[key];
        });
    } else {
        statusDot.classList.remove('active');
        expressionText.textContent = 'No face detected';
        
        // Run deformation with empty expressions so mesh relaxes to natural neutral state
        if (lastLandmarks) {
            updateDeformation(lastLandmarks, {});
        }
    }

    requestAnimationFrame(tick);
}

// Bootstrap flow
async function init() {
    try {
        console.log('[main] Starting Apple Liquid Glass UI and Deformation Engine...');
        
        // 1. Access user's camera
        const camVideo = await startCamera(video);
        
        // 2. Initialize deformation renderer
        initDeformation(camVideo, deformationCanvas);
        
        // Support switching render modes with 1, 2, 3 hotkeys
        window.addEventListener('keydown', (e) => {
            if (e.key === '1') {
                setDeformationMode('NATURAL');
                console.log('Rendering: NATURAL');
            } else if (e.key === '2') {
                setDeformationMode('WIREFRAME');
                console.log('Rendering: WIREFRAME');
            } else if (e.key === '3') {
                setDeformationMode('GHOST');
                console.log('Rendering: GHOST');
            }
        });

        // 3. Start high-frequency MediaPipe FaceMesh stream
        startFaceTracking(camVideo, handleFaceExpression);

        // 4. Start 60fps game loop
        requestAnimationFrame(tick);

        console.log('[main] Deformation system initialized successfully.');
    } catch (err) {
        console.error('[main] Boot failed:', err);
    }
}

init();
