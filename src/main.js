// Step 1 — Get elements:
const video = document.getElementById('webcam')
const canvas = document.getElementById('overlay')
const ctx = canvas.getContext('2d')
const pillAction = document.getElementById('pill-action')
const pillStatus = document.getElementById('pill-status')
const pillDot = document.getElementById('pill-dot')

// Step 2 — Resize canvas to match window:
function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}
resizeCanvas()

// Step 3 — Update pill function:
function updatePill(action, status) {
  pillAction.textContent = action
  pillStatus.textContent = status
}

// Global references for 3D elements accessed in onInteraction:
let playerOrb
let orbLight
let enemyCube
let purpleLight
let blueLight

function onInteraction(type, source) {
  updatePill(type, source === 'hand' ? 'hand detected' : 'tracking')
  
  if (source === 'hand') {
    if (type === 'Fist') {
      // Orb flashes white and scales up briefly
      playerOrb.material.emissive.setHex(0xffffff)
      playerOrb.scale.set(1.5, 1.5, 1.5)
      setTimeout(() => {
        playerOrb.material.emissive.setHex(0x00aaff)
        playerOrb.scale.set(1, 1, 1)
      }, 200)
      
      // Push enemy back
      const dir = new THREE.Vector3()
      dir.subVectors(enemyCube.position, playerOrb.position).normalize()
      enemyCube.position.addScaledVector(dir, 3)
    }
    
    if (type === 'Open Palm') {
      // Orb turns green — shield mode
      playerOrb.material.emissive.setHex(0x00ff44)
      orbLight.color.setHex(0x00ff44)
      setTimeout(() => {
        playerOrb.material.emissive.setHex(0x00aaff)
        orbLight.color.setHex(0x00ffff)
      }, 1000)
    }
    
    if (type === 'Pointing') {
      // Orb turns yellow — laser mode
      playerOrb.material.emissive.setHex(0xffff00)
      orbLight.color.setHex(0xffff00)
      // Move enemy back fast
      const dir = new THREE.Vector3()
      dir.subVectors(enemyCube.position, playerOrb.position).normalize()
      enemyCube.position.addScaledVector(dir, 5)
      setTimeout(() => {
        playerOrb.material.emissive.setHex(0x00aaff)
        orbLight.color.setHex(0x00ffff)
      }, 300)
    }
    
    if (type === 'Pinch') {
      // Pull enemy toward player
      const dir = new THREE.Vector3()
      dir.subVectors(playerOrb.position, enemyCube.position).normalize()
      enemyCube.position.addScaledVector(dir, 4)
    }
  }
  
  if (source === 'face') {
    if (type === 'Mouth open') {
      // Enemy freezes for 1 second
      enemyCube.material.emissive.setHex(0x0000ff)
      setTimeout(() => {
        enemyCube.material.emissive.setHex(0xff0000)
      }, 1000)
    }
    if (type === 'Smiling') {
      // All lights pulse bright
      purpleLight.intensity = 8
      blueLight.intensity = 8
      setTimeout(() => {
        purpleLight.intensity = 3
        blueLight.intensity = 3
      }, 500)
    }
  }
}

// SCENE SETUP:
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)
scene.fog = new THREE.Fog(0x000000, 15, 40)

const camera3D = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 100
)
camera3D.position.set(0, 3, 8)
camera3D.lookAt(0, 0, 0)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.setPixelRatio(window.devicePixelRatio)

// Insert renderer canvas BETWEEN video and overlay
const threeCanvas = renderer.domElement
threeCanvas.style.position = 'fixed'
threeCanvas.style.top = '0'
threeCanvas.style.left = '0'
threeCanvas.style.zIndex = '1'
threeCanvas.style.pointerEvents = 'none'
document.body.insertBefore(threeCanvas, document.getElementById('overlay'))

// Move overlay canvas z-index to 2
document.getElementById('overlay').style.zIndex = '2'

// ARENA FLOOR:
const floorGeometry = new THREE.PlaneGeometry(30, 30, 20, 20)
const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0x0a0a1a,
  wireframe: false,
  roughness: 0.8,
  metalness: 0.2
})
const floor = new THREE.Mesh(floorGeometry, floorMaterial)
floor.rotation.x = -Math.PI / 2
floor.position.y = -1
floor.receiveShadow = true
scene.add(floor)

// GRID OVERLAY ON FLOOR:
const gridHelper = new THREE.GridHelper(30, 30, 0x1a1a4a, 0x1a1a4a)
gridHelper.position.y = -0.99
scene.add(gridHelper)

// ARENA WALLS (4 glowing edge lines):
const edgeMaterial = new THREE.LineBasicMaterial({ 
  color: 0x4444ff, 
  transparent: true, 
  opacity: 0.4 
})
const arenaSize = 10
const corners = [
  [-arenaSize, -1, -arenaSize],
  [arenaSize, -1, -arenaSize],
  [arenaSize, -1, arenaSize],
  [-arenaSize, -1, arenaSize],
  [-arenaSize, -1, -arenaSize]
]
const edgePoints = corners.map(c => new THREE.Vector3(...c))
const edgeGeometry = new THREE.BufferGeometry().setFromPoints(edgePoints)
const arenaEdge = new THREE.Line(edgeGeometry, edgeMaterial)
scene.add(arenaEdge)

// LIGHTING:
const ambientLight = new THREE.AmbientLight(0x111133, 2)
scene.add(ambientLight)

purpleLight = new THREE.PointLight(0x6600ff, 3, 20)
purpleLight.position.set(-5, 5, -5)
scene.add(purpleLight)

blueLight = new THREE.PointLight(0x0044ff, 3, 20)
blueLight.position.set(5, 5, 5)
scene.add(blueLight)

const centerLight = new THREE.PointLight(0xffffff, 1, 10)
centerLight.position.set(0, 3, 0)
scene.add(centerLight)

// PLAYER ORB:
const orbGeometry = new THREE.SphereGeometry(0.4, 32, 32)
const orbMaterial = new THREE.MeshStandardMaterial({
  color: 0x00ffff,
  emissive: 0x00aaff,
  emissiveIntensity: 2,
  roughness: 0.1,
  metalness: 0.9
})
playerOrb = new THREE.Mesh(orbGeometry, orbMaterial)
playerOrb.position.set(0, 0, 3)
scene.add(playerOrb)

// Orb glow light
orbLight = new THREE.PointLight(0x00ffff, 2, 5)
playerOrb.add(orbLight)

// ENEMY CUBE:
const enemyGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8)
const enemyMaterial = new THREE.MeshStandardMaterial({
  color: 0xff2200,
  emissive: 0xff0000,
  emissiveIntensity: 1,
  roughness: 0.3,
  metalness: 0.7
})
enemyCube = new THREE.Mesh(enemyGeometry, enemyMaterial)
enemyCube.position.set(0, 0, -5)
scene.add(enemyCube)

// Enemy glow light
const enemyLight = new THREE.PointLight(0xff2200, 2, 4)
enemyCube.add(enemyLight)

// RESIZE HANDLER:
window.addEventListener('resize', () => {
  camera3D.aspect = window.innerWidth / window.innerHeight
  camera3D.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  resizeCanvas()
})

// ANIMATION LOOP:
let frameCount = 0
function animate() {
  requestAnimationFrame(animate)
  frameCount++
  
  // Orb hover animation
  playerOrb.position.y = Math.sin(frameCount * 0.03) * 0.2
  
  // Orb slow rotation
  playerOrb.rotation.y += 0.01
  
  // Enemy slow rotation
  enemyCube.rotation.x += 0.008
  enemyCube.rotation.y += 0.012
  
  // Enemy slowly moves toward player
  const dir = new THREE.Vector3()
  dir.subVectors(playerOrb.position, enemyCube.position).normalize()
  enemyCube.position.addScaledVector(dir, 0.008)
  
  // Pulse lights
  const pulse = Math.sin(frameCount * 0.05) * 0.5 + 1
  orbLight.intensity = pulse * 2
  
  renderer.render(scene, camera3D)
}
animate()

// Step 4 — Start webcam:
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
      audio: false
    })
    video.srcObject = stream
    await video.play()
    console.log('Camera started')
    updatePill('Ready', 'camera active')
  } catch(err) {
    console.error('Camera error:', err)
    updatePill('Camera error', err.message)
  }
}

// Step 5 — Hand gesture detection:
const hands = new Hands({
  locateFile: (file) => 
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
})
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5
})

let lastGestureTime = 0
const GESTURE_COOLDOWN = 500

hands.onResults((results) => {
  if (!results.multiHandLandmarks || 
      results.multiHandLandmarks.length === 0) return
  
  const lm = results.multiHandLandmarks[0]
  const now = Date.now()
  if (now - lastGestureTime < GESTURE_COOLDOWN) return
  
  // Finger extended check: tip y < pip y means extended
  const thumbUp = lm[4].y < lm[3].y
  const indexUp = lm[8].y < lm[6].y
  const middleUp = lm[12].y < lm[10].y
  const ringUp = lm[16].y < lm[14].y
  const pinkyUp = lm[20].y < lm[18].y
  
  let gesture = null
  
  if (!indexUp && !middleUp && !ringUp && !pinkyUp) {
    gesture = 'Fist'
  } else if (indexUp && middleUp && ringUp && pinkyUp) {
    gesture = 'Open Palm'
  } else if (indexUp && !middleUp && !ringUp && !pinkyUp) {
    gesture = 'Pointing'
  } else if (indexUp && middleUp && !ringUp && !pinkyUp) {
    gesture = 'Peace'
  } else {
    // Pinch: thumb tip close to index tip
    const dx = lm[4].x - lm[8].x
    const dy = lm[4].y - lm[8].y
    const dist = Math.sqrt(dx*dx + dy*dy)
    if (dist < 0.06) gesture = 'Pinch'
  }
  
  if (gesture) {
    lastGestureTime = now
    onInteraction(gesture, 'hand')
  }
})

// Step 6 — Face expression detection:
const faceMesh = new FaceMesh({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
})
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
})

let lastFaceEventTime = 0
const FACE_COOLDOWN = 600

faceMesh.onResults((results) => {
  if (!results.multiFaceLandmarks || 
      results.multiFaceLandmarks.length === 0) {
    pillDot.style.background = 'rgba(255,255,255,0.2)'
    pillDot.style.boxShadow = 'none'
    updatePill('Ready', 'searching...')
    return
  }
  
  pillDot.style.background = '#78ffa0'
  pillDot.style.boxShadow = '0 0 8px rgba(120,255,160,0.8)'
  
  const lm = results.multiFaceLandmarks[0]
  const now = Date.now()
  if (now - lastFaceEventTime < FACE_COOLDOWN) return
  
  // Mouth open: distance between landmark 13 and 14
  const mouthOpen = Math.abs(lm[13].y - lm[14].y) > 0.04
  
  // Smile: horizontal distance between mouth corners 61 and 291
  const mouthWidth = Math.abs(lm[61].x - lm[291].x)
  const smile = mouthWidth > 0.42
  
  // Left brow raise: landmark 70 vs 159
  const leftBrowRaise = (lm[159].y - lm[70].y) > 0.03
  
  // Right brow raise: landmark 300 vs 386
  const rightBrowRaise = (lm[386].y - lm[300].y) > 0.03
  
  // Blink: left eye top 159 to bottom 145
  const leftEyeClosed = Math.abs(lm[159].y - lm[145].y) < 0.01
  
  // Head tilt: nose tip x vs face center
  const noseTipX = lm[1].x
  const faceCenterX = (lm[234].x + lm[454].x) / 2
  const tiltAmount = noseTipX - faceCenterX
  const headTiltLeft = tiltAmount < -0.06
  const headTiltRight = tiltAmount > 0.06
  
  let expression = null
  
  if (mouthOpen) expression = 'Mouth open'
  else if (smile) expression = 'Smiling'
  else if (leftBrowRaise && rightBrowRaise) expression = 'Brows raised'
  else if (leftBrowRaise) expression = 'Left brow raised'
  else if (rightBrowRaise) expression = 'Right brow raised'
  else if (leftEyeClosed) expression = 'Winking'
  else if (headTiltLeft) expression = 'Head tilt left'
  else if (headTiltRight) expression = 'Head tilt right'
  
  if (expression) {
    lastFaceEventTime = now
    onInteraction(expression, 'face')
  } else {
    updatePill('Neutral', 'tracking')
  }
})

// Step 7 — Feed video frames to both models using MediaPipe Camera:
async function startTracking() {
  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video })
      await faceMesh.send({ image: video })
    },
    width: 1280,
    height: 720
  })
  camera.start()
  console.log('Tracking started')
}

// Step 8 — Initialize everything:
startCamera().then(() => {
  startTracking()
})
