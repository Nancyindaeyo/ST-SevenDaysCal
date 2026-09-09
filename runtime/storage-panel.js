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
