import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isRestoreWriteConfirmed,
    normalizeRestoreWriteResult,
    restoreFailureReason,
    snapshotHasModule,
} from './write-result.js';

test('restore writer contract maps boolean, void, confirmed, stale and unknown results', () => {
    assert.deepEqual(normalizeRestoreWriteResult(true), {
        ok: true, stale: false, commitState: 'confirmed', reason: 'legacy-true',
    });
    assert.equal(isRestoreWriteConfirmed(normalizeRestoreWriteResult(undefined)), true);
    assert.equal(isRestoreWriteConfirmed(normalizeRestoreWriteResult(false)), false);
    assert.equal(isRestoreWriteConfirmed(normalizeRestoreWriteResult({ ok: true, commitState: 'confirmed' })), true);
    assert.equal(isRestoreWriteConfirmed(normalizeRestoreWriteResult({ ok: true, stale: true, commitState: 'confirmed', reason: 'committed-but-stale' })), false);
    assert.equal(isRestoreWriteConfirmed(normalizeRestoreWriteResult({ ok: true, commitState: 'unknown' })), false);
    assert.equal(isRestoreWriteConfirmed(normalizeRestoreWriteResult({ ok: false, reason: 'cas-rejected', commitState: 'not-dispatched' })), false);
    assert.equal(restoreFailureReason({
        point: normalizeRestoreWriteResult({ ok: true, commitState: 'confirmed' }),
        lines: normalizeRestoreWriteResult({ ok: true, stale: true, commitState: 'confirmed', reason: 'committed-but-stale' }),
    }), 'stale');
});

test('snapshot module presence treats empty dashed lists as present', () => {
    assert.equal(snapshotHasModule({ dashed: [] }, 'dashed'), true);
    assert.equal(snapshotHasModule({ outline: { raw: '', cursor: 0 } }, 'outline'), true);
    assert.equal(snapshotHasModule({ ledger: { entries: [], seq: 0 } }, 'ledger'), true);
    assert.equal(snapshotHasModule({ point: '' }, 'point'), true);
    assert.equal(snapshotHasModule({}, 'lines'), false);
});
