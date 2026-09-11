import test from 'node:test';
import assert from 'node:assert/strict';
import { panelMarkup } from './markup.js';

test('panel markup keeps the shells settings bind to', () => {
    const html = panelMarkup({
        themeToggleTitle: () => '主题',
        themeToggleIcon: () => 'fa-sun',
        fabEnabled: () => true,
        refreshFoldHtml: () => '<div id="sp-refresh-bar"></div>',
        beatFoldHtml: () => '<div id="sp-beat-fold"></div>',
        activityFeature: { overlayHtml: () => '<div id="sp-activity-overlay"></div>' },
        getSettings: () => ({ uiScale: 1, notifyMode: 'lite', dashedKeepCount: 15, dashedCleanupEnabled: true }),
        hasCustomApi: true,
        cfg: { url: 'https://example.test', key: 'k', model: 'm', excludeParams: [], timeoutSec: 180, stream: false },
        escapeAttr: value => String(value ?? ''),
        escapeHtml: value => String(value ?? ''),
        storyClockStatusCopy: () => '时间戳正常',
        storyClockController: { refresh: () => ({}) },
        THEATER_COUNT_DEFAULT: 2,
        THEATER_EXPORT_BOOK: '构画-棱-导出',
        linesFeature: { dashed: { normalizeKeepCount: value => Number(value) || 15 } },
        paceStripHtml: () => '<div class="sp-pace-strip"></div>',
        collectPaceRows: () => [],
        readPaceSnapshot: () => ({}),
        getAlmanacJudgeInterval: () => 3,
        getLedgerReconcileInterval: () => 3,
        getLinesMode: () => 'manual',
        getLinesInterval: () => 2,
        outlineFeature: { judge: { getInterval: () => 3 } },
    });
    assert.match(html, /id="sp-body"/);
    assert.match(html, /id="sp-settings-overlay"/);
    assert.match(html, /id="sp-plugin-enabled"/);
    assert.match(html, /id="sp-ledger-reconcile-reroll"/);
    assert.match(html, /id="sp-almanac-wrap"/);
    assert.match(html, /id="sp-lines-wrap"/);
    assert.match(html, /role="tablist" aria-orientation="vertical"/);
    assert.match(html, /id="sp-tab-schedule"[^>]*role="tab"[^>]*aria-selected="true"/);
    assert.match(html, /id="sp-lines-wrap"[^>]*role="tabpanel"[^>]*aria-labelledby="sp-tab-lines"/);
    assert.match(html, /id="sp-mem-source-bbb"/);
    assert.doesNotMatch(html, /sp-mem-source-qqj/);
    assert.doesNotMatch(html, /sp-mem-source-anima/);
    assert.doesNotMatch(html, /sp-mem-source-database/);
    assert.match(html, /时间戳正常/);
});
