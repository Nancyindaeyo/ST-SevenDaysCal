export function matchQuery(hay, query) {
    const raw = String(query || '').trim().toLowerCase();
    if (!raw) return true;
    const text = String(hay || '').toLowerCase();
    return raw.split(/\s+/).filter(Boolean).every(word => text.includes(word));
}

export function hayOf(parts) {
    return (Array.isArray(parts) ? parts : [parts]).map(value => String(value || '')).join('\n');
}

export function coordinateBrowseMode(value) {
    return value === 'tag' || value === 'theater' ? value : 'char';
}

export function groupItemsByTag(items, tags) {
    const list = Array.isArray(items) ? items : [];
    const tagList = Array.isArray(tags) ? tags : [];
    const buckets = new Map(tagList.map(tag => [tag.id, { tag, items: [] }]));
    const untagged = [];
    for (const item of list) {
        const ids = [...new Set((item?.tags || []).filter(id => buckets.has(id)))];
        if (!ids.length) untagged.push(item);
        else for (const id of ids) buckets.get(id).items.push(item);
    }
    return { groups: tagList.map(tag => buckets.get(tag.id)).filter(group => group.items.length), untagged };
}

export function theaterGroupKey(item) {
    if (String(item?.kind || '') !== 'theater') return '';
    const batch = String(item.batchId || '').trim();
    if (batch) return `batch:${batch}`;
    const id = String(item.id || '').trim();
    return id ? `item:${id}` : '';
}

export function theaterGroupTitle(items) {
    const list = Array.isArray(items) ? items : [];
    if (list.length > 1) {
        const form = String(list.find(item => String(item.formName || '').trim())?.formName || '').trim();
        if (form) return form;
    }
    const note = String(list.find(item => String(item.note || '').trim())?.note || '').trim();
    if (note) return note;
    const form = String(list.find(item => String(item.formName || '').trim())?.formName || '').trim();
    return form || '未命名小剧场';
}

export function groupItemsByTheater(items) {
    const list = (Array.isArray(items) ? items : []).filter(item => theaterGroupKey(item));
    const buckets = new Map();
    for (const item of list) {
        const id = theaterGroupKey(item);
        const group = buckets.get(id) || { id, items: [] };
        group.items.push(item);
        buckets.set(id, group);
    }
    return {
        groups: [...buckets.values()].map(group => ({
            id: group.id,
            title: theaterGroupTitle(group.items),
            items: group.items,
        })).sort((a, b) => Math.max(0, ...b.items.map(item => item.ts || 0)) - Math.max(0, ...a.items.map(item => item.ts || 0))),
    };
}
