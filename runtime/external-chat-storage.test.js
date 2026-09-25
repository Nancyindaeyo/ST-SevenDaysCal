import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    bindExternalChatStorage,
    EXTERNAL_MARKER_KEY,
    getChatRoot,
    isExternalReady,
    loadExternalChat,
    migrateCurrentChat,
    persistExternalRoots,
    probeExternalBackend,
    storageStatus,
} from './external-chat-storage.js';

const HEALTH_OK = {
    apiVersion: 1,
    capabilities: { records: true, recordList: true, optimisticRevision: true, atomicReplace: true },
};

const MARKER = {
    provider: 'st-bainiaodata',
    schemaVersion: 1,
    collection: 'col',
    currentRecord: 'current',
    diagnosticsRecord: 'diagnostics',
};

function jsonResponse(data, { ok = true, status = 200 } = {}) {
    return { ok, status, json: async () => data };
}

function recordIdOf(url) {
    return decodeURIComponent(String(url).split('/').pop() || '');
}

function currentEnvelope(roots = { keep: true }, revision = 1) {
    return { recordId: 'current', revision, data: { schemaVersion: 1, roots: { 'sp-store': roots } } };
}

// Diagnostics persist on every successful load. Only `/current` PUTs may fail
// in write-path tests, or the diagnostic write marks the singleton unavailable.
function backendFetch({ listed = currentEnvelope(), readBack, onPutCurrent } = {}) {
    return async (url, options = {}) => {
        const path = String(url);
        if (path.endsWith('/health')) return jsonResponse(HEALTH_OK);
        const recordId = recordIdOf(path);
        if (options.method === 'PUT') {
            if (recordId === 'current' && onPutCurrent) return onPutCurrent(path, options);
            const data = JSON.parse(options.body).data;
            return jsonResponse({ recordId, revision: 1, data });
        }
        if (recordId === 'current') return jsonResponse(readBack || listed);
        return jsonResponse([listed]);
    };
}

async function resetStorage(over = {}) {
    bindExternalChatStorage({
        getContext: () => ({ chatId: '' }),
        fetchImpl: async () => jsonResponse(null, { ok: false, status: 404 }),
        coreModule: {},
        nativeHostBridge: { captureTarget: () => null, readTarget: async () => ({ metadata: undefined, messages: [] }) },
        onChange() {},
    });
    await loadExternalChat({ force: true });
    bindExternalChatStorage(over);
    return loadExternalChat({ force: true });
}

describe('external chat storage', { concurrency: 1 }, () => {
test('probe reports missing backend and incomplete capabilities', async () => {
    await resetStorage({
        getContext: () => ({ chatId: 'c1', getRequestHeaders: () => ({}) }),
        fetchImpl: async () => { throw Object.assign(new Error('down'), { code: 'network' }); },
    });
    const down = await probeExternalBackend();
    assert.equal(down.ok, false);

    await resetStorage({
        getContext: () => ({ chatId: 'c1', getRequestHeaders: () => ({}) }),
        fetchImpl: async () => jsonResponse({ apiVersion: 1, capabilities: { records: true } }),
    });
    const partial = await probeExternalBackend();
    assert.equal(partial.ok, false);
    assert.equal(partial.reason, 'capability-mismatch');
});

test('network failure keeps chat metadata and does not treat it as empty', async () => {
    const metadata = {
        [EXTERNAL_MARKER_KEY]: MARKER,
        'sp-store': { data: { keep: true } },
    };
    await resetStorage({
        getContext: () => ({ chatId: 'c1', chatMetadata: metadata, getRequestHeaders: () => ({}) }),
        fetchImpl: async () => { throw Object.assign(new Error('down'), { code: 'network' }); },
        nativeHostBridge: { captureTarget: () => ({ native: true, chatId: 'c1' }) },
    });
    const status = await loadExternalChat({ force: true });
    assert.equal(status.status, 'unavailable');
    assert.equal(metadata['sp-store'].data.keep, true);
    assert.equal(metadata[EXTERNAL_MARKER_KEY].collection, 'col');
    assert.equal(getChatRoot('sp-store'), null);
});

test('CAS conflict stops overwrite and keeps chat metadata', async () => {
    const metadata = { [EXTERNAL_MARKER_KEY]: MARKER, 'sp-store': { data: { keep: true } } };
    const currentPuts = [];
    await resetStorage({
        getContext: () => ({ chatId: 'c1', chatMetadata: metadata, getRequestHeaders: () => ({}) }),
        nativeHostBridge: { captureTarget: () => ({ native: true, chatId: 'c1' }) },
        fetchImpl: backendFetch({
            listed: currentEnvelope({ keep: true }),
            readBack: currentEnvelope({ other: true }, 3),
            onPutCurrent(path) {
                currentPuts.push(path);
                return jsonResponse({ message: 'conflict', error: 'cas-conflict' }, { ok: false, status: 409 });
            },
        }),
    });
    const loaded = await loadExternalChat({ force: true });
    assert.equal(loaded.status, 'ready', loaded.error || loaded.status);
    assert.equal(isExternalReady(), true, JSON.stringify(storageStatus()));
    await assert.rejects(() => persistExternalRoots({ confirmed: true }), error => error.status === 409);
    assert.equal(currentPuts.length, 1);
    assert.match(storageStatus().error || '', /并发冲突/);
    assert.equal(storageStatus().pendingCurrent, true);
    assert.equal(metadata['sp-store'].data.keep, true);
});

test('unknown commit does not auto-retry put', async () => {
    const currentPuts = [];
    await resetStorage({
        getContext: () => ({ chatId: 'c1', chatMetadata: { [EXTERNAL_MARKER_KEY]: MARKER }, getRequestHeaders: () => ({}) }),
        nativeHostBridge: { captureTarget: () => ({ native: true, chatId: 'c1' }) },
        fetchImpl: backendFetch({
            listed: currentEnvelope({ x: 1 }),
            readBack: currentEnvelope({}),
            onPutCurrent(path) {
                currentPuts.push(path);
                throw Object.assign(new Error('timeout'), { code: 'timeout' });
            },
        }),
    });
    const loaded = await loadExternalChat({ force: true });
    assert.equal(loaded.status, 'ready', loaded.error || loaded.status);
    const unknown = await persistExternalRoots({ confirmed: true });
    assert.equal(unknown.commitState, 'unknown');
    assert.equal(unknown.dispatched, true);
    const merged = await persistExternalRoots({ confirmed: true });
    assert.equal(merged.reason, 'merged-into-pending');
    assert.equal(merged.dispatched, false);
    assert.equal(currentPuts.length, 1);
});

test('unknown put confirms when read-back matches written data', async () => {
    const currentPuts = [];
    const written = currentEnvelope({ keep: true });
    await resetStorage({
        getContext: () => ({ chatId: 'c1', chatMetadata: { [EXTERNAL_MARKER_KEY]: MARKER }, getRequestHeaders: () => ({}) }),
        nativeHostBridge: { captureTarget: () => ({ native: true, chatId: 'c1' }) },
        fetchImpl: backendFetch({
            listed: written,
            readBack: written,
            onPutCurrent(path) {
                currentPuts.push(path);
                throw Object.assign(new Error('timeout'), { code: 'timeout' });
            },
        }),
    });
    await loadExternalChat({ force: true });
    const confirmed = await persistExternalRoots({ confirmed: true });
    assert.equal(confirmed.commitState, 'confirmed');
    assert.equal(confirmed.confirmedAfterUnknown, true);
    assert.equal(currentPuts.length, 1);
    assert.equal(isExternalReady(), true);
});

test('migration read-back mismatch does not write the marker', async () => {
    const metadata = {};
    await resetStorage({
        getContext: () => ({
            chatId: 'a',
            chatMetadata: metadata,
            chat: [],
            getRequestHeaders: () => ({}),
        }),
        nativeHostBridge: {
            captureTarget: () => ({ native: true, chatId: 'a' }),
            readTarget: async () => ({ metadata: { integrity: { v: 1 } }, messages: [] }),
            publish: async () => { throw new Error('should-not-publish-after-read-back-fail'); },
        },
        fetchImpl: async (url, options = {}) => {
            const path = String(url);
            if (path.endsWith('/health')) return jsonResponse(HEALTH_OK);
            if (options.method === 'PUT') {
                const data = JSON.parse(options.body).data;
                return jsonResponse({ recordId: recordIdOf(path), revision: 1, data });
            }
            if (options.method === 'DELETE') return jsonResponse({ ok: true });
            if (recordIdOf(path) === 'current') {
                return jsonResponse({ recordId: 'current', revision: 1, data: { schemaVersion: 1, roots: { 'sp-store': { other: true } } } });
            }
            return jsonResponse({ recordId: recordIdOf(path), revision: 1, data: { schemaVersion: 1, floors: [] } });
        },
    });
    const result = await migrateCurrentChat();
    assert.equal(result.ok, false);
    assert.match(String(result.error?.message || result.reason || ''), /回读校验失败/);
    assert.equal(metadata[EXTERNAL_MARKER_KEY], undefined);
    assert.equal(storageStatus().mode, 'chat');
});

test('migration aborts on chat switch and does not write the new chat', async () => {
    let chatId = 'a';
    const metadata = {};
    await resetStorage({
        getContext: () => ({
            chatId,
            chatMetadata: metadata,
            chat: [],
            getRequestHeaders: () => ({}),
        }),
        nativeHostBridge: {
            captureTarget: () => ({ native: true, chatId: 'a' }),
            readTarget: async () => ({ metadata: { integrity: { v: 1 } }, messages: [] }),
        },
        fetchImpl: async (url, options = {}) => {
            const path = String(url);
            if (path.endsWith('/health')) {
                chatId = 'b';
                return jsonResponse(HEALTH_OK);
            }
            if (options.method === 'PUT') throw new Error('should-not-copy-after-switch');
            return jsonResponse(HEALTH_OK);
        },
    });
    const result = await migrateCurrentChat();
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'chat-changed');
    assert.equal(metadata[EXTERNAL_MARKER_KEY], undefined);
    assert.equal(storageStatus().mode, 'chat');
});
});
