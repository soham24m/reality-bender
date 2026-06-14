import { startCamera }       from './vision/camera.js';
import { startHandTracking } from './vision/gestures.js';

// Get DOM elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const video = document.getElementById('webcam');

// Adjust canvas dimensions to match viewport size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/**
 * Handles detected gestures by logging them to the console and
 * drawing the gesture name on the canvas.
 */
function handleGesture(gesture) {
    // Log gesture to console
    console.log(`[gesture] ${gesture}`);

    // Clear previous text by clearing the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the gesture name on the top-left corner
    // White text, 28px, monospace font
    ctx.font = '28px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(gesture, 20, 50);
}

// Initialize the project on load
async function init() {
    try {
        console.log('[main] Booting reality-bender...');
        
        // 1. Call startCamera and get the video element
        const camVideo = await startCamera(video);
        
        // Hide loading indicator if it exists
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }

        // 2. Pass the video element to startHandTracking
        startHandTracking(camVideo, handleGesture);

        console.log('[main] Reality Bender active.');
    } catch (err) {
        console.error('[main] Boot failed:', err);
    }
}

init();
