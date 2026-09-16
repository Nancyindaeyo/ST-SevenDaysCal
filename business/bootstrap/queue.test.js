import test from 'node:test';
import assert from 'node:assert/strict';
import { booksAreEmpty, bootstrapStepActivity, planBootstrapSteps, automationAllowed, storyClockAllowed } from './queue.js';
import { createBootstrapFeature } from './feature.js';

test('empty books queue outline then point then lines, axis ledger and dashed only if needed', () => {
    assert.equal(booksAreEmpty({}), true);
    assert.deepEqual(planBootstrapSteps({}), ['outline', 'point', 'lines', 'axis']);
    assert.deepEqual(planBootstrapSteps({
        hasOutline: false, hasPoint: false, hasLines: false,
        hasAlmanac: true, dashedEnabled: true, dashedEmpty: true,
    }), ['outline', 'point', 'lines', 'dashed']);
    assert.deepEqual(planBootstrapSteps({
        hasOutline: false, hasPoint: false, hasLines: false,
        hasAlmanac: true, ledgerCaptureEnabled: true, ledgerEmpty: true,
    }), ['outline', 'point', 'lines', 'ledger-capture']);
    assert.deepEqual(planBootstrapSteps({
        hasOutline: false, hasPoint: false, hasLines: false,
        hasAlmanac: true,
        ledgerCaptureEnabled: true, ledgerEmpty: true,
        dashedEnabled: true, dashedEmpty: true,
    }), ['outline', 'point', 'lines', 'ledger-capture', 'dashed']);
    assert.deepEqual(planBootstrapSteps({
        hasOutline: false, hasPoint: false, hasLines: false,
        ledgerCaptureEnabled: true, ledgerEmpty: false,
    }), ['outline', 'point', 'lines', 'axis']);
    assert.deepEqual(planBootstrapSteps({ hasPoint: true }), []);
});

test('empty books stop story clock and all auto jobs; later only the existing book may auto', () => {
    assert.equal(storyClockAllowed({}), false);
    assert.equal(automationAllowed('align', {}), false);
    assert.equal(automationAllowed('ledger-capture', { ledgerCaptureEnabled: true }), false);
    assert.equal(storyClockAllowed({ hasPoint: true }), true);
    assert.equal(automationAllowed('align', { hasPoint: true }), true);
    assert.equal(automationAllowed('advance', { hasPoint: true }), false);
    assert.equal(automationAllowed('advance', { hasLines: true }), true);
    assert.equal(automationAllowed('outline', { hasPoint: true }), false);
    assert.equal(automationAllowed('outline', { hasOutline: true }), true);
    assert.equal(automationAllowed('dashed', { hasLines: true, dashedEnabled: true }), true);
    assert.equal(automationAllowed('dashed', { hasLines: true }), false);
    const failed = bootstrapStepActivity('point', { outcome: 'failed', error: '点挂了' });
    assert.equal(failed.source, 'bootstrap');
    assert.equal(failed.items[0].module, 'point');
    assert.match(failed.note, /点开局生成失败/);
});

test('bootstrap stops on failure and retries the same step', async () => {
    const calls = [];
    const activities = [];
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
        onActivity: payload => activities.push(payload),
    });
    const first = await feature.start();
    assert.equal(first.status, 'failed');
    assert.deepEqual(calls, ['outline', 'point']);
    assert.equal(activities[0].source, 'bootstrap');
    assert.equal(activities[0].outcome, 'failed');
    assert.match(activities[0].note, /点开局生成失败/);
    assert.match(feature.progressHtml(), /点/);
    assert.match(feature.progressHtml(), /sp-bootstrap-retry/);
    failPoint = false;
    const second = await feature.retry();
    assert.equal(second.status, 'updated');
    assert.deepEqual(calls, ['outline', 'point', 'point', 'lines']);
});

test('bootstrap continues when ledger capture finds nothing', async () => {
    const calls = [];
    const feature = createBootstrapFeature({
        chatId: () => 'c1',
        flags: () => ({
            hasAlmanac: true,
            ledgerCaptureEnabled: true,
            ledgerEmpty: true,
            dashedEnabled: true,
            dashedEmpty: true,
        }),
        runners: {
            outline: async () => { calls.push('outline'); return { status: 'updated' }; },
            point: async () => { calls.push('point'); return { status: 'updated' }; },
            lines: async () => { calls.push('lines'); return { status: 'updated' }; },
            'ledger-capture': async () => { calls.push('ledger-capture'); return { status: 'unchanged' }; },
            dashed: async () => { calls.push('dashed'); return { status: 'updated' }; },
        },
        setProgress() {},
        toast() {},
        onDone() {},
    });
    const result = await feature.start();
    assert.equal(result.status, 'updated');
    assert.deepEqual(calls, ['outline', 'point', 'lines', 'ledger-capture', 'dashed']);
});
