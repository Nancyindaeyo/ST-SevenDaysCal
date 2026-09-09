import { escapeHtml } from '../utils/dom.js';

export const STORAGE_KIND_LABELS = {
    'schedule'     : '点（待办）',
    'outline'      : '面（大纲）',
    'lines'        : '线（伏笔）',
    'creative-chat': '面讨论',
    'space-chat'   : '间（局外）',
    'dashed'       : '虚线·冷知识',
    'almanac'      : '轴·日历条目（节日/生日/纪念日）',
};

export const STORAGE_OWNKEY_LABELS = {
    'sp-memory' : '记忆',
    'sp-theater': '棱永久层',
    'sp-ledger' : '轴·刻度（状态/约定/周期）',
};

export const STORAGE_CLEAR_TARGETS = Object.freeze({
    almanac: Object.freeze({ scope: 'kind', kind: 'almanac', label: '轴·日历条目（节日/生日/纪念日）' }),
    ledger: Object.freeze({ scope: 'ownkey', key: 'sp-ledger', label: '轴·刻度（状态/约定/周期）' }),
});

export function readStorageChatIdentity(ctx) {
    const chatId = String(ctx?.chatId || '');
    return chatId ? { chatId, metadata: ctx.chatMetadata } : null;
}

export function sameStorageChat(identity, now) {
    return !!identity && !!now && identity.chatId === now.chatId && identity.metadata === now.metadata;
}

export function storageRow(label, bytesText, btnHtml = '', extraClass = '') {
    return `<div class="sp-storage-row ${extraClass}">
        <span class="sp-storage-row-label">${escapeHtml(label)}</span>
        <span class="sp-storage-row-bytes">${escapeHtml(bytesText)}</span>
        <span class="sp-storage-row-act">${btnHtml}</span>
    </div>`;
}

export function shouldIgnoreKindClear(kind) {
    return kind === STORAGE_CLEAR_TARGETS.almanac.kind;
}

export function kindClearDetail(kind, label) {
    if (kind === STORAGE_CLEAR_TARGETS.almanac.kind) {
        return '仅删除本聊天的节日、生日、纪念日和自定义日期条目；不会删除刻度、自定义历法、剧情今天或模板。';
    }
    return `确定清除本聊天的「${label}」数据吗？我方 / TA 方视角都会一并清掉。`;
}

export function ownKeyClearDetail(key, label) {
    if (key === STORAGE_CLEAR_TARGETS.ledger.key) {
        return '仅删除本聊天活跃/已了结刻度（状态、约定、周期）；不会删除日历条目、自定义历法、剧情今天或模板。';
    }
    return `确定清空本聊天的「${label}」全部数据吗？`;
}

export function ownKeyClearBranch(key) {
    if (key === STORAGE_CLEAR_TARGETS.ledger.key) return 'ledger';
    if (key === 'sp-theater') return 'theater';
    return 'generic';
}

export function storageRetryFeedback(status = {}) {
    if (status.status === 'ready') return { message: '外置构画数据已重新加载', error: false };
    return { message: `重试失败：${status.error || '后端不可用'}`, error: true };
}

export const STORAGE_EMPTY_CHAT_HTML = '<div class="sp-cfg-hint" style="padding:4px 0">当前聊天暂无构画数据</div>';
export const STORAGE_OWN_KEYS_SHOWN = Object.freeze(['sp-memory', 'sp-theater', 'sp-ledger']);
export const ALMANAC_CLEAR_DATA_KEY = 'almanac-user';
export const ANCHOR_STORAGE_PENDING_HTML = '<div class="sp-cfg-hint" style="padding:4px 0">统计中…</div>';
export const ANCHOR_STORAGE_EMPTY_HTML = '<div class="sp-cfg-hint" style="padding:4px 0">暂无收藏</div>';
export const ANCHOR_STORAGE_FAILED_HTML = '<div class="sp-cfg-hint" style="padding:4px 0">统计失败（服务器不可达？）</div>';

export function storageModeCopy(state = {}, probe) {
    if (!state.chatId) {
        return { text: '当前没有打开聊天。', hideMigrate: true, hideRetry: true };
    }
    if (state.mode === 'external') {
        if (state.status === 'ready') {
            const extra = state.error ? ` 最近一次外置操作失败：${state.error}` : '';
            return {
                text: `当前聊天已使用白鳥数据后端。聊天文件只保留定位标记与楼层快照指针；单独导出聊天不会包含完整构画数据，请同时保留后端数据。${extra}`,
                hideMigrate: true,
                hideRetry: true,
            };
        }
        return {
            text: `当前聊天已迁出，但后端数据不可用：${state.error || '尚未加载'}。构画不会把它当成空数据，也不会自动回退写入聊天文件。`,
            hideMigrate: true,
            hideRetry: state.status === 'invalid',
        };
    }
    if (probe === undefined) {
        return { text: '正在检测白鳥数据后端…', probe: true, hideMigrate: true, hideRetry: true };
    }
    if (probe?.ok) {
        return {
            text: '当前仍随聊天文件存储。可主动把当前聊天的构画数据迁到白鳥数据后端；迁移前原聊天保持不变。',
            hideMigrate: false,
            hideRetry: true,
        };
    }
    return { text: '未检测到兼容的白鳥数据后端；当前聊天继续沿用原存储方式。', hideMigrate: true, hideRetry: true };
}

export function applyStorageModeView($status, $migrate, $retry, view = {}) {
    $status?.text?.(view.text || '');
    $migrate?.prop?.('hidden', view.hideMigrate !== false);
    $retry?.prop?.('hidden', view.hideRetry !== false);
}

export async function paintStorageMode(env = {}) {
    const $status = env.$status;
    const $migrate = env.$migrate;
    const $retry = env.$retry;
    if (!$status?.length) return;
    $migrate?.prop?.('hidden', true);
    $retry?.prop?.('hidden', true);
    const state = env.storageStatus?.() || {};
    const first = storageModeCopy(state);
    applyStorageModeView($status, $migrate, $retry, first);
    if (!first.probe) return;
    const probe = await env.probe?.();
    const now = env.storageStatus?.() || {};
    if (now.chatId !== state.chatId || now.mode !== 'chat') return;
    applyStorageModeView($status, $migrate, $retry, storageModeCopy(state, probe));
}

export function hasChatStorageData({ hasStore = false, ownKeyBytes = {} } = {}) {
    return !!(hasStore || STORAGE_OWN_KEYS_SHOWN.some(key => ownKeyBytes[key]));
}

export function kindClearButton(kind) {
    if (kind === STORAGE_CLEAR_TARGETS.almanac.kind) {
        return `<button class="sp-storage-del sp-mini-btn" data-scope="datakey" data-key="${ALMANAC_CLEAR_DATA_KEY}">清除</button>`;
    }
    return `<button class="sp-storage-del sp-mini-btn" data-scope="kind" data-kind="${kind}">清除</button>`;
}

export function ownKeyClearButton(key) {
    return `<button class="sp-storage-del sp-mini-btn sp-mini-btn-danger" data-scope="ownkey" data-key="${key}">清空</button>`;
}

export function localCacheClearButton(bytes) {
    return bytes ? '<button class="sp-storage-del sp-mini-btn" data-scope="local">清理</button>' : '';
}

export function chatStorageRows({ usage = {}, ownKeyBytes = {}, formatBytes, userClearKinds = [] } = {}) {
    const fmt = formatBytes || (b => String(b));
    const rows = [];
    for (const kind of userClearKinds) {
        const b = usage[kind] || 0;
        if (!b) continue;
        rows.push(storageRow(STORAGE_KIND_LABELS[kind] || kind, fmt(b), kindClearButton(kind)));
    }
    for (const key of STORAGE_OWN_KEYS_SHOWN) {
        const b = ownKeyBytes[key] || 0;
        if (!b) continue;
        rows.push(storageRow(STORAGE_OWNKEY_LABELS[key], fmt(b), ownKeyClearButton(key)));
    }
    return rows;
}

export function chatStorageSection(opts = {}) {
    if (!hasChatStorageData(opts)) return STORAGE_EMPTY_CHAT_HTML;
    const rows = chatStorageRows(opts);
    return rows.length ? rows.join('') : STORAGE_EMPTY_CHAT_HTML;
}

export function storageUsageLayoutHtml({ chatHtml = '', localRowHtml = '' } = {}) {
    return `
        <div class="sp-storage-group">
            <div class="sp-storage-group-head">本聊天（随聊天文件存服务端）</div>
            ${chatHtml}
        </div>
        <div class="sp-storage-group">
            <div class="sp-storage-group-head">收藏 · 坐标（全局存服务端）</div>
            <div id="sp-storage-anchor-rows">${ANCHOR_STORAGE_PENDING_HTML}</div>
        </div>
        <div class="sp-storage-group">
            <div class="sp-storage-group-head">本机缓存（localStorage，仅本浏览器）</div>
            ${localRowHtml}
            <div class="sp-cfg-hint" style="padding:2px 0 0">仅清本机的草稿与界面位置，不影响已存服务端的点线面间与收藏。</div>
        </div>
    `;
}

export function anchorStorageHtml({ count = 0, bytes = 0, formatBytes } = {}) {
    if (!count) return ANCHOR_STORAGE_EMPTY_HTML;
    const fmt = formatBytes || (b => String(b));
    return storageRow(
        `共 ${count} 条收藏`,
        fmt(bytes),
        '<button class="sp-storage-del sp-mini-btn sp-mini-btn-danger" data-scope="anchor">清空</button>',
    );
}

export async function paintStorageUsage(env = {}) {
    const $body = env.$body;
    if (!$body?.length) return;
    const fmt = env.formatBytes || (b => String(b));
    void env.renderMode?.();
    const ownKeyBytes = {};
    for (const key of STORAGE_OWN_KEYS_SHOWN) ownKeyBytes[key] = env.ownKeyBytes?.(key) || 0;
    const hasStore = !!env.hasStore?.();
    const hasData = hasChatStorageData({ hasStore, ownKeyBytes });
    const chatHtml = chatStorageSection({
        hasStore,
        ownKeyBytes,
        usage: hasData ? (env.usageByKind?.() || {}) : {},
        formatBytes: fmt,
        userClearKinds: env.userClearKinds || [],
    });
    const localBytes = env.localBytes?.() || 0;
    $body.html(storageUsageLayoutHtml({
        chatHtml,
        localRowHtml: storageRow('棱草稿 + 界面位置', fmt(localBytes), localCacheClearButton(localBytes)),
    }));
    const $anchor = env.$in?.('#sp-storage-anchor-rows');
    try {
        const usage = await env.anchorUsage?.() || { count: 0, bytes: 0 };
        $anchor?.html?.(anchorStorageHtml({
            count: usage.count,
            bytes: usage.bytes,
            formatBytes: env.formatAnchorBytes || fmt,
        }));
    } catch {
        $anchor?.html?.(ANCHOR_STORAGE_FAILED_HTML);
    }
}

export function migrationProgressCopy(info = {}) {
    if (info.phase === 'committing') {
        return {
            status: '外置副本已校验，正在提交聊天定位标记与快照指针。此阶段不能撤销，请等待确认。',
            abortLabel: '正在确认最终提交…',
            abortDisabled: true,
        };
    }
    return {
        status: `正在复制并校验 ${info.done || 0} / ${info.total || '…'} 项…`,
        abortLabel: '中断迁移',
        abortDisabled: false,
    };
}

export function bindStoragePanel(env = {}) {
    const $in = env.$in;
    const $ = env.$;
    const store = env.store;
    const identityOf = () => env.identity?.();
    const stillCurrent = id => sameStorageChat(id, identityOf());
    const toast = env.toast;
    const confirm = env.confirm;

    $in('#sp-storage-refresh').on('click', () => env.renderUsage?.());
    $in('#sp-backup-export').on('click', () => { void env.exportBackup?.(); });
    $in('#sp-backup-import').on('click', () => $in('#sp-backup-import-file').trigger('click'));
    $in('#sp-backup-import-file').on('change', function () {
        const file = this.files?.[0];
        this.value = '';
        if (file) void env.importBackup?.(file);
    });
    $in('#sp-storage-migrate').on('click', () => { void env.migrate?.(); });
    $in('#sp-storage-retry').on('click', async () => {
        const before = env.storageStatus?.().chatId;
        await env.reloadExternal?.({ force: true });
        const status = env.storageStatus?.() || {};
        if (status.chatId !== before) return;
        env.renderMode?.();
        env.renderUsage?.();
        const msg = storageRetryFeedback(status);
        toast?.(msg.message, null, msg.error);
    });

    const $body = $in('#sp-storage-body');

    $body.on('click', '.sp-storage-del[data-scope="datakey"]', async function () {
        const dataKey = $(this).attr('data-key');
        if (!store.isStorageDataKeyClearable(dataKey)) return;
        const identity = identityOf();
        if (!identity) return;
        if (!await confirm?.({
            title: `清除${STORAGE_CLEAR_TARGETS.almanac.label}`,
            body: '仅删除本聊天的节日、生日、纪念日和自定义日期条目；不会删除刻度、自定义历法、剧情今天或模板。\n此操作不可恢复。',
        })) return;
        if (!stillCurrent(identity)) return;
        env.invalidateAlmanac?.();
        try {
            const ok = await store.clearDataKeyAsync(dataKey);
            if (!stillCurrent(identity)) return;
            env.refreshAlmanac?.();
            env.renderUsage?.();
            toast?.(ok ? '已清除轴·日历条目' : '轴·日历条目本就为空');
        } catch (error) {
            if (stillCurrent(identity)) { env.refreshAlmanac?.(); toast?.('清除轴·日历条目失败：' + (error?.message || '保存失败'), null, true); }
        }
    });

    $body.on('click', '.sp-storage-del[data-scope="kind"]', async function () {
        const kind = $(this).attr('data-kind');
        if (shouldIgnoreKindClear(kind)) return;
        const label = STORAGE_KIND_LABELS[kind] || kind;
        if (!store.USER_CLEAR_KINDS.includes(kind)) return;
        const identity = identityOf();
        if (!identity) return;
        const detail = kindClearDetail(kind, label);
        if (!await confirm?.({ title: `清除${label}`, body: `${detail}\n此操作不可恢复。` })) return;
        if (!stillCurrent(identity)) return;
        env.invalidateKind?.(kind);
        try {
            const n = await store.clearKindAsync(kind);
            if (!stillCurrent(identity)) return;
            env.refreshEditors?.(kind);
            env.renderUsage?.();
            toast?.(n ? `已清除${label}` : `${label}本就为空`);
        } catch (error) {
            if (stillCurrent(identity)) {
                env.refreshEditorsFromStore?.(kind);
                toast?.(`清除${label}失败：` + (error?.message || '保存失败'), null, true);
            }
        }
    });

    $body.on('click', '.sp-storage-del[data-scope="ownkey"]', async function () {
        const key = $(this).attr('data-key');
        const label = STORAGE_OWNKEY_LABELS[key] || key;
        if (!store.OWN_KEYS.includes(key)) return;
        const identity = identityOf();
        if (!identity) return;
        const detail = ownKeyClearDetail(key, label);
        if (!await confirm?.({ title: `清空${label}`, body: `${detail}\n此操作不可恢复。` })) return;
        if (!stillCurrent(identity)) return;
        const branch = ownKeyClearBranch(key);
        if (branch === 'ledger') {
            env.invalidateLedger?.();
            try {
                const ok = await store.clearOwnKeyAsync(key);
                if (!stillCurrent(identity)) return;
                env.refreshLedger?.();
                env.renderUsage?.();
                toast?.(ok ? `已清空${label}` : `${label}本就为空`);
            } catch (error) {
                if (stillCurrent(identity)) { env.refreshLedger?.(); toast?.(`清空${label}失败：` + (error?.message || '保存失败'), null, true); }
            }
            return;
        }
        if (branch === 'theater') {
            const target = env.theater?.captureTarget?.(identity.chatId);
            const result = await env.theater?.clearSaved?.(target);
            if (!stillCurrent(identity)) return;
            if (env.theaterOn?.()) env.theater?.resetAfterStorageClear?.();
            env.renderUsage?.();
            toast?.(result?.ok ? `已清空${label}` : `清空${label}失败`, null, !result?.ok);
            return;
        }
        const ok = store.clearOwnKey(key);
        if (!stillCurrent(identity)) return;
        if (key === 'sp-memory') env.refreshMemory?.();
        if (key === 'sp-theater' && env.theaterOn?.()) env.theater?.resetAfterStorageClear?.();
        env.renderUsage?.();
        toast?.(ok ? `已清空${label}` : `${label}本就为空`);
    });

    $body.on('click', '.sp-storage-del[data-scope="anchor"]', async function () {
        const cnt = await env.coordinate?.()?.storageUsage?.().then(info => info.count).catch(() => 0);
        if (!cnt) { toast?.('还没有任何收藏'); return; }
        if (!await confirm?.({ title: '清空全部收藏', body: `确定删除全部 ${cnt} 条收藏吗？此操作不可恢复（原楼层不受影响）。` })) return;
        try {
            await env.coordinate?.()?.clearAll?.();
            env.renderUsage?.();
            toast?.('已清空全部收藏');
        } catch (err) {
            env.logAnchorError?.(err);
            toast?.('清空失败：' + (err?.message || '未知错误'), null, true);
        }
    });

    $body.on('click', '.sp-storage-del[data-scope="local"]', async function () {
        if (!await confirm?.({ title: '清理本机缓存', body: '清理本浏览器的棱草稿与界面位置（面板位置/大小）。不影响已存服务端的点线面间和收藏。确定？' })) return;
        const n = env.clearLocalCache?.();
        if (env.theaterOn?.()) env.theater?.resetAfterStorageClear?.();
        env.renderUsage?.();
        toast?.(`已清理 ${n} 项本机缓存`);
    });
}
