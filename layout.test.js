// layout.test.js - Unit tests for computeCanvasBox. Run with: node --test

const { test } = require('node:test');
const assert = require('node:assert');

const { computeCanvasBox, MAX_LOGICAL_WIDTH } = require('./layout.js');

const approx = (a, b, eps = 1.5) => Math.abs(a - b) <= eps;

test('fills the width when the area is width-constrained', () => {
    const box = computeCanvasBox(16 / 9, 1600, 2000);
    assert.strictEqual(box.dispW, 1600);
    assert.ok(approx(box.dispH, 900), `dispH ~900, got ${box.dispH}`);
});

test('letterboxes to fit when the area is height-constrained', () => {
    const box = computeCanvasBox(16 / 9, 1600, 400);
    assert.strictEqual(box.dispH, 400);
    assert.ok(approx(box.dispW, 711), `dispW ~711, got ${box.dispW}`);
    assert.ok(box.dispW <= 1600, 'never exceeds the available width');
});

test('caps the logical buffer at MAX_LOGICAL_WIDTH on a large display', () => {
    const box = computeCanvasBox(16 / 9, 1880, 980); // ~1080p TV area
    assert.ok(box.dispW > MAX_LOGICAL_WIDTH, 'display is bigger than the cap');
    assert.strictEqual(box.bufW, MAX_LOGICAL_WIDTH, 'buffer clamped to the cap');
    assert.ok(approx(box.bufH, 720), `bufH ~720, got ${box.bufH}`);
});

test('buffer equals display on small screens (never upscales the buffer)', () => {
    const box = computeCanvasBox(16 / 9, 760, 600);
    assert.ok(box.dispW < MAX_LOGICAL_WIDTH);
    assert.strictEqual(box.bufW, box.dispW);
    assert.strictEqual(box.bufH, box.dispH);
});

test('preserves the aspect ratio in both display and buffer', () => {
    const box = computeCanvasBox(16 / 9, 1880, 980);
    assert.ok(approx(box.dispW / box.dispH, 16 / 9, 0.02), 'display ratio kept');
    assert.ok(approx(box.bufW / box.bufH, 16 / 9, 0.02), 'buffer ratio kept');
});

test('handles a 4:3 webcam aspect', () => {
    const box = computeCanvasBox(4 / 3, 1000, 1000);
    assert.strictEqual(box.dispW, 1000);
    assert.ok(approx(box.dispH, 750), `dispH ~750, got ${box.dispH}`);
    assert.ok(approx(box.bufW / box.bufH, 4 / 3, 0.02));
});

test('falls back to 16:9 on a degenerate aspect', () => {
    const box = computeCanvasBox(0, 1600, 2000);
    assert.ok(approx(box.dispW / box.dispH, 16 / 9, 0.02));
});

test('respects a custom cap argument', () => {
    const box = computeCanvasBox(16 / 9, 1880, 980, 960);
    assert.strictEqual(box.bufW, 960);
    assert.ok(approx(box.bufH, 540), `bufH ~540, got ${box.bufH}`);
});
