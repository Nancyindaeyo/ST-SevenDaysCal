import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detectLampConflicts, readLampBaiBai, textsRelated } from './detect.js';
import { renderLampHtml } from './ui.js';
import { createLampFeature, enterLampSidebar } from './feature.js';

test('lamp flags stay vs outing, due vs outing, and disjoint 柏宝书 fields', () => {
    const conflicts = detectLampConflicts({
        days: [{ dayNumber: 1, events: [{ title: '在家养伤', location: '旧宅', desc: '卧床' }] }],
        ledger: [
            { id: 'L1', 事由: '赴约', 类型: '约定待办', due: { 天数: 0, 过期: false } },
            { id: 'L2', 事由: '腿伤未愈', 类型: '持续状态', 现状: '还在养伤' },
        ],
        lines: [{ name: '今夜赴约', when: '今夜', stage: '成形' }],
        bbb: {
            location: '新京驿馆',
            condition: '已经能走路',
            plans: [{ content: '今晚仍要赴宴', targetTime: '今夜' }],
        },
    });
    assert.deepEqual(conflicts.map(item => item.id), ['stay-outing', 'due-outing', 'bbb-place', 'bbb-condition', 'bbb-plan']);
    assert.equal(conflicts.find(item => item.id === 'bbb-place').quote, '新京驿馆');
    assert.equal(conflicts.find(item => item.id === 'stay-outing').againstTitle, '在家养伤');
    assert.match(conflicts.find(item => item.id === 'stay-outing').detail, /在家养伤/);
    assert.match(conflicts.find(item => item.id === 'stay-outing').pairId, /今夜赴约/);
    assert.equal(textsRelated('城南旧宅', '旧宅'), true);
    assert.equal(textsRelated('旧宅', '新京'), false);
});

test('lamp keeps quiet when the books already agree, including itinerary multi-place', () => {
    const conflicts = detectLampConflicts({
        days: [{ dayNumber: 1, events: [
            { title: '在家养伤', location: '城南旧宅' },
            { title: '午后出门买药', location: '药铺' },
        ] }],
        ledger: [{ id: 'L2', 事由: '腿伤未愈', 类型: '持续状态', 现状: '仍在养伤' }],
        lines: [{ name: '远线', when: '月末', stage: '延展' }],
        bbb: {
            location: '旧宅',
            condition: '腿伤未愈，仍在养伤',
            plans: [{ content: '把旧账核销', status: 'open' }],
        },
    });
    assert.deepEqual(conflicts.map(item => item.id), []);
});

test('lamp html never injects and jumps to the 构画 side', () => {
    const html = renderLampHtml({
        hasBaiBai: true,
        conflicts: detectLampConflicts({
            days: [{ dayNumber: 1, events: [{ title: '在家养伤', location: '旧宅' }] }],
            lines: [{ name: '今夜赴约', when: '今夜' }],
        }),
    });
    assert.match(html, /data-jump-mod="lines"[^>]*data-jump-key="今夜赴约"/);
    assert.match(html, /冲突/);
    assert.match(html, /搜索/);
    assert.match(html, /sp-lamp-actions/);
    assert.doesNotMatch(html, /没有看出打架的账/);
    assert.match(html, /对照最新楼/);
    assert.match(html, /先看再写/);
    assert.match(html, /追从上次对齐到现在/);
    assert.doesNotMatch(html, /setExtensionPrompt|【作者合同】/);
});

test('enter lamp resets other modes then opens', () => {
    const calls = [];
    enterLampSidebar({
        resetModes: () => calls.push('reset'),
        show: () => calls.push('show'),
        feature: { open: () => calls.push('open') },
    });
    assert.deepEqual(calls, ['reset', 'show', 'open']);
    const jumps = [];
    const feature = createLampFeature({
        collect: () => ({
            hasBaiBai: false,
            conflicts: detectLampConflicts({
                days: [{ dayNumber: 1, events: [{ title: '在家养伤' }] }],
                lines: [{ name: '今夜赴约', when: '今夜' }],
            }),
        }),
        jump: item => jumps.push(item),
        $in: sel => sel === '#sp-lamp-wrap' ? {
            length: 1,
            html() { return this; },
            off() { return this; },
            on(_ev, sel, handler) {
                if (sel === '.sp-lamp-jump') handler.call({ closest: () => ({ getAttribute: name => ({ 'data-jump-mod': 'lines', 'data-jump-key': '今夜赴约', 'data-jump-ref': '' }[name]) }) }, { preventDefault() {} });
                return this;
            },
        } : { length: 0 },
    });
    feature.bindUi();
    feature.open();
    assert.deepEqual(jumps, [{ module: 'lines', title: '今夜赴约', ref: '' }]);
});

test('改这条 keeps the list scroll and nearest-scrolls that row', () => {
    const views = [];
    const row = { scrollIntoView(opts) { views.push(opts); } };
    const body = {
        scrollTop: 0,
        querySelector(sel) { return String(sel).includes('data-row-key') ? row : null; },
    };
    const mainEl = { querySelector(sel) { return sel === '.sp-lamp-body' ? body : null; } };
    let html = '';
    let openEdit = null;
    const feature = createLampFeature({
        collect: () => ({
            hasBaiBai: false,
            hasBaiBai: false,
            conflicts: [{ module: 'point', title: '合宿闭幕式与物资清退', ref: '', detail: '清退清单' }],
            age: { copy: '冲突只比对账本' },
        }),
        $in: sel => {
            if (sel === '#sp-lamp-main') return {
                length: 1,
                get: () => mainEl,
                html(value) { html = String(value || ''); return this; },
            };
            if (sel === '#sp-lamp-wrap') return {
                length: 1,
                html() { return this; },
                off() { return this; },
                on(_ev, selector, handler) {
                    if (selector === '.sp-lamp-edit-open') openEdit = handler;
                    return this;
                },
            };
            return { length: 0 };
        },
    });
    feature.bindUi();
    feature.open();
    body.scrollTop = 280;
    openEdit.call({
        closest: () => ({ getAttribute: name => name === 'data-row-key' ? 'point||合宿闭幕式与物资清退' : '' }),
    }, { preventDefault() {} });
    assert.equal(body.scrollTop, 280);
    assert.deepEqual(views, [{ block: 'nearest', inline: 'nearest' }]);
    assert.match(html, /sp-lamp-edit/);
    assert.match(html, /合宿闭幕式与物资清退/);
});

test('readLampBaiBai drops resolved plans and can take 主角 condition', () => {
    const bbb = readLampBaiBai({
        state: { location: '合宿基地' },
        protagonist: { condition: '扭伤' },
        plans: [
            { status: 'open', content: '分配宿舍' },
            { status: 'resolved', content: '已经办完' },
        ],
        npcs: [{ name: '南', relation: '主角', condition: '不该用这条' }],
    });
    assert.equal(bbb.location, '合宿基地');
    assert.equal(bbb.condition, '扭伤');
    assert.deepEqual(bbb.plans.map(item => item.content), ['分配宿舍']);
    assert.equal(readLampBaiBai(null), null);
});

test('prompt hosts never import lamp', async () => {
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
        assert.doesNotMatch(source, /detectLampConflicts|\/lamp['"]/, `${file.pathname} must not import lamp`);
    }
});
