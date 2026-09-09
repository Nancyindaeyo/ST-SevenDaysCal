export function clampUiScale(value) {
    return Math.min(1.3, Math.max(0.8, Math.round(Number(value) * 20) / 20));
}

export function clampSettingCount(value, { min = 1, max = Infinity, fallback = min } = {}) {
    const n = Math.max(min, Math.min(max, Math.floor(Number(value) || fallback)));
    return Number.isFinite(n) ? n : fallback;
}

function bindCheck($in, selector, field, { settings, persist, after } = {}) {
    $in(selector).on('change', function () {
        settings()[field] = this.checked;
        persist?.();
        after?.(this.checked, this);
    });
}

function bindCount($in, selector, field, { settings, persist, min = 1, max = Infinity, fallback = min, after } = {}) {
    $in(selector).on('change', function () {
        const n = clampSettingCount(this.value, { min, max, fallback });
        settings()[field] = n;
        this.value = String(n);
        persist?.();
        after?.(n, this);
    });
}

export function bindSettingsPanel(env = {}) {
    const $in = env.$in;
    const settings = env.settings;
    const save = env.save;
    const saveNow = env.saveNow || save;

    $in('#sp-settings-overlay')
        .off('change.spLinesMode', 'input[name="sp-lines-mode"]')
        .on('change.spLinesMode', 'input[name="sp-lines-mode"]', function () {
            env.saveLinesMode?.(this.value);
            env.resetLinesCounter?.();
            env.rememberPace?.();
        });
    $in('#sp-scale-row').on('change.autoSave', 'input[name="sp-lines-scale"]', function () {
        const charKey = env.charKey?.();
        if (!charKey) return;
        env.setScale?.(charKey, this.value);
        env.refreshLinesInjection?.();
    });
    $in('#sp-adult-row').on('change.autoSave', 'input[name="sp-lines-adult-mode"]', function () {
        const charKey = env.charKey?.();
        if (!charKey) return;
        env.setAdultMode?.(charKey, this.value);
        env.refreshLinesInjection?.();
    });

    bindCheck($in, '#sp-plugin-enabled', 'pluginEnabled', {
        settings, persist: saveNow, after: on => env.applyPluginEnabled?.(on),
    });
    bindCheck($in, '#sp-inject-enabled', 'injectEnabled', {
        settings, persist: save, after: () => {
            env.refreshLinesInjection?.();
            env.refreshOutlineInjection?.();
            env.refreshLedgerInjection?.();
        },
    });
    bindCheck($in, '#sp-lines-enabled', 'linesEnabled', {
        settings, persist: save, after: () => {
            env.backfillInline?.();
            env.paintPaceSoon?.();
        },
    });
    bindCheck($in, '#sp-lines-inline-enabled', 'linesInlineEnabled', {
        settings, persist: save, after: () => env.refreshInline?.(true),
    });
    bindCheck($in, '#sp-almanac-inline-enabled', 'almanacInlineEnabled', {
        settings, persist: save, after: () => env.refreshInline?.(true),
    });
    bindCheck($in, '#sp-schedule-inline-enabled', 'scheduleInlineEnabled', {
        settings, persist: save, after: () => env.refreshInline?.(true),
    });
    bindCheck($in, '#sp-adult-blur-enabled', 'adultBlurEnabled', {
        settings, persist: save, after: () => {
            env.onAdultBlurChanged?.();
            env.refreshInline?.(true);
        },
    });
    bindCheck($in, '#sp-ledger-inline-enabled', 'ledgerInlineEnabled', {
        settings, persist: save, after: () => env.refreshInline?.(true),
    });
    bindCheck($in, '#sp-recall-inline-enabled', 'recallInlineEnabled', {
        settings, persist: save, after: () => env.refreshInline?.(true),
    });
    bindCount($in, '#sp-inline-render-depth', 'inlineRenderDepth', {
        settings, persist: save, min: 0, fallback: 0, after: () => env.refreshInline?.(true),
    });
    bindCheck($in, '#sp-lines-inject', 'linesInject', {
        settings, persist: save, after: () => env.refreshLinesInjection?.(),
    });
    bindCheck($in, '#sp-storyclock-enabled', 'storyClockEnabled', {
        settings, persist: save, after: () => {
            env.refreshStoryClockInjection?.({ announce: true });
            if (env.isAlmanacMode?.()) env.renderAlmanacPanel?.();
        },
    });
    bindCheck($in, '#sp-dashed-enabled', 'dashedEnabled', {
        settings, persist: save, after: () => {
            if (env.isLinesMode?.()) env.refreshLinesPanel?.();
            env.syncLatestInlineBlock?.();
            env.paintPaceSoon?.();
        },
    });
    bindCount($in, '#sp-dashed-interval', 'dashedAutoInterval', {
        settings, persist: save, fallback: 6, after: () => {
            env.resetDashedAuto?.();
            env.rememberPace?.();
        },
    });
    bindCheck($in, '#sp-dashed-cleanup-enabled', 'dashedCleanupEnabled', {
        settings, persist: save, after: on => {
            $in('#sp-dashed-keep-count').prop('disabled', !on);
            if (on) env.cleanupDashed?.(true);
        },
    });
    $in('#sp-dashed-keep-count').on('change', function () {
        const count = env.normalizeDashedKeepCount?.(this.value) ?? clampSettingCount(this.value, { fallback: 15 });
        settings().dashedKeepCount = count;
        this.value = String(count);
        save();
        if (settings().dashedCleanupEnabled !== false) env.cleanupDashed?.(true);
    });
    bindCheck($in, '#sp-outline-inject', 'outlineInject', {
        settings, persist: save, after: () => {
            env.resetOutlineJudge?.();
            env.refreshOutlineInjection?.();
            if (env.isOutlineMode?.()) env.refreshOutlinePanel?.();
        },
    });
    bindCheck($in, '#sp-outline-judge', 'outlineJudgeEnabled', {
        settings, persist: save, after: () => {
            env.resetOutlineJudge?.();
            env.rememberPace?.();
        },
    });
    bindCheck($in, '#sp-lines-advance-latest', 'linesAdvanceIncludeLatest', { settings, persist: save });
    bindCount($in, '#sp-outline-judge-interval', 'outlineJudgeInterval', {
        settings, persist: save, fallback: 3, after: () => {
            env.resetOutlineJudge?.();
            env.rememberPace?.();
        },
    });
    bindCheck($in, '#sp-almanac-autodetect', 'almanacAutoDetect', {
        settings, persist: save, after: () => {
            env.resetDateCounter?.();
            env.rememberPace?.();
        },
    });
    bindCount($in, '#sp-almanac-judge-interval', 'almanacJudgeInterval', {
        settings, persist: save, fallback: 3, after: () => {
            env.resetDateCounter?.();
            env.rememberPace?.();
        },
    });

    const applyUiScale = v => {
        const s = clampUiScale(v);
        settings().uiScale = s;
        document.documentElement.style.setProperty('--sp-scale', String(s));
        $in('#sp-uiscale-val').text(Math.round(s * 100) + '%');
        save();
    };
    $in('#sp-uiscale-minus').on('click', () => applyUiScale((Number(settings().uiScale) || 1) - 0.05));
    $in('#sp-uiscale-plus').on('click', () => applyUiScale((Number(settings().uiScale) || 1) + 0.05));
    $in('#sp-font-apply').on('click', async () => {
        const url = ($in('#sp-cfg-font-url').val() || '').trim();
        if (!url) {
            env.toast?.('字体 CSS URL 不能为空，未修改现有字体', null, true);
            return;
        }
        try {
            const response = await (env.fetch || fetch)(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const family = env.parseFontFamily?.(await response.text());
            if (!family) throw new Error('未找到有效的 @font-face font-family');
            settings().uiFontUrl = url;
            settings().uiFontFamily = family;
            save();
            env.applyUiFont?.();
            env.toast?.(`字体已应用：${family}`);
        } catch (error) {
            console.warn('[SP font] CSS 读取或解析失败', error);
            env.toast?.('字体 CSS 读取失败，未修改现有字体；请检查 URL 或 CSS 中的 @font-face', null, true);
        }
    });
    $in('#sp-font-reset').on('click', () => {
        settings().uiFontUrl = env.fontDefaultUrl;
        settings().uiFontFamily = env.fontDefaultFamily;
        $in('#sp-cfg-font-url').val(env.fontDefaultUrl);
        save();
        env.applyUiFont?.();
        env.toast?.('已恢复默认字体');
    });

    bindCheck($in, '#sp-ledger-reconcile', 'ledgerReconcileEnabled', {
        settings, persist: save, after: () => {
            env.resetAlignCounter?.();
            env.rememberPace?.();
        },
    });
    bindCount($in, '#sp-ledger-reconcile-interval', 'ledgerReconcileInterval', {
        settings, persist: save, min: 1, max: 30, fallback: 3, after: () => {
            env.resetAlignCounter?.();
            env.rememberPace?.();
        },
    });
    bindCheck($in, '#sp-ledger-inject', 'ledgerInject', {
        settings, persist: save, after: () => {
            env.refreshLedgerInjection?.();
            env.refreshInline?.(true);
        },
    });
    bindCheck($in, '#sp-ledger-capture-enabled', 'ledgerCaptureEnabled', {
        settings, persist: save, after: () => {
            env.resetLedgerCaptureCounter?.();
            env.rememberPace?.();
        },
    });
    bindCount($in, '#sp-ledger-capture-interval', 'ledgerCaptureInterval', {
        settings, persist: save, min: 1, max: 30, fallback: 5, after: () => {
            env.resetLedgerCaptureCounter?.();
            env.rememberPace?.();
        },
    });
    bindCount($in, '#sp-ledger-judge-interval', 'ledgerJudgeInterval', {
        settings, persist: save, min: 1, max: 30, fallback: 4, after: () => {
            env.resetLedgerJudgeCounter?.();
            env.rememberPace?.();
        },
    });
    bindCheck($in, '#sp-inline-render-enabled', 'inlineRenderEnabled', {
        settings, persist: save, after: () => env.refreshInline?.(true),
    });
    $in('input[name="sp-notify-mode"]').on('change', function () {
        settings().notifyMode = $in('input[name="sp-notify-mode"]:checked').val();
        save();
    });
    bindCheck($in, '#sp-anchor-inline-btn', 'anchorInlineBtn', {
        settings, persist: save, after: () => env.scanAnchorButtons?.(),
    });
    $in('#sp-lines-interval').on('input change', function () {
        const n = Number(this.value);
        if (!Number.isInteger(n) || n < 1) return;
        env.saveLinesInterval?.(n);
        this.value = String(n);
        env.paintPaceSoon?.();
    });
}
