import test from 'node:test';
import assert from 'node:assert/strict';
import { createSameFloorGate, isSameFloorGeneration } from './same-floor.js';
import { tickFloorGate } from './floor-tick.js';

test('only regenerate and swipe count as same-floor generations', () => {
    assert.equal(isSameFloorGeneration('regenerate'), true);
    assert.equal(isSameFloorGeneration('swipe'), true);
    assert.equal(isSameFloorGeneration('normal'), false);
    assert.equal(isSameFloorGeneration('continue'), false);
});

test('gate stays pending until consumed or cleared', () => {
    const gate = createSameFloorGate();
    gate.mark('normal');
    assert.equal(gate.pending(), false);
    gate.mark('regenerate');
    assert.equal(gate.pending(), true);
    assert.equal(gate.consume(), true);
    assert.equal(gate.pending(), false);
    gate.mark('swipe');
    gate.clear();
    assert.equal(gate.pending(), false);
});

test('same-floor tick heals lastFloor without advancing the countdown', () => {
    const healed = tickFloorGate({ lastFloor: 8, counter: 1, messageId: 10, interval: 3, sameFloor: true });
    assert.equal(healed.status, 'skipped');
    assert.equal(healed.reason, 'seen');
    assert.equal(healed.lastFloor, 10);
    assert.equal(healed.counter, 1);

    const seen = tickFloorGate({ lastFloor: 10, counter: 1, messageId: 10, interval: 3, sameFloor: true });
    assert.equal(seen.lastFloor, 10);
    assert.equal(seen.counter, 1);
});
