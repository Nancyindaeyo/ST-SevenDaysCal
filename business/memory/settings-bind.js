import { normalizeTagRules } from '../../utils/tag-names.js';

export function applyBaiBaiBookToggle(settings, checked) {
    if (!settings) return settings;
    settings.useBaiBaiBook = !!checked;
    settings.useAnima = false;
    settings.useDatabase = false;
    settings.useQianQianJie = false;
    return settings;
}

export function clampParseInt(value, { min, max, fallback }) {
    const n = parseInt(value, 10);
    const parsed = Number.isFinite(n) ? n : fallback;
    return Math.max(min, Math.min(max, parsed));
}

export function sanitizeTagList(raw) {
    return normalizeTagRules(raw).join(',');
}

export function bindMemorySettings(env = {}) {
    const $in = env.$in;
    const $ = env.$;
    const settings = env.settings;
    const save = env.save;
    const saveNow = env.saveNow || save;
    const memory = env.memory;
    const render = env.render;
    const toast = env.toast;
    const diag = env.diagnosticMessage;

    $in('#sp-mem-source-bbb').on('change', function () {
        applyBaiBaiBookToggle(settings(), this.checked);
        save?.();
        memory.abortAll('manual-abort');
        render?.();
    });

    $in('#sp-mem-enabled').on('change', function () {
        settings().memoryEnabled = this.checked;
        save?.();
        if (!this.checked) memory.abortAll('manual-abort');
    });
    $in('#sp-mem-l0').on('change', function () {
        const v = clampParseInt(this.value, { min: 1, max: 30, fallback: 5 });
        settings().memoryL0Group = v;
        this.value = v;
        save?.();
    });
    $in('#sp-mem-l1').on('change', function () {
        const v = clampParseInt(this.value, { min: 2, max: 30, fallback: 10 });
        settings().memoryL1Group = v;
        this.value = v;
        save?.();
    });
    $in('#sp-mem-skipshort').on('change', function () {
        const v = clampParseInt(this.value, { min: 0, max: 500, fallback: 50 });
        settings().memorySkipShort = v;
        this.value = v;
        save?.();
    });
    const bindTagField = (sel, key) => {
        $in(sel).on('input', function () {
            settings()[key] = sanitizeTagList(this.value);
            save?.();
        }).on('change', function () {
            const v = sanitizeTagList(this.value);
            settings()[key] = v;
            this.value = v;
            save?.();
            saveNow?.();
        });
    };
    bindTagField('#sp-mem-keeptags', 'keepTags');
    bindTagField('#sp-mem-extratags', 'extraTags');
    $in('#sp-custom-prompt').on('input', function () {
        settings().customPrompt = this.value;
        save?.();
    }).on('blur', function () {
        settings().customPrompt = this.value;
        saveNow?.();
    });
    $in('#sp-space-persona').on('input', function () {
        settings().spacePersona = this.value;
        save?.();
    }).on('blur', function () {
        settings().spacePersona = this.value;
        saveNow?.();
    });
    $in('#sp-storyclock-prompt').on('input', function () {
        settings().storyClockPrompt = this.value;
        settings().storyClockPromptVersion = 2;
        save?.();
        try { env.refreshStoryClock?.({ announce: true }); } catch {}
    }).on('blur', function () {
        settings().storyClockPrompt = this.value;
        settings().storyClockPromptVersion = 2;
        saveNow?.();
    });
    $in('#sp-storyclock-prompt-load').on('click', function () {
        const fullDefault = env.defaultStoryClockPrompt?.() || '';
        $in('#sp-storyclock-prompt').val(fullDefault);
        settings().storyClockPrompt = fullDefault;
        settings().storyClockPromptVersion = 2;
        saveNow?.();
        try { env.refreshStoryClock?.({ announce: true }); } catch {}
        try { toast?.('已把默认强制词载入编辑框，可直接修改'); } catch {}
    });
    $in('#sp-storyclock-prompt-reset').on('click', function () {
        $in('#sp-storyclock-prompt').val('');
        settings().storyClockPrompt = '';
        settings().storyClockPromptVersion = 2;
        saveNow?.();
        try { env.refreshStoryClock?.({ announce: true }); } catch {}
        try { toast?.('已恢复内置默认（跟随插件更新）'); } catch {}
    });
    $in('#sp-mem-check').on('click', function () {
        env.refreshStatus?.();
        toast?.('已刷新记忆状态');
    });
    $in('#sp-mem-fill').on('click', async function () {
        if ($(this).prop('disabled')) return;
        env.setProgressVisible?.(true);
        $(this).prop('disabled', true);
        try {
            await memory.fillMissing(({ current, total, done }) => {
                env.updateProgress?.(current, total);
                if (current % 3 === 0 || done) env.refreshStatus?.();
            });
            toast?.('补齐完成');
        } catch (err) {
            toast?.('补齐失败：' + diag?.(err), null, true);
        } finally {
            $(this).prop('disabled', false);
            env.setProgressVisible?.(false);
            env.refreshStatus?.();
        }
    });
    $in('#sp-mem-rebuild').on('click', async function () {
        const r = memory.getHealthReport();
        const cost = r.totalGroups;
        const ok = await env.confirm?.({
            title: '推翻重构',
            body: `将清空全部摘要并按当前分组重新生成，约需 ${cost} 次 L0 API 调用 + 若干次 L1 压缩。`,
            note: '重构期间可随时中止；中止会还原到重构前的记忆、不会清空。已有的点 / 线 / 面 不受影响。',
            confirmText: '开始重构',
            cancelText: '取消',
        });
        if (!ok) return;
        if ($(this).prop('disabled')) return;
        env.setProgressVisible?.(true);
        $(this).prop('disabled', true);
        let wasAborted = false;
        try {
            await memory.rebuildAll(({ current, total, done, aborted }) => {
                if (aborted) wasAborted = true;
                env.updateProgress?.(current, total, aborted);
                if (current % 3 === 0 || done || aborted) env.refreshStatus?.();
            });
            toast?.(wasAborted ? '已中止，已还原到重构前的记忆' : '重构完成');
        } catch (err) {
            toast?.('重构失败：' + diag?.(err), null, true);
        } finally {
            $(this).prop('disabled', false);
            env.setProgressVisible?.(false);
            env.refreshStatus?.();
        }
    });
    $in('#sp-mem-progress-abort').on('click', () => memory.abortRebuild());
}
