import test from 'node:test';
import assert from 'node:assert/strict';
import { chatStableKey, createWorldInfoHost } from './world-info-host.js';

function charOf(ctx) {
    return ctx?.characters?.[ctx?.characterId]?.avatar || null;
}

function makeHost(overrides = {}) {
    const settings = {
        wiFilter: {},
        wiFilterByChat: {},
        wiSelectionByChat: {},
        wiExcludeBooks: [],
        ...(overrides.settings || {}),
    };
    const toasts = [];
    const persists = [];
    const warns = [];
    let ctx = {
        chatId: 'c1',
        characterId: 0,
        characters: {
            0: {
                avatar: '坏狗.png',
                data: { extensions: { world: '主书' } },
            },
        },
        chatMetadata: { chat_id_hash: 'h1', world_info: [] },
        chat: [{ mes: '你好', is_system: false }],
        loadWorldInfo: async name => ({
            entries: [{ uid: '1', comment: '条目', content: `${name}正文`, disable: false }],
        }),
        getWorldInfoNames: () => ['主书', '全局书'],
        simulateWorldInfoActivation: async () => ({
            activatedEntries: [{ world: '主书', uid: '1' }],
        }),
        ...(overrides.ctx || {}),
    };
    const host = createWorldInfoHost({
        getContext: () => ctx,
        settings: () => settings,
        saveSettingsDebounced: () => persists.push('save'),
        charStableKey: charOf,
        getCharaFilename: () => '坏狗.png',
        worldInfoCore: {
            world_info: { charLore: [] },
            selected_world_info: [],
            world_info_include_names: true,
            checkWorldInfo: undefined,
            ...(overrides.worldInfoCore || {}),
        },
        tavernHelper: () => overrides.tavernHelper || null,
        vanillaWorldInfo: () => ({ globalSelect: [] }),
        equals: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(),
        showToast: (msg, _on, isError) => toasts.push([msg, isError]),
        logWarn: (message, error) => warns.push([message, error]),
        logActivationFailure: payload => warns.push(['fail', payload]),
        escapeAttr: value => String(value ?? ''),
        $in: () => ({ length: 0 }),
        ...overrides.env,
    });
    return { host, settings, toasts, persists, warns, setCtx(next) { ctx = { ...ctx, ...next }; }, ctx: () => ctx };
}

test('chatStableKey prefers hash then avatar+chatId', () => {
    assert.equal(chatStableKey({ chatMetadata: { chat_id_hash: ' abc ' } }, () => 'x.png'), 'hash:abc');
    assert.equal(chatStableKey({ chatId: 'room', characters: { 0: { avatar: '坏狗.png' } }, characterId: 0 }, charOf), 'legacy:坏狗.png:room');
    assert.equal(chatStableKey({ chatId: 'room' }, () => null), null);
});

test('first visit initializes selection from host switch and persists once', async () => {
    const { host, settings, persists } = makeHost();
    const entries = await host.getCharBookEntries();
    assert.equal(entries[0].key, '主书::1');
    const bucket = host.ensureCurrentWiSelection(undefined, entries);
    assert.equal(bucket.decisions['主书::1'], true);
    assert.equal(persists.length, 1);
    host.ensureCurrentWiSelection(undefined, entries);
    assert.equal(persists.length, 1);
});

test('legacy disabled keys only apply when this chat has no selection yet', async () => {
    const { host, settings } = makeHost({
        settings: {
            wiFilterByChat: { 'hash:h1': ['主书::1'] },
        },
    });
    const entries = await host.getCharBookEntries();
    const bucket = host.ensureCurrentWiSelection(undefined, entries);
    assert.equal(bucket.decisions['主书::1'], false);

    settings.wiSelectionByChat['hash:h1'] = { version: 1, decisions: { '主书::1': true } };
    const kept = host.ensureCurrentWiSelection(undefined, entries);
    assert.equal(kept.decisions['主书::1'], true);
});

test('exclude drops books before packing context', async () => {
    const { host, settings } = makeHost({
        settings: { wiExcludeBooks: ['主书'] },
    });
    const entries = await host.getCharBookEntries();
    assert.equal(entries.length, 0);
    host.setWiExcluded('主书', false);
    assert.deepEqual(settings.wiExcludeBooks, []);
    const restored = await host.getCharBookEntries();
    assert.equal(restored.length, 1);
});

test('buildWorldInfoContext packs activated selected entries and scopes', async () => {
    const { host } = makeHost();
    const text = await host.buildWorldInfoContext();
    assert.match(text, /【世界书】/);
    assert.match(text, /主书正文/);
    const scopedOut = await host.buildWorldInfoContext(undefined, { scopes: ['global'] });
    assert.equal(scopedOut, '');
});

test('activation failure returns empty and toasts once per notice key', async () => {
    const { host, toasts } = makeHost({
        ctx: {
            simulateWorldInfoActivation: async () => ({ activatedEntries: [{ world: '主书' }] }),
        },
        worldInfoCore: { checkWorldInfo: undefined },
    });
    assert.equal(await host.buildWorldInfoContext(), '');
    assert.equal(await host.buildWorldInfoContext(), '');
    assert.equal(toasts.length, 1);
    assert.match(toasts[0][0], /世界书激活失败/);
});
