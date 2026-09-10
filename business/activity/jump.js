import { isAlignEntry } from './schema.js';

export const PACE_EXPANDABLE = Object.freeze(['align', 'advance', 'outline', 'dashed']);

export function isPaceExpandable(paceId) {
    return PACE_EXPANDABLE.includes(String(paceId || ''));
}

export function entryMatchesPace(entry, paceId) {
    if (!entry) return false;
    if (paceId === 'align') return isAlignEntry(entry);
    if (paceId === 'advance') return entry.source === 'advance';
    if (paceId === 'outline') return entry.source === 'outline';
    if (paceId === 'dashed') return entry.source === 'dashed';
    return false;
}

export function latestPaceEntry(entries = [], paceId) {
    return (Array.isArray(entries) ? entries : []).find(entry => entryMatchesPace(entry, paceId)) || null;
}

export function jumpViewOf(module) {
    if (module === 'point') return { view: 'schedule', sheet: null };
    if (module === 'lines') return { view: 'lines', sheet: 'events' };
    if (module === 'dashed') return { view: 'lines', sheet: 'dashed' };
    if (module === 'outline') return { view: 'outline', sheet: null };
    return null;
}

export function canJumpActivityItem(item) {
    return Boolean(jumpViewOf(item?.module) && (String(item?.ref || '').trim() || String(item?.title || '').trim()));
}

export function findJumpElement(root, item) {
    if (!root?.querySelectorAll || !item?.module) return null;
    const nodes = root.querySelectorAll(`[data-jump-mod="${item.module}"]`);
    const ref = String(item.ref || '').trim();
    const title = String(item.title || '').trim();
    if (ref) {
        for (const node of nodes) {
            if (String(node.getAttribute('data-jump-ref') || node.getAttribute('data-id') || '') === ref) return node;
        }
    }
    if (title) {
        for (const node of nodes) {
            if (String(node.getAttribute('data-jump-key') || '') === title) return node;
        }
    }
    return null;
}

export function activateContainingPointDay(el, root) {
    const panel = el?.closest?.('.sp-day-panel');
    const track = panel?.parentElement;
    if (!panel || !track) return false;
    const idx = Array.prototype.indexOf.call(track.children, panel);
    const tabs = root?.querySelectorAll?.('#sp-body .sp-tab-bar .sp-tab, .sp-tab-bar .sp-tab');
    const tab = tabs?.[idx];
    if (!tab) return false;
    if (!tab.classList.contains('sp-tab-active')) tab.click();
    return true;
}

export function flashJumpTarget(el) {
    if (!el) return false;
    el.classList.remove('sp-activity-jump-flash');
    void el.offsetWidth;
    el.classList.add('sp-activity-jump-flash');
    el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    return true;
}

export function revealActivityTarget(root, item) {
    const el = findJumpElement(root, item);
    if (!el) return false;
    if (item.module === 'point') activateContainingPointDay(el, root);
    return flashJumpTarget(el);
}
