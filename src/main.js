import { initUI, uiElements, hideMainMenu, showGameOver, showVictory, announceWave, showUpgrades, updateHP } from './ui.js';
import { initScene, updateScene, triggerCinematicIntro } from './scene.js';
import { initVision, visionState } from './vision.js';
import { handleGesture, handleKeyboard, updateCombat, combatState, getAverageEnemyHP } from './combat.js';
import { enemiesState, startWave, updateEnemies } from './enemies.js';
import { bossState, spawnBoss, updateBoss, trackPlayerGesture } from './boss.js';
import { playWaveClear, playGameOver, playVictory } from './audio.js';

let lastTime = 0;
let gameRunning = false;
let isPaused = false;
let clockDelta = 0;

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
      handleKeyboard(e);
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
    // Show upgrade screen
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
    // Boss time
    setTimeout(() => {
      announceWave('WARNING: ANOMALY DETECTED');
      setTimeout(() => {
        spawnBoss();
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
  gameRunning = false;
  
  const bossDefeatTime = (performance.now() - bossState.fightStartTime) / 1000;
  const wavesCleared = enemiesState.currentWave + 1; // since boss is after wave 4

  setTimeout(() => {
    showVictory(combatState.score, wavesCleared, combatState.highestCombo, bossDefeatTime);
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

  updateScene(time);
  updateEnemies(clockDelta);
  updateBoss(clockDelta);
  updateCombat(clockDelta);

  // Check Game Over
  if (combatState.playerHP <= 0) {
    playGameOver();
    gameRunning = false;
    showGameOver(combatState.score);
    return;
  }

  // Update UI HP constantly to handle regen or gradual damage if any
  updateHP(combatState.playerHP, getAverageEnemyHP());

  requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', init);
