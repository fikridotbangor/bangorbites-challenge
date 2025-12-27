// camera.js - Handle webcam access and video stream

class CameraManager {
    constructor() {
        this.video = null;
        this.stream = null;
        this.isActive = false;
    }

    async initialize(videoElement) {
        this.video = videoElement;
        
        try {
            const constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            this.isActive = true;

            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve(true);
                };
            });
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.isActive = false;
            throw error;
        }
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
        this.isActive = false;
    }

    getVideoElement() {
        return this.video;
    }

    getVideoDimensions() {
        if (!this.video) return { width: 0, height: 0 };
        return {
            width: this.video.videoWidth,
            height: this.video.videoHeight
        };
    }
}

