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
    const queued = queue.run({ trigger: 'date', messageId: 2 });
    release({ status: 'updated' });
    assert.equal((await first).status, 'updated');
    assert.equal((await queued).status, 'updated');
    assert.deepEqual(calls, [1, 2]);
});

test('日期制推进只补跑最新日期，并明确结算被覆盖的请求', async () => {
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
    const second = queue.run({ trigger: 'date', messageId: 2 });
    const third = queue.run({ trigger: 'date', messageId: 3 });
    assert.deepEqual(await second, { status: 'skipped', reason: 'superseded', supersededBy: 3 });
    release({ status: 'updated' });
    await first;
    assert.equal((await third).status, 'updated');
    assert.deepEqual(calls, [1, 3]);
});

test('补跑异常转成失败结果并上报，不产生未处理拒绝', async () => {
    const errors = [];
    let release;
    const queue = createAdvanceQueue({
        plan: () => ['lines'],
        lines: options => {
            if (options.messageId === 1) return new Promise(resolve => { release = resolve; });
            throw new Error('retry failed');
        },
        onError: (error, options) => errors.push([error.message, options.messageId]),
    });
    const first = queue.run({ trigger: 'date', messageId: 1 });
    const retry = queue.run({ trigger: 'date', messageId: 2 });
    release({ status: 'updated' });
    await first;
    const result = await retry;
    assert.equal(result.status, 'failed');
    assert.equal(result.error.message, 'retry failed');
    assert.deepEqual(errors, [['retry failed', 2]]);
    assert.equal(queue.busy, false);
});
