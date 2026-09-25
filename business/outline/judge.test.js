import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutlineJudge } from './judge.js';

function makeJudge(overrides = {}) {
    const activities = [];
    const repository = {
        capture: () => ({ chatId: 'c' }),
        isCurrent: () => true,
        matches: () => true,
        readOutline: () => ({ raw: [
            'Beat: 当下|起|铺垫|线A|待演',
            'Scene: 第一幕',
            'Subtext: 潜',
            'Think: 想',
            'Beat: 其后|承|推进|线A|待演',
            'Scene: 第二幕',
            'Subtext: 潜',
            'Think: 想',
        ].join('\n'), cursor: 1 }),
        cursor: () => 1,
        setCursorConfirmed: async () => ({ ok: true }),
    };
    const judge = createOutlineJudge({
        repository,
        context: () => ({ chatId: 'c', name1: 'U', name2: 'C', chat: [{ is_user: false, mes: 'hi' }] }),
        settings: () => ({ notifyMode: 'lite', outlineJudgeEnabled: true, outlineJudgeInterval: 1 }),
        pluginEnabled: () => true,
        loadConfig: () => ({ url: '', key: '' }),
        callApi: async () => '推进',
        onActivity: entry => activities.push(entry),
        ...overrides,
    });
    return { judge, activities };
}

test('outline judge records a failed activity when API is missing', async () => {
    const { judge, activities } = makeJudge();
    const result = await judge.runAdvance(3);
    assert.equal(result.status, 'failed');
    assert.equal(result.reason, 'config-missing');
    assert.equal(activities[0].source, 'outline');
    assert.equal(activities[0].outcome, 'failed');
    assert.equal(activities[0].reasonCode, 'config-missing');
});

test('outline judge skips when the utility route is invalid', async () => {
    const { judge, activities } = makeJudge({
        loadConfig: () => ({ status: 'invalid', reason: 'missing-preset', presetId: 'gone', presetName: '', cfg: null }),
    });
    const result = await judge.runAdvance(3);
    assert.equal(result.status, 'skipped');
    assert.equal(result.reason, 'utility-route-invalid');
    assert.equal(activities[0].outcome, 'skipped');
    assert.equal(activities[0].reasonCode, 'utility-route-invalid');
});

test('outline judge records parse failures so 【改】 can retry', async () => {
    const { judge, activities } = makeJudge({
        loadConfig: () => ({ url: 'u', key: 'k' }),
        callApi: async () => '随便写点什么',
    });
    const result = await judge.runAdvance(4);
    assert.equal(result.status, 'failed');
    assert.equal(activities[0].reasonCode, 'outline-judge-format');
});
