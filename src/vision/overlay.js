/**
 * overlay.js — Real-time visual overlay helper
 *
 * Draws semi-transparent dots, skeletal lines, and active state labels
 * on the canvas layer, adjusted to align with the mirrored video.
 */

// Hand connections
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17]
];

// Key face landmarks (subset of 468)
const FACE_KEY_LANDMARKS = [
    33, 133, 159, 145,      // left eye key points
    263, 362, 386, 374,    // right eye key points
    61, 291, 13, 14,       // mouth corners and lip center points
    4,                     // nose tip
    70,                    // left eyebrow
    300                    // right eyebrow
];

// Pose key landmarks
const POSE_KEY_LANDMARKS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26];

// Pose skeletal lines
const POSE_CONNECTIONS = [
    [11, 12],             // shoulder to shoulder
    [11, 13], [13, 15],   // left arm
    [12, 14], [14, 16],   // right arm
    [11, 23], [12, 24],   // shoulders to hips
    [23, 24],             // hip to hip
    [23, 25], [24, 26]    // hip to knee
];

/**
 * Converts a MediaPipe normalized landmark (0 to 1) into canvas coordinates.
 * Adjusts for mirrored x values (transform: scaleX(-1) in CSS video).
 */
function toCanvasCoords(landmark, width, height) {
    return {
        x: (1 - landmark.x) * width, // mirror mathematically
        y: landmark.y * height
    };
}

/**
 * Draws all debug elements onto the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx — Canvas context
 * @param {Array} handsLandmarks — 21 hand landmarks
 * @param {Array} faceLandmarks — 468 face landmarks
 * @param {Array} poseLandmarks — 33 pose landmarks
 * @param {Array} recentEvents — recent events array from EventLog
 * @param {String} currentHandAction — currently active hand gesture
 * @param {Array} currentFaceActions — currently active face events
 * @param {Array} currentPoseActions — currently active pose events
 */
export function drawOverlay(
    ctx,
    handsLandmarks,
    faceLandmarks,
    poseLandmarks,
    recentEvents,
    currentHandAction,
    currentFaceActions = [],
    currentPoseActions = []
) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // --- 1. Draw Hand Debug Overlay ---
    if (handsLandmarks) {
        // Draw skeletal lines
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)'; // semi-transparent green
        ctx.lineWidth = 3;
        HAND_CONNECTIONS.forEach(([start, end]) => {
            const pStart = toCanvasCoords(handsLandmarks[start], width, height);
            const pEnd = toCanvasCoords(handsLandmarks[end], width, height);
            ctx.beginPath();
            ctx.moveTo(pStart.x, pStart.y);
            ctx.lineTo(pEnd.x, pEnd.y);
            ctx.stroke();
        });

        // Draw landmark dots
        ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
        handsLandmarks.forEach((lm) => {
            const p = toCanvasCoords(lm, width, height);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Show active hand gesture above the hand
        if (currentHandAction) {
            const pWrist = toCanvasCoords(handsLandmarks[0], width, height);
            ctx.font = 'bold 20px monospace';
            ctx.fillStyle = '#4ade80'; // bright green
            ctx.fillText(currentHandAction, pWrist.x - 30, pWrist.y - 120);
        }
    }

    // --- 2. Draw Face Debug Overlay ---
    if (faceLandmarks) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.8)'; // semi-transparent blue
        FACE_KEY_LANDMARKS.forEach((idx) => {
            if (faceLandmarks[idx]) {
                const p = toCanvasCoords(faceLandmarks[idx], width, height);
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        // Show face event text near the nose tip
        if (currentFaceActions.length > 0) {
            const pNose = toCanvasCoords(faceLandmarks[4], width, height);
            ctx.font = 'bold 18px monospace';
            ctx.fillStyle = '#60a5fa'; // bright blue
            currentFaceActions.forEach((action, idx) => {
                ctx.fillText(action, pNose.x - 40, pNose.y - 50 - (idx * 22));
            });
        }
    }

    // --- 3. Draw Pose Debug Overlay ---
    if (poseLandmarks) {
        // Draw skeletal lines
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.4)'; // semi-transparent orange
        ctx.lineWidth = 4;
        POSE_CONNECTIONS.forEach(([start, end]) => {
            const pStart = toCanvasCoords(poseLandmarks[start], width, height);
            const pEnd = toCanvasCoords(poseLandmarks[end], width, height);
            ctx.beginPath();
            ctx.moveTo(pStart.x, pStart.y);
            ctx.lineTo(pEnd.x, pEnd.y);
            ctx.stroke();
        });

        // Draw landmark dots
        ctx.fillStyle = 'rgba(249, 115, 22, 0.8)';
        POSE_KEY_LANDMARKS.forEach((idx) => {
            if (poseLandmarks[idx]) {
                const p = toCanvasCoords(poseLandmarks[idx], width, height);
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        // Show active pose actions near body center
        if (currentPoseActions.length > 0) {
            const pLShoulder = toCanvasCoords(poseLandmarks[11], width, height);
            const pRShoulder = toCanvasCoords(poseLandmarks[12], width, height);
            const midX = (pLShoulder.x + pRShoulder.x) / 2;
            const midY = (pLShoulder.y + pRShoulder.y) / 2;
            
            ctx.font = 'bold 20px monospace';
            ctx.fillStyle = '#fb923c'; // bright orange
            currentPoseActions.forEach((action, idx) => {
                ctx.fillText(action, midX - 50, midY - 60 - (idx * 22));
            });
        }
    }

    // --- 4. Draw Rolling Feed Panel (Bottom-Left) ---
    const panelX = 24;
    const panelY = height - 160;
    
    // Draw background container
    ctx.fillStyle = 'rgba(10, 10, 15, 0.75)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 320, 130, 8);
    ctx.fill();
    ctx.stroke();

    // Panel Header
    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('LIVE INTERACTION FEED', panelX + 16, panelY + 24);

    // List recent events (up to last 5)
    ctx.font = 'bold 12px monospace';
    const displayEvents = recentEvents.slice(0, 5); // EventLog holds newest first
    displayEvents.forEach((evt, idx) => {
        const timeStr = new Date(evt.timestamp).toLocaleTimeString([], { hour12: false });
        
        let color = '#4ade80'; // hand
        if (evt.source === 'FACE') color = '#60a5fa';
        if (evt.source === 'BODY') color = '#fb923c';

        ctx.fillStyle = color;
        ctx.fillText(`[${evt.source}]`, panelX + 16, panelY + 48 + (idx * 16));

        ctx.fillStyle = '#ffffff';
        ctx.fillText(` ${evt.type}`, panelX + 68, panelY + 48 + (idx * 16));

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillText(` — ${timeStr}`, panelX + 220, panelY + 48 + (idx * 16));
    });
}
