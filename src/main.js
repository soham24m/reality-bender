/**
 * main.js — Reality Bender entry point
 *
 * Boots the webcam, starts hand tracking, and renders the
 * detected gesture onto the full-screen canvas HUD.
 */

import { startCamera }       from './vision/camera.js';
import { startHandTracking } from './vision/gestures.js';

// ─── DOM refs ────────────────────────────────────────────────────────
const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const video   = document.getElementById('webcam');
const loading = document.getElementById('loading');

// ─── State ───────────────────────────────────────────────────────────
let currentGesture  = null;
let lastGesture     = null;
let lastGestureTime = 0;
const COOLDOWN_MS   = 500; // same gesture can't fire twice within 500ms

// ─── Canvas sizing ───────────────────────────────────────────────────
function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ─── HUD render ──────────────────────────────────────────────────────

/** Draws the current gesture + a subtle vignette on the canvas. */
function drawHUD() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dark vignette background
    const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.2,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.9
    );
    gradient.addColorStop(0, 'rgba(10, 10, 15, 0)');
    gradient.addColorStop(1, 'rgba(10, 10, 15, 0.6)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Gesture label — top-left
    if (currentGesture) {
        // Glow effect
        ctx.shadowColor = currentGesture === 'FIST' ? '#ff4444' : '#44bbff';
        ctx.shadowBlur  = 16;

        ctx.font      = 'bold 28px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`⚡ ${currentGesture}`, 32, 48);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur  = 0;
    }

    // Status line — bottom-left
    ctx.font      = '14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('REALITY BENDER — Day 1: Gesture Detection', 32, canvas.height - 24);

    requestAnimationFrame(drawHUD);
}

// ─── Gesture callback ────────────────────────────────────────────────

/**
 * Fires when MediaPipe detects a gesture.
 * Applies a 500ms cooldown so the same gesture doesn't spam.
 */
function onGestureDetected(gesture) {
    const now = performance.now();

    if (gesture === lastGesture && now - lastGestureTime < COOLDOWN_MS) {
        return; // cooldown active — skip
    }

    lastGesture     = gesture;
    lastGestureTime = now;
    currentGesture  = gesture;

    // Day 1 spec: log SHOCKWAVE when fist is detected
    if (gesture === 'FIST') {
        console.log('%c💥 SHOCKWAVE', 'color: #ff4444; font-size: 18px; font-weight: bold;');
    } else {
        console.log(`[gesture] ${gesture}`);
    }
}

// ─── Boot sequence ───────────────────────────────────────────────────

async function boot() {
    try {
        console.log('[main] Booting Reality Bender…');

        // 1. Start webcam
        await startCamera(video);
        console.log('[main] Camera ready');

        // 2. Start hand tracking
        startHandTracking(video, onGestureDetected);

        // 3. Hide loading screen
        loading.classList.add('hidden');
        setTimeout(() => loading.remove(), 600);

        // 4. Start render loop
        requestAnimationFrame(drawHUD);

        console.log('[main] Reality Bender online ✓');
    } catch (err) {
        console.error('[main] Boot failed:', err.message);
        loading.querySelector('span').textContent =
            `⚠ ${err.message}`;
    }
}

boot();
