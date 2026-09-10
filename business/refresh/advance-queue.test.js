import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvanceQueue } from './advance-queue.js';

test('推进队列按 shift → fill → lines 分开跑', async () => {
    const calls = [];
    const queue = createAdvanceQueue({
        plan: () => ['shift', 'fill', 'lines'],
        shift: () => { calls.push('shift'); return true; },
        fill: async () => { calls.push('fill'); return { status: 'updated' }; },
        lines: async () => { calls.push('lines'); return { status: 'updated' }; },
    });
    const result = await queue.run({ trigger: 'manual' });
    assert.deepEqual(calls, ['shift', 'fill', 'lines']);
    assert.equal(result.results.length, 3);
});

test('忙着时不重入', async () => {
    let release;
    const queue = createAdvanceQueue({
        plan: () => ['lines'],
        lines: () => new Promise(resolve => { release = resolve; }),
    });
    const first = queue.run();
    const second = await queue.run();
    assert.equal(second.status, 'skipped');
    release({ status: 'updated' });
    assert.equal((await first).status, 'updated');
});

test('日期制推进在忙时记下，结束后再跑', async () => {
    const calls = [];
    let release;
    const queue = createAdvanceQueue({
        plan: () => ['lines'],
        lines: options => {
            calls.push(options.messageId);
            if (options.messageId === 1) return new Promise(resolve => { release = resolve; });
            return { status: 'updated' };
        },
    });
    const first = queue.run({ trigger: 'date', messageId: 1 });
    const skipped = await queue.run({ trigger: 'date', messageId: 2 });
    assert.equal(skipped.status, 'skipped');
    release({ status: 'updated' });
    await first;
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(calls, [1, 2]);
});
