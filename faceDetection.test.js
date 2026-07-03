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

test('mouth open is detected when lip gap exceeds the threshold', () => {
    const fd = makeFd();
    const landmarks = centeredLandmarks();
    landmarks[13] = { x: 0.5, y: 0.40 };  // MOUTH_TOP
    landmarks[14] = { x: 0.5, y: 0.50 };  // MOUTH_BOTTOM (gap 0.10 > 0.02)
    landmarks[61] = { x: 0.45, y: 0.45 }; // MOUTH_LEFT
    landmarks[291] = { x: 0.55, y: 0.45 }; // MOUTH_RIGHT
    fd.onResults({ image: {}, multiFaceLandmarks: [landmarks] });
    assert.strictEqual(fd.isMouthOpen(), true);
});
