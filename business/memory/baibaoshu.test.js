import test from 'node:test';
import assert from 'node:assert/strict';
import { baiBaiBookCoverage, baiBaiBookStatusHtml, formatBaiBaiBookContext, readBaiBaiBookGarnish, readBaiBaiBookHistory, usesBaiBaiBook } from './baibaoshu.js';

test('柏宝书 coverage distinguishes missing api from incomplete floors', () => {
    assert.equal(usesBaiBaiBook({ useBaiBaiBook: true }), true);
    assert.deepEqual(baiBaiBookCoverage(null), { ready: false });
    assert.deepEqual(baiBaiBookCoverage({
        getInjectedHistory: () => ({ coverage: { complete: false, missingAiFloors: [1, 2] }, relativeText: '近' }),
        getHistory: () => ({ relativeText: '全' }),
    }), { ready: true, complete: false, missing: 2 });
    assert.match(baiBaiBookStatusHtml({ ready: true, complete: false, missing: 3 }), /缺 3 楼摘要/);
    assert.deepEqual(baiBaiBookCoverage({
        getInjectedHistory() { throw new Error('api exploded'); },
    }), { ready: true });
    const unknownHtml = baiBaiBookStatusHtml({ ready: true });
    assert.match(unknownHtml, /柏宝书已就绪/);
    assert.equal(unknownHtml.includes('覆盖完整'), false);
    assert.equal(readBaiBaiBookHistory({
        getInjectedHistory: () => ({ relativeText: '近' }),
        getHistory: () => ({ relativeText: '全' }),
    }, { full: true }), '全');
});

test('柏宝书配料列出眼下、未了结计划和人物，不写已了结', () => {
    const text = formatBaiBaiBookContext({
        state: { time: '2027/5/1 08:20', location: '合宿基地' },
        plans: [
            { kind: 'plan', status: 'open', content: '合宿期间分配宿舍', targetTime: '2027/04/29' },
            { kind: 'plan', status: 'resolved', content: '已经办完的不该出现' },
        ],
        npcs: [{ name: '星野南', title: '经理', relation: '主角' }],
    });
    assert.match(text, /合宿基地/);
    assert.match(text, /分配宿舍/);
    assert.match(text, /星野南/);
    assert.doesNotMatch(text, /已经办完/);
    assert.match(readBaiBaiBookGarnish({ getSnapshot: () => ({ state: { location: '合宿基地' } }) }), /合宿基地/);
    assert.equal(readBaiBaiBookGarnish(null), '');
});
