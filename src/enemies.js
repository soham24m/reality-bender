import { sceneState, createExplosion, transitionToSecondArena, createSpawnTelegraph } from './scene.js';
import { takeDamage, registerKill, addScore, getAverageEnemyHP } from './combat.js';
import { updateHP } from './ui.js';
import { playEnemyDefeat } from './audio.js';

export const enemyTypes = {
  DRONE: { hp: 30, speed: 4.0, color: 0x00ff00, geo: 'sphere', points: 100, dmg: 5, atkCd: 1000 },
  FIGHTER: { hp: 60, speed: 2.5, color: 0xff0000, geo: 'octahedron', points: 250, dmg: 15, atkCd: 1500 },
  ELITE: { hp: 120, speed: 1.2, color: 0xaa00ff, geo: 'icosahedron', points: 600, dmg: 30, atkCd: 2000 }
};

export const enemiesState = {
  enemies: [],
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

export function spawnEnemy(typeStr, pos) {
  const t = enemyTypes[typeStr];
  let geo;
  if (t.geo === 'sphere') geo = new THREE.SphereGeometry(0.8, 8, 8);
  else if (t.geo === 'octahedron') geo = new THREE.OctahedronGeometry(1.2);
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
    mesh: mesh,
    hp: t.hp,
    maxHp: t.hp,
    lastAtkTime: 0,
    frozenUntil: 0
  });
}

export function startWave(waveIndex) {
  if (waveIndex >= enemiesState.waves.length) return; // Boss time
  
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
    setTimeout(() => {
      spawnEnemy(waveDef[i], pos);
    }, 1000);
  }
}

export function updateEnemies(delta) {
  const center = sceneState.playerOrb ? sceneState.playerOrb.position : new THREE.Vector3(0,0,0);
  const now = performance.now();

  for (let i = enemiesState.enemies.length - 1; i >= 0; i--) {
    const e = enemiesState.enemies[i];
    
    // Rotation
    e.mesh.rotation.y += delta * 2;
    e.mesh.rotation.x += delta;

    if (now < e.frozenUntil) {
      e.mesh.material.color.setHex(0x4444ff); // freeze color
      continue;
    } else {
      e.mesh.material.color.setHex(e.type.color);
    }

    const dist = e.mesh.position.distanceTo(center);

    if (dist > 3.0) {
      // Move towards player
      const dir = new THREE.Vector3().subVectors(center, e.mesh.position).normalize();
      e.mesh.position.addScaledVector(dir, e.type.speed * delta);
    } else {
      // Vibrate / attack
      e.mesh.position.x += (Math.random() - 0.5) * 0.2;
      e.mesh.position.y += (Math.random() - 0.5) * 0.2;
      e.mesh.position.z += (Math.random() - 0.5) * 0.2;

      if (now - e.lastAtkTime > e.type.atkCd) {
        takeDamage(e.type.dmg);
        e.lastAtkTime = now;
      }
    }
  }
}

export function damageEnemy(index, amount) {
  const e = enemiesState.enemies[index];
  e.hp -= amount;
  
  // Flash white
  e.mesh.material.color.setHex(0xffffff);
  setTimeout(() => {
    if (e && e.mesh) e.mesh.material.color.setHex(e.type.color);
  }, 100);

  if (e.hp <= 0) {
    playEnemyDefeat();
    createExplosion(e.mesh.position, e.type.color);
    sceneState.scene.remove(e.mesh);
    e.mesh.geometry.dispose();
    e.mesh.material.dispose();
    enemiesState.enemies.splice(index, 1);
    
    registerKill();
    addScore(e.type.points);
    
    checkWaveClear();
  } else {
    // Update HP UI for player and average enemy
    // Actually we only need to update HP if it's not dead immediately, or update globally
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
