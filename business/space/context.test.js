import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySpaceIntent, createSpaceContext, expectedKindFromHistory } from './context.js';
import { spaceWidgetHandoff } from './schema.js';
import { createSpaceRenderer } from './render.js';

test('axis cards classify as almanac and remember expectedKind', () => {
    const axis = classifySpaceIntent('请生成一张轴卡片');
    assert.equal(axis.action, 'write');
    assert.equal(axis.kind, 'almanac_widget');
    assert.equal(axis.expectedKind, 'almanac_widget');
    const axisAlmanac = classifySpaceIntent('帮我新建一张轴历卡片');
    assert.equal(axisAlmanac.kind, 'almanac_widget');
    const era = classifySpaceIntent('请生成一套历法，改成十三个月');
    assert.equal(era.action, 'write');
    assert.equal(era.kind, 'era_widget');
    assert.equal(era.expectedKind, 'era_widget');
});

test('help and negation stay out of write intents', () => {
    const help = classifySpaceIntent('轴卡片怎么用');
    assert.equal(help.action, 'discuss');
    assert.equal(help.faq, true);
    assert.equal(help.expectedKind, null);
    const noWrite = classifySpaceIntent('不要生成轴卡片，先聊聊设定');
    assert.equal(noWrite.action, 'discuss');
    assert.equal(noWrite.expectedKind, null);
});

test('expectedKind comes from the previous user turn', () => {
    const history = [
        { role: 'user', content: '请生成一张轴卡片' },
        { role: 'assistant', content: '<line_widget>Line: 错类|延展|近日|world|false|false\nDesc: d\nNext: n</line_widget>' },
    ];
    assert.equal(expectedKindFromHistory(history, 1), 'almanac_widget');
    assert.equal(expectedKindFromHistory(history, 0), null);
});

test('wrong-kind and invalid cards cannot be handed to lamp', () => {
    const wrong = spaceWidgetHandoff({ kind: 'line_widget', body: 'Line: a|延展|近日|world|false|false' }, 'almanac_widget');
    assert.equal(wrong.ok, false);
    assert.equal(wrong.reason, 'wrong-kind');
    assert.match(wrong.message, /不能交给灯/);
    const invalid = spaceWidgetHandoff({ kind: 'almanac_widget', body: '不是条目' }, 'almanac_widget', { parseAlmanac: () => [] });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.reason, 'invalid');
    const ok = spaceWidgetHandoff({ kind: 'almanac_widget', body: 'Item: 节|festival|1|1|1||' }, 'almanac_widget', {
        parseAlmanac: () => [{ name: '节' }],
    });
    assert.equal(ok.ok, true);
});

test('mismatch cards keep source text and hide the lamp button', () => {
    const renderer = createSpaceRenderer({
        escapeHtml: value => String(value ?? ''),
        parseAlmanac: () => [],
        parseEra: () => null,
    });
    const parts = renderer.message('ai', '先看这句原文。\n<line_widget>Line: 错类|延展|近日|world|false|false\nDesc: d\nNext: n</line_widget>', 1, () => '1', 'almanac_widget');
    assert.match(parts.contentHtml, /先看这句原文/);
    assert.match(parts.widgetCards, /不能交给灯/);
    assert.match(parts.widgetCards, /Line: 错类/);
    assert.equal(parts.canHandoff, false);
    assert.doesNotMatch(parts.actions, /交给灯/);
    assert.match(parts.actions, /回间写清/);
});

test('untagged replies keep the text and do not offer lamp', () => {
    const renderer = createSpaceRenderer({ escapeHtml: value => String(value ?? '') });
    const parts = renderer.message('ai', '这是普通讨论，没有卡片标签。', 1, () => '1', 'almanac_widget');
    assert.match(parts.contentHtml, /普通讨论/);
    assert.equal(parts.widgetCards, '');
    assert.equal(parts.canHandoff, false);
    assert.doesNotMatch(parts.actions, /交给灯/);
});

test('间讨论 system 带剧情摘要', async () => {
    const host = createSpaceContext({
        context: () => ({ name1: '我', name2: '她' }),
        readMemory: async () => '合宿第一夜定下值日表',
        readBaiBaiGarnish: () => '【柏宝书当前账】合宿基地',
    });
    const messages = await host.buildMessages({ target: 'latest', userMsg: '接下来怎么走', historySnapshot: [] });
    assert.match(messages[0].content, /【剧情摘要】/);
    assert.match(messages[0].content, /柏宝书摘要/);
    assert.match(messages[0].content, /合宿第一夜定下值日表/);
    assert.match(messages[0].content, /合宿基地/);
});
