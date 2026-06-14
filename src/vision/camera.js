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
        videoElement.setAttribute('autoplay', 'true');
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('muted', 'true');
        videoElement.muted = true;

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width:  { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
                frameRate: { ideal: 30 }
            },
            audio: false
        });

        videoElement.srcObject = stream;

        // Always wait for the video to actually have data
        return new Promise((resolve) => {
            const onReady = () => {
                videoElement.play()
                    .then(() => {
                        console.log(`[camera] camera playing — ${videoElement.videoWidth}×${videoElement.videoHeight}`);
                        resolve(videoElement);
                    })
                    .catch((err) => {
                        console.warn('[camera] play() rejected:', err);
                        resolve(videoElement); // still resolve so app continues
                    });
            };

            if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or better
                onReady();
            } else {
                videoElement.addEventListener('loadeddata', onReady, { once: true });
            }
        });
    } catch (err) {
        console.error('[camera] Failed to access webcam:', err.message);
        throw new Error('Webcam access denied or unavailable. Check browser permissions.');
    }
}
