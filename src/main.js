import { initUI, uiElements, hideMainMenu, showGameOver, showVictory, announceWave, showUpgrades, updateHP, showDifficultyIndicator, triggerCinematicPulse } from './ui.js';
import { initScene, updateScene, triggerCinematicIntro, resetScene, triggerBossDefeatCamera, sceneState, addOrbRingForWave, triggerRealityCollapse, reverseRealityCollapse, notifyPlayerHP } from './scene.js';
import { initVision, visionState } from './vision.js';
import { handleGesture, handleKeyboard, combatState, getAverageEnemyHP, resetCombat, releaseGravityWell, updateCombatState } from './combat.js';
import { enemiesState, startWave, updateEnemies, resetEnemies } from './enemies.js';
import { bossState, spawnBoss, updateBoss, trackPlayerGesture, resetBoss } from './boss.js';
import { playWaveClear, playGameOver, playVictory, playSlowMo, startHeartbeat, updateHeartbeat, stopHeartbeat, startBossDrone, stopBossDrone } from './audio.js';
import { riftsState, updateRifts, resetRifts } from './rifts.js';

let lastTime = 0;
let gameRunning = false;
let isPaused = false;
let clockDelta = 0;
let keyboardMDown = false;

export function init() {
  initUI();
  const overlay = document.getElementById('overlay');
  initScene(overlay);

  uiElements.startBtn.addEventListener('click', onStartGame);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && gameRunning) {
      isPaused = !isPaused;
      import('./ui.js').then(m => m.togglePauseOverlay(isPaused));
    } else {
      if (e.key.toLowerCase() === 'm') {
        if (!keyboardMDown) {
          keyboardMDown = true;
          handleKeyboard(e);
        }
      } else {
        handleKeyboard(e);
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 'm') {
      keyboardMDown = false;
      releaseGravityWell();
    }
  });

  enemiesState.onWaveClear = handleWaveClear;
  bossState.onDefeat = handleVictory;
}

export function onStartGame() {
  hideMainMenu();
  triggerCinematicIntro();
  const videoElement = document.getElementById('webcam');
  initVision(videoElement, onGestureConfirmed);
  
  gameRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(animate);

  // Start procedural heartbeat music layer (Day 25)
  startHeartbeat();
  updateHeartbeat(0);

  // Start first wave after a short delay
  setTimeout(() => {
    announceWave('WAVE 1');
    startWave(0);
  }, 2000);
}

export function onGestureConfirmed(gesture) {
  if (!gameRunning) return;
  trackPlayerGesture(gesture);
  handleGesture(gesture);
}

export function handleWaveClear(completedWaveIndex) {
  playWaveClear();
  const nextWaveIndex = completedWaveIndex + 1;
  
  if (nextWaveIndex < enemiesState.waves.length) {
    // Add orb ring as player progresses
    addOrbRingForWave(completedWaveIndex);
    updateHeartbeat(nextWaveIndex); // Speed up heartbeat pulse per wave (Day 25)

    setTimeout(() => {
      showUpgrades((upgradeId) => {
        applyUpgrade(upgradeId);
        setTimeout(() => {
          announceWave('WAVE ' + (nextWaveIndex + 1));
          startWave(nextWaveIndex);
        }, 1000);
      });
    }, 1000);
  } else {
    // Dynamic difficulty check
    let startPhase = 1;
    if (combatState.lowestPreBossHP > 60) {
      startPhase = 2; // Harder
      showDifficultyIndicator('BOSS CALIBRATED: LETHAL (PHASE 2)', '#ff0000');
    } else if (combatState.lowestPreBossHP < 30) {
      startPhase = 1; // Easier
      showDifficultyIndicator('BOSS CALIBRATED: CAUTIOUS (PHASE 1 EXTENDED)', '#00ff00');
    } else {
      showDifficultyIndicator('BOSS CALIBRATED: NORMAL', '#ffffff');
    }

    setTimeout(() => {
      announceWave('WARNING: ANOMALY DETECTED');
      setTimeout(() => {
        startBossDrone(); // Start ominous boss drone (Day 25)
        spawnBoss(startPhase);
      }, 3000);
    }, 1500);
  }
}

export function applyUpgrade(upgradeId) {
  if (upgradeId === 'power') {
    combatState.upgrades.damageMultiplier += 0.5;
  } else if (upgradeId === 'life') {
    combatState.upgrades.healAmount = 40;
  } else if (upgradeId === 'freeze') {
    combatState.upgrades.freezeDuration = 4000;
  }
}

export function handleVictory() {
  playVictory();
  playSlowMo();
  triggerCinematicPulse();
  reverseRealityCollapse();
  stopBossDrone();
  stopHeartbeat();

  if (bossState.mesh) {
    triggerBossDefeatCamera(bossState.mesh.position);
  }

  const bossDefeatTime = (performance.now() - bossState.fightStartTime) / 1000;
  const wavesCleared = enemiesState.currentWave + 1;

  setTimeout(() => {
    gameRunning = false;
    showVictory(combatState.score, wavesCleared, combatState.highestCombo, bossDefeatTime);
  }, 3000);
}

export function resetGame() {
  resetScene();
  resetCombat();
  resetEnemies();
  resetBoss();
  resetRifts();
  stopBossDrone();
  stopHeartbeat();
  
  gameRunning = true;
  isPaused = false;
  lastTime = performance.now();
  
  setTimeout(() => {
    announceWave('WAVE 1');
    startWave(0);
  }, 2000);
}

export function animate(time) {
  if (!gameRunning) return;

  if (isPaused) {
    lastTime = time;
    requestAnimationFrame(animate);
    return;
  }

  clockDelta = (time - lastTime) / 1000;
  lastTime = time;
  // Cap delta to prevent huge jumps if tab is backgrounded
  if (clockDelta > 0.1) clockDelta = 0.1;

  const scaledDelta = clockDelta * sceneState.timeScale;

  // Day 26: Release gravity well if player stopped camera/mouth gesture or keyup
  if (combatState.isGravityCharging) {
    if (visionState.currentGesture !== 'MOUTH_OPEN' && !keyboardMDown) {
      releaseGravityWell();
    }
  }

  updateScene(time, clockDelta); // Pass rawDelta for explosions
  updateCombatState(scaledDelta);
  updateEnemies(scaledDelta);
  updateBoss(scaledDelta);
  updateRifts(scaledDelta); // Update dimensional rifts (Day 28)

  // Check Game Over
  if (combatState.playerHP <= 0) {
    playGameOver();
    stopBossDrone();
    stopHeartbeat();
    gameRunning = false;
    showGameOver(combatState.score);
    return;
  }

  // Update UI HP constantly to handle regen or gradual damage if any
  updateHP(combatState.playerHP, getAverageEnemyHP());
  notifyPlayerHP(combatState.playerHP / combatState.maxPlayerHP);

  requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', init);
