export function bookId(prefix = 'item') {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function sameBookItem(left, right, nameOf) {
    const ida = String(left?.id || '').trim();
    const idb = String(right?.id || '').trim();
    if (ida && idb) return ida === idb;
    const na = String(typeof nameOf === 'function' ? nameOf(left) : left?.[nameOf] || '').trim();
    const nb = String(typeof nameOf === 'function' ? nameOf(right) : right?.[nameOf] || '').trim();
    return !!na && na === nb;
}

export function ensureBookId(item, prefix, seen = new Set()) {
    let id = String(item?.id || '').trim();
    if (!id || seen.has(id)) {
        do { id = bookId(prefix); } while (seen.has(id));
        item.id = id;
    } else {
        item.id = id;
    }
    seen.add(item.id);
    return item.id;
}

export function findBookIndex(items, { id = '', name = '', nameOf } = {}) {
    const wantId = String(id || '').trim();
    const list = Array.isArray(items) ? items : [];
    if (wantId) {
        const hit = list.findIndex(item => String(item?.id || '').trim() === wantId);
        if (hit >= 0) return hit;
    }
    const needle = String(name || '').trim();
    if (!needle) return -1;
    const named = [];
    for (let i = 0; i < list.length; i++) {
        const text = String(typeof nameOf === 'function' ? nameOf(list[i]) : list[i]?.[nameOf] || '').trim();
        if (!text) continue;
        named.push({ i, text });
    }
    const exact = named.filter(item => item.text === needle);
    if (exact.length) return exact[0].i;
    const fuzzy = named.filter(item => item.text.includes(needle) || needle.includes(item.text));
    return fuzzy.length === 1 ? fuzzy[0].i : -1;
}

export function fingerprintBookItem(item, keys) {
    return JSON.stringify((keys || []).map(key => item?.[key] ?? null));
}
