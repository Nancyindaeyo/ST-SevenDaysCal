import test from 'node:test';
import assert from 'node:assert/strict';
import {
    appendWorldInfoBook,
    collectChatWorldNames,
    collectGlobalWorldNames,
    collectLinkedWorldNames,
    filterActivatedWorldInfo,
    filterExcludedWorldInfo,
    loadCharacterWorldInfoEntries,
    nativeWorldInfoChat,
    nextExcludeBooks,
    normalizeWorldNameList,
    packWorldInfoContents,
    resolveAllWorldNames,
    resolveWorldInfoActivation,
    utf8ByteLength,
    wiExcludeSet,
    bookNameExcluded,
    worldInfoActivationEntries,
    worldInfoCandidateKey,
    worldInfoEntryFromLoaded,
    worldInfoFailureNoticeKey,
    worldInfoMaxContext,
    WORLD_INFO_TOKEN_BUDGET,
} from './world-info-context.js';

test('linked world names prefer TavernHelper then card extras', () => {
    assert.deepEqual(collectLinkedWorldNames({
        tavernHelper: { getCharLorebooks: () => ({ primary: '主书', additional: ['附1', ''] }) },
        character: { data: { extensions: { world: '卡上的书' } } },
    }), ['主书', '附1']);
    assert.deepEqual(collectLinkedWorldNames({
        character: { data: { extensions: { world: '主卡' }, character_book: { name: '内置' } } },
        extraBooks: ['额外'],
    }), ['主卡', '额外']);
    assert.deepEqual(collectLinkedWorldNames({
        character: { data: { character_book: { name: '内置' } } },
    }), ['内置']);
});

test('global world names use TH then Luker then vanilla', () => {
    assert.deepEqual(collectGlobalWorldNames({
        tavernHelper: { getLorebookSettings: () => ({ selected_global_lorebooks: ['G1', null] }) },
        lukerSelection: ['Luker'],
    }), ['G1']);
    assert.deepEqual(collectGlobalWorldNames({ lukerSelection: ['L1'] }), ['L1']);
    assert.deepEqual(collectGlobalWorldNames({ selectedWorldInfo: ['V1'] }), ['V1']);
    assert.deepEqual(collectGlobalWorldNames({ vanillaGlobalSelect: ['旧'] }), ['旧']);
});

test('chat world names flatten and dedupe', () => {
    assert.deepEqual(collectChatWorldNames(['A', 'A', ' B ']), ['A', 'B']);
    assert.deepEqual(collectChatWorldNames('solo'), ['solo']);
});

test('activation entries reject malformed luker/native payloads', () => {
    assert.equal(worldInfoActivationEntries(null, 'luker'), null);
    assert.equal(worldInfoActivationEntries({ activatedEntries: [{ world: 'a' }] }, 'luker'), null);
    const ok = worldInfoActivationEntries({ activatedEntries: [{ world: 'a', uid: '1' }] }, 'luker');
    assert.equal(ok.length, 1);
    const mixed = worldInfoActivationEntries({ activatedEntries: [{ world: 'a' }, { world: 'a', uid: '2' }] }, 'luker');
    assert.equal(mixed.length, 1);
    assert.equal(mixed[0].uid, '2');
    assert.equal(worldInfoActivationEntries({ allActivatedEntries: [{ world: 'a', uid: '1' }] }, 'native'), null);
    const native = worldInfoActivationEntries({ allActivatedEntries: new Set([{ world: 'a', uid: '1' }]) }, 'native');
    assert.equal(native[0].uid, '1');
    assert.equal(worldInfoCandidateKey(' book ', ' 3 '), 'book::3');
});

test('native world-info chat reverses and can prefix names', () => {
    const chat = [
        { name: 'A', mes: '先' },
        { name: 'B', content: '后' },
        { name: 'C', mes: '   ' },
    ];
    assert.deepEqual(nativeWorldInfoChat(chat, false), ['后', '先']);
    assert.deepEqual(nativeWorldInfoChat(chat.slice(0, 2), true), ['B: 后', 'A: 先']);
});

test('embedded hostEnabled follows V2 enabled, loaded books follow disable', () => {
    assert.equal(worldInfoEntryFromLoaded({ enabled: false, content: 'x' }, '1', '书', { scope: 'char', embedded: true }).hostEnabled, false);
    assert.equal(worldInfoEntryFromLoaded({ disable: true, content: 'x' }, '1', '书', { scope: 'char' }).hostEnabled, false);
    const items = [];
    const seen = new Set();
    appendWorldInfoBook(items, seen, { '9': { comment: '节日', content: 'abc', disable: false } }, '历', { scope: 'char' });
    appendWorldInfoBook(items, seen, { '9': { comment: '重复', content: 'no' } }, '历', { scope: 'global' });
    assert.equal(items.length, 1);
    assert.equal(items[0].label, '节日');
});

test('activation filters by selection and keys', () => {
    const entries = [
        { key: 'a::1', source: 'a', uid: '1', content: 'keep' },
        { key: 'a::2', source: 'a', uid: '2', content: 'off' },
        { key: 'b::1', source: 'b', uid: '1', content: 'other' },
    ];
    const selection = { version: 1, decisions: { 'a::1': true, 'a::2': false, 'b::1': true } };
    assert.deepEqual(filterActivatedWorldInfo(entries, { selection, keys: new Set(['a::1']) }), ['keep']);
});

test('token pack skips later entries that would blow the budget then trims if the join still overflows', async () => {
    const packed = await packWorldInfoContents(['aaaa', 'bbbb', 'cccc'], {
        budget: 10,
        countTokens: async text => ({ tokens: String(text).length, exact: true }),
    });
    assert.match(packed.text, /^【世界书】\n/);
    assert.ok(packed.skipped >= 1);
    assert.ok(packed.finalCount.tokens <= 10);
    assert.equal(WORLD_INFO_TOKEN_BUDGET, 60000);
});

test('resolveWorldInfoActivation falls back from luker to native then fails closed', async () => {
    const ctx = { maxContext: 100 };
    const luker = await resolveWorldInfoActivation(ctx, [{ mes: 'hi' }], {
        includeNames: false,
        simulate: async () => ({ activatedEntries: [{ world: 'w', uid: '1' }] }),
    });
    assert.equal(luker.supported, true);
    assert.ok(luker.keys.has('w::1'));

    const native = await resolveWorldInfoActivation(ctx, [{ mes: 'hi' }], {
        includeNames: false,
        simulate: async () => ({ activatedEntries: 'bad' }),
        checkWorldInfo: async () => ({ allActivatedEntries: new Set([{ world: 'n', uid: '2' }]) }),
    });
    assert.ok(native.keys.has('n::2'));

    const failed = await resolveWorldInfoActivation(ctx, [{ mes: 'hi' }], {
        simulate: async () => { throw new Error('luker'); },
        checkWorldInfo: async () => { throw new Error('native'); },
    });
    assert.equal(failed.failed, true);
    assert.equal(failed.lukerFailed, true);
});

test('max context and failure notice key keep host fallbacks', () => {
    assert.equal(worldInfoMaxContext({}, { getMaxPromptTokens: () => 4096 }), 4096);
    assert.equal(worldInfoMaxContext({ maxContext: 8000 }), 8000);
    assert.equal(worldInfoMaxContext({}), undefined);
    assert.equal(worldInfoFailureNoticeKey({ chatId: 'c' }, 3999), 'c:1');
    assert.equal(utf8ByteLength('a中'), 4);
});

const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

test('world name resolve uses cache then helper then refresh even if empty', async () => {
    assert.deepEqual(await resolveAllWorldNames({
        readCached: () => ['暖'],
        readHelper: () => ['助'],
        refresh: () => ['刷'],
    }), ['暖']);
    assert.deepEqual(await resolveAllWorldNames({
        readCached: () => [],
        readHelper: async () => ['助'],
    }), ['助']);
    assert.deepEqual(await resolveAllWorldNames({
        readCached: () => [],
        readHelper: () => [],
        refresh: async () => [],
    }), []);
    assert.deepEqual(normalizeWorldNameList(['B', 'A', 'A', '', 1]), ['A', 'B']);
});

test('world-book exclusion is case-insensitive and filters catalog entries', () => {
    const set = wiExcludeSet(['主书', '', 3]);
    assert.equal(bookNameExcluded('主书', set, eq), true);
    assert.equal(bookNameExcluded('主書', set, eq), false);
    assert.deepEqual(nextExcludeBooks(['主书'], '主书', false, eq), []);
    assert.deepEqual(nextExcludeBooks(['主书'], 'MAIN', true, eq), ['主书', 'MAIN']);
    const items = [{ source: '主书' }, { source: '旁书' }];
    assert.deepEqual(filterExcludedWorldInfo(items, set, eq).map(e => e.source), ['旁书']);
});

test('character world-info load keeps linked books and skips duplicate globals', async () => {
    const loads = [];
    const items = await loadCharacterWorldInfoEntries({
        loadWorldInfo: async name => {
            loads.push(name);
            return { entries: [{ uid: '1', comment: name, content: name, disable: false }] };
        },
        linkedNames: ['角色书'],
        chatNames: ['聊天书'],
        globalNames: ['角色书', '全局书'],
        personaBook: '角色书',
    });
    assert.deepEqual(loads, ['角色书', '聊天书', '全局书']);
    assert.deepEqual(items.map(e => e.scope), ['char', 'chat', 'global']);
    const fallback = await loadCharacterWorldInfoEntries({
        loadWorldInfo: async () => { throw new Error('missing'); },
        linkedNames: ['坏书'],
        characterBook: { name: '内置', entries: [{ uid: 2, comment: '卡', content: 'x', enabled: true }] },
    });
    assert.equal(fallback[0].embedded, true);
    assert.equal(fallback[0].source, '内置');
});
