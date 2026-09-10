import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnchorAftermath } from './aftermath.js';

const widget = (start, days) => `<calendar_widget>
StartDate: ${start}
${days}
</calendar_widget>`;

const april14 = widget('2024-04-14', `Day: 1|晴|18℃
Event: main|体检|去做体检|上午|医院||false
Event: main|锁着的会|保留锁定|下午|教室||true
Day: 2|阴|16℃
Event: main|合宿报到|去宿舍|上午|基地||false
Day: 3|雨|14℃
Event: main|练习赛|上场|下午|球场||false
Future:
Event: main|暑假旅行|以后再说|未定|海边||false`);

function makeHost(overrides = {}) {
    const store = new Map(overrides.initialStore || [['user', april14]]);
    const calls = [];
    const host = createAnchorAftermath({
        today: () => ({ month: 4, day: 15 }),
        calendar: () => ({ kind: 'gregorian' }),
        cacheKey: (view, charName) => (view === 'char' ? (String(charName || '').trim() ? `char:${charName}` : null) : 'user'),
        readStore: key => (store.has(key) ? { raw: store.get(key), extra: true } : null),
        writeStore: (key, value) => { calls.push(['write', key]); store.set(key, value.raw); },
        currentView: () => 'user',
        charViewName: () => '',
        recordActivity: payload => calls.push(['record', payload]),
        warn: error => calls.push(['warn', error]),
        syncAlmanacBlock: () => calls.push('almanac'),
        syncScheduleBlock: () => calls.push('schedule'),
        pointGenerating: () => false,
        refreshPointPanel: () => calls.push('refresh'),
        notifyLinesDate: () => calls.push('lines'),
        almanacVisible: () => false,
        renderAlmanac: () => calls.push('almanac-panel'),
        paintPace: () => calls.push('pace'),
        ...overrides,
    });
    return { host, calls, store };
}

test('换日把用户点前移一格并记进改', () => {
    const { host, calls, store } = makeHost();
    assert.equal(host.shiftPointsToToday(), true);
    assert.match(store.get('user'), /StartDate: 2024-04-15/);
    assert.equal(calls[0][0], 'write');
    const record = calls.find(call => call[0] === 'record')[1];
    assert.equal(record.source, 'shift');
    assert.equal(record.note, '格子前移 1 天');
    assert.deepEqual(record.items.map(item => item.action), ['complete', 'postpone']);
});

test('同一天不写 store；TA 视角才会动 TA 账', () => {
    const sameDay = widget('2024-04-15', 'Day: 1\nEvent: main|今天|描述|早|地||false\n');
    const { host, calls } = makeHost({ initialStore: [['user', sameDay]] });
    host.shiftPointsToToday();
    assert.equal(calls.some(call => call[0] === 'write'), false);

    const { host: charHost, calls: charCalls, store } = makeHost({
        currentView: () => 'char',
        charViewName: () => '林',
        initialStore: [['user', april14], ['char:林', april14]],
    });
    charHost.shiftPointsToToday();
    assert.ok(charCalls.some(call => call[0] === 'write' && call[1] === 'user'));
    assert.ok(charCalls.some(call => call[0] === 'write' && call[1] === 'char:林'));
    assert.match(store.get('char:林'), /StartDate: 2024-04-15/);
    assert.equal(charCalls.filter(call => call[0] === 'record').length, 1);
});

test('滚点抛错只记 warn，善后后面的刷界面仍会跑', () => {
    const { host, calls } = makeHost({
        readStore: () => { throw new Error('boom'); },
    });
    host.run();
    assert.equal(calls[0][0], 'warn');
    assert.deepEqual(calls.slice(1), ['almanac', 'schedule', 'refresh', 'lines', 'pace']);
});

test('生成中不重画点面板；轴开着才刷轴', () => {
    const { host, calls } = makeHost({
        pointGenerating: () => true,
        almanacVisible: () => true,
        initialStore: [['user', widget('2024-04-15', 'Day: 1\n')]],
    });
    host.run();
    assert.deepEqual(calls, ['almanac', 'schedule', 'lines', 'almanac-panel', 'pace']);
});

test('后台跟随只在 StartDate 还不是目标日时要补同步', () => {
    const { host } = makeHost();
    assert.equal(host.pointNeedsSync({ view: 'user' }, { month: 4, day: 15 }), true);
    assert.equal(host.pointNeedsSync({ view: 'user' }, { month: 4, day: 14 }), false);
    assert.equal(host.pointNeedsSync({ view: 'char', charName: '' }), false);
    const empty = makeHost({ initialStore: [['user', '']] });
    assert.equal(empty.host.pointNeedsSync({ view: 'user' }, { month: 4, day: 15 }), false);
});
