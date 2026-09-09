import { showPanelView } from './panel.js';

const SIDE_OFF = Object.freeze({ outline: false, lines: false, space: false, theater: false, almanac: false });

export function handlePanelViewClick(h, $btn) {
    const view = $btn.data('view');
    if (!view) return { status: 'ignored' };
    h.hideIntro?.();
    const isSideTab = $btn.hasClass('sp-side-tab');
    const isSubBtn = $btn.hasClass('sp-sub-btn');
    if (isSideTab && h.settingsOpen?.()) h.toggleSettings?.();
    if (isSideTab) h.activity?.close?.();
    if (isSideTab && h.theaterOn?.() && view !== 'theater') h.theater?.leave?.();
    if (isSideTab) h.closeTaDrawer?.();
    if ($btn.hasClass('sp-ta-trigger')) {
        if (h.pointGenerating?.()) return { status: 'blocked' };
        h.toggleTaDrawer?.();
        return { status: 'ta' };
    }
    if (isSideTab) {
        h.markSideTab?.(view, $btn);
        return openSideView(h, view);
    }
    if (isSubBtn) {
        h.markSubBtn?.(view, $btn);
        return openUserSubView(h, view);
    }
    return { status: 'ignored' };
}

export function openSideView(h, view) {
    const m = h.modes?.() || {};
    if (view === 'outline') {
        if (m.outline) return { status: 'same' };
        h.setModes?.({ ...SIDE_OFF, outline: true });
        showPanelView(h.$in, 'outline');
        h.outline?.open?.();
        return { status: 'outline' };
    }
    if (view === 'lines') {
        if (m.lines) return { status: 'same' };
        h.setModes?.({ ...SIDE_OFF, lines: true });
        showPanelView(h.$in, 'lines');
        h.paintLines?.();
        return { status: 'lines' };
    }
    if (view === 'space') {
        if (m.space) return { status: 'same' };
        h.setModes?.({ ...SIDE_OFF, space: true });
        showPanelView(h.$in, 'space');
        h.space?.open?.();
        return { status: 'space' };
    }
    if (view === 'theater') {
        if (m.theater) return { status: 'same' };
        h.setModes?.({ ...SIDE_OFF, theater: true });
        showPanelView(h.$in, 'theater');
        h.paintTheater?.();
        return { status: 'theater' };
    }
    if (view === 'anchor') {
        h.enterAnchor?.();
        return { status: 'anchor' };
    }
    if (view === 'almanac') {
        if (m.almanac) return { status: 'same' };
        h.setModes?.({ ...SIDE_OFF, almanac: true });
        showPanelView(h.$in, 'almanac');
        h.paintAlmanac?.();
        return { status: 'almanac' };
    }
    h.setModes?.(SIDE_OFF);
    h.coordinate?.close?.();
    showPanelView(h.$in, 'schedule');
    h.paintSchedule?.();
    return { status: 'schedule' };
}

export function openUserSubView(h, view) {
    if (h.pointGenerating?.()) return { status: 'blocked' };
    h.closeTaDrawer?.();
    if (view === h.currentView?.()) return { status: 'same' };
    h.setView?.('user');
    h.paintSchedule?.();
    return { status: 'user' };
}
