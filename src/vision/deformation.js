/**
 * deformation.js — Elastic Face Deformation Engine
 * 
 * Renders a real-time elastic face mesh over the user's face,
 * deforming coordinates via spring physics and spatial velocity falloffs,
 * then rendering via affine triangle texture mapping.
 */

let canvas = null;
let ctx = null;
let video = null;

let triangulation = null; // Cached Delaunay triangles [i, j, k]
let isInitialized = false;

// Physics states for the 468 landmarks
let currentPos = []; // Array of {x, y}
let targetPos = [];  // Array of {x, y}
let velocity = [];   // Array of {x, y}

// Spring physics constants
const SPRING = 0.3;
const DAMPING = 0.75;
const STIFFNESS = 15; // Spatial falloff stiffness

let renderMode = 'NATURAL'; // NATURAL, WIREFRAME, GHOST

/**
 * Initializes the deformation canvas and engine
 */
export function initDeformation(videoElement, canvasElement) {
    video = videoElement;
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
    
    // Reset state
    triangulation = null;
    currentPos = [];
    targetPos = [];
    velocity = [];
    isInitialized = false;
}

/**
 * Sets the rendering style mode
 */
export function setDeformationMode(mode) {
    if (['NATURAL', 'WIREFRAME', 'GHOST'].includes(mode)) {
        renderMode = mode;
    }
}

/**
 * Performs Bowyer-Watson Delaunay Triangulation on 2D points.
 * Only runs once on the first frame of face detection.
 */
function computeDelaunay(points) {
    const n = points.length;
    if (n < 3) return [];
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
        const p = points[i];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    
    const dx = maxX - minX;
    const dy = maxY - minY;
    const deltaMax = Math.max(dx, dy);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    
    // Super-triangle vertices
    const p1 = { x: midX - 20 * deltaMax, y: midY - deltaMax };
    const p2 = { x: midX, y: midY + 20 * deltaMax };
    const p3 = { x: midX + 20 * deltaMax, y: midY - deltaMax };
    
    const allPoints = [...points, p1, p2, p3];
    let triangles = [[n, n + 1, n + 2]];
    
    for (let i = 0; i < n; i++) {
        const p = points[i];
        const badTriangles = [];
        
        for (let j = 0; j < triangles.length; j++) {
            const tri = triangles[j];
            if (inCircumcircle(p, allPoints[tri[0]], allPoints[tri[1]], allPoints[tri[2]])) {
                badTriangles.push(tri);
            }
        }
        
        const polygon = [];
        for (let j = 0; j < badTriangles.length; j++) {
            const tri = badTriangles[j];
            const edges = [
                [tri[0], tri[1]],
                [tri[1], tri[2]],
                [tri[2], tri[0]]
            ];
            
            for (let e = 0; e < 3; e++) {
                const edge = edges[e];
                let shared = false;
                for (let k = 0; k < badTriangles.length; k++) {
                    if (j === k) continue;
                    const otherTri = badTriangles[k];
                    const otherEdges = [
                        [otherTri[0], otherTri[1]],
                        [otherTri[1], otherTri[2]],
                        [otherTri[2], otherTri[0]]
                    ];
                    if (hasEdge(otherEdges, edge)) {
                        shared = true;
                        break;
                    }
                }
                if (!shared) polygon.push(edge);
            }
        }
        
        triangles = triangles.filter(t => !badTriangles.includes(t));
        for (let j = 0; j < polygon.length; j++) {
            triangles.push([polygon[j][0], polygon[j][1], i]);
        }
    }
    
    return triangles.filter(tri => tri[0] < n && tri[1] < n && tri[2] < n);
}

function inCircumcircle(p, p1, p2, p3) {
    const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
    if (Math.abs(d) < 1e-9) return false;
    
    const ux = ((p1.x * p1.x + p1.y * p1.y) * (p2.y - p3.y) + (p2.x * p2.x + p2.y * p2.y) * (p3.y - p1.y) + (p3.x * p3.x + p3.y * p3.y) * (p1.y - p2.y)) / d;
    const uy = ((p1.x * p1.x + p1.y * p1.y) * (p3.x - p2.x) + (p2.x * p2.x + p2.y * p2.y) * (p3.x - p1.x) + (p3.x * p3.x + p3.y * p3.y) * (p2.x - p1.x)) / d;
    
    const r = Math.hypot(p1.x - ux, p1.y - uy);
    const dist = Math.hypot(p.x - ux, p.y - uy);
    return dist < r;
}

function hasEdge(edges, edge) {
    return edges.some(e => (e[0] === edge[0] && e[1] === edge[1]) || (e[0] === edge[1] && e[1] === edge[0]));
}

/**
 * Draws an affine-textured triangle on the 2D canvas
 */
function drawTexturedTriangle(video, u0, v0, u1, v1, u2, v2, x0, y0, x1, y1, x2, y2) {
    ctx.save();
    
    // Set clipping path
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.clip();
    
    // Affine transform matrix
    const den = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
    if (Math.abs(den) < 1e-6) {
        ctx.restore();
        return;
    }
    
    const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / den;
    const c = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / den;
    const e = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / den;
    
    const b = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / den;
    const d = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / den;
    const f = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / den;
    
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(video, 0, 0);
    
    ctx.restore();
}

/**
 * Main update loop for face deformations
 */
export function updateDeformation(landmarks, expressions = {}) {
    if (!canvas || !video || !landmarks || landmarks.length === 0) return;

    const width = canvas.width;
    const height = canvas.height;
    const n = landmarks.length;

    // 1. Initialize physics state on first frame
    if (!isInitialized) {
        for (let i = 0; i < n; i++) {
            currentPos[i] = { x: landmarks[i].x, y: landmarks[i].y };
            velocity[i] = { x: 0, y: 0 };
        }
        // Run Delaunay triangulation once
        triangulation = computeDelaunay(currentPos);
        isInitialized = true;
    }

    // 2. Set default targets from MediaPipe raw landmarks
    for (let i = 0; i < n; i++) {
        targetPos[i] = { x: landmarks[i].x, y: landmarks[i].y };
    }

    // 3. Apply expression displacement triggers with spatial falloff
    // Pull indices:
    // Smile/Frown: 61 (L corner), 291 (R corner)
    // Jaw: 152 (Chin)
    // Cheek: 116 (L cheek), 345 (R cheek)
    // Furrow: 168 (Nose bridge top)
    const smileConf = expressions['SMILE'] || 0;
    const frownConf = expressions['FROWN'] || 0;
    const jawConf = expressions['JAW_DROP'] || 0;
    const cheekConf = expressions['CHEEK_PUFF'] || 0;
    const furrowConf = expressions['BROWS_FURROW'] || 0;
    
    // Head Tilt: check if left or right tilt is active
    const tiltLeftConf = expressions['HEAD_TILT_LEFT'] || 0;
    const tiltRightConf = expressions['HEAD_TILT_RIGHT'] || 0;
    const tiltConf = Math.max(tiltLeftConf, tiltRightConf);

    for (let i = 0; i < n; i++) {
        const p = targetPos[i];

        // Spatial distances to trigger regions (calculated using raw landmark spacing)
        const distToLCorner = Math.hypot(p.x - landmarks[61].x, p.y - landmarks[61].y);
        const distToRCorner = Math.hypot(p.x - landmarks[291].x, p.y - landmarks[291].y);
        const distToChin = Math.hypot(p.x - landmarks[152].x, p.y - landmarks[152].y);
        const distToLCheek = Math.hypot(p.x - landmarks[116].x, p.y - landmarks[116].y);
        const distToRCheek = Math.hypot(p.x - landmarks[345].x, p.y - landmarks[345].y);
        const distToBridge = Math.hypot(p.x - landmarks[168].x, p.y - landmarks[168].y);

        // Falloff influences
        const inflLCorner = 1 / (1 + distToLCorner * STIFFNESS);
        const inflRCorner = 1 / (1 + distToRCorner * STIFFNESS);
        const inflChin = 1 / (1 + distToChin * STIFFNESS);
        const inflLCheek = 1 / (1 + distToLCheek * STIFFNESS);
        const inflRCheek = 1 / (1 + distToRCheek * STIFFNESS);
        const inflBridge = 1 / (1 + distToBridge * STIFFNESS);

        // SMILE: pull corners outward and slightly up
        if (smileConf > 0) {
            p.x -= 0.04 * smileConf * inflLCorner; // pull left corner further left
            p.x += 0.04 * smileConf * inflRCorner; // pull right corner further right
            p.y -= 0.02 * smileConf * (inflLCorner + inflRCorner);
        }

        // FROWN: pull corners downward
        if (frownConf > 0) {
            p.y += 0.03 * frownConf * (inflLCorner + inflRCorner);
        }

        // JAW_DROP: stretch lower face downward
        if (jawConf > 0) {
            p.y += 0.08 * jawConf * inflChin;
        }

        // CHEEK_PUFF: expand cheek regions outward radially from nose tip (1)
        if (cheekConf > 0) {
            const nose = landmarks[1];
            // Left cheek expansion
            const dxL = p.x - nose.x;
            const dyL = p.y - nose.y;
            p.x += dxL * 0.3 * cheekConf * inflLCheek;
            p.y += dyL * 0.3 * cheekConf * inflLCheek;

            // Right cheek expansion
            const dxR = p.x - nose.x;
            const dyR = p.y - nose.y;
            p.x += dxR * 0.3 * cheekConf * inflRCheek;
            p.y += dyR * 0.3 * cheekConf * inflRCheek;
        }

        // BROWS_FURROW: compress forehead towards bridge
        if (furrowConf > 0) {
            const dx = landmarks[168].x - p.x;
            const dy = landmarks[168].y - p.y;
            p.x += dx * 0.25 * furrowConf * inflBridge;
            p.y += dy * 0.25 * furrowConf * inflBridge;
        }

        // HEAD_TILT: stretch full face horizontally
        if (tiltConf > 0) {
            const centerX = 0.5;
            p.x += (p.x - centerX) * 0.15 * tiltConf;
        }
    }

    // 4. Update spring physics
    for (let i = 0; i < n; i++) {
        const forceX = (targetPos[i].x - currentPos[i].x) * SPRING;
        const forceY = (targetPos[i].y - currentPos[i].y) * SPRING;
        
        velocity[i].x += forceX;
        velocity[i].y += forceY;
        
        velocity[i].x *= DAMPING;
        velocity[i].y *= DAMPING;
        
        currentPos[i].x += velocity[i].x;
        currentPos[i].y += velocity[i].y;
    }

    // 5. Clear and render canvas
    ctx.clearRect(0, 0, width, height);

    if (!triangulation) return;

    if (renderMode === 'NATURAL') {
        // Render texture-mapped triangles
        const videoWidth = video.videoWidth || 1280;
        const videoHeight = video.videoHeight || 720;

        for (let t = 0; t < triangulation.length; t++) {
            const [i, j, k] = triangulation[t];

            // Source triangle coords (raw camera pixel space)
            const u0 = landmarks[i].x * videoWidth;
            const v0 = landmarks[i].y * videoHeight;
            const u1 = landmarks[j].x * videoWidth;
            const v1 = landmarks[j].y * videoHeight;
            const u2 = landmarks[k].x * videoWidth;
            const v2 = landmarks[k].y * videoHeight;

            // Target triangle coords (deformed canvas pixel space)
            const x0 = currentPos[i].x * width;
            const y0 = currentPos[i].y * height;
            const x1 = currentPos[j].x * width;
            const y1 = currentPos[j].y * height;
            const x2 = currentPos[k].x * width;
            const y2 = currentPos[k].y * height;

            drawTexturedTriangle(video, u0, v0, u1, v1, u2, v2, x0, y0, x1, y1, x2, y2);
        }
    } else if (renderMode === 'WIREFRAME') {
        // Draw green glowing mesh lines
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.75)';
        ctx.lineWidth = 0.5;
        ctx.shadowColor = 'rgba(74, 222, 128, 0.8)';
        ctx.shadowBlur = 4;

        ctx.beginPath();
        for (let t = 0; t < triangulation.length; t++) {
            const [i, j, k] = triangulation[t];
            const x0 = currentPos[i].x * width;
            const y0 = currentPos[i].y * height;
            const x1 = currentPos[j].x * width;
            const y1 = currentPos[j].y * height;
            const x2 = currentPos[k].x * width;
            const y2 = currentPos[k].y * height;

            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.closePath();
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
    } else if (renderMode === 'GHOST') {
        // Draw semi-transparent blue filled mesh with light blue borders
        ctx.fillStyle = 'rgba(0, 122, 255, 0.15)';
        ctx.strokeStyle = 'rgba(100, 210, 255, 0.4)';
        ctx.lineWidth = 0.5;

        for (let t = 0; t < triangulation.length; t++) {
            const [i, j, k] = triangulation[t];
            const x0 = currentPos[i].x * width;
            const y0 = currentPos[i].y * height;
            const x1 = currentPos[j].x * width;
            const y1 = currentPos[j].y * height;
            const x2 = currentPos[k].x * width;
            const y2 = currentPos[k].y * height;

            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }
}
