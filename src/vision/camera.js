/**
 * camera.js — Webcam initialization module
 * 
 * Requests access to the user's webcam and pipes the stream
 * into a hidden <video> element for MediaPipe to consume.
 */

/**
 * Initializes the webcam and attaches the stream to the given video element.
 * @param {HTMLVideoElement} videoElement — the video element to feed
 * @returns {Promise<HTMLVideoElement>} — resolves once the stream is live
 */
export async function startCamera(videoElement) {
    try {
        // Autoplay, playsinline, and muted attributes are required for iOS Safari and mobile browsers
        videoElement.setAttribute('autoplay', 'true');
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('muted', 'true');
        videoElement.muted = true; // double check it is programmatically muted

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

        // Explicitly call play
        try {
            await videoElement.play();
        } catch (playError) {
            console.warn('[camera] videoElement.play() failed or was interrupted, waiting for user gesture', playError);
        }

        // Wait for the video to actually start playing before resolving
        return new Promise((resolve) => {
            if (videoElement.readyState >= 3) { // HAVE_FUTURE_DATA
                resolve(videoElement);
            } else {
                videoElement.onloadedmetadata = () => {
                    videoElement.play().catch(() => {});
                    console.log(
                        `[camera] Webcam live — ${videoElement.videoWidth}×${videoElement.videoHeight}`
                    );
                    resolve(videoElement);
                };
            }
        });
    } catch (err) {
        console.error('[camera] Failed to access webcam:', err.message);
        throw new Error(
            'Webcam access denied or unavailable. Check browser permissions.'
        );
    }
}
