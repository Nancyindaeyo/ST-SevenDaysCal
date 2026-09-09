import { coordinateBrowseMode } from './browse.js';

export function enterCoordinateSidebar({ resetModes, hidePanels, showCoordinate, hideSubToggle, setTitle, show, feature } = {}) {
    resetModes?.();
    if (show) show();
    else { hidePanels?.(); showCoordinate?.(); hideSubToggle?.(); setTitle?.('坐标'); }
    feature?.open?.('chars');
}

export function createCoordinateUI({ root = null, onDestroy = null } = {}) {
    const route = { level: 'chars', charName: null, chatId: null, itemId: null, filter: null, shelf: 'snaps', snapSearch: '', clipSearch: '', browse: 'char', groupId: null, from: null, composer: null, excerptEditId: null, fullTagEdit: false, tagEditId: null, tagEditColor: 'slate', tagNewColor: 'rose', tagDeleteId: null };
    let destroyed = false; let interactionItemId = null; const cleanups = new Set();
    const listen = (target, event, handler, options) => { target?.addEventListener?.(event, handler, options); const off = () => target?.removeEventListener?.(event, handler, options); cleanups.add(off); return off; };
    return {
        bind(target = root, event, handler, options) { return listen(target, event, handler, options); },
        setRoute(next, id = null, extra = {}) { if (destroyed) return; const previousLevel = route.level; const value = typeof next === 'object' ? next : { level: next, ...(extra || {}) }; route.level = String(value.level || 'chars'); if ('charName' in value) route.charName = value.charName == null ? null : String(value.charName); if ('chatId' in value) route.chatId = value.chatId == null ? null : String(value.chatId); if ('itemId' in value) route.itemId = value.itemId == null ? null : String(value.itemId); else if (id != null) { if (route.level === 'full') route.itemId = String(id); else if (route.level === 'chats') route.charName = String(id); else route.chatId = String(id); } else if (route.level === 'chars' || route.level === 'tags') { route.chatId = route.itemId = null; } if ('filter' in value) route.filter = value.filter || null; if ('shelf' in value) route.shelf = value.shelf === 'clips' ? 'clips' : 'snaps'; if ('snapSearch' in value) route.snapSearch = String(value.snapSearch || ''); if ('clipSearch' in value) route.clipSearch = String(value.clipSearch || ''); if ('search' in value) { const text = String(value.search || ''); if (route.shelf === 'clips') route.clipSearch = text; else route.snapSearch = text; } if ('browse' in value) route.browse = coordinateBrowseMode(value.browse); if ('groupId' in value) route.groupId = value.groupId == null ? null : String(value.groupId); if ('composer' in value) route.composer = value.composer && typeof value.composer === 'object' ? { quote: String(value.composer.quote || ''), note: String(value.composer.note || ''), snapshotId: value.composer.snapshotId || null } : null; if ('excerptEditId' in value) route.excerptEditId = value.excerptEditId == null ? null : String(value.excerptEditId); if ('fullTagEdit' in value) route.fullTagEdit = !!value.fullTagEdit; if ('tagEditId' in value) route.tagEditId = value.tagEditId == null ? null : String(value.tagEditId); if ('tagEditColor' in value) route.tagEditColor = String(value.tagEditColor || 'slate'); if ('tagNewColor' in value) route.tagNewColor = String(value.tagNewColor || 'rose'); if ('tagDeleteId' in value) route.tagDeleteId = value.tagDeleteId == null ? null : String(value.tagDeleteId); if (previousLevel === 'tags' || route.level === 'tags') { route.tagEditId = null; route.tagDeleteId = null; } if (route.level !== 'full') route.composer = null; if (route.shelf !== 'clips') route.excerptEditId = null; },
        state: () => ({ ...route, route: route.level }),
        setFilter(next) { const value = next || null; route.filter = route.filter === value ? null : value; },
        setShelf(next) { route.shelf = next === 'clips' ? 'clips' : 'snaps'; if (route.shelf === 'clips') { route.level = 'chars'; route.chatId = route.itemId = null; route.composer = null; } else { route.excerptEditId = null; } },
        setSearch(next, shelf = route.shelf) { const text = String(next || ''); if (shelf === 'clips') route.clipSearch = text; else route.snapSearch = text; },
        setBrowse(next) { route.browse = coordinateBrowseMode(next); route.groupId = null; route.level = 'chars'; route.chatId = route.itemId = null; },
        setGroup(id) { route.groupId = id == null ? null : String(id); route.level = id ? 'group' : 'chars'; route.chatId = route.itemId = null; },
        captureFrom() { route.from = { shelf: route.shelf, level: route.level, charName: route.charName, chatId: route.chatId, browse: route.browse, groupId: route.groupId }; },
        backFrom() {
            const from = route.from || { shelf: 'snaps', level: 'chars', browse: route.browse || 'char' };
            route.from = null;
            route.itemId = null;
            route.composer = null;
            if (from.shelf === 'clips') {
                route.shelf = 'clips';
                route.level = 'chars';
                route.chatId = null;
                return;
            }
            route.shelf = 'snaps';
            route.browse = coordinateBrowseMode(from.browse);
            if (from.level === 'group' && from.groupId) {
                route.groupId = from.groupId;
                route.level = 'group';
                route.charName = route.chatId = null;
                return;
            }
            if (from.level === 'items' && from.charName && (from.chatId == null || from.chatId === '')) {
                route.level = 'items';
                route.charName = from.charName;
                route.chatId = null;
                route.groupId = null;
                return;
            }
            if (from.level === 'items' && from.chatId) {
                route.level = 'items';
                route.chatId = from.chatId;
                route.charName = from.charName || null;
                route.groupId = null;
                return;
            }
            if (from.level === 'chats' && from.charName) {
                route.level = 'chats';
                route.charName = from.charName;
                route.chatId = null;
                route.groupId = null;
                return;
            }
            route.level = 'chars';
            route.charName = route.chatId = route.groupId = null;
        },
        setComposer(next) { route.composer = next && typeof next === 'object' ? { quote: String(next.quote || ''), note: String(next.note || ''), snapshotId: next.snapshotId || null } : null; },
        setExcerptEdit(id) { route.excerptEditId = id == null ? null : String(id); },
        setFullTagEdit(next) { route.fullTagEdit = !!next; },
        setTagEdit(id, color = 'slate') { route.tagEditId = id == null ? null : String(id); route.tagEditColor = String(color || 'slate'); route.tagDeleteId = null; },
        setTagEditColor(color) { route.tagEditColor = String(color || 'slate'); },
        setTagNewColor(color) { route.tagNewColor = String(color || 'rose'); },
        setTagDelete(id) { route.tagDeleteId = id == null ? null : String(id); route.tagEditId = null; },
        fullTagEdit: () => route.fullTagEdit,
        route: () => route.level, itemId: () => interactionItemId ?? route.itemId,
        freezeInteraction: () => { interactionItemId = route.itemId; return interactionItemId; },
        clearInteraction: () => { interactionItemId = null; },
        open(next = 'chars') { this.setRoute(next); route.from = null; root?.classList?.add('sp-coordinate-open'); },
        close() { this.setRoute('chars'); route.from = null; root?.classList?.remove('sp-coordinate-open'); },
        destroy() { if (destroyed) return; destroyed = true; for (const off of cleanups) off(); cleanups.clear(); this.close(); onDestroy?.(); },
        isDestroyed: () => destroyed,
    };
}
