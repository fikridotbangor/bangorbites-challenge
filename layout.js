// layout.js - Pure play-area sizing.
//
// Given the webcam aspect ratio and the available viewport area, computes:
//   - the DISPLAY box (CSS px) — the largest box of that ratio that fits, so the
//     play area fills a big screen (e.g. a 42" TV) instead of a fixed 800x600 box;
//   - the logical canvas BUFFER (pixel resolution) — the same ratio, long side
//     capped, so per-pixel work stays light and the game coordinate space is
//     stable across screen sizes (the element is CSS-scaled past the buffer).
//
// Deriving the ratio from the webcam (not a fixed 4:3) keeps the mirrored video
// and the face-landmark -> canvas mapping aligned; a mismatch is what caused the
// "mouth here, food eaten there" drift when a 16:9 camera was letterboxed into 4:3.
//
// Kept standalone + dependency-free so it's unit-tested (layout.test.js) and
// reused as a browser global from the <script> tag, like gameLogic/chromaKey.

// Cap the logical buffer's long side. Past this the element is CSS-upscaled, so
// food size / collision math stay in a stable space regardless of display size.
const MAX_LOGICAL_WIDTH = 1280;

function computeCanvasBox(aspect, availW, availH, maxLogicalW = MAX_LOGICAL_WIDTH) {
    // Guard degenerate inputs (aspect 0/NaN, non-positive area) — fail to 16:9.
    const a = aspect > 0 ? aspect : 16 / 9;
    const w = availW > 0 ? availW : 1;
    const h = availH > 0 ? availH : 1;

    // Largest box of ratio `a` that fits inside w x h (letterbox fit).
    let dispW = w;
    let dispH = dispW / a;
    if (dispH > h) { dispH = h; dispW = dispH * a; }
    dispW = Math.round(dispW);
    dispH = Math.round(dispH);

    // Logical buffer: same ratio, long side capped. Never upscale the buffer past
    // the display (pointless — CSS would just downscale it again).
    const bufW = Math.min(dispW, maxLogicalW);
    const bufH = Math.max(1, Math.round(bufW / a));

    return { dispW, dispH, bufW, bufH };
}

// Node-only export for unit tests (see gameLogic.js for the shim rationale).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeCanvasBox, MAX_LOGICAL_WIDTH };
}
