// photoCapture.test.js - Unit tests for the pure photo-capture helpers.
// Run with: node --test

const { test } = require('node:test');
const assert = require('node:assert');

const { captureStamp, countdownSequence, CAPTURE_STAMPS } = require('./photoCapture.js');

// --- captureStamp: end reason -> baked win/lose stamp ---

test('win reason yields the JAWARA hero stamp (won=true)', () => {
    const s = captureStamp('win');
    assert.strictEqual(s.text, 'JAWARA! 🔥');
    assert.strictEqual(s.won, true);
    assert.strictEqual(s.color, '#8ec622');
});

test('no-lives reason yields the consolation stamp (won=false)', () => {
    const s = captureStamp('no-lives');
    assert.strictEqual(s.text, 'SANG PENANTANG');
    assert.strictEqual(s.won, false);
});

test('timeout reason yields the same consolation stamp as no-lives', () => {
    assert.deepStrictEqual(captureStamp('timeout'), captureStamp('no-lives'),
        'both losses share one menang/kalah lose stamp');
});

test('unknown reason falls back to the lose stamp, never a win', () => {
    assert.strictEqual(captureStamp('garbage').won, false);
    assert.strictEqual(captureStamp(undefined).won, false);
    assert.strictEqual(captureStamp(null).won, false);
});

test('win and lose stamps use different colours', () => {
    assert.notStrictEqual(captureStamp('win').color, captureStamp('timeout').color);
});

// --- countdownSequence: ticks before the shutter ---

test('default countdown is 3, 2, 1', () => {
    assert.deepStrictEqual(countdownSequence(), [3, 2, 1]);
});

test('countdown honours a custom start value', () => {
    assert.deepStrictEqual(countdownSequence(5), [5, 4, 3, 2, 1]);
    assert.deepStrictEqual(countdownSequence(1), [1]);
});

test('countdown clamps zero/negative to a single tick (never instant capture)', () => {
    assert.deepStrictEqual(countdownSequence(0), [1]);
    assert.deepStrictEqual(countdownSequence(-4), [1]);
});

test('countdown floors non-integer input', () => {
    assert.deepStrictEqual(countdownSequence(3.9), [3, 2, 1]);
});

test('countdown treats NaN/garbage as a single tick', () => {
    assert.deepStrictEqual(countdownSequence(NaN), [1]);
    assert.deepStrictEqual(countdownSequence('abc'), [1]);
});

test('CAPTURE_STAMPS is exported for the canvas renderer to reuse', () => {
    assert.ok(CAPTURE_STAMPS.win && CAPTURE_STAMPS.timeout, 'stamp table is available');
});
