import { isAlignEntry } from './schema.js';

export const PACE_EXPANDABLE = Object.freeze(['align', 'advance', 'outline', 'dashed', 'supplement', 'ledger-capture', 'ledger-judge']);

export function isPaceExpandable(paceId) {
    return PACE_EXPANDABLE.includes(String(paceId || ''));
}

export function entryMatchesPace(entry, paceId) {
    if (!entry) return false;
    if (paceId === 'align') return isAlignEntry(entry);
    if (paceId === 'advance') return entry.source === 'advance';
    if (paceId === 'outline') return entry.source === 'outline';
    if (paceId === 'dashed') return entry.source === 'dashed';
    if (paceId === 'supplement') return entry.source === 'supplement';
    if (paceId === 'ledger-capture') return entry.source === 'ledger-capture';
    if (paceId === 'ledger-judge') return entry.source === 'ledger-judge';
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
    if (module === 'ledger') return { view: 'almanac', sheet: 'ledger' };
    if (module === 'almanac') return { view: 'almanac', sheet: 'upcoming' };
    return null;
}

export function catalogFromBooks(books = {}) {
    const rows = [];
    for (const event of books.pointEvents || []) rows.push({ id: event.id, title: event.title, module: 'point' });
    for (const line of books.lines || []) rows.push({ id: line.id, name: line.name, title: line.name, module: 'lines' });
    for (const beat of books.outline || []) rows.push({ id: beat.id, title: beat.title, module: 'outline' });
    return rows;
}

export function canJumpActivityItem(item) {
    return Boolean(jumpViewOf(item?.module) && (String(item?.ref || '').trim() || String(item?.title || '').trim()));
}

export function explainJumpMiss({ item, catalog = [], chatRevision, currentRevision } = {}) {
    if (chatRevision != null && currentRevision != null && Number(chatRevision) !== Number(currentRevision)) {
        return { reason: 'chat-mismatch', message: '这条属于另一段聊天，不能跳到当前页' };
    }
    const ref = String(item?.ref || '').trim();
    const title = String(item?.title || '').trim();
    const nameOf = row => String(row?.title || row?.name || '').trim();
    if (ref) {
        const byRef = (Array.isArray(catalog) ? catalog : []).find(row => String(row?.id || row?.ref || '') === ref);
        if (!byRef) return { reason: 'deleted', message: '这条已经删除' };
        if (title && nameOf(byRef) && nameOf(byRef) !== title) {
            return { reason: 'renamed', message: `已改名为「${nameOf(byRef)}」` };
        }
        return { reason: 'missing', message: '这条还在账里，但当前页没有对应卡片' };
    }
    if (title && !(Array.isArray(catalog) ? catalog : []).some(row => nameOf(row) === title)) {
        return { reason: 'deleted', message: '这条已经不在了' };
    }
    return { reason: 'missing', message: '这条已经不在了' };
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
