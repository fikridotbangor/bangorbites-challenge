// chromaKey.js - Green-screen keying for the explosion effect video.
//
// Kept as a pure pixel operation (no DOM) so it can be unit-tested with Node.
// main.js draws each explosion-video frame into an offscreen canvas, hands the
// ImageData buffer here to punch out the green background, then blits the result
// onto the play-area overlay canvas.

// Mutates `data` (an RGBA Uint8ClampedArray / array) in place:
//  - pixels where green clearly dominates become fully transparent (keyed out)
//  - remaining pixels get mild green-spill suppression so the explosion doesn't
//    keep a green halo around its edges.
// Thresholds are tunable via opts because the exact green of the source clip
// couldn't be sampled here (H.264 doesn't decode in headless Chrome).
function chromaKeyGreen(data, opts = {}) {
    const gMin = opts.gMin != null ? opts.gMin : 80;   // green channel floor
    const gDom = opts.gDom != null ? opts.gDom : 40;   // green must beat max(r,b) by this much
    const suppressSpill = opts.suppressSpill !== false; // default on

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const mx = r > b ? r : b; // brighter of the non-green channels

        if (g > gMin && (g - mx) > gDom) {
            data[i + 3] = 0; // key out → transparent
        } else if (suppressSpill && g > mx) {
            // Clamp a lingering green tint down to the brighter of r/b.
            data[i + 1] = mx;
        }
    }
    return data;
}

// Node-only export for unit tests (browser has no `module`, so this is a no-op
// there and the game uses chromaKeyGreen as a global from the <script> tag).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { chromaKeyGreen };
}
