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

function anchorFailureHarness({ failRollback = false } = {}) {
    const writes = [];
    const anchors = [];
    const oldCalendar = { id: 'old-calendar' };
    const oldAlmanac = { items: [{ id: 'old-item' }] };
    const controller = createAxisTransactionController({
        chatId: () => 'c1',
        captureParticipantIdentity: () => ({ id: 'p1' }),
        sameParticipantIdentity: (a, b) => a.id === b.id,
        items: () => [],
        conflicts: () => [],
        charKey: () => 'char-1',
        anchor: () => ({ month: 13, day: 40 }),
        monthCount: () => 12,
        monthDays: () => 31,
        choose: async () => 'fix',
        getCalDescKey: () => ({ kind: 'caldesc' }),
        getAlmanacKey: () => ({ kind: 'almanac' }),
        readCal: () => oldCalendar,
        readAlmanac: () => oldAlmanac,
        writeConfirmed: async (key, value) => {
            writes.push({ key, value });
            if (failRollback && key.kind === 'almanac' && value === oldAlmanac) return { ok: false, reason: 'rollback-save-failed' };
            return { ok: true };
        },
        setAnchor: (_key, month, day) => {
            anchors.push([month, day]);
            return { ok: anchors.length > 1 };
        },
    });
    return { controller, writes, anchors, oldCalendar, oldAlmanac };
}

test('anchor save failure restores anchor, almanac, and calendar', async () => {
    const harness = anchorFailureHarness();
    const result = await harness.controller.commit({ id: 'new-calendar' });
    assert.deepEqual(result, {
        ok: false,
        reason: 'anchor-save-failed',
        error: '当前聊天无法写入日期锚点',
        rolledBack: true,
    });
    assert.deepEqual(harness.anchors, [[12, 31], [13, 40]]);
    assert.equal(harness.writes.at(-2).value, harness.oldAlmanac);
    assert.equal(harness.writes.at(-1).value, harness.oldCalendar);
});

test('anchor transaction exposes an incomplete rollback instead of hiding it', async () => {
    const harness = anchorFailureHarness({ failRollback: true });
    const result = await harness.controller.commit({ id: 'new-calendar' });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'rollback-failed');
    assert.equal(result.rollback.anchor.ok, true);
    assert.equal(result.rollback.almanac.ok, false);
    assert.equal(result.rollback.calendar.ok, true);
});
