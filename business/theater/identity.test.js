import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheaterContinueSource } from './identity.js';

test('continue source stitches live ancestors then falls back to the saved parent snapshot', () => {
    const drafts = {
        a: { id: 'a', title: '一', raw: '第一段' },
        b: { id: 'b', title: '二', raw: '第二段', continuedFrom: 'a' },
    };
    const lookup = id => drafts[id] || null;
    const fromB = resolveTheaterContinueSource(drafts.b, lookup);
    assert.match(fromB.raw, /第一段/);
    assert.match(fromB.raw, /第二段/);
    const orphan = {
        id: 'c',
        title: '三',
        raw: '第三段',
        continuedFrom: 'missing',
        continueSource: { title: '二', raw: '【一】\n第一段\n\n【二】\n第二段' },
    };
    const fromOrphan = resolveTheaterContinueSource(orphan, lookup);
    assert.match(fromOrphan.raw, /第一段/);
    assert.match(fromOrphan.raw, /第三段/);
});
