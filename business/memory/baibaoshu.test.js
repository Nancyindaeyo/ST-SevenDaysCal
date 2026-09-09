import test from 'node:test';
import assert from 'node:assert/strict';
import { baiBaiBookCoverage, baiBaiBookStatusHtml, readBaiBaiBookHistory, usesBaiBaiBook } from './baibaoshu.js';

test('柏宝书 coverage distinguishes missing api from incomplete floors', () => {
    assert.equal(usesBaiBaiBook({ useBaiBaiBook: true }), true);
    assert.deepEqual(baiBaiBookCoverage(null), { ready: false });
    assert.deepEqual(baiBaiBookCoverage({
        getInjectedHistory: () => ({ coverage: { complete: false, missingAiFloors: [1, 2] }, relativeText: '近' }),
        getHistory: () => ({ relativeText: '全' }),
    }), { ready: true, complete: false, missing: 2 });
    assert.match(baiBaiBookStatusHtml({ ready: true, complete: false, missing: 3 }), /缺 3 楼摘要/);
    assert.equal(readBaiBaiBookHistory({
        getInjectedHistory: () => ({ relativeText: '近' }),
        getHistory: () => ({ relativeText: '全' }),
    }, { full: true }), '全');
});
