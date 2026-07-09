// main.js - Main game orchestration and state management

// How long to hold on the frozen, exploding board before switching to the end
// screen when the player runs out of lives (ate the final Willgozz) — lets the
// blast play out. Timeout game-overs skip this and transition immediately.
const GAME_OVER_EXPLOSION_HOLD_MS = 1200;

class Game {
    constructor() {
        this.cameraManager = new CameraManager();
        this.faceDetection = new FaceDetection();
        this.gameLogic = null;
        
        this.currentScreen = 'start';
        this.previousScreen = 'start';
        this.gameLoopId = null;
        this.lastFrameTime = Date.now();

        // Face-detection loop throttling. FaceMesh.send is the expensive call;
        // running it every rAF (~60fps) overheats booth phones/tablets over long
        // sessions, so cap it to ~30fps. Loop only runs on the game screen.
        this.faceDetectionLoopId = null;
        this.lastFaceProcessTime = 0;
        this.faceProcessInterval = 1000 / 30; // ~33ms

        // 3-2-1 countdown state (guards pause/settings while it's running)
        this.countdownTimerId = null;
        this.isCountingDown = false;
        
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

        // Explosion FX (chroma-keyed green-screen clip drawn on obstacle hit)
        this.explosionCanvas = document.getElementById('explosion-canvas');
        this.explosionCtx = this.explosionCanvas ? this.explosionCanvas.getContext('2d') : null;
        this.explosionVideo = document.getElementById('explosion-video');
        this._explosion = null;      // { x, y, box } current burst, or null
        this._explosionRAF = null;   // rAF id for the FX draw loop
        
        // Status and Score displays
        this.cameraStatus = document.getElementById('camera-status');
        this.currentScoreDisplay = document.getElementById('current-score');
        this.currentLivesDisplay = document.getElementById('current-lives');
        this.livesStat = document.querySelector('.hud-lives');
        this.highScoreDisplay = document.getElementById('high-score');
        this.timerDisplay = document.getElementById('timer');
        this.finalScoreDisplay = document.getElementById('final-score');
        this.endHighScoreDisplay = document.getElementById('end-high-score');
        this.endTitle = document.getElementById('end-title');
        this.endSubtitle = document.getElementById('end-subtitle');
        this.countdownDisplay = document.getElementById('countdown-overlay');
        this.faceWarning = document.getElementById('face-warning');
        
        // Audio
        this.bgMusic = document.getElementById('bg-music');
        this.gameCompletedSound = document.getElementById('game-completed-sound');
        this.eatingSound = document.getElementById('eating-sound');
        this.boomSound = document.getElementById('boom-sound'); // Willgozz-hit explosion SFX

        // The play area — shaken on obstacle hit (see triggerShake). The HUD is a
        // sibling, so it stays put; only the canvases/video shake.
        this.gameArea = document.querySelector('.game-area');
        
        // Settings Screen Elements
        this.settingsScreen = document.getElementById('settings-screen');
        this.tutorialScreen = document.getElementById('tutorial-screen');
        this.settingsBtn = document.getElementById('settings-btn');
        this.gameSettingsBtn = document.getElementById('game-settings-btn');
        this.tutorialBtn = document.getElementById('tutorial-btn');
        this.settingsCloseBtn = document.getElementById('settings-close-btn');
        this.tutorialCloseBtn = document.getElementById('tutorial-close-btn');
        this.tutorialStartBtn = document.getElementById('tutorial-start-btn');

        // History Screen Elements (foundation — recent games from localStorage)
        this.historyScreen = document.getElementById('history-screen');
        this.historyBtn = document.getElementById('history-btn');
        this.historyCloseBtn = document.getElementById('history-close-btn');
        this.historyClearBtn = document.getElementById('history-clear-btn');
        
        // Photo Screen Elements
        this.photoScreen = document.getElementById('photo-screen');
        this.photoCanvas = document.getElementById('photo-canvas');
        this.photoBtn = document.getElementById('photo-btn');
        this.downloadPhotoBtn = document.getElementById('download-photo-btn');
        this.sharePhotoBtn = document.getElementById('share-photo-btn');
        this.photoCloseBtn = document.getElementById('photo-close-btn');
        
        // Settings controls are now data-attribute driven ([data-setting] /
        // [data-display] / [data-dropdown]) so the Pause and Settings panels can
        // share one control block and stay in sync. See bindSettingControls().

        // Initialize settings
        this.loadSettings();
        this.applySettings();
        
        // Set initial canvas size
        this.resizeCanvases();
        window.addEventListener('resize', () => this.resizeCanvases());
        // Re-fit once the webcam reports its real dimensions so the box matches the
        // stream's aspect ratio (fixes video-vs-collision drift on non-4:3 cameras).
        if (this.video) {
            this.video.addEventListener('loadedmetadata', () => this.resizeCanvases());
        }
        
        // Load mascot images for photo screen
        this.mascotImages = [];
        this.loadMascotImages();
        
        // Load logo for photo screen
        this.logoImage = null;
        this.loadLogoImage();
    }

    resizeCanvases() {
        // Decouple the logical canvas BUFFER (pixel resolution) from the on-screen
        // DISPLAY size: the buffer is capped (perf + stable game balance) while the
        // element is CSS-scaled to fill the available area, so the play field fills
        // a big display (e.g. a 42" TV) without shrinking the food or blowing up the
        // per-pixel work. The box ratio follows the webcam so the mirrored video and
        // the face-landmark -> canvas mapping stay aligned (no collision drift).
        // See layout.js / computeCanvasBox.
        const aspect = this.getCameraAspect();
        const availW = Math.max(320, window.innerWidth - 40);
        const availH = Math.max(240, window.innerHeight - 100);
        const box = (typeof computeCanvasBox === 'function')
            ? computeCanvasBox(aspect, availW, availH)
            : { dispW: Math.min(800, availW), dispH: Math.min(600, availH),
                bufW: Math.min(800, availW), bufH: Math.min(600, availH) };

        // Logical buffer — the drawing + collision coordinate space. Face + explosion
        // canvases share it 1:1 so hit coords line up.
        this.gameCanvas.width = box.bufW;
        this.gameCanvas.height = box.bufH;
        this.faceCanvas.width = box.bufW;
        this.faceCanvas.height = box.bufH;
        this.faceDetection.setCanvasSize(box.bufW, box.bufH);
        if (this.explosionCanvas) {
            this.explosionCanvas.width = box.bufW;
            this.explosionCanvas.height = box.bufH;
        }

        // Display size (CSS) — all layers share the exact same box so they overlay.
        const px = (el) => {
            if (!el) return;
            el.style.width = box.dispW + 'px';
            el.style.height = box.dispH + 'px';
        };
        px(this.video);
        this.video.style.opacity = '1';
        px(this.faceCanvas);
        px(this.gameCanvas);
        px(this.explosionCanvas);

        if (this.gameLogic) {
            this.gameLogic.setCanvasSize(box.bufW, box.bufH);
        }
    }

    // Webcam aspect (width/height) once the stream reports it; 16:9 default until
    // then. resizeCanvases() is re-run on the video's 'loadedmetadata' so the box
    // switches to the real ratio as soon as the camera is up.
    getCameraAspect() {
        const w = this.video && this.video.videoWidth;
        const h = this.video && this.video.videoHeight;
        return (w && h) ? (w / h) : (16 / 9);
    }

    attachEventListeners() {
        this.startBtn.addEventListener('click', () => this.startGame());
        // Allow-camera button was removed in the home redesign — "Mulai Game"
        // requests the camera on demand via startGame(). Guarded in case it's absent.
        if (this.allowCameraBtn) {
            this.allowCameraBtn.addEventListener('click', () => this.requestCamera());
        }
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
        // "Main sekarang" — start the game straight from the tutorial (Figma 14:166).
        if (this.tutorialStartBtn) {
            this.tutorialStartBtn.addEventListener('click', () => this.startGame());
        }

        // History screen (foundation)
        if (this.historyBtn) {
            this.historyBtn.addEventListener('click', () => this.showHistory());
        }
        if (this.historyCloseBtn) {
            this.historyCloseBtn.addEventListener('click', () => this.closeHistory());
        }
        if (this.historyClearBtn) {
            this.historyClearBtn.addEventListener('click', () => this.clearHistory());
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
        
        // Settings controls (shared by the Settings + Pause panels)
        this.bindSettingControls();

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

            // Re-fit now that the stream is live so the box adopts the real webcam
            // aspect (in case 'loadedmetadata' fired before its listener was attached).
            this.resizeCanvases();

            // Detection loop is NOT started here — it only runs during actual
            // gameplay (see startGame/startFaceDetectionLoop). No point burning
            // CPU on the start screen where there's no camera preview.
        } catch (error) {
            this.cameraStatus.textContent = '✗ Gagal mengakses kamera. Pastikan izin kamera diberikan.';
            this.cameraStatus.className = 'status-message error';
            console.error('Camera error:', error);
        }
    }

    // Idempotent starter — safe to call on every startGame/resumeGame. Bails if
    // the loop is already running so we never spin up two rAF chains.
    startFaceDetectionLoop() {
        if (this.faceDetectionLoopId) return;
        this.lastFaceProcessTime = 0;
        this.processFaceDetection();
    }

    async processFaceDetection() {
        // Only detect while actually playing. currentScreen flips to 'pause'/'end'
        // on pause/quit/game-over, which ends the loop; startFaceDetectionLoop()
        // restarts it on resume/replay. This also gates out the expensive send.
        if (this.currentScreen !== 'game' || !this.cameraManager.isActive || !this.faceDetection.isInitialized) {
            this.faceDetectionLoopId = null;
            this.updateFaceIndicator(true); // hide the warning when we leave the game
            return;
        }

        const now = Date.now();
        if (now - this.lastFaceProcessTime >= this.faceProcessInterval) {
            this.lastFaceProcessTime = now;
            try {
                await this.faceDetection.processFrame();
            } catch (error) {
                console.error('Face detection error:', error);
            }
        }

        this.updateFaceIndicator(this.faceDetection.isFaceDetected());

        this.faceDetectionLoopId = requestAnimationFrame(() => this.processFaceDetection());
    }

    loadSettings() {
        const settings = {
            audioEnabled: localStorage.getItem('bangorBitesAudioEnabled') !== 'false',
            volume: parseInt(localStorage.getItem('bangorBitesVolume') || '50', 10),
            difficulty: localStorage.getItem('bangorBitesDifficulty') || 'medium',
            timerDuration: parseInt(localStorage.getItem('bangorBitesTimerDuration') || '60', 10),
            targetScore: parseInt(localStorage.getItem('bangorBitesTargetScore') || '30', 10),
            lives: parseInt(localStorage.getItem('bangorBitesLives') || '3', 10),
            // Screen shake on obstacle hit — on unless explicitly turned off.
            screenShake: localStorage.getItem('bangorBitesScreenShake') !== 'false'
        };

        this.settings = settings;

        // Push into every [data-setting] control across the Settings + Pause panels.
        this.syncSettingsUI();
    }

    // Wire the shared settings controls. Both the Settings and Pause panels carry a
    // copy of the Audio/Timer/Target/Difficulty block (same data-setting keys), so a
    // change to one panel is mirrored to the other via syncSettingsUI().
    bindSettingControls() {
        document.querySelectorAll('[data-setting]').forEach(el => {
            // Checkboxes fire 'change'; range sliders fire 'input' for live drag.
            const evt = el.type === 'checkbox' ? 'change' : 'input';
            el.addEventListener(evt, () => this.onSettingChange(el));
        });
        document.querySelectorAll('[data-dropdown="difficulty"]').forEach(dd => this.initDifficultyDropdown(dd));
        // Click outside closes any open dropdown.
        document.addEventListener('click', (e) => {
            document.querySelectorAll('.panel-dropdown.open').forEach(dd => {
                if (!dd.contains(e.target)) {
                    dd.classList.remove('open');
                    const t = dd.querySelector('.panel-dropdown-toggle');
                    if (t) t.setAttribute('aria-expanded', 'false');
                }
            });
        });
    }

    onSettingChange(el) {
        const key = el.dataset.setting;
        const value = el.type === 'checkbox' ? el.checked : parseInt(el.value, 10);
        this.settings[key] = value;
        this.syncSettingsUI();
        this.applySettings();
        this.saveSettings();
    }

    // Custom difficulty dropdown (Figma 16:508) — replaces the native <select> so it
    // can be styled to match. Selecting an option updates settings.difficulty.
    initDifficultyDropdown(dd) {
        const toggle = dd.querySelector('.panel-dropdown-toggle');
        if (toggle) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const willOpen = !dd.classList.contains('open');
                document.querySelectorAll('.panel-dropdown.open').forEach(o => {
                    o.classList.remove('open');
                    const t = o.querySelector('.panel-dropdown-toggle');
                    if (t) t.setAttribute('aria-expanded', 'false');
                });
                dd.classList.toggle('open', willOpen);
                toggle.setAttribute('aria-expanded', String(willOpen));
            });
        }
        dd.querySelectorAll('.panel-dropdown-menu li').forEach(li => {
            li.addEventListener('click', () => {
                this.settings.difficulty = li.dataset.value;
                dd.classList.remove('open');
                if (toggle) toggle.setAttribute('aria-expanded', 'false');
                this.syncSettingsUI();
                this.saveSettings();
            });
        });
    }

    // Reflect the current settings into every control instance (sliders, toggles,
    // value labels, dropdown labels) so both panels always agree.
    syncSettingsUI() {
        if (!this.settings) return;
        const s = this.settings;

        document.querySelectorAll('[data-setting]').forEach(el => {
            const key = el.dataset.setting;
            if (el.type === 'checkbox') {
                el.checked = !!s[key];
            } else {
                el.value = s[key];
                // Paint the filled portion of the range track (0–100%).
                const min = parseFloat(el.min) || 0;
                const max = parseFloat(el.max) || 100;
                const pct = max > min ? ((s[key] - min) / (max - min)) * 100 : 0;
                el.style.setProperty('--fill', pct + '%');
            }
        });

        document.querySelectorAll('[data-display]').forEach(el => {
            el.textContent = s[el.dataset.display];
        });

        document.querySelectorAll('[data-dropdown="difficulty"]').forEach(dd => {
            const valueEl = dd.querySelector('.panel-dropdown-value');
            dd.querySelectorAll('.panel-dropdown-menu li').forEach(li => {
                const selected = li.dataset.value === s.difficulty;
                li.setAttribute('aria-selected', String(selected));
                if (selected && valueEl) valueEl.textContent = li.textContent;
            });
        });
    }

    saveSettings() {
        if (this.settings) {
            localStorage.setItem('bangorBitesAudioEnabled', this.settings.audioEnabled.toString());
            localStorage.setItem('bangorBitesVolume', this.settings.volume.toString());
            localStorage.setItem('bangorBitesDifficulty', this.settings.difficulty);
            localStorage.setItem('bangorBitesTimerDuration', this.settings.timerDuration.toString());
            localStorage.setItem('bangorBitesTargetScore', this.settings.targetScore.toString());
            localStorage.setItem('bangorBitesLives', this.settings.lives.toString());
            localStorage.setItem('bangorBitesScreenShake', this.settings.screenShake.toString());
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
        if (this.boomSound) {
            this.boomSound.volume = volume * 0.8; // Explosion SFX a bit louder for impact
            this.boomSound.muted = !this.settings.audioEnabled;
        }
    }

    showSettings() {
        // Blocked during the countdown so it can't abort a half-started game.
        if (this.isCountingDown) return;
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

    showHistory() {
        this.previousScreen = this.currentScreen;
        this.renderHistory();
        this.showScreen('history');
    }

    closeHistory() {
        this.showScreen(this.previousScreen);
    }

    clearHistory() {
        if (typeof GameHistory !== 'undefined') GameHistory.clear();
        this.renderHistory();
    }

    // Render the recent-games list into the History screen. Foundation only — a
    // flat list; richer stats/filtering come later.
    renderHistory() {
        const list = document.getElementById('history-list');
        const empty = document.getElementById('history-empty');
        if (!list) return;

        const items = (typeof GameHistory !== 'undefined') ? GameHistory.load() : [];
        list.innerHTML = '';
        if (empty) empty.style.display = items.length ? 'none' : '';

        const labels = { win: 'Menang', timeout: 'Waktu habis', 'no-lives': 'Kalah' };
        items.forEach(it => {
            const li = document.createElement('li');
            li.className = 'history-item history-' + (it.result || 'timeout');
            // Values are game-generated (numbers + fixed enums), not free text.
            const result = document.createElement('span');
            result.className = 'history-result';
            result.textContent = labels[it.result] || '—';
            const score = document.createElement('span');
            score.className = 'history-score';
            score.textContent = it.score != null ? it.score : 0;
            const meta = document.createElement('span');
            meta.className = 'history-meta';
            const diff = (it.difficulty || '').toString().toUpperCase();
            meta.textContent = [diff, this.formatHistoryDate(it.date)].filter(Boolean).join(' · ');
            li.append(result, score, meta);
            list.appendChild(li);
        });
    }

    // Compact DD/MM HH:MM for a stored ISO date; '' if missing/unparseable.
    formatHistoryDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const p = (n) => String(n).padStart(2, '0');
        return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
        const targetScore = this.settings?.targetScore || 30;
        const lives = this.settings?.lives || 3;

        // Initialize game logic with settings
        this.gameLogic = new GameLogic(this.gameCanvas, this.faceDetection, this.eatingSound, difficulty, timerDuration, targetScore, lives);
        this.gameLogic.reset();
        this._prevLives = lives; // baseline for the HUD damage-flash (see updateGameUI)
        this._endingGame = false; // clear the game-over guard for the new round
        this.clearGameOverTimer(); // drop any pending hold from a prior round
        // On any Willgozz hit: boom SFX + screen shake + explosion FX. The fatal
        // (last-heart) hit gets a bigger blast and a stronger shake.
        this.gameLogic.onObstacleHit = (x, y, size, fatal) => {
            this.playBoom();
            this.triggerShake(fatal);
            this.playExplosion(x, y, size, fatal);
        };
        this.stopExplosion(); // clear any leftover burst from a previous round
        
        // Play background music if enabled
        if (this.bgMusic && this.settings?.audioEnabled) {
            this.bgMusic.play().catch(error => {
                console.log('Audio play failed:', error);
                // Some browsers require user interaction before playing audio
            });
        }
        
        // Show game screen
        this.showScreen('game');

        // Start face detection first so the player sees themselves and can get
        // positioned during the countdown, before food starts falling.
        this.startFaceDetectionLoop();

        // Run the 3-2-1 countdown, then kick off the game loop (spawning + timer).
        this.runCountdown(() => this.startGameLoop());
    }

    // Displays 3 → 2 → 1 → GO! over the game area, then calls onComplete. While
    // counting, pause/settings are blocked (see their guards) so the game can't
    // be left in a half-started state.
    runCountdown(onComplete) {
        const el = this.countdownDisplay;
        if (!el) { onComplete(); return; } // fail open if the element is missing

        this.isCountingDown = true;
        el.classList.add('active');

        const steps = ['3', '2', '1', 'GO!'];
        let i = 0;
        const tick = () => {
            // Bail out if we somehow left the game screen mid-countdown.
            if (this.currentScreen !== 'game') {
                this.clearCountdown();
                return;
            }
            if (i >= steps.length) {
                this.clearCountdown();
                onComplete();
                return;
            }
            el.textContent = steps[i];
            // Retrigger the pop animation each tick by removing + reflowing + re-adding.
            el.classList.remove('countdown-pop');
            void el.offsetWidth;
            el.classList.add('countdown-pop');

            const isLast = i === steps.length - 1;
            i++;
            this.countdownTimerId = setTimeout(tick, isLast ? 700 : 1000);
        };
        tick();
    }

    clearCountdown() {
        if (this.countdownTimerId) {
            clearTimeout(this.countdownTimerId);
            this.countdownTimerId = null;
        }
        this.isCountingDown = false;
        if (this.countdownDisplay) {
            this.countdownDisplay.classList.remove('active', 'countdown-pop');
        }
    }

    // Toggle the "no face detected" warning. Only shown during active play.
    updateFaceIndicator(faceDetected) {
        if (!this.faceWarning) return;
        const shouldShow = !faceDetected
            && this.currentScreen === 'game'
            && !this.gameLogic?.isPaused;
        this.faceWarning.classList.toggle('active', shouldShow);
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
                this.onGameOver();
                return;
            }
        }

        // Continue loop
        this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
    }

    // Bridges gameLogic's game-over flag to the end screen. When the player ran
    // out of lives (fatal Willgozz), hold on the frozen board for a beat so the
    // explosion plays out before the end screen — the game loop has already
    // stopped, but the explosion has its own rAF loop that keeps drawing. A
    // timeout game-over has no blast to show, so it transitions immediately.
    // Guarded so the loop can't schedule two transitions.
    onGameOver() {
        if (this._endingGame) return;
        this._endingGame = true;

        if (this.gameLogic?.outOfLives) {
            this._gameOverTimer = setTimeout(() => {
                this._gameOverTimer = null;
                this.endGame();
            }, GAME_OVER_EXPLOSION_HOLD_MS);
        } else {
            this.endGame();
        }
    }

    // Cancel a pending game-over hold (quit/replay/home during the explosion beat)
    // so a stale timer can't fire the end screen over a screen we've since left.
    clearGameOverTimer() {
        if (this._gameOverTimer) {
            clearTimeout(this._gameOverTimer);
            this._gameOverTimer = null;
        }
    }

    updateGameUI() {
        if (!this.gameLogic) return;

        this.currentScoreDisplay.textContent = this.gameLogic.getScore();
        this.highScoreDisplay.textContent = this.gameLogic.getHighScore();
        this.timerDisplay.textContent = this.gameLogic.getTimeRemaining();

        const lives = this.gameLogic.getLives();
        if (this.currentLivesDisplay) {
            this.currentLivesDisplay.textContent = lives;
        }
        // Flash the hearts when a life is lost (obstacle eaten).
        if (this._prevLives != null && lives < this._prevLives) {
            this.flashLives();
        }
        this._prevLives = lives;
    }

    // Brief red pulse on the HUD hearts when an obstacle costs a life.
    flashLives() {
        if (!this.livesStat) return;
        this.livesStat.classList.remove('hud-damage');
        void this.livesStat.offsetWidth; // reflow so the animation retriggers
        this.livesStat.classList.add('hud-damage');
    }

    // One-shot explosion SFX on a Willgozz hit. Rewinds so rapid hits re-trigger
    // instead of being swallowed while the clip is still playing. Volume/mute is
    // applied in applySettings; a blocked autoplay just no-ops.
    playBoom() {
        const s = this.boomSound;
        if (!s) return;
        try { s.currentTime = 0; } catch (e) { /* not seekable yet */ }
        const p = s.play();
        if (p && p.catch) p.catch(() => { /* autoplay blocked — ignore */ });
    }

    // Brief shake of the play area on a Willgozz hit (fatal = stronger). Gated by
    // the screenShake setting. Retriggered by removing + reflowing + re-adding the
    // class so back-to-back hits each restart the animation.
    triggerShake(fatal = false) {
        if (!this.gameArea) return;
        if (this.settings && this.settings.screenShake === false) return;
        this.gameArea.classList.remove('shake', 'shake-strong');
        void this.gameArea.offsetWidth; // reflow so the animation restarts
        this.gameArea.classList.add(fatal ? 'shake-strong' : 'shake');
    }

    // Play the green-screen explosion clip at (x, y) in game-canvas coords, scaled
    // to the obstacle size. Restarting an in-flight burst just moves it and rewinds.
    // `fatal` (last-heart hit) gets a larger "finishing" blast than a normal hit.
    playExplosion(x, y, obstacleSize, fatal = false) {
        const v = this.explosionVideo;
        if (!v || !this.explosionCtx) return;

        // Fatal hit = bigger, more dramatic blast (pairs with the game-over hold);
        // normal hit stays punchy but contained.
        const box = fatal
            ? Math.max(400, Math.min(860, (obstacleSize || 80) * 7))
            : Math.max(260, Math.min(560, (obstacleSize || 80) * 4.6));
        this._explosion = { x, y, box, start: performance.now() };

        try { v.currentTime = 0; } catch (e) { /* not seekable yet */ }
        const p = v.play();
        if (p && p.catch) p.catch(() => { /* autoplay reject — muted should allow it */ });

        if (!this._explosionRAF) {
            this._renderExplosion();
        }
    }

    _renderExplosion() {
        const v = this.explosionVideo;
        const ctx = this.explosionCtx;
        const ex = this._explosion;
        if (!v || !ctx || !ex) { this._stopExplosionRAF(); return; }

        // Stop when the clip finishes, we leave the game screen, or as a safety
        // net if playback never started (autoplay blocked) so the loop can't leak.
        const maxMs = ((v.duration || 2.5) * 1000) + 400;
        if (v.ended || this.currentScreen !== 'game' || (performance.now() - ex.start) > maxMs) {
            this._clearExplosionCanvas();
            this._explosion = null;
            this._stopExplosionRAF();
            return;
        }

        // Wait for a genuinely decoded frame — drawing before HAVE_CURRENT_DATA can
        // blit a blank/black frame (extra insurance on top of the black keyer).
        if (v.readyState < 2) {
            this._explosionRAF = requestAnimationFrame(() => this._renderExplosion());
            return;
        }

        const vw = v.videoWidth || 852;
        const vh = v.videoHeight || 480;
        const spriteW = Math.round(ex.box);
        const spriteH = Math.round(ex.box * (vh / vw)); // preserve clip aspect ratio

        // Offscreen buffer at sprite resolution keeps the per-pixel key cheap.
        let off = this._exOffscreen;
        if (!off) { off = this._exOffscreen = document.createElement('canvas'); }
        if (off.width !== spriteW || off.height !== spriteH) {
            off.width = spriteW;
            off.height = spriteH;
        }
        const octx = this._exOffCtx ||
            (this._exOffCtx = off.getContext('2d', { willReadFrequently: true }));

        octx.clearRect(0, 0, off.width, off.height);
        try {
            octx.drawImage(v, 0, 0, off.width, off.height);
            const img = octx.getImageData(0, 0, off.width, off.height);
            chromaKeyGreen(img.data);
            octx.putImageData(img, 0, 0);
        } catch (e) {
            // Frame not ready this tick — skip keying, try again next frame.
        }

        ctx.clearRect(0, 0, this.explosionCanvas.width, this.explosionCanvas.height);
        ctx.drawImage(off, ex.x - off.width / 2, ex.y - off.height / 2);

        this._explosionRAF = requestAnimationFrame(() => this._renderExplosion());
    }

    _clearExplosionCanvas() {
        if (this.explosionCtx && this.explosionCanvas) {
            this.explosionCtx.clearRect(0, 0, this.explosionCanvas.width, this.explosionCanvas.height);
        }
    }

    _stopExplosionRAF() {
        if (this._explosionRAF) {
            cancelAnimationFrame(this._explosionRAF);
            this._explosionRAF = null;
        }
    }

    // Halt + clear any explosion (called on pause/quit/game-over/start). Also
    // silences the boom SFX and drops any in-flight shake so nothing lingers past
    // the transition.
    stopExplosion() {
        const v = this.explosionVideo;
        if (v) { try { v.pause(); v.currentTime = 0; } catch (e) { /* ignore */ } }
        if (this.boomSound) { try { this.boomSound.pause(); this.boomSound.currentTime = 0; } catch (e) { /* ignore */ } }
        if (this.gameArea) this.gameArea.classList.remove('shake', 'shake-strong');
        this._explosion = null;
        this._stopExplosionRAF();
        this._clearExplosionCanvas();
    }

    pauseGame() {
        // Don't allow pausing mid-countdown — the game loop hasn't started yet.
        if (this.isCountingDown) return;
        // Don't allow pausing during the game-over explosion hold — we're already
        // transitioning to the end screen.
        if (this._endingGame) return;
        if (this.gameLogic) {
            this.gameLogic.pause();
        }
        // Pause background music
        if (this.bgMusic && !this.bgMusic.paused) {
            this.bgMusic.pause();
        }
        this.stopExplosion();
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
        // Loop stopped itself when we entered the pause screen — restart it.
        this.startFaceDetectionLoop();
    }

    quitGame() {
        this.endGame();
        this.showStartScreen();
    }

    endGame() {
        this.clearCountdown();
        this.clearGameOverTimer();
        this.stopExplosion();
        if (this.faceWarning) this.faceWarning.classList.remove('active');
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
            const reason = this.gameLogic.getEndReason();
            this.finalScoreDisplay.textContent = this.gameLogic.getScore();
            this.endHighScoreDisplay.textContent = this.gameLogic.getHighScore();
            this.applyEndResult(reason);
            this.recordHistory(reason);
        }

        this.showScreen('end');
    }

    // Persist a finished game to the history (foundation — see gameHistory.js).
    // Only real game-overs are recorded; a manual quit leaves isGameOver false and
    // is skipped so partial/abandoned runs don't pollute the list.
    recordHistory(reason) {
        if (!this.gameLogic || !this.gameLogic.isGameOver) return;
        if (typeof GameHistory === 'undefined') return; // script not loaded — fail safe
        try {
            GameHistory.add({
                score: this.gameLogic.getScore(),
                result: reason, // 'win' | 'timeout' | 'no-lives'
                difficulty: this.gameLogic.difficulty,
                target: this.gameLogic.getTargetScore(),
                date: new Date().toISOString(),
            });
        } catch (e) {
            console.warn('Failed to record game history:', e);
        }
    }

    // Set the end screen for one of the three outcomes (see GameLogic.getEndReason):
    //   'win'      — Jawara theme + celebratory copy
    //   'no-lives' — lose theme + Willgozz copy (ran out of hearts)
    //   'timeout'  — lose theme + out-of-time copy
    // Both loss reasons share the 'lose' theme; only the headline/subtitle differ.
    applyEndResult(reason) {
        const isWin = reason === 'win';
        if (this.endScreen) {
            this.endScreen.classList.toggle('win', isWin);
            this.endScreen.classList.toggle('lose', !isWin);
        }

        let title, subtitle;
        switch (reason) {
            case 'win':
                title = 'JAWARA! 🔥';
                subtitle = 'Gokil! Kamu berhasil jadi juara!';
                break;
            case 'no-lives':
                title = 'Kalah! Kena Willgozz! 💥';
                subtitle = 'Hati kamu habis dilibas Willgozz. Awas, jangan dimakan!';
                break;
            case 'timeout':
            default:
                title = 'Yaah, Waktu Habis!';
                subtitle = 'Belum jadi jawara nih. Yuk coba lagi!';
                break;
        }

        if (this.endTitle) this.endTitle.textContent = title;
        if (this.endSubtitle) this.endSubtitle.textContent = subtitle;
    }

    showStartScreen() {
        this.showScreen('start');
        this.clearCountdown();
        this.clearGameOverTimer();
        this._endingGame = false;
        this.stopExplosion();
        if (this.faceWarning) this.faceWarning.classList.remove('active');
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
            case 'history':
                if (this.historyScreen) this.historyScreen.classList.add('active');
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
        
        // Set canvas size to 1080x1080 (square)
        const canvasWidth = 1080;
        const canvasHeight = 1080;
        const videoAspectRatio = videoWidth / videoHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;
        
        this.photoCanvas.width = canvasWidth;
        this.photoCanvas.height = canvasHeight;
        
        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Calculate video draw size to fit in square canvas (letterbox/pillarbox)
        let drawWidth, drawHeight, drawX, drawY;
        
        if (videoAspectRatio > canvasAspectRatio) {
            // Video is wider - fit to width (pillarbox)
            drawWidth = canvasWidth;
            drawHeight = canvasWidth / videoAspectRatio;
            drawX = 0;
            drawY = (canvasHeight - drawHeight) / 2;
        } else {
            // Video is taller - fit to height (letterbox)
            drawHeight = canvasHeight;
            drawWidth = canvasHeight * videoAspectRatio;
            drawX = (canvasWidth - drawWidth) / 2;
            drawY = 0;
        }
        
        // Draw video frame (flip untuk mirror effect)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(this.video, -drawX - drawWidth, drawY, drawWidth, drawHeight);
        ctx.restore();
        
        // Draw mascots in corners
        this.drawPhotoMascots(ctx, canvasWidth, canvasHeight);
        
        // Draw overlay dengan score
        this.drawPhotoOverlay(ctx, canvasWidth, canvasHeight);
        
        return this.photoCanvas.toDataURL('image/png');
    }

    async loadMascotImages() {
        const mascotAssets = [
            'assets/mascot/Barboy.png',        // Top-left
            'assets/mascot/Barboy_2.png',      // Top-right
            'assets/mascot/Jakrunchy.png',     // Bottom-left
            'assets/mascot/Munchie.png',       // Bottom-right
        ];

        // Load in parallel (was sequential). Promise.all preserves order, which
        // matters — drawPhotoMascots() indexes this array by corner position.
        this.mascotImages = await Promise.all(
            mascotAssets.map(asset => new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => {
                    console.warn(`Failed to load mascot ${asset}`);
                    resolve(img);
                };
                img.src = asset;
            }))
        );
    }

    async loadLogoImage() {
        const img = new Image();
        img.src = 'assets/logo/Bangor 2026 hitam.png';
        await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = () => {
                console.warn('Failed to load logo');
                resolve();
            };
        });
        this.logoImage = img;
    }

    drawPhotoMascots(ctx, width, height) {
        if (this.mascotImages.length < 4) return;

        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Scale for 1080x1080 resolution (base was 800px, scale factor ~1.35)
        const mascotSize = 162; // Size of mascot images (scaled from 120)
        const padding = 27; // Padding from edges (scaled from 20)

        // Top-left corner: Barboy
        if (this.mascotImages[0]) {
            ctx.drawImage(
                this.mascotImages[0],
                padding,
                padding,
                mascotSize,
                mascotSize
            );
        }

        // Top-right corner: Barboy_2
        if (this.mascotImages[1]) {
            ctx.drawImage(
                this.mascotImages[1],
                width - mascotSize - padding,
                padding,
                mascotSize,
                mascotSize
            );
        }

        // Bottom-left corner: Jakrunchy
        if (this.mascotImages[2]) {
            ctx.drawImage(
                this.mascotImages[2],
                padding,
                height - mascotSize - padding,
                mascotSize,
                mascotSize
            );
        }

        // Bottom-right corner: Munchie
        if (this.mascotImages[3]) {
            ctx.drawImage(
                this.mascotImages[3],
                width - mascotSize - padding,
                height - mascotSize - padding,
                mascotSize,
                mascotSize
            );
        }
    }

    drawPhotoOverlay(ctx, width, height) {
        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Scale for 1080x1080 resolution (base was 800px, scale factor ~1.35)
        const overlayHeight = 270; // Scaled from 200
        
        // Gradient background untuk overlay
        const gradient = ctx.createLinearGradient(0, height - overlayHeight, 0, height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height - overlayHeight, width, overlayHeight);
        
        // Set text alignment to center for all text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw score information
        const score = this.gameLogic ? this.gameLogic.getScore() : 0;
        const highScore = this.gameLogic ? this.gameLogic.getHighScore() : 0;
        
        // Logo/Brand - centered (white color)
        if (this.logoImage && this.logoImage.complete) {
            const logoHeight = 40; // Scaled from 60 (30*2.7 for better visibility)
            const logoWidth = (this.logoImage.width / this.logoImage.height) * logoHeight;
            const logoX = width / 2;
            const logoY = height - 216 + logoHeight / 2; // Scaled from 160
            
            // Save context state
            ctx.save();
            
            // Apply filter to convert black to white
            ctx.filter = 'brightness(0) invert(1)';
            
            ctx.drawImage(
                this.logoImage,
                logoX - logoWidth / 2,
                logoY - logoHeight / 2,
                logoWidth,
                logoHeight
            );
            
            // Restore context state
            ctx.restore();
        } else {
            // Fallback to text if logo not loaded
            ctx.fillStyle = '#8ec622';
            ctx.font = 'bold 43px Arial'; // Scaled from 32
            ctx.fillText('🍔 Bangor Bites', width / 2, height - 203); // Scaled from 150
        }
        
        // Score - centered
        ctx.fillStyle = '#fffee6';
        ctx.font = 'bold 65px Arial'; // Scaled from 48
        ctx.fillText(`Skor: ${score}`, width / 2, height - 135); // Scaled from 100
        
        // High Score - centered
        ctx.fillStyle = '#ff8222';
        ctx.font = 'bold 32px Arial'; // Scaled from 24
        ctx.fillText(`High Score: ${highScore}`, width / 2, height - 81); // Scaled from 60
        
        // Hashtag - centered
        ctx.fillStyle = '#4daadd';
        ctx.font = '27px Arial'; // Scaled from 20
        ctx.fillText('#BangorBitesChallenge', width / 2, height - 34); // Scaled from 25
        
        // Optional: Draw border
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 4; // Scaled from 3
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

