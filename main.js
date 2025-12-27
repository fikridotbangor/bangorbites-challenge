// main.js - Main game orchestration and state management

class Game {
    constructor() {
        this.cameraManager = new CameraManager();
        this.faceDetection = new FaceDetection();
        this.gameLogic = null;
        
        this.currentScreen = 'start';
        this.gameLoopId = null;
        this.lastFrameTime = Date.now();
        
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        // Screens
        this.startScreen = document.getElementById('start-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.endScreen = document.getElementById('end-screen');
        this.pauseScreen = document.getElementById('pause-screen');
        
        // Buttons
        this.startBtn = document.getElementById('start-btn');
        this.allowCameraBtn = document.getElementById('allow-camera-btn');
        this.replayBtn = document.getElementById('replay-btn');
        this.homeBtn = document.getElementById('home-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.resumeBtn = document.getElementById('resume-btn');
        this.quitBtn = document.getElementById('quit-btn');
        
        // Video and Canvas
        this.video = document.getElementById('video');
        this.gameCanvas = document.getElementById('game-canvas');
        this.faceCanvas = document.getElementById('face-canvas');
        
        // Status and Score displays
        this.cameraStatus = document.getElementById('camera-status');
        this.currentScoreDisplay = document.getElementById('current-score');
        this.highScoreDisplay = document.getElementById('high-score');
        this.timerDisplay = document.getElementById('timer');
        this.finalScoreDisplay = document.getElementById('final-score');
        this.endHighScoreDisplay = document.getElementById('end-high-score');
        
        // Set initial canvas size
        this.resizeCanvases();
        window.addEventListener('resize', () => this.resizeCanvases());
    }

    resizeCanvases() {
        const maxWidth = Math.min(800, window.innerWidth - 40);
        const maxHeight = Math.min(600, window.innerHeight - 100);
        
        // Set game canvas size
        this.gameCanvas.width = maxWidth;
        this.gameCanvas.height = maxHeight;
        
        // Set face canvas to match game canvas size for alignment
        this.faceCanvas.width = maxWidth;
        this.faceCanvas.height = maxHeight;
        this.faceDetection.setCanvasSize(maxWidth, maxHeight);
        
        // Update video and face canvas styling to match
        this.video.style.width = maxWidth + 'px';
        this.video.style.height = maxHeight + 'px';
        this.faceCanvas.style.width = maxWidth + 'px';
        this.faceCanvas.style.height = maxHeight + 'px';
        this.gameCanvas.style.width = maxWidth + 'px';
        this.gameCanvas.style.height = maxHeight + 'px';
        
        if (this.gameLogic) {
            this.gameLogic.setCanvasSize(maxWidth, maxHeight);
        }
    }

    attachEventListeners() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.allowCameraBtn.addEventListener('click', () => this.requestCamera());
        this.replayBtn.addEventListener('click', () => this.startGame());
        this.homeBtn.addEventListener('click', () => this.showStartScreen());
        this.pauseBtn.addEventListener('click', () => this.pauseGame());
        this.resumeBtn.addEventListener('click', () => this.resumeGame());
        this.quitBtn.addEventListener('click', () => this.quitGame());
    }

    async requestCamera() {
        try {
            this.cameraStatus.textContent = 'Meminta akses kamera...';
            this.cameraStatus.className = 'status-message';
            
            await this.cameraManager.initialize(this.video);
            
            // Initialize face detection
            await this.faceDetection.initialize(this.video, this.faceCanvas);
            
            this.cameraStatus.textContent = '✓ Kamera berhasil diaktifkan!';
            this.cameraStatus.className = 'status-message success';
            
            // Start processing face detection
            this.processFaceDetection();
        } catch (error) {
            this.cameraStatus.textContent = '✗ Gagal mengakses kamera. Pastikan izin kamera diberikan.';
            this.cameraStatus.className = 'status-message error';
            console.error('Camera error:', error);
        }
    }

    async processFaceDetection() {
        if (!this.cameraManager.isActive || !this.faceDetection.isInitialized) {
            if (this.cameraManager.isActive) {
                requestAnimationFrame(() => this.processFaceDetection());
            }
            return;
        }
        
        try {
            await this.faceDetection.processFrame();
        } catch (error) {
            console.error('Face detection error:', error);
        }
        
        requestAnimationFrame(() => this.processFaceDetection());
    }

    async startGame() {
        // Check if camera is active
        if (!this.cameraManager.isActive) {
            await this.requestCamera();
            if (!this.cameraManager.isActive) {
                alert('Mohon aktifkan kamera terlebih dahulu!');
                return;
            }
        }

        // Initialize game logic
        this.gameLogic = new GameLogic(this.gameCanvas, this.faceDetection);
        this.gameLogic.reset();
        
        // Show game screen
        this.showScreen('game');
        
        // Start game loop
        this.startGameLoop();
    }

    startGameLoop() {
        this.lastFrameTime = Date.now();
        this.gameLoop();
    }

    gameLoop() {
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        if (this.gameLogic && !this.gameLogic.isPaused) {
            // Update game
            this.gameLogic.update(deltaTime);
            this.gameLogic.render();
            
            // Update UI
            this.updateGameUI();
            
            // Check if game is over
            if (this.gameLogic.isGameOver) {
                this.endGame();
                return;
            }
        }

        // Continue loop
        this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
    }

    updateGameUI() {
        if (!this.gameLogic) return;
        
        this.currentScoreDisplay.textContent = this.gameLogic.getScore();
        this.highScoreDisplay.textContent = this.gameLogic.getHighScore();
        this.timerDisplay.textContent = this.gameLogic.getTimeRemaining();
    }

    pauseGame() {
        if (this.gameLogic) {
            this.gameLogic.pause();
        }
        this.showScreen('pause');
    }

    resumeGame() {
        if (this.gameLogic) {
            this.gameLogic.resume();
        }
        this.showScreen('game');
    }

    quitGame() {
        this.endGame();
        this.showStartScreen();
    }

    endGame() {
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
        }

        if (this.gameLogic) {
            this.finalScoreDisplay.textContent = this.gameLogic.getScore();
            this.endHighScoreDisplay.textContent = this.gameLogic.getHighScore();
        }

        this.showScreen('end');
    }

    showStartScreen() {
        this.showScreen('start');
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
        }
    }

    showScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        switch (screenName) {
            case 'start':
                this.startScreen.classList.add('active');
                break;
            case 'game':
                this.gameScreen.classList.add('active');
                break;
            case 'end':
                this.endScreen.classList.add('active');
                break;
            case 'pause':
                this.pauseScreen.classList.add('active');
                break;
        }

        this.currentScreen = screenName;
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});

