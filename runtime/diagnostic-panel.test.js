import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticOverviewHtml } from './diagnostic-panel.js';

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
