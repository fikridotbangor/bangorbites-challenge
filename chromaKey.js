// chromaKey.js - Green-screen keying for the explosion effect video.
//
// Kept as a pure pixel operation (no DOM) so it can be unit-tested with Node.
// main.js draws each explosion-video frame into an offscreen canvas, hands the
// ImageData buffer here to punch out the green background, then blits the result
// onto the play-area overlay canvas.

// Mutates `data` (an RGBA Uint8ClampedArray / array) in place:
//  - pixels where green clearly dominates become fully transparent (keyed out)
//  - near-black pixels are ALSO keyed out. Effect clips carry a black lead-in/tail
//    frame (and seeking to currentTime=0 lands on one); green-only keying left
//    those solid, showing as a black box behind the blast. Explosions are bright,
//    so dropping near-black is safe and just gives the edges a soft fade.
//  - remaining pixels get mild green-spill suppression so the explosion doesn't
//    keep a green halo around its edges.
// Thresholds are tunable via opts (source green measured at ~[90,229,0]).
function chromaKeyGreen(data, opts = {}) {
    const gMin = opts.gMin != null ? opts.gMin : 80;       // green channel floor
    const gDom = opts.gDom != null ? opts.gDom : 40;       // green must beat max(r,b) by this much
    const blackMax = opts.blackMax != null ? opts.blackMax : 45; // brightest channel below this = background black
    const keyBlack = opts.keyBlack !== false;              // default on
    const suppressSpill = opts.suppressSpill !== false;    // default on

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const mx = r > b ? r : b;          // brighter of the non-green channels
        const maxc = g > mx ? g : mx;      // brightest channel overall

        if (g > gMin && (g - mx) > gDom) {
            data[i + 3] = 0; // green background → transparent
        } else if (keyBlack && maxc < blackMax) {
            data[i + 3] = 0; // near-black background / lead-in frame → transparent
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
