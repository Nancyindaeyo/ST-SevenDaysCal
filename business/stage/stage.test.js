import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildFestivalRows, collectStageSnapshot, pickDueLedger, pickNearLines, pickTodayPoint, pickUpcomingFestivals } from './snapshot.js';
import { renderStageHtml } from './ui.js';
import { createStageFeature, enterStageSidebar } from './feature.js';

test('stage snapshot keeps today, near festivals, due ledger and 近日 lines', () => {
    const snap = collectStageSnapshot({
        todayLabel: '三月三日',
        days: [
            { dayNumber: 2, events: [{ title: '后天的课' }] },
            { dayNumber: 1, events: [{ title: '体检', time: '上午', location: '医馆' }] },
        ],
        festivals: [
            { name: '花朝', days: 2 },
            { name: '太远的节', days: 40 },
            { name: '进行中的庙会', days: -1 },
        ],
        ledger: [
            { id: '1', 事由: '养伤', 类型: '持续状态' },
            { id: '2', 事由: '赴约', 类型: '约定待办', due: { 天数: 1, 过期: false } },
            { id: '3', 事由: '明年的课', 类型: '约定待办', due: { 天数: 90, 过期: false } },
        ],
        lines: [
            { name: '今夜赴约', when: '近日', stage: '成形' },
            { name: '远线', when: '月末', stage: '延展' },
        ],
    });
    assert.equal(snap.point.events[0].title, '体检');
    assert.deepEqual(snap.festivals.map(item => item.name), ['花朝', '进行中的庙会']);
    assert.deepEqual(snap.ledger.map(item => item.title), ['养伤', '赴约']);
    assert.deepEqual(snap.lines.map(item => item.name), ['今夜赴约']);
    assert.equal(pickTodayPoint([]), null);
    assert.equal(pickUpcomingFestivals([{ name: '远', days: 20 }]).length, 0);
    assert.equal(pickDueLedger([]).length, 0);
    assert.equal(pickNearLines([{ name: '空', when: '' }]).length, 0);
});

test('stage html never injects and jumps with module keys', () => {
    const html = renderStageHtml(collectStageSnapshot({
        todayLabel: '三月三日',
        days: [{ dayNumber: 1, events: [{ title: '体检', time: '上午', location: '医馆' }] }],
        festivals: [{ name: '花朝', days: 0 }],
        ledger: [{ id: 'L1', 事由: '养伤', 类型: '持续状态' }],
        lines: [{ name: '赴约', when: '今夜', stage: '成形' }],
    }));
    assert.match(html, /故事今天 三月三日/);
    assert.match(html, /data-jump-mod="point"[^>]*data-jump-key="体检"/);
    assert.match(html, /data-jump-mod="almanac"/);
    assert.match(html, /data-jump-mod="ledger"[^>]*data-jump-ref="L1"/);
    assert.match(html, /data-jump-mod="lines"/);
    assert.doesNotMatch(html, /setExtensionPrompt|【作者合同】/);
});

test('enter stage opens after resetting modes', () => {
    const calls = [];
    enterStageSidebar({
        resetModes: () => calls.push('reset'),
        show: () => calls.push('show'),
        feature: { open: () => calls.push('open') },
    });
    assert.deepEqual(calls, ['reset', 'show', 'open']);
    const jumps = [];
    const feature = createStageFeature({
        collect: () => collectStageSnapshot({ days: [{ dayNumber: 1, events: [{ title: '体检' }] }] }),
        jump: item => jumps.push(item),
        $in: sel => sel === '#sp-stage-wrap' ? {
            length: 1,
            html() { return this; },
            on(_ev, _sel, handler) { handler.call({ getAttribute: name => ({ 'data-jump-mod': 'point', 'data-jump-key': '体检', 'data-jump-ref': '' }[name]) }); return this; },
        } : { length: 0 },
    });
    feature.bindUi();
    feature.open();
    assert.deepEqual(jumps, [{ module: 'point', title: '体检', ref: '' }]);
});

test('festival rows mark in-progress and keep days-until', () => {
    const rows = buildFestivalRows([
        { name: '远', month: 12, day: 1, days: 1 },
        { name: '近', month: 3, day: 5, days: 1 },
        { name: '庙会', month: 3, day: 2, days: 5 },
    ], {
        cal: {},
        anchor: { month: 3, day: 3 },
        daysUntil: (_m, d) => d === 5 ? 2 : 40,
        dayOfYear: (_m, d) => d,
        coversDoy: (item, todayDoy) => item.name === '庙会' && todayDoy === 3,
        clampInt: value => Number(value) || 1,
        yearLen: () => 360,
        sort: items => items,
    });
    assert.deepEqual(rows.map(item => [item.name, item.days]), [['远', 40], ['近', 2], ['庙会', -1]]);
});

test('prompt hosts never import stage', async () => {
    const files = [
        new URL('../../runtime/generation-messages.js', import.meta.url),
        new URL('../space/guide-prompt.js', import.meta.url),
        new URL('../space/context.js', import.meta.url),
        new URL('../beat/prompt.js', import.meta.url),
        new URL('../lines/prompt.js', import.meta.url),
        new URL('../lines/injection.js', import.meta.url),
        new URL('../outline/injection.js', import.meta.url),
        new URL('../ledger/inject.js', import.meta.url),
        new URL('../law/injection.js', import.meta.url),
    ];
    for (const file of files) {
        const source = await readFile(file, 'utf8');
        assert.doesNotMatch(source, /collectStageSnapshot|\/stage['"]/, `${file.pathname} must not import stage`);
    }
});
