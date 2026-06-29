/**
 * combat.js — Combat physics, gestures, projectiles, and reality bending mechanics
 * Manages: temporal freeze, gravity well charges, rifts/powerups,
 *           combat combos, and reality echo modes.
 */

import { sceneState, triggerScreenShake, reportCombatActivity, notifyHitAtPosition, notifyPlayerHP } from './scene.js';
import { updateCooldown, updatePill, flashGesture, updateScore, updateHP, showComboHint } from './ui.js';
import { enemiesState, damageEnemy } from './enemies.js';
import { bossState, damageBoss, damageMinions } from './boss.js';
import { playShockwave, playShield, playLaser, playHeal, playFreeze, playComboStrike, playGravityWell, playShieldExpire, setTemporalFreezePitch } from './audio.js';
import { triggerBrightnessFlash, triggerHueRotate, triggerChromaticAberration, enableScanlines, disableScanlines, setSaturateMode } from './effects.js';

export const combatState = {
  cooldowns: {
    FIST: { cd: 1000, lastUse: 0, name: 'QUAKE', color: '#ff4444' },
    OPEN_PALM: { cd: 800, lastUse: 0, name: 'BLAST', color: '#44ffff' },
    POINT: { cd: 600, lastUse: 0, name: 'LASER', color: '#ff44ff' },
    MOUTH_OPEN: { cd: 1400, lastUse: 0, name: 'HEAL', color: '#44ff44' },
    SMILE: { cd: 1200, lastUse: 0, name: 'FREEZE', color: '#ffff44' }
  },
  projectiles: [],
  enemyProjectiles: [],
  comboCount: 0,
  comboMultiplier: 1,
  highestCombo: 0,
  lastKillTime: 0,
  playerHP: 100,
  maxPlayerHP: 100,
  lowestPreBossHP: 100,
  score: 0,
  upgrades: { damageMultiplier: 1, healAmount: 20, freezeDuration: 2000 },
  lastGesture: null,
  lastGestureTime: 0,
  hasShownComboHint: false,

  // Day 26: Gravity Well
  gravityCharge: 0.0,
  isGravityCharging: false,
  gravityWellPos: null,
  gravityWellAftermath: null, // { pos, age }

  // Day 27: Temporal Freeze
  temporalFreezeCD: 20000, // 20s
  lastTemporalFreezeTime: 0,
  temporalFreezeLeft: 0,

  // Day 28: Rift Power-Ups
  powerUps: {
    damageMult: 1.0,
    damageMultExpiry: 0,
    vulnMult: 1.0,
    vulnMultExpiry: 0
  },

  // Day 29: Reality Echo
  killHistory: [], // Timestamps of last 5 kills
  recentGestures: [], // Last 3 gestures
  echoModeActive: false,
  echoModeTimer: 0,
  echoActionTimer: 0
};

export function handleGesture(gestureStr) {
  const now = performance.now();

  // Day 27 Combo: Fist + Open Palm (or vice-versa) within 500ms triggers Temporal Freeze
  if (gestureStr === 'OPEN_PALM' && combatState.lastGesture === 'FIST' && now - combatState.lastGestureTime < 500) {
    triggerTemporalFreeze();
    combatState.lastGesture = null;
    return;
  }

  const skill = combatState.cooldowns[gestureStr];
  if (!skill) return;

  if (now - skill.lastUse >= skill.cd) {
    skill.lastUse = now;
    reportCombatActivity();
    executeSkill(gestureStr, skill);
  }
}

export function handleKeyboard(e) {
  const key = e.key.toLowerCase();
  let gesture = null;
  if (key === 'f') gesture = 'FIST';
  if (key === 'p') gesture = 'OPEN_PALM';
  if (key === 'l') gesture = 'POINT';
  if (key === 'm') gesture = 'MOUTH_OPEN';
  if (key === 's') gesture = 'SMILE';

  if (gesture) handleGesture(gesture);
}

export function executeSkill(gesture, skill) {
  updatePill(skill.name, 'FIRING', true);
  setTimeout(resetPill, 300);
  flashGesture(skill.name, skill.color);

  // Track recent gestures for reality echo
  combatState.recentGestures.push(gesture);
  if (combatState.recentGestures.length > 3) {
    combatState.recentGestures.shift();
  }

  let dmgMulti = combatState.upgrades.damageMultiplier * getRiftDamageMult();
  const now = performance.now();

  // Combo Check: FIST then POINT within 1000ms
  if (gesture === 'POINT' && combatState.lastGesture === 'FIST' && now - combatState.lastGestureTime < 1000) {
    playComboStrike();
    triggerScreenShake(0.4);
    triggerHueRotate();
    triggerChromaticAberration();
    damageAllEnemies(100 * dmgMulti, 50);
    fireProjectile(100 * dmgMulti, 0xffff00);

    if (!combatState.hasShownComboHint) {
      combatState.hasShownComboHint = true;
      showComboHint('✦ COMBO STRIKE — FIST + POINT ✦');
    }
    combatState.lastGesture = null;
    return;
  }

  combatState.lastGesture = gesture;
  combatState.lastGestureTime = now;

  triggerScreenShake(0.5);

  if (gesture === 'FIST') {
    playShockwave();
    triggerBrightnessFlash();
    triggerScreenShake(0.2);
    damageAllEnemies(40 * dmgMulti, 20);
  } else if (gesture === 'OPEN_PALM') {
    playShield();
    damageAllEnemies(20 * dmgMulti, 40);
  } else if (gesture === 'POINT') {
    playLaser();
    fireProjectile(30 * dmgMulti);
  } else if (gesture === 'MOUTH_OPEN') {
    // Start charging gravity well (Mouth Open)
    startGravityWell();
  } else if (gesture === 'SMILE') {
    playFreeze();
    freezeEnemies(combatState.upgrades.freezeDuration);
  }
}

export function resetPill() {
  updatePill('Ready', 'Tracking...', false);
}

export function damageAllEnemies(amount, range) {
  const center = sceneState.playerOrb ? sceneState.playerOrb.position : new THREE.Vector3(0,0,0);
  
  if (bossState.isActive && bossState.mesh) {
    const dist = center.distanceTo(bossState.mesh.position);
    if (dist <= range) {
      damageBoss(amount);
      notifyHitAtPosition(bossState.mesh.position, 0xff4400);
    }
    damageMinions(amount);
  }

  for (let i = enemiesState.enemies.length - 1; i >= 0; i--) {
    const e = enemiesState.enemies[i];
    const dist = center.distanceTo(e.mesh.position);
    if (dist <= range) {
      notifyHitAtPosition(e.mesh.position, e.type.color);
      damageEnemy(i, amount);
    }
  }
}

export function freezeEnemies(duration) {
  for (let i = 0; i < enemiesState.enemies.length; i++) {
    enemiesState.enemies[i].frozenUntil = performance.now() + duration;
  }
  if (bossState.isActive) {
    bossState.frozenUntil = performance.now() + duration;
  }
}

export function fireProjectile(damage, color = 0xff44ff) {
  const center = sceneState.playerOrb ? sceneState.playerOrb.position : new THREE.Vector3(0,0,0);
  let target = null;
  let minDist = Infinity;

  if (bossState.isActive && bossState.mesh) {
    target = bossState.mesh;
    minDist = center.distanceTo(target.position);
  } else {
    for (let i = 0; i < enemiesState.enemies.length; i++) {
      const e = enemiesState.enemies[i];
      const dist = center.distanceTo(e.mesh.position);
      if (dist < minDist) {
        minDist = dist;
        target = e.mesh;
      }
    }
  }

  // Day 39 Needle-like projectile geometry for Point/Laser
  const projGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 4);
  const projMat = new THREE.MeshBasicMaterial({ color: color });
  const mesh = new THREE.Mesh(projGeo, projMat);
  mesh.position.copy(center);
  mesh.rotation.x = Math.PI / 2;
  sceneState.scene.add(mesh);

  let dir = new THREE.Vector3(0, 0, -1);
  if (target) {
    dir.subVectors(target.position, center).normalize();
  }

  combatState.projectiles.push({
    mesh: mesh,
    dir: dir,
    speed: 1.2,
    damage: damage,
    age: 0,
    target: target
  });
}

// ─── Day 26: Gravity Well Hold and Aftermath ──────────────────────────────

export function startGravityWell() {
  combatState.isGravityCharging = true;
  combatState.gravityCharge = 0.0;
  // Visual position: slightly in front of the player
  const center = sceneState.playerOrb ? sceneState.playerOrb.position.clone() : new THREE.Vector3(0,1,0);
  combatState.gravityWellPos = center.add(new THREE.Vector3(0, 0, -4));
}

export function updateGravityWell(delta) {
  if (combatState.isGravityCharging) {
    combatState.gravityCharge += delta;
    if (combatState.gravityCharge >= 3.0) {
      combatState.gravityCharge = 3.0; // Max hold 3 seconds
    }
  }

  // Process aftermath distortion decay (3 seconds)
  if (combatState.gravityWellAftermath) {
    combatState.gravityWellAftermath.age += delta;
    if (combatState.gravityWellAftermath.age >= 3.0) {
      combatState.gravityWellAftermath = null;
    }
  }
}

export function releaseGravityWell() {
  if (!combatState.isGravityCharging) return;
  combatState.isGravityCharging = false;
  
  const holdMult = 1.0 + (combatState.gravityCharge / 3.0) * 1.5; // up to 2.5x pull
  const radius = 10.0 * holdMult;
  const damage = 25.0 * holdMult;

  playGravityWell();
  triggerScreenShake(0.8);

  // Pull enemies towards the well
  enemiesState.enemies.forEach(e => {
    const dist = e.mesh.position.distanceTo(combatState.gravityWellPos);
    if (dist < radius) {
      // Pull force inversely proportional to distance
      const force = (1.0 - dist / radius) * 5.0;
      const pullDir = new THREE.Vector3().subVectors(combatState.gravityWellPos, e.mesh.position).normalize();
      e.mesh.position.addScaledVector(pullDir, force);
      damageEnemy(enemiesState.enemies.indexOf(e), damage);
    }
  });

  // Pull boss minions if active
  if (bossState.isActive && bossState.minions) {
    bossState.minions.forEach(m => {
      const dist = m.mesh.position.distanceTo(combatState.gravityWellPos);
      if (dist < radius) {
        const pullDir = new THREE.Vector3().subVectors(combatState.gravityWellPos, m.mesh.position).normalize();
        m.mesh.position.addScaledVector(pullDir, (1.0 - dist / radius) * 4.0);
      }
    });
  }

  // Orbit/Scatter Debris
  if (sceneState.debrisParticles) {
    const positions = sceneState.debrisParticles.geometry.attributes.position.array;
    const wellPos = combatState.gravityWellPos;
    for (let i = 0; i < positions.length; i += 3) {
      const px = positions[i];
      const py = positions[i+1];
      const pz = positions[i+2];
      const d = Math.sqrt((px - wellPos.x)**2 + (py - wellPos.y)**2 + (pz - wellPos.z)**2);
      if (d < radius) {
        // Orbit and push away (scatter)
        positions[i]   += (wellPos.x - px) * 0.8 + (Math.random() - 0.5) * 4.0;
        positions[i+1] += (wellPos.y - py) * 0.8 + (Math.random() - 0.5) * 4.0;
        positions[i+2] += (wellPos.z - pz) * 0.8 + (Math.random() - 0.5) * 4.0;
      }
    }
    sceneState.debrisParticles.geometry.attributes.position.needsUpdate = true;
  }

  // Spawn aftermath ripple
  combatState.gravityWellAftermath = {
    pos: combatState.gravityWellPos.clone(),
    age: 0.0
  };
}

// ─── Day 27: Temporal Freeze ────────────────────────────────────────────────

export function triggerTemporalFreeze() {
  const now = performance.now();
  if (now - combatState.lastTemporalFreezeTime < combatState.temporalFreezeCD) return;

  combatState.lastTemporalFreezeTime = now;
  combatState.temporalFreezeLeft = 4.0; // 4 seconds duration

  playFreeze();
  setTemporalFreezePitch(true);
  enableScanlines();
  
  // Visual blue tint to grid
  effectsState.gridUniforms.uBaseColor.value.setHex(0x0000ff);
}

export function updateTemporalFreeze(delta) {
  if (combatState.temporalFreezeLeft > 0) {
    combatState.temporalFreezeLeft -= delta;
    if (combatState.temporalFreezeLeft <= 0) {
      combatState.temporalFreezeLeft = 0;
      setTemporalFreezePitch(false);
      disableScanlines();
      effectsState.gridUniforms.uBaseColor.value.setHex(0x222222);
    }
  }
}

// ─── Day 28: Powerup Getters ────────────────────────────────────────────────

function getRiftDamageMult() {
  if (performance.now() < combatState.powerUps.damageMultExpiry) {
    return combatState.powerUps.damageMult;
  }
  return 1.0;
}

export function applyPowerUp(type, multiplier, durationMs) {
  const expiry = performance.now() + durationMs;
  if (type === 'DAMAGE') {
    combatState.powerUps.damageMult = multiplier;
    combatState.powerUps.damageMultExpiry = expiry;
  } else if (type === 'VULNERABILITY') {
    combatState.powerUps.vulnMult = multiplier;
    combatState.powerUps.vulnMultExpiry = expiry;
  }
}

export function healPlayer(amount) {
  combatState.playerHP = Math.min(combatState.maxPlayerHP, combatState.playerHP + amount);
  playHeal();
}

// ─── Day 29: Reality Echo ───────────────────────────────────────────────────

export function registerEchoKill() {
  const now = performance.now();
  combatState.killHistory.push(now);
  // Keep only last 5 kills
  if (combatState.killHistory.length > 5) {
    combatState.killHistory.shift();
  }

  // Check if 5 kills occurred within 10 seconds
  if (combatState.killHistory.length === 5) {
    const timeDiff = now - combatState.killHistory[0];
    if (timeDiff <= 10000 && !combatState.echoModeActive) {
      triggerRealityEchoMode();
    }
  }
}

function triggerRealityEchoMode() {
  combatState.echoModeActive = true;
  combatState.echoModeTimer = 5.0; // 5 seconds duration
  combatState.echoActionTimer = 0.0;

  // Add echo delay audio effect
  const announceEcho = document.createElement('div');
  announceEcho.className = 'announcement-banner';
  announceEcho.innerHTML = `<h1>REALITY ECHO</h1>`;
  document.body.appendChild(announceEcho);
  setTimeout(() => { announceEcho.remove(); }, 1500);
}

function executeEchoAction() {
  if (combatState.recentGestures.length === 0) return;
  const echoDmgMult = combatState.upgrades.damageMultiplier * 0.5;
  // Repeat the last recorded gestures at 50% power
  combatState.recentGestures.forEach((gest, idx) => {
    setTimeout(() => {
      const skill = combatState.cooldowns[gest];
      if (skill) {
        flashGesture(skill.name, '#888888');
        damageAllEnemies(20 * echoDmgMult, 20);
        if (gest === 'POINT') fireProjectile(15 * echoDmgMult, 0x8888ff);
      }
    }, idx * 250);
  });
}

// ─── Game Loop Updates ──────────────────────────────────────────────────────

export function updateCombatState(delta) {
  const now = performance.now();

  updateTemporalFreeze(delta);
  updateGravityWell(delta);

  // Reality Echo mode updates
  if (combatState.echoModeActive) {
    combatState.echoModeTimer -= delta;
    combatState.echoActionTimer += delta;

    // Trigger echo repeats every 1.5 seconds
    if (combatState.echoActionTimer >= 1.5) {
      combatState.echoActionTimer = 0.0;
      executeEchoAction();
    }

    if (combatState.echoModeTimer <= 0) {
      combatState.echoModeActive = false;
    }
  }

  // Update projectiles
  const freezeActive = combatState.temporalFreezeLeft > 0;
  for (let i = combatState.projectiles.length - 1; i >= 0; i--) {
    const p = combatState.projectiles[i];
    
    // Projectiles still move for player
    p.mesh.position.addScaledVector(p.dir, p.speed * delta * 60);
    p.age++;

    let hit = false;
    if (bossState.isActive && bossState.minions) {
      for (let m of bossState.minions) {
        if (p.mesh.position.distanceTo(m.mesh.position) < 2) {
          damageMinions(p.damage);
          hit = true;
          break;
        }
      }
    }

    if (!hit && bossState.isActive && bossState.mesh) {
      if (p.mesh.position.distanceTo(bossState.mesh.position) < 3.0) {
        damageBoss(p.damage);
        hit = true;
      }
    }

    if (!hit) {
      for (let j = enemiesState.enemies.length - 1; j >= 0; j--) {
        const e = enemiesState.enemies[j];
        if (p.mesh.position.distanceTo(e.mesh.position) < 2.0) {
          damageEnemy(j, p.damage);
          hit = true;
          break;
        }
      }
    }

    if (hit || p.age > 100) {
      sceneState.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      combatState.projectiles.splice(i, 1);
    }
  }

  // Update enemy projectiles (Freeze handles this)
  for (let i = combatState.enemyProjectiles.length - 1; i >= 0; i--) {
    const ep = combatState.enemyProjectiles[i];
    if (freezeActive) continue; // Freeze completely in midair!

    // Day 26 Gravity Well aftermath steering curve
    if (combatState.gravityWellAftermath) {
      const wellPos = combatState.gravityWellAftermath.pos;
      const d = ep.mesh.position.distanceTo(wellPos);
      if (d < 8.0) {
        // Curve slightly towards gravity well center
        const curveDir = new THREE.Vector3().subVectors(wellPos, ep.mesh.position).normalize();
        ep.dir.addScaledVector(curveDir, delta * 2.0).normalize();
      }
    }

    ep.mesh.position.addScaledVector(ep.dir, ep.speed * delta * 60);
    ep.age++;

    let hit = false;
    if (sceneState.playerOrb) {
      if (ep.mesh.position.distanceTo(sceneState.playerOrb.position) < 1.2) {
        takeDamage(ep.damage);
        hit = true;
      }
    }

    if (hit || ep.age > 120) {
      sceneState.scene.remove(ep.mesh);
      ep.mesh.geometry.dispose();
      ep.mesh.material.dispose();
      combatState.enemyProjectiles.splice(i, 1);
    }
  }

  // Combo logic
  if (combatState.comboCount > 0 && now - combatState.lastKillTime > 2500) {
    combatState.comboCount = 0;
    combatState.comboMultiplier = 1;
    updateScore(combatState.score, combatState.comboMultiplier);
  }

  // UI cooldown bar
  const longestCd = 1400; // max cd
  let maxTimeSince = longestCd;
  for (const k in combatState.cooldowns) {
    const timeSince = now - combatState.cooldowns[k].lastUse;
    if (timeSince < combatState.cooldowns[k].cd && timeSince < maxTimeSince) {
      maxTimeSince = timeSince;
    }
  }
  const percent = Math.min(100, (maxTimeSince / longestCd) * 100);
  updateCooldown(percent);
}

export function registerKill() {
  const now = performance.now();
  registerEchoKill();

  if (now - combatState.lastKillTime <= 2500) {
    combatState.comboCount++;
    if (combatState.comboCount > 4) combatState.comboMultiplier = 4;
    else combatState.comboMultiplier = combatState.comboCount;
    if (combatState.comboCount > combatState.highestCombo) {
      combatState.highestCombo = combatState.comboCount;
    }
  } else {
    combatState.comboCount = 1;
    combatState.comboMultiplier = 1;
  }
  combatState.lastKillTime = now;
}

export function addScore(points) {
  combatState.score += points * combatState.comboMultiplier;
  updateScore(combatState.score, combatState.comboMultiplier);
}

export function takeDamage(amount) {
  let finalDamage = amount;
  // Day 28 Void Vulnerability
  if (performance.now() < combatState.powerUps.vulnMultExpiry) {
    finalDamage *= combatState.powerUps.vulnMult;
  }

  combatState.playerHP -= finalDamage;
  if (!bossState.isActive) {
    if (combatState.playerHP < combatState.lowestPreBossHP) {
      combatState.lowestPreBossHP = combatState.playerHP;
    }
  }
  combatState.comboCount = 0;
  combatState.comboMultiplier = 1;
  updateScore(combatState.score, combatState.comboMultiplier);
  triggerScreenShake(1.5);
  
  const hpPct = combatState.playerHP / combatState.maxPlayerHP;
  updateHP(combatState.playerHP, getAverageEnemyHP());
  notifyPlayerHP(hpPct);

  // Camera roll at very low HP
  if (hpPct < 0.2) {
    sceneState.cameraRoll = Math.sin(performance.now() * 0.003) * 0.5;
  } else {
    sceneState.cameraRoll = 0;
  }

  if (combatState.playerHP <= 0) {
    combatState.playerHP = 0;
  }
}

export function resetCombat() {
  combatState.playerHP = combatState.maxPlayerHP;
  combatState.score = 0;
  combatState.comboCount = 0;
  combatState.comboMultiplier = 1;
  combatState.highestCombo = 0;
  combatState.lowestPreBossHP = 100;
  combatState.projectiles = [];
  combatState.enemyProjectiles = [];
  combatState.lastGesture = null;
  combatState.echoModeActive = false;
  combatState.killHistory = [];
  updateScore(0, 1);
  updateHP(100, 100);
}

export function getAverageEnemyHP() {
  if (bossState.isActive) {
    return Math.max(0, (bossState.hp / 400) * 100);
  }
  if (enemiesState.enemies.length === 0) return 0;
  let total = 0;
  let maxTotal = 0;
  for (let i = 0; i < enemiesState.enemies.length; i++) {
    total += enemiesState.enemies[i].hp;
    maxTotal += enemiesState.enemies[i].maxHp;
  }
  return Math.max(0, (total / maxTotal) * 100);
}
