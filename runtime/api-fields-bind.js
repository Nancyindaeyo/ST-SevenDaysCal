export function parseApiTimeoutSec(raw) {
    const text = String(raw ?? '').trim();
    const n = Number(text);
    if (!text || !Number.isInteger(n) || n < 5 || n > 600) return null;
    return n;
}

export function normalizeApiUrlInput(value) {
    return String(value ?? '').trim().replace(/\/$/, '');
}

export function filterModelList(models, filter = '') {
    const list = Array.isArray(models) ? models : [];
    const q = String(filter ?? '').trim().toLowerCase();
    return q ? list.filter(m => String(m).toLowerCase().includes(q)) : list;
}

export function bindDiagnostics(env = {}) {
    const $in = env.$in;
    for (const id of ['#sp-diagnostics-section', '#sp-diagnostics-ai-input-preview']) {
        env.inEl?.(id)?.addEventListener('toggle', function () {
            if (this.open) env.refreshPreview?.();
        });
    }
    $in('#sp-diagnostics-ai-input-copy').on('click', () => { void env.copyPayload?.(); });
    $in('#sp-diagnostic-export').on('click', () => { void env.exportTrace?.(); });
    $in('#sp-current-diagnostic-export').on('click', () => { void env.exportCurrent?.(); });
}

export function bindApiFields(env = {}) {
    const $in = env.$in;
    const $inAll = env.$inAll;
    const $ = env.$;
    const settings = env.settings;
    const save = env.save;
    const sync = () => env.syncPreset?.();

    $in('#sp-cfg-save').on('click', function () {
        const $msg = $in('#sp-cfg-msg');
        $msg.text('已自动保存 ✓');
        clearTimeout(this._autoSaveHintTimer);
        this._autoSaveHintTimer = setTimeout(() => $msg.text(''), 2000);
        if (env.settingsOpen?.()) env.toggleSettings?.();
    });
    $in('#sp-key-toggle').on('click', env.toggleKey);
    $in('#sp-fetch-models').on('click', env.fetchModels);
    $in('#sp-model-list-items').on('click', '.sp-model-list-item', function () {
        const model = $(this).attr('data-model');
        $in('#sp-cfg-model').val(model);
        $in('#sp-cfg-model').trigger('change');
        sync();
        $inAll('.sp-model-list-item').removeClass('sp-model-list-item-active');
        $(this).addClass('sp-model-list-item-active');
    });
    $in('#sp-model-list-search').on('input', function () {
        env.renderModelList?.(env.cachedModels?.(), $(this).val());
    });
    $in('#sp-cfg-key')
        .on('focus', () => { const r = $in('#sp-cfg-key').data('real'); if (r) $in('#sp-cfg-key').val(r); })
        .on('input', function () { const value = this.value.trim(); $in('#sp-cfg-key').data('real', value); settings().apiKey = value; save?.(); sync(); })
        .on('blur', function () { const r = $in('#sp-cfg-key').val().trim(); $in('#sp-cfg-key').data('real', r).val(r ? env.maskKey?.(r) : ''); settings().apiKey = r; save?.(); sync(); });
    $in('#sp-cfg-url').on('input change', function () { settings().apiUrl = normalizeApiUrlInput(this.value); save?.(); sync(); });
    $in('#sp-cfg-model').on('input change', function () { settings().apiModel = this.value.trim(); save?.(); sync(); });
    $in('#sp-cfg-exclude').on('input change', function () { settings().apiExcludeParams = env.parseExcludeParams?.(this.value); save?.(); sync(); });
    $in('#sp-cfg-timeout').on('input change', function () {
        const n = parseApiTimeoutSec(this.value);
        sync();
        if (n == null) return;
        settings().apiTimeoutSec = n;
        save?.();
    });
    $in('#sp-cfg-stream').on('change', function () { settings().apiStream = this.checked; save?.(); sync(); });
}
