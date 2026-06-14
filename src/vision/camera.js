/**
 * camera.js — Webcam initialization module
 * 
 * Requests access to the user's webcam and pipes the stream
 * into a hidden <video> element for MediaPipe to consume.
 */

/**
 * Initializes the webcam and attaches the stream to the given video element.
 * @param {HTMLVideoElement} videoElement — the hidden <video> to feed
 * @returns {Promise<HTMLVideoElement>} — resolves once the stream is live
 */
export async function startCamera(videoElement) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',      // front camera on mobile
                frameRate: { ideal: 30 }
            },
            audio: false
        });

        videoElement.srcObject = stream;

        // Wait for the video to actually start playing before resolving
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                console.log(
                    `[camera] Webcam live — ${videoElement.videoWidth}×${videoElement.videoHeight}`
                );
                resolve(videoElement);
            };
        });
    } catch (err) {
        console.error('[camera] Failed to access webcam:', err.message);
        throw new Error(
            'Webcam access denied or unavailable. Check browser permissions.'
        );
    }
}
