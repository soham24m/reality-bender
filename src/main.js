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
window.addEventListener('resize', resizeCanvas)

// Step 3 — Update pill function:
function updatePill(action, status) {
  pillAction.textContent = action
  pillStatus.textContent = status
}

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
    updatePill(gesture, 'hand detected')
    console.log('HAND:', gesture)
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
    updatePill(expression, 'tracking')
    console.log('FACE:', expression)
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
