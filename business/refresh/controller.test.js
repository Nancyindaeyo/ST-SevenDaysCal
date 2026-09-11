import test from 'node:test';
import assert from 'node:assert/strict';
import { createRefreshController } from './controller.js';

function env(over = {}) {
    let chatId = 'a';
    const writes = [];
    return {
        writes,
        chatId: () => chatId,
        setChatId(next) { chatId = next; },
        context: () => ({ chatId, name1: '甲', name2: '乙', chat: [{ is_user: false, mes: '今天去体检了。' }] }),
        loadConfig: () => ({ url: 'http://x', key: 'k' }),
        today: () => ({ month: 3, day: 1 }),
        cleanText: text => text,
        readPointRaw: () => `<calendar_widget>
StartDate: 2024-03-01
Day: 1|晴|12℃
Event: main|体检|去做体检|上午|医院||false
</calendar_widget>`,
        readLinesRaw: () => '',
        writePointRaw: async (raw, options = {}) => {
            if (options.ownerGuard && !options.ownerGuard()) return { ok: false, reason: 'stale-before-save' };
            writes.push({ chatId, raw });
            return { ok: true };
        },
        callApi: async (_ctx, _prompt, _cfg, _u, _c, signal) => {
            await new Promise((resolve, reject) => {
                const done = () => resolve('note: 体检已发生\npoint: complete|体检');
                if (signal?.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                signal?.addEventListener?.('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
                setTimeout(done, 20);
            });
            return 'note: 体检已发生\npoint: complete|体检';
        },
        linesEnabled: () => true,
        ...over,
    };
}

test('align skips when busy with regenerate', async () => {
    const controller = createRefreshController(env());
    const first = controller.align({ selected: ['point'] });
    const second = await controller.align({ selected: ['point'] });
    assert.equal(second.reason, 'busy');
    await first;
});

test('regenerate skips while align is running', async () => {
    const controller = createRefreshController(env());
    const aligning = controller.align({ selected: ['point'] });
    const regen = await controller.regenerate({ selected: ['point'], reason: '重做' });
    assert.equal(regen.reason, 'busy');
    await aligning;
});

test('chat change aborts align before it writes', async () => {
    const host = env();
    const controller = createRefreshController(host);
    const pending = controller.align({ selected: ['point'] });
    host.setChatId('b');
    controller.abort('chat-boundary');
    const result = await pending;
    assert.equal(result.status, 'cancelled');
    assert.equal(host.writes.length, 0);
});

test('point and lines align use one confirmed batch and never partially write', async () => {
    const batches = [];
    const host = env({
        readLinesRaw: () => `<storylines_widget>
Line: 柳的调查|延展|今天|world|false|false
Desc: 旧描述
</storylines_widget>`,
        callApi: async () => `<reconcile_patch>
note: 同步修改
point: complete|体检
line: stall|柳的调查
</reconcile_patch>`,
        writeBatchRaw: async (values, options) => {
            assert.equal(options.ownerGuard(), true);
            batches.push(values);
            return { ok: false, reason: 'simulated-batch-failure' };
        },
    });
    const result = await createRefreshController(host).align({ selected: ['point', 'lines'] });
    assert.deepEqual(result, { status: 'cancelled', reason: 'simulated-batch-failure' });
    assert.equal(batches.length, 1);
    assert.equal(host.writes.length, 0);
    assert.doesNotMatch(batches[0].point, /体检/);
    assert.match(batches[0].lines, /true\|false/);
});

test('point and lines align fails closed when no atomic writer exists', async () => {
    const host = env({
        readLinesRaw: () => `<storylines_widget>
Line: 柳的调查|延展|今天|world|false|false
Desc: 旧描述
</storylines_widget>`,
        callApi: async () => 'point: complete|体检\nline: stall|柳的调查',
    });
    const result = await createRefreshController(host).align({ selected: ['point', 'lines'] });
    assert.deepEqual(result, { status: 'cancelled', reason: 'atomic-write-unavailable' });
    assert.equal(host.writes.length, 0);
});

test('align prompt tells the model to refill today when Day 1 is short', async () => {
    let prompt = '';
    const host = env({
        callApi: async (_ctx, text) => {
            prompt = text;
            return 'note: 补上体育馆协调\npoint: add|Day 1|main|场地协调|去体育馆协调场地|下午|体育馆|柳莲二计算降雨';
        },
    });
    const result = await createRefreshController(host).align({ selected: ['point'] });
    assert.equal(result.status, 'updated');
    assert.match(prompt, /今天（Day 1）还空 2 个名额/);
    assert.match(host.writes[0].raw, /场地协调/);
});

test('align prompt targets the actual today slot after the timestamp advances', async () => {
    let prompt = '';
    const host = env({
        today: () => ({ month: 3, day: 2 }),
        readPointRaw: () => `<calendar_widget>
StartDate: 2024-03-01
Day: 1
Event: main|昨天|已经过去|上午|旧地||false
Day: 2
Event: main|今天事项|仍在进行|下午|新地||false
</calendar_widget>`,
        callApi: async (_ctx, text) => {
            prompt = text;
            return 'note: 与正文一致';
        },
    });
    await createRefreshController(host).align({ selected: ['point'] });
    assert.match(prompt, /今天（Day 2）还空 2 个名额/);
    assert.match(prompt, /point: add\|Day 2\|/);
});

test('auto align omits lines when lines are off', async () => {
    const host = env({
        linesEnabled: () => false,
        enabled: () => true,
        pluginEnabled: () => true,
        interval: () => 1,
        callApi: async (_ctx, prompt) => {
            assert.equal(prompt.includes('should-not-read'), false);
            return 'note: 与正文一致';
        },
        readLinesRaw: () => 'should-not-read',
    });
    const controller = createRefreshController(host);
    const result = await controller.onAiFloor(0);
    assert.equal(result.status, 'updated');
    assert.equal(host.writes.length, 0);
});

test('same floor is seen and does not count as a new align interval', async () => {
    const host = env({ enabled: () => true, pluginEnabled: () => true, interval: () => 3 });
    const controller = createRefreshController(host);
    assert.equal((await controller.onAiFloor(0)).reason, 'interval');
    assert.equal((await controller.onAiFloor(0)).reason, 'seen');
    assert.equal(controller.state().counter, 1);
});

test('failed and unchanged aligns are written to activity', async () => {
    const activities = [];
    const failed = createRefreshController(env({
        enabled: () => true,
        pluginEnabled: () => true,
        interval: () => 1,
        onActivity: entry => activities.push(entry),
        callApi: async () => { throw new Error('boom'); },
    }));
    const fail = await failed.onAiFloor(0);
    assert.equal(fail.status, 'failed');
    assert.equal(activities[0].outcome, 'failed');
    assert.equal(failed.didReconcile(0), true);

    const quiet = [];
    const unchanged = createRefreshController(env({
        enabled: () => true,
        pluginEnabled: () => true,
        interval: () => 1,
        onActivity: entry => quiet.push(entry),
        callApi: async () => 'note: 与正文一致',
    }));
    const result = await unchanged.onAiFloor(0);
    assert.equal(result.unchanged, true);
    assert.equal(quiet[0].outcome, 'unchanged');
    assert.match(quiet[0].note, /0楼没有变化/);
});

test('reroll on an align floor requests a replacement align', async () => {
    const calls = [];
    const host = env({
        enabled: () => true,
        pluginEnabled: () => true,
        interval: () => 1,
        rerollAlign: async () => { calls.push('reroll'); return { status: 'updated' }; },
    });
    const controller = createRefreshController(host);
    await controller.onAiFloor(0);
    assert.equal((await controller.onAiFloor(0)).reason, 'seen');
    const reroll = await controller.onRerollAlign(0);
    assert.equal(reroll.status, 'updated');
    assert.deepEqual(calls, ['reroll']);
    assert.equal((await controller.onRerollAlign(0)).reason, 'already');
});

test('pending same-floor reroll does not consume an align interval even if lastFloor was pulled back', async () => {
    let pending = true;
    const host = env({
        enabled: () => true,
        pluginEnabled: () => true,
        interval: () => 3,
        sameFloor: () => pending,
        context: () => ({ chatId: 'a', chat: [{ is_user: true, mes: '问' }, { is_user: true, mes: '再问' }, { is_user: false, mes: '重 roll 后的正文。' }] }),
    });
    const controller = createRefreshController(host);
    controller.hydrate({ lastFloor: 0, counter: 1 });
    assert.equal((await controller.onAiFloor(2)).reason, 'seen');
    assert.deepEqual(controller.state().counter, 1);
    assert.equal(controller.state().lastFloor, 2);
    pending = false;
    assert.equal((await controller.onAiFloor(2)).reason, 'seen');
    assert.equal(controller.state().counter, 1);
});

test('reroll skips floors that were not the align floor', async () => {
    const controller = createRefreshController(env({
        enabled: () => true,
        pluginEnabled: () => true,
        interval: () => 3,
        rerollEnabled: () => true,
    }));
    await controller.onAiFloor(0);
    assert.equal((await controller.onRerollAlign(0)).reason, 'not-align-floor');
});
