export const visionState = {
  hands: null,
  faceMesh: null,
  camera: null,
  currentGesture: null,
  gestureStartTime: 0,
  onGestureConfirmed: null,
  isCameraActive: false,
  lastFaceResults: null,
  lastHandResults: null
};

export async function initVision(videoElement, gestureCallback) {
  visionState.onGestureConfirmed = gestureCallback;

  try {
    if (typeof Hands === 'undefined' || typeof FaceMesh === 'undefined') {
      throw new Error("MediaPipe not loaded");
    }

    visionState.hands = new Hands({locateFile: (file) => {
      return 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/' + file;
    }});
    visionState.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    visionState.hands.onResults(onHandsResults);

    visionState.faceMesh = new FaceMesh({locateFile: (file) => {
      return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/' + file;
    }});
    visionState.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    visionState.faceMesh.onResults(onFaceResults);

    visionState.camera = new Camera(videoElement, {
      onFrame: async () => {
        visionState.isCameraActive = true;
        await visionState.hands.send({image: videoElement});
        await visionState.faceMesh.send({image: videoElement});
        checkGestures();
      },
      width: 640,
      height: 480
    });

    await visionState.camera.start();
  } catch (err) {
    console.warn("Vision init failed, falling back to keyboard.", err);
    visionState.isCameraActive = false;
    const { updatePill } = await import('./ui.js');
    updatePill('Ready', 'Camera unavailable — using keyboard controls', false);
  }
}

export function onHandsResults(results) {
  visionState.lastHandResults = results;
}

export function onFaceResults(results) {
  visionState.lastFaceResults = results;
}

export function checkGestures() {
  let detectedGesture = null;

  // Check Hands First
  if (visionState.lastHandResults && visionState.lastHandResults.multiHandLandmarks && visionState.lastHandResults.multiHandLandmarks.length > 0) {
    const landmarks = visionState.lastHandResults.multiHandLandmarks[0];
    
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    const isIndexUp = indexTip.y < indexPip.y;
    const isMiddleUp = middleTip.y < middlePip.y;
    const isRingUp = ringTip.y < ringPip.y;
    const isPinkyUp = pinkyTip.y < pinkyPip.y;

    if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
      detectedGesture = 'OPEN_PALM';
    } else if (!isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
      detectedGesture = 'FIST';
    } else if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
      detectedGesture = 'POINT';
    }
  }

  // Check Face if no hand gesture
  if (!detectedGesture && visionState.lastFaceResults && visionState.lastFaceResults.multiFaceLandmarks && visionState.lastFaceResults.multiFaceLandmarks.length > 0) {
    const face = visionState.lastFaceResults.multiFaceLandmarks[0];
    const upperLip = face[13];
    const lowerLip = face[14];
    const mouthDist = lowerLip.y - upperLip.y;

    if (mouthDist > 0.05) {
      detectedGesture = 'MOUTH_OPEN';
    } else {
      const leftCorner = face[61];
      const rightCorner = face[291];
      const chin = face[152];
      
      const leftSmileDist = chin.y - leftCorner.y;
      const rightSmileDist = chin.y - rightCorner.y;
      // Normal neutral distance chin to corner is around 0.1, when smiling corners go up so distance increases
      if (leftSmileDist > 0.12 && rightSmileDist > 0.12) {
        detectedGesture = 'SMILE';
      }
    }
  }

  processGesture(detectedGesture);
}

export function processGesture(gesture) {
  const now = performance.now();

  if (gesture !== visionState.currentGesture) {
    visionState.currentGesture = gesture;
    visionState.gestureStartTime = now;
  } else if (gesture !== null) {
    const elapsed = now - visionState.gestureStartTime;
    if (elapsed >= 300) {
      if (visionState.onGestureConfirmed) {
        visionState.onGestureConfirmed(gesture);
      }
      visionState.gestureStartTime = now; // reset to avoid rapid firing, combat.js handles actual cooldown
    }
  }
}
