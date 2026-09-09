import { DIALOG_HOST_ID, FAB_ID, FAB_POS_KEY, MODAL_ID, PEN_ICON_SVG } from './ids.js';

export function parseStoredPos(raw) {
    try { return JSON.parse(raw || 'null'); } catch { return null; }
}

export function clampFabBox(left, top, { width = 0, height = 0, vw = 0, vh = 0 } = {}) {
    return {
        left: Math.max(0, Math.min(left, vw - width)),
        top: Math.max(0, Math.min(top, vh - height)),
    };
}

export function createFab(env = {}) {
    const $ = env.$;
    const doc = env.document || globalThis.document;
    const win = env.window || globalThis.window;
    const fabId = env.fabId || FAB_ID;
    const modalId = env.modalId || MODAL_ID;
    const dialogHostId = env.dialogHostId || DIALOG_HOST_ID;
    const posKey = env.posKey || FAB_POS_KEY;
    const pen = env.penIcon || PEN_ICON_SVG;
    let busyCount = 0;
    let resizeAbort = null;
    let dragState = null;
    let dragged = false;

    function fabEl() { return doc.getElementById(fabId); }
    function fabBtn() { return fabEl()?.querySelector('.sp-fab-btn'); }

    function applyPos(el, pos) {
        if (!el || !pos) return;
        el.style.left = `${pos.left}px`;
        el.style.top = `${pos.top}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
    }

    function clearInlinePos(el) {
        if (!el) return;
        el.style.left = '';
        el.style.top = '';
        el.style.right = '';
        el.style.bottom = '';
    }

    function setBusy(on) {
        busyCount = Math.max(0, busyCount + (on ? 1 : -1));
        $(`#${fabId} .sp-fab-btn`).toggleClass('sp-fab-busy', busyCount > 0);
    }

    function setExtBtnState(state) {
        const $fab = $(`#${fabId} .sp-fab-btn`);
        $fab.removeClass('sp-btn-generating sp-btn-done');
        if (state) $fab.addClass(`sp-btn-${state}`);
        env.$in?.('.sp-sub-toggle').toggleClass('sp-locked', state === 'generating');
    }

    function removeStaleHosts() {
        doc.querySelectorAll(`#${modalId}, #${dialogHostId}, #${fabId}`).forEach(el => el.remove());
        env.clearShadows?.();
        resizeAbort?.abort();
        resizeAbort = null;
        dragState = null;
    }

    function injectExtButton() {
        const wandHtml = `
        <div id="sp_open_wand" class="list-group-item flex-container flexGap5">
            <div class="fa-solid fa-calendar-days extensionsMenuExtensionButton" title="打开构画"></div>
            <span>构画</span>
        </div>`;
        function mountWandBtn() {
            const c = doc.getElementById('sp_wand_container') || doc.getElementById('extensionsMenu');
            if (!c || doc.getElementById('sp_open_wand')) return false;
            c.insertAdjacentHTML('beforeend', wandHtml);
            doc.getElementById('sp_open_wand')?.addEventListener('click', () => env.open?.());
            return true;
        }
        if (!mountWandBtn()) {
            const obs = new MutationObserver(() => { if (mountWandBtn()) obs.disconnect(); });
            obs.observe(doc.body, { childList: true, subtree: true });
        }
    }

    function onPointerMove(ev) {
        if (!dragState || ev.pointerId !== dragState.pointerId) return;
        const ex = ev.clientX;
        const ey = ev.clientY;
        if (Math.abs(ex - dragState.startX) > 5 || Math.abs(ey - dragState.startY) > 5) dragged = true;
        if (!dragged) return;
        ev.preventDefault?.();
        const f = fabEl();
        const box = clampFabBox(
            dragState.origLeft + ex - dragState.startX,
            dragState.origTop + ey - dragState.startY,
            { width: f.offsetWidth, height: f.offsetHeight, vw: win.innerWidth, vh: win.innerHeight },
        );
        applyPos(f, box);
    }

    function onPointerEnd(ev) {
        if (!dragState || ev.pointerId !== dragState.pointerId) return;
        const pointerId = dragState.pointerId;
        if (dragged) {
            const r = fabEl().getBoundingClientRect();
            win.localStorage.setItem(posKey, JSON.stringify({ left: r.left, top: r.top }));
        }
        dragState = null;
        const captureTarget = ev.currentTarget;
        if (captureTarget?.hasPointerCapture?.(pointerId)) captureTarget.releasePointerCapture(pointerId);
    }

    function inject() {
        doc.querySelectorAll(`#${fabId}`).forEach(el => el.remove());
        const savedPos = parseStoredPos(win.localStorage.getItem(posKey));
        const mobile = env.isMobile?.() === true;
        const posStyle = (!mobile && savedPos)
            ? `left:${savedPos.left}px;top:${savedPos.top}px;right:auto;bottom:auto;`
            : '';
        const shown = env.fabEnabled?.() !== false;
        const html = `<div id="${fabId}" style="position:fixed;z-index:2000000;${posStyle}${shown ? '' : 'display:none'}">
        <button class="sp-fab-btn sp-${env.theme?.() || 'night'}" title="构画"
            style="transform:translateZ(0);clip:auto;">
            ${pen}
        </button>
    </div>`;
        doc.documentElement.insertAdjacentHTML('beforeend', html);
        env.markSurface?.(doc.getElementById(fabId), 'free-window');

        let wasMobile = env.isMobile?.() === true;
        resizeAbort?.abort();
        resizeAbort = new AbortController();
        win.addEventListener('resize', () => {
            const nowMobile = env.isMobile?.() === true;
            if (nowMobile && !wasMobile) {
                clearInlinePos(fabEl());
                const sheet = env.sheet?.();
                if (sheet) {
                    sheet.style.left = ''; sheet.style.top = ''; sheet.style.right = '';
                    sheet.style.transform = ''; sheet.style.width = ''; sheet.style.height = '';
                    sheet.style.maxHeight = ''; sheet.style.maxWidth = '';
                }
            } else if (!nowMobile && wasMobile) {
                const sp = parseStoredPos(win.localStorage.getItem(posKey));
                if (sp) applyPos(fabEl(), {
                    left: Math.min(sp.left, win.innerWidth - 60),
                    top: Math.min(sp.top, win.innerHeight - 60),
                });
            }
            wasMobile = nowMobile;
        }, { signal: resizeAbort.signal });

        const fab = fabEl();
        const fabButton = fabBtn();
        if (!fab || !fabButton) return;
        fabButton.addEventListener('pointerdown', function (e) {
            if (e.isPrimary === false || e.button !== 0 || dragState) return;
            dragged = false;
            const rect = fab.getBoundingClientRect();
            dragState = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                origLeft: rect.left,
                origTop: rect.top,
            };
            fabButton.setPointerCapture?.(e.pointerId);
        });
        fabButton.addEventListener('pointermove', onPointerMove);
        fabButton.addEventListener('pointerup', onPointerEnd);
        fabButton.addEventListener('pointercancel', onPointerEnd);
        fabButton.addEventListener('click', function () {
            if (dragged) return;
            env.panelVisible?.() ? env.close?.() : env.open?.();
        });
    }

    return { inject, setBusy, setExtBtnState, injectExtButton, removeStaleHosts };
}
