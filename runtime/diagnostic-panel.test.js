import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticOverviewHtml, diagnosticRuntimeHtml } from './diagnostic-panel.js';

test('diagnostic panel renders an empty state and escapes error details', () => {
    assert.match(diagnosticOverviewHtml({ errors: [] }), /最近没有记录到错误/);
    const html = diagnosticOverviewHtml({
        errors: [{
            source: 'activity',
            title: '<保存失败>',
            detail: '<script>alert(1)</script>',
            module: 'fight',
            floorId: 8,
            ts: 1,
        }],
    });
    assert.match(html, /&lt;保存失败&gt;/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /改动记录 · fight · #8/);
});

test('diagnostic runtime strip shows write time, route and draft kinds without body text', () => {
    const html = diagnosticRuntimeHtml({
        lastConfirmedWrite: { at: Date.parse('2026-09-25T04:00:00.000Z'), reason: 'saveMetadata-promise-resolved' },
        utilityRoute: { status: 'invalid', reason: 'missing-key', presetName: '便宜' },
        authorDrafts: [{ kind: 'slip', text: '私笺正文' }],
    });
    assert.match(html, /最后确认写入/);
    assert.match(html, /机械 API：invalid/);
    assert.match(html, /可恢复草稿 1 份/);
    assert.doesNotMatch(html, /私笺正文/);
});
