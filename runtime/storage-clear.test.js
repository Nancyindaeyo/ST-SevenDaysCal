import test from 'node:test';
import assert from 'node:assert/strict';
import {
    dispatchStoreClearInvalidate,
    dispatchStoreClearRefreshAfter,
    dispatchStoreClearRefreshFromStore,
    STORE_CLEAR_EMPTY_LINES_HTML,
    STORE_CLEAR_EMPTY_SCHEDULE_HTML,
} from './storage-clear.js';

function envSpy() {
    const calls = [];
    const push = name => (...args) => calls.push([name, ...args]);
    return {
        calls,
        trace: push('trace'),
        abortSchedule: push('abortSchedule'),
        invalidateOutline: push('invalidateOutline'),
        abortLines: push('abortLines'),
        invalidateSpace: push('invalidateSpace'),
        abortDashed: push('abortDashed'),
        refreshScheduleEmpty: push('refreshScheduleEmpty'),
        refreshOutlineEmpty: push('refreshOutlineEmpty'),
        refreshLinesEmpty: push('refreshLinesEmpty'),
        refreshDashed: push('refreshDashed'),
        refreshCreativeEmpty: push('refreshCreativeEmpty'),
        refreshSpaceEmpty: push('refreshSpaceEmpty'),
        refreshScheduleFromStore: push('refreshScheduleFromStore'),
        refreshOutlineFromStore: push('refreshOutlineFromStore'),
        refreshLinesFromStore: push('refreshLinesFromStore'),
        refreshCreativeFromStore: push('refreshCreativeFromStore'),
        refreshSpaceFromStore: push('refreshSpaceFromStore'),
        refreshDashedFromStore: push('refreshDashedFromStore'),
    };
}

test('store-clear invalidate routes kinds without mixing outline and lines', () => {
    const env = envSpy();
    dispatchStoreClearInvalidate('schedule', env);
    dispatchStoreClearInvalidate('creative-chat', env);
    dispatchStoreClearInvalidate('dashed', env);
    assert.deepEqual(env.calls, [
        ['trace', 'schedule'],
        ['abortSchedule'],
        ['trace', 'creative-chat'],
        ['invalidateOutline', 'creative-chat'],
        ['trace', 'dashed'],
        ['abortDashed'],
    ]);
});

test('successful kind clear paints empty editors; rollback rereads store', () => {
    const after = envSpy();
    dispatchStoreClearRefreshAfter('schedule', after);
    dispatchStoreClearRefreshAfter('lines', after);
    assert.deepEqual(after.calls.map(row => row[0]), ['refreshScheduleEmpty', 'refreshLinesEmpty']);
    const from = envSpy();
    dispatchStoreClearRefreshFromStore('schedule', from);
    dispatchStoreClearRefreshFromStore('dashed', from);
    assert.deepEqual(from.calls.map(row => row[0]), ['refreshScheduleFromStore', 'refreshDashedFromStore']);
    assert.match(STORE_CLEAR_EMPTY_SCHEDULE_HTML, /sp-gen-schedule-now/);
    assert.match(STORE_CLEAR_EMPTY_LINES_HTML, /sp-gen-lines-now/);
});
