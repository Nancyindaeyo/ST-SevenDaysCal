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
        getAlmanacSupplementInterval: () => 10,
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
    assert.match(html, /id="sp-tab-slip"[^>]*role="tab"/);
    assert.match(html, /id="sp-slip-wrap"[^>]*role="tabpanel"[^>]*aria-labelledby="sp-tab-slip"/);
    assert.match(html, /id="sp-slip-input"/);
    assert.match(html, /id="sp-tab-law"[^>]*role="tab"/);
    assert.match(html, /id="sp-law-wrap"[^>]*role="tabpanel"[^>]*aria-labelledby="sp-tab-law"/);
    assert.match(html, /id="sp-law-inject"/);
    assert.match(html, /id="sp-law-input"/);
    assert.match(html, /id="sp-tab-stage"[^>]*role="tab"/);
    assert.match(html, /id="sp-stage-main"/);
    assert.match(html, /id="sp-stage-beat-host"/);
    assert.match(html, /id="sp-lamp-main"/);
    assert.match(html, /id="sp-lamp-refresh-host"/);
    assert.match(html, /id="sp-almanac-supplement-interval"/);
    const stageIdx = html.indexOf('id="sp-tab-stage"');
    const lampIdx = html.indexOf('id="sp-tab-lamp"');
    const pointIdx = html.indexOf('id="sp-tab-schedule"');
    assert.ok(stageIdx < lampIdx && lampIdx < pointIdx);
    assert.match(html, /id="sp-stage-wrap"[^>]*role="tabpanel"[^>]*aria-labelledby="sp-tab-stage"/);
    assert.match(html, /sp-tab-label">日台/);
    assert.match(html, /id="sp-tab-lamp"[^>]*role="tab"/);
    assert.match(html, /id="sp-lamp-wrap"[^>]*role="tabpanel"[^>]*aria-labelledby="sp-tab-lamp"/);
    assert.match(html, /sp-tab-label">对账灯/);
    assert.match(html, /id="sp-lines-wrap"/);
    assert.match(html, /role="tablist" aria-orientation="vertical"/);
    assert.match(html, /id="sp-tab-schedule"[^>]*role="tab"[^>]*aria-selected="true"/);
    assert.match(html, /id="sp-lines-wrap"[^>]*role="tabpanel"[^>]*aria-labelledby="sp-tab-lines"/);
    assert.match(html, /id="sp-mem-source-bbb"/);
    assert.doesNotMatch(html, /sp-mem-source-qqj/);
    assert.doesNotMatch(html, /sp-mem-source-anima/);
    assert.doesNotMatch(html, /sp-mem-source-database/);
    assert.match(html, /时间戳正常/);
    assert.match(html, /正文包裹/);
    assert.match(html, /只读标签内全文/);
});
