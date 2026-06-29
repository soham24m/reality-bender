/**
 * effects.js — Post-processing-like visual effects for Reality Bender
 * Manages: grid shader ripple, floor craters, CSS canvas filters,
 *           chromatic aberration simulation, scanline overlay.
 * Imports: nothing (receives scene ref via initEffects to avoid circular deps)
 * Exports: initEffects, triggerGridRipple, createCrater, applyCanvasFilter,
 *          triggerChromaticAberration, enableScanlines, disableScanlines,
 *          updateEffects, resetEffects, triggerBrightnessFlash
 */

// Local scene reference — set by initEffects to avoid circular dependency
let _scene = null;

// ─── Constants ────────────────────────────────────────────────────────────────
const CRATER_MAX_AGE = 8.0;
const RIPPLE_DURATION = 1.5;
const RIPPLE_SPEED = 8.0;
const SCANLINE_OPACITY = 0.03;
const CHROMATIC_SHIFT_PX = 3;

// ─── State ────────────────────────────────────────────────────────────────────
export const effectsState = {
  gridMesh: null,
  gridUniforms: null,
  craters: [],
  filterTimer: 0,
  chromaticTimer: 0,
  scanlinesActive: false,
  canvasWrapper: null,
  filterTimeoutId: null
};

// ─── Grid Shader ─────────────────────────────────────────────────────────────

const GRID_VERTEX = `
  uniform float uTime;
  uniform vec3 uRippleOrigin;
  uniform float uRippleTime;
  varying vec2 vUv;
  varying float vRipple;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec3 pos = position;
    vWorldPos = pos;

    float dist = length(pos.xz - uRippleOrigin.xz);
    float envelope = max(0.0, 1.0 - dist / 25.0) * max(0.0, 1.0 - uRippleTime / 1.5);
    vRipple = sin(dist * 1.0 - uRippleTime * 8.0) * envelope;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const GRID_FRAGMENT = `
  uniform float uRippleTime;
  uniform vec3 uBaseColor;
  uniform vec3 uRippleColor;
  uniform float uGlowIntensity;
  uniform vec3 uBleedColor;
  uniform float uBleedAmount;
  varying vec2 vUv;
  varying float vRipple;
  varying vec3 vWorldPos;

  void main() {
    // Grid lines using fract-based approach (no fwidth needed)
    float lineWidthX = 0.03;
    float lineWidthZ = 0.03;

    // Major grid every 3 world units
    float gridX = abs(fract(vWorldPos.x / 3.0 + 0.5) - 0.5);
    float gridZ = abs(fract(vWorldPos.z / 3.0 + 0.5) - 0.5);
    float majorLine = 1.0 - step(lineWidthX, min(gridX, gridZ));

    // Sub grid every 1 world unit, dimmer
    float subX = abs(fract(vWorldPos.x + 0.5) - 0.5);
    float subZ = abs(fract(vWorldPos.z + 0.5) - 0.5);
    float subLine = (1.0 - step(lineWidthX * 0.5, min(subX, subZ))) * 0.3;

    float lines = max(majorLine, subLine);

    vec3 baseCol = uBaseColor + uRippleColor * abs(vRipple) * 3.0;
    baseCol *= (1.0 + uGlowIntensity * 0.6);

    float edgeDist = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0;
    float bleedFactor = uBleedAmount * smoothstep(0.3, 1.0, edgeDist);
    vec3 finalColor = mix(baseCol, uBleedColor, bleedFactor);

    float rippleGlow = abs(vRipple) * 0.6;
    float alpha = lines * 0.85 + rippleGlow;
    alpha = clamp(alpha, 0.0, 1.0);

    if (alpha < 0.04) discard;
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function initEffects(scene, canvasWrapper) {
  _scene = scene;
  effectsState.canvasWrapper = canvasWrapper;

  const uniforms = {
    uTime:         { value: 0 },
    uRippleOrigin: { value: new THREE.Vector3(0, 0, 0) },
    uRippleTime:   { value: 999 },
    uBaseColor:    { value: new THREE.Color(0x222222) },
    uRippleColor:  { value: new THREE.Color(0x00ffff) },
    uGlowIntensity:{ value: 0.0 },
    uBleedColor:   { value: new THREE.Color(0x440000) },
    uBleedAmount:  { value: 0.0 }
  };
  effectsState.gridUniforms = uniforms;

  const geo = new THREE.PlaneGeometry(60, 60, 80, 80);
  const mat = new THREE.ShaderMaterial({
    vertexShader: GRID_VERTEX,
    fragmentShader: GRID_FRAGMENT,
    uniforms: uniforms,
    transparent: true,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01;
  _scene.add(mesh);
  effectsState.gridMesh = mesh;
}

export function triggerGridRipple(worldPosition) {
  if (!effectsState.gridUniforms) return;
  effectsState.gridUniforms.uRippleOrigin.value.copy(worldPosition);
  effectsState.gridUniforms.uRippleTime.value = 0.0;
}

export function setGridBaseColor(colorHex) {
  if (!effectsState.gridUniforms) return;
  effectsState.gridUniforms.uBaseColor.value.setHex(colorHex);
}

export function setGridRippleColor(colorHex) {
  if (!effectsState.gridUniforms) return;
  effectsState.gridUniforms.uRippleColor.value.setHex(colorHex);
}

export function setGridGlowIntensity(v) {
  if (!effectsState.gridUniforms) return;
  effectsState.gridUniforms.uGlowIntensity.value = v;
}

export function setGridBleed(amount) {
  if (!effectsState.gridUniforms) return;
  effectsState.gridUniforms.uBleedAmount.value = amount;
}

// ─── Craters ──────────────────────────────────────────────────────────────────

export function createCrater(pos, colorHex) {
  const geo = new THREE.TorusGeometry(1.2, 0.15, 8, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.9
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(pos.x, 0.05, pos.z);
  _scene.add(mesh);

  const innerGeo = new THREE.CircleGeometry(1.0, 24);
  const innerMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.3
  });
  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  innerMesh.rotation.x = -Math.PI / 2;
  innerMesh.position.set(pos.x, 0.02, pos.z);
  _scene.add(innerMesh);

  effectsState.craters.push({
    ring: mesh,
    fill: innerMesh,
    age: 0,
    maxAge: CRATER_MAX_AGE
  });
}

// ─── CSS Filter Effects ───────────────────────────────────────────────────────

export function applyCanvasFilter(filterStr, durationMs) {
  if (!effectsState.canvasWrapper) return;
  if (effectsState.filterTimeoutId) clearTimeout(effectsState.filterTimeoutId);

  effectsState.canvasWrapper.style.filter = filterStr;
  effectsState.filterTimeoutId = setTimeout(() => {
    if (effectsState.canvasWrapper) {
      effectsState.canvasWrapper.style.filter = 'none';
    }
    effectsState.filterTimeoutId = null;
  }, durationMs);
}

export function triggerBrightnessFlash() {
  applyCanvasFilter('brightness(1.8)', 60);
}

export function triggerHueRotate() {
  applyCanvasFilter('hue-rotate(90deg)', 120);
}

export function triggerInvert() {
  applyCanvasFilter('invert(1)', 33);
}

export function triggerBlur(durationMs) {
  if (!effectsState.canvasWrapper) return;
  effectsState.canvasWrapper.style.transition = 'filter 0.1s';
  effectsState.canvasWrapper.style.filter = 'blur(2px)';
  setTimeout(() => {
    if (effectsState.canvasWrapper) {
      effectsState.canvasWrapper.style.transition = 'filter 2s';
      effectsState.canvasWrapper.style.filter = 'none';
      effectsState.canvasWrapper.style.transition = 'filter 0s';
    }
  }, durationMs || 2000);
}

export function setSaturateMode(active) {
  if (!effectsState.canvasWrapper) return;
  if (active) {
    effectsState.canvasWrapper.style.filter = 'saturate(200%)';
  } else {
    effectsState.canvasWrapper.style.filter = 'none';
  }
}

export function triggerChromaticAberration() {
  if (!effectsState.canvasWrapper) return;
  effectsState.canvasWrapper.style.transition = 'none';
  effectsState.canvasWrapper.style.textShadow =
    `${CHROMATIC_SHIFT_PX}px 0 2px rgba(255,0,0,0.6), -${CHROMATIC_SHIFT_PX}px 0 2px rgba(0,0,255,0.6)`;

  setTimeout(() => {
    if (effectsState.canvasWrapper) {
      effectsState.canvasWrapper.style.textShadow = 'none';
    }
  }, 150);
}

export function enableScanlines() {
  if (effectsState.scanlinesActive) return;
  effectsState.scanlinesActive = true;
  const el = document.getElementById('scanline-overlay');
  if (el) el.style.opacity = String(SCANLINE_OPACITY);
}

export function disableScanlines() {
  effectsState.scanlinesActive = false;
  const el = document.getElementById('scanline-overlay');
  if (el) el.style.opacity = '0';
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function updateEffects(delta, rawTime) {
  const t = rawTime * 0.001;

  if (effectsState.gridUniforms) {
    effectsState.gridUniforms.uTime.value = t;
    if (effectsState.gridUniforms.uRippleTime.value < RIPPLE_DURATION + 0.5) {
      effectsState.gridUniforms.uRippleTime.value += delta;
    }
  }

  for (let i = effectsState.craters.length - 1; i >= 0; i--) {
    const c = effectsState.craters[i];
    c.age += delta;
    const frac = c.age / c.maxAge;
    const opacity = 1.0 - frac;
    c.ring.material.opacity = opacity * 0.9;
    c.fill.material.opacity = opacity * 0.3;

    if (c.age >= c.maxAge) {
      _scene.remove(c.ring);
      _scene.remove(c.fill);
      c.ring.geometry.dispose();
      c.ring.material.dispose();
      c.fill.geometry.dispose();
      c.fill.material.dispose();
      effectsState.craters.splice(i, 1);
    }
  }
}

export function resetEffects() {
  for (const c of effectsState.craters) {
    if (_scene) {
      _scene.remove(c.ring);
      _scene.remove(c.fill);
    }
    c.ring.geometry.dispose();
    c.ring.material.dispose();
    c.fill.geometry.dispose();
    c.fill.material.dispose();
  }
  effectsState.craters = [];

  if (effectsState.gridUniforms) {
    effectsState.gridUniforms.uRippleTime.value = 999;
    effectsState.gridUniforms.uBaseColor.value.setHex(0x222222);
    effectsState.gridUniforms.uGlowIntensity.value = 0;
    effectsState.gridUniforms.uBleedAmount.value = 0;
  }

  disableScanlines();
  if (effectsState.canvasWrapper) {
    effectsState.canvasWrapper.style.filter = 'none';
  }
}
