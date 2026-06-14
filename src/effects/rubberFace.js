/**
 * rubberFace.js — Elastic texture-mapped face warping
 *
 * How it works:
 * 1. Every frame, the webcam is drawn to an offscreen canvas.
 * 2. Face landmarks are received from MediaPipe FaceMesh.
 * 3. Expression confidences drive displacement targets per landmark group.
 * 4. Spring physics interpolates current displacements toward targets.
 * 5. The face region is re-rendered using affine triangle warping:
 *    - Source coords  = original landmark positions on offscreen canvas
 *    - Dest coords    = landmark positions + spring displacement
 *    - Per-triangle, ctx.transform() + clip + drawImage creates real texture-map warping.
 */

// ─── Triangulation ────────────────────────────────────────────────────────────
// A subset of MediaPipe's FACEMESH_TESSELATION connectivity gives us triangles.
// Full 468-point tesselation encoded as flat triplet list. We use a curated
// subset (~200 triangles) for performance while covering the entire face.
const FACE_TRIANGLES = [
    10,338,297, 10,297,332, 10,332,284, 10,284,251, 10,251,389,
    338,10,109, 297,338,177, 332,297,175, 284,332,396, 251,284,373,
    389,251,264, 109,338,67,  177,338,93,  175,297,152, 396,332,379,
    373,284,367, 264,251,447, 67, 109,10,  93, 177,137, 152,175,148,
    379,396,365, 367,373,288, 447,264,454, 10, 67, 109, 137,177,215,
    148,152,176, 365,379,397, 288,367,435, 454,447,356,
    // Eyes
    33,246,161, 246,33,7,    161,246,160, 160,246,159, 159,246,158,
    158,246,157, 157,246,173, 33,161,246,  7, 33,163,  163,33,144,
    144,33,145,  145,33,153,  153,33,154,  154,33,155,  155,33,133,
    263,466,388, 466,263,249, 388,466,387, 387,466,386, 386,466,385,
    385,466,384, 384,466,398, 263,388,466, 249,263,390, 390,263,373,
    373,263,374, 374,263,380, 380,263,381, 381,263,382, 382,263,362,
    // Mouth
    61, 185,40,  40, 185,39,  39, 185,37,  37, 185,0,   0, 185,267,
    267,185,269, 269,185,270, 270,185,409, 409,185,291, 61, 40, 185,
    146,61,91,   91, 61,181,  181,61,84,   84, 61,17,   17, 61,314,
    314,61,405,  405,61,321,  321,61,375,  375,61,291,
    // Nose
    168,122,6,   6, 122,196,  196,122,3,   3, 122,51,   51, 122,45,
    168,6,  197, 197,6,  195, 195,6,  5,   5, 6,  4,    4, 6,  45,
    168,197,6,   197,195,248, 248,195,456, 456,195,364, 364,195,399,
    // Cheeks / jaw
    234,93, 132, 132,93, 58,  58, 93, 172, 172,93, 136, 136,93, 150,
    150,93, 149, 149,93, 176, 454,356,389, 356,447,264, 447,454,356,
    127,34, 139, 34, 127,162, 162,127,21,  21, 127,54,  54, 127,103,
    103,127,67,  67, 127,109,
    // Forehead
    10, 109,67,  109,108,69,  108,109,10,  69, 108,104, 104,108,55,
    55, 108,193, 193,108,168, 298,333,301, 333,298,10,  301,298,337,
    337,298,299, 299,298,332, 332,298,10,
];

// Landmark groups mapped to deformation drivers
const CHEEK_R  = [234, 132, 58,  172, 136, 150]; // right cheek (mirror: your left)
const CHEEK_L  = [454, 356, 389, 447, 264, 362]; // left cheek
const CHIN     = [152, 148, 176, 149, 150, 136];
const BROW_L   = [10,  338, 297, 332, 284];       // left brow/forehead
const BROW_R   = [10,  109, 67,  103, 54];        // right brow/forehead
const MOUTH_L  = [61,  146, 91];
const MOUTH_R  = [291, 375, 321];

// ─── State ────────────────────────────────────────────────────────────────────
let videoEl        = null;
let effectCanvas   = null;
let effectCtx      = null;
let offscreen      = null;
let offCtx         = null;

let initialized    = false;
let lastLandmarks  = null;

// Per-landmark spring state (468 entries)
let dispCurrent  = []; // Array of {x, y} in pixels
let dispVelocity = []; // Array of {x, y} in pixels
let dispTarget   = []; // Array of {x, y} in pixels

// Spring constants
const SPRING  = 0.25;
const DAMPING = 0.7;

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initRubberFace(videoElement) {
    videoEl = videoElement;

    effectCanvas = document.getElementById('effectCanvas');
    effectCtx    = effectCanvas.getContext('2d');

    // Offscreen canvas matches the video resolution for sampling
    offscreen = document.createElement('canvas');
    offscreen.width  = 1280;
    offscreen.height = 720;
    offCtx = offscreen.getContext('2d');

    // Resize effect canvas to viewport
    function resize() {
        effectCanvas.width  = window.innerWidth;
        effectCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // Init spring arrays
    for (let i = 0; i < 468; i++) {
        dispCurrent[i]  = { x: 0, y: 0 };
        dispVelocity[i] = { x: 0, y: 0 };
        dispTarget[i]   = { x: 0, y: 0 };
    }

    initialized = true;
    console.log('[rubberFace] Initialized');
}

// ─── Per-frame update ─────────────────────────────────────────────────────────
/**
 * @param {Array}  landmarks   - 468 MediaPipe FaceMesh normalized landmarks [{x,y,z}]
 * @param {Object} expressions - Map of expression name → confidence [0..1]
 */
export function updateRubberFace(landmarks, expressions = {}) {
    if (!initialized || !landmarks || landmarks.length < 468) return;

    lastLandmarks = landmarks;

    const vw = effectCanvas.width;
    const vh = effectCanvas.height;

    // 1. Capture current video frame to offscreen (un-mirrored, raw camera space)
    offscreen.width  = videoEl.videoWidth  || 1280;
    offscreen.height = videoEl.videoHeight || 720;
    offCtx.save();
    offCtx.scale(-1, 1);
    offCtx.drawImage(videoEl, -offscreen.width, 0, offscreen.width, offscreen.height);
    offCtx.restore();

    // 2. Build target displacements from expression confidences
    //    Displacements are in NORMALIZED space (0..1), converted to canvas px later
    resetTargets();

    const tiltR  = expressions['HEAD_TILT_RIGHT'] || 0;
    const tiltL  = expressions['HEAD_TILT_LEFT']  || 0;
    const mouth  = Math.max(expressions['MOUTH_OPEN'] || 0, (expressions['JAW_DROP'] || 0) * 1.5);
    const jawDrop= expressions['JAW_DROP'] || 0;
    const browL  = expressions['LEFT_BROW_RAISE']  || 0;
    const browR  = expressions['RIGHT_BROW_RAISE'] || 0;
    const smile  = expressions['SMILE']            || 0;

    // Cheek stretch right (head tilts right → right cheek pulled right)
    if (tiltR > 0.05) {
        applyDisp(CHEEK_R,  tiltR * 0.055,  0,       vw, vh);
        applyDisp(CHEEK_L, -tiltR * 0.02,   0,       vw, vh);
    }
    // Cheek stretch left
    if (tiltL > 0.05) {
        applyDisp(CHEEK_L, -tiltL * 0.055,  0,       vw, vh);
        applyDisp(CHEEK_R,  tiltL * 0.02,   0,       vw, vh);
    }
    // Chin/jaw drop
    if (mouth > 0.05) {
        applyDisp(CHIN,     0,   mouth * 0.07,  vw, vh);
    }
    if (jawDrop > 0.05) {
        applyDisp(CHIN,     0,   jawDrop * 0.05, vw, vh); // extra for extreme jaw
    }
    // Brow raises
    if (browL > 0.05) {
        applyDisp(BROW_L,   0,  -browL * 0.045,  vw, vh);
    }
    if (browR > 0.05) {
        applyDisp(BROW_R,   0,  -browR * 0.045,  vw, vh);
    }
    // Smile — corners pulled outward
    if (smile > 0.05) {
        applyDisp(MOUTH_L, -smile * 0.03, -smile * 0.015, vw, vh);
        applyDisp(MOUTH_R,  smile * 0.03, -smile * 0.015, vw, vh);
    }

    // 3. Spring physics step
    for (let i = 0; i < 468; i++) {
        const dx = dispTarget[i].x - dispCurrent[i].x;
        const dy = dispTarget[i].y - dispCurrent[i].y;

        dispVelocity[i].x = (dispVelocity[i].x + dx * SPRING) * DAMPING;
        dispVelocity[i].y = (dispVelocity[i].y + dy * SPRING) * DAMPING;

        dispCurrent[i].x += dispVelocity[i].x;
        dispCurrent[i].y += dispVelocity[i].y;
    }

    // 4. Render warped face triangles
    effectCtx.clearRect(0, 0, vw, vh);
    renderWarped(landmarks, vw, vh);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetTargets() {
    for (let i = 0; i < 468; i++) {
        dispTarget[i].x = 0;
        dispTarget[i].y = 0;
    }
}

function applyDisp(group, dx, dy, vw, vh) {
    for (const idx of group) {
        dispTarget[idx].x += dx * vw;
        dispTarget[idx].y += dy * vh;
    }
}

/**
 * Convert a normalized landmark to canvas pixel space.
 * The video feed is CSS-mirrored (scaleX(-1)), so we mirror x here too.
 */
function lmToCanvas(lm, vw, vh) {
    return {
        x: (1 - lm.x) * vw,
        y: lm.y * vh
    };
}

/**
 * Warp a single triangle: map source pixels (on offscreen canvas) to dest positions.
 * Uses the canvas 2D affine transform trick:
 *   setTransform(a, b, c, d, e, f) where the matrix maps video UV → canvas XY.
 */
function drawTriangle(srcX0, srcY0, srcX1, srcY1, srcX2, srcY2,
                      dstX0, dstY0, dstX1, dstY1, dstX2, dstY2,
                      srcW, srcH) {
    // Clip to destination triangle shape
    effectCtx.save();
    effectCtx.beginPath();
    effectCtx.moveTo(dstX0, dstY0);
    effectCtx.lineTo(dstX1, dstY1);
    effectCtx.lineTo(dstX2, dstY2);
    effectCtx.closePath();
    effectCtx.clip();

    // Build affine transform matrix that maps (srcX, srcY) → (dstX, dstY)
    //   [a c e]   [dst0 dst1 dst2]   [src0 src1 src2]^-1
    //   [b d f] = [dst0 dst1 dst2] × [src0 src1 src2]
    const d = srcX0 * (srcY1 - srcY2) + srcX1 * (srcY2 - srcY0) + srcX2 * (srcY0 - srcY1);
    if (Math.abs(d) < 0.001) { effectCtx.restore(); return; }

    const a = (dstX0 * (srcY1 - srcY2) + dstX1 * (srcY2 - srcY0) + dstX2 * (srcY0 - srcY1)) / d;
    const b = (dstY0 * (srcY1 - srcY2) + dstY1 * (srcY2 - srcY0) + dstY2 * (srcY0 - srcY1)) / d;
    const c = (dstX0 * (srcX2 - srcX1) + dstX1 * (srcX0 - srcX2) + dstX2 * (srcX1 - srcX0)) / d;
    const dd= (dstY0 * (srcX2 - srcX1) + dstY1 * (srcX0 - srcX2) + dstY2 * (srcX1 - srcX0)) / d;
    const e = (dstX0 * (srcX1 * srcY2 - srcX2 * srcY1) + dstX1 * (srcX2 * srcY0 - srcX0 * srcY2) + dstX2 * (srcX0 * srcY1 - srcX1 * srcY0)) / d;
    const f = (dstY0 * (srcX1 * srcY2 - srcX2 * srcY1) + dstY1 * (srcX2 * srcY0 - srcX0 * srcY2) + dstY2 * (srcX0 * srcY1 - srcX1 * srcY0)) / d;

    effectCtx.transform(a, b, c, dd, e, f);
    effectCtx.drawImage(offscreen, 0, 0, srcW, srcH);
    effectCtx.restore();
}

function renderWarped(landmarks, vw, vh) {
    const srcW = offscreen.width;
    const srcH = offscreen.height;

    for (let t = 0; t < FACE_TRIANGLES.length; t += 3) {
        const i = FACE_TRIANGLES[t];
        const j = FACE_TRIANGLES[t + 1];
        const k = FACE_TRIANGLES[t + 2];

        if (i >= landmarks.length || j >= landmarks.length || k >= landmarks.length) continue;

        // Source = raw landmark positions in offscreen canvas pixel space (mirrored)
        const si = { x: (1 - landmarks[i].x) * srcW, y: landmarks[i].y * srcH };
        const sj = { x: (1 - landmarks[j].x) * srcW, y: landmarks[j].y * srcH };
        const sk = { x: (1 - landmarks[k].x) * srcW, y: landmarks[k].y * srcH };

        // Destination = landmark canvas position + spring displacement
        const di = lmToCanvas(landmarks[i], vw, vh);
        const dj = lmToCanvas(landmarks[j], vw, vh);
        const dk = lmToCanvas(landmarks[k], vw, vh);

        drawTriangle(
            si.x, si.y,  sj.x, sj.y,  sk.x, sk.y,
            di.x + dispCurrent[i].x, di.y + dispCurrent[i].y,
            dj.x + dispCurrent[j].x, dj.y + dispCurrent[j].y,
            dk.x + dispCurrent[k].x, dk.y + dispCurrent[k].y,
            srcW, srcH
        );
    }
}
