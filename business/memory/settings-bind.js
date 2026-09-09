import { normalizeTagRules } from '../../utils/tag-names.js';
import { normalizeDatabaseWorldbookName } from './database.js';

export const MEMORY_SOURCE_FLAGS = Object.freeze(['useQianQianJie', 'useBaiBaiBook', 'useAnima', 'useDatabase']);

export function applyMemorySourceToggle(settings, flag, checked) {
    if (!settings || !MEMORY_SOURCE_FLAGS.includes(flag)) return settings;
    settings[flag] = !!checked;
    if (!checked) return settings;
    for (const key of MEMORY_SOURCE_FLAGS) {
        if (key !== flag) settings[key] = false;
    }
    return settings;
}

export function clampParseInt(value, { min, max, fallback }) {
    return Math.max(min, Math.min(max, parseInt(value, 10) || fallback));
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

    const bindSource = (sel, flag) => {
        $in(sel).on('change', function () {
            applyMemorySourceToggle(settings(), flag, this.checked);
            save?.();
            memory.abortAll('manual-abort');
            render?.();
        });
    };
    bindSource('#sp-mem-source-qqj', 'useQianQianJie');
    bindSource('#sp-mem-source-bbb', 'useBaiBaiBook');
    bindSource('#sp-mem-source-anima', 'useAnima');
    bindSource('#sp-mem-source-database', 'useDatabase');

    $in('#sp-mem-database-worldbook').on('change', function () {
        const value = normalizeDatabaseWorldbookName(this.value);
        settings().databaseWorldbookName = value;
        this.value = value;
        save?.();
        render?.();
    });
    $in('#sp-mem-anima-recall').on('change', function () {
        const value = clampParseInt(this.value, { min: 1, max: 50, fallback: 20 });
        settings().animaRecallCount = value;
        this.value = value;
        save?.();
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
    // input=即打即存（存 sanitize 值但不回写 value，免光标跳）；change=失焦时规范化回写显示。
    // 关键：只用 change 会在「输入框还没失焦就点保存/关面板」时丢掉那次编辑。
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
