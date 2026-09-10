import test from 'node:test';
import assert from 'node:assert/strict';
import { createAxisTransactionController } from './transaction.js';

test('commit writes calendar then almanac with the same chat guard', async () => {
    const writes = [];
    const controller = createAxisTransactionController({
        chatId: () => 'c1',
        items: () => [],
        conflicts: () => [],
        getCalDescKey: () => ({ kind: 'caldesc' }),
        getAlmanacKey: () => ({ kind: 'almanac' }),
        readCal: () => ({ id: 'old' }),
        readAlmanac: () => ({ items: [] }),
        writeConfirmed: async (key, value) => {
            writes.push({ key, value });
            return { ok: true };
        },
    });
    const result = await controller.commit({ kind: 'gregorian', id: 'new' });
    assert.equal(result.ok, true);
    assert.equal(writes[0].key.kind, 'caldesc');
    assert.equal(writes[1].key.kind, 'almanac');
    assert.equal(writes[0].value.id, 'new');
});

test('commit restores the calendar if the almanac write fails', async () => {
    const writes = [];
    const controller = createAxisTransactionController({
        chatId: () => 'c1',
        items: () => [],
        conflicts: () => [],
        getCalDescKey: () => ({ kind: 'caldesc' }),
        getAlmanacKey: () => ({ kind: 'almanac' }),
        readCal: () => ({ id: 'old' }),
        readAlmanac: () => ({ items: [] }),
        writeConfirmed: async (key, value) => {
            writes.push({ key, value });
            if (key.kind === 'almanac') return { ok: false, reason: 'save-failed' };
            return { ok: true };
        },
    });
    const result = await controller.commit({ kind: 'gregorian', id: 'new' });
    assert.equal(result.ok, false);
    assert.equal(writes.at(-1).key.kind, 'caldesc');
    assert.equal(writes.at(-1).value.id, 'old');
});
