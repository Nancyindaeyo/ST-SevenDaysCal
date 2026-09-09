import { parseStoredPos } from './fab.js';
import { MODAL_ID, OUTLINE_CHAT_H_KEY, PANEL_POS_KEY, PANEL_SIZE_KEY } from './ids.js';

export function clampPanelDrag(left, top, { width = 0, vw = 0, vh = 0 } = {}) {
    return {
        left: Math.max(0, Math.min(left, vw - width)),
        top: Math.max(0, Math.min(top, vh - 60)),
    };
}

export function clampPanelSize(width, height, { vw = 0, vh = 0, mobile = false } = {}) {
    const maxW = mobile ? Math.min(vw - 10, 500) : vw - 10;
    return {
        width: Math.max(280, Math.min(maxW, width)),
        height: Math.max(300, Math.min(vh - 10, height)),
    };
}

export function clampOutlineChatHeight(height) {
    return Math.max(80, Math.min(420, height));
}

export function mobileSheetFrame({ vh = 0, offsetTop = 0, safeTop = 0, safeBot = 0 } = {}) {
    const marginTop = 20 + safeTop;
    const bottomGap = 20 + safeBot;
    return {
        top: offsetTop + marginTop,
        height: Math.max(260, vh - marginTop - bottomGap),
    };
}

export function runOpenSchedule(h) {
    h.show?.();
    h.resetHome?.();
    if (h.lastMainView?.() && h.lastMainView() !== 'schedule' && h.restoreLastView?.()) {
        h.afterOpen?.();
        return { status: 'restored' };
    }
    h.paintHome?.();
    h.afterOpen?.();
    return { status: 'home' };
}

export function createPanelWindow(env = {}) {
    const $ = env.$;
    const doc = env.document || globalThis.document;
    const win = env.window || globalThis.window;
    const modalId = env.modalId || MODAL_ID;
    const posKey = env.posKey || PANEL_POS_KEY;
    const sizeKey = env.sizeKey || PANEL_SIZE_KEY;
    const outlineHKey = env.outlineHKey || OUTLINE_CHAT_H_KEY;
    let dragState = null;
    let resizeState = null;
    let resizeRAF = null;
    let viewportSyncBound = false;

    function sheet() { return env.sheet?.() || env.inEl?.('.sp-sheet'); }

    function onDragMove(e) {
        if (!dragState) return;
        if (e.buttons === 0 && !e.touches) { onDragEnd(); return; }
        e.preventDefault();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const el = sheet();
        const box = clampPanelDrag(
            dragState.origLeft + cx - dragState.startX,
            dragState.origTop + cy - dragState.startY,
            { width: el.offsetWidth, vw: win.innerWidth, vh: win.innerHeight },
        );
        el.style.left = `${box.left}px`;
        el.style.top = `${box.top}px`;
        el.style.right = 'auto';
    }

    function onDragEnd() {
        if (!dragState) return;
        const el = sheet();
        const rect = el.getBoundingClientRect();
        if (!env.isMobile?.()) win.localStorage.setItem(posKey, JSON.stringify({ left: rect.left, top: rect.top }));
        dragState = null;
        $(doc).off('mousemove.spdrag mouseup.spdrag');
        doc.removeEventListener('touchmove', onDragMove);
        doc.removeEventListener('touchend', onDragEnd);
        doc.body.style.cursor = '';
    }

    function onDragStart(e) {
        if (env.isMobile?.()) return;
        if (e.type === 'mousedown' && e.button !== 0) return;
        if ($(e.target).closest('.sp-icon-btn, .sp-sub-btn, button, a, input, textarea').length) return;
        e.preventDefault();
        const el = sheet();
        if (el.style.transform !== 'none') {
            el.style.animation = 'none';
            const snap = el.getBoundingClientRect();
            el.style.transform = 'none';
            el.style.right = 'auto';
            el.style.left = `${snap.left}px`;
            el.style.top = `${snap.top}px`;
        }
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = el.getBoundingClientRect();
        dragState = { startX: cx, startY: cy, origLeft: rect.left, origTop: rect.top };
        $(doc).on('mousemove.spdrag', onDragMove).on('mouseup.spdrag', onDragEnd);
        doc.addEventListener('touchmove', onDragMove, { passive: false });
        doc.addEventListener('touchend', onDragEnd);
        doc.body.style.cursor = 'grabbing';
    }

    function onResizeMove(e) {
        if (!resizeState) return;
        e.preventDefault();
        const touch = e.touches?.[0] ?? e.changedTouches?.[0];
        const cx = touch ? touch.clientX : e.clientX;
        const cy = touch ? touch.clientY : e.clientY;
        if (resizeRAF) return;
        resizeRAF = win.requestAnimationFrame(() => {
            resizeRAF = null;
            const el = sheet();
            const mobile = env.isMobile?.() === true;
            const size = clampPanelSize(
                resizeState.origW + cx - resizeState.startX,
                resizeState.origH + cy - resizeState.startY,
                { vw: win.innerWidth, vh: win.innerHeight, mobile },
            );
            el.style.width = `${size.width}px`;
            el.style.height = `${size.height}px`;
            el.style.maxHeight = `${size.height}px`;
            if (mobile) {
                el.style.maxWidth = `${size.width}px`;
                if (!el.style.left || el.style.left === '50%') el.style.left = '50%';
            }
        });
    }

    function onResizeEnd() {
        if (!resizeState) return;
        if (resizeRAF) { win.cancelAnimationFrame(resizeRAF); resizeRAF = null; }
        const el = sheet();
        el.style.willChange = '';
        doc.body.style.userSelect = '';
        win.localStorage.setItem(sizeKey, JSON.stringify({ width: el.offsetWidth, height: el.offsetHeight }));
        resizeState = null;
        $(doc).off('mousemove.spresize mouseup.spresize');
        doc.removeEventListener('touchmove', onResizeMove);
        doc.removeEventListener('touchend', onResizeEnd);
    }

    function onResizeStart(e) {
        if (env.isMobile?.()) return;
        e.preventDefault();
        e.stopPropagation();
        const el = sheet();
        if (!el.style.left || el.style.right !== 'auto') {
            const snap = el.getBoundingClientRect();
            el.style.left = `${snap.left}px`;
            el.style.top = `${snap.top}px`;
            el.style.right = 'auto';
        }
        el.style.willChange = 'width, height';
        doc.body.style.userSelect = 'none';
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        resizeState = { startX: cx, startY: cy, origW: el.offsetWidth, origH: el.offsetHeight };
        $(doc).on('mousemove.spresize', onResizeMove).on('mouseup.spresize', onResizeEnd);
        doc.addEventListener('touchmove', onResizeMove, { passive: false });
        doc.addEventListener('touchend', onResizeEnd);
    }

    function bindOutlineDivider() {
        let divState = null;
        const divEl = env.inEl?.('#sp-outline-divider');
        const chatEl = env.inEl?.('#sp-outline-chat');
        function onDivEnd() {
            if (!divState) return;
            win.localStorage.setItem(outlineHKey, String(chatEl.offsetHeight));
            divState = null;
            doc.removeEventListener('mousemove', onDivMove);
            doc.removeEventListener('mouseup', onDivEnd);
            doc.removeEventListener('touchmove', onDivMove);
            doc.removeEventListener('touchend', onDivEnd);
            doc.removeEventListener('touchcancel', onDivEnd);
        }
        function onDivMove(e) {
            if (!divState) return;
            if ((e.touches && e.touches.length === 0) || (!e.touches && e.buttons === 0)) { onDivEnd(); return; }
            e.preventDefault();
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            chatEl.style.height = `${clampOutlineChatHeight(divState.startH + divState.startY - cy)}px`;
        }
        function onDivStart(e) {
            e.preventDefault();
            const savedH = parseInt(win.localStorage.getItem(outlineHKey), 10) || 210;
            chatEl.style.height = `${savedH}px`;
            divState = { startY: e.touches ? e.touches[0].clientY : e.clientY, startH: chatEl.offsetHeight };
            doc.addEventListener('mousemove', onDivMove);
            doc.addEventListener('mouseup', onDivEnd);
            doc.addEventListener('touchmove', onDivMove, { passive: false });
            doc.addEventListener('touchend', onDivEnd);
            doc.addEventListener('touchcancel', onDivEnd);
        }
        divEl.addEventListener('mousedown', onDivStart);
        divEl.addEventListener('touchstart', onDivStart, { passive: false });
    }

    function restoreOutlineChatHeight() {
        const h = parseInt(win.localStorage.getItem(outlineHKey), 10) || 210;
        const el = env.inEl?.('#sp-outline-chat');
        if (el) el.style.height = `${h}px`;
    }

    function syncMobile() {
        if (!env.isMobile?.()) return;
        const root = doc.getElementById(modalId);
        const el = sheet();
        if (!root || !el || root.style.display === 'none') return;
        const probe = doc.createElement('div');
        probe.style.cssText = 'position:fixed;visibility:hidden;top:env(safe-area-inset-top,0px);bottom:env(safe-area-inset-bottom,0px)';
        doc.body.appendChild(probe);
        const cs = win.getComputedStyle(probe);
        const safeTop = parseFloat(cs.top) || 0;
        const safeBot = parseFloat(cs.bottom) || 0;
        doc.body.removeChild(probe);
        const vv = win.visualViewport;
        const vh = Math.max(320, Math.round((vv?.height || win.innerHeight)));
        const offsetTop = vv ? Math.max(0, vv.offsetTop) : 0;
        const frame = mobileSheetFrame({ vh, offsetTop, safeTop, safeBot });
        const nextTop = `${frame.top}px`;
        const nextHeight = `${frame.height}px`;
        if (el.style.top === nextTop && el.style.height === nextHeight && el.style.maxHeight === nextHeight) return;
        const settingsBody = env.settingsOpen?.() ? env.inEl?.('.sp-settings-body') : null;
        const savedScrollTop = settingsBody?.scrollTop;
        el.style.top = nextTop;
        el.style.height = nextHeight;
        el.style.maxHeight = nextHeight;
        if (!settingsBody) return;
        if (settingsBody.scrollTop !== savedScrollTop) settingsBody.scrollTop = savedScrollTop;
        const focused = env.shadow?.()?.activeElement;
        const tagName = focused?.tagName;
        if (!focused || !settingsBody.contains(focused)
            || (tagName !== 'INPUT' && tagName !== 'TEXTAREA' && tagName !== 'SELECT' && !focused.isContentEditable)) return;
        const bodyRect = settingsBody.getBoundingClientRect();
        const focusRect = focused.getBoundingClientRect();
        const above = focusRect.top < bodyRect.top;
        const below = focusRect.bottom > bodyRect.bottom;
        if (above && below) return;
        if (below) settingsBody.scrollTop += focusRect.bottom - bodyRect.bottom;
        else if (above) settingsBody.scrollTop -= bodyRect.top - focusRect.top;
    }

    function bindViewportSync() {
        if (viewportSyncBound) return;
        viewportSyncBound = true;
        const onViewportChange = () => syncMobile();
        win.addEventListener('resize', onViewportChange);
        win.addEventListener('orientationchange', onViewportChange);
        if (win.visualViewport) {
            win.visualViewport.addEventListener('resize', onViewportChange);
            win.visualViewport.addEventListener('scroll', onViewportChange);
        }
    }

    function position() {
        const el = sheet();
        if (!el) return;
        if (env.isMobile?.()) {
            el.style.left = '';
            el.style.top = '';
            el.style.right = '';
            el.style.height = '';
            el.style.transform = '';
            syncMobile();
            bindViewportSync();
            return;
        }
        const pos = parseStoredPos(win.localStorage.getItem(posKey));
        if (pos) {
            el.style.left = `${Math.min(pos.left, win.innerWidth - el.offsetWidth)}px`;
            el.style.top = `${Math.min(pos.top, win.innerHeight - 60)}px`;
            el.style.right = 'auto';
        }
    }

    function show() {
        const $root = $(`#${modalId}`);
        const el = sheet();
        if (el) el.style.animation = '';
        $root.stop(true).css({ display: 'block', opacity: 0 }).animate({ opacity: 1 }, 180);
        win.setTimeout(() => { position(); syncMobile(); }, 0);
    }

    function hide() {
        $(`#${modalId}`).stop(true).animate({ opacity: 0 }, 150, function () {
            $(this).css('display', 'none');
        });
    }

    return {
        show, hide, position, syncMobile,
        onDragStart, onResizeStart,
        bindOutlineDivider, restoreOutlineChatHeight,
        bindDrag(handle) {
            if (!handle) return;
            handle.addEventListener('mousedown', onDragStart);
            handle.addEventListener('touchstart', onDragStart, { passive: false });
        },
        bindResize($handle, handle) {
            $handle?.on('mousedown', onResizeStart);
            handle?.addEventListener('touchstart', onResizeStart, { passive: false });
        },
    };
}
