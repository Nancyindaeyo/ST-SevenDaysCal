import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGouhuaBackupController } from './backup-host.js';

test('backup host wires coordinate json and world-info through injected getContext', () => {
    const calls = [];
    const ctx = {
        loadWorldInfo: name => { calls.push(['load', name]); return { entries: {} }; },
        saveWorldInfo: (name, data, immediate) => calls.push(['save', name, data, immediate]),
        updateWorldInfoList: () => calls.push('update-list'),
        getRequestHeaders: () => ({ Authorization: 'yes' }),
    };
    const controller = createGouhuaBackupController({
        pluginVersion: '3.12.13',
        getContext: () => ctx,
        getSettings: () => ({ fabShow: true }),
        saveSettings: () => calls.push('save-settings'),
        localStorage: { length: 0 },
        storageStatus: () => ({ mode: 'chat' }),
        getChatRoot: () => ({}),
        persistExternalRoots: () => calls.push('persist'),
        invalidateCoordinates: () => calls.push('invalidate'),
        onProgress: info => calls.push(['progress', info.phase]),
        createCoordinatePorts: options => {
            calls.push(['coord-ports', options.context()]);
            return { id: 'ports' };
        },
        readJson: (ports, name) => { calls.push(['read', ports.id, name]); return { missing: true }; },
        uploadJson: (ports, name, value) => { calls.push(['upload', ports.id, name, value]); return '/p'; },
        createController: wired => {
            assert.equal(wired.pluginVersion, '3.12.13');
            assert.equal(wired.getContext(), ctx);
            assert.deepEqual(wired.getSettings(), { fabShow: true });
            assert.deepEqual(wired.headers(), { Authorization: 'yes' });
            assert.deepEqual(wired.readJson('index.json'), { missing: true });
            assert.equal(wired.uploadJson('index.json', { a: 1 }), '/p');
            assert.deepEqual(wired.loadWorldInfo('构画-棱-小剧场模板'), { entries: {} });
            wired.saveWorldInfo('构画-棱-小剧场模板', { entries: {} }, true);
            wired.updateWorldInfoList();
            wired.invalidateCoordinates();
            wired.onProgress({ phase: 'chats' });
            return { kind: 'controller' };
        },
    });
    assert.equal(controller.kind, 'controller');
    assert.deepEqual(calls, [
        ['coord-ports', ctx],
        ['read', 'ports', 'index.json'],
        ['upload', 'ports', 'index.json', { a: 1 }],
        ['load', '构画-棱-小剧场模板'],
        ['save', '构画-棱-小剧场模板', { entries: {} }, true],
        'update-list',
        'invalidate',
        ['progress', 'chats'],
    ]);
});

test('backup host does not import coordinate runtime or world-info host', async () => {
    const source = await readFile(new URL('./backup-host.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /import[\s\S]*coordinate\/runtime|import[\s\S]*world-info-host/);
});
