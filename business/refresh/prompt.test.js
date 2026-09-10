import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReconcilePrompt, buildRefreshAddon } from './prompt.js';

test('align prompt asks to refill today when Day 1 still has empty slots', () => {
    const vacant = buildReconcilePrompt({
        userName: '用户',
        charName: '角色',
        latestStory: '下午还要去体育馆协调场地。',
        pointRaw: '<calendar_widget>\nDay: 1|晴|18℃\n</calendar_widget>',
        todayGap: 3,
    });
    assert.match(vacant, /今天（Day 1）还空 3 个名额/);
    assert.match(vacant, /就必须用 point: add\|Day 1\|/);
    assert.doesNotMatch(vacant, /证据不够就不要新建/);
    const full = buildRefreshAddon({ align: true, todayGap: 0 });
    assert.match(full, /今天名额已满或没有当天格子/);
    assert.match(full, /证据不够就不要新建/);
});
