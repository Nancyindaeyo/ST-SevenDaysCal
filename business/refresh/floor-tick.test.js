import test from 'node:test';
import assert from 'node:assert/strict';
import { createFloorTicker, tickFloorGate } from './floor-tick.js';

test('floor gate skips seen floors, holds the counter when blocked, then fires on interval', () => {
    const seen = tickFloorGate({ lastFloor: 4, counter: 1, messageId: 4, interval: 3 });
    assert.equal(seen.status, 'skipped');
    assert.equal(seen.reason, 'seen');
    assert.equal(seen.lastFloor, 4);
    assert.equal(seen.counter, 1);

    const blocked = tickFloorGate({ lastFloor: 4, counter: 1, messageId: 5, interval: 3, blocked: true });
    assert.equal(blocked.status, 'skipped');
    assert.equal(blocked.reason, 'blocked');
    assert.equal(blocked.lastFloor, 5);
    assert.equal(blocked.counter, 1);

    const waiting = tickFloorGate({ lastFloor: 5, counter: 1, messageId: 6, interval: 3 });
    assert.equal(waiting.status, 'skipped');
    assert.equal(waiting.reason, 'interval');
    assert.equal(waiting.lastFloor, 6);
    assert.equal(waiting.counter, 2);

    const due = tickFloorGate({ lastFloor: 6, counter: 2, messageId: 7, interval: 3 });
    assert.equal(due.status, 'due');
    assert.equal(due.lastFloor, 7);
    assert.equal(due.counter, 0);
});

test('ticker hydrate/reset keep lastFloor and counter in lockstep with ticks', () => {
    const ticker = createFloorTicker();
    ticker.hydrate({ lastFloor: 2, counter: 1 });
    assert.deepEqual(ticker.state(), { lastFloor: 2, counter: 1 });

    assert.equal(ticker.tick(3, { interval: 3 }).reason, 'interval');
    ticker.resetCounter();
    assert.deepEqual(ticker.state(), { lastFloor: 3, counter: 0 });

    ticker.reset({ lastFloor: 9 });
    assert.deepEqual(ticker.state(), { lastFloor: 9, counter: 0 });
    assert.equal(ticker.tick(9, { interval: 1 }).reason, 'seen');
});

test('same-floor option heals lastFloor without incrementing the ticker', () => {
    const ticker = createFloorTicker();
    ticker.hydrate({ lastFloor: 4, counter: 2 });
    assert.equal(ticker.tick(7, { interval: 3, sameFloor: true }).reason, 'seen');
    assert.deepEqual(ticker.state(), { lastFloor: 7, counter: 2 });
    assert.equal(ticker.tick(8, { interval: 3 }).status, 'due');
    assert.deepEqual(ticker.state(), { lastFloor: 8, counter: 0 });
});
