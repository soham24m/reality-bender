const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

export const audioState = {
  isMuted: false,
  masterGain: null,
  lastPlayed: {}
};

export function initAudio() {
  audioState.masterGain = audioCtx.createGain();
  audioState.masterGain.connect(audioCtx.destination);
  audioState.masterGain.gain.value = 0.5;
}

export function toggleMute() {
  audioState.isMuted = !audioState.isMuted;
  if (audioState.masterGain) {
    audioState.masterGain.gain.value = audioState.isMuted ? 0 : 0.5;
  }
  return audioState.isMuted;
}

function checkCooldown(id, cd) {
  const now = performance.now();
  if (audioState.lastPlayed[id] && now - audioState.lastPlayed[id] < cd) {
    return false;
  }
  audioState.lastPlayed[id] = now;
  return true;
}

function ensureCtx() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  if (!audioState.masterGain) {
    initAudio();
  }
}

// Shockwave/Fist: low thump (sine wave, 80-120hz, quick decay)
export function playShockwave() {
  if (audioState.isMuted || !checkCooldown('shockwave', 400)) return;
  ensureCtx();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);
  gain.gain.setValueAtTime(1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(audioState.masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

// Laser/Point: rising pitch sweep (200-800hz over 150ms)
export function playLaser() {
  if (audioState.isMuted || !checkCooldown('laser', 200)) return;
  ensureCtx();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(200, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
  osc.connect(gain);
  gain.connect(audioState.masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

// Shield/Open Palm: soft chime (multiple sine tones, harmonious)
export function playShield() {
  if (audioState.isMuted || !checkCooldown('shield', 400)) return;
  ensureCtx();
  const freqs = [440, 554.37, 659.25]; // A4, C#5, E5
  freqs.forEach(f => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(audioState.masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  });
}

// Freeze: descending icy tone with slight reverb-like delay layering
export function playFreeze() {
  if (audioState.isMuted || !checkCooldown('freeze', 800)) return;
  ensureCtx();
  const freqs = [880, 800, 700];
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, audioCtx.currentTime + i * 0.05);
    osc.frequency.exponentialRampToValueAtTime(f/2, audioCtx.currentTime + i * 0.05 + 0.3);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.05 + 0.3);
    osc.connect(gain);
    gain.connect(audioState.masterGain);
    osc.start(audioCtx.currentTime + i * 0.05);
    osc.stop(audioCtx.currentTime + i * 0.05 + 0.3);
  });
}

// Heal: Not specifically requested but Mouth Open maps to heal, let's add a soft rising tone
export function playHeal() {
  if (audioState.isMuted || !checkCooldown('heal', 800)) return;
  ensureCtx();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.4);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
  osc.connect(gain);
  gain.connect(audioState.masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.4);
}

// Enemy defeat: short noise burst + pitch drop
export function playEnemyDefeat() {
  if (audioState.isMuted || !checkCooldown('edefeat', 100)) return;
  ensureCtx();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(audioState.masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.2);
}

// Boss hit: deeper impact tone, scales with boss phase
export function playBossHit(phase) {
  if (audioState.isMuted || !checkCooldown('bhit', 150)) return;
  ensureCtx();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  const baseFreq = 80 - (phase * 10);
  osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(audioState.masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

// Wave clear: ascending 3-note chime
export function playWaveClear() {
  if (audioState.isMuted) return;
  ensureCtx();
  const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.15 + 0.4);
    osc.connect(gain);
    gain.connect(audioState.masterGain);
    osc.start(audioCtx.currentTime + i * 0.15);
    osc.stop(audioCtx.currentTime + i * 0.15 + 0.4);
  });
}

// Game over: descending minor chord
export function playGameOver() {
  if (audioState.isMuted) return;
  ensureCtx();
  const freqs = [392.00, 311.13, 261.63]; // G4, Eb4, C4 (C minor drop)
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(f/2, audioCtx.currentTime + 1.0);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.0);
    osc.connect(gain);
    gain.connect(audioState.masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.0);
  });
}

// Victory: ascending major chord arpeggio
export function playVictory() {
  if (audioState.isMuted) return;
  ensureCtx();
  const freqs = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime + i * 0.2);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + i * 0.2 + 0.6);
    osc.connect(gain);
    gain.connect(audioState.masterGain);
    osc.start(audioCtx.currentTime + i * 0.2);
    osc.stop(audioCtx.currentTime + i * 0.2 + 0.6);
  });
}
