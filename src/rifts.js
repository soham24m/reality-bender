/**
 * rifts.js — Dimensional Rift mechanics for Reality Bender
 * Manages: scheduling rifts, visual portal rendering, particle pulls,
 *           and collision checks with the player.
 */

import { sceneState } from './scene.js';
import { combatState, healPlayer, applyPowerUp } from './combat.js';
import { enemiesState, damageEnemy } from './enemies.js';
import { triggerInvert } from './effects.js';

export const riftsState = {
  activeRifts: [],
  lastRiftTime: 0,
  announceTimer: 0,
  announcePos: null,
  announceMesh: null
};

const RIFT_TYPES = [
  { id: 'POWER', color: 0xffd700, name: 'POWER RIFT' }, // Gold
  { id: 'HEAL',  color: 0x00ff00, name: 'HEAL RIFT' },  // Green
  { id: 'CHAOS', color: 0xff0000, name: 'CHAOS RIFT' }, // Red
  { id: 'VOID',  color: 0xffffff, name: 'VOID RIFT' }   // White/Black
];

export function resetRifts() {
  for (const r of riftsState.activeRifts) {
    sceneState.scene.remove(r.mesh);
    r.mesh.geometry.dispose();
    r.mesh.material.dispose();
    if (r.light) {
      sceneState.scene.remove(r.light);
    }
  }
  riftsState.activeRifts = [];
  riftsState.lastRiftTime = performance.now();
  riftsState.announceTimer = 0;
  if (riftsState.announceMesh) {
    sceneState.scene.remove(riftsState.announceMesh);
    riftsState.announceMesh.geometry.dispose();
    riftsState.announceMesh.material.dispose();
    riftsState.announceMesh = null;
  }
}

export function triggerRiftAnnouncement() {
  const x = (Math.random() - 0.5) * 20;
  const z = (Math.random() - 0.5) * 20;
  riftsState.announcePos = new THREE.Vector3(x, 1.5, z);
  riftsState.announceTimer = 3.0; // 3 seconds announcement

  // Small shimmering indicator
  const geo = new THREE.RingGeometry(0.1, 0.5, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  riftsState.announceMesh = new THREE.Mesh(geo, mat);
  riftsState.announceMesh.position.copy(riftsState.announcePos);
  riftsState.announceMesh.rotation.x = -Math.PI / 2;
  sceneState.scene.add(riftsState.announceMesh);
}

export function spawnRift(pos) {
  const type = RIFT_TYPES[Math.floor(Math.random() * RIFT_TYPES.length)];
  
  // Custom diamond shape geometry
  const geo = new THREE.OctahedronGeometry(1.2);
  const mat = new THREE.MeshBasicMaterial({
    color: type.color,
    wireframe: true,
    transparent: true,
    opacity: 0.9
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(0.5, 2.0, 0.5); // Elongate to form vertical tear/diamond
  mesh.position.copy(pos);
  sceneState.scene.add(mesh);

  // Inner glow point light
  const light = new THREE.PointLight(type.color, 1.5, 10);
  light.position.copy(pos);
  sceneState.scene.add(light);

  riftsState.activeRifts.push({
    type: type,
    mesh: mesh,
    light: light,
    pos: pos,
    age: 0.0,
    maxAge: 8.0,
    isCollapsing: false
  });

  // Brief announcement overlay message if needed, or done quietly
}

export function updateRifts(delta) {
  const now = performance.now();

  // 1. Process Announcement
  if (riftsState.announceTimer > 0) {
    riftsState.announceTimer -= delta;
    if (riftsState.announceMesh) {
      riftsState.announceMesh.rotation.z += delta * 5.0;
      riftsState.announceMesh.scale.setScalar(1.0 + Math.sin(now * 0.01) * 0.2);
    }
    if (riftsState.announceTimer <= 0) {
      if (riftsState.announceMesh) {
        sceneState.scene.remove(riftsState.announceMesh);
        riftsState.announceMesh.geometry.dispose();
        riftsState.announceMesh.material.dispose();
        riftsState.announceMesh = null;
      }
      spawnRift(riftsState.announcePos);
    }
  } else {
    // Check if we should start a new announcement (every 45s)
    if (now - riftsState.lastRiftTime > 45000) {
      riftsState.lastRiftTime = now;
      triggerRiftAnnouncement();
    }
  }

  // 2. Process Active Rifts
  for (let i = riftsState.activeRifts.length - 1; i >= 0; i--) {
    const r = riftsState.activeRifts[i];
    r.age += delta;

    // Spin animation
    r.mesh.rotation.y += delta * 2.0;

    // Slow scale pulsing
    const scalePulse = 1.0 + Math.sin(r.age * 3.0) * 0.15;
    r.mesh.scale.set(0.5 * scalePulse, 2.0 * scalePulse, 0.5 * scalePulse);

    // Particle-pull simulation: pull surrounding debris particles if active
    if (sceneState.debrisParticles) {
      const positions = sceneState.debrisParticles.geometry.attributes.position.array;
      const riftPos = r.pos;
      for (let j = 0; j < positions.length; j += 3) {
        const px = positions[j];
        const py = positions[j+1];
        const pz = positions[j+2];
        const dist = Math.sqrt((px - riftPos.x)**2 + (py - riftPos.y)**2 + (pz - riftPos.z)**2);
        if (dist < 6.0) {
          // Attract slightly
          positions[j]     += (riftPos.x - px) * delta * 0.3;
          positions[j+1]   += (riftPos.y - py) * delta * 0.3;
          positions[j+2]   += (riftPos.z - pz) * delta * 0.3;
        }
      }
      sceneState.debrisParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Check Player Collision
    if (sceneState.playerOrb) {
      const dist = sceneState.playerOrb.position.distanceTo(r.pos);
      if (dist < 1.8) {
        triggerRiftEffect(r.type);
        // Remove rift
        collapseRift(r);
        riftsState.activeRifts.splice(i, 1);
        continue;
      }
    }

    // Auto-expire
    if (r.age >= r.maxAge) {
      collapseRift(r);
      riftsState.activeRifts.splice(i, 1);
    }
  }
}

function collapseRift(r) {
  sceneState.scene.remove(r.mesh);
  r.mesh.geometry.dispose();
  r.mesh.material.dispose();
  if (r.light) {
    sceneState.scene.remove(r.light);
  }
}

function triggerRiftEffect(type) {
  // Show UI popup message
  const msgEl = document.createElement('div');
  msgEl.className = 'announcement-banner';
  msgEl.innerHTML = `<h2 style="color: #${type.color.toString(16)}">${type.name} ACTIVATED</h2>`;
  document.body.appendChild(msgEl);
  setTimeout(() => {
    msgEl.remove();
  }, 2000);

  if (type.id === 'POWER') {
    // POWER RIFT: double damage for 10s
    applyPowerUp('DAMAGE', 2.0, 10000);
  } else if (type.id === 'HEAL') {
    // HEAL RIFT: heal 40 HP instantly
    healPlayer(40);
  } else if (type.id === 'CHAOS') {
    // CHAOS RIFT: defeat one random enemy, speed others
    if (enemiesState.enemies.length > 0) {
      const idx = Math.floor(Math.random() * enemiesState.enemies.length);
      damageEnemy(idx, 9999); // defeat instantly
    }
    enemiesState.enemies.forEach(e => {
      e.frozenUntil = 0; // unfreeze
      e.mesh.scale.multiplyScalar(1.2);
    });
  } else if (type.id === 'VOID') {
    // VOID RIFT: screen invert 2s, triple damage, high vulnerability
    triggerInvert();
    applyPowerUp('DAMAGE', 3.0, 2000);
    applyPowerUp('VULNERABILITY', 2.0, 2000);
  }
}
