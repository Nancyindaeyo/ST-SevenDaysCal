import test from 'node:test';
import assert from 'node:assert/strict';
import { createFloorAutomationRerunner } from './reroll.js';

test('same-floor automations roll back in reverse order and rerun forward', async () => {
    const calls = [];
    const plan = source => ({
        source,
        restore: async () => { calls.push(`undo:${source}`); return { status: 'updated' }; },
        run: async () => { calls.push(`run:${source}`); },
    });
    const rerunner = createFloorAutomationRerunner({
        chatId: () => 'chat',
        latestFloor: () => 8,
        floorSignature: () => 'new-swipe',
        plans: () => [plan('align'), plan('advance'), plan('ledger-capture'), plan('ledger-judge')],
        remember: () => calls.push('remember'),
    });

    const result = await rerunner.run(8);
    assert.equal(result.status, 'updated');
    assert.deepEqual(calls, [
        'undo:ledger-judge',
        'undo:ledger-capture',
        'undo:advance',
        'undo:align',
        'run:align',
        'run:advance',
        'run:ledger-capture',
        'run:ledger-judge',
        'remember',
    ]);
});

test('rerunner blocks only diverged tasks and deduplicates one swipe signature', async () => {
    const calls = [];
    const rerunner = createFloorAutomationRerunner({
        chatId: () => 'chat',
        latestFloor: () => 3,
        floorSignature: () => 'same',
        plans: () => [
            { source: 'dashed', label: '冷知识', restore: async () => ({ status: 'diverged' }), run: async () => calls.push('dashed') },
            { source: 'outline', restore: async () => ({ status: 'unchanged' }), run: async () => calls.push('outline') },
        ],
        toast: message => calls.push(message),
    });

    const first = await rerunner.run(3);
    const second = await rerunner.run(3);
    assert.deepEqual(first.blocked, ['dashed']);
    assert.deepEqual(first.rerun, ['outline']);
    assert.equal(calls.includes('outline'), true);
    assert.equal(calls.includes('dashed'), false);
    assert.match(calls[0], /冷知识/);
    assert.equal(second.reason, 'duplicate');
});
