export const uiElements = {};

export function initUI() {
  uiElements.scoreDisplay = document.getElementById('score-display');
  uiElements.playerHpBar = document.getElementById('player-hp-bar');
  uiElements.enemyHpBar = document.getElementById('enemy-hp-bar');
  uiElements.pillDot = document.getElementById('pill-dot');
  uiElements.pillAction = document.getElementById('pill-action');
  uiElements.pillStatus = document.getElementById('pill-status');
  uiElements.cooldownBar = document.getElementById('cooldown-bar');
  uiElements.gestureConfirm = document.getElementById('gesture-confirm');
  uiElements.waveAnnounce = document.getElementById('wave-announce');
  createMuteButton();
  createMenus();
}

export function createMuteButton() {
  const muteBtn = document.createElement('button');
  muteBtn.id = 'mute-btn';
  muteBtn.textContent = '🔊';
  muteBtn.style.position = 'fixed';
  muteBtn.style.top = '20px';
  muteBtn.style.left = '20px';
  muteBtn.style.zIndex = '100';
  muteBtn.style.background = 'rgba(0,0,0,0.5)';
  muteBtn.style.border = '1px solid rgba(255,255,255,0.2)';
  muteBtn.style.color = 'white';
  muteBtn.style.borderRadius = '50%';
  muteBtn.style.width = '40px';
  muteBtn.style.height = '40px';
  muteBtn.style.cursor = 'pointer';
  muteBtn.style.fontSize = '20px';
  muteBtn.style.display = 'flex';
  muteBtn.style.alignItems = 'center';
  muteBtn.style.justifyContent = 'center';

  muteBtn.addEventListener('click', async () => {
    const { toggleMute } = await import('./audio.js');
    const isMuted = toggleMute();
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
  });

  document.body.appendChild(muteBtn);
  uiElements.muteBtn = muteBtn;
}

export function createMenus() {
  const mainMenu = document.createElement('div');
  mainMenu.id = 'main-menu';
  mainMenu.style.position = 'fixed';
  mainMenu.style.top = '0';
  mainMenu.style.left = '0';
  mainMenu.style.width = '100vw';
  mainMenu.style.height = '100vh';
  mainMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  mainMenu.style.zIndex = '100';
  mainMenu.style.display = 'flex';
  mainMenu.style.flexDirection = 'column';
  mainMenu.style.alignItems = 'center';
  mainMenu.style.justifyContent = 'center';
  mainMenu.style.color = 'white';
  mainMenu.style.fontFamily = 'sans-serif';
  mainMenu.style.transition = 'opacity 0.5s';

  const title = document.createElement('h1');
  title.textContent = 'REALITY BENDER';
  title.style.fontSize = '48px';
  title.style.letterSpacing = '0.2em';
  title.style.marginBottom = '20px';
  mainMenu.appendChild(title);

  const legend = document.createElement('p');
  legend.textContent = 'Controls: Camera Gestures or Keyboard (F=Fist, P=Palm, L=Point, M=Mouth, S=Smile)';
  legend.style.marginBottom = '40px';
  legend.style.color = 'rgba(255, 255, 255, 0.7)';
  mainMenu.appendChild(legend);

  const startBtn = document.createElement('button');
  startBtn.id = 'start-btn';
  startBtn.textContent = 'START GAME';
  startBtn.style.padding = '15px 40px';
  startBtn.style.fontSize = '18px';
  startBtn.style.background = 'rgba(0, 255, 136, 0.2)';
  startBtn.style.border = '1px solid #00ff88';
  startBtn.style.color = '#00ff88';
  startBtn.style.cursor = 'pointer';
  startBtn.style.borderRadius = '5px';
  startBtn.style.textTransform = 'uppercase';
  mainMenu.appendChild(startBtn);

  document.body.appendChild(mainMenu);
  uiElements.mainMenu = mainMenu;
  uiElements.startBtn = startBtn;

  const gameOverScreen = document.createElement('div');
  gameOverScreen.id = 'game-over';
  gameOverScreen.style.position = 'fixed';
  gameOverScreen.style.top = '0';
  gameOverScreen.style.left = '0';
  gameOverScreen.style.width = '100vw';
  gameOverScreen.style.height = '100vh';
  gameOverScreen.style.backgroundColor = 'rgba(100, 0, 0, 0.8)';
  gameOverScreen.style.zIndex = '100';
  gameOverScreen.style.display = 'none';
  gameOverScreen.style.flexDirection = 'column';
  gameOverScreen.style.alignItems = 'center';
  gameOverScreen.style.justifyContent = 'center';
  gameOverScreen.style.color = 'white';
  gameOverScreen.style.fontFamily = 'sans-serif';
  gameOverScreen.style.transition = 'opacity 0.5s';

  const goTitle = document.createElement('h1');
  goTitle.textContent = 'SYSTEM FAILURE';
  goTitle.style.fontSize = '48px';
  gameOverScreen.appendChild(goTitle);

  const finalScore = document.createElement('p');
  finalScore.id = 'final-score';
  finalScore.style.fontSize = '24px';
  finalScore.style.marginBottom = '40px';
  gameOverScreen.appendChild(finalScore);

  const restartBtn = document.createElement('button');
  restartBtn.textContent = 'PLAY AGAIN';
  restartBtn.style.padding = '15px 40px';
  restartBtn.style.background = 'rgba(255, 0, 0, 0.2)';
  restartBtn.style.border = '1px solid #ff0000';
  restartBtn.style.color = '#ff0000';
  restartBtn.style.cursor = 'pointer';
  restartBtn.style.fontSize = '18px';
  restartBtn.addEventListener('click', reloadPage);
  gameOverScreen.appendChild(restartBtn);

  document.body.appendChild(gameOverScreen);
  uiElements.gameOverScreen = gameOverScreen;
  uiElements.finalScore = finalScore;

  const victoryScreen = document.createElement('div');
  victoryScreen.id = 'victory-screen';
  victoryScreen.style.position = 'fixed';
  victoryScreen.style.top = '0';
  victoryScreen.style.left = '0';
  victoryScreen.style.width = '100vw';
  victoryScreen.style.height = '100vh';
  victoryScreen.style.backgroundColor = 'rgba(0, 100, 255, 0.8)';
  victoryScreen.style.zIndex = '100';
  victoryScreen.style.display = 'none';
  victoryScreen.style.flexDirection = 'column';
  victoryScreen.style.alignItems = 'center';
  victoryScreen.style.justifyContent = 'center';
  victoryScreen.style.color = 'white';
  victoryScreen.style.fontFamily = 'sans-serif';
  victoryScreen.style.transition = 'opacity 0.5s';

  const vicTitle = document.createElement('h1');
  vicTitle.textContent = 'REALITY SECURED';
  vicTitle.style.fontSize = '48px';
  victoryScreen.appendChild(vicTitle);

  const vicScore = document.createElement('div');
  vicScore.id = 'victory-score';
  vicScore.style.fontSize = '20px';
  vicScore.style.marginBottom = '40px';
  vicScore.style.background = 'rgba(255,255,255,0.1)';
  vicScore.style.padding = '20px';
  vicScore.style.borderRadius = '10px';
  vicScore.style.backdropFilter = 'blur(10px)';
  vicScore.style.lineHeight = '1.8';
  vicScore.style.textAlign = 'center';
  victoryScreen.appendChild(vicScore);

  const vicRestartBtn = document.createElement('button');
  vicRestartBtn.textContent = 'PLAY AGAIN';
  vicRestartBtn.style.padding = '15px 40px';
  vicRestartBtn.style.background = 'rgba(0, 255, 255, 0.2)';
  vicRestartBtn.style.border = '1px solid #00ffff';
  vicRestartBtn.style.color = '#00ffff';
  vicRestartBtn.style.cursor = 'pointer';
  vicRestartBtn.style.fontSize = '18px';
  vicRestartBtn.addEventListener('click', reloadPage);
  victoryScreen.appendChild(vicRestartBtn);

  document.body.appendChild(victoryScreen);
  uiElements.victoryScreen = victoryScreen;
  uiElements.victoryScore = vicScore;

  const upgradeScreen = document.createElement('div');
  upgradeScreen.id = 'upgrade-screen';
  upgradeScreen.style.position = 'fixed';
  upgradeScreen.style.top = '0';
  upgradeScreen.style.left = '0';
  upgradeScreen.style.width = '100vw';
  upgradeScreen.style.height = '100vh';
  upgradeScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
  upgradeScreen.style.zIndex = '90';
  upgradeScreen.style.display = 'none';
  upgradeScreen.style.flexDirection = 'column';
  upgradeScreen.style.alignItems = 'center';
  upgradeScreen.style.justifyContent = 'center';
  upgradeScreen.style.transition = 'opacity 0.5s';

  const upTitle = document.createElement('h2');
  upTitle.textContent = 'CHOOSE UPGRADE';
  upTitle.style.color = 'white';
  upTitle.style.fontFamily = 'sans-serif';
  upTitle.style.marginBottom = '30px';
  upgradeScreen.appendChild(upTitle);

  const cardContainer = document.createElement('div');
  cardContainer.style.display = 'flex';
  cardContainer.style.gap = '20px';
  upgradeScreen.appendChild(cardContainer);
  
  uiElements.upgradeScreen = upgradeScreen;
  uiElements.upgradeCards = cardContainer;
  document.body.appendChild(upgradeScreen);

  const pauseScreen = document.createElement('div');
  pauseScreen.id = 'pause-screen';
  pauseScreen.style.position = 'fixed';
  pauseScreen.style.top = '0';
  pauseScreen.style.left = '0';
  pauseScreen.style.width = '100vw';
  pauseScreen.style.height = '100vh';
  pauseScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  pauseScreen.style.backdropFilter = 'blur(5px)';
  pauseScreen.style.zIndex = '95';
  pauseScreen.style.display = 'none';
  pauseScreen.style.flexDirection = 'column';
  pauseScreen.style.alignItems = 'center';
  pauseScreen.style.justifyContent = 'center';
  pauseScreen.style.color = 'white';
  pauseScreen.style.fontFamily = 'sans-serif';
  
  const pauseTitle = document.createElement('h1');
  pauseTitle.textContent = 'PAUSED';
  pauseTitle.style.fontSize = '48px';
  pauseTitle.style.letterSpacing = '0.2em';
  pauseScreen.appendChild(pauseTitle);

  document.body.appendChild(pauseScreen);
  uiElements.pauseScreen = pauseScreen;
}

export function togglePauseOverlay(isPaused) {
  if (uiElements.pauseScreen) {
    uiElements.pauseScreen.style.display = isPaused ? 'flex' : 'none';
  }
}

export function reloadPage() {
  window.location.reload();
}

export function hideMainMenu() {
  uiElements.mainMenu.style.opacity = '0';
  setTimeout(removeMainMenu, 500);
}

export function removeMainMenu() {
  uiElements.mainMenu.style.display = 'none';
}

export function showGameOver(score) {
  uiElements.finalScore.textContent = 'Final Score: ' + score;
  uiElements.gameOverScreen.style.display = 'flex';
  uiElements.gameOverScreen.style.opacity = '0';
  setTimeout(fadeInGameOver, 50);
}

export function fadeInGameOver() {
  uiElements.gameOverScreen.style.opacity = '1';
}

export function showVictory(score, waves, maxCombo, bossTime) {
  uiElements.victoryScore.innerHTML = `
    FINAL SCORE: ${score}<br>
    WAVES CLEARED: ${waves}<br>
    MAX COMBO: x${maxCombo}<br>
    BOSS DEFEAT TIME: ${bossTime.toFixed(1)}s
  `;
  uiElements.victoryScreen.style.display = 'flex';
  uiElements.victoryScreen.style.opacity = '0';
  setTimeout(fadeInVictory, 50);
}

export function fadeInVictory() {
  uiElements.victoryScreen.style.opacity = '1';
}

export function updateScore(score, combo) {
  let text = 'Score: ' + score;
  if (combo > 1) {
    text += ' (x' + combo + ')';
  }
  uiElements.scoreDisplay.textContent = text;
}

export function updateHP(playerPercent, enemyPercent) {
  uiElements.playerHpBar.style.width = playerPercent + '%';
  uiElements.enemyHpBar.style.width = enemyPercent + '%';
}

export function updatePill(action, status, isActive) {
  uiElements.pillAction.textContent = action;
  uiElements.pillStatus.textContent = status;
  if (isActive) {
    uiElements.pillDot.classList.add('live');
  } else {
    uiElements.pillDot.classList.remove('live');
  }
}

export function updateCooldown(percent) {
  uiElements.cooldownBar.style.width = percent + '%';
}

export function flashGesture(text, color) {
  uiElements.gestureConfirm.textContent = text;
  uiElements.gestureConfirm.style.color = color;
  uiElements.gestureConfirm.style.textShadow = '0 0 20px ' + color;
  uiElements.gestureConfirm.style.opacity = '1';
  setTimeout(fadeGesture, 500);
}

export function fadeGesture() {
  uiElements.gestureConfirm.style.opacity = '0';
}

export function announceWave(text) {
  uiElements.waveAnnounce.textContent = text;
  uiElements.waveAnnounce.style.opacity = '1';
  setTimeout(fadeWave, 2000);
}

export function fadeWave() {
  uiElements.waveAnnounce.style.opacity = '0';
}

export function showUpgrades(onChoose) {
  uiElements.upgradeCards.innerHTML = '';
  
  const upgrades = [
    { id: 'power', name: 'Power Surge', desc: '+50% Damage', color: '#ff4444' },
    { id: 'life', name: 'Life Force', desc: 'Heal 20->40', color: '#44ff44' },
    { id: 'freeze', name: 'Deep Freeze', desc: 'Freeze 2s->4s', color: '#4444ff' }
  ];

  for (let i = 0; i < upgrades.length; i++) {
    const u = upgrades[i];
    const card = document.createElement('div');
    card.style.width = '200px';
    card.style.height = '300px';
    card.style.background = 'rgba(255,255,255,0.1)';
    card.style.border = '1px solid ' + u.color;
    card.style.borderRadius = '10px';
    card.style.padding = '20px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'center';
    card.style.cursor = 'pointer';
    card.style.color = 'white';
    card.style.fontFamily = 'sans-serif';
    card.style.backdropFilter = 'blur(10px)';
    
    const title = document.createElement('h3');
    title.textContent = u.name;
    title.style.color = u.color;
    
    const desc = document.createElement('p');
    desc.textContent = u.desc;
    
    card.appendChild(title);
    card.appendChild(desc);
    
    card.onclick = function() {
      onChoose(u.id);
      uiElements.upgradeScreen.style.opacity = '0';
      setTimeout(hideUpgradeScreen, 500);
    };
    
    uiElements.upgradeCards.appendChild(card);
  }
  
  uiElements.upgradeScreen.style.display = 'flex';
  uiElements.upgradeScreen.style.opacity = '0';
  setTimeout(fadeInUpgrade, 50);
}

export function fadeInUpgrade() {
  uiElements.upgradeScreen.style.opacity = '1';
}

export function hideUpgradeScreen() {
  uiElements.upgradeScreen.style.display = 'none';
}
