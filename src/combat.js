import { sceneState, triggerScreenShake, reportCombatActivity } from './scene.js';
import { updateCooldown, updatePill, flashGesture, updateScore, updateHP } from './ui.js';
import { enemiesState, damageEnemy } from './enemies.js';
import { bossState, damageBoss } from './boss.js';
import { playShockwave, playShield, playLaser, playHeal, playFreeze } from './audio.js';

export const combatState = {
  cooldowns: {
    FIST: { cd: 1000, lastUse: 0, name: 'QUAKE', color: '#ff4444' },
    OPEN_PALM: { cd: 800, lastUse: 0, name: 'BLAST', color: '#44ffff' },
    POINT: { cd: 600, lastUse: 0, name: 'LASER', color: '#ff44ff' },
    MOUTH_OPEN: { cd: 1400, lastUse: 0, name: 'HEAL', color: '#44ff44' },
    SMILE: { cd: 1200, lastUse: 0, name: 'FREEZE', color: '#ffff44' }
  },
  projectiles: [],
  comboCount: 0,
  comboMultiplier: 1,
  highestCombo: 0,
  lastKillTime: 0,
  playerHP: 100,
  maxPlayerHP: 100,
  score: 0,
  upgrades: { damageMultiplier: 1, healAmount: 20, freezeDuration: 2000 }
};

export function handleGesture(gestureStr) {
  const now = performance.now();
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
  triggerScreenShake(0.5);

  const dmgMulti = combatState.upgrades.damageMultiplier;

  if (gesture === 'FIST') {
    playShockwave();
    damageAllEnemies(40 * dmgMulti, 20); // 40 dmg, 20 radius
  } else if (gesture === 'OPEN_PALM') {
    playShield();
    damageAllEnemies(20 * dmgMulti, 40); // 20 dmg, 40 radius
  } else if (gesture === 'POINT') {
    playLaser();
    fireProjectile(30 * dmgMulti);
  } else if (gesture === 'MOUTH_OPEN') {
    playHeal();
    combatState.playerHP += combatState.upgrades.healAmount;
    if (combatState.playerHP > combatState.maxPlayerHP) combatState.playerHP = combatState.maxPlayerHP;
    updateHP(combatState.playerHP, getAverageEnemyHP());
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
    }
  }

  for (let i = enemiesState.enemies.length - 1; i >= 0; i--) {
    const e = enemiesState.enemies[i];
    const dist = center.distanceTo(e.mesh.position);
    if (dist <= range) {
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

export function fireProjectile(damage) {
  // Find nearest enemy or boss
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

  const projGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const projMat = new THREE.MeshBasicMaterial({ color: 0xff44ff });
  const mesh = new THREE.Mesh(projGeo, projMat);
  mesh.position.copy(center);
  sceneState.scene.add(mesh);

  let dir = new THREE.Vector3(0, 0, -1);
  if (target) {
    dir.subVectors(target.position, center).normalize();
  }

  combatState.projectiles.push({
    mesh: mesh,
    dir: dir,
    speed: 1.0,
    damage: damage,
    age: 0,
    target: target
  });
}

export function updateCombat(delta) {
  const now = performance.now();

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

  // Projectiles
  for (let i = combatState.projectiles.length - 1; i >= 0; i--) {
    const p = combatState.projectiles[i];
    p.mesh.position.addScaledVector(p.dir, p.speed * delta * 60);
    p.age++;

    let hit = false;
    
    if (bossState.isActive && bossState.mesh) {
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
}

export function registerKill() {
  const now = performance.now();
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
  combatState.playerHP -= amount;
  combatState.comboCount = 0;
  combatState.comboMultiplier = 1;
  updateScore(combatState.score, combatState.comboMultiplier);
  triggerScreenShake(1.5);
  updateHP(combatState.playerHP, getAverageEnemyHP());

  if (combatState.playerHP <= 0) {
    combatState.playerHP = 0;
    // Game over handled in main loop
  }
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
