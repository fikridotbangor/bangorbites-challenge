// gameLogic.js - Game mechanics, objects, collision detection, and scoring

class GameLogic {
    constructor(canvas, faceDetection, eatingSound = null, difficulty = 'medium', gameTime = 60, targetScore = 30, lives = 3) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.faceDetection = faceDetection;
        this.eatingSound = eatingSound;

        this.score = 0;
        this.highScore = this.loadHighScore();
        this.gameTime = gameTime;
        this.timeRemaining = this.gameTime;
        this.targetScore = targetScore; // score needed to "win" (Jawara)
        // Lives: eating an obstacle (Willgozhead) costs one; hitting 0 ends the game
        // as a loss regardless of score/time (see loseLife/isWin).
        this.maxLives = lives;
        this.lives = lives;
        this.outOfLives = false;
        this.isPaused = false;
        this.isGameOver = false;
        this.difficulty = difficulty;

        // foodObjects holds BOTH food and obstacles; each carries a `type`
        // ('food' | 'obstacle') so update/render/collision can share one loop.
        this.foodObjects = [];
        this.foodImages = [];
        this.obstacleImages = [];
        this.obstacleAssets = [
            'assets/obstacles/Willgozhead.png',
        ];
        // Only the Jawara Cheese burger is spawned as edible food now (was a 15-item
        // mix). spawnFood() picks randomly from this list, so a single entry means
        // every falling food is this asset.
        this.foodAssets = [
            'assets/jawara-cheese/jawara-cheese.png',
        ];
        
        // Difficulty-based settings
        this.setDifficultySettings(difficulty);
        
        this.lastSpawnTime = 0;
        this.eatCooldown = 300; // 300ms cooldown between eating
        this.lastEatTime = 0;

        this.loadFoodImages();
        this.loadObstacleImages();
    }

    setDifficultySettings(difficulty) {
        switch(difficulty) {
            case 'easy':
                this.spawnInterval = 2500; // Spawn food every 2.5 seconds
                this.baseSpeed = 0.8; // Slower speed
                this.maxSpeed = 1.5;
                this.obstacleChance = 0.12; // ~1 in 8 spawns is an obstacle
                break;
            case 'hard':
                this.spawnInterval = 1200; // Spawn food every 1.2 seconds
                this.baseSpeed = 1.5; // Faster speed
                this.maxSpeed = 3.0;
                this.obstacleChance = 0.30; // ~1 in 3 spawns is an obstacle
                break;
            case 'medium':
            default:
                this.spawnInterval = 2000; // Spawn food every 2 seconds
                this.baseSpeed = 1.0; // Normal speed
                this.maxSpeed = 2.0;
                this.obstacleChance = 0.20; // ~1 in 5 spawns is an obstacle
                break;
        }
    }

    async loadFoodImages() {
        // Load all images in parallel (was sequential — 15 round-trips one by one)
        // and memoize on the class so replays reuse the decoded images instead of
        // re-fetching/decoding every time startGame() builds a new GameLogic.
        if (!GameLogic._foodImagesPromise) {
            GameLogic._foodImagesPromise = Promise.all(
                this.foodAssets.map(asset => new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => {
                        console.warn(`Failed to load ${asset}`);
                        resolve(img); // keep index parity; broken image just draws nothing
                    };
                    img.src = asset;
                }))
            );
        }
        this.foodImages = await GameLogic._foodImagesPromise;
    }

    async loadObstacleImages() {
        // Same parallel + memoized load as the food images (see loadFoodImages).
        if (!GameLogic._obstacleImagesPromise) {
            GameLogic._obstacleImagesPromise = Promise.all(
                this.obstacleAssets.map(asset => new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => {
                        console.warn(`Failed to load ${asset}`);
                        resolve(img); // keep index parity; broken image just draws nothing
                    };
                    img.src = asset;
                }))
            );
        }
        this.obstacleImages = await GameLogic._obstacleImagesPromise;
    }

    reset() {
        this.score = 0;
        this.timeRemaining = this.gameTime;
        this.foodObjects = [];
        this.lives = this.maxLives;
        this.outOfLives = false;
        this.isPaused = false;
        this.isGameOver = false;
        this.lastSpawnTime = 0;
        this.lastEatTime = 0;
        // Reapply difficulty settings in case difficulty changed
        this.setDifficultySettings(this.difficulty);
    }

    update(deltaTime) {
        if (this.isPaused || this.isGameOver) return;

        // Update timer
        this.timeRemaining -= deltaTime / 1000;
        if (this.timeRemaining <= 0) {
            this.timeRemaining = 0;
            this.endGame();
            return;
        }

        // Spawn a food or an obstacle (obstacle chance is difficulty-based)
        const currentTime = Date.now();
        if (currentTime - this.lastSpawnTime > this.spawnInterval) {
            if (Math.random() < this.obstacleChance) {
                this.spawnObstacle();
            } else {
                this.spawnFood();
            }
            this.lastSpawnTime = currentTime;
        }

        // Update food objects
        // Iterate in reverse so splicing an off-screen item doesn't shift the
        // indices of items we haven't visited yet. forEach + splice skipped the
        // element right after a removed one, leaving off-screen food alive.
        for (let i = this.foodObjects.length - 1; i >= 0; i--) {
            const food = this.foodObjects[i];
            food.y += food.speed * (deltaTime / 16); // Normalize speed

            // Remove food that goes off screen
            if (food.y > this.canvas.height + 50) {
                this.foodObjects.splice(i, 1);
            }
        }

        // Check collisions
        this.checkCollisions();
    }

    // Food/obstacle sizes were tuned against an 800px-wide play field. Scale them
    // to the actual canvas width so they stay the SAME relative size when the
    // logical buffer grows for a bigger display (see layout.js) — otherwise a
    // larger canvas would make everything relatively smaller and harder to eat.
    _sizeScale() {
        const w = (this.canvas && this.canvas.width) ? this.canvas.width : 800;
        return w / 800;
    }

    spawnFood() {
        if (this.foodImages.length === 0) return;

        const randomImage = this.foodImages[Math.floor(Math.random() * this.foodImages.length)];
        const size = (60 + Math.random() * 40) * this._sizeScale(); // 60-100 @ 800px width, scaled

        // Preserve the sprite's aspect ratio so a non-square asset (jawara-cheese is
        // 652x462) isn't squished into a square. Width governs (drives collision via
        // food.width); height follows the image. Falls back to square if the image
        // hasn't reported its natural size (e.g. test mocks). Obstacles are left as-is.
        const natW = randomImage && randomImage.naturalWidth ? randomImage.naturalWidth : 0;
        const natH = randomImage && randomImage.naturalHeight ? randomImage.naturalHeight : 0;
        const aspect = (natW > 0 && natH > 0) ? (natW / natH) : 1;
        const width = size;
        const height = size / aspect;

        // Use difficulty-based speed
        const speed = this.baseSpeed + Math.random() * (this.maxSpeed - this.baseSpeed);

        const food = {
            x: Math.random() * (this.canvas.width - width),
            y: -height,
            width: width,
            height: height,
            image: randomImage,
            speed: speed,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.1,
            type: 'food'
        };

        this.foodObjects.push(food);
    }

    spawnObstacle() {
        if (this.obstacleImages.length === 0) return;

        const randomImage = this.obstacleImages[Math.floor(Math.random() * this.obstacleImages.length)];
        const size = (60 + Math.random() * 40) * this._sizeScale(); // same range as food, scaled to width
        const speed = this.baseSpeed + Math.random() * (this.maxSpeed - this.baseSpeed);

        const obstacle = {
            x: Math.random() * (this.canvas.width - size),
            y: -size,
            width: size,
            height: size,
            image: randomImage,
            speed: speed,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.1,
            type: 'obstacle'
        };

        this.foodObjects.push(obstacle);
    }

    checkCollisions() {
        if (!this.faceDetection || !this.faceDetection.isMouthOpen()) return;

        const mouthPos = this.faceDetection.getMouthPosition();
        if (!mouthPos || mouthPos.radius === 0) return;

        // Check cooldown
        const currentTime = Date.now();
        if (currentTime - this.lastEatTime < this.eatCooldown) return;

        // Map mouth position to canvas coordinates
        // The face canvas and game canvas are aligned with same dimensions
        const mouthX = mouthPos.x;
        const mouthY = mouthPos.y;
        const mouthRadius = mouthPos.radius;

        // Check collisions with all food objects
        for (let i = this.foodObjects.length - 1; i >= 0; i--) {
            const food = this.foodObjects[i];
            const foodCenterX = food.x + food.width / 2;
            const foodCenterY = food.y + food.height / 2;

            // Calculate distance between mouth center and food center
            const distance = Math.sqrt(
                Math.pow(mouthX - foodCenterX, 2) + 
                Math.pow(mouthY - foodCenterY, 2)
            );

            // Check if the object is within mouth radius
            const collisionRadius = mouthRadius + (food.width / 2);
            if (distance < collisionRadius) {
                if (food.type === 'obstacle') {
                    // Ate an obstacle (Willgozhead) — remove it and lose a life.
                    // Pass the obstacle centre so the effect layer can place the
                    // explosion where it was eaten.
                    this.foodObjects.splice(i, 1);
                    this.loseLife(foodCenterX, foodCenterY, food.width);
                } else {
                    // Food eaten!
                    this.eatFood(i);
                }
                this.lastEatTime = currentTime;
                break; // Only react to one object at a time
            }
        }
    }

    loseLife(x, y, size) {
        this.lives--;
        // `fatal` = this is the killing blow (last heart gone). Computed here,
        // BEFORE outOfLives is set, so the hook can render a bigger "finishing"
        // explosion for the fatal hit. lives is already decremented, so <= 0 means
        // this obstacle emptied the last heart.
        const fatal = this.lives <= 0;
        this.onObstacleHit(x, y, size, fatal);
        if (fatal) {
            this.lives = 0;
            this.outOfLives = true;
            // Out of lives is an immediate loss regardless of score/time.
            this.endGame();
        }
    }

    // Feedback hook for eating an obstacle. main.js overrides this to flash the
    // HUD hearts and play the explosion effect at (x, y) (obstacle centre, in
    // game-canvas coords; size = obstacle width). `fatal` is true on the hit that
    // empties the last heart, so the effect layer can scale up the blast. Kept
    // separate from onFoodEaten so the two never share a sound/effect.
    onObstacleHit(x, y, size, fatal) {
    }

    eatFood(index) {
        this.foodObjects.splice(index, 1);
        this.score++;
        
        // Update high score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
        }

        // Trigger visual/audio feedback (can be extended)
        this.onFoodEaten();
    }

    onFoodEaten() {
        // Visual feedback - can add particle effects here
        
        // Audio feedback - play eating sound effect
        if (this.eatingSound) {
            // Reset to beginning and play
            this.eatingSound.currentTime = 0;
            this.eatingSound.play().catch(error => {
                console.log('Eating sound play failed:', error);
            });
        }
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw food objects
        this.foodObjects.forEach(food => {
            this.ctx.save();
            
            // Move to food center for rotation
            this.ctx.translate(food.x + food.width / 2, food.y + food.height / 2);
            this.ctx.rotate(food.rotation);
            
            // Draw food image
            if (food.image) {
                this.ctx.drawImage(
                    food.image,
                    -food.width / 2,
                    -food.height / 2,
                    food.width,
                    food.height
                );
            } else {
                // Fallback: draw colored circle - minimalist style
                this.ctx.fillStyle = '#ff8222';
                this.ctx.strokeStyle = '#212121';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, food.width / 2, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
            }
            
            this.ctx.restore();
            
            // Update rotation
            food.rotation += food.rotationSpeed;
        });
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }

    endGame() {
        this.isGameOver = true;
    }

    getScore() {
        return this.score;
    }

    getHighScore() {
        return this.highScore;
    }

    getTimeRemaining() {
        return Math.ceil(this.timeRemaining);
    }

    getTargetScore() {
        return this.targetScore;
    }

    getLives() {
        return this.lives;
    }

    getMaxLives() {
        return this.maxLives;
    }

    // Win ("Jawara") only when the target score is reached AND lives remain.
    // Running out of lives is always a loss, even if the score hit the target.
    isWin() {
        return !this.outOfLives && this.score >= this.targetScore;
    }

    // Which of the three end states we landed in, so the end screen can show the
    // right copy:
    //   'win'      — hit the target score with lives to spare
    //   'no-lives' — ate the final Willgozz (obstacle); always a loss, even at target
    //   'timeout'  — the clock hit 0 without reaching the target
    // outOfLives is the invariant that separates the two loss reasons (a timeout
    // never sets it). isWin() already treats outOfLives as an override, so the
    // order here is safe.
    getEndReason() {
        if (this.isWin()) return 'win';
        if (this.outOfLives) return 'no-lives';
        return 'timeout';
    }

    setCanvasSize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    loadHighScore() {
        const saved = localStorage.getItem('bangorBitesChallengeHighScore');
        return saved ? parseInt(saved, 10) : 0;
    }

    saveHighScore() {
        localStorage.setItem('bangorBitesChallengeHighScore', this.highScore.toString());
    }
}

// Shared decoded-image caches across all GameLogic instances (see load*Images).
GameLogic._foodImagesPromise = null;
GameLogic._obstacleImagesPromise = null;

// Node-only export for unit tests. Browsers have no `module`, so this is a no-op
// there and the game keeps using GameLogic as a global from the <script> tag.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameLogic };
}

