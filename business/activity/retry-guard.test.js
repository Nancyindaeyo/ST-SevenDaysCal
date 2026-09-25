import test from 'node:test';
import assert from 'node:assert/strict';
import { dryRunRouteCard, retryNeedsConfirm, unprocessedFailures } from './retry-guard.js';
import { explainJumpMiss } from './jump.js';

test('retry after ledger or book change needs confirm', () => {
    const entry = { after: { ledger: { n: 1 }, point: 'a' } };
    assert.equal(retryNeedsConfirm(entry, { ledger: { n: 1 }, point: 'a' }).needed, false);
    assert.deepEqual(retryNeedsConfirm(entry, { ledger: { n: 2 }, point: 'a' }).reasons, ['ledger-changed']);
    assert.ok(retryNeedsConfirm(entry, { ledger: { n: 1 }, point: 'b' }).reasons.includes('point-changed'));
});

test('unprocessed failures can be filtered by floor', () => {
    const entries = [
        { id: '1', outcome: 'failed', floorId: 3 },
        { id: '2', outcome: 'failed', floorId: 4, undone: true },
        { id: '3', outcome: 'patched', floorId: 3 },
        { id: '4', outcome: 'failed', floorId: 5 },
    ];
    assert.deepEqual(unprocessedFailures(entries).map(item => item.id), ['1', '4']);
    assert.deepEqual(unprocessedFailures(entries, { floorId: 3 }).map(item => item.id), ['1']);
});

test('dry-run card reports api, modules and token tier', () => {
    const card = dryRunRouteCard({
        route: { status: 'configured', presetName: '便宜模型' },
        selected: ['point', 'lines'],
        promptChars: 8000,
    });
    assert.equal(card.api, '便宜模型');
    assert.deepEqual(card.selected, ['point', 'lines']);
    assert.equal(card.tokenTier, 'M');
});

test('jump miss explains deleted, renamed and chat mismatch', () => {
    assert.equal(explainJumpMiss({
        item: { ref: 'LINE-1', title: '旧名' },
        catalog: [{ id: 'LINE-1', name: '新名' }],
    }).reason, 'renamed');
    assert.equal(explainJumpMiss({
        item: { ref: 'LINE-2', title: '已删' },
        catalog: [{ id: 'LINE-1', name: '还在' }],
    }).reason, 'deleted');
    assert.equal(explainJumpMiss({
        item: { ref: 'LINE-1', title: '线' },
        catalog: [{ id: 'LINE-1', name: '线' }],
        chatRevision: 1,
        currentRevision: 2,
    }).reason, 'chat-mismatch');
});
