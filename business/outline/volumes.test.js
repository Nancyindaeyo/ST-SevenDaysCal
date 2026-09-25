import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOutlineInjectionText, buildOutlineRelocationPrompt } from './prompts.js';
import { clampOutlineCursor, cursorAfterBeatDelete, parseOutline, serializeOutlineBeats } from './schema.js';
import { cursorVolumeTitle, groupOutlineVolumes } from './volumes.js';
import { migrateOutlineRaw } from '../identity-migrate.js';

const beat = (title, volume, extra = {}) => ({
    time: '春', title, type: '主线', line: '线', outcome: '转折',
    scene: `${title}发生了`, subtext: '题记', think: '思考', volume, ...extra,
});

test('outline ids persist locally and stay out of model prompts', () => {
    const raw = serializeOutlineBeats([
        beat('开端', '上卷', { id: 'OUTLINE-keep' }),
        beat('转折', '下卷'),
    ], { assignIds: true });
    const beats = parseOutline(raw);
    assert.equal(beats[0].id, 'OUTLINE-keep');
    assert.match(beats[1].id, /^OUTLINE-/);
    assert.equal(beats[0].volume, '上卷');
    const inject = buildOutlineInjectionText(beats, 1);
    const relocate = buildOutlineRelocationPrompt(beats, 1);
    assert.doesNotMatch(inject, /OUTLINE-/);
    assert.doesNotMatch(relocate, /OUTLINE-/);
    assert.doesNotMatch(inject, /上卷/);
});

test('volume groups keep cursor and delete history by index', () => {
    const beats = [beat('开端', '上卷', { id: 'OUTLINE-a' }), beat('转折', '下卷', { id: 'OUTLINE-b' }), beat('收束', '下卷', { id: 'OUTLINE-c' })];
    const groups = groupOutlineVolumes(beats);
    assert.deepEqual(groups.map(item => item.title), ['上卷', '下卷']);
    assert.deepEqual(groups[1].indices, [1, 2]);
    assert.equal(cursorVolumeTitle(beats, 2), '下卷');
    assert.equal(clampOutlineCursor(3, 3), 3);
    assert.equal(cursorAfterBeatDelete(2, 1), 1);
    const raw = serializeOutlineBeats(beats, { assignIds: true });
    assert.equal(migrateOutlineRaw(raw).changed, false);
    const missing = migrateOutlineRaw(raw.replace(/\nId: OUTLINE-b/, ''));
    assert.equal(missing.changed, true);
    assert.match(parseOutline(missing.raw)[1].id, /^OUTLINE-/);
});
