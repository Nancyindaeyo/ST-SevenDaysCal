import test from 'node:test';
import assert from 'node:assert/strict';
import { commitLegacyMigration } from './legacy-migration.js';

const legacy = [{ key: 'old:a' }, { key: 'old:b' }];
const confirmed = { ok: true, commitState: 'confirmed' };

test('legacy migration deletes source keys only after a confirmed save', async () => {
    const calls = [];
    const result = await commitLegacyMigration({
        entries: [{ kind: 'schedule', value: { raw: 'x' } }],
        legacy,
        writeConfirmed: async entries => { calls.push(['save', entries.length]); return confirmed; },
        removeItem: key => calls.push(['remove', key]),
    });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, [['save', 1], ['remove', 'old:a'], ['remove', 'old:b']]);
});

test('legacy migration retains sources on rejection and unknown commit state', async () => {
    for (const writeConfirmed of [
        async () => { throw new Error('disk failed'); },
        async () => ({ ok: false, commitState: 'not-dispatched', reason: 'offline' }),
        async () => ({ ok: false, commitState: 'unknown', reason: 'timeout' }),
    ]) {
        const removed = [];
        const result = await commitLegacyMigration({
            legacy,
            writeConfirmed,
            removeItem: key => removed.push(key),
        });
        assert.equal(result.ok, false);
        assert.deepEqual(removed, []);
    }
});

test('legacy migration reports cleanup failure without hiding the confirmed commit', async () => {
    const removed = [];
    const result = await commitLegacyMigration({
        legacy,
        writeConfirmed: async () => confirmed,
        removeItem: key => {
            if (key === 'old:a') throw new Error('blocked');
            removed.push(key);
        },
    });
    assert.equal(result.ok, false);
    assert.equal(result.committed, true);
    assert.deepEqual(result.failedKeys, ['old:a']);
    assert.deepEqual(removed, ['old:b']);
});
