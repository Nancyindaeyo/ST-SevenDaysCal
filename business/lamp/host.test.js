import test from 'node:test';
import assert from 'node:assert/strict';
import { createLampHost } from './host.js';

function makeHost(overrides = {}) {
    const calls = [];
    const ledger = [{ id: 'L1', 事由: '腿伤未愈', 现状: '还在养伤', 类型: '持续状态' }];
    const almanac = [{ name: '谷雨', note: '旧注' }];
    const dashed = [{ id: 'D1', text: '城南旧宅有暗道' }];
    let outlineRaw = 'Beat: 今晚|晚饭|日常|关系|确认请假\nScene: 晚饭\nSubtext: 未说出口\nThink: 下一拍请假\n';
    const point = { raw: `<calendar_widget>
StartDate: 2024-05-01
Day: 1|5月1日|晴|20℃
Event: main|在家养伤|卧床|全天|旧宅|e1|false
</calendar_widget>` };
    const lines = { raw: `Line: 今夜赴约|成形|今夜|world|false|false
Desc: 出门
Next: 赴宴
` };
    const quotes = [];
    const inputs = [];
    const intents = [];
    const host = createLampHost({
        calendar: () => ({ months: [{ name: '5月', days: 31 }] }),
        settings: () => ({ useBaiBaiBook: true }),
        baiBaiSnapshot: () => ({ state: { location: '新京驿馆' } }),
        readPoint: () => point,
        writePoint: value => { point.raw = value.raw; calls.push(['writePoint']); },
        pointKey: () => 'point',
        readLinesRaw: () => lines.raw,
        readLines: () => lines,
        writeLines: value => { lines.raw = value.raw; calls.push(['writeLines']); },
        listLedger: () => ledger,
        updateLedger: (id, patch) => { Object.assign(ledger.find(item => item.id === id) || {}, patch); calls.push(['ledger', id, patch]); },
        dueInfo: () => ({ 天数: 0, 过期: false }),
        loadAlmanac: () => almanac,
        saveAlmanac: items => { calls.push(['almanac', items[0].note]); },
        outline: () => ({
            readRaw: () => outlineRaw,
            readSnapshot: () => ({ beats: [{ title: '晚饭' }] }),
            repository: {
                capture: () => 'outline',
                readOutline: () => ({ cursor: 1 }),
                commitOutlineConfirmed: (_target, value) => { outlineRaw = value.raw; calls.push(['outline', value.raw]); },
            },
            refreshPanel: () => calls.push('refreshOutline'),
        }),
        lines: () => ({ dashed: { read: () => dashed, commit: items => { dashed.splice(0, dashed.length, ...items); calls.push(['dashed', items[0].text]); } } }),
        lamp: () => ({
            setIntent: (intent, options) => intents.push([intent, options]),
            refresh: () => calls.push('refreshLamp'),
            open: () => calls.push('openLamp'),
        }),
        space: () => ({
            guide: { leave: () => calls.push('leaveGuide') },
            ui: { setQuote: item => quotes.push(item) },
        }),
        activity: () => ({ close: () => calls.push('closeActivity') }),
        openSpace: async () => true,
        fillSpaceInput: text => inputs.push(text),
        resetModes: () => calls.push('resetModes'),
        showLamp: () => calls.push('showLamp'),
        toast: message => calls.push(['toast', message]),
        applyDraft: () => { throw new Error('guide commit must not come back'); },
        ...overrides,
    });
    return { host, calls, ledger, almanac, dashed, point, lines, quotes, inputs, intents, get outlineRaw() { return outlineRaw; } };
}

test('collect reads six books and flags 柏宝书 place against 旧宅', () => {
    const { host } = makeHost();
    const snap = host.collect();
    assert.equal(snap.hasBaiBai, true);
    assert.ok(snap.conflicts.some(item => item.id === 'bbb-place' || item.id === 'stay-outing'));
    assert.equal(snap.books.days[0].events[0].title, '在家养伤');
    assert.equal(snap.books.outline[0].title, '晚饭');
    assert.equal(snap.books.almanac[0].name, '谷雨');
});

test('fight extras edit ledger/almanac/dashed/outline and skip unknown titles', () => {
    const { host, ledger, almanac, dashed, calls } = makeHost();
    const applied = host.applyFightExtras([
        { target: 'ledger', title: '腿伤', fields: ['腿伤未愈', '已经能走路'] },
        { target: 'almanac', title: '谷雨', fields: ['谷雨', '新注'] },
        { target: 'dashed', title: '暗道', fields: ['暗道', '暗道已封'] },
        { target: 'outline', title: '晚饭', fields: ['晚饭', '改成夜谈'] },
        { target: 'ledger', title: '不存在', fields: ['x', 'y'] },
    ]);
    assert.equal(ledger[0].现状, '已经能走路');
    assert.equal(almanac[0].note, '新注');
    assert.equal(dashed[0].text, '暗道已封');
    assert.deepEqual(applied.map(item => item.module), ['ledger', 'axis', 'dashed', 'outline']);
    assert.ok(calls.includes('refreshOutline'));
});

test('hand edit writes point/lines then refreshes lamp', () => {
    const { host, point, lines, calls } = makeHost();
    assert.deepEqual(host.applyHandEdit({ module: 'point', title: '在家养伤', ref: 'e1', fields: { title: '在家静养', time: '全天' } }), { status: 'updated' });
    assert.match(point.raw, /在家静养/);
    host.applyHandEdit({ module: 'lines', title: '今夜赴约', fields: { when: '明晚' } });
    assert.match(lines.raw, /明晚/);
    assert.ok(calls.includes('refreshLamp'));
});

test('basket goes to 间 with quote; clarify asks for a clearer intent; guide handoff never commits drafts', async () => {
    const { host, quotes, inputs, intents, calls } = makeHost();
    const sent = await host.sendBasketToSpace({ items: [{ title: '腿伤未愈', detail: '还在养伤' }], ask: true });
    assert.equal(sent.status, 'quoted');
    assert.equal(quotes[0].who, '对账灯');
    assert.match(quotes[0].quote, /腿伤未愈/);
    assert.match(inputs[0], /改账意图/);
    assert.ok(calls.includes('leaveGuide'));
    assert.ok(calls.includes('closeActivity'));

    host.clarifyIntent({ text: '跑法: （未写清）' });
    await Promise.resolve();
    assert.match(inputs.at(-1), /不要自己改账/);

    host.handoffFromGuide({ kind: 'fight', items: [{ module: 'point', title: '在家养伤' }] });
    assert.equal(intents[0][1].from, 'guide');
    assert.ok(calls.includes('resetModes'));
    assert.ok(calls.includes('showLamp'));
    assert.deepEqual(calls.find(item => Array.isArray(item) && item[0] === 'toast'), ['toast', '草案已交给灯，确认跑法后再改账']);
    assert.equal(calls.some(item => item === 'applyDraft' || item?.[0] === 'applyDraft'), false);

    host.receiveSpaceMessage({ content: '跑法: 打架\n要动: 点\n- 点「在家养伤」：改成静养' });
    assert.equal(intents.at(-1)[0].kind, 'fight');
    assert.equal(intents.at(-1)[1].from, 'space');
});
