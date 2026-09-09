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
