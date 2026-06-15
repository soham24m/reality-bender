// ─── DOM ─────────────────────────────────────────────────────────────────────
const video = document.getElementById('webcam')
const canvas = document.getElementById('overlay')
const ctx = canvas.getContext('2d')
const pillAction = document.getElementById('pill-action')
const pillStatus = document.getElementById('pill-status')
const pillDot = document.getElementById('pill-dot')

let enemyHP = 100
let playerHP = 100
let enemyDefeated = false
let enemyFrozen = false
let enemyFrozenUntil = 0

function updateHPBars() {
  document.getElementById('player-hp-bar').style.width = playerHP + '%'
  document.getElementById('enemy-hp-bar').style.width = enemyHP + '%'
}
updateHPBars()

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

// ─── Prompt 3: gesture confirmation flash ────────────────────────────────────
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

// ─── Prompt 4: action cooldowns ──────────────────────────────────────────────
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
let playerOrb, orbLight, orbShell, enemyCube, enemyWire, purpleLight, blueLight, stars

function onInteraction(type, source) {
  if (isOnCooldown(type)) return
  setCooldown(type)

  updatePill(type, source === 'hand' ? 'hand detected' : 'tracking')

  if (source === 'hand') {
    if (type === 'Fist') {
      showGestureConfirm('SHOCKWAVE', '#ffffff')
      enemyHP = Math.max(0, enemyHP - 20)
      updateHPBars()
      playerOrb.material.emissive.setHex(0xffffff)
      playerOrb.scale.set(1.5, 1.5, 1.5)
      setTimeout(() => {
        playerOrb.material.emissive.setHex(0x00ccff)
        playerOrb.scale.set(1, 1, 1)
      }, 200)
      const dir = new THREE.Vector3()
      dir.subVectors(enemyCube.position, playerOrb.position).normalize()
      enemyCube.position.addScaledVector(dir, 3)
    }

    if (type === 'Open Palm') {
      showGestureConfirm('SHIELD', '#00ff88')
      playerHP = Math.min(100, playerHP + 10)
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
      enemyHP = Math.max(0, enemyHP - 15)
      updateHPBars()
      playerOrb.material.emissive.setHex(0xffff00)
      orbLight.color.setHex(0xffff00)
      const dir = new THREE.Vector3()
      dir.subVectors(enemyCube.position, playerOrb.position).normalize()
      enemyCube.position.addScaledVector(dir, 5)
      setTimeout(() => {
        playerOrb.material.emissive.setHex(0x00ccff)
        orbLight.color.setHex(0x00ffff)
      }, 300)
    }

    if (type === 'Gun') {
      showGestureConfirm('FIRE', '#ff6600')
      enemyHP = Math.max(0, enemyHP - 25)
      updateHPBars()
      playerOrb.material.emissive.setHex(0xff6600)
      orbLight.color.setHex(0xff6600)
      const dir = new THREE.Vector3()
      dir.subVectors(enemyCube.position, playerOrb.position).normalize()
      enemyCube.position.addScaledVector(dir, 7)
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
      enemyFrozen = true
      enemyFrozenUntil = Date.now() + 1200
      enemyCube.material.emissive.setHex(0x0000ff)
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

// ─── Prompt 1: Three.js — transparent overlay on camera ──────────────────────
const scene = new THREE.Scene()

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
renderer.setClearColor(0x000000, 0)
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

enemyCube = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.6, 0),
  new THREE.MeshStandardMaterial({
    color: 0xff1100, emissive: 0xff0000, emissiveIntensity: 2,
    roughness: 0.2, metalness: 0.8
  })
)
enemyCube.position.set(0, 0, -5)
scene.add(enemyCube)

enemyWire = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.65, 0),
  new THREE.MeshBasicMaterial({ color: 0xff4400, wireframe: true, transparent: true, opacity: 0.4 })
)
enemyCube.add(enemyWire)
enemyCube.add(new THREE.PointLight(0xff2200, 2, 4))

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

  // Prompt 4: cooldown bar animation
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

  if (enemyFrozen && Date.now() >= enemyFrozenUntil) {
    enemyFrozen = false
    enemyCube.material.emissive.setHex(0xff0000)
  }

  stars.rotation.y += 0.0002
  playerOrb.position.y = Math.sin(frameCount * 0.03) * 0.2
  playerOrb.rotation.y += 0.01
  orbShell.position.copy(playerOrb.position)
  orbShell.rotation.y -= 0.02
  orbShell.rotation.x += 0.01

  if (!enemyDefeated && !enemyFrozen) {
    const distToPlayer = enemyCube.position.distanceTo(playerOrb.position)

    if (distToPlayer > 6) {
      const angle = frameCount * 0.01
      enemyCube.position.x += Math.sin(angle) * 0.02
      enemyCube.position.z += Math.cos(angle) * 0.01
      const dir = new THREE.Vector3()
      dir.subVectors(playerOrb.position, enemyCube.position).normalize()
      enemyCube.position.addScaledVector(dir, 0.01)
    } else if (distToPlayer > 3) {
      const dir = new THREE.Vector3()
      dir.subVectors(playerOrb.position, enemyCube.position).normalize()
      enemyCube.position.addScaledVector(dir, 0.025)
      enemyCube.position.x += Math.sin(frameCount * 0.1) * 0.04
    } else {
      enemyCube.position.x += (Math.random() - 0.5) * 0.1
      enemyCube.position.z += (Math.random() - 0.5) * 0.1
      if (frameCount % 10 === 0) {
        enemyCube.material.emissiveIntensity =
          enemyCube.material.emissiveIntensity === 4 ? 1 : 4
      }
      if (frameCount % 60 === 0) {
        playerHP = Math.max(0, playerHP - 5)
        updateHPBars()
        updatePill('Taking damage!', 'HP: ' + playerHP)
        document.body.style.boxShadow = 'inset 0 0 100px rgba(255,0,0,0.5)'
        setTimeout(() => { document.body.style.boxShadow = 'none' }, 300)
      }
    }

    enemyCube.rotation.x += 0.015
    enemyCube.rotation.y += 0.02
    enemyCube.rotation.z += 0.008
    enemyWire.rotation.y -= 0.03

    if (enemyHP <= 0 && !enemyDefeated) {
      enemyDefeated = true
      let scale = 1
      const explode = setInterval(() => {
        scale += 0.15
        enemyCube.scale.set(scale, scale, scale)
        enemyCube.material.emissiveIntensity = scale * 3
        if (scale > 4) {
          scene.remove(enemyCube)
          clearInterval(explode)
          showGestureConfirm('VICTORY', '#00ff88')
          updatePill('Enemy defeated!', 'Wave complete')
          setTimeout(() => {
            enemyCube.position.set((Math.random() - 0.5) * 8, 0, -6)
            enemyCube.scale.set(1, 1, 1)
            enemyCube.material.emissiveIntensity = 2
            scene.add(enemyCube)
            enemyHP = 100
            enemyDefeated = false
            updateHPBars()
          }, 3000)
        }
      }, 50)
    }
  }

  orbLight.intensity = (Math.sin(frameCount * 0.05) * 0.5 + 1) * 2
  renderer.render(scene, camera3D)
}
animate()

// ─── Prompt 2: gesture stability engine ──────────────────────────────────────
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

// ─── Camera ──────────────────────────────────────────────────────────────────
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

// ─── Hand detection ──────────────────────────────────────────────────────────
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

// ─── Face detection (no blink/wink/brows) ────────────────────────────────────
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
