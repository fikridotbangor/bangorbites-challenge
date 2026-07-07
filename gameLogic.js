// gameLogic.js - Game mechanics, objects, collision detection, and scoring

class GameLogic {
    constructor(canvas, faceDetection, eatingSound = null, difficulty = 'medium', gameTime = 60, targetScore = 30) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.faceDetection = faceDetection;
        this.eatingSound = eatingSound;

        this.score = 0;
        this.highScore = this.loadHighScore();
        this.gameTime = gameTime;
        this.timeRemaining = this.gameTime;
        this.targetScore = targetScore; // score needed to "win" (Jawara)
        this.isPaused = false;
        this.isGameOver = false;
        this.difficulty = difficulty;
        
        this.foodObjects = [];
        this.foodImages = [];
        this.foodAssets = [
            'assets/food-2/bangor_cheese_jr.webp',
            'assets/food-2/bbq_smoke_beef_cheese.webp',
            'assets/food-2/bbq_smoke_beef.webp',
            'assets/food-2/bfc_paha.webp',
            'assets/food-2/congor_cheese.webp',
            'assets/food-2/creamy_garlic_cheese.webp',
            'assets/food-2/french_fries.webp',
            'assets/food-2/fries_cheese.webp',
            'assets/food-2/hotdog.webp',
            'assets/food-2/jelata_cheese.webp',
            'assets/food-2/juragan_cheese.webp',
            'assets/food-2/ningrat_cheese.webp',
            'assets/food-2/pitik_cheese.webp',
            'assets/food-2/pitik_fire_cheese.webp',
            'assets/food-2/sultan.webp',
        ];
        
        // Difficulty-based settings
        this.setDifficultySettings(difficulty);
        
        this.lastSpawnTime = 0;
        this.eatCooldown = 300; // 300ms cooldown between eating
        this.lastEatTime = 0;
        
        this.loadFoodImages();
    }

    setDifficultySettings(difficulty) {
        switch(difficulty) {
            case 'easy':
                this.spawnInterval = 2500; // Spawn food every 2.5 seconds
                this.baseSpeed = 0.8; // Slower speed
                this.maxSpeed = 1.5;
                break;
            case 'hard':
                this.spawnInterval = 1200; // Spawn food every 1.2 seconds
                this.baseSpeed = 1.5; // Faster speed
                this.maxSpeed = 3.0;
                break;
            case 'medium':
            default:
                this.spawnInterval = 2000; // Spawn food every 2 seconds
                this.baseSpeed = 1.0; // Normal speed
                this.maxSpeed = 2.0;
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

    reset() {
        this.score = 0;
        this.timeRemaining = this.gameTime;
        this.foodObjects = [];
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

        // Spawn food objects
        const currentTime = Date.now();
        if (currentTime - this.lastSpawnTime > this.spawnInterval) {
            this.spawnFood();
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

    spawnFood() {
        if (this.foodImages.length === 0) return;

        const randomImage = this.foodImages[Math.floor(Math.random() * this.foodImages.length)];
        const size = 60 + Math.random() * 40; // Random size between 60-100
        
        // Use difficulty-based speed
        const speed = this.baseSpeed + Math.random() * (this.maxSpeed - this.baseSpeed);
        
        const food = {
            x: Math.random() * (this.canvas.width - size),
            y: -size,
            width: size,
            height: size,
            image: randomImage,
            speed: speed,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.1
        };

        this.foodObjects.push(food);
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

            // Check if food is within mouth radius
            const collisionRadius = mouthRadius + (food.width / 2);
            if (distance < collisionRadius) {
                // Food eaten!
                this.eatFood(i);
                this.lastEatTime = currentTime;
                break; // Only eat one food at a time
            }
        }
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

    // Win ("Jawara") when the final score reaches the target, else lose.
    isWin() {
        return this.score >= this.targetScore;
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

// Shared decoded-image cache across all GameLogic instances (see loadFoodImages).
GameLogic._foodImagesPromise = null;

// Node-only export for unit tests. Browsers have no `module`, so this is a no-op
// there and the game keeps using GameLogic as a global from the <script> tag.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameLogic };
}

