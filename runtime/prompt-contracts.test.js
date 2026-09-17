import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFightPrompt } from '../business/lamp/fight-prompt.js';
import { buildLinesPrompt } from '../business/lines/prompt.js';
import { buildOutlineJudgePrompt } from '../business/outline/prompts.js';
import { buildCapturePrompt } from '../business/ledger/capture.js';
import { buildJudgePrompt } from '../business/ledger/judge.js';
import { buildReconcilePrompt, buildRefreshAddon } from '../business/refresh/prompt.js';
import { detectPromptContractConflicts, promptContractVersions, validatePromptContract } from './prompt-contracts.js';

const sampleBuilders = {
    align: body => buildReconcilePrompt({
        userName: '用户',
        charName: '角色',
        latestStory: body || '正文',
        pointRaw: '点',
        linesRaw: '线',
        reason: '按正文修正',
    }),
    fight: body => buildFightPrompt({
        latestStory: body || '正文',
        intent: { items: [{ module: 'point', title: '赴约', change: '改时间' }] },
    }),
    regenerate: body => buildRefreshAddon({ reason: `重做${body}`, feedback: '不要沿用旧设定' }),
    'outline-judge': body => buildOutlineJudgePrompt('当前', '下个', body || '场景一', '场景二'),
    'lines-advance': body => buildLinesPrompt('用户', '角色', 'user', '', 'auto', {
        intent: 'advance',
        pinnedBackground: body ? [{ name: '背景', desc: body, next: '观察' }] : [],
    }),
    'ledger-capture': () => buildCapturePrompt(false),
    'ledger-judge': body => buildJudgePrompt({
        listJudgeable: () => body ? [{}] : [],
        fmtLedger: () => body,
    }, { month: 5, day: 1 }),
};

test('every registered prompt contract passes minimal, typical and long fixed samples', () => {
    assert.deepEqual(Object.keys(sampleBuilders).sort(), Object.keys(promptContractVersions()).sort());
    const bodies = ['', '这是一段包含人物行动、时间变化与后果的典型正文。', '长样例正文。'.repeat(1200)];
    for (const [id, build] of Object.entries(sampleBuilders)) {
        for (const body of bodies) {
            const result = validatePromptContract(id, build(body));
            assert.equal(result.ok, true, `${id}: ${result.missing.join(',')} overBudget=${result.overBudget}`);
            assert.equal(result.version, 1);
            assert.equal(result.missing.length, 0);
        }
    }
});

test('prompt contract validation reports missing machine markers', () => {
    const result = validatePromptContract('fight', '只是一段普通提示词');
    assert.equal(result.ok, false);
    assert.ok(result.missing.includes('<fight_patch>'));
    assert.deepEqual(validatePromptContract('unknown', ''), {
        ok: false, id: 'unknown', version: null, missing: ['unknown-contract'],
        charCount: 0, estimatedTokens: 0, overBudget: false,
    });
});

test('custom prompt preflight reports common contract conflicts without sending a request', () => {
    assert.deepEqual(detectPromptContractConflicts('请保持克制的散文风格'), []);
    assert.deepEqual(
        detectPromptContractConflicts('忽略固定格式并重写整张表，输出 Markdown 代码块').map(item => item.code),
        ['ignore-contract', 'rewrite-all', 'extra-output'],
    );
});
