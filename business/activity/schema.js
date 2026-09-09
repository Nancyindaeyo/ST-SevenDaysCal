export const ACTIVITY_CAP = 30;

export const ACTIVITY_SOURCES = Object.freeze({
    'align-auto': '自动对齐',
    align: '按正文对齐',
    advance: '线推进',
    outline: '面判定',
    guide: '间引导',
    refresh: '手动刷新',
    dashed: '冷知识',
});

export const ACTIVITY_ACTIONS = Object.freeze({
    complete: '完成并删除',
    postpone: '推迟',
    edit: '改描述',
    stall: '暂缓',
    add: '新增',
    cursor: '游标前进',
    node: '改当前节点',
    continue: '续写',
    replace: '整份替换',
    advance: '往前演化',
});

export const ACTIVITY_MODULES = Object.freeze({
    point: '点',
    lines: '线',
    outline: '面',
    dashed: '冷知识',
});

export function activityId(now = Date.now(), random = Math.random) {
    return `act-${now.toString(36)}-${Math.floor(random() * 1e6).toString(36)}`;
}

export function normalizeActivityItem(raw) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const module = ACTIVITY_MODULES[item.module] ? item.module : '';
    const action = ACTIVITY_ACTIONS[item.action] ? item.action : '';
    return {
        module,
        title: String(item.title || '').trim().slice(0, 80),
        action,
    };
}

export function normalizeActivitySnapshot(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const snapshot = {};
    if (raw.point != null) snapshot.point = String(raw.point);
    if (raw.lines != null) snapshot.lines = String(raw.lines);
    if (raw.outline && typeof raw.outline === 'object') {
        snapshot.outline = { raw: String(raw.outline.raw || ''), cursor: Math.max(0, Math.floor(Number(raw.outline.cursor) || 0)) };
    }
    if (Array.isArray(raw.dashed)) snapshot.dashed = raw.dashed.map(item => ({ id: String(item?.id || ''), text: String(item?.text || '') }));
    return Object.keys(snapshot).length ? snapshot : null;
}

export function normalizeActivityEntry(raw, { now = Date.now(), random = Math.random } = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const items = (Array.isArray(source.items) ? source.items : []).map(normalizeActivityItem).filter(item => item.module || item.title);
    return {
        id: String(source.id || activityId(now, random)),
        ts: Number(source.ts) || now,
        source: ACTIVITY_SOURCES[source.source] ? source.source : 'refresh',
        items,
        snapshot: normalizeActivitySnapshot(source.snapshot),
        after: normalizeActivitySnapshot(source.after),
        undone: source.undone === true,
        stale: source.stale === true,
        note: String(source.note || '').trim().slice(0, 280),
        floorId: Number.isInteger(Number(source.floorId)) ? Number(source.floorId) : null,
        swipeId: Number.isInteger(Number(source.swipeId)) ? Number(source.swipeId) : null,
        signature: String(source.signature || ''),
    };
}

export function sourceLabel(source) {
    return ACTIVITY_SOURCES[source] || '改动';
}

export function actionLabel(action) {
    return ACTIVITY_ACTIONS[action] || action || '改动';
}

export function moduleLabel(module) {
    return ACTIVITY_MODULES[module] || module || '';
}
