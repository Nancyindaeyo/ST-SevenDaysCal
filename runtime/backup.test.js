import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyLocalStorage,
    applyOwnRoots,
    applySettingsPatch,
    chatTargetKey,
    collectLocalStorage,
    isExternalMetadata,
    isGouhuaBackup,
    isGouhuaLocalKey,
    isSameChatTarget,
    parseBackupText,
    pickOwnRoots,
    settingsHasSecrets,
    summarizeBackup,
    createBackupController,
    BACKUP_KIND,
} from './backup.js';

test('backup parser accepts gouhua pack and rejects garbage', () => {
    const pack = { kind: BACKUP_KIND, version: 1, settings: { fabShow: false } };
    assert.equal(isGouhuaBackup(pack), true);
    assert.equal(isGouhuaBackup({ kind: 'other', version: 1 }), false);
    assert.deepEqual(parseBackupText(JSON.stringify(pack)).settings.fabShow, false);
    assert.throws(() => parseBackupText('{'), /JSON/);
    assert.throws(() => parseBackupText('{"kind":"nope","version":1}'), /迁移包/);
});

test('own roots only copy 构画 keys', () => {
    const roots = pickOwnRoots({
        'sp-store': { version: 1, data: { 'schedule-user': { raw: 'a' } } },
        'sp-memory': { entries: [] },
        baibai_book: { keep: true },
        variables: { x: 1 },
    });
    assert.equal(!!roots['sp-store'], true);
    assert.equal(!!roots['sp-memory'], true);
    assert.equal(roots.baibai_book, undefined);
    const merged = applyOwnRoots({ baibai_book: { keep: true } }, roots);
    assert.equal(merged.baibai_book.keep, true);
    assert.equal(merged['sp-store'].data['schedule-user'].raw, 'a');
});

test('settings patch keeps API secrets and ignores pack envelope keys', () => {
    const target = { fabShow: true };
    const n = applySettingsPatch(target, { kind: 'x', apiKey: 'secret', fabShow: false, calendarTemplates: [{ id: '1' }] });
    assert.equal(target.kind, undefined);
    assert.equal(target.apiKey, 'secret');
    assert.equal(target.fabShow, false);
    assert.equal(n >= 3, true);
    assert.equal(settingsHasSecrets(target), true);
});

test('localStorage collector only takes 构画 keys', () => {
    const storage = mockStorage({
        'sp-fab-pos': '{"left":1}',
        'sp-cache-chat1-theater-draft-user': 'draft',
        'sp-cache-chat1-user': 'legacy',
        'unrelated': 'nope',
    });
    const all = collectLocalStorage(storage);
    assert.equal(all['sp-fab-pos'], '{"left":1}');
    assert.equal(all['sp-cache-chat1-user'], 'legacy');
    assert.equal(all.unrelated, undefined);
    const drafts = collectLocalStorage(storage, { draftsOnly: true });
    assert.equal(drafts['sp-cache-chat1-user'], undefined);
    assert.equal(drafts['sp-cache-chat1-theater-draft-user'], 'draft');
    const next = mockStorage({});
    applyLocalStorage(next, all, { draftsOnly: true });
    assert.equal(next.getItem('sp-cache-chat1-user'), null);
    assert.equal(next.getItem('sp-fab-pos'), '{"left":1}');
    assert.equal(isGouhuaLocalKey('sp-pos'), true);
    assert.equal(isGouhuaLocalKey('other'), false);
});

test('chat target identity and external marker', () => {
    const a = { is_group: false, chatId: 'one.jsonl', avatar_url: 'char.png', file_name: 'one' };
    const b = { is_group: false, chatId: 'one', avatar_url: 'char.png', file_name: 'one' };
    assert.equal(isSameChatTarget(a, b), true);
    assert.equal(chatTargetKey({ is_group: true, chatId: 'g1' }), 'group:g1');
    assert.equal(isExternalMetadata({ 'sp-storage': { provider: 'st-bainiaodata' } }), true);
    assert.equal(isExternalMetadata({ 'sp-store': {} }), false);
});

test('summarize mentions secrets and chat counts', () => {
    const text = summarizeBackup({
        kind: BACKUP_KIND,
        version: 1,
        exportedAt: '2026-09-09T00:00:00.000Z',
        pluginVersion: '3.6.9.1',
        settings: { apiKey: 'k' },
        localStorage: { 'sp-pos': '1' },
        currentChat: { roots: { 'sp-store': { data: {} } } },
        chats: [{ chatId: 'a', roots: { 'sp-memory': {} } }],
        coordinates: { items: [{ id: '1' }, { id: '2' }] },
        worldbooks: [{ name: '构画-棱-小剧场模板' }],
        skipped: { chatsFailed: 1, externalChats: 2 },
    });
    assert.match(text, /API/);
    assert.match(text, /其它聊天账本：1/);
    assert.match(text, /坐标收藏：2/);
    assert.match(text, /白鳥/);
});

test('controller exports current chat via getChatRoot and skips foreign metadata', async () => {
    const files = new Map();
    const storage = mockStorage({ 'sp-pos': '{"w":1}', other: 'x' });
    const settings = { apiUrl: 'http://x', apiKey: 'k', fabShow: true };
    const ctx = {
        chatId: 'now',
        characterId: 0,
        characters: [{ name: '柳', avatar: 'liu.png', chat: 'now' }],
        groups: [],
        chatMetadata: { 'sp-store': { version: 1, data: { 'schedule-user': { raw: '今天' } } }, variables: { no: 1 } },
        getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
        saveMetadata: async () => {},
    };
    const chats = {
        'liu.png': [{ file_name: 'now.jsonl' }, { file_name: 'old.jsonl' }],
    };
    const chatFiles = {
        'old|liu.png': [{ chat_metadata: { 'sp-memory': { entries: [1] }, baibai_book: true } }, { mes: '正文' }],
    };
    const controller = createBackupController({
        pluginVersion: '3.6.9.1',
        getContext: () => ctx,
        getSettings: () => settings,
        localStorage: storage,
        storageStatus: () => ({ mode: 'chat' }),
        getChatRoot: key => ctx.chatMetadata[key],
        fetch: async (url, options) => mockFetch(url, options, { chats, chatFiles }),
        readJson: async name => files.has(name) ? { missing: false, value: files.get(name) } : { missing: true, value: null },
        uploadJson: async (name, value) => { files.set(name, value); },
        loadWorldInfo: async name => name === '构画-棱-小剧场模板' ? { entries: { '1': { content: 'tpl' } } } : null,
        saveWorldInfo: async () => {},
        updateWorldInfoList: async () => {},
    });
    const pack = await controller.exportPack();
    assert.equal(pack.kind, BACKUP_KIND);
    assert.equal(pack.currentChat.roots['sp-store'].data['schedule-user'].raw, '今天');
    assert.equal(pack.chats.length, 1);
    assert.equal(pack.chats[0].chatId, 'old');
    assert.equal(pack.chats[0].roots['sp-memory'].entries[0], 1);
    assert.equal(pack.chats[0].roots.baibai_book, undefined);
    assert.equal(pack.localStorage.other, undefined);
    assert.equal(pack.worldbooks[0].name, '构画-棱-小剧场模板');

    const importedSettings = {};
    const importedStorage = mockStorage({});
    const otherMeta = { chat_metadata: { variables: { keep: 1 } } };
    const writeFiles = {
        'old|liu.png': [otherMeta, { mes: '正文' }],
    };
    const importer = createBackupController({
        getContext: () => ({ ...ctx, chatMetadata: { variables: { keep: true } } }),
        getSettings: () => importedSettings,
        saveSettings: async () => {},
        localStorage: importedStorage,
        getChatRoot: (key, opts) => {
            const meta = importer._meta || (importer._meta = {});
            if (!meta[key] && opts?.create) meta[key] = opts.factory();
            return meta[key] || null;
        },
        persistExternalRoots: () => null,
        fetch: async (url, options) => mockFetch(url, options, { chats, chatFiles: writeFiles, saved: importer }),
        readJson: async name => files.has(name) ? { missing: false, value: files.get(name) } : { missing: true, value: null },
        uploadJson: async (name, value) => { files.set(name, value); },
        loadWorldInfo: async () => null,
        saveWorldInfo: async () => { importer._books = (importer._books || 0) + 1; },
        updateWorldInfoList: async () => {},
    });
    const result = await importer.importPack(pack);
    assert.equal(importedSettings.apiKey, 'k');
    assert.equal(importedStorage.getItem('sp-pos'), '{"w":1}');
    assert.equal(result.currentChat, true);
    assert.equal(result.chats, 1);
    assert.equal(otherMeta.chat_metadata.variables.keep, 1);
    assert.equal(otherMeta.chat_metadata['sp-memory'].entries[0], 1);
    assert.equal(result.worldbooks, 1);
});

test('import writes exported current chat through chat files when another chat is open', async () => {
    const pack = {
        kind: BACKUP_KIND,
        version: 1,
        currentChat: {
            is_group: false,
            chatId: 'now',
            char_name: '柳',
            file_name: 'now',
            avatar_url: 'liu.png',
            roots: { 'sp-store': { version: 1, data: { 'schedule-user': { raw: '迁过来' } } } },
        },
        chats: [],
        settings: {},
        localStorage: {},
        worldbooks: [],
        coordinates: { index: { version: 1, items: [], tags: [] }, items: [] },
    };
    const chatFiles = {
        'now|liu.png': [{ chat_metadata: { variables: { keep: true } } }, { mes: '正文' }],
    };
    const importer = createBackupController({
        getContext: () => ({
            chatId: 'other',
            characterId: 0,
            characters: [{ name: '柳', avatar: 'liu.png', chat: 'other' }],
            chatMetadata: {},
            getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
            saveMetadata: async () => {},
        }),
        getSettings: () => ({}),
        saveSettings: async () => {},
        localStorage: mockStorage({}),
        getChatRoot: () => null,
        persistExternalRoots: () => null,
        fetch: async (url, options) => mockFetch(url, options, { chatFiles }),
        readJson: async () => ({ missing: true, value: null }),
        uploadJson: async () => {},
        loadWorldInfo: async () => null,
        saveWorldInfo: async () => {},
    });
    const result = await importer.importPack(pack);
    assert.equal(result.currentChat, false);
    assert.equal(result.chats, 1);
    assert.equal(chatFiles['now|liu.png'][0].chat_metadata.variables.keep, true);
    assert.equal(chatFiles['now|liu.png'][0].chat_metadata['sp-store'].data['schedule-user'].raw, '迁过来');
});

function mockStorage(seed) {
    const data = { ...seed };
    return {
        get length() { return Object.keys(data).length; },
        key(i) { return Object.keys(data)[i]; },
        getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
        setItem(key, value) { data[key] = String(value); },
        removeItem(key) { delete data[key]; },
    };
}

async function mockFetch(url, options, { chats = {}, chatFiles = {}, saved } = {}) {
    const body = JSON.parse(options.body || '{}');
    if (url === '/api/characters/chats') {
        return jsonOk(chats[body.avatar_url] || []);
    }
    if (url === '/api/chats/get') {
        const key = `${body.file_name}|${body.avatar_url}`;
        const payload = chatFiles[key];
        if (!payload) return { ok: false, status: 404, json: async () => ({ error: 'missing' }) };
        return jsonOk(payload);
    }
    if (url === '/api/chats/save') {
        const key = `${body.file_name}|${body.avatar_url}`;
        chatFiles[key] = body.chat;
        return jsonOk({ ok: true });
    }
    return { ok: false, status: 404, json: async () => ({}) };
}

function jsonOk(payload) {
    return { ok: true, status: 200, json: async () => payload };
}
