import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultKindForHandoff, formatLampIntent, intentFromBasket, intentFromGuide, parseLampIntent } from './intent.js';

test('format and parse round-trip fight intent', () => {
    const text = formatLampIntent({
        kind: 'fight',
        modules: ['point', 'ledger'],
        items: [
            { module: 'point', title: '合宿闭幕式与物资清退', change: '伤势改成已能签字' },
            { module: 'ledger', title: '星野南右臂挫伤', change: '现状改成夹板已拆' },
        ],
        avoid: '面整份, 轴整年',
        reason: '柏宝书只对照',
    });
    assert.match(text, /跑法: fight/);
    const parsed = parseLampIntent(text);
    assert.equal(parsed.kind, 'fight');
    assert.deepEqual(parsed.modules, ['point', 'ledger']);
    assert.equal(parsed.items[1].title, '星野南右臂挫伤');
});

test('unclear kind stays empty so the author can send 间 back', () => {
    assert.equal(parseLampIntent('跑法: （未写清）\n要动: 点').kind, '');
    assert.equal(defaultKindForHandoff({ from: 'conflict', hasConflict: true }), 'fight');
    assert.equal(defaultKindForHandoff({ from: 'search', hasConflict: false }), '');
});

test('guide apply decisions become lamp intent without writing books', () => {
    const intent = intentFromGuide({
        understand: '伤势已经好转',
        decisions: { point: 'apply', lines: 'keep', outline: 'skip' },
        drafts: { point: '<calendar_widget></calendar_widget>', lines: '<storylines_widget></storylines_widget>' },
    });
    assert.deepEqual(intent.modules, ['point']);
    assert.equal(intent.source, 'guide');
    assert.match(intent.text, /点「点」/);
});

test('basket intent lists named rows', () => {
    const intent = intentFromBasket([
        { module: 'lines', title: '今夜赴约', detail: '点还在养伤' },
    ]);
    assert.equal(intent.kind, 'fight');
    assert.equal(intent.items[0].title, '今夜赴约');
});
