import test from 'node:test';
import assert from 'node:assert/strict';
import { booksAreEmpty, planBootstrapSteps } from './queue.js';
import { createBootstrapFeature } from './feature.js';

test('empty books queue outline then point then lines, axis and dashed only if needed', () => {
    assert.equal(booksAreEmpty({}), true);
    assert.deepEqual(planBootstrapSteps({}), ['outline', 'point', 'lines', 'axis']);
    assert.deepEqual(planBootstrapSteps({
        hasOutline: false, hasPoint: false, hasLines: false,
        hasAlmanac: true, dashedEnabled: true, dashedEmpty: true,
    }), ['outline', 'point', 'lines', 'dashed']);
    assert.deepEqual(planBootstrapSteps({ hasPoint: true }), []);
});

test('bootstrap stops on failure and retries the same step', async () => {
    const calls = [];
    let failPoint = true;
    const feature = createBootstrapFeature({
        chatId: () => 'c1',
        flags: () => ({ dashedEnabled: false, hasAlmanac: true }),
        runners: {
            outline: async () => { calls.push('outline'); return { status: 'updated' }; },
            point: async () => {
                calls.push('point');
                return failPoint ? { status: 'failed', errorMessage: '点挂了' } : { status: 'updated' };
            },
            lines: async () => { calls.push('lines'); return { status: 'updated' }; },
        },
        setProgress() {},
        toast() {},
        onDone() {},
    });
    const first = await feature.start();
    assert.equal(first.status, 'failed');
    assert.deepEqual(calls, ['outline', 'point']);
    assert.match(feature.progressHtml(), /点/);
    assert.match(feature.progressHtml(), /sp-bootstrap-retry/);
    failPoint = false;
    const second = await feature.retry();
    assert.equal(second.status, 'updated');
    assert.deepEqual(calls, ['outline', 'point', 'point', 'lines']);
});
