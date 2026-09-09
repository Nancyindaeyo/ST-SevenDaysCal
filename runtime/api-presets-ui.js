export function apiPresetSnapshotKey(cfg) {
    return JSON.stringify({
        url: cfg?.url || '', key: cfg?.key || '', model: cfg?.model || '',
        excludeParams: Array.isArray(cfg?.excludeParams) ? cfg.excludeParams : [],
        timeoutSec: Number.isInteger(Number(cfg?.timeoutSec)) ? Number(cfg.timeoutSec) : null, stream: cfg?.stream === true,
    });
}

export function apiInputsSaveable(cfg) {
    return cfg?.timeoutValid !== false && Number.isInteger(Number(cfg?.timeoutSec)) && Number(cfg.timeoutSec) >= 5 && Number(cfg.timeoutSec) <= 600;
}

export function apiInputsDirty(current, active) {
    return !!active && apiPresetSnapshotKey(current) !== apiPresetSnapshotKey(active);
}

// 按 URL 域名生成预设名；无 URL 用「预设」。撞已有名自动加 -2/-3…
export function autoPresetName(url, existingNames) {
    let base = '';
    try { base = url ? new URL(url).hostname.replace(/^www\./, '') : ''; } catch { base = ''; }
    if (!base) base = '预设';
    const names = existingNames instanceof Set ? existingNames : new Set(existingNames || []);
    if (!names.has(base)) return base;
    for (let i = 2; ; i++) { const n = `${base}-${i}`; if (!names.has(n)) return n; }
}

export function createApiPresetUi(env = {}) {
    const $in = env.$in;
    const $ = env.jquery || env.$;
    const settings = env.getSettings;
    const loadApiPresets = env.loadApiPresets;
    const upsertApiPreset = env.upsertApiPreset;
    const deleteApiPreset = env.deleteApiPreset;
    const renameApiPreset = env.renameApiPreset;
    const saveCfg = env.saveCfg;
    const saveSettingsDebounced = env.saveSettingsDebounced;
    const parseExcludeParams = env.parseExcludeParams;
    const maskKey = env.maskKey;
    const escapeAttr = env.escapeAttr;
    const escapeHtml = env.escapeHtml;
    const choose = env.choose;

    function readApiInputs() {
        const $k = $in('#sp-cfg-key');
        const rawTimeout = String($in('#sp-cfg-timeout').val() ?? '').trim();
        const timeout = Number(rawTimeout);
        const timeoutValid = rawTimeout !== '' && Number.isInteger(timeout) && timeout >= 5 && timeout <= 600;
        return {
            url          : $in('#sp-cfg-url').val().trim().replace(/\/$/, ''),
            key          : ($k.data('real') || $k.val() || '').trim(),
            model        : $in('#sp-cfg-model').val().trim(),
            excludeParams: parseExcludeParams($in('#sp-cfg-exclude').val()),
            timeoutSec   : timeoutValid ? timeout : null,
            timeoutValid,
            stream       : $in('#sp-cfg-stream').is(':checked'),
        };
    }

    function activeApiPreset() {
        const id = settings().apiPresetActiveId || '';
        return id ? loadApiPresets().find(p => p.id === id) || null : null;
    }

    function currentDirty() {
        return apiInputsDirty(readApiInputs(), activeApiPreset());
    }

    function nextPresetName(url) {
        return autoPresetName(url, loadApiPresets().map(p => p.name));
    }

    // 把一套预设填回输入框。Key 走 maskKey 遮罩 + data('real') 存真值。
    function fillApiInputs(p) {
        $in('#sp-cfg-url').val(p.url || '');
        const $k = $in('#sp-cfg-key');
        if (p.key) $k.data('real', p.key).val(maskKey(p.key)).attr('type', 'password');
        else       $k.data('real', '').val('');
        $in('#sp-cfg-model').val(p.model || '');
        $in('#sp-cfg-exclude').val((Array.isArray(p.excludeParams) ? p.excludeParams : []).join('\n'));
        $in('#sp-cfg-timeout').val(p.timeoutSec || 180);
        $in('#sp-cfg-stream').prop('checked', p.stream === true);
    }

    function showPresetHint(msg) {
        const $h = $in('#sp-preset-hint');
        if (!$h.length) return;
        $h.text(msg).show();
        clearTimeout(showPresetHint._t);
        showPresetHint._t = setTimeout(() => $h.fadeOut(200), 2600);
    }

    function syncPresetLabel() {
        const $lb = $in('#sp-preset-label');
        if (!$lb.length) return;
        const p = loadApiPresets().find(x => x.id === (settings().apiPresetActiveId || ''));
        $lb.text(p ? p.name : '选择预设…');
    }

    function syncUtilityPresetLabel() {
        const $lb = $in('#sp-util-preset-label');
        if (!$lb.length) return;
        const id = settings().utilityPresetId || '';
        const p = id ? loadApiPresets().find(x => x.id === id) : null;
        if (id && !p) { settings().utilityPresetId = ''; }   // 悬空 id 自愈
        $lb.text(p ? `机械任务 → ${p.name}` : '跟随主 API（不分流）');
    }

    function syncState() {
        const $btn = $in('#sp-preset-update');
        const $state = $in('#sp-preset-sync-state');
        if (!$btn.length) return;
        const p = activeApiPreset();
        if (p) {
            const dirty = currentDirty();
            const valid = apiInputsSaveable(readApiInputs());
            $btn.text(`更新「${p.name}」`).prop('disabled', !dirty || !valid);
            $state.text(!valid ? '请求超时需填写 5–600 秒' : dirty ? '尚未更新到预设' : '已与预设同步').toggle(!valid || !!dirty);
        } else {
            const valid = apiInputsSaveable(readApiInputs());
            $btn.text('另存为新预设').prop('disabled', !valid);
            $state.text(valid ? '' : '请求超时需填写 5–600 秒').toggle(!valid);
        }
    }

    function render() {
        const $list = $in('#sp-preset-list');
        if (!$list.length) return;
        const list = loadApiPresets();
        const activeId = settings().apiPresetActiveId || '';
        $list.html(list.length
            ? list.map(p => `<div class="sp-preset-item-row" data-id="${escapeAttr(p.id)}"><button type="button" class="sp-preset-item${p.id === activeId ? ' sp-preset-item-active' : ''}" data-id="${escapeAttr(p.id)}">${escapeHtml(p.name)}</button><button type="button" class="sp-preset-rename" data-id="${escapeAttr(p.id)}" title="仅修改这条预设的名称"><i class="fa-solid fa-pen"></i></button></div>`).join('')
            : `<div class="sp-preset-empty">暂无预设，填好 API 后点右侧＋存一个</div>`);
        $in('#sp-preset-del').prop('disabled', !activeId);
        syncPresetLabel();
        syncState();
    }

    function renderUtility() {
        const $list = $in('#sp-util-preset-list');
        if (!$list.length) return;
        const list = loadApiPresets();
        const activeId = settings().utilityPresetId || '';
        const follow = `<button type="button" class="sp-preset-item${!activeId ? ' sp-preset-item-active' : ''}" data-id="">跟随主 API（不分流）</button>`;
        const items = list.map(p => `<button type="button" class="sp-preset-item${p.id === activeId ? ' sp-preset-item-active' : ''}" data-id="${escapeAttr(p.id)}">${escapeHtml(p.name)}</button>`).join('');
        $list.html(follow + items);
        syncUtilityPresetLabel();
    }

    function saveCurrentAsPreset() {
        const cur = readApiInputs();
        if (!apiInputsSaveable(cur)) { showPresetHint('请求超时必须填写 5–600 秒，未保存预设'); return null; }
        if (!cur.url && !cur.key) { showPresetHint('先填 API 再保存预设'); return null; }
        const name = nextPresetName(cur.url);
        upsertApiPreset(name, cur, null);
        render();
        renderUtility();
        showPresetHint(`已存为预设「${name}」`);
        return name;
    }

    async function confirmPresetSwitch(nextPreset) {
        const current = activeApiPreset();
        if (!current || !currentDirty()) return 'switch';
        const choice = await choose?.({
            title: '当前预设有未保存改动',
            body: `要如何切换到「${nextPreset.name}」？`,
            choices: [
                { value: 'save', label: '保存并切换', primary: true },
                { value: 'switch', label: '直接切换' },
                { value: 'cancel', label: '取消' },
            ],
        });
        if (choice === 'save') {
            const currentCfg = readApiInputs();
            if (!apiInputsSaveable(currentCfg)) { showPresetHint('请求超时必须填写 5–600 秒，未保存预设'); return 'cancel'; }
            upsertApiPreset(current.name, currentCfg, current.id);
        }
        return choice || 'cancel';
    }

    function bind() {
        $in('#sp-preset-box').on('click', function (e) {
            e.preventDefault();
            $in('#sp-preset-list').slideToggle(120);
            $(this).toggleClass('sp-preset-box-open');
        });
        $in('#sp-preset-list').on('click', '.sp-preset-item', async function () {
            const id = $(this).attr('data-id');
            const p = loadApiPresets().find(x => x.id === id);
            if (!p || p.id === (settings().apiPresetActiveId || '')) return;
            const decision = await confirmPresetSwitch(p);
            if (decision === 'cancel') return;
            settings().apiPresetActiveId = id;
            $in('#sp-preset-list').slideUp(120);
            $in('#sp-preset-box').removeClass('sp-preset-box-open');
            if (!p) return;
            fillApiInputs(p);
            saveCfg(readApiInputs());
            render();
            syncState();
            showPresetHint(`已填入并应用「${p.name}」`);
        });

        const commitPresetEdit = ($row) => {
            const $inp = $row.find('.sp-preset-rename-input');
            if (!$inp.length) return;
            const id = $row.attr('data-id');
            const p = loadApiPresets().find(x => x.id === id);
            const name = $inp.val().trim() || (p ? p.name : '');
            renameApiPreset(id, name);
            render();
            renderUtility();
            showPresetHint(`已改名为「${name}」`);
        };
        $in('#sp-preset-list').on('click', '.sp-preset-rename', function (e) {
            e.preventDefault(); e.stopPropagation();
            const id = $(this).attr('data-id');
            const p = loadApiPresets().find(x => x.id === id);
            if (!p) return;
            const $row = $(this).closest('.sp-preset-item-row');
            $row.addClass('sp-preset-item-row-edit').html(
                `<input type="text" class="sp-input sp-preset-rename-input" value="${escapeAttr(p.name)}" maxlength="40" spellcheck="false">` +
                `<button type="button" class="sp-preset-rename-ok" title="保存预设名称"><i class="fa-solid fa-check"></i></button>`
            );
            $row.find('.sp-preset-rename-input').trigger('focus').trigger('select');
            showPresetHint(`编辑「${p.name}」名称；当前 API 输入不会改变`);
        });
        $in('#sp-preset-list').on('click', '.sp-preset-rename-ok', function (e) {
            e.preventDefault(); e.stopPropagation();
            commitPresetEdit($(this).closest('.sp-preset-item-row'));
        });
        $in('#sp-preset-list').on('keydown', '.sp-preset-rename-input', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); commitPresetEdit($(this).closest('.sp-preset-item-row')); }
            else if (e.key === 'Escape') { e.preventDefault(); render(); }
        });

        $in('#sp-preset-save').on('click', function () {
            saveCurrentAsPreset();
        });

        $in('#sp-preset-update').on('click', function () {
            const p = activeApiPreset();
            const cur = readApiInputs();
            if (p) {
                if (!apiInputsSaveable(cur)) { showPresetHint('请求超时必须填写 5–600 秒，未更新预设'); return; }
                upsertApiPreset(p.name, cur, p.id);
                render();
                renderUtility();
                showPresetHint(`已更新预设「${p.name}」`);
            } else {
                saveCurrentAsPreset();
            }
        });

        let delArmed = false, delTimer = null;
        $in('#sp-preset-del').on('click', function () {
            const id = settings().apiPresetActiveId;
            if (!id) return;
            const $btn = $(this), $i = $btn.find('i');
            if (!delArmed) {
                delArmed = true;
                $i.attr('class', 'fa-solid fa-check');
                $btn.css('color', '#e06c6c').attr('title', '再点一次确认删除');
                showPresetHint('再点一次垃圾桶确认删除');
                delTimer = setTimeout(() => {
                    delArmed = false; $i.attr('class', 'fa-solid fa-trash');
                    $btn.css('color', '').attr('title', '删除当前选中的预设');
                }, 3000);
                return;
            }
            clearTimeout(delTimer); delArmed = false;
            $i.attr('class', 'fa-solid fa-trash'); $btn.css('color', '').attr('title', '删除当前选中的预设');
            const p = loadApiPresets().find(x => x.id === id);
            if (settings().utilityPresetId === id) settings().utilityPresetId = '';
            deleteApiPreset(id);
            render();
            renderUtility();
            showPresetHint(p ? `已删除「${p.name}」` : '已删除');
        });

        $in('#sp-util-preset-box').on('click', function (e) {
            e.preventDefault();
            $in('#sp-util-preset-list').slideToggle(120);
            $(this).toggleClass('sp-preset-box-open');
        });
        $in('#sp-util-preset-list').on('click', '.sp-preset-item', function () {
            const id = $(this).attr('data-id') || '';
            settings().utilityPresetId = id;
            saveSettingsDebounced();
            renderUtility();
            $in('#sp-util-preset-list').slideUp(120);
            $in('#sp-util-preset-box').removeClass('sp-preset-box-open');
        });
    }

    return {
        bind,
        render,
        renderUtility,
        syncState,
        readApiInputs,
        fillApiInputs,
    };
}
