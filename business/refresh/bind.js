import { readRefreshBar } from './bar.js';

export function normalizeOutlineRegenMode(value) {
    return value === 'all' || value === 'continue' ? value : 'current';
}

export function alignableRefreshSelection(selected) {
    return (selected || []).filter(name => name === 'point' || name === 'lines');
}

export function refreshAlignToast(result) {
    if (result?.status === 'invalid') return { message: '请先勾选要动的模块', error: true };
    if (result?.status === 'skipped' && result.reason === 'empty') return { message: '还没有点或线可以对齐', error: true };
    if (result?.status === 'failed') return { message: `对齐失败：${result.errorMessage || ''}`, error: true };
    return null;
}

export function refreshRegenGate(form) {
    if (!form?.selected?.length) return { message: '请先勾选要重新生成的模块', error: true, focus: false };
    if (!form.reason) return { message: '重新生成请先写「为什么刷新」', error: true, focus: true };
    return null;
}

export function refreshRegenToast(result) {
    if (result?.status === 'invalid') return { message: '重新生成请先写「为什么刷新」', error: true, focus: true };
    if (result?.status === 'skipped') return { message: '请先勾选要重新生成的模块', error: true };
    return null;
}

export function bindRefreshBar(env = {}) {
    const $in = env.$in;
    const toast = (message, error) => env.toast?.(message, null, error);

    $in('#sp-refresh-bar').on('click', '.sp-refresh-all', function () {
        $in('#sp-refresh-bar .sp-refresh-mod').prop('checked', true);
    });
    $in('#sp-refresh-bar').on('change', 'input[name="sp-refresh-outline-mode"]', function () {
        env.settings().outlineRegenMode = normalizeOutlineRegenMode(this.value);
        env.save?.();
    });
    $in('#sp-refresh-align').on('click', async function () {
        const form = readRefreshBar($in('#sp-refresh-bar'));
        const selected = alignableRefreshSelection(form.selected);
        if (!selected.length) { toast('对齐只会动点和线，请至少勾选其中一项', true); return; }
        const result = await env.align?.({ ...form, selected });
        const msg = refreshAlignToast({ ...result, errorMessage: env.diagnosticMessage?.(result?.error) });
        if (msg) toast(msg.message, msg.error);
    });
    $in('#sp-refresh-regen').on('click', async function () {
        const form = readRefreshBar($in('#sp-refresh-bar'));
        const gate = refreshRegenGate(form);
        if (gate) {
            toast(gate.message, true);
            if (gate.focus) $in('#sp-refresh-reason').trigger('focus');
            return;
        }
        const result = await env.regenerate?.(form);
        const msg = refreshRegenToast(result);
        if (msg) toast(msg.message, msg.error);
    });
}
