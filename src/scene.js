import { initEffects, updateEffects, triggerGridRipple, setGridBaseColor, setGridGlowIntensity, setGridBleed, setGridRippleColor, createCrater, effectsState, resetEffects, setSaturateMode, enableScanlines, disableScanlines } from './effects.js';

export const sceneState = {
  scene: null,
  camera: null,
  renderer: null,
  playerOrb: null,
  orbShell: null,
  orbRings: [],
  orbTrailPositions: [],
  orbTrailMeshes: [],
  pillars: [],
  debrisParticles: null,
  starfield: null,
  starOrigPositions: null,
  explosions: [],
  shakeTime: 0,
  overlayEl: null,
  isSecondArena: false,
  arenaTransition: 0,
  targetGridColor: new THREE.Color(0x222222),
  targetAmbientColor: new THREE.Color(0xffffff),
  cameraSwayTime: 0,
  lastCombatTime: 0,
  spawnTelegraphs: [],
  gridHelper: null,
  ambientLight: null,
  isCinematic: false,
  cinematicTimer: 0,
  timeScale: 1.0,
  defeatCameraTarget: null,
  isDefeatCinematic: false,
  cameraRoll: 0,
  waveIndex: 0,
  isCollapsingReality: false
};

export function initScene(canvasElement) {
  sceneState.overlayEl = canvasElement;
  sceneState.scene = new THREE.Scene();
  sceneState.scene.background = null;
  
  sceneState.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  sceneState.camera.position.set(0, 6, 12);
  sceneState.camera.lookAt(0, 0, 0);

  sceneState.renderer = new THREE.WebGLRenderer({ canvas: canvasElement, alpha: true, antialias: true });
  sceneState.renderer.setSize(window.innerWidth, window.innerHeight);
  sceneState.renderer.setPixelRatio(window.devicePixelRatio);
  sceneState.renderer.domElement.classList.add('three-canvas');

  window.addEventListener('resize', onWindowResize, false);

  createEnvironment();
  createPlayerOrb();

  const gameContainer = document.getElementById('game-container');
  initEffects(sceneState.scene, gameContainer);
}

export function onWindowResize() {
  sceneState.camera.aspect = window.innerWidth / window.innerHeight;
  sceneState.camera.updateProjectionMatrix();
  sceneState.renderer.setSize(window.innerWidth, window.innerHeight);
}

export function createEnvironment() {
  // Floor plane (dark, behind grid shader)
  const floorGeo = new THREE.PlaneGeometry(60, 60);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  sceneState.scene.add(floor);
  // Grid is now a shader plane added by initEffects — called after scene setup

  // Pillars
  const pillarGeo = new THREE.BoxGeometry(1, 10, 1);
  const pillarMat = new THREE.MeshBasicMaterial({ color: 0x111111, wireframe: true });
  const positions = [
    [-20, 5, -20],
    [20, 5, -20],
    [-20, 5, 20],
    [20, 5, 20]
  ];

  for (let i = 0; i < positions.length; i++) {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(positions[i][0], positions[i][1], positions[i][2]);
    sceneState.scene.add(pillar);
    
    const light = new THREE.PointLight((i % 2 === 0) ? 0xaa00ff : 0x00aaff, 1, 30);
    light.position.set(0, 2, 0);
    pillar.add(light);
    sceneState.pillars.push({ mesh: pillar, light: light, index: i });
  }

  // Ambient Light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  sceneState.scene.add(ambientLight);
  sceneState.ambientLight = ambientLight;

  // Starfield
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(1200 * 3);
  for (let i = 0; i < 1200 * 3; i++) {
    starPos[i] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  sceneState.starOrigPositions = starPos.slice(); // Save original positions for drift-back (Day 21)

  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, transparent: true, opacity: 0.6 });
  sceneState.starfield = new THREE.Points(starGeo, starMat);
  sceneState.scene.add(sceneState.starfield);

  // Debris Particles
  const debrisGeo = new THREE.BufferGeometry();
  const debrisPos = new Float32Array(120 * 3);
  const debrisVels = [];
  for (let i = 0; i < 120; i++) {
    debrisPos[i * 3] = (Math.random() - 0.5) * 60;
    debrisPos[i * 3 + 1] = Math.random() * 20;
    debrisPos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    debrisVels.push({
      x: (Math.random() - 0.5) * 0.05,
      y: (Math.random() - 0.5) * 0.05,
      z: (Math.random() - 0.5) * 0.05
    });
  }
  debrisGeo.setAttribute('position', new THREE.BufferAttribute(debrisPos, 3));
  const debrisMat = new THREE.PointsMaterial({ color: 0x8888ff, size: 0.15, transparent: true, opacity: 0.4 });
  sceneState.debrisParticles = new THREE.Points(debrisGeo, debrisMat);
  sceneState.debrisParticles.userData = { velocities: debrisVels };
  sceneState.scene.add(sceneState.debrisParticles);
}

export function createPlayerOrb() {
  const orbGeo = new THREE.SphereGeometry(0.5, 16, 16);
  const orbMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  sceneState.playerOrb = new THREE.Mesh(orbGeo, orbMat);
  sceneState.playerOrb.position.set(0, 1, 0);
  sceneState.scene.add(sceneState.playerOrb);

  const shellGeo = new THREE.SphereGeometry(0.7, 16, 16);
  const shellMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3, wireframe: true });
  sceneState.orbShell = new THREE.Mesh(shellGeo, shellMat);
  sceneState.playerOrb.add(sceneState.orbShell);

  // 8 micro-particle electrons orbiting the orb
  for (let i = 0; i < 8; i++) {
    const pGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const p = new THREE.Mesh(pGeo, pMat);
    sceneState.playerOrb.add(p);
    p.userData.electronIndex = i;
  }

  // Orb trail (8 ghost positions)
  for (let i = 0; i < 8; i++) {
    const tGeo = new THREE.SphereGeometry(0.4 - i * 0.04, 8, 8);
    const tMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0 });
    const t = new THREE.Mesh(tGeo, tMat);
    sceneState.scene.add(t);
    sceneState.orbTrailMeshes.push(t);
    sceneState.orbTrailPositions.push(new THREE.Vector3(0, 1, 0));
  }
}

export function triggerScreenShake(intensity = 1.0) {
  sceneState.shakeTime = 15 * intensity;
}

export function createExplosion(pos, color) {
  const geo = new THREE.BufferGeometry();
  const count = 30;
  const positions = new Float32Array(count * 3);
  const vels = [];
  for (let i = 0; i < count; i++) {
    positions[i*3] = pos.x;
    positions[i*3+1] = pos.y;
    positions[i*3+2] = pos.z;
    vels.push(new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    ));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: color, size: 0.5, transparent: true });
  const points = new THREE.Points(geo, mat);
  sceneState.scene.add(points);

  sceneState.explosions.push({ mesh: points, velocities: vels, age: 0, maxAge: 60 });
}

export function reportCombatActivity() {
  sceneState.lastCombatTime = performance.now();
}

export function scatterStars(worldPos, force = 8.0) {
  if (!sceneState.starfield || !sceneState.starOrigPositions) return;
  const posAttr = sceneState.starfield.geometry.attributes.position;
  const localPos = worldPos.clone();
  sceneState.starfield.worldToLocal(localPos);

  const arr = posAttr.array;
  const orig = sceneState.starOrigPositions;

  for (let i = 0; i < arr.length; i += 3) {
    const dx = orig[i] - localPos.x;
    const dy = orig[i+1] - localPos.y;
    const dz = orig[i+2] - localPos.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    if (dist < 40.0 && dist > 0.1) {
      const push = (1.0 - dist / 40.0) * force;
      arr[i]   += (dx / dist) * push;
      arr[i+1] += (dy / dist) * push;
      arr[i+2] += (dz / dist) * push;
    }
  }
  posAttr.needsUpdate = true;
}

export function notifyHitAtPosition(worldPos, color) {
  triggerGridRipple(worldPos);
  createCrater(worldPos, color);
  scatterStars(worldPos, 7.0);
}

export function notifyPlayerHP(hpPercent) {
  // Arena edge bleed when HP < 50%
  const bleed = hpPercent < 0.5 ? (0.5 - hpPercent) * 2.0 : 0;
  setGridBleed(Math.min(1.0, bleed));

  // Grid glow when HP = 100%
  const glow = hpPercent > 0.95 ? 1.0 : 0;
  setGridGlowIntensity(glow);
}

export function addOrbRingForWave(waveIndex) {
  sceneState.waveIndex = waveIndex;
  const colors = [0x444444, 0x00ffff, 0xff00ff, 0xffff00];
  const radii  = [1.0, 1.3, 1.6, 1.9];
  const color = colors[Math.min(waveIndex, colors.length - 1)];
  const radius = radii[Math.min(waveIndex, radii.length - 1)];

  const ringGeo = new THREE.TorusGeometry(radius, 0.02, 8, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.userData.baseRadius = radius;
  ring.userData.phase = waveIndex * Math.PI * 0.5;
  sceneState.playerOrb.add(ring);
  sceneState.orbRings.push(ring);
}

export function transitionToSecondArena() {
  if (sceneState.isSecondArena) return;
  sceneState.isSecondArena = true;
  sceneState.arenaTransition = 1.0; // Starts transition over 2 seconds (using delta)
  sceneState.targetGridColor = new THREE.Color(0xff4400); // Red/Orange
  sceneState.targetAmbientColor = new THREE.Color(0xff8844);
}

export function createSpawnTelegraph(pos) {
  const geo = new THREE.TorusGeometry(1.5, 0.1, 8, 24);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(pos);
  mesh.position.y = 0.1; // Just above ground
  sceneState.scene.add(mesh);
  sceneState.spawnTelegraphs.push({ mesh: mesh, age: 0 });
}

export function triggerCinematicIntro() {
  sceneState.isCinematic = true;
  sceneState.cinematicTimer = 2.0;
  // Start far back
  sceneState.camera.position.set(0, 20, 40);
  sceneState.camera.lookAt(0, 0, 0);
}

export function triggerBossDefeatCamera(targetPos) {
  sceneState.isDefeatCinematic = true;
  sceneState.defeatCameraTarget = targetPos.clone();
  sceneState.timeScale = 0.2; // slow motion
}

export function resetScene() {
  sceneState.isSecondArena = false;
  sceneState.arenaTransition = 0;
  sceneState.timeScale = 1.0;
  sceneState.isDefeatCinematic = false;
  sceneState.isCollapsingReality = false;
  sceneState.cameraRoll = 0;
  
  setGridBaseColor(0x222222);
  setGridBleed(0);
  setGridGlowIntensity(0);
  disableScanlines();
  setSaturateMode(false);

  if (sceneState.ambientLight) {
    sceneState.ambientLight.color.setHex(0xffffff);
  }
  if (sceneState.debrisParticles) {
    sceneState.debrisParticles.material.color.setHex(0x8888ff);
  }
  
  for (let e of sceneState.explosions) {
    sceneState.scene.remove(e.mesh);
    e.mesh.geometry.dispose();
    e.mesh.material.dispose();
  }
  sceneState.explosions = [];
  
  for (let t of sceneState.spawnTelegraphs) {
    sceneState.scene.remove(t.mesh);
    t.mesh.geometry.dispose();
    t.mesh.material.dispose();
  }
  sceneState.spawnTelegraphs = [];
  
  // Remove orb rings
  for (let r of sceneState.orbRings) {
    sceneState.playerOrb.remove(r);
    r.geometry.dispose();
    r.material.dispose();
  }
  sceneState.orbRings = [];
  sceneState.waveIndex = 0;

  if (sceneState.starfield) {
    sceneState.starfield.position.set(0, 0, 0);
    sceneState.starfield.rotation.set(0, 0, 0);
    if (sceneState.starOrigPositions) {
      const posAttr = sceneState.starfield.geometry.attributes.position;
      posAttr.array.set(sceneState.starOrigPositions);
      posAttr.needsUpdate = true;
    }
  }

  resetEffects();
  
  sceneState.camera.position.set(0, 6, 12);
  sceneState.camera.lookAt(0, 0, 0);
}

export function updateScene(time, rawDelta = 1/60) {
  const t = time * 0.001;
  const delta = rawDelta * sceneState.timeScale;

  // Cinematic Intro
  if (sceneState.isCinematic) {
    sceneState.cinematicTimer -= rawDelta;
    sceneState.camera.position.lerp(new THREE.Vector3(0, 6, 12), 0.05);
    sceneState.camera.lookAt(0, 0, 0);
    if (sceneState.cinematicTimer <= 0) {
      sceneState.isCinematic = false;
    }
  } else if (sceneState.isDefeatCinematic && sceneState.defeatCameraTarget) {
    const targetCamPos = sceneState.defeatCameraTarget.clone().add(new THREE.Vector3(0, 2, 8));
    sceneState.camera.position.lerp(targetCamPos, 0.05);
    sceneState.camera.lookAt(sceneState.defeatCameraTarget);
  } else {
    // Camera idle sway
    if (performance.now() - sceneState.lastCombatTime > 2000) {
      sceneState.cameraSwayTime += delta;
      const swayX = Math.sin(sceneState.cameraSwayTime * 0.5) * 1.5;
      const swayY = 6 + Math.sin(sceneState.cameraSwayTime * 0.3) * 0.5;
      const swayZ = 12 + Math.cos(sceneState.cameraSwayTime * 0.4) * 1.0;
      sceneState.camera.position.lerp(new THREE.Vector3(swayX, swayY, swayZ), 0.05);
      sceneState.camera.lookAt(0, 0, 0);
    } else {
      sceneState.camera.position.lerp(new THREE.Vector3(0, 6, 12), 0.1);
      sceneState.camera.lookAt(0, 0, 0);
    }
  }

  // Camera roll for low HP
  if (sceneState.cameraRoll !== 0) {
    sceneState.camera.up.set(
      Math.sin(sceneState.cameraRoll) * 0.01,
      1,
      0
    );
  }

  // Arena Transition Lerp
  if (sceneState.arenaTransition > 0) {
    sceneState.arenaTransition -= delta * 0.5; // ~2 seconds
    
    // Lerp grid color
    if (sceneState.gridHelper) {
      sceneState.gridHelper.material.color.lerp(sceneState.targetGridColor, 0.05);
    }
    
    // Lerp ambient light
    if (sceneState.ambientLight) {
      sceneState.ambientLight.color.lerp(sceneState.targetAmbientColor, 0.05);
    }
    
    // Transition particles to embers
    if (sceneState.debrisParticles) {
      sceneState.debrisParticles.material.color.lerp(new THREE.Color(0xff4400), 0.05);
    }
  }

  // Spawn Telegraphs
  for (let i = sceneState.spawnTelegraphs.length - 1; i >= 0; i--) {
    const tele = sceneState.spawnTelegraphs[i];
    tele.age += delta;
    tele.mesh.scale.set(1 - tele.age, 1 - tele.age, 1 - tele.age);
    if (tele.age > 1.0) {
      sceneState.scene.remove(tele.mesh);
      tele.mesh.geometry.dispose();
      tele.mesh.material.dispose();
      sceneState.spawnTelegraphs.splice(i, 1);
    }
  }

  // Starfield rotation
  if (sceneState.starfield) {
    sceneState.starfield.rotation.y = t * 0.05;
    sceneState.starfield.rotation.x = t * 0.02;
  }

  // Debris particles
  if (sceneState.debrisParticles) {
    const positions = sceneState.debrisParticles.geometry.attributes.position.array;
    const count = positions.length / 3;
    for (let i = 0; i < count; i++) {
      if (sceneState.isCollapsingReality) {
        // Fall down through floor (Day 30)
        positions[i*3+1] -= delta * 6.0;
        if (positions[i*3+1] < -20) positions[i*3+1] = 30;
      } else {
        // Drift upward
        positions[i*3+1] += delta * 1.5;
        if (positions[i*3+1] > 30) positions[i*3+1] = -10;
      }
    }
    sceneState.debrisParticles.geometry.attributes.position.needsUpdate = true;
  }

  // Player orb hover, pulse, trail, rings, electrons
  if (sceneState.playerOrb) {
    const newY = 1 + Math.sin(t * 3) * 0.2;
    sceneState.playerOrb.position.y = newY;
    sceneState.playerOrb.rotation.y = t * 1.5;
    sceneState.orbShell.rotation.x = t * 0.5;
    sceneState.orbShell.rotation.z = t * 0.7;
    sceneState.orbShell.material.opacity = 0.2 + Math.sin(t * 5) * 0.15;

    // Orb trail
    for (let i = sceneState.orbTrailPositions.length - 1; i > 0; i--) {
      sceneState.orbTrailPositions[i].copy(sceneState.orbTrailPositions[i - 1]);
    }
    sceneState.orbTrailPositions[0].copy(sceneState.playerOrb.position);
    for (let i = 0; i < sceneState.orbTrailMeshes.length; i++) {
      sceneState.orbTrailMeshes[i].position.copy(sceneState.orbTrailPositions[i]);
      sceneState.orbTrailMeshes[i].material.opacity = (1 - i / 8) * 0.18;
    }

    // Electron micro-particles
    sceneState.playerOrb.children.forEach((child) => {
      if (child.userData.electronIndex !== undefined) {
        const idx = child.userData.electronIndex;
        const angle = t * 3 + (idx * Math.PI * 2 / 8);
        const r = 0.9 + Math.sin(t * 2 + idx) * 0.1;
        child.position.set(
          Math.cos(angle) * r,
          Math.sin(angle * 1.3) * 0.4,
          Math.sin(angle) * r
        );
      }
    });

    // Orb rings spin
    for (let i = 0; i < sceneState.orbRings.length; i++) {
      const ring = sceneState.orbRings[i];
      ring.rotation.y = t * (1 + i * 0.5) + ring.userData.phase;
      ring.rotation.x = t * (0.5 + i * 0.3);
    }
  }

  // Pillar lights breathing / flickering
  for (let i = 0; i < sceneState.pillars.length; i++) {
    const p = sceneState.pillars[i];
    if (sceneState.isCollapsingReality) {
      // Crack and flicker lights irregularly (Day 30)
      p.light.intensity = Math.random() > 0.45 ? 1.5 : 0.05;
      p.mesh.rotation.y += delta * (Math.random() - 0.5) * 2.0; // wobble mesh
    } else {
      const offset = p.index * Math.PI; // Opposite pulsing
      p.light.intensity = 0.5 + Math.sin(t * 2 + offset) * 0.5;
      p.mesh.rotation.y = 0;
    }
  }

  // Starfield un-scatter and collapse acceleration
  if (sceneState.starfield) {
    if (sceneState.isCollapsingReality) {
      // Accelerating in one direction (Day 30)
      sceneState.starfield.rotation.y += delta * 1.2;
      sceneState.starfield.position.y -= delta * 4.0;
    } else {
      sceneState.starfield.rotation.y = t * 0.05;
      sceneState.starfield.rotation.x = t * 0.02;

      // Smoothly drift back scattered stars
      if (sceneState.starOrigPositions) {
        const posAttr = sceneState.starfield.geometry.attributes.position;
        const arr = posAttr.array;
        const orig = sceneState.starOrigPositions;
        let dirty = false;
        for (let j = 0; j < arr.length; j++) {
          const diff = orig[j] - arr[j];
          if (Math.abs(diff) > 0.01) {
            arr[j] += diff * delta * 2.5;
            dirty = true;
          }
        }
        if (dirty) posAttr.needsUpdate = true;
      }
    }
  }

  // Floor plane warp on Collapse (Day 30)
  if (effectsState.gridMesh) {
    const posAttr = effectsState.gridMesh.geometry.attributes.position;
    const arr = posAttr.array;
    if (sceneState.isCollapsingReality) {
      // Warps vertices up/down using wave pattern
      for (let j = 0; j < arr.length; j += 3) {
        const gx = arr[j];
        const gy = arr[j+1];
        arr[j+2] = Math.sin(gx * 0.15 + t * 5.0) * Math.cos(gy * 0.15 + t * 4.0) * 0.6;
      }
      posAttr.needsUpdate = true;

      // Random grid lines flicker
      effectsState.gridMesh.material.opacity = Math.random() > 0.12 ? 0.95 : 0.0;
    } else {
      // Flatten back
      let dirty = false;
      for (let j = 0; j < arr.length; j += 3) {
        if (arr[j+2] !== 0.0) {
          arr[j+2] += (0.0 - arr[j+2]) * delta * 5.0;
          if (Math.abs(arr[j+2]) < 0.01) arr[j+2] = 0.0;
          dirty = true;
        }
      }
      if (dirty) posAttr.needsUpdate = true;
      effectsState.gridMesh.material.opacity = 0.95;
    }
  }

  // Explosions (use rawDelta for full speed during slow mo)
  for (let i = sceneState.explosions.length - 1; i >= 0; i--) {
    const e = sceneState.explosions[i];
    e.age++;
    const posAttr = e.mesh.geometry.attributes.position;
    for (let j = 0; j < e.velocities.length; j++) {
      posAttr.array[j*3] += e.velocities[j].x * rawDelta;
      posAttr.array[j*3+1] += e.velocities[j].y * rawDelta;
      posAttr.array[j*3+2] += e.velocities[j].z * rawDelta;
    }
    posAttr.needsUpdate = true;
    e.mesh.material.opacity = 1 - (e.age / e.maxAge);
    
    if (e.age >= e.maxAge) {
      sceneState.scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      sceneState.explosions.splice(i, 1);
    }
  }

  // Screen shake
  if (sceneState.shakeTime > 0) {
    const dx = (Math.random() - 0.5) * sceneState.shakeTime * 2;
    const dy = (Math.random() - 0.5) * sceneState.shakeTime * 2;
    sceneState.overlayEl.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
    sceneState.shakeTime--;
  } else {
    sceneState.overlayEl.style.transform = 'translate(0px, 0px)';
  }

  updateEffects(delta, time);

  sceneState.renderer.render(sceneState.scene, sceneState.camera);
}

export function triggerRealityCollapse() {
  sceneState.isCollapsingReality = true;
  enableScanlines();
}

export function reverseRealityCollapse() {
  sceneState.isCollapsingReality = false;
  disableScanlines();
  setSaturateMode(false);
  if (sceneState.ambientLight) {
    sceneState.ambientLight.intensity = 0.2;
  }
  for (const p of sceneState.pillars) {
    p.light.intensity = 1.0;
  }
}
