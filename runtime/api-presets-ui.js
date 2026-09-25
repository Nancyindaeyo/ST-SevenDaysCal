import { utilityPresetDeleteImpact, utilityRouteLabel } from './utility-route.js';

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

    function currentUtilityRoute() {
        return env.resolveUtilityRoute?.() || null;
    }

    function paintUtilityRoute(route = currentUtilityRoute()) {
        const $status = $in('#sp-util-route-status');
        const $actions = $in('#sp-util-route-actions');
        if (!$status.length) return;
        if (!route) {
            $status.text('');
            $actions.attr('hidden', true);
            return;
        }
        $status.text(route.status === 'follow-main' && route.reason === 'no-utility-preset' ? '' : utilityRouteLabel(route));
        $actions.removeAttr('hidden');
        $in('#sp-util-fix').toggle(route.status === 'invalid');
        $in('#sp-util-allow-session').toggle(route.status === 'invalid');
        $in('#sp-util-allow-persist').toggle(route.status === 'invalid');
        $in('#sp-util-pause').toggle(route.status !== 'paused');
        $in('#sp-util-resume').toggle(route.status === 'paused' || route.reason === 'user-allow-main' || route.reason === 'session-allow-main');
    }

    function syncUtilityPresetLabel() {
        const $lb = $in('#sp-util-preset-label');
        if (!$lb.length) return;
        const route = currentUtilityRoute();
        if (route) {
            $lb.text(utilityRouteLabel(route));
            paintUtilityRoute(route);
            return;
        }
        const id = settings().utilityPresetId || '';
        const p = id ? loadApiPresets().find(x => x.id === id) : null;
        $lb.text(p ? `机械任务 → ${p.name}` : '跟随主 API（不分流）');
        paintUtilityRoute(null);
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
        $in('#sp-preset-del').on('click', async function () {
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
            if (utilityPresetDeleteImpact(settings().utilityPresetId, id)) {
                const choice = await choose?.({
                    title: '删除机械任务正在使用的预设',
                    body: '删除后机械任务会失效并暂停调用，不会再悄悄改走主 API。你可以稍后修复预设、改回跟随主 API，或明确允许主 API。',
                    choices: [
                        { value: 'cancel', label: '取消', primary: true },
                        { value: 'delete', label: '仍要删除' },
                    ],
                });
                if (choice !== 'delete') return;
            }
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
            settings().utilityAllowMain = false;
            env.setUtilitySessionAllowMain?.(false);
            saveSettingsDebounced();
            renderUtility();
            $in('#sp-util-preset-list').slideUp(120);
            $in('#sp-util-preset-box').removeClass('sp-preset-box-open');
        });
        $in('#sp-util-fix').on('click', function () {
            const id = settings().utilityPresetId || '';
            const p = id ? loadApiPresets().find(x => x.id === id) : null;
            if (p) {
                settings().apiPresetActiveId = id;
                fillApiInputs(p);
                $in('#sp-preset-list').slideDown(120);
                $in('#sp-preset-box').addClass('sp-preset-box-open');
                render();
                showPresetHint('已打开该预设，请补全 URL / Key / 模型后点更新');
                return;
            }
            $in('#sp-util-preset-list').slideDown(120);
            $in('#sp-util-preset-box').addClass('sp-preset-box-open');
            showPresetHint('原预设已删除。请新建或另选机械任务预设');
        });
        $in('#sp-util-allow-session').on('click', function () {
            env.setUtilitySessionAllowMain?.(true);
            renderUtility();
            showPresetHint('本次会话机械任务改走主 API');
        });
        $in('#sp-util-allow-persist').on('click', function () {
            settings().utilityAllowMain = true;
            saveSettingsDebounced();
            renderUtility();
            showPresetHint('已持续允许机械任务改走主 API');
        });
        $in('#sp-util-pause').on('click', function () {
            settings().utilityPaused = true;
            saveSettingsDebounced();
            renderUtility();
            showPresetHint('已暂停机械任务');
        });
        $in('#sp-util-resume').on('click', function () {
            settings().utilityPaused = false;
            settings().utilityAllowMain = false;
            env.setUtilitySessionAllowMain?.(false);
            saveSettingsDebounced();
            renderUtility();
            showPresetHint('已恢复机械任务分流');
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
