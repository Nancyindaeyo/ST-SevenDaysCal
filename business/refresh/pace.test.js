import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPaceRows, formatRemain, paceStripHtml, remainingFloors } from './pace.js';

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
    const missing = collectPaceRows({ linesOn: true, linesMode: 'days', missingStamp: true });
    assert.equal(missing.find(row => row.id === 'advance').text, '缺时间戳');
    assert.equal(missing.find(row => row.id === 'advance').due, true);
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
