import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    INDEX_LINE_BUDGET,
    INDEX_TOPLEVEL_FN_BUDGET,
    inspectIndexSource,
} from './index.budget.js';

test('assembly root stays within the published line and top-level function budget', async () => {
    const source = await readFile(fileURLToPath(new URL('./index.js', import.meta.url)), 'utf8');
    const stats = inspectIndexSource(source);
    assert.ok(
        stats.physicalLines <= INDEX_LINE_BUDGET,
        `index.js 现有 ${stats.physicalLines} 行，超过预算 ${INDEX_LINE_BUDGET}；新业务应放 business/ 或 runtime/，不要继续堆装配根`,
    );
    assert.ok(
        stats.topLevelCount <= INDEX_TOPLEVEL_FN_BUDGET,
        `index.js 现有 ${stats.topLevelCount} 个顶层函数，超过预算 ${INDEX_TOPLEVEL_FN_BUDGET}`,
    );
});

test('index budget inspector counts declarations without executing the host', () => {
    const stats = inspectIndexSource([
        'import x from "./x.js";',
        'function keep() { return 1; }',
        'export async function later() { return 2; }',
        'const thin = () => 3;',
        'const named = async (a) => a;',
        '    function nested() {}',
        'const value = 1;',
    ].join('\n'));
    assert.equal(stats.physicalLines, 7);
    assert.deepEqual(stats.topLevel, ['keep', 'later', 'thin', 'named']);
});
