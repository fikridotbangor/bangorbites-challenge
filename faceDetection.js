// faceDetection.js - MediaPipe FaceMesh integration for mouth detection

class FaceDetection {
    constructor() {
        this.faceMesh = null;
        this.camera = null;
        this.canvas = null;
        this.ctx = null;
        this.isInitialized = false;
        this.mouthOpen = false;
        this.faceDetected = false; // true while a face is present in frame
        this.mouthPosition = { x: 0, y: 0, radius: 0 };
        // Ratio of vertical lip gap to mouth width above which the mouth counts
        // as "open" (a distance-invariant "mouth aspect ratio"). Replaces the old
        // absolute gap threshold, which made players standing far from the camera
        // (smaller normalized gap) unable to trigger a bite. Tunable — lower is
        // more sensitive; may need a quick on-site calibration per camera/booth.
        this.mouthOpenRatioThreshold = 0.3;
        
        // Mouth landmarks indices (MediaPipe FaceMesh)
        // Key points for mouth detection
        this.MOUTH_TOP = 13;      // Upper lip center
        this.MOUTH_BOTTOM = 14;   // Lower lip center
        this.MOUTH_LEFT = 61;      // Left corner
        this.MOUTH_RIGHT = 291;   // Right corner
    }

    async initialize(videoElement, canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.camera = videoElement;

        // Wait for MediaPipe to be available (with retry)
        let retries = 0;
        while ((typeof FaceMesh === 'undefined' && typeof window.FaceMesh === 'undefined') && retries < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }

        const FaceMeshClass = window.FaceMesh || (typeof FaceMesh !== 'undefined' ? FaceMesh : null);
        
        if (!FaceMeshClass) {
            console.error('MediaPipe FaceMesh not loaded. Please refresh the page.');
            alert('MediaPipe FaceMesh gagal dimuat. Silakan refresh halaman.');
            return;
        }

        // Initialize MediaPipe FaceMesh
        this.faceMesh = new FaceMeshClass({
            // Vendored locally (vendor/mediapipe/face_mesh) for offline booth use.
            // Requires serving over http:// — file:// blocks fetch() of the local
            // .wasm/.data assets, so the game must run behind a local HTTP server.
            locateFile: (file) => {
                return `vendor/mediapipe/face_mesh/${file}`;
            }
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.faceMesh.onResults((results) => this.onResults(results));

        this.isInitialized = true;
    }

    onResults(results) {
        // Clear canvas
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            this.faceDetected = true;
            const landmarks = results.multiFaceLandmarks[0];
            this.detectMouth(landmarks);
            this.drawMouth(this.ctx, landmarks);
        } else {
            this.faceDetected = false;
            this.mouthOpen = false;
            this.mouthPosition = { x: 0, y: 0, radius: 0 };
        }

        this.ctx.restore();
    }

    detectMouth(landmarks) {
        if (!landmarks || landmarks.length < 468) return;

        // Get mouth landmarks
        const mouthTop = landmarks[this.MOUTH_TOP];
        const mouthBottom = landmarks[this.MOUTH_BOTTOM];
        const mouthLeft = landmarks[this.MOUTH_LEFT];
        const mouthRight = landmarks[this.MOUTH_RIGHT];

        // Calculate mouth opening distance (vertical)
        const mouthDistance = Math.abs(mouthTop.y - mouthBottom.y);
        
        // Calculate mouth width (horizontal)
        const mouthWidth = Math.abs(mouthRight.x - mouthLeft.x);
        
        // Calculate mouth center position
        const mouthCenterX = (mouthLeft.x + mouthRight.x) / 2;
        const mouthCenterY = (mouthTop.y + mouthBottom.y) / 2;
        
        // Calculate mouth position on canvas
        const canvasX = mouthCenterX * this.canvas.width;
        const canvasY = mouthCenterY * this.canvas.height;
        
        // Calculate mouth radius (use average of width and height)
        const mouthRadius = Math.max(
            mouthDistance * this.canvas.height,
            mouthWidth * this.canvas.width
        ) * 0.6; // Scale factor for better collision detection

        // Determine if mouth is open using the vertical-gap / width ratio so the
        // result is invariant to how far the player stands from the camera.
        // Guard against a zero/degenerate width (coincident landmarks) → NaN.
        const mouthAspectRatio = mouthWidth > 0.0001 ? (mouthDistance / mouthWidth) : 0;
        this.mouthOpen = mouthAspectRatio > this.mouthOpenRatioThreshold;
        
        // Store mouth position (flip X coordinate to match game canvas)
        this.mouthPosition = {
            x: this.canvas.width - canvasX, // Flip X for mirror effect
            y: canvasY,
            radius: Math.max(mouthRadius, 30) // Minimum radius
        };
    }

    drawMouth(ctx, landmarks) {
        if (!this.mouthOpen) return;

        // Draw mouth circle for visual feedback - minimalist style
        ctx.strokeStyle = '#8ec622';
        ctx.fillStyle = 'rgba(142, 198, 34, 0.15)';
        ctx.lineWidth = 2;
        
        const x = this.canvas.width - this.mouthPosition.x;
        const y = this.mouthPosition.y;
        const radius = this.mouthPosition.radius;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }

    async processFrame() {
        if (!this.isInitialized || !this.camera) return;

        await this.faceMesh.send({ image: this.camera });
    }

    isMouthOpen() {
        return this.mouthOpen;
    }

    isFaceDetected() {
        return this.faceDetected;
    }

    getMouthPosition() {
        return this.mouthPosition;
    }

    setCanvasSize(width, height) {
        if (this.canvas) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
    }
}

// Node-only export for unit tests. No-op in browsers (no `module`), where
// FaceDetection stays a global from the <script> tag.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FaceDetection };
}

