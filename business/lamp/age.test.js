import test from 'node:test';
import assert from 'node:assert/strict';
import { lampAgeOf } from './age.js';
import { checkLatestStory } from './story-check.js';
import { ALIGN_WINDOW_DEFAULT, buildAlignStoryWindow, listAiStoryFloors } from './story-window.js';
import { dismissLampPair, filterDismissedConflicts, markLampAligned, readLampState } from './state.js';
import { itemsFromAlignPreview } from './preview.js';

test('age copy names latest floor and how long since align', () => {
    assert.match(lampAgeOf({ latestFloor: 12, lastAlignFloor: 2 }).copy, /#12/);
    assert.match(lampAgeOf({ latestFloor: 12, lastAlignFloor: 2 }).copy, /过了 10 楼/);
    assert.match(lampAgeOf({}).copy, /还没有对齐过/);
    assert.equal(lampAgeOf({ latestFloor: 5, lastAlignFloor: 5 }).floorsSinceAlign, 0);
});

test('story check flags stay vs outing and already-happened titles', () => {
    const stale = checkLatestStory({
        days: [{ dayNumber: 1, events: [{ title: '在家养伤', location: '旧宅', desc: '卧床' }, { title: '午间体检', desc: '去医院' }] }],
        lines: [{ name: '今夜赴约', when: '今夜', stage: '成形' }],
        story: '已经出城办完体检。次日清晨才回。',
    });
    assert.ok(stale.some(item => item.id === 'stale-point:在家养伤'));
    assert.ok(stale.some(item => item.id === 'stale-line:今夜赴约'));
    assert.deepEqual(checkLatestStory({ days: [{ dayNumber: 1, events: [{ title: '在家养伤' }] }], story: '' }), []);
});

test('align window keeps floors after last align and caps at 12', () => {
    const chat = [
        { is_user: true, mes: '问' },
        { is_user: false, mes: '一楼' },
        { is_user: false, mes: '二楼' },
        { is_system: true, mes: '系统' },
        { is_user: false, mes: '三楼' },
        { is_user: false, mes: '四楼' },
    ];
    const floors = listAiStoryFloors(chat, text => text);
    assert.deepEqual(floors.map(item => item.text), ['一楼', '二楼', '三楼', '四楼']);
    const window = buildAlignStoryWindow(floors, { afterFloor: 2 });
    assert.equal(window.count, 2);
    assert.match(window.text, /第 4 楼/);
    assert.doesNotMatch(window.text, /一楼/);
    const fresh = buildAlignStoryWindow(floors, { afterFloor: -1, fallback: ALIGN_WINDOW_DEFAULT });
    assert.equal(fresh.count, 4);
    const capped = buildAlignStoryWindow(
        Array.from({ length: 20 }, (_, i) => ({ index: i, text: `楼${i}` })),
        { afterFloor: -1, max: 12, fallback: 20 },
    );
    assert.equal(capped.count, 12);
    assert.equal(capped.from, 8);
});

test('dismissed pairs stay out of the conflict list and last align floor persists', () => {
    const stay = { id: 'stay-outing', pairId: 'stay-outing|lines|今夜赴约|point|在家养伤', title: '今夜赴约' };
    const next = dismissLampPair({}, stay.pairId);
    assert.deepEqual(filterDismissedConflicts([stay, { id: 'bbb-place', pairId: 'bbb-place|x', title: '旧宅' }], next.dismissed).map(item => item.id), ['bbb-place']);
    assert.equal(markLampAligned(next, 9).lastAlignFloor, 9);
    assert.equal(readLampState({ dismissed: ['', 'a', 'a'] }).dismissed.join(','), 'a');
});

test('preview items keep align actions as readable details', () => {
    const items = itemsFromAlignPreview({
        items: [
            { module: 'point', title: '体检', action: 'complete', ref: 'e1' },
            { module: 'lines', title: '赴约', action: 'stall' },
        ],
    });
    assert.equal(items[0].source, 'preview');
    assert.match(items[0].detail, /拿掉/);
    assert.equal(items[1].id, 'preview:lines:赴约');
});
