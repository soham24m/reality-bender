/**
 * enemies.js — Enemy types, spawning, wave management, and AI behavior
 * Manages: DRONE/FIGHTER/ELITE enemy definitions, wave waves, flocking,
 *           windup charging, ELITE dodging, idle behaviors
 * Imports: sceneState, createExplosion from scene.js; combat functions
 * Exports: enemyTypes, enemiesState, spawnEnemy, startWave,
 *          updateEnemies, damageEnemy, checkWaveClear, resetEnemies
 */

import { sceneState, createExplosion, transitionToSecondArena, createSpawnTelegraph } from './scene.js';
import { takeDamage, registerKill, addScore, getAverageEnemyHP, combatState } from './combat.js';
import { updateHP } from './ui.js';
import { playEnemyDefeat } from './audio.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYER_ATTACK_RANGE = 3.0;
const DRONE_FLOCK_RADIUS = 8.0;
const FLOCK_WEIGHT = 0.25;
const PLAYER_WEIGHT = 0.75;
const FIGHTER_WINDUP_DURATION = 0.4;
const FIGHTER_BURST_SPEED_MULT = 4.0;
const ELITE_DODGE_CHANCE = 0.4;
const ELITE_DODGE_DIST_TRIGGER = 3.0;
const IDLE_DISTANCE_THRESHOLD = 12.0;

// ─── Enemy Definitions ────────────────────────────────────────────────────────
export const enemyTypes = {
  DRONE:   { hp: 30,  speed: 4.0, color: 0x00ff00, geo: 'sphere',      points: 100, dmg: 5,  atkCd: 1000 },
  FIGHTER: { hp: 60,  speed: 2.5, color: 0xff0000, geo: 'octahedron',  points: 250, dmg: 15, atkCd: 1500 },
  ELITE:   { hp: 120, speed: 1.2, color: 0xaa00ff, geo: 'icosahedron', points: 600, dmg: 30, atkCd: 2000 }
};

// ─── State ────────────────────────────────────────────────────────────────────
export const enemiesState = {
  enemies: [],
  ghosts: [],
  currentWave: 0,
  waveInProgress: false,
  waves: [
    ['DRONE', 'DRONE', 'DRONE'],
    ['DRONE', 'DRONE', 'DRONE', 'FIGHTER'],
    ['DRONE', 'DRONE', 'FIGHTER', 'FIGHTER', 'ELITE'],
    ['FIGHTER', 'FIGHTER', 'FIGHTER', 'ELITE', 'ELITE']
  ],
  onWaveClear: null
};

// ─── Spawning ─────────────────────────────────────────────────────────────────

export function spawnEnemy(typeStr, pos) {
  const t = enemyTypes[typeStr];
  let geo;
  if (t.geo === 'sphere')      geo = new THREE.SphereGeometry(0.8, 8, 8);
  else if (t.geo === 'octahedron')  geo = new THREE.OctahedronGeometry(1.2);
  else if (t.geo === 'icosahedron') geo = new THREE.IcosahedronGeometry(1.6);

  const mat = new THREE.MeshBasicMaterial({ color: t.color, wireframe: false });
  const mesh = new THREE.Mesh(geo, mat);

  const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 });
  const wireMesh = new THREE.Mesh(geo, wireMat);
  wireMesh.scale.set(1.1, 1.1, 1.1);
  mesh.add(wireMesh);

  const light = new THREE.PointLight(t.color, 1, 10);
  mesh.add(light);

  mesh.position.copy(pos);
  sceneState.scene.add(mesh);

  enemiesState.enemies.push({
    type: t,
    typeStr: typeStr,
    mesh: mesh,
    hp: t.hp,
    maxHp: t.hp,
    lastAtkTime: 0,
    frozenUntil: 0,
    windupTimer: 0,
    isWindingUp: false,
    lastDodgeTime: 0
  });
}

export function startWave(waveIndex) {
  if (waveIndex >= enemiesState.waves.length) return;

  if (waveIndex === 2) {
    transitionToSecondArena();
  }

  enemiesState.currentWave = waveIndex;
  enemiesState.waveInProgress = true;

  const waveDef = enemiesState.waves[waveIndex];
  for (let i = 0; i < waveDef.length; i++) {
    const angle = (Math.PI * 2 / waveDef.length) * i;
    const dist = 15 + Math.random() * 10;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const pos = new THREE.Vector3(x, 1, z);

    createSpawnTelegraph(pos);
    // Capture i in closure
    const capturedType = waveDef[i];
    const capturedPos = pos;
    setTimeout(() => {
      spawnEnemy(capturedType, capturedPos);
    }, 1000);
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function updateEnemies(delta) {
  const center = sceneState.playerOrb ? sceneState.playerOrb.position : new THREE.Vector3(0, 0, 0);
  const now = performance.now();
  const freezeActive = combatState.temporalFreezeLeft > 0;

  // Update ghosts (Day 29)
  for (let i = enemiesState.ghosts.length - 1; i >= 0; i--) {
    const g = enemiesState.ghosts[i];
    g.age += delta;
    g.mesh.position.y += delta * 1.5; // drift upward
    g.mesh.material.opacity = (1.0 - (g.age / g.maxAge)) * 0.4;
    
    if (g.age >= g.maxAge) {
      sceneState.scene.remove(g.mesh);
      g.mesh.geometry.dispose();
      g.mesh.material.dispose();
      enemiesState.ghosts.splice(i, 1);
    }
  }

  // Count drones for flocking
  const drones = enemiesState.enemies.filter(e => e.typeStr === 'DRONE');
  let flockCenter = new THREE.Vector3();
  if (drones.length >= 3) {
    for (const d of drones) flockCenter.add(d.mesh.position);
    flockCenter.divideScalar(drones.length);
  }

  for (let i = enemiesState.enemies.length - 1; i >= 0; i--) {
    const e = enemiesState.enemies[i];

    // Jitter recovery effect from freeze unfreeze
    if (!freezeActive && e.jitterTimer > 0) {
      e.jitterTimer -= delta;
      e.mesh.position.x += (Math.random() - 0.5) * 0.4;
      e.mesh.position.z += (Math.random() - 0.5) * 0.4;
    }

    // Idle animation (bob + slow rotation when far)
    const distToPlayer = e.mesh.position.distanceTo(center);
    e.mesh.rotation.y += delta * (distToPlayer > IDLE_DISTANCE_THRESHOLD ? 0.5 : 2);
    if (distToPlayer > IDLE_DISTANCE_THRESHOLD) {
      e.mesh.position.y = 1 + Math.sin(now * 0.001 + i) * 0.3;
    }

    // Skip AI action if frozen
    if (freezeActive) {
      e.mesh.material.color.setHex(0x0000ff);
      e.jitterTimer = 0.5; // Setup jitter for when unfreezing
      continue;
    }

    if (now < e.frozenUntil) {
      e.mesh.material.color.setHex(0x4444ff);
      continue;
    } else {
      e.mesh.material.color.setHex(e.type.color);
    }

    // Wave aggression scaling — wave 4 enemies attack 50% faster
    const aggressionMult = 1.0 - (enemiesState.currentWave * 0.12);
    const effectiveAtkCd = e.type.atkCd * Math.max(0.5, aggressionMult);

    if (distToPlayer > PLAYER_ATTACK_RANGE) {
      updateEnemyMovement(e, center, delta, drones, flockCenter);
    } else {
      // Vibrate / attack
      e.mesh.position.x += (Math.random() - 0.5) * 0.2;
      e.mesh.position.y += (Math.random() - 0.5) * 0.1;
      e.mesh.position.z += (Math.random() - 0.5) * 0.2;
      e.mesh.position.y = Math.max(0.5, e.mesh.position.y);

      if (now - e.lastAtkTime > effectiveAtkCd) {
        takeDamage(e.type.dmg);
        e.lastAtkTime = now;
      }
    }
  }
}

export function updateEnemyMovement(e, center, delta, drones, flockCenter) {
  const typeStr = e.typeStr;

  if (typeStr === 'DRONE' && drones.length >= 3) {
    // Flocking: blend toward flock center + player
    const toFlock = new THREE.Vector3().subVectors(flockCenter, e.mesh.position).normalize();
    const toPlayer = new THREE.Vector3().subVectors(center, e.mesh.position).normalize();
    const dir = new THREE.Vector3()
      .addScaledVector(toFlock, FLOCK_WEIGHT)
      .addScaledVector(toPlayer, PLAYER_WEIGHT)
      .normalize();
    e.mesh.position.addScaledVector(dir, e.type.speed * delta);

  } else if (typeStr === 'FIGHTER') {
    // Windup telegraph before burst
    if (e.isWindingUp) {
      e.windupTimer -= delta;
      // Move slightly backward
      const away = new THREE.Vector3().subVectors(e.mesh.position, center).normalize();
      e.mesh.position.addScaledVector(away, e.type.speed * delta * 0.5);

      if (e.windupTimer <= 0) {
        e.isWindingUp = false;
      }
    } else {
      const dist = e.mesh.position.distanceTo(center);
      if (dist > 8 && Math.random() < 0.005) {
        // Trigger windup
        e.isWindingUp = true;
        e.windupTimer = FIGHTER_WINDUP_DURATION;
      } else if (!e.isWindingUp) {
        const speedMult = e.windupTimer <= 0 ? 1.0 : FIGHTER_BURST_SPEED_MULT;
        const dir = new THREE.Vector3().subVectors(center, e.mesh.position).normalize();
        e.mesh.position.addScaledVector(dir, e.type.speed * delta * speedMult);
      }
    }
  } else {
    // Default: move toward player
    const dir = new THREE.Vector3().subVectors(center, e.mesh.position).normalize();
    e.mesh.position.addScaledVector(dir, e.type.speed * delta);
  }
}

export function checkEnemyProjectileDodge(enemy, projectilePos, projectileDir) {
  if (enemy.typeStr !== 'ELITE') return false;
  const now = performance.now();
  if (now - enemy.lastDodgeTime < 2000) return false;

  const dist = enemy.mesh.position.distanceTo(projectilePos);
  if (dist > ELITE_DODGE_DIST_TRIGGER) return false;
  if (Math.random() > ELITE_DODGE_CHANCE) return false;

  // Sidestep perpendicular to projectile
  const right = new THREE.Vector3(-projectileDir.z, 0, projectileDir.x).normalize();
  const sign = Math.random() > 0.5 ? 1 : -1;
  enemy.mesh.position.addScaledVector(right, sign * 3.0);
  enemy.lastDodgeTime = now;
  return true;
}

// ─── Damage ───────────────────────────────────────────────────────────────────

export function damageEnemy(index, amount) {
  const e = enemiesState.enemies[index];
  if (!e) return;
  e.hp -= amount;

  e.mesh.material.color.setHex(0xffffff);
  setTimeout(() => {
    if (e && e.mesh) e.mesh.material.color.setHex(e.type.color);
  }, 100);

  if (e.hp <= 0) {
    playEnemyDefeat();
    createExplosion(e.mesh.position, e.type.color);

    // Create Translucent Ghost (Day 29)
    const isCombo = combatState.comboMultiplier > 1;
    const ghostDuration = isCombo ? 6.0 : 3.0;
    const ghostGeo = e.mesh.geometry.clone();
    const ghostMat = new THREE.MeshBasicMaterial({
      color: e.type.color,
      transparent: true,
      opacity: 0.35,
      wireframe: true
    });
    const ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
    ghostMesh.position.copy(e.mesh.position);
    sceneState.scene.add(ghostMesh);
    enemiesState.ghosts.push({
      mesh: ghostMesh,
      age: 0,
      maxAge: ghostDuration
    });

    sceneState.scene.remove(e.mesh);
    e.mesh.geometry.dispose();
    e.mesh.material.dispose();
    enemiesState.enemies.splice(index, 1);

    registerKill();
    addScore(e.type.points);
    checkWaveClear();
  }
}

export function checkWaveClear() {
  if (enemiesState.enemies.length === 0 && enemiesState.waveInProgress) {
    enemiesState.waveInProgress = false;
    if (enemiesState.onWaveClear) {
      enemiesState.onWaveClear(enemiesState.currentWave);
    }
  }
}

export function resetEnemies() {
  for (let i = enemiesState.enemies.length - 1; i >= 0; i--) {
    const e = enemiesState.enemies[i];
    sceneState.scene.remove(e.mesh);
    e.mesh.geometry.dispose();
    e.mesh.material.dispose();
  }
  enemiesState.enemies = [];

  for (let i = enemiesState.ghosts.length - 1; i >= 0; i--) {
    const g = enemiesState.ghosts[i];
    sceneState.scene.remove(g.mesh);
    g.mesh.geometry.dispose();
    g.mesh.material.dispose();
  }
  enemiesState.ghosts = [];

  enemiesState.currentWave = 0;
  enemiesState.waveInProgress = false;
}
