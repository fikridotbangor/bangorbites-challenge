// gameLogic.js - Game mechanics, objects, collision detection, and scoring

class GameLogic {
    constructor(canvas, faceDetection) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.faceDetection = faceDetection;
        
        this.score = 0;
        this.highScore = this.loadHighScore();
        this.gameTime = 60; // 60 seconds
        this.timeRemaining = this.gameTime;
        this.isPaused = false;
        this.isGameOver = false;
        
        this.foodObjects = [];
        this.foodImages = [];
        this.foodAssets = [
            'assets/food/burger-asset.webp',
            'assets/food/chicken-asset.webp',
            'assets/food/drink-asset.webp',
            'assets/food/fries-asset.webp',
        ];
        
        this.spawnInterval = 2000; // Spawn food every 2 seconds
        this.lastSpawnTime = 0;
        this.eatCooldown = 300; // 300ms cooldown between eating
        this.lastEatTime = 0;
        
        this.loadFoodImages();
    }

    async loadFoodImages() {
        for (const asset of this.foodAssets) {
            const img = new Image();
            img.src = asset;
            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = () => {
                    console.warn(`Failed to load ${asset}`);
                    resolve();
                };
            });
            this.foodImages.push(img);
        }
    }

    reset() {
        this.score = 0;
        this.timeRemaining = this.gameTime;
        this.foodObjects = [];
        this.isPaused = false;
        this.isGameOver = false;
        this.lastSpawnTime = 0;
        this.lastEatTime = 0;
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
        this.foodObjects.forEach((food, index) => {
            food.y += food.speed * (deltaTime / 16); // Normalize speed
            
            // Remove food that goes off screen
            if (food.y > this.canvas.height + 50) {
                this.foodObjects.splice(index, 1);
            }
        });

        // Check collisions
        this.checkCollisions();
    }

    spawnFood() {
        if (this.foodImages.length === 0) return;

        const randomImage = this.foodImages[Math.floor(Math.random() * this.foodImages.length)];
        const size = 60 + Math.random() * 40; // Random size between 60-100
        
        const food = {
            x: Math.random() * (this.canvas.width - size),
            y: -size,
            width: size,
            height: size,
            image: randomImage,
            speed: 1 + Math.random() * 2, // Random speed
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
        // Audio feedback - can add sound effects here
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
                // Fallback: draw colored circle
                this.ctx.fillStyle = '#ff6b6b';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, food.width / 2, 0, Math.PI * 2);
                this.ctx.fill();
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

