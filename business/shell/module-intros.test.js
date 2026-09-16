import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_INTROS } from './module-intros.js';

const SIDEBAR_VIEWS = Object.freeze([
    'schedule', 'almanac', 'lines', 'outline', 'space', 'theater', 'anchor', 'slip', 'law', 'stage', 'lamp',
]);

test('module intros cover every sidebar view', () => {
    assert.deepEqual(Object.keys(MODULE_INTROS).sort(), [...SIDEBAR_VIEWS].sort());
    for (const view of SIDEBAR_VIEWS) {
        assert.equal(typeof MODULE_INTROS[view], 'string');
        assert.ok(MODULE_INTROS[view].length > 40, view);
    }
});

test('lamp stage space intros keep current copy and svg keys', () => {
    assert.match(MODULE_INTROS.lamp, /冲突/);
    assert.match(MODULE_INTROS.lamp, /搜索/);
    assert.match(MODULE_INTROS.lamp, /<svg/);
    assert.match(MODULE_INTROS.stage, /本轮拍/);
    assert.match(MODULE_INTROS.stage, /<svg/);
    assert.match(MODULE_INTROS.space, /交给灯/);
    assert.match(MODULE_INTROS.space, /回间写清/);
    assert.match(MODULE_INTROS.anchor, /<svg/);
    assert.doesNotMatch(MODULE_INTROS.space, /应用到点/);
});
