import test from 'node:test';
import assert from 'node:assert/strict';
import { searchLampBooks } from './search.js';

test('search finds injury across point line ledger dashed', () => {
    const hits = searchLampBooks('受伤', {
        days: [{ events: [{ title: '合宿', desc: '右臂受伤后仍能签字', location: '大厅' }] }],
        lines: [{ name: '养伤线', when: '近日', desc: '右臂受伤后还在养' }],
        ledger: [{ id: 'L2', 事由: '星野南右臂挫伤', 现状: '夹板，受伤未愈', 标签: ['伤'] }],
        dashed: [{ id: 'd1', text: 'U-17 受伤后用弹力套固定' }],
        outline: [{ title: '闭营', scene: '毕业寄语' }],
        almanac: [{ name: '黄金周合宿', note: '高校联合' }],
    });
    assert.deepEqual(hits.map(item => item.module).sort(), ['dashed', 'ledger', 'lines', 'point'].sort());
    assert.equal(hits.find(item => item.module === 'ledger').title, '星野南右臂挫伤');
    assert.equal(searchLampBooks('', { days: [{ events: [{ title: '合宿' }] }] }).length, 0);
});
