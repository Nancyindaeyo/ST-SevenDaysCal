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

const firstText = (items, key) => {
    for (const item of items) {
        const text = String(item?.[key] || '').trim();
        if (text) return text;
    }
    return '';
};

export function newestTs(items) {
    return Math.max(0, ...(items || []).map(item => item.ts || 0));
}

function theaterGroupKey(item) {
    if (String(item?.kind || '') !== 'theater') return '';
    const batch = String(item.batchId || '').trim();
    if (batch) return `batch:${batch}`;
    const id = String(item.id || '').trim();
    return id ? `item:${id}` : '';
}

export function theaterGroupTitle(items) {
    const list = Array.isArray(items) ? items : [];
    if (list.length > 1) {
        const form = firstText(list, 'formName');
        if (form) return form;
    }
    return firstText(list, 'note') || firstText(list, 'formName') || '未命名小剧场';
}

export function groupItemsByTheater(items) {
    const buckets = new Map();
    for (const item of Array.isArray(items) ? items : []) {
        const id = theaterGroupKey(item);
        if (!id) continue;
        const group = buckets.get(id) || { id, items: [] };
        group.items.push(item);
        buckets.set(id, group);
    }
    return {
        groups: [...buckets.values()].map(group => ({
            id: group.id,
            title: theaterGroupTitle(group.items),
            items: group.items,
        })).sort((a, b) => newestTs(b.items) - newestTs(a.items)),
    };
}
