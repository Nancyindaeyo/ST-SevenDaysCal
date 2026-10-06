import test from 'node:test';
import assert from 'node:assert/strict';
import { selectUnsummarizedFloors } from './recent-raw.js';

test('recent memory tail keeps uncovered floors and drops ones already summarized', () => {
    const floors = [
        { mesid: '0', text: '已进摘要的早楼' },
        { mesid: '1', text: '窗口里还没摘要' },
        { mesid: '2', text: '已经写进最近 L0' },
        { mesid: '3', text: '最新还没进组' },
    ];
    const tail = selectUnsummarizedFloors({
        floors,
        coveredMesIds: ['0', '2'],
        recentWindowFloors: [{ mesid: '1' }, { mesid: '2' }],
    });
    assert.deepEqual(tail.map(floor => floor.mesid), ['1', '3']);
    const again = selectUnsummarizedFloors({
        floors,
        coveredMesIds: ['0', '2'],
        recentWindowFloors: [{ mesid: '1' }, { mesid: '2' }],
        excludeMesIds: ['3'],
    });
    assert.deepEqual(again.map(floor => floor.mesid), ['1']);
});
