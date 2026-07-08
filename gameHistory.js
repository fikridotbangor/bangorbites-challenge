// gameHistory.js - Persists finished games to localStorage.
//
// Foundation for a richer history / leaderboard view later; intentionally
// minimal for now. Kept as a standalone, dependency-free object so it can be
// unit-tested with a mock storage (see gameHistory.test.js) and reused as a
// browser global from the <script> tag, mirroring gameLogic/chromaKey.

const GAME_HISTORY_KEY = 'bangorBitesHistory';
const GAME_HISTORY_LIMIT = 20; // keep only the most recent N games (booth-friendly)

const GameHistory = {
    // Resolve the storage backend. Callers may pass one explicitly (tests); we
    // fall back to the browser localStorage, or null when neither exists so the
    // methods degrade to no-ops instead of throwing.
    _store(storage) {
        if (storage) return storage;
        return typeof localStorage !== 'undefined' ? localStorage : null;
    },

    // Load the saved history, newest first. Returns [] on missing/corrupt data
    // (a bad JSON blob shouldn't crash the game — start clean instead).
    load(storage) {
        const store = this._store(storage);
        if (!store) return [];
        try {
            const raw = store.getItem(GAME_HISTORY_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    },

    // Prepend one finished-game record and cap the list at GAME_HISTORY_LIMIT.
    // `entry` = { score, result, difficulty, target, date }. Returns the new list.
    add(entry, storage) {
        const store = this._store(storage);
        const list = this.load(store);
        list.unshift(entry); // newest first
        const capped = list.slice(0, GAME_HISTORY_LIMIT);
        if (store) store.setItem(GAME_HISTORY_KEY, JSON.stringify(capped));
        return capped;
    },

    clear(storage) {
        const store = this._store(storage);
        if (store && store.removeItem) store.removeItem(GAME_HISTORY_KEY);
    },
};

// Node-only export for unit tests (see gameLogic.js for the same shim rationale).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameHistory, GAME_HISTORY_KEY, GAME_HISTORY_LIMIT };
}
