// chromaKey.test.js - Unit tests for the green-screen keyer. Run with: node --test

const { test } = require('node:test');
const assert = require('node:assert');

const { chromaKeyGreen } = require('./chromaKey.js');

// One RGBA pixel as a 4-length array.
function px(r, g, b, a = 255) { return [r, g, b, a]; }

test('keys out a strong green-screen pixel (alpha -> 0)', () => {
    const d = px(30, 220, 40);
    chromaKeyGreen(d);
    assert.strictEqual(d[3], 0, 'green background becomes transparent');
});

test('keeps an orange explosion pixel opaque and unchanged', () => {
    const d = px(255, 140, 20);
    chromaKeyGreen(d);
    assert.strictEqual(d[3], 255, 'explosion stays visible');
    assert.strictEqual(d[1], 140, 'no spill suppression when red dominates');
});

test('keeps a bright white/smoke pixel', () => {
    const d = px(240, 240, 240);
    chromaKeyGreen(d);
    assert.strictEqual(d[3], 255);
});

test('suppresses green spill on a kept pixel (clamps g to max(r,b))', () => {
    // Greenish but not enough to key (g - max(r,b) = 30 <= gDom 40).
    const d = px(120, 150, 100);
    chromaKeyGreen(d);
    assert.strictEqual(d[3], 255, 'not keyed');
    assert.strictEqual(d[1], 120, 'green clamped down to max(r,b)=120');
});

test('a green just below the dominance threshold is kept, above is keyed', () => {
    const keep = px(100, 135, 100); // g-max = 35 <= 40 -> kept
    chromaKeyGreen(keep);
    assert.strictEqual(keep[3], 255);

    const key = px(100, 145, 100); // g-max = 45 > 40, g>80 -> keyed
    chromaKeyGreen(key);
    assert.strictEqual(key[3], 0);
});

test('respects custom thresholds', () => {
    const d = px(30, 220, 40);
    chromaKeyGreen(d, { gDom: 250 }); // impossible dominance -> never keys
    assert.strictEqual(d[3], 255, 'custom gDom prevents keying');
});

test('processes a multi-pixel buffer, keying only green pixels', () => {
    // [green, orange, green]
    const d = [30, 220, 40, 255,  255, 120, 10, 255,  10, 200, 20, 255];
    chromaKeyGreen(d);
    assert.strictEqual(d[3], 0, 'pixel 0 keyed');
    assert.strictEqual(d[7], 255, 'pixel 1 kept');
    assert.strictEqual(d[11], 0, 'pixel 2 keyed');
});
