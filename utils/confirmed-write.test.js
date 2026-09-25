import test from 'node:test';
import assert from 'node:assert/strict';
import { clearLastConfirmedWrite, lastConfirmedWriteSnapshot, rememberConfirmedWrite } from './confirmed-write.js';

test('confirmed write tracker only records ok+confirmed results', () => {
    clearLastConfirmedWrite();
    rememberConfirmedWrite({ ok: false, commitState: 'unknown', reason: 'unknown' });
    assert.equal(lastConfirmedWriteSnapshot(), null);
    rememberConfirmedWrite({ ok: true, commitState: 'confirmed', reason: 'saveMetadata-promise-resolved' }, { at: 1700000000000 });
    assert.deepEqual(lastConfirmedWriteSnapshot(), {
        at: 1700000000000,
        reason: 'saveMetadata-promise-resolved',
        commitState: 'confirmed',
    });
    rememberConfirmedWrite({ ok: false, commitState: 'not-dispatched' });
    assert.equal(lastConfirmedWriteSnapshot().at, 1700000000000);
});
