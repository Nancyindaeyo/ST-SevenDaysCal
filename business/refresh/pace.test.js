import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPaceRows, compactPaceText, formatRemain, overlayQueueOnRows, paceStripHtml, remainingFloors } from './pace.js';

test('remaining floors count down until the interval fires', () => {
    assert.equal(remainingFloors(0, 3), 3);
    assert.equal(remainingFloors(1, 3), 2);
    assert.equal(remainingFloors(2, 3), 1);
    assert.equal(remainingFloors(0, 1), 1);
    assert.equal(formatRemain(1, 3), '还差 2 楼');
    assert.equal(formatRemain(2, 3), '下一楼');
});

test('days mode shows date wait unless an owed advance is pending', () => {
    const waiting = collectPaceRows({
        alignOn: true, alignUsed: 1, alignInterval: 3,
        linesOn: true, linesMode: 'days', pendingAdvance: false,
        outlineOn: true, outlineUsed: 0, outlineInterval: 3,
    });
    assert.equal(waiting.find(row => row.id === 'align').text, '还差 2 楼');
    assert.equal(waiting.find(row => row.id === 'advance').text, '等日期变了');
    const owed = collectPaceRows({ linesOn: true, linesMode: 'days', pendingAdvance: true });
    assert.equal(owed.find(row => row.id === 'advance').text, '下一楼补');
    assert.equal(owed.find(row => row.id === 'advance').due, true);
    const dashedOwed = collectPaceRows({ dashedOn: true, pendingDashed: true, dashedUsed: 2, dashedInterval: 6 });
    assert.equal(dashedOwed.find(row => row.id === 'dashed').text, '下一楼补');
    assert.equal(dashedOwed.find(row => row.id === 'dashed').due, true);
    const missing = collectPaceRows({ linesOn: true, linesMode: 'days', missingStamp: true });
    assert.equal(missing.find(row => row.id === 'advance').text, '缺时间戳');
    assert.equal(missing.find(row => row.id === 'advance').due, true);
    const failedAdvance = collectPaceRows({ linesOn: true, linesMode: 'days', advanceFailed: true });
    assert.equal(failedAdvance.find(row => row.id === 'advance').text, '失败');
    assert.equal(failedAdvance.find(row => row.id === 'advance').due, true);
});

test('strip only paints live automations', () => {
    const html = paceStripHtml(collectPaceRows({
        alignOn: true, alignUsed: 2, alignInterval: 3,
        linesOn: true, linesMode: 'turns', advanceUsed: 0, advanceInterval: 2,
        outlineOn: false,
        dashedOn: false,
        ledgerOn: false,
        dateOn: true, dateUsed: 0, dateInterval: 3,
    }));
    assert.match(html, /对齐/);
    assert.match(html, /下一楼/);
    assert.match(html, /推进/);
    assert.match(html, /还差 2 楼/);
    assert.doesNotMatch(html, /面/);
    assert.doesNotMatch(html, /冷知识/);
    assert.doesNotMatch(html, /补日期/);
});

test('failed align chip is due and activity chips can be buttons', () => {
    const failed = collectPaceRows({ alignOn: true, alignFailed: true, alignUsed: 0, alignInterval: 3 });
    assert.equal(failed.find(row => row.id === 'align').text, '失败');
    assert.equal(failed.find(row => row.id === 'align').due, true);
    const html = paceStripHtml(failed.filter(row => row.id === 'align'), { interactive: ['align', 'advance', 'outline', 'dashed'] });
    assert.match(html, /<button type="button" class="sp-pace-chip is-due" data-pace="align"/);
    const mixed = paceStripHtml([
        { id: 'advance', label: '推进', text: '下一楼' },
        { id: 'dashed', label: '冷知识', text: '还差 2 楼' },
        { id: 'ledger-capture', label: '刻度标注', text: '下一楼' },
    ], { interactive: ['align', 'advance', 'outline', 'dashed'] });
    assert.match(mixed, /<button type="button" class="sp-pace-chip is-due" data-pace="advance"/);
    assert.match(mixed, /<button type="button" class="sp-pace-chip" data-pace="dashed"/);
    assert.match(mixed, /<span class="sp-pace-chip is-due" data-pace="ledger-capture"/);
});

test('activity compact chips shorten remain copy and long labels', () => {
    assert.equal(compactPaceText('还差 2 楼'), '差2');
    assert.equal(compactPaceText('等日期变了'), '等日期');
    const html = paceStripHtml([
        { id: 'align', label: '对齐', text: '还差 2 楼' },
        { id: 'ledger-capture', label: '刻度标注', text: '下一楼', due: true },
    ], { compact: true });
    assert.match(html, />差2</);
    assert.match(html, />标注</);
    assert.doesNotMatch(html, /还差 2 楼/);
    assert.doesNotMatch(html, /刻度标注/);
});

test('queue overlay paints running, queued and failed on top of remain text', () => {
    const rows = collectPaceRows({
        alignOn: true, alignUsed: 1, alignInterval: 3,
        linesOn: true, linesMode: 'days',
        outlineOn: true, outlineUsed: 0, outlineInterval: 3,
    });
    const overlaid = overlayQueueOnRows(rows, {
        running: { id: 'align', label: '对齐' },
        queued: [{ id: 'advance', label: '推进' }, { id: 'supplement', label: '补录' }],
        failed: [{ id: 'dashed', label: '冷知识' }],
    });
    assert.equal(overlaid.find(row => row.id === 'align').text, '正在跑');
    assert.equal(overlaid.find(row => row.id === 'align').live, 'running');
    assert.equal(overlaid.find(row => row.id === 'advance').text, '排队');
    assert.equal(overlaid.find(row => row.id === 'supplement').label, '补录');
    assert.equal(overlaid.find(row => row.id === 'supplement').live, 'queued');
    assert.equal(overlaid.find(row => row.id === 'dashed').text, '失败');
    assert.equal(overlaid.find(row => row.id === 'dashed').live, 'failed');
});

test('pace state survives a reload-shaped hydrate', async () => {
    const { clampPaceToLatest, normalizePaceState, snapshotPaceState } = await import('./pace-persist.js');
    const { createRefreshController } = await import('./controller.js');
    const saved = snapshotPaceState({
        align: { lastFloor: 4, counter: 2 },
        advance: { lastFloor: 4, counter: 1 },
        pendingAdvance: true,
        lastReconcileFloor: 4,
    });
    assert.equal(normalizePaceState(saved).align.counter, 2);
    const clamped = clampPaceToLatest(saved, 6);
    assert.equal(clamped.align.lastFloor, 6);
    assert.equal(clamped.align.counter, 2);
    assert.equal(clamped.lastReconcileFloor, -1);
    const controller = createRefreshController({ enabled: () => false });
    controller.hydrate({
        counter: clamped.align.counter,
        lastFloor: clamped.align.lastFloor,
        pendingAdvance: true,
    });
    assert.equal(controller.state().counter, 2);
    assert.equal(controller.state().lastFloor, 6);
    assert.equal(controller.state().pendingAdvance, true);
});
