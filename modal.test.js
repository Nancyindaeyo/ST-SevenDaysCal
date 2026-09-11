import test from 'node:test';
import assert from 'node:assert/strict';
import { dialogTabTarget, normalizeConfirmOptions } from './modal.js';

test('confirm options accept title/body object or two strings', () => {
    assert.deepEqual(normalizeConfirmOptions({ title: '删', body: '确定？' }), { title: '删', body: '确定？' });
    assert.deepEqual(normalizeConfirmOptions('删除草稿', '确定删除这条小剧场草稿吗？'), {
        title: '删除草稿',
        body: '确定删除这条小剧场草稿吗？',
    });
    assert.deepEqual(normalizeConfirmOptions('删除草稿'), { title: '删除草稿', body: '' });
    assert.deepEqual(normalizeConfirmOptions(undefined), {});
});

test('dialog tab target traps both edges and recovers focus entering from outside', () => {
    const first = { id: 'first' };
    const middle = { id: 'middle' };
    const last = { id: 'last' };
    const items = [first, middle, last];
    assert.equal(dialogTabTarget(items, last, false, true), first);
    assert.equal(dialogTabTarget(items, first, true, true), last);
    assert.equal(dialogTabTarget(items, middle, false, true), null);
    assert.equal(dialogTabTarget(items, null, false, false), first);
    assert.equal(dialogTabTarget([], null, false, false), undefined);
});
