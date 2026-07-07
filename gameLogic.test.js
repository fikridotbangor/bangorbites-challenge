// gameLogic.test.js - Unit tests for GameLogic. Run with: node --test
//
// Uses Node's built-in test runner (node:test) + node:assert so the repo needs
// no package.json / npm dependency. GameLogic is required via the Node-only
// export shim added at the bottom of gameLogic.js.

const { test } = require('node:test');
const assert = require('node:assert');

// --- Minimal browser-global mocks (constructor touches these) ---
global.localStorage = {
    _store: {},
    getItem(k) { return k in this._store ? this._store[k] : null; },
    setItem(k, v) { this._store[k] = String(v); },
};
// No-op Image: loadFoodImages() sets .src then awaits onload which never fires,
// so foodImages stays empty. That's what we want here — no spawns to interfere.
global.Image = class {};

const { GameLogic } = require('./gameLogic.js');

// Build a GameLogic with fake canvas/faceDetection and no spawning/eating.
function makeGame() {
    const canvas = { width: 800, height: 600, getContext: () => ({}) };
    const faceDetection = { isMouthOpen: () => false }; // never eats
    const gl = new GameLogic(canvas, faceDetection, null, 'medium', 60);
    gl.lastSpawnTime = Date.now(); // keep spawn interval from firing during update()
    return gl;
}

// off-screen threshold in update() is canvas.height + 50 = 650.
function food(y) {
    return { x: 0, y, width: 60, height: 60, image: null, speed: 0, rotation: 0, rotationSpeed: 0 };
}

// Regression: the original forEach+splice skipped the item right after a removed
// one, so an off-screen food adjacent to another survived.
test('removes both adjacent off-screen foods, keeps the on-screen one', () => {
    const gl = makeGame();
    gl.foodObjects = [food(700), food(800), food(100)];

    gl.update(16);

    assert.strictEqual(gl.foodObjects.length, 1, 'both off-screen foods removed');
    assert.strictEqual(gl.foodObjects[0].y, 100, 'on-screen food kept');
});

test('keeps all foods when none are off-screen', () => {
    const gl = makeGame();
    gl.foodObjects = [food(100), food(200), food(300)];

    gl.update(16);

    assert.strictEqual(gl.foodObjects.length, 3);
});

test('removes all foods when every one is off-screen', () => {
    const gl = makeGame();
    gl.foodObjects = [food(700), food(800), food(900)];

    gl.update(16);

    assert.strictEqual(gl.foodObjects.length, 0);
});

test('handles an empty food list without error', () => {
    const gl = makeGame();
    gl.foodObjects = [];

    assert.doesNotThrow(() => gl.update(16));
    assert.strictEqual(gl.foodObjects.length, 0);
});

test('food just past the threshold is removed, just before is kept', () => {
    const gl = makeGame(); // threshold = height + 50 = 650
    gl.foodObjects = [food(651), food(650)];

    gl.update(16); // speed 0, so y stays put

    assert.strictEqual(gl.foodObjects.length, 1, 'y=651 removed (>650), y=650 kept');
    assert.strictEqual(gl.foodObjects[0].y, 650);
});

test('food images load once and are cached/shared across instances', async () => {
    GameLogic._foodImagesPromise = null; // reset shared cache
    let created = 0;
    const RealImage = global.Image;
    // Image mock that counts src assignments and resolves onload on next microtask.
    global.Image = class {
        set src(_v) {
            created++;
            queueMicrotask(() => { if (this.onload) this.onload(); });
        }
    };

    try {
        const g1 = makeGame();
        const g2 = makeGame();
        await g1.loadFoodImages();
        await g2.loadFoodImages();

        assert.strictEqual(g1.foodImages, g2.foodImages, 'both instances share one cached array');
        assert.strictEqual(g1.foodImages.length, g1.foodAssets.length, 'all images present, order preserved');
        assert.strictEqual(created, g1.foodAssets.length, 'fetched once total, not per instance (no replay reload)');
    } finally {
        global.Image = RealImage;
    }
});

test('isWin is true when the score reaches the target (win screen)', () => {
    const gl = makeGame();
    gl.targetScore = 30;
    gl.score = 30;
    assert.strictEqual(gl.isWin(), true, 'exactly at target counts as a win');
    gl.score = 45;
    assert.strictEqual(gl.isWin(), true, 'above target is a win');
});

test('isWin is false when the score is below the target (lose screen)', () => {
    const gl = makeGame();
    gl.targetScore = 30;
    gl.score = 29;
    assert.strictEqual(gl.isWin(), false);
});
