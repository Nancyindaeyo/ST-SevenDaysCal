import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeOutlineBeats } from './schema.js';
import { appendOutlineNodes, canPartialOutlineRegen, normalizeOutlineRegenMode, replaceOutlineNode } from './regen.js';

const beat = (title, extra = '场景') => ({
    time: '初期', title, type: '主线', line: '主线', outcome: '推进',
    scene: extra, subtext: '题记', think: '因为剧情需要',
});

const raw = beats => serializeOutlineBeats(beats);

test('replaceOutlineNode only rewrites the cursor beat', () => {
    const existing = raw([beat('开端'), beat('转折')]);
    const incoming = raw([beat('改过的开端', '新场景')]);
    const merged = replaceOutlineNode(existing, incoming, 1);
    assert.equal(merged.ok, true);
    assert.match(merged.raw, /改过的开端/);
    assert.match(merged.raw, /转折/);
    assert.equal(/开端/.test(merged.raw.replace('改过的开端', '')), false);
});

test('appendOutlineNodes keeps old beats', () => {
    const existing = raw([beat('开端')]);
    const incoming = raw([beat('下一章')]);
    const merged = appendOutlineNodes(existing, incoming);
    assert.equal(merged.ok, true);
    assert.match(merged.raw, /开端/);
    assert.match(merged.raw, /下一章/);
    assert.deepEqual(merged.titles, ['下一章']);
});

test('partial regen needs existing outline and a current/continue mode', () => {
    assert.equal(normalizeOutlineRegenMode(''), 'current');
    assert.equal(canPartialOutlineRegen(raw([beat('开端')]), 'current'), true);
    assert.equal(canPartialOutlineRegen('', 'current'), false);
    assert.equal(canPartialOutlineRegen(raw([beat('开端')]), 'all'), false);
});
