export function matchQuery(hay, query) {
    const raw = String(query || '').trim().toLowerCase();
    if (!raw) return true;
    const text = String(hay || '').toLowerCase();
    return raw.split(/\s+/).filter(Boolean).every(word => text.includes(word));
}

export function hayOf(parts) {
    return (Array.isArray(parts) ? parts : [parts]).map(value => String(value || '')).join('\n');
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
