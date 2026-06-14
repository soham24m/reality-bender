/**
 * main.js — Reality Bender entry point
 *
 * Connects MediaPipe FaceMesh → expression analysis → rubber face warp
 * and drives the bottom-left glass pill UI.
 */

import { startCamera }     from './vision/camera.js';
import { startFaceTracking } from './vision/face.js';
import { initRubberFace, updateRubberFace } from './effects/rubberFace.js';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const video      = document.getElementById('webcam');
const trackDot   = document.getElementById('trackDot');
const pillAction = document.getElementById('pillAction');
const pillStatus = document.getElementById('pillStatus');
const glassPill  = document.getElementById('glassPill');

// ─── State ────────────────────────────────────────────────────────────────────
let lastLandmarks        = null;
let lastExpressions      = {};
let faceDetectedAt       = 0;
const FACE_TIMEOUT_MS    = 1500;

let pillUpdateTimer      = null;
let pendingAction        = null;

// ─── Expression → display label ───────────────────────────────────────────────
const ACTION_LABELS = {
    'HEAD_TILT_RIGHT':  'Cheek stretch right',
    'HEAD_TILT_LEFT':   'Cheek stretch left',
    'MOUTH_OPEN':       'Mouth open',
    'JAW_DROP':         'Jaw drop',
    'LEFT_BROW_RAISE':  'Left brow raise',
    'RIGHT_BROW_RAISE': 'Right brow raise',
    'BOTH_BROWS_RAISE': 'Brows raised',
    'SMILE':            'Smiling',
    'FROWN':            'Frowning',
    'BROWS_FURROW':     'Brows furrowed',
    'LIP_PURSE':        'Lip purse',
    'CHEEK_PUFF':       'Cheek puff',
    'NOSE_SCRUNCH':     'Nose scrunch',
    'LEFT_WINK':        'Left wink',
    'RIGHT_WINK':       'Right wink',
    'BOTH_BLINK':       'Blinking',
    'HEAD_NOD_DOWN':    'Nodding down',
    'HEAD_NOD_UP':      'Nodding up',
};

// Priority order — only the highest-confidence one is shown at a time
const PRIORITY = [
    'JAW_DROP', 'BOTH_BROWS_RAISE', 'LEFT_WINK', 'RIGHT_WINK', 'BOTH_BLINK',
    'CHEEK_PUFF', 'HEAD_TILT_RIGHT', 'HEAD_TILT_LEFT', 'MOUTH_OPEN',
    'SMILE', 'FROWN', 'BROWS_FURROW', 'LEFT_BROW_RAISE', 'RIGHT_BROW_RAISE',
    'LIP_PURSE', 'NOSE_SCRUNCH', 'HEAD_NOD_DOWN', 'HEAD_NOD_UP',
];

const CONFIDENCE_THRESHOLD = 0.25;

// ─── Pill UI ──────────────────────────────────────────────────────────────────
function pickTopExpression(exprs) {
    for (const key of PRIORITY) {
        if ((exprs[key] || 0) >= CONFIDENCE_THRESHOLD) return key;
    }
    return null;
}

function setPillAction(text) {
    // Crossfade: fade out → update → fade in
    glassPill.classList.add('transitioning');
    setTimeout(() => {
        pillAction.textContent = text;
        glassPill.classList.remove('transitioning');
    }, 150);
}

function setTracking(active) {
    if (active) {
        trackDot.classList.add('active');
        pillStatus.textContent = 'tracking';
    } else {
        trackDot.classList.remove('active');
        pillStatus.textContent = 'searching...';
        setPillAction('Ready');
    }
}

// ─── Face expression handler ──────────────────────────────────────────────────
function handleFaceExpression({ type, confidence, landmarks, timestamp }) {
    lastLandmarks   = landmarks;
    faceDetectedAt  = performance.now();

    // Accumulate the expressions map (single frame burst of events)
    lastExpressions[type] = confidence;

    // Decay others a tiny bit so stale readings don't linger
    for (const key of Object.keys(lastExpressions)) {
        if (key !== type) lastExpressions[key] *= 0.85;
        if (lastExpressions[key] < 0.05) delete lastExpressions[key];
    }

    // Pick the most prominent and update pill
    const top = pickTopExpression(lastExpressions);
    if (top) {
        const label = ACTION_LABELS[top] || top.toLowerCase().replace(/_/g, ' ');
        if (pillAction.textContent !== label) {
            setPillAction(label);
        }
    }

    // Mark tracking active
    setTracking(true);
}

// ─── Render loop ─────────────────────────────────────────────────────────────
function tick() {
    const now = performance.now();
    const isFaceTracked = lastLandmarks && (now - faceDetectedAt < FACE_TIMEOUT_MS);

    if (isFaceTracked) {
        setTracking(true);
        updateRubberFace(lastLandmarks, lastExpressions);
    } else {
        setTracking(false);
        // Pass null so rubberFace clears the canvas → video shows through
        updateRubberFace(null, {});
    }

    requestAnimationFrame(tick);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
    try {
        console.log('[main] Starting Reality Bender...');

        const camVideo = await startCamera(video);
        console.log('[main] Camera online');

        // Init rubber face warp engine
        initRubberFace(camVideo);
        console.log('[main] Rubber face engine ready');

        // Start MediaPipe FaceMesh streaming
        startFaceTracking(camVideo, handleFaceExpression);
        console.log('[main] Face tracking started');

        // Start 60fps loop
        requestAnimationFrame(tick);

        console.log('[main] Ready. Console will log expressions as they\'re detected.');
    } catch (err) {
        console.error('[main] Boot failed:', err);
        pillAction.textContent = 'Camera error';
        pillStatus.textContent = err.message;
    }
}

init();
