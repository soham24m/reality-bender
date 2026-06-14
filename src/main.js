import { startCamera } from './vision/camera.js';
import { 
    startFullTracking, 
    currentHandsLandmarks, 
    currentFaceLandmarks, 
    currentPoseLandmarks 
} from './vision/tracker.js';
import { drawOverlay } from './vision/overlay.js';
import { addEvent, getRecentEvents, getSummary } from './ai/eventLog.js';

// DOM refs
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const video = document.getElementById('webcam');

// Adjust canvas scale dynamically
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Local active tracking states
let currentHandAction = null;
let currentFaceActions = [];
let currentPoseActions = [];

/**
 * Handle new incoming human interaction events
 */
function handleInteraction(event) {
    // 1. Log event into rolling memory
    addEvent(event);

    // 2. Log to developer console
    console.log(`[interaction] ${event.source} -> ${event.type}`);
    console.log(`Summary: ${getSummary()}`);

    // 3. Update active states with transient fade-outs
    if (event.source === 'HAND') {
        currentHandAction = event.type;
        setTimeout(() => {
            if (currentHandAction === event.type) currentHandAction = null;
        }, 1200);
    } else if (event.source === 'FACE') {
        if (!currentFaceActions.includes(event.type)) {
            currentFaceActions.push(event.type);
            // Eyebrow and eye events fade out, mouth closed/open is managed by face.js state
            setTimeout(() => {
                currentFaceActions = currentFaceActions.filter(a => a !== event.type);
            }, 800);
        }
    } else if (event.source === 'BODY') {
        if (!currentPoseActions.includes(event.type)) {
            currentPoseActions.push(event.type);
            setTimeout(() => {
                currentPoseActions = currentPoseActions.filter(a => a !== event.type);
            }, 1000);
        }
    }
}

/**
 * Animation loop to redraw screen components at 60fps
 */
function updateHUD() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw visual debug skeleton/dot overlays and rolling log panel
    drawOverlay(
        ctx,
        currentHandsLandmarks,
        currentFaceLandmarks,
        currentPoseLandmarks,
        getRecentEvents(5), // pass events from last 5 seconds
        currentHandAction,
        currentFaceActions,
        currentPoseActions
    );

    // Render active interactions in top-left with distinct color system
    let drawY = 50;

    // Green for Hands
    if (currentHandAction) {
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`⚡ [HAND] ${currentHandAction}`, 24, drawY);
        drawY += 36;
    }

    // Blue for Face
    currentFaceActions.forEach((action) => {
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = '#60a5fa';
        ctx.fillText(`⚡ [FACE] ${action}`, 24, drawY);
        drawY += 36;
    });

    // Orange for Body
    currentPoseActions.forEach((action) => {
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = '#fb923c';
        ctx.fillText(`⚡ [BODY] ${action}`, 24, drawY);
        drawY += 36;
    });

    requestAnimationFrame(updateHUD);
}

// Bootstrap flow
async function init() {
    try {
        console.log('[main] Starting Project Nexus tracking system...');
        const camVideo = await startCamera(video);
        
        // Hide loading panel
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }

        // Start single camera stream and feed to all models
        startFullTracking(camVideo, handleInteraction);

        // Run UI update loop
        requestAnimationFrame(updateHUD);

        console.log('[main] Nexus tracker online.');
    } catch (err) {
        console.error('[main] Boot failed:', err);
    }
}

init();
