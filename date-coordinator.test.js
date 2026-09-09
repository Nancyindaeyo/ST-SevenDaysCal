import test from 'node:test';
import assert from 'node:assert/strict';
import { createDateCoordinator } from './date-coordinator.js';

const key = {
    chatId: 'c1',
    messageId: 2,
    swipeId: 0,
    contentSignature: 'sig',
};

test('failed date results can be retried on the same render key', async () => {
    const coordinator = createDateCoordinator();
    let calls = 0;
    const first = await coordinator.runOnce(key, async () => {
        calls += 1;
        return { status: 'failed' };
    });
    assert.equal(first.status, 'failed');
    const second = await coordinator.runOnce(key, async () => {
        calls += 1;
        return { status: 'ok', date: { month: 3, day: 4 } };
    });
    assert.equal(calls, 2);
    assert.equal(second.date.day, 4);
});

test('successful dates stay cached while in-flight work is reused', async () => {
    const coordinator = createDateCoordinator();
    let calls = 0;
    const pending = coordinator.runOnce(key, async () => {
        calls += 1;
        await new Promise(resolve => setTimeout(resolve, 20));
        return { status: 'ok', date: { month: 1, day: 2 } };
    });
    const parallel = await coordinator.runOnce(key, async () => {
        calls += 1;
        return { status: 'ok', date: { month: 9, day: 9 } };
    });
    const first = await pending;
    assert.equal(calls, 1);
    assert.equal(first.date.month, 1);
    assert.equal(parallel.date.month, 1);
    const again = await coordinator.runOnce(key, async () => {
        calls += 1;
        return { status: 'ok', date: { month: 8, day: 8 } };
    });
    assert.equal(calls, 1);
    assert.equal(again.date.month, 1);
});

test('ensureResolved retries after a failed previous result', async () => {
    const coordinator = createDateCoordinator();
    await coordinator.runOnce(key, async () => ({ status: 'failed' }));
    const resolved = await coordinator.ensureResolved(key, {
        resolve: async () => ({ status: 'ok', date: { month: 5, day: 6 } }),
    });
    assert.equal(resolved.date.month, 5);
});
