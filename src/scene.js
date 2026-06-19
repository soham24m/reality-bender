export const sceneState = {
  scene: null,
  camera: null,
  renderer: null,
  playerOrb: null,
  orbShell: null,
  pillars: [],
  debrisParticles: null,
  starfield: null,
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
  cinematicTimer: 0
};

export function initScene(canvasElement) {
  sceneState.overlayEl = canvasElement;
  sceneState.scene = new THREE.Scene();
  sceneState.scene.background = null; // Transparent background
  
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
}

export function onWindowResize() {
  sceneState.camera.aspect = window.innerWidth / window.innerHeight;
  sceneState.camera.updateProjectionMatrix();
  sceneState.renderer.setSize(window.innerWidth, window.innerHeight);
}

export function createEnvironment() {
  // Floor and Grid
  const floorGeo = new THREE.PlaneGeometry(60, 60);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  sceneState.scene.add(floor);

  const grid = new THREE.GridHelper(60, 40, 0x222222, 0x111111);
  sceneState.scene.add(grid);
  sceneState.gridHelper = grid;

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
}

export function triggerScreenShake(intensity = 1.0) {
  sceneState.shakeTime = 15 * intensity;
}

export function createExplosion(position, colorStr) {
  const count = 40 + Math.floor(Math.random() * 40); // 40-80 particles
  const geo = new THREE.BufferGeometry();
  const posArray = new Float32Array(count * 3);
  const vels = [];
  const color = new THREE.Color(colorStr);

  for (let i = 0; i < count; i++) {
    posArray[i * 3] = position.x;
    posArray[i * 3 + 1] = position.y;
    posArray[i * 3 + 2] = position.z;
    vels.push({
      x: (Math.random() - 0.5) * 0.5,
      y: (Math.random() - 0.5) * 0.5,
      z: (Math.random() - 0.5) * 0.5
    });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const mat = new THREE.PointsMaterial({ color: color, size: 0.2, transparent: true, opacity: 1.0 });
  const points = new THREE.Points(geo, mat);
  sceneState.scene.add(points);
  
  sceneState.explosions.push({ mesh: points, velocities: vels, age: 0, maxAge: 60 });
}

export function reportCombatActivity() {
  sceneState.lastCombatTime = performance.now();
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

export function updateScene(time) {
  const t = time * 0.001;
  const delta = 1/60; // Approximate for transition effects if needed

  // Cinematic Intro
  if (sceneState.isCinematic) {
    sceneState.cinematicTimer -= delta;
    sceneState.camera.position.lerp(new THREE.Vector3(0, 6, 12), 0.05);
    sceneState.camera.lookAt(0, 0, 0);
    if (sceneState.cinematicTimer <= 0) {
      sceneState.isCinematic = false;
    }
  } else {
    // Camera Idle Sway
    if (performance.now() - sceneState.lastCombatTime > 2000) {
      sceneState.cameraSwayTime += delta;
      const swayX = Math.sin(sceneState.cameraSwayTime * 0.5) * 1.5;
      const swayY = 6 + Math.sin(sceneState.cameraSwayTime * 0.3) * 0.5;
      const swayZ = 12 + Math.cos(sceneState.cameraSwayTime * 0.4) * 1.0;
      
      // Smoothly interpolate camera to swayed position
      sceneState.camera.position.lerp(new THREE.Vector3(swayX, swayY, swayZ), 0.05);
      sceneState.camera.lookAt(0, 0, 0);
    } else {
      // Return to center when active
      sceneState.camera.position.lerp(new THREE.Vector3(0, 6, 12), 0.1);
      sceneState.camera.lookAt(0, 0, 0);
    }
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
    sceneState.starfield.rotation.y = t * 0.02;
  }

  // Debris drifting and wrapping
  if (sceneState.debrisParticles) {
    const posAttr = sceneState.debrisParticles.geometry.attributes.position;
    const vels = sceneState.debrisParticles.userData.velocities;
    for (let i = 0; i < 120; i++) {
      let x = posAttr.getX(i) + vels[i].x;
      let y = posAttr.getY(i) + vels[i].y;
      let z = posAttr.getZ(i) + vels[i].z;
      if (x > 30) x = -30;
      if (x < -30) x = 30;
      if (y > 20) y = 0;
      if (y < 0) y = 20;
      if (z > 30) z = -30;
      if (z < -30) z = 30;
      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  }

  // Player orb hover and pulse
  if (sceneState.playerOrb) {
    sceneState.playerOrb.position.y = 1 + Math.sin(t * 3) * 0.2;
    sceneState.playerOrb.rotation.y = t * 1.5;
    sceneState.orbShell.rotation.x = t * 0.5;
    sceneState.orbShell.rotation.z = t * 0.7;
    sceneState.orbShell.material.opacity = 0.2 + Math.sin(t * 5) * 0.15;
  }

  // Pillar lights breathing
  for (let i = 0; i < sceneState.pillars.length; i++) {
    const p = sceneState.pillars[i];
    const offset = p.index * Math.PI; // Opposite pulsing
    p.light.intensity = 0.5 + Math.sin(t * 2 + offset) * 0.5;
  }

  // Explosions
  for (let i = sceneState.explosions.length - 1; i >= 0; i--) {
    const exp = sceneState.explosions[i];
    exp.age++;
    const posAttr = exp.mesh.geometry.attributes.position;
    for (let j = 0; j < exp.velocities.length; j++) {
      let x = posAttr.getX(j) + exp.velocities[j].x;
      let y = posAttr.getY(j) + exp.velocities[j].y;
      let z = posAttr.getZ(j) + exp.velocities[j].z;
      posAttr.setXYZ(j, x, y, z);
    }
    posAttr.needsUpdate = true;
    exp.mesh.material.opacity = 1.0 - (exp.age / exp.maxAge);
    if (exp.age >= exp.maxAge) {
      sceneState.scene.remove(exp.mesh);
      exp.mesh.geometry.dispose();
      exp.mesh.material.dispose();
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

  sceneState.renderer.render(sceneState.scene, sceneState.camera);
}
