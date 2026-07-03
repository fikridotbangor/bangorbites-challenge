// faceDetection.test.js - Unit tests for FaceDetection. Run with: node --test
//
// Covers the faceDetected flag (used to show the "no face" warning) and the
// existing mouth-open detection, driving onResults() with fake landmark data.
// Requires the Node-only export shim at the bottom of faceDetection.js.

const { test } = require('node:test');
const assert = require('node:assert');

const { FaceDetection } = require('./faceDetection.js');

// No-op 2D context — onResults/detectMouth/drawMouth only draw, never read back.
function stubCtx() {
    return {
        save() {}, restore() {}, clearRect() {}, drawImage() {},
        beginPath() {}, arc() {}, fill() {}, stroke() {},
    };
}

function makeFd() {
    const fd = new FaceDetection();
    fd.canvas = { width: 800, height: 600 };
    fd.ctx = stubCtx();
    return fd;
}

// 468 landmarks all centered => mouth closed; caller overrides specific points.
function centeredLandmarks() {
    return Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }));
}

// Open-mouth pose (gap 0.10, width 0.10 => aspect ratio 1.0). `scale` shrinks the
// pose toward center to simulate a face farther from the camera — the aspect
// ratio stays 1.0 while the absolute gap shrinks with distance.
function openMouthLandmarks(scale = 1) {
    const c = 0.5;
    const at = (v) => c + (v - c) * scale;
    const l = centeredLandmarks();
    l[13] = { x: c, y: at(0.40) };   // MOUTH_TOP
    l[14] = { x: c, y: at(0.50) };   // MOUTH_BOTTOM
    l[61] = { x: at(0.45), y: c };   // MOUTH_LEFT
    l[291] = { x: at(0.55), y: c };  // MOUTH_RIGHT
    return l;
}

test('faceDetected is false when no face is in frame', () => {
    const fd = makeFd();
    fd.onResults({ image: {}, multiFaceLandmarks: [] });
    assert.strictEqual(fd.isFaceDetected(), false);
    assert.strictEqual(fd.isMouthOpen(), false);
});

test('faceDetected is true when a face is present', () => {
    const fd = makeFd();
    fd.onResults({ image: {}, multiFaceLandmarks: [centeredLandmarks()] });
    assert.strictEqual(fd.isFaceDetected(), true);
});

test('faceDetected flips back to false after the face leaves', () => {
    const fd = makeFd();
    fd.onResults({ image: {}, multiFaceLandmarks: [centeredLandmarks()] });
    assert.strictEqual(fd.isFaceDetected(), true);

    fd.onResults({ image: {}, multiFaceLandmarks: [] });
    assert.strictEqual(fd.isFaceDetected(), false);
});

test('mouth closed (top/bottom lips together) is not "open"', () => {
    const fd = makeFd();
    fd.onResults({ image: {}, multiFaceLandmarks: [centeredLandmarks()] });
    assert.strictEqual(fd.isMouthOpen(), false); // gap 0 < threshold 0.02
});

test('mouth open is detected for a near (full-size) open pose', () => {
    const fd = makeFd();
    fd.onResults({ image: {}, multiFaceLandmarks: [openMouthLandmarks(1)] });
    assert.strictEqual(fd.isMouthOpen(), true);
});

// Regression: the old absolute-gap threshold (0.02) failed here — a far/small
// face has a tiny absolute lip gap even with the mouth wide open. The ratio is
// distance-invariant, so it still registers.
test('mouth-open detection is distance-invariant (far/small face still registers)', () => {
    const fd = makeFd();
    const far = openMouthLandmarks(0.15); // gap 0.015 < old 0.02 threshold
    // Sanity: confirm the absolute gap is below the old threshold, so this test
    // genuinely exercises the fix rather than passing by coincidence.
    const absGap = Math.abs(far[13].y - far[14].y);
    assert.ok(absGap < 0.02, `absolute gap ${absGap} should be under the old 0.02 threshold`);

    fd.onResults({ image: {}, multiFaceLandmarks: [far] });
    assert.strictEqual(fd.isMouthOpen(), true);
});

test('degenerate zero mouth width does not throw or false-trigger', () => {
    const fd = makeFd();
    const l = centeredLandmarks();
    l[13] = { x: 0.5, y: 0.40 };
    l[14] = { x: 0.5, y: 0.50 };
    l[61] = { x: 0.5, y: 0.45 };   // left == right => width 0
    l[291] = { x: 0.5, y: 0.45 };
    fd.onResults({ image: {}, multiFaceLandmarks: [l] });
    assert.strictEqual(fd.isMouthOpen(), false); // guarded, not NaN
});
