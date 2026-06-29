/**
 * audio.js — Procedural Sound Design using Web Audio API
 * Manages: Shockwave, Laser charge/fire, Shield spawn/expire,
 *           Gravity Well whoosh, Surge chime cascades, Boss ominous drone,
 *           rhythmic heartbeat pulse, Temporal Freeze pitch shifts.
 */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let noiseBuffer = null;
let heartbeatIntervalId = null;
let heartbeatTempo = 120; // BPM
let heartbeatWaveIndex = 0;
let bossDroneOscs = [];
let bossDroneGain = null;

export const audioState = {
  isMuted: false,
  masterGain: null,
  lastPlayed: {},
  pitchMultiplier: 1.0 // Lowered to 0.8 during Temporal Freeze
};

export function initAudio() {
  audioState.masterGain = audioCtx.createGain();
  audioState.masterGain.connect(audioCtx.destination);
  audioState.masterGain.gain.value = 0.5;
  createNoiseBuffer();
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

function createNoiseBuffer() {
  const bufferSize = audioCtx.sampleRate * 2;
  noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
}

function playNoise(volume, duration, lowpassFreq = 1000) {
  if (!noiseBuffer) return;
  const source = audioCtx.createBufferSource();
  source.buffer = noiseBuffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpassFreq;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioState.masterGain);

  source.start();
  source.stop(audioCtx.currentTime + duration);
}

// ─── DAY 25 SOUND EFFECTS ───────────────────────────────────────────────────

// Fist shockwave: low 60hz punch + 200ms noise rumble + high-end crack
export function playShockwave() {
  if (audioState.isMuted || !checkCooldown('shockwave', 300)) return;
  ensureCtx();
  const now = audioCtx.currentTime;

  // 1. Low 60Hz punch
  const oscPunch = audioCtx.createOscillator();
  const gainPunch = audioCtx.createGain();
  oscPunch.type = 'sine';
  oscPunch.frequency.setValueAtTime(60 * audioState.pitchMultiplier, now);
  oscPunch.frequency.exponentialRampToValueAtTime(30 * audioState.pitchMultiplier, now + 0.15);
  gainPunch.gain.setValueAtTime(0.8, now);
  gainPunch.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
  oscPunch.connect(gainPunch);
  gainPunch.connect(audioState.masterGain);
  oscPunch.start(now);
  oscPunch.stop(now + 0.25);

  // 2. 200ms noise rumble
  playNoise(0.5, 0.2, 150);

  // 3. High-end crack
  const oscCrack = audioCtx.createOscillator();
  const gainCrack = audioCtx.createGain();
  oscCrack.type = 'triangle';
  oscCrack.frequency.setValueAtTime(800 * audioState.pitchMultiplier, now);
  oscCrack.frequency.exponentialRampToValueAtTime(200 * audioState.pitchMultiplier, now + 0.05);
  gainCrack.gain.setValueAtTime(0.4, now);
  gainCrack.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
  oscCrack.connect(gainCrack);
  gainCrack.connect(audioState.masterGain);
  oscCrack.start(now);
  oscCrack.stop(now + 0.05);
}

// Laser/Point: two phases (charge sound & fire sound)
export function playLaserCharge() {
  if (audioState.isMuted || !checkCooldown('lasercharge', 400)) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150 * audioState.pitchMultiplier, now);
  osc.frequency.linearRampToValueAtTime(450 * audioState.pitchMultiplier, now + 0.4);
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.4);
  osc.connect(gain);
  gain.connect(audioState.masterGain);
  osc.start(now);
  osc.stop(now + 0.4);
}

export function playLaser() {
  if (audioState.isMuted || !checkCooldown('laser', 150)) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(500 * audioState.pitchMultiplier, now);
  osc.frequency.exponentialRampToValueAtTime(900 * audioState.pitchMultiplier, now + 0.18);
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
  osc.connect(gain);
  gain.connect(audioState.masterGain);
  osc.start(now);
  osc.stop(now + 0.18);
}

// Shield/Open Palm: crystalline shimmer
export function playShield() {
  if (audioState.isMuted || !checkCooldown('shield', 400)) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  const freqs = [523.25, 659.25, 783.99, 987.77]; // C5, E5, G5, B5
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f * audioState.pitchMultiplier;
    gain.gain.setValueAtTime(0, now);
    gain.gain.setValueAtTime(0.15, now + i * 0.04);
    gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.04 + 0.5);
    osc.connect(gain);
    gain.connect(audioState.masterGain);
    osc.start(now + i * 0.04);
    osc.stop(now + i * 0.04 + 0.5);
  });
}

// Shield Expire or Shatter
export function playShieldExpire() {
  if (audioState.isMuted || !checkCooldown('shieldexpire', 200)) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300 * audioState.pitchMultiplier, now);
  osc.frequency.linearRampToValueAtTime(100 * audioState.pitchMultiplier, now + 0.25);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
  osc.connect(gain);
  gain.connect(audioState.masterGain);
  osc.start(now);
  osc.stop(now + 0.25);
  playNoise(0.2, 0.2, 800);
}

// Gravity Well: deep inward whooshing increasing in pitch
export function playGravityWell() {
  if (audioState.isMuted || !checkCooldown('gravitywell', 600)) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80 * audioState.pitchMultiplier, now);
  osc.frequency.exponentialRampToValueAtTime(320 * audioState.pitchMultiplier, now + 1.2);
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.6, now + 0.8);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
  osc.connect(gain);
  gain.connect(audioState.masterGain);
  osc.start(now);
  osc.stop(now + 1.2);

  // Layered noise whoosh
  const noiseSource = audioCtx.createBufferSource();
  if (noiseBuffer) {
    noiseSource.buffer = noiseBuffer;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(150, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(600, now + 1.2);
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.01, now);
    noiseGain.gain.linearRampToValueAtTime(0.4, now + 0.8);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioState.masterGain);
    noiseSource.start(now);
    noiseSource.stop(now + 1.2);
  }
}

// Surge/Smile: cascading multi-note release
export function playHeal() {
  if (audioState.isMuted || !checkCooldown('heal', 500)) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4, E4, G4, C5, E5, G5 cascade
  notes.forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * audioState.pitchMultiplier, now + idx * 0.08);
    gain.gain.setValueAtTime(0, now);
    gain.gain.setValueAtTime(0.25, now + idx * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.4);
    osc.connect(gain);
    gain.connect(audioState.masterGain);
    osc.start(now + idx * 0.08);
    osc.stop(now + idx * 0.08 + 0.4);
  });
}

// Freeze: descending icy tone
export function playFreeze() {
  if (audioState.isMuted || !checkCooldown('freeze', 800)) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  const freqs = [987.77, 880.00, 783.99];
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * audioState.pitchMultiplier, now + i * 0.06);
    osc.frequency.exponentialRampToValueAtTime((f/2) * audioState.pitchMultiplier, now + i * 0.06 + 0.4);
    gain.gain.setValueAtTime(0, now);
    gain.gain.setValueAtTime(0.25, now + i * 0.06);
    gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.4);
    osc.connect(gain);
    gain.connect(audioState.masterGain);
    osc.start(now + i * 0.06);
    osc.stop(now + i * 0.06 + 0.4);
  });
}

// Enemy defeat: short noise burst + pitch drop
export function playEnemyDefeat() {
  if (audioState.isMuted || !checkCooldown('edefeat', 80)) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(140 * audioState.pitchMultiplier, now);
  osc.frequency.linearRampToValueAtTime(20 * audioState.pitchMultiplier, now + 0.15);
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
  osc.connect(gain);
  gain.connect(audioState.masterGain);
  osc.start(now);
  osc.stop(now + 0.15);
  playNoise(0.25, 0.15, 600);
}

// Boss hit: deeper impact tone, scales with boss phase
export function playBossHit(phase) {
  if (audioState.isMuted || !checkCooldown('bhit', 120)) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  const baseFreq = 80 - (phase * 10);
  osc.frequency.setValueAtTime(baseFreq * audioState.pitchMultiplier, now);
  osc.frequency.exponentialRampToValueAtTime(25 * audioState.pitchMultiplier, now + 0.4);
  gain.gain.setValueAtTime(0.7, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  osc.connect(gain);
  gain.connect(audioState.masterGain);
  osc.start(now);
  osc.stop(now + 0.4);
  playNoise(0.4, 0.3, 200);
}

// Wave clear: ascending 3-note chime
export function playWaveClear() {
  if (audioState.isMuted) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * audioState.pitchMultiplier, now + i * 0.15);
    gain.gain.setValueAtTime(0, now);
    gain.gain.setValueAtTime(0.25, now + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.5);
    osc.connect(gain);
    gain.connect(audioState.masterGain);
    osc.start(now + i * 0.15);
    osc.stop(now + i * 0.15 + 0.5);
  });
}

// Game over: descending minor chord
export function playGameOver() {
  if (audioState.isMuted) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  const freqs = [392.00, 311.13, 261.63]; // G4, Eb4, C4 (C minor drop)
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f * audioState.pitchMultiplier, now);
    osc.frequency.exponentialRampToValueAtTime((f/2) * audioState.pitchMultiplier, now + 1.2);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 1.2);
    osc.connect(gain);
    gain.connect(audioState.masterGain);
    osc.start(now);
    osc.stop(now + 1.2);
  });
}

// Victory sound: 4-second full 8-oscillator harmonic chord
export function playVictory() {
  if (audioState.isMuted) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  // C major 9 rich harmonic layout
  const freqs = [130.81, 196.00, 261.63, 329.63, 392.00, 493.88, 523.25, 659.25]; // C3, G3, C4, E4, G4, B4, C5, E5
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * audioState.pitchMultiplier, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.setValueAtTime(0.15, now + i * 0.05);
    gain.gain.linearRampToValueAtTime(0.12, now + 1.0);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 4.0);
    osc.connect(gain);
    gain.connect(audioState.masterGain);
    osc.start(now);
    osc.stop(now + 4.0);
  });
}

// Combo strike
export function playComboStrike() {
  if (audioState.isMuted) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'square';

  osc1.frequency.setValueAtTime(150 * audioState.pitchMultiplier, now);
  osc1.frequency.exponentialRampToValueAtTime(800 * audioState.pitchMultiplier, now + 0.35);

  osc2.frequency.setValueAtTime(220 * audioState.pitchMultiplier, now);
  osc2.frequency.exponentialRampToValueAtTime(1200 * audioState.pitchMultiplier, now + 0.35);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(audioState.masterGain);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.6);
  osc2.stop(now + 0.6);
}

export function playSlowMo() {
  if (audioState.isMuted) return;
  ensureCtx();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(350 * audioState.pitchMultiplier, now);
  osc.frequency.exponentialRampToValueAtTime(45 * audioState.pitchMultiplier, now + 1.8);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 2.0);

  osc.connect(gain);
  gain.connect(audioState.masterGain);

  osc.start(now);
  osc.stop(now + 2.0);
}

// ─── BOSS OMINOUS DRONE (DAY 25) ───────────────────────────────────────────

export function startBossDrone() {
  if (audioState.isMuted) return;
  ensureCtx();
  const now = audioCtx.currentTime;

  bossDroneOscs = [];
  bossDroneGain = audioCtx.createGain();
  bossDroneGain.gain.setValueAtTime(0.2, now);
  bossDroneGain.connect(audioState.masterGain);

  // 3 detuned low sawtooth/triangle waves
  const roots = [55.00, 55.33, 110.00]; // A1, A2 slightly detuned
  roots.forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    osc.type = idx === 2 ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(freq * audioState.pitchMultiplier, now);
    osc.connect(bossDroneGain);
    osc.start(now);
    bossDroneOscs.push(osc);
  });
}

export function updateBossDrone(phase) {
  if (!bossDroneGain) return;
  const now = audioCtx.currentTime;
  // Intensifies with each phase
  const volume = 0.2 + (phase * 0.15);
  bossDroneGain.gain.linearRampToValueAtTime(volume, now + 1.0);
  
  bossDroneOscs.forEach((osc, idx) => {
    // Add aggressive detune or frequency shift
    const baseFreq = osc.frequency.value;
    osc.frequency.linearRampToValueAtTime(baseFreq * (1.0 + phase * 0.02) * audioState.pitchMultiplier, now + 1.0);
  });
}

export function stopBossDrone() {
  const now = audioCtx.currentTime;
  if (bossDroneGain) {
    bossDroneGain.gain.linearRampToValueAtTime(0.001, now + 1.5);
  }
  setTimeout(() => {
    bossDroneOscs.forEach(o => {
      try {
        o.stop();
      } catch(e) {}
    });
    bossDroneOscs = [];
    bossDroneGain = null;
  }, 1600);
}

// ─── COMBAT MUSIC HEARTBEAT (DAY 25) ──────────────────────────────────────

export function startHeartbeat() {
  stopHeartbeat();
  triggerHeartbeatStep();
}

export function updateHeartbeat(waveIndex) {
  heartbeatWaveIndex = waveIndex;
  // Heartbeat speeds up as wave index goes up
  heartbeatTempo = 120 + (waveIndex * 15);
}

export function stopHeartbeat() {
  if (heartbeatIntervalId) {
    clearTimeout(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
}

function triggerHeartbeatStep() {
  if (audioState.isMuted) {
    scheduleNextBeat();
    return;
  }
  ensureCtx();
  const now = audioCtx.currentTime;

  // Single beat of the heartbeat (low bass pulse)
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(55 * audioState.pitchMultiplier, now);
  osc.frequency.exponentialRampToValueAtTime(25 * audioState.pitchMultiplier, now + 0.12);
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(gain);
  gain.connect(audioState.masterGain);
  osc.start(now);
  osc.stop(now + 0.12);

  // Sub-double beat feel: schedule 2nd pulse 150ms later
  setTimeout(() => {
    if (audioState.isMuted || !heartbeatIntervalId) return;
    const tNow = audioCtx.currentTime;
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(50 * audioState.pitchMultiplier, tNow);
    osc2.frequency.exponentialRampToValueAtTime(20 * audioState.pitchMultiplier, tNow + 0.10);
    gain2.gain.setValueAtTime(0.20, tNow);
    gain2.gain.exponentialRampToValueAtTime(0.001, tNow + 0.10);
    osc2.connect(gain2);
    gain2.connect(audioState.masterGain);
    osc2.start(tNow);
    osc2.stop(tNow + 0.10);
  }, 150);

  scheduleNextBeat();
}

function scheduleNextBeat() {
  const ms = (60 / heartbeatTempo) * 1000;
  heartbeatIntervalId = setTimeout(triggerHeartbeatStep, ms);
}

// ─── TEMPORAL FREEZE SOUNDSCAPE WARP (DAY 27) ───────────────────────────────

export function setTemporalFreezePitch(active) {
  const targetMultiplier = active ? 0.8 : 1.0;
  audioState.pitchMultiplier = targetMultiplier;
  // Apply pitch warp dynamically to boss drone and heartbeat tempo if running
  const now = audioCtx.currentTime;
  if (bossDroneGain) {
    bossDroneOscs.forEach(o => {
      const freq = o.frequency.value;
      o.frequency.linearRampToValueAtTime(freq * targetMultiplier, now + 0.5);
    });
  }
}
