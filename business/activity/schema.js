export const ACTIVITY_CAP = 24;
export const ALIGN_ROUND_CAP = 3;

export const ACTIVITY_SOURCES = Object.freeze({
    'align-auto': '自动对齐',
    align: '按正文对齐',
    advance: '线推进',
    outline: '面判定',
    guide: '间引导',
    refresh: '手动刷新',
    dashed: '冷知识',
    shift: '换日滚点',
    'date-align': '点日期对齐',
    fill: '点窗口补齐',
    bootstrap: '开局生成',
    'ledger-capture': '刻度标注',
    'ledger-judge': '刻度现状',
    supplement: '补录纪念日',
});

export const ACTIVITY_CAUSES = Object.freeze({
    reroll: '重 roll 后按新正文补',
    retry: '按最新楼重试',
});

export const ACTIVITY_OUTCOMES = Object.freeze({
    patched: 'patched',
    unchanged: 'unchanged',
    failed: 'failed',
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
    archive: '移入过去',
});

export const ACTIVITY_MODULES = Object.freeze({
    point: '点',
    lines: '线',
    outline: '面',
    dashed: '冷知识',
    ledger: '刻度',
});

export function activityId(now = Date.now(), random = Math.random) {
    return `act-${now.toString(36)}-${Math.floor(random() * 1e6).toString(36)}`;
}

export function normalizeActivityItem(raw) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const module = ACTIVITY_MODULES[item.module] ? item.module : '';
    const action = ACTIVITY_ACTIONS[item.action] ? item.action : '';
    const ref = String(item.ref || '').trim().slice(0, 80);
    return {
        module,
        title: String(item.title || '').trim().slice(0, 80),
        action,
        ...(ref ? { ref } : {}),
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
    if (Array.isArray(raw.dashed)) snapshot.dashed = JSON.parse(JSON.stringify(raw.dashed));
    if (raw.ledger && typeof raw.ledger === 'object') snapshot.ledger = JSON.parse(JSON.stringify(raw.ledger));
    return Object.keys(snapshot).length ? snapshot : null;
}

export function isAlignEntry(entry) {
    return entry?.source === 'align-auto' || entry?.source === 'align';
}

export function isAdvanceEntry(entry) {
    return entry?.source === 'advance';
}

export function isRetryableEntry(entry) {
    return isAlignEntry(entry)
        || isAdvanceEntry(entry)
        || entry?.source === 'supplement'
        || entry?.source === 'outline'
        || entry?.source === 'dashed'
        || entry?.source === 'ledger-capture'
        || entry?.source === 'ledger-judge';
}

export function alignSourceOf(options = {}) {
    const cause = String(options.cause || '');
    if (options.auto === true || cause === 'reroll' || cause === 'retry' || cause === 'auto') return 'align-auto';
    return 'align';
}

export function floorUnchangedNote(floorId) {
    const floor = Number(floorId);
    if (!Number.isInteger(floor) || floor < 0) return '这楼没有变化';
    return `${floor}楼没有变化`;
}

export function causeLabel(cause) {
    return ACTIVITY_CAUSES[cause] || '';
}

export function normalizeCause(value) {
    const cause = String(value || '');
    return cause === 'auto' || cause === 'manual' || ACTIVITY_CAUSES[cause] ? cause : '';
}

export function alignRounds(entries = [], cap = ALIGN_ROUND_CAP) {
    return (Array.isArray(entries) ? entries : []).filter(isAlignEntry).slice(0, Math.max(1, cap));
}

export function isLatestAlignAttempt(entry, entries = []) {
    return !!entry && alignRounds(entries, 1)[0]?.id === entry.id;
}

export function canUndoActivity(entry, entries = []) {
    if (!entry || entry.undone || !entry.snapshot) return false;
    if (!isAlignEntry(entry)) return true;
    return isLatestAlignAttempt(entry, entries) && entry.outcome !== 'failed' && entry.outcome !== 'unchanged';
}

export function undoItemKey(item = {}) {
    return String(item.ref || `${item.module || ''}:${item.title || ''}:${item.action || ''}`);
}

export function remainingUndoItems(entry) {
    const done = new Set(entry?.undoneRefs || []);
    return (entry?.items || []).filter(item => item.module === 'point' || item.module === 'lines').filter(item => !done.has(undoItemKey(item)));
}

function optionalIndex(value) {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isInteger(n) ? n : null;
}

export function normalizeActivityEntry(raw, { now = Date.now(), random = Math.random } = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const items = (Array.isArray(source.items) ? source.items : []).map(normalizeActivityItem).filter(item => item.module || item.title);
    const outcome = ACTIVITY_OUTCOMES[source.outcome] || '';
    return {
        id: String(source.id || activityId(now, random)),
        ts: Number(source.ts) || now,
        source: ACTIVITY_SOURCES[source.source] ? source.source : 'refresh',
        cause: normalizeCause(source.cause),
        outcome,
        error: String(source.error || '').trim().slice(0, 200),
        items,
        snapshot: outcome === 'failed' || outcome === 'unchanged' ? null : normalizeActivitySnapshot(source.snapshot),
        after: outcome === 'failed' || outcome === 'unchanged' ? null : normalizeActivitySnapshot(source.after),
        undone: source.undone === true,
        undoneRefs: Array.isArray(source.undoneRefs) ? source.undoneRefs.map(value => String(value || '')).filter(Boolean).slice(0, 40) : [],
        stale: source.stale === true,
        note: String(source.note || '').trim().slice(0, 280),
        floorId: optionalIndex(source.floorId),
        swipeId: optionalIndex(source.swipeId),
        signature: String(source.signature || ''),
    };
}

export function sourceLabel(source) {
    return ACTIVITY_SOURCES[source] || '改动';
}

export function actionLabel(action, module = '') {
    if (action === 'complete' && module === 'lines') return '收束';
    return ACTIVITY_ACTIONS[action] || action || '改动';
}

export function moduleLabel(module) {
    return ACTIVITY_MODULES[module] || module || '';
}

export function entryTouchesLines(entry) {
    if (!entry || typeof entry !== 'object') return false;
    if (isAlignEntry(entry) || entry.source === 'advance' || entry.source === 'dashed') return true;
    if (entry.snapshot?.lines != null || entry.after?.lines != null) return true;
    return (entry.items || []).some(item => item?.module === 'lines' || item?.module === 'dashed');
}

export function entryTouchesPoint(entry) {
    if (!entry || typeof entry !== 'object') return false;
    if (isAlignEntry(entry)) return true;
    if (entry.snapshot?.point != null || entry.after?.point != null) return true;
    return (entry.items || []).some(item => item?.module === 'point');
}
