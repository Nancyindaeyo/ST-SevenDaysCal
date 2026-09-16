import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerSourceFingerprint, reconcileLedgerEntries } from './reconcile.js';

const date = { month: 3, day: 1 };
const signature = '角色说了一句要还钱';

test('deleting a middle floor remaps the source floor by fingerprint body', () => {
    const oldFp = ledgerSourceFingerprint('F4S', signature, { floor: 4, date });
    const newFp = ledgerSourceFingerprint('F3S', signature, { floor: 3, date });
    const result = reconcileLedgerEntries([{
        id: 'L1',
        起始锚: { 楼层: 4, 历日期: date, 来源指纹: oldFp },
    }], [{
        token: 'F3S',
        floor: 3,
        date,
        signature,
        fingerprint: newFp,
    }], 8);
    assert.equal(result.entries[0].起始锚.楼层, 3);
    assert.equal(result.entries[0].起始锚.来源指纹, newFp);
    assert.equal(result.summary.remapped, 1);
    assert.equal(result.summary.dispositions.L1, 'remap');
    assert.equal(result.entries[0].来源状态, undefined);
});

test('a still-valid floor without a matching source stays pending; locked missing is 来源已删除', () => {
    const pending = reconcileLedgerEntries([{
        id: 'L2',
        起始锚: { 楼层: 2, 历日期: date, 来源指纹: 'sfp-missing' },
    }], [], 6);
    assert.equal(pending.entries[0].来源状态, '待确认');
    assert.equal(pending.summary.pending, 1);
    assert.equal(pending.summary.dispositions.L2, 'pending');

    const locked = reconcileLedgerEntries([{
        id: 'L3',
        锁: '用户锁',
        起始锚: { 楼层: 2, 历日期: date, 来源指纹: 'sfp-missing' },
    }], [], 6);
    assert.equal(locked.entries[0].来源状态, '来源已删除');
    assert.equal(locked.entries[0].起始锚.楼层, null);
    assert.equal(locked.summary.lockedMissing, 1);
    assert.equal(locked.summary.dispositions.L3, 'keep');
});
