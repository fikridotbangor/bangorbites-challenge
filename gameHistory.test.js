// gameHistory.test.js - Unit tests for GameHistory. Run with: node --test
//
// Uses Node's built-in test runner + a fresh mock storage per test so we never
// touch a real localStorage and each case starts clean.

const { test } = require('node:test');
const assert = require('node:assert');

const { GameHistory, GAME_HISTORY_KEY, GAME_HISTORY_LIMIT } = require('./gameHistory.js');

// Minimal localStorage-shaped mock (getItem/setItem/removeItem over a plain map).
function makeStore(initial) {
    return {
        _s: initial ? { ...initial } : {},
        getItem(k) { return k in this._s ? this._s[k] : null; },
        setItem(k, v) { this._s[k] = String(v); },
        removeItem(k) { delete this._s[k]; },
    };
}

function entry(score, result = 'timeout') {
    return { score, result, difficulty: 'medium', target: 30, date: '2026-07-08T10:00:00.000Z' };
}

test('load returns [] when nothing is stored', () => {
    const store = makeStore();
    assert.deepStrictEqual(GameHistory.load(store), []);
});

test('add stores an entry and load reads it back', () => {
    const store = makeStore();
    GameHistory.add(entry(12), store);
    const list = GameHistory.load(store);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].score, 12);
    assert.strictEqual(list[0].result, 'timeout');
});

test('add prepends — newest game is first', () => {
    const store = makeStore();
    GameHistory.add(entry(1), store);
    GameHistory.add(entry(2), store);
    GameHistory.add(entry(3), store);
    const list = GameHistory.load(store);
    assert.deepStrictEqual(list.map(e => e.score), [3, 2, 1]);
});

test('add caps the list at GAME_HISTORY_LIMIT, dropping the oldest', () => {
    const store = makeStore();
    // Push one more than the limit; scores 0..LIMIT.
    for (let i = 0; i <= GAME_HISTORY_LIMIT; i++) {
        GameHistory.add(entry(i), store);
    }
    const list = GameHistory.load(store);
    assert.strictEqual(list.length, GAME_HISTORY_LIMIT, 'never grows past the cap');
    assert.strictEqual(list[0].score, GAME_HISTORY_LIMIT, 'newest kept');
    // Oldest (score 0) was dropped; the tail is score 1.
    assert.strictEqual(list[list.length - 1].score, 1, 'oldest dropped');
});

test('clear empties the history', () => {
    const store = makeStore();
    GameHistory.add(entry(5), store);
    GameHistory.clear(store);
    assert.deepStrictEqual(GameHistory.load(store), []);
});

test('load returns [] on corrupt JSON instead of throwing', () => {
    const store = makeStore({ [GAME_HISTORY_KEY]: '{not valid json' });
    assert.doesNotThrow(() => GameHistory.load(store));
    assert.deepStrictEqual(GameHistory.load(store), []);
});

test('load returns [] when the stored value is not an array', () => {
    const store = makeStore({ [GAME_HISTORY_KEY]: '{"score":1}' });
    assert.deepStrictEqual(GameHistory.load(store), []);
});

test('methods degrade to no-ops when no storage is available', () => {
    // Explicit null-ish: pass a storage of null and ensure no throw. (In the
    // browser the real localStorage is used; here we just prove it fails safe.)
    assert.deepStrictEqual(GameHistory.load(null), []);
    assert.doesNotThrow(() => GameHistory.clear(null));
    // add without a store still returns the computed (unpersisted) list.
    const list = GameHistory.add(entry(9), null);
    assert.strictEqual(list[0].score, 9);
});
