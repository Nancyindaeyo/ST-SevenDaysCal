export const OVERLAY_BLOCK_EVENTS = Object.freeze(['keydown', 'keyup', 'pointerdown', 'mousedown', 'touchstart', 'click']);

export const BLOCKING_OVERLAY_STYLE = Object.freeze({
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    display: 'grid',
    placeItems: 'center',
    padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
    background: '#000b',
    boxSizing: 'border-box',
    touchAction: 'none',
});

export const MIGRATION_UNKNOWN_ABORT_LABEL = '关闭（请刷新聊天后核实）';

export function backupOverlayProgressCopy(info = {}) {
    return info.message || (info.total ? `${info.done || 0} / ${info.total}` : '处理中…');
}

export function mountStorageLockOverlay(env = {}) {
    const document = env.document;
    document.getElementById(env.id)?.remove();
    const overlay = document.createElement('div');
    overlay.id = env.id;
    const title = env.escapeHtml ? env.escapeHtml(env.title || '') : String(env.title || '');
    const abortHtml = env.abortLabel
        ? `<button data-sp-overlay-abort type="button" style="margin-top:18px;width:100%;min-height:42px;border:1px solid #ffffff30;border-radius:10px;background:#ffffff10;color:inherit">${env.abortLabel}</button>`
        : '';
    overlay.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(420px,calc(100vw - 32px));padding:22px;border-radius:16px;background:#17191f;color:#f5f5f7;box-shadow:0 20px 70px #000b;font-family:var(--sp-font-user,system-ui)">
        <div style="font-size:18px;font-weight:700;margin-bottom:10px">${title}</div>
        <div data-sp-overlay-status style="font-size:14px;line-height:1.65;opacity:.86">${env.status || '准备中…'}</div>
        ${abortHtml}
    </div>`;
    Object.assign(overlay.style, BLOCKING_OVERLAY_STYLE);
    const block = event => { if (!overlay.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); } };
    for (const name of OVERLAY_BLOCK_EVENTS) document.addEventListener(name, block, true);
    document.documentElement.appendChild(overlay);
    const abortBtn = overlay.querySelector('[data-sp-overlay-abort]');
    if (abortBtn && env.onAbort) abortBtn.addEventListener('click', env.onAbort);
    const close = () => {
        for (const name of OVERLAY_BLOCK_EVENTS) document.removeEventListener(name, block, true);
        overlay.remove();
    };
    return {
        overlay,
        statusEl: () => overlay.querySelector('[data-sp-overlay-status]'),
        abortBtn,
        close,
    };
}

export function mountMigrationOverlay(env = {}) {
    const mounted = mountStorageLockOverlay({
        document: env.document,
        id: 'sp-storage-migration-overlay',
        title: '正在迁移当前聊天的构画数据',
        status: '准备复制并逐项回读校验…',
        abortLabel: '中断迁移',
        onAbort: env.onAbort,
    });
    return {
        progress(info = {}) {
            const copy = env.progressCopy?.(info) || {};
            const status = mounted.statusEl();
            if (status) status.textContent = copy.status || '';
            if (mounted.abortBtn) {
                mounted.abortBtn.disabled = !!copy.abortDisabled;
                mounted.abortBtn.textContent = copy.abortLabel || '中断迁移';
            }
        },
        unknown(message) {
            const status = mounted.statusEl();
            if (status) status.textContent = message;
            if (mounted.abortBtn) {
                mounted.abortBtn.disabled = false;
                mounted.abortBtn.textContent = MIGRATION_UNKNOWN_ABORT_LABEL;
                mounted.abortBtn.onclick = () => this.close();
            }
        },
        close: mounted.close,
    };
}

export function mountBackupOverlay(env = {}) {
    const mounted = mountStorageLockOverlay({
        document: env.document,
        id: 'sp-backup-overlay',
        title: env.title,
        status: '准备中…',
        escapeHtml: env.escapeHtml,
    });
    return {
        progress(info = {}) {
            const status = mounted.statusEl();
            if (status) status.textContent = backupOverlayProgressCopy(info);
        },
        close: mounted.close,
    };
}
