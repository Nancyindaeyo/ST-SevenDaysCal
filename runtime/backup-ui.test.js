import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_KIND } from './backup.js';
import { createBackupUiActions } from './backup-ui.js';

test('backup ui rehearsal confirms preview and never writes', async () => {
    const calls = [];
    const pack = {
        kind: BACKUP_KIND,
        version: 1,
        pluginVersion: '3.15.8',
        currentChat: { is_group: false, chatId: 'now', avatar_url: 'liu.png', char_name: '柳', roots: { 'sp-store': { data: { a: 1 } } } },
        chats: [],
        settings: {},
        localStorage: {},
        worldbooks: [],
        coordinates: { items: [] },
        excerpts: { items: [] },
    };
    const ui = createBackupUiActions({
        confirm: async options => { calls.push(options.title); return true; },
        toast: message => calls.push(message),
        getContext: () => ({ chatId: 'now', characters: [{ name: '柳', avatar: 'liu.png', chat: 'now' }], characterId: 0 }),
        createController: () => { calls.push('controller'); return { importPack: async () => { throw new Error('should not write'); } }; },
        reload: () => calls.push('reload'),
    });
    const result = await ui.importPack({ text: async () => JSON.stringify(pack) }, { rehearse: true });
    assert.equal(result.status, 'rehearsed');
    assert.equal(result.preview.schemaVersion, 1);
    assert.deepEqual(calls, ['迁移包演练（不落盘）']);
});
