import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateBestEffortFailures, bestEffortFailureKey, noteBestEffortFailure } from './best-effort-failures.js';

test('consecutive best-effort failures collapse to one group', () => {
    const groups = aggregateBestEffortFailures([
        { event: 'best-effort-failed', status: 'rejected', module: 'ledger', reasonCode: 'ledger-inject-rescore-failed', floor: 3, ts: 1 },
        { event: 'best-effort-failed', status: 'rejected', module: 'ledger', reasonCode: 'ledger-inject-rescore-failed', floor: 4, ts: 2 },
        { event: 'request-failed', status: 'rejected', module: 'lines', reasonCode: 'timeout', ts: 3 },
        { event: 'best-effort-failed', status: 'rejected', module: 'inline', reasonCode: 'inline-window-rescore-failed', floor: 5, ts: 4 },
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].count, 2);
    assert.equal(groups[0].floorId, 4);
    assert.equal(groups[1].count, 1);
    assert.equal(bestEffortFailureKey(groups[0]), 'ledger|ledger-inject-rescore-failed');
});

test('noteBestEffortFailure writes a sanitized trace and never throws', () => {
    const events = [];
    const recorded = noteBestEffortFailure((event, meta) => {
        events.push({ event, ...meta });
        return { event, ...meta };
    }, { module: 'ledger', reasonCode: 'ledger-inject-rescore-failed', floor: 8, detail: 'boom' });
    assert.equal(recorded.event, 'best-effort-failed');
    assert.equal(recorded.status, 'rejected');
    assert.equal(events[0].level, 'best-effort');
    assert.doesNotThrow(() => noteBestEffortFailure(() => { throw new Error('trace-down'); }, { module: 'ledger' }));
});
