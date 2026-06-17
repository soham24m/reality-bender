// ─── DOM ─────────────────────────────────────────────────────────────────────
const video = document.getElementById('webcam')
const canvas = document.getElementById('overlay')
const ctx = canvas.getContext('2d')
const pillAction = document.getElementById('pill-action')
const pillStatus = document.getElementById('pill-status')
const pillDot = document.getElementById('pill-dot')

// Enemy management
const enemies = []
let currentWave = 0
let waveInProgress = false
let playerHP = 100
let playerDefeated = false
let enemiesFrozenUntil = 0
let score = 0

const ENEMY_TYPES = {
  DRONE: {
    color: 0x00ff44,
    emissive: 0x00aa00,
    size: 0.4,
    hp: 30,
    speed: 0.012,
    damage: 3,
    geometry: 'sphere',
    points: 10
  },
  FIGHTER: {
    color: 0xff2200,
    emissive: 0xff0000,
    size: 0.6,
    hp: 60,
    speed: 0.02,
    damage: 6,
    geometry: 'octahedron',
    points: 25
  },
  ELITE: {
    color: 0xaa00ff,
    emissive: 0x6600ff,
    size: 0.8,
    hp: 120,
    speed: 0.015,
    damage: 12,
    geometry: 'icosahedron',
    points: 50
  }
}

const WAVES = [
  { enemies: ['DRONE', 'DRONE', 'DRONE'] },
  { enemies: ['DRONE', 'DRONE', 'FIGHTER', 'FIGHTER'] },
  { enemies: ['FIGHTER', 'FIGHTER', 'FIGHTER', 'ELITE'] },
  { enemies: ['ELITE', 'ELITE', 'FIGHTER', 'FIGHTER', 'DRONE'] },
  { enemies: ['ELITE', 'ELITE', 'ELITE', 'FIGHTER', 'FIGHTER'] }
]

function updateHPBars() {
  document.getElementById('player-hp-bar').style.width = playerHP + '%'
  const active = enemies.filter(e => !e.defeated).length
  const total = enemies.length || 1
  document.getElementById('enemy-hp-bar').style.width = (active / total * 100) + '%'
}
updateHPBars()

function flashScreenRed() {
  document.body.style.boxShadow = 'inset 0 0 120px rgba(255,0,0,0.4)'
  setTimeout(() => {
    document.body.style.boxShadow = 'none'
  }, 300)
}

function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}
resizeCanvas()
window.addEventListener('resize', resizeCanvas)

function updatePill(action, status) {
  pillAction.textContent = action
  pillStatus.textContent = status
}

function showGestureConfirm(text, color = '#00ccff') {
  const el = document.getElementById('gesture-confirm')
  el.textContent = text
  el.style.color = color
  el.style.textShadow = `0 0 30px ${color}`
  el.style.opacity = '1'
  el.style.transform = 'translate(-50%, -50%) scale(1.2)'
  el.style.transition = 'opacity 100ms ease, transform 100ms ease'

  clearTimeout(showGestureConfirm._t)
  showGestureConfirm._t = setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translate(-50%, -50%) scale(1)'
  }, 600)
}

function showWaveAnnounce(text, subtext = '') {
  const el = document.getElementById('wave-announce')
  el.innerHTML = text +
    (subtext ? '<br><span style="font-size:14px;opacity:0.5;letter-spacing:0.1em">' +
    subtext + '</span>' : '')
  el.style.opacity = '1'
  el.style.transform = 'translateX(-50%) scale(1.1)'
  el.style.transition = 'all 300ms cubic-bezier(0.4,0,0.2,1)'

  clearTimeout(showWaveAnnounce._t)
  showWaveAnnounce._t = setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateX(-50%) scale(1)'
  }, 2000)
}

function addScore(points) {
  score += points
  document.getElementById('score-display').textContent = 'Score: ' + score.toLocaleString()
}

function spawnParticles(position, color) {
  const particleCount = 40
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(particleCount * 3)
  const velocities = []

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = position.x
    positions[i * 3 + 1] = position.y
    positions[i * 3 + 2] = position.z

    velocities.push({
      x: (Math.random() - 0.5) * 0.3,
      y: Math.random() * 0.2,
      z: (Math.random() - 0.5) * 0.3
    })
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.PointsMaterial({
    color: color,
    size: 0.15,
    transparent: true,
    opacity: 1
  })

  const particles = new THREE.Points(geometry, material)
  scene.add(particles)

  let life = 0
  const maxLife = 60

  function animateParticles() {
    if (life >= maxLife) {
      scene.remove(particles)
      geometry.dispose()
      material.dispose()
      return
    }

    const pos = geometry.attributes.position.array
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] += velocities[i].x
      pos[i * 3 + 1] += velocities[i].y
      pos[i * 3 + 2] += velocities[i].z
      velocities[i].y -= 0.005
    }
    geometry.attributes.position.needsUpdate = true
    material.opacity = 1 - (life / maxLife)
    life++
    requestAnimationFrame(animateParticles)
  }

  animateParticles()
}

function createEnemy(type) {
  const config = ENEMY_TYPES[type]

  let geo
  if (config.geometry === 'sphere')
    geo = new THREE.SphereGeometry(config.size, 16, 16)
  else if (config.geometry === 'octahedron')
    geo = new THREE.OctahedronGeometry(config.size, 0)
  else
    geo = new THREE.IcosahedronGeometry(config.size, 0)

  const mat = new THREE.MeshStandardMaterial({
    color: config.color,
    emissive: config.emissive,
    emissiveIntensity: 2,
    roughness: 0.2,
    metalness: 0.8
  })

  const mesh = new THREE.Mesh(geo, mat)

  const wireMat = new THREE.MeshBasicMaterial({
    color: config.color,
    wireframe: true,
    transparent: true,
    opacity: 0.3
  })
  const wireMesh = new THREE.Mesh(geo.clone(), wireMat)
  mesh.add(wireMesh)

  const light = new THREE.PointLight(config.color, 2, 5)
  mesh.add(light)

  const angle = Math.random() * Math.PI * 2
  const radius = 8 + Math.random() * 2
  mesh.position.set(
    Math.cos(angle) * radius,
    0,
    Math.sin(angle) * radius
  )

  scene.add(mesh)

  enemies.push({
    mesh,
    type,
    hp: config.hp,
    maxHp: config.hp,
    speed: config.speed,
    damage: config.damage,
    points: config.points,
    frameOffset: Math.random() * 100,
    defeated: false
  })

  updateHPBars()
}

function spawnWave(waveIndex) {
  if (waveIndex >= WAVES.length) {
    showWaveAnnounce('VICTORY', 'Final score: ' + score)
    updatePill('Victory!', 'All waves cleared')
    return
  }
  currentWave = waveIndex
  waveInProgress = true

  showWaveAnnounce(
    'WAVE ' + (waveIndex + 1),
    WAVES[waveIndex].enemies.length + ' enemies'
  )

  const wave = WAVES[waveIndex]
  wave.enemies.forEach((type, i) => {
    setTimeout(() => createEnemy(type), i * 800)
  })

  updatePill('Wave ' + (waveIndex + 1),
    wave.enemies.length + ' enemies incoming')
}

function defeatEnemy(enemy) {
  enemy.defeated = true
  spawnParticles(enemy.mesh.position, enemy.mesh.material.color)
  addScore(enemy.points)
  scene.remove(enemy.mesh)
  updateHPBars()
}

function damageAllEnemies(amount, range = 999) {
  enemies.forEach(enemy => {
    if (enemy.defeated) return
    const dist = enemy.mesh.position.distanceTo(playerOrb.position)
    if (dist <= range) {
      enemy.hp -= amount
      if (enemy.hp <= 0) defeatEnemy(enemy)
    }
  })
  updateHPBars()
}

function pushEnemiesInRange(range, force) {
  enemies.forEach(enemy => {
    if (enemy.defeated) return
    const dist = enemy.mesh.position.distanceTo(playerOrb.position)
    if (dist <= range) {
      const dir = new THREE.Vector3()
      dir.subVectors(enemy.mesh.position, playerOrb.position).normalize()
      enemy.mesh.position.addScaledVector(dir, force)
    }
  })
}

// ─── Cooldowns ───────────────────────────────────────────────────────────────
const actionCooldowns = {}
const COOLDOWN_TIMES = {
  'Fist': 1200,
  'Pointing': 800,
  'Gun': 600,
  'Open Palm': 1500,
  'Peace': 1000,
  'Mouth open': 2000,
  'Smiling': 2000,
  'Head tilt left': 1000,
  'Head tilt right': 1000
}

function isOnCooldown(gesture) {
  const now = Date.now()
  if (actionCooldowns[gesture] && now < actionCooldowns[gesture]) return true
  return false
}

function setCooldown(gesture) {
  const duration = COOLDOWN_TIMES[gesture] || 1000
  actionCooldowns[gesture] = Date.now() + duration
}

// ─── 3D refs ─────────────────────────────────────────────────────────────────
let playerOrb, orbLight, orbShell, purpleLight, blueLight, stars, scene

function onInteraction(type, source) {
  if (isOnCooldown(type)) return
  setCooldown(type)

  updatePill(type, source === 'hand' ? 'hand detected' : 'tracking')

  if (source === 'hand') {
    if (type === 'Fist') {
      showGestureConfirm('SHOCKWAVE', '#ffffff')
      damageAllEnemies(25, 5)
      pushEnemiesInRange(5, 3)
      playerOrb.material.emissive.setHex(0xffffff)
      playerOrb.scale.set(1.5, 1.5, 1.5)
      setTimeout(() => {
        playerOrb.material.emissive.setHex(0x00ccff)
        playerOrb.scale.set(1, 1, 1)
      }, 200)
    }

    if (type === 'Open Palm') {
      showGestureConfirm('SHIELD', '#00ff88')
      playerHP = Math.min(100, playerHP + 15)
      updateHPBars()
      playerOrb.material.emissive.setHex(0x00ff44)
      orbLight.color.setHex(0x00ff44)
      setTimeout(() => {
        playerOrb.material.emissive.setHex(0x00ccff)
        orbLight.color.setHex(0x00ffff)
      }, 1000)
    }

    if (type === 'Pointing') {
      showGestureConfirm('LASER', '#ffff00')
      damageAllEnemies(20, 8)
      pushEnemiesInRange(8, 5)
      playerOrb.material.emissive.setHex(0xffff00)
      orbLight.color.setHex(0xffff00)
      setTimeout(() => {
        playerOrb.material.emissive.setHex(0x00ccff)
        orbLight.color.setHex(0x00ffff)
      }, 300)
    }

    if (type === 'Gun') {
      showGestureConfirm('FIRE', '#ff6600')
      damageAllEnemies(30, 6)
      pushEnemiesInRange(6, 7)
      playerOrb.material.emissive.setHex(0xff6600)
      orbLight.color.setHex(0xff6600)
      setTimeout(() => {
        playerOrb.material.emissive.setHex(0x00ccff)
        orbLight.color.setHex(0x00ffff)
      }, 300)
    }

    if (type === 'Peace') {
      showGestureConfirm('PEACE', '#aa88ff')
    }
  }

  if (source === 'face') {
    if (type === 'Mouth open') {
      showGestureConfirm('FREEZE', '#0088ff')
      enemiesFrozenUntil = Date.now() + 1200
      enemies.forEach(enemy => {
        if (!enemy.defeated) enemy.mesh.material.emissive.setHex(0x0000ff)
      })
    }

    if (type === 'Smiling') {
      showGestureConfirm('SURGE', '#ffaa00')
      purpleLight.intensity = 8
      blueLight.intensity = 8
      setTimeout(() => {
        purpleLight.intensity = 3
        blueLight.intensity = 3
      }, 500)
    }

    if (type === 'Head tilt left') {
      showGestureConfirm('DODGE LEFT', '#ff88ff')
      playerOrb.position.x -= 1.5
    }

    if (type === 'Head tilt right') {
      showGestureConfirm('DODGE RIGHT', '#ff88ff')
      playerOrb.position.x += 1.5
    }
  }
}

// ─── Three.js scene ──────────────────────────────────────────────────────────
scene = new THREE.Scene()

const starGeometry = new THREE.BufferGeometry()
const starPositions = []
for (let i = 0; i < 800; i++) {
  starPositions.push(
    (Math.random() - 0.5) * 200,
    (Math.random() - 0.5) * 200,
    (Math.random() - 0.5) * 200
  )
}
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({
  color: 0xffffff, size: 0.08, transparent: true, opacity: 0.8
}))
scene.add(stars)

const camera3D = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 100
)
camera3D.position.set(0, 4, 10)
camera3D.lookAt(0, 0, -2)

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setClearColor(0x000000, 1)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true

const threeCanvas = renderer.domElement
threeCanvas.classList.add('three-canvas')
threeCanvas.style.position = 'fixed'
threeCanvas.style.top = '0'
threeCanvas.style.left = '0'
threeCanvas.style.width = '100vw'
threeCanvas.style.height = '100vh'
threeCanvas.style.zIndex = '1'
threeCanvas.style.pointerEvents = 'none'
document.body.insertBefore(threeCanvas, document.getElementById('overlay'))

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30, 20, 20),
  new THREE.MeshStandardMaterial({ color: 0x000510, roughness: 1, metalness: 0 })
)
floor.rotation.x = -Math.PI / 2
floor.position.y = -1
floor.receiveShadow = true
scene.add(floor)

const gridHelper = new THREE.GridHelper(30, 30, 0x0033ff, 0x001133)
gridHelper.position.y = -0.99
scene.add(gridHelper)

const grid2 = new THREE.GridHelper(30, 15, 0x220044, 0x110022)
grid2.position.y = -0.98
scene.add(grid2)

const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x4444ff, transparent: true, opacity: 0.4 })
const arenaSize = 10
const corners = [
  [-arenaSize, -1, -arenaSize], [arenaSize, -1, -arenaSize],
  [arenaSize, -1, arenaSize], [-arenaSize, -1, arenaSize],
  [-arenaSize, -1, -arenaSize]
]
scene.add(new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(corners.map(c => new THREE.Vector3(...c))),
  edgeMaterial
))

;[[-10, 0, -10], [10, 0, -10], [-10, 0, 10], [10, 0, 10]].forEach(pos => {
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x4400ff, emissive: 0x2200ff, emissiveIntensity: 3 })
  )
  pillar.position.set(pos[0], 1, pos[2])
  scene.add(pillar)
  const light = new THREE.PointLight(0x4400ff, 1, 8)
  light.position.set(pos[0], 2, pos[2])
  scene.add(light)
})
// adjust camera angle to better view the arena
camera3D.position.set(0, 6, 12)
camera3D.lookAt(0, 0, 0)

// replace existing grid helpers with a single larger grid
if (typeof gridHelper !== 'undefined') scene.remove(gridHelper)
if (typeof grid2 !== 'undefined') scene.remove(grid2)
const grid = new THREE.GridHelper(40, 40, 0x0033ff, 0x001133)
grid.position.y = -0.99
scene.add(grid)

// expand the floor to cover a larger arena (replace existing floor geometry)
if (floor && floor.geometry) {
  floor.geometry.dispose()
  floor.geometry = new THREE.PlaneGeometry(60, 60)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -1
  floor.receiveShadow = true
}
scene.add(new THREE.AmbientLight(0x111133, 2))
purpleLight = new THREE.PointLight(0x6600ff, 3, 20)
purpleLight.position.set(-5, 5, -5)
scene.add(purpleLight)
blueLight = new THREE.PointLight(0x0044ff, 3, 20)
blueLight.position.set(5, 5, 5)
scene.add(blueLight)
const centerLight = new THREE.PointLight(0xffffff, 1, 10)
centerLight.position.set(0, 3, 0)
scene.add(centerLight)

playerOrb = new THREE.Mesh(
  new THREE.SphereGeometry(0.35, 32, 32),
  new THREE.MeshStandardMaterial({
    color: 0x00ffff, emissive: 0x00ccff, emissiveIntensity: 3,
    roughness: 0, metalness: 1, transparent: true, opacity: 0.9
  })
)
playerOrb.position.set(0, 0, 3)
scene.add(playerOrb)

orbShell = new THREE.Mesh(
  new THREE.SphereGeometry(0.55, 32, 32),
  new THREE.MeshStandardMaterial({
    color: 0x0044ff, emissive: 0x0022ff, emissiveIntensity: 1,
    transparent: true, opacity: 0.15, side: THREE.BackSide
  })
)
scene.add(orbShell)

orbLight = new THREE.PointLight(0x00ffff, 2, 5)
playerOrb.add(orbLight)

setTimeout(() => spawnWave(0), 2000)

window.addEventListener('resize', () => {
  camera3D.aspect = window.innerWidth / window.innerHeight
  camera3D.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  resizeCanvas()
})

let frameCount = 0
function animate() {
  requestAnimationFrame(animate)
  frameCount++

  const bar = document.getElementById('cooldown-bar')
  const now = Date.now()
  const mostRecent = Object.entries(actionCooldowns).sort((a, b) => b[1] - a[1])[0]

  if (mostRecent) {
    const gesture = mostRecent[0]
    const expiry = mostRecent[1]
    const duration = COOLDOWN_TIMES[gesture] || 1000
    const remaining = Math.max(0, expiry - now)
    const progress = 1 - (remaining / duration)
    bar.style.width = (progress * 100) + '%'
  } else {
    bar.style.width = '100%'
  }

  if (enemiesFrozenUntil && now >= enemiesFrozenUntil) {
    enemiesFrozenUntil = 0
    enemies.forEach(enemy => {
      if (!enemy.defeated) {
        const config = ENEMY_TYPES[enemy.type]
        enemy.mesh.material.emissive.setHex(config.emissive)
      }
    })
  }

  stars.rotation.y += 0.0002
  playerOrb.position.y = Math.sin(frameCount * 0.03) * 0.2
  playerOrb.rotation.y += 0.01
  orbShell.position.copy(playerOrb.position)
  orbShell.rotation.y -= 0.02
  orbShell.rotation.x += 0.01

  if (!playerDefeated) {
    const frozen = enemiesFrozenUntil && now < enemiesFrozenUntil

    enemies.forEach(enemy => {
      if (enemy.defeated || frozen) return

      const dist = enemy.mesh.position.distanceTo(playerOrb.position)

      if (dist > 3) {
        const dir = new THREE.Vector3()
        dir.subVectors(playerOrb.position, enemy.mesh.position).normalize()
        enemy.mesh.position.addScaledVector(dir, enemy.speed)
        enemy.mesh.position.x +=
          Math.sin((frameCount + enemy.frameOffset) * 0.08) * 0.03
      } else {
        enemy.mesh.position.x += (Math.random() - 0.5) * 0.08
        enemy.mesh.position.z += (Math.random() - 0.5) * 0.08

        if (frameCount % 60 === 0 && !playerDefeated) {
          playerHP = Math.max(0, playerHP - enemy.damage)
          updateHPBars()
          flashScreenRed()
          if (playerHP <= 0) {
            playerDefeated = true
            updatePill('Defeated', 'Game over')
          }
        }
      }

      enemy.mesh.rotation.x += 0.012
      enemy.mesh.rotation.y += 0.018
    })

    if (waveInProgress &&
        enemies.length > 0 &&
        enemies.every(e => e.defeated)) {
      waveInProgress = false
      enemies.length = 0
      updateHPBars()
      setTimeout(() => spawnWave(currentWave + 1), 2500)
    }
  }

  orbLight.intensity = (Math.sin(frameCount * 0.05) * 0.5 + 1) * 2
  renderer.render(scene, camera3D)
}
animate()

// ─── Gesture stability engine ────────────────────────────────────────────────
const gestureBuffer = []
const BUFFER_SIZE = 8
let currentLockedGesture = null
let lockedGestureExpiry = 0

function submitRawGesture(gesture, source) {
  const now = Date.now()

  if (currentLockedGesture && now < lockedGestureExpiry) return

  gestureBuffer.push({ gesture, source, time: now })
  if (gestureBuffer.length > BUFFER_SIZE) gestureBuffer.shift()

  const recent = gestureBuffer.filter(g => now - g.time < 600)

  const counts = {}
  recent.forEach(g => {
    counts[g.gesture] = (counts[g.gesture] || 0) + 1
  })

  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]

  if (dominant && dominant[1] >= 5) {
    const confirmedGesture = dominant[0]
    const confirmedSource = recent.find(g => g.gesture === confirmedGesture)?.source || source

    const lockDuration = {
      'Fist': 800,
      'Open Palm': 1000,
      'Pointing': 800,
      'Peace': 800,
      'Gun': 800,
      'Mouth open': 1200,
      'Smiling': 1500,
      'Head tilt left': 1000,
      'Head tilt right': 1000,
      'Neutral': 300
    }

    const duration = lockDuration[confirmedGesture] || 800

    if (confirmedGesture !== currentLockedGesture) {
      currentLockedGesture = confirmedGesture
      lockedGestureExpiry = now + duration
      gestureBuffer.length = 0
      onInteraction(confirmedGesture, confirmedSource)
    }
  }
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
      audio: false
    })
    video.srcObject = stream
    await video.play()
    updatePill('Ready', 'camera active')
  } catch (err) {
    console.error('Camera error:', err)
    updatePill('Camera error', err.message)
  }
}

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
})
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.75,
  minTrackingConfidence: 0.6
})

function detectHandGesture(lm) {
  const thumbUp = lm[4].y < lm[3].y
  const indexUp = lm[8].y < lm[6].y
  const middleUp = lm[12].y < lm[10].y
  const ringUp = lm[16].y < lm[14].y
  const pinkyUp = lm[20].y < lm[18].y
  const gunShape = thumbUp && indexUp && middleUp && !ringUp && !pinkyUp

  if (!indexUp && !middleUp && !ringUp && !pinkyUp) return 'Fist'
  if (indexUp && middleUp && ringUp && pinkyUp) return 'Open Palm'
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return 'Pointing'
  if (gunShape) return 'Gun'
  if (indexUp && middleUp && !ringUp && !pinkyUp) return 'Peace'
  return null
}

hands.onResults((results) => {
  if (!results.multiHandLandmarks?.length) return
  const gesture = detectHandGesture(results.multiHandLandmarks[0])
  if (gesture) submitRawGesture(gesture, 'hand')
})

const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
})
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
})

faceMesh.onResults((results) => {
  if (!results.multiFaceLandmarks?.length) {
    pillDot.classList.remove('live')
    updatePill('Ready', 'show your face')
    return
  }

  pillDot.classList.add('live')

  const lm = results.multiFaceLandmarks[0]
  const mouthOpen = Math.abs(lm[13].y - lm[14].y) > 0.055
  const smile = Math.abs(lm[61].x - lm[291].x) > 0.46
  const noseTipX = lm[1].x
  const faceCenterX = (lm[234].x + lm[454].x) / 2
  const tiltAmount = noseTipX - faceCenterX
  const headTiltLeft = tiltAmount < -0.06
  const headTiltRight = tiltAmount > 0.06

  if (mouthOpen) submitRawGesture('Mouth open', 'face')
  else if (smile) submitRawGesture('Smiling', 'face')
  else if (headTiltLeft) submitRawGesture('Head tilt left', 'face')
  else if (headTiltRight) submitRawGesture('Head tilt right', 'face')
  else if (!currentLockedGesture || Date.now() >= lockedGestureExpiry) {
    updatePill('Neutral', 'tracking')
  }
})

async function startTracking() {
  const mpCamera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video })
      await faceMesh.send({ image: video })
    },
    width: 1280,
    height: 720
  })
  mpCamera.start()
}

startCamera().then(() => startTracking())
