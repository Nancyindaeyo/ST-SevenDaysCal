import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfirmOptions } from './modal.js';

test('confirm options accept title/body object or two strings', () => {
    assert.deepEqual(normalizeConfirmOptions({ title: '删', body: '确定？' }), { title: '删', body: '确定？' });
    assert.deepEqual(normalizeConfirmOptions('删除草稿', '确定删除这条小剧场草稿吗？'), {
        title: '删除草稿',
        body: '确定删除这条小剧场草稿吗？',
    });
    assert.deepEqual(normalizeConfirmOptions('删除草稿'), { title: '删除草稿', body: '' });
    assert.deepEqual(normalizeConfirmOptions(undefined), {});
});
