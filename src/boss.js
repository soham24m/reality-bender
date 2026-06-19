import { sceneState, createExplosion } from './scene.js';
import { takeDamage, addScore } from './combat.js';
import { playBossHit } from './audio.js';

export const bossState = {
  isActive: false,
  mesh: null,
  shieldMesh: null,
  hp: 400,
  maxHp: 400,
  phase: 1,
  gestureHistory: [],
  isShielded: false,
  shieldTimer: 0,
  projectiles: [],
  lastAtkTime: 0,
  actionState: 'approach', // approach, circle, shield, retreat
  actionTimer: 0,
  frozenUntil: 0,
  uiContainer: null,
  uiHpFill: null,
  uiThought: null,
  uiStance: null,
  fightStartTime: 0,
  isEnraged: false,
  counterTimer: 0
};

export function spawnBoss() {
  bossState.isActive = true;
  bossState.hp = 400;
  bossState.phase = 1;
  bossState.actionState = 'approach';
  bossState.fightStartTime = performance.now();
  bossState.isEnraged = false;
  
  const geo = new THREE.IcosahedronGeometry(3.0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff4400, wireframe: false });
  bossState.mesh = new THREE.Mesh(geo, mat);
  
  const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.6 });
  const wireMesh = new THREE.Mesh(geo, wireMat);
  wireMesh.scale.set(1.05, 1.05, 1.05);
  bossState.mesh.add(wireMesh);

  const shieldGeo = new THREE.SphereGeometry(4.5, 16, 16);
  const shieldMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.0 });
  bossState.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  bossState.mesh.add(bossState.shieldMesh);

  bossState.mesh.position.set(0, 5, -20);
  sceneState.scene.add(bossState.mesh);

  createBossUI();
}

export function createBossUI() {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '20px';
  container.style.left = '50%';
  container.style.transform = 'translateX(-50%)';
  container.style.width = '60%';
  container.style.zIndex = '15';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';

  const label = document.createElement('div');
  label.textContent = 'REALITY CORE ANOMALY';
  label.style.color = 'white';
  label.style.fontFamily = 'sans-serif';
  label.style.fontSize = '14px';
  label.style.fontWeight = 'bold';
  label.style.letterSpacing = '0.2em';
  label.style.marginBottom = '5px';
  label.style.textShadow = '0 0 10px #ff0000';
  container.appendChild(label);

  const track = document.createElement('div');
  track.style.width = '100%';
  track.style.height = '8px';
  track.style.background = 'rgba(255,255,255,0.1)';
  track.style.borderRadius = '4px';
  track.style.overflow = 'hidden';

  const fill = document.createElement('div');
  fill.style.width = '100%';
  fill.style.height = '100%';
  fill.style.background = '#ff4400';
  fill.style.transition = 'width 0.3s, background 0.3s';
  track.appendChild(fill);
  container.appendChild(track);

  const thought = document.createElement('div');
  thought.textContent = 'Approaching...';
  thought.style.color = 'rgba(255,255,255,0.8)';
  thought.style.fontFamily = 'sans-serif';
  thought.style.fontSize = '12px';
  thought.style.marginTop = '8px';
  thought.style.transition = 'opacity 0.3s';
  container.appendChild(thought);

  const stance = document.createElement('div');
  stance.textContent = '[STANCE: AGGRESSIVE]';
  stance.style.color = '#ff4400';
  stance.style.fontFamily = 'sans-serif';
  stance.style.fontSize = '10px';
  stance.style.marginTop = '4px';
  container.appendChild(stance);

  document.body.appendChild(container);
  bossState.uiContainer = container;
  bossState.uiHpFill = fill;
  bossState.uiThought = thought;
  bossState.uiStance = stance;
}

export function updateBossUI() {
  if (!bossState.isActive || !bossState.uiContainer) return;
  const pct = Math.max(0, (bossState.hp / bossState.maxHp) * 100);
  bossState.uiHpFill.style.width = pct + '%';

  if (bossState.phase === 1) bossState.uiHpFill.style.background = '#ff4400';
  else if (bossState.phase === 2) bossState.uiHpFill.style.background = '#ff8800';
  else bossState.uiHpFill.style.background = '#ff0044';
}

export function setBossThought(text) {
  if (bossState.uiThought) {
    bossState.uiThought.style.opacity = '0';
    setTimeout(() => {
      if (bossState.uiThought) {
        bossState.uiThought.textContent = text;
        bossState.uiThought.style.opacity = '1';
      }
    }, 300);
  }
}

export function trackPlayerGesture(gesture) {
  if (bossState.isActive) {
    const center = sceneState.playerOrb ? sceneState.playerOrb.position : new THREE.Vector3(0,0,0);
    const dist = bossState.mesh ? bossState.mesh.position.distanceTo(center) : 10;
    
    bossState.gestureHistory.push({ gesture, time: performance.now(), dist });
    if (bossState.gestureHistory.length > 10) bossState.gestureHistory.shift();

    if (gesture === 'FIST' && Math.random() < 0.3) {
      // Counter attack volley
      bossState.actionState = 'counter';
      bossState.counterTimer = 3; // 3 shots
      setBossThought('Countering FIST strike!');
      updateStanceUI('COUNTER', '#ff0000');
    }
  }
}

export function getMostUsedGesture() {
  const counts = {};
  let maxCount = 0;
  let mostUsed = null;
  for (let i = 0; i < bossState.gestureHistory.length; i++) {
    const g = bossState.gestureHistory[i].gesture;
    counts[g] = (counts[g] || 0) + 1;
    if (counts[g] > maxCount) {
      maxCount = counts[g];
      mostUsed = g;
    }
  }
  return mostUsed;
}

export function updateStanceUI(stanceName, color) {
  if (bossState.uiStance) {
    bossState.uiStance.textContent = '[STANCE: ' + stanceName + ']';
    bossState.uiStance.style.color = color;
  }
}

export function getRandomTaunt(phase) {
  const taunts = [
    'Analyzing anomaly patterns...',
    'Your movements are predictable.',
    'System recalibrating defenses...',
    'Is that the extent of your reality manipulation?',
    'Error: Threat level insufficient.',
    'I have calculated your next strike.',
    'Your gestures are sluggish.',
    'Inefficient pattern detected.'
  ];
  return taunts[Math.floor(Math.random() * taunts.length)];
}

export function updateBoss(delta) {
  if (!bossState.isActive || !bossState.mesh) return;
  const now = performance.now();

  // Handle phase changes
  const hpPct = bossState.hp / bossState.maxHp;
  if (bossState.phase === 1 && hpPct <= 0.5) {
    bossState.phase = 2;
    bossState.mesh.scale.set(0.8, 0.8, 0.8);
    bossState.mesh.material.color.setHex(0xff8800);
  } else if (bossState.phase === 2 && hpPct <= 0.2) {
    bossState.phase = 3;
    bossState.mesh.scale.set(0.6, 0.6, 0.6);
    bossState.mesh.material.color.setHex(0xff0044);
  }

  updateBossUI();

  // Enrage Timer Check
  if (!bossState.isEnraged && now - bossState.fightStartTime > 90000) {
    bossState.isEnraged = true;
    setBossThought('CRITICAL TIMEOUT: MAXIMUM OVERDRIVE ENGAGED');
    updateStanceUI('ENRAGED', '#ff0000');
    bossState.mesh.scale.set(bossState.mesh.scale.x * 1.2, bossState.mesh.scale.y * 1.2, bossState.mesh.scale.z * 1.2);
  }

  // Rotation speed based on phase and enrage
  const rotMult = bossState.isEnraged ? 1.5 : 1;
  bossState.mesh.rotation.y += delta * (0.5 * bossState.phase * rotMult);
  bossState.mesh.rotation.x += delta * (0.2 * bossState.phase * rotMult);

  if (now < bossState.frozenUntil) {
    bossState.mesh.material.color.setHex(0x4444ff);
    return;
  } else {
    // Restore color based on phase
    if (bossState.phase === 1) bossState.mesh.material.color.setHex(0xff4400);
    else if (bossState.phase === 2) bossState.mesh.material.color.setHex(0xff8800);
    else bossState.mesh.material.color.setHex(0xff0044);
  }

  // AI Logic
  bossState.actionTimer -= delta * 1000;
  if (bossState.actionTimer <= 0) {
    chooseNextAction();
  }

  executeAction(delta);

  if (bossState.actionState === 'counter' && bossState.counterTimer > 0) {
    if (now - bossState.lastAtkTime > 200) {
      fireBossProjectile();
      bossState.lastAtkTime = now;
      bossState.counterTimer--;
      if (bossState.counterTimer <= 0) {
        bossState.actionState = 'circle';
      }
    }
  } else {
    // Regular Firing projectiles
    const fireCd = (2500 / bossState.phase) * (bossState.isEnraged ? 0.7 : 1);
    if (now - bossState.lastAtkTime > fireCd && !bossState.isShielded) {
      fireBossProjectile();
      bossState.lastAtkTime = now;
    }
  }

  updateBossProjectiles(delta);
}

export function chooseNextAction() {
  const mostUsed = getMostUsedGesture();
  bossState.actionTimer = 3000; // 3 seconds per action state
  
  if (mostUsed === 'FIST' && Math.random() > 0.3) {
    bossState.actionState = 'shield';
    bossState.isShielded = true;
    bossState.shieldMesh.material.opacity = 0.4;
    setBossThought('Shielding from FIST spam...');
    updateStanceUI('DEFENSIVE', '#00ffff');
    bossState.actionTimer = 2000;
  } else {
    bossState.isShielded = false;
    bossState.shieldMesh.material.opacity = 0.0;
    
    const r = Math.random();
    if (r < 0.4) {
      bossState.actionState = 'circle';
      setBossThought(getRandomTaunt());
      updateStanceUI('EVASIVE', '#ffff00');
    } else if (r < 0.7) {
      bossState.actionState = 'approach';
      setBossThought('Closing in...');
      updateStanceUI('AGGRESSIVE', '#ff4400');
    } else {
      bossState.actionState = 'retreat';
      setBossThought(getRandomTaunt());
      updateStanceUI('BALANCED', '#ffffff');
    }
  }
}

export function executeAction(delta) {
  const center = sceneState.playerOrb ? sceneState.playerOrb.position : new THREE.Vector3(0,0,0);
  const pos = bossState.mesh.position;
  const dist = pos.distanceTo(center);

  let speed = 2.0 * bossState.phase * (bossState.isEnraged ? 1.2 : 1);

  if (bossState.actionState === 'approach') {
    if (dist > 8) {
      const dir = new THREE.Vector3().subVectors(center, pos).normalize();
      pos.addScaledVector(dir, speed * delta);
    }
  } else if (bossState.actionState === 'retreat') {
    if (dist < 20) {
      const dir = new THREE.Vector3().subVectors(pos, center).normalize();
      pos.addScaledVector(dir, speed * delta);
    }
  } else if (bossState.actionState === 'circle') {
    const dirToCenter = new THREE.Vector3().subVectors(center, pos).normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(dirToCenter).normalize();
    pos.addScaledVector(right, speed * delta);
    // keep distance roughly 15
    if (dist > 16) pos.addScaledVector(dirToCenter, speed * delta * 0.5);
    if (dist < 14) pos.addScaledVector(dirToCenter, -speed * delta * 0.5);
  }
}

export function fireBossProjectile() {
  const center = sceneState.playerOrb ? sceneState.playerOrb.position : new THREE.Vector3(0,0,0);
  const dir = new THREE.Vector3().subVectors(center, bossState.mesh.position).normalize();
  
  const geo = new THREE.SphereGeometry(0.5, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const proj = new THREE.Mesh(geo, mat);
  proj.position.copy(bossState.mesh.position);
  sceneState.scene.add(proj);

  bossState.projectiles.push({
    mesh: proj,
    dir: dir,
    speed: 10 + (bossState.phase * 5),
    age: 0
  });
}

export function updateBossProjectiles(delta) {
  const center = sceneState.playerOrb ? sceneState.playerOrb.position : new THREE.Vector3(0,0,0);
  for (let i = bossState.projectiles.length - 1; i >= 0; i--) {
    const p = bossState.projectiles[i];
    p.mesh.position.addScaledVector(p.dir, p.speed * delta);
    p.age++;

    if (p.mesh.position.distanceTo(center) < 1.5) {
      takeDamage(10 * bossState.phase);
      sceneState.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      bossState.projectiles.splice(i, 1);
    } else if (p.age > 120) {
      sceneState.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      bossState.projectiles.splice(i, 1);
    }
  }
}

export function damageBoss(amount) {
  if (!bossState.isActive) return;
  if (bossState.isShielded) {
    // Shield blocks damage
    return;
  }

  bossState.hp -= amount;
  playBossHit(bossState.phase);
  
  bossState.mesh.material.color.setHex(0xffffff);
  setTimeout(() => {
    if (bossState.mesh) {
      if (bossState.phase === 1) bossState.mesh.material.color.setHex(0xff4400);
      else if (bossState.phase === 2) bossState.mesh.material.color.setHex(0xff8800);
      else bossState.mesh.material.color.setHex(0xff0044);
    }
  }, 100);

  if (bossState.hp <= 0) {
    bossDefeated();
  }
}

export function bossDefeated() {
  createExplosion(bossState.mesh.position, 0xff0000);
  createExplosion(bossState.mesh.position, 0xff8800);
  createExplosion(bossState.mesh.position, 0xffffff);
  
  sceneState.scene.remove(bossState.mesh);
  bossState.mesh.geometry.dispose();
  bossState.mesh.material.dispose();
  bossState.isActive = false;
  
  if (bossState.uiContainer) {
    bossState.uiContainer.remove();
    bossState.uiContainer = null;
  }
  
  addScore(5000);
  if (bossState.onDefeat) {
    bossState.onDefeat();
  }
}
