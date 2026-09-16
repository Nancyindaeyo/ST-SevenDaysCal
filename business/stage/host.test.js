import test from 'node:test';
import assert from 'node:assert/strict';
import { createStageHost } from './host.js';

function makeHost(overrides = {}) {
    const jumps = [];
    const opens = [];
    const host = createStageHost({
        calendar: () => ({ months: [{ name: '三月', days: 30 }] }),
        todayEvidence: () => ({ year: 2024, month: 3, day: 3 }),
        todayAnchor: () => ({ month: 1, day: 1 }),
        formatDayDate: ({ year, month, day }) => `${year}年${month}月${day}日`,
        storyYear: evidence => evidence.year,
        readPoint: () => ({ raw: `<calendar_widget>
StartDate: 2024-03-03
Day: 1|三月三日|晴|18℃
Event: main|体检|候诊|上午|医馆|e1|false
</calendar_widget>` }),
        loadAlmanac: () => [{ name: '花朝', month: 3, day: 5, days: 1 }],
        daysUntil: () => 2,
        dayOfYear: (_m, d) => d,
        coversDoy: () => false,
        clampInt: value => Number(value) || 1,
        yearLen: () => 360,
        sortUpcoming: items => items,
        listLedger: () => [{ id: 'L1', 事由: '养伤', 类型: '持续状态' }],
        dueInfo: () => ({ 天数: 0, 过期: false }),
        readLinesRaw: () => `Line: 今夜赴约|成形|今夜|world|false|false
Desc: 出门
Next: 赴宴
`,
        jump: item => jumps.push(item),
        $in: () => ({ length: 0 }),
        onOpen: () => opens.push('open'),
        ...overrides,
    });
    return { host, jumps, opens };
}

test('collect keeps evidence label, today point, near festival, due ledger and 近日 lines', () => {
    const { host } = makeHost();
    const snap = host.collect();
    assert.equal(snap.todayLabel, '2024年3月3日');
    assert.equal(snap.point.events[0].title, '体检');
    assert.deepEqual(snap.festivals.map(item => item.name), ['花朝']);
    assert.deepEqual(snap.ledger.map(item => item.title), ['养伤']);
    assert.deepEqual(snap.lines.map(item => item.name), ['今夜赴约']);
});

test('missing evidence leaves the today label empty and parse failures stay empty', () => {
    const emptyLabel = makeHost({ todayEvidence: () => null }).host.collect();
    assert.equal(emptyLabel.todayLabel, '');
    assert.ok(emptyLabel.festivals);

    const brokenPoint = makeHost({
        readPoint: () => { throw new Error('store'); },
        readLinesRaw: () => { throw new Error('lines'); },
    }).host.collect();
    assert.equal(brokenPoint.point, null);
    assert.deepEqual(brokenPoint.lines, []);
});

test('feature still opens with the same collect', () => {
    const { host, opens } = makeHost();
    host.feature.open();
    assert.deepEqual(opens, ['open']);
    assert.equal(host.feature.isOpen(), true);
});
