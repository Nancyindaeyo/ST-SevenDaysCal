import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFightAddon, buildFightPrompt } from './fight-prompt.js';

test('fight prompt is not the align skeleton', () => {
    const prompt = buildFightPrompt({
        latestStory: '夹板已经拆了。',
        pointRaw: '合宿',
        intent: {
            items: [{ module: 'ledger', title: '星野南右臂挫伤', change: '现状改成夹板已拆' }],
            avoid: '轴整年',
            reason: '柏宝书对照',
        },
    });
    assert.match(prompt, /<fight_patch>/);
    assert.match(prompt, /只输出：\s*<fight_patch>/);
    assert.doesNotMatch(prompt, /只输出：\s*<reconcile_patch>/);
    assert.match(prompt, /不是按正文整表对齐/);
    assert.match(prompt, /一天行程里出现多个地点不是打架/);
    assert.match(prompt, /星野南右臂挫伤/);
    assert.equal(buildFightAddon({}).includes('只改下面点名'), true);
});
