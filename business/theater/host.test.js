import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    createTheaterHost,
    readTheaterSnapshotContext,
    saveTheaterSnapshotToCoordinate,
    theaterParticipantNames,
    theaterSettingsSlice,
} from './host.js';

test('settings and names slices keep empty-prompt and missing-name defaults', () => {
    assert.deepEqual(theaterParticipantNames({}), { userName: '用户', charName: '角色' });
    assert.deepEqual(theaterParticipantNames({ name1: '甲', name2: '乙' }), { userName: '甲', charName: '乙' });
    assert.deepEqual(theaterSettingsSlice({ theaterStylePrompt: 1, theaterCount: 3, theaterPoolBooks: 'nope' }), {
        theaterStylePrompt: '',
        theaterCount: 3,
        theaterPoolBooks: [],
    });
    assert.deepEqual(theaterSettingsSlice({ theaterStylePrompt: '冷', theaterPoolBooks: ['a'] }), {
        theaterStylePrompt: '冷',
        theaterCount: undefined,
        theaterPoolBooks: ['a'],
    });
});

test('snapshot context reads chat poles and saveFromTheater stays an injected coordinate port', () => {
    const documentRef = {
        querySelector() {
            return { value: '', textContent: '  楼名  ' };
        },
    };
    assert.deepEqual(readTheaterSnapshotContext({
        chatId: 'c1',
        chatMetadata: { chat_id_hash: 'h1' },
        name2: '角色甲',
    }, documentRef), {
        chatId: 'c1',
        chatIdHash: 'h1',
        chatName: '楼名',
        charName: '角色甲',
    });

    assert.throws(() => saveTheaterSnapshotToCoordinate({ id: 1 }), /坐标还没就绪/);
    assert.throws(() => saveTheaterSnapshotToCoordinate({ id: 1 }, () => ({ feature: {} })), /坐标还没就绪/);
    const saved = [];
    assert.equal(saveTheaterSnapshotToCoordinate({ id: 1 }, () => ({
        feature: { saveFromTheater: item => { saved.push(item); return 'ok'; } },
    })), 'ok');
    assert.deepEqual(saved, [{ id: 1 }]);
});

test('createTheaterHost late-binds captureTarget and does not hide coordinate or world-info', async () => {
    let capturedPorts;
    const runtimeCapture = [];
    const feature = { id: 'theater-feature' };
    const result = createTheaterHost({
        createRuntime: host => {
            capturedPorts = host.ports;
            return {
                feature,
                captureTarget: chatId => {
                    runtimeCapture.push(chatId);
                    return { chatId, from: 'runtime' };
                },
            };
        },
        createPorts: d => d,
        ports: { captureTarget: () => ({ from: 'ports-should-not-win' }) },
        listWorldNames: () => ['book-a'],
        syncSettingsPoolList: () => 'synced',
        snapshotContext: () => ({ chatId: 'snap' }),
        saveSnapshot: item => `saved:${item.id}`,
        names: () => ({ userName: '甲', charName: '乙' }),
        settings: () => ({ theaterCount: 2 }),
    });
    assert.equal(result, feature);
    assert.deepEqual(capturedPorts.captureTarget('c9'), { chatId: 'c9', from: 'runtime' });
    assert.deepEqual(runtimeCapture, ['c9']);
    assert.deepEqual(capturedPorts.listWorldNames(), ['book-a']);
    assert.equal(capturedPorts.syncSettingsPoolList(), 'synced');
    assert.deepEqual(capturedPorts.snapshotContext(), { chatId: 'snap' });
    assert.equal(capturedPorts.saveSnapshot({ id: 7 }), 'saved:7');

    const source = await readFile(new URL('./host.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /world-info-host|getAllWorldNames|coordinate\/runtime/);
});
