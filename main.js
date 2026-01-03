// main.js - Main game orchestration and state management

class Game {
    constructor() {
        this.cameraManager = new CameraManager();
        this.faceDetection = new FaceDetection();
        this.gameLogic = null;
        
        this.currentScreen = 'start';
        this.previousScreen = 'start';
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
        
        // Audio
        this.bgMusic = document.getElementById('bg-music');
        this.gameCompletedSound = document.getElementById('game-completed-sound');
        this.eatingSound = document.getElementById('eating-sound');
        
        // Settings Screen Elements
        this.settingsScreen = document.getElementById('settings-screen');
        this.tutorialScreen = document.getElementById('tutorial-screen');
        this.settingsBtn = document.getElementById('settings-btn');
        this.gameSettingsBtn = document.getElementById('game-settings-btn');
        this.tutorialBtn = document.getElementById('tutorial-btn');
        this.settingsCloseBtn = document.getElementById('settings-close-btn');
        this.tutorialCloseBtn = document.getElementById('tutorial-close-btn');
        
        // Photo Screen Elements
        this.photoScreen = document.getElementById('photo-screen');
        this.photoCanvas = document.getElementById('photo-canvas');
        this.photoBtn = document.getElementById('photo-btn');
        this.downloadPhotoBtn = document.getElementById('download-photo-btn');
        this.sharePhotoBtn = document.getElementById('share-photo-btn');
        this.photoCloseBtn = document.getElementById('photo-close-btn');
        
        // Settings Controls
        this.audioToggle = document.getElementById('audio-toggle');
        this.volumeSlider = document.getElementById('volume-slider');
        this.volumeValue = document.getElementById('volume-value');
        this.difficultySelect = document.getElementById('difficulty-select');
        this.timerSlider = document.getElementById('timer-slider');
        this.timerValue = document.getElementById('timer-value');
        
        // Initialize settings
        this.loadSettings();
        this.applySettings();
        
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
        // Video should be visible behind game canvas
        this.video.style.width = maxWidth + 'px';
        this.video.style.height = maxHeight + 'px';
        this.video.style.opacity = '1';
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
        
        // Settings and Tutorial buttons
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => this.showSettings());
        }
        if (this.gameSettingsBtn) {
            this.gameSettingsBtn.addEventListener('click', () => this.showSettings());
        }
        if (this.tutorialBtn) {
            this.tutorialBtn.addEventListener('click', () => this.showTutorial());
        }
        if (this.settingsCloseBtn) {
            this.settingsCloseBtn.addEventListener('click', () => this.closeSettings());
        }
        if (this.tutorialCloseBtn) {
            this.tutorialCloseBtn.addEventListener('click', () => this.closeTutorial());
        }
        
        // Photo screen buttons
        if (this.photoBtn) {
            this.photoBtn.addEventListener('click', () => this.showPhotoScreen());
        }
        if (this.downloadPhotoBtn) {
            this.downloadPhotoBtn.addEventListener('click', () => this.downloadPhoto());
        }
        if (this.sharePhotoBtn) {
            this.sharePhotoBtn.addEventListener('click', () => this.sharePhoto());
        }
        if (this.photoCloseBtn) {
            this.photoCloseBtn.addEventListener('click', () => this.closePhotoScreen());
        }
        
        // Settings controls
        if (this.audioToggle) {
            this.audioToggle.addEventListener('change', (e) => this.updateAudioEnabled(e.target.checked));
        }
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => this.updateVolume(e.target.value));
        }
        if (this.difficultySelect) {
            this.difficultySelect.addEventListener('change', (e) => this.updateDifficulty(e.target.value));
        }
        if (this.timerSlider) {
            this.timerSlider.addEventListener('input', (e) => this.updateTimer(e.target.value));
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === ' ') {
                if (this.currentScreen === 'game' && !this.gameLogic?.isPaused) {
                    this.pauseGame();
                } else if (this.currentScreen === 'pause') {
                    this.resumeGame();
                }
            }
        });
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

    loadSettings() {
        const settings = {
            audioEnabled: localStorage.getItem('bangorBitesAudioEnabled') !== 'false',
            volume: parseInt(localStorage.getItem('bangorBitesVolume') || '50', 10),
            difficulty: localStorage.getItem('bangorBitesDifficulty') || 'medium',
            timerDuration: parseInt(localStorage.getItem('bangorBitesTimerDuration') || '60', 10)
        };
        
        this.settings = settings;
        
        // Update UI elements
        if (this.audioToggle) this.audioToggle.checked = settings.audioEnabled;
        if (this.volumeSlider) this.volumeSlider.value = settings.volume;
        if (this.volumeValue) this.volumeValue.textContent = settings.volume;
        if (this.difficultySelect) this.difficultySelect.value = settings.difficulty;
        if (this.timerSlider) this.timerSlider.value = settings.timerDuration;
        if (this.timerValue) this.timerValue.textContent = settings.timerDuration;
    }

    saveSettings() {
        if (this.settings) {
            localStorage.setItem('bangorBitesAudioEnabled', this.settings.audioEnabled.toString());
            localStorage.setItem('bangorBitesVolume', this.settings.volume.toString());
            localStorage.setItem('bangorBitesDifficulty', this.settings.difficulty);
            localStorage.setItem('bangorBitesTimerDuration', this.settings.timerDuration.toString());
        }
    }

    applySettings() {
        if (!this.settings) return;
        
        const volume = this.settings.audioEnabled ? this.settings.volume / 100 : 0;
        
        if (this.bgMusic) {
            this.bgMusic.volume = volume * 0.5; // Background music at 50% of volume setting
            this.bgMusic.muted = !this.settings.audioEnabled;
        }
        if (this.gameCompletedSound) {
            this.gameCompletedSound.volume = volume * 0.7; // Game completed sound at 70% of volume setting
            this.gameCompletedSound.muted = !this.settings.audioEnabled;
        }
        if (this.eatingSound) {
            this.eatingSound.volume = volume * 0.6; // Eating sound at 60% of volume setting
            this.eatingSound.muted = !this.settings.audioEnabled;
        }
    }

    updateAudioEnabled(enabled) {
        this.settings.audioEnabled = enabled;
        this.applySettings();
        this.saveSettings();
    }

    updateVolume(volume) {
        this.settings.volume = parseInt(volume, 10);
        if (this.volumeValue) {
            this.volumeValue.textContent = this.settings.volume;
        }
        this.applySettings();
        this.saveSettings();
    }

    updateDifficulty(difficulty) {
        this.settings.difficulty = difficulty;
        this.saveSettings();
    }

    updateTimer(duration) {
        this.settings.timerDuration = parseInt(duration, 10);
        if (this.timerValue) {
            this.timerValue.textContent = this.settings.timerDuration;
        }
        this.saveSettings();
    }

    showSettings() {
        // Store previous screen
        this.previousScreen = this.currentScreen;
        // Load current settings to UI
        this.loadSettings();
        this.showScreen('settings');
    }

    closeSettings() {
        // Save settings
        this.saveSettings();
        this.applySettings();
        
        // Return to previous screen
        this.showScreen(this.previousScreen);
    }

    showTutorial() {
        // Store previous screen
        this.previousScreen = this.currentScreen;
        this.showScreen('tutorial');
    }

    closeTutorial() {
        // Return to previous screen
        this.showScreen(this.previousScreen);
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

        // Get settings
        const difficulty = this.settings?.difficulty || 'medium';
        const timerDuration = this.settings?.timerDuration || 60;

        // Initialize game logic with settings
        this.gameLogic = new GameLogic(this.gameCanvas, this.faceDetection, this.eatingSound, difficulty, timerDuration);
        this.gameLogic.reset();
        
        // Play background music if enabled
        if (this.bgMusic && this.settings?.audioEnabled) {
            this.bgMusic.play().catch(error => {
                console.log('Audio play failed:', error);
                // Some browsers require user interaction before playing audio
            });
        }
        
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
        // Pause background music
        if (this.bgMusic && !this.bgMusic.paused) {
            this.bgMusic.pause();
        }
        this.previousScreen = 'game';
        this.showScreen('pause');
    }

    resumeGame() {
        if (this.gameLogic) {
            this.gameLogic.resume();
        }
        // Resume background music
        if (this.bgMusic && this.bgMusic.paused) {
            this.bgMusic.play().catch(error => {
                console.log('Audio play failed:', error);
            });
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

        // Stop background music
        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0; // Reset to beginning
        }

        // Play game completed sound effect
        if (this.gameCompletedSound) {
            this.gameCompletedSound.currentTime = 0; // Reset to beginning
            this.gameCompletedSound.play().catch(error => {
                console.log('Game completed sound play failed:', error);
            });
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
        // Stop background music when returning to start screen
        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0;
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
                if (this.startScreen) this.startScreen.classList.add('active');
                break;
            case 'game':
                if (this.gameScreen) this.gameScreen.classList.add('active');
                break;
            case 'end':
                if (this.endScreen) this.endScreen.classList.add('active');
                break;
            case 'pause':
                if (this.pauseScreen) this.pauseScreen.classList.add('active');
                break;
            case 'settings':
                if (this.settingsScreen) this.settingsScreen.classList.add('active');
                break;
            case 'tutorial':
                if (this.tutorialScreen) this.tutorialScreen.classList.add('active');
                break;
            case 'photo':
                if (this.photoScreen) this.photoScreen.classList.add('active');
                break;
        }

        this.currentScreen = screenName;
    }

    async showPhotoScreen() {
        // Capture photo
        await this.capturePhoto();
        
        // Show photo screen
        this.previousScreen = this.currentScreen;
        this.showScreen('photo');
    }

    async capturePhoto() {
        if (!this.video || !this.photoCanvas) return null;
        
        const ctx = this.photoCanvas.getContext('2d');
        
        // Set canvas size (mirror video untuk foto)
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;
        
        if (videoWidth === 0 || videoHeight === 0) {
            console.warn('Video not ready for capture');
            return null;
        }
        
        // Set canvas size (bisa diatur sesuai kebutuhan)
        const maxWidth = 800;
        const maxHeight = 600;
        const aspectRatio = videoWidth / videoHeight;
        
        let canvasWidth = maxWidth;
        let canvasHeight = maxWidth / aspectRatio;
        
        if (canvasHeight > maxHeight) {
            canvasHeight = maxHeight;
            canvasWidth = maxHeight * aspectRatio;
        }
        
        this.photoCanvas.width = canvasWidth;
        this.photoCanvas.height = canvasHeight;
        
        // Draw video frame (flip untuk mirror effect)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(this.video, -canvasWidth, 0, canvasWidth, canvasHeight);
        ctx.restore();
        
        // Draw overlay dengan score
        this.drawPhotoOverlay(ctx, canvasWidth, canvasHeight);
        
        return this.photoCanvas.toDataURL('image/png');
    }

    drawPhotoOverlay(ctx, width, height) {
        // Gradient background untuk overlay
        const gradient = ctx.createLinearGradient(0, height - 200, 0, height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height - 200, width, 200);
        
        // Draw score information
        const score = this.gameLogic ? this.gameLogic.getScore() : 0;
        const highScore = this.gameLogic ? this.gameLogic.getHighScore() : 0;
        
        // Logo/Brand
        ctx.fillStyle = '#8ec622';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🍔 Bangor Bites', width / 2, height - 150);
        
        // Score
        ctx.fillStyle = '#fffee6';
        ctx.font = 'bold 48px Arial';
        ctx.fillText(`Skor: ${score}`, width / 2, height - 100);
        
        // High Score
        ctx.fillStyle = '#ff8222';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(`High Score: ${highScore}`, width / 2, height - 60);
        
        // Hashtag
        ctx.fillStyle = '#4daadd';
        ctx.font = '20px Arial';
        ctx.fillText('#BangorBitesChallenge', width / 2, height - 25);
        
        // Optional: Draw border
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, width, height);
    }

    closePhotoScreen() {
        this.showScreen(this.previousScreen);
    }

    downloadPhoto() {
        if (!this.photoCanvas) return;
        
        // Convert canvas to blob
        this.photoCanvas.toBlob((blob) => {
            if (!blob) {
                console.error('Failed to create blob');
                return;
            }
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bangor-bites-score-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    async sharePhoto() {
        if (!this.photoCanvas) return;
        
        try {
            // Convert canvas to blob
            const blob = await new Promise((resolve, reject) => {
                this.photoCanvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                }, 'image/png');
            });
            
            const score = this.gameLogic ? this.gameLogic.getScore() : 0;
            
            // Check if Web Share API is available
            if (navigator.share && navigator.canShare) {
                const file = new File([blob], `bangor-bites-score-${Date.now()}.png`, {
                    type: 'image/png'
                });
                
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'Bangor Bites Challenge - Skor Saya!',
                        text: `Saya dapat skor ${score} di Bangor Bites Challenge! Coba kalahkan skorku! #BangorBitesChallenge`,
                        files: [file]
                    });
                    return;
                }
            }
            
            // Fallback: copy to clipboard or download
            if (navigator.clipboard && navigator.clipboard.write) {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    alert('Foto berhasil disalin ke clipboard! Paste di aplikasi yang kamu inginkan.');
                } catch (clipboardError) {
                    console.log('Clipboard error:', clipboardError);
                    // Fallback to download
                    this.downloadPhoto();
                    alert('Foto berhasil diunduh! Kamu bisa share dari galeri.');
                }
            } else {
                // Final fallback: download
                this.downloadPhoto();
                alert('Foto berhasil diunduh! Kamu bisa share dari galeri.');
            }
        } catch (error) {
            console.error('Share error:', error);
            // Fallback to download
            this.downloadPhoto();
            alert('Foto berhasil diunduh! Kamu bisa share dari galeri.');
        }
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});

