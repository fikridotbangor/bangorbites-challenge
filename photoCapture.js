// photoCapture.js — pure helpers for the photo-capture flow.
//
// Kept free of DOM/canvas/timers so they're unit-testable with node:test, matching
// the repo's other pure modules (gameLogic, gameHistory). The capture UI itself —
// live preview, countdown ticks, shutter flash, WebAudio beep — lives in main.js.

// Stamp baked onto the finished photo, chosen from the game's end reason
// (GameLogic.getEndReason(): 'win' | 'no-lives' | 'timeout').
//
// Design choice: only two visible outcomes — win vs lose — because the user asked
// for a "menang/kalah" stamp. Both loss reasons (ran out of time, ran out of lives)
// share the consolation "SANG PENANTANG" copy rather than getting distinct stamps,
// so the photo reads as a clean win/lose badge, not a play-by-play.
const CAPTURE_STAMPS = {
    win:        { text: 'JAWARA! 🔥',     color: '#8ec622', won: true },
    'no-lives': { text: 'SANG PENANTANG', color: '#ff8222', won: false },
    timeout:    { text: 'SANG PENANTANG', color: '#ff8222', won: false },
};
// Unknown/absent reason falls back to the lose stamp — never claim a win we can't prove.
const DEFAULT_STAMP = CAPTURE_STAMPS.timeout;

function captureStamp(endReason) {
    return CAPTURE_STAMPS[endReason] || DEFAULT_STAMP;
}

// Countdown ticks shown before the shutter: N, N-1, ..., 1.
// Clamped to >= 1 so a bad/zero/negative input still yields one tick rather than an
// empty sequence (which would fire the shutter instantly with no warning).
function countdownSequence(from = 3) {
    const n = Math.max(1, Math.floor(Number(from) || 0));
    const seq = [];
    for (let i = n; i >= 1; i--) seq.push(i);
    return seq;
}

// Node-only export shim (browser ignores it): lets the .test.js require these.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { captureStamp, countdownSequence, CAPTURE_STAMPS };
}
