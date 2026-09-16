export const FESTIVAL_WINDOW_DAYS = 7;
export const LEDGER_DUE_WINDOW_DAYS = 3;
export const NEAR_WHEN_RX = /今[天日夜晚]|今夜|今晚|近日|明天|明日|后天/;

export function pickTodayPoint(days = []) {
    const list = Array.isArray(days) ? days : [];
    return list.find(day => Number(day?.dayNumber) === 1) || list[0] || null;
}

export function pickUpcomingFestivals(rows = [], windowDays = FESTIVAL_WINDOW_DAYS) {
    return (Array.isArray(rows) ? rows : [])
        .filter(row => row && (row.days === -1 || (Number.isFinite(row.days) && row.days <= windowDays)))
        .slice(0, 6);
}

export function pickDueLedger(entries = [], windowDays = LEDGER_DUE_WINDOW_DAYS) {
    return (Array.isArray(entries) ? entries : []).filter(entry => {
        if (entry?.类型 === '持续状态') return true;
        const due = entry?.due;
        if (!due) return false;
        return due.过期 === true || (Number.isFinite(due.天数) && due.天数 <= windowDays);
    }).slice(0, 8);
}

export function pickNearLines(lines = []) {
    return (Array.isArray(lines) ? lines : []).filter(line => {
        if (!line?.name) return false;
        return NEAR_WHEN_RX.test(String(line.when || ''));
    }).slice(0, 8);
}

export function buildFestivalRows(items = [], {
    cal,
    anchor,
    daysUntil,
    dayOfYear,
    coversDoy,
    clampInt,
    yearLen,
    sort,
} = {}) {
    const list = typeof sort === 'function' ? sort(items, cal) : (Array.isArray(items) ? items : []);
    const todayDoy = dayOfYear?.(anchor?.month, anchor?.day, cal);
    return list.map(item => {
        const active = clampInt?.(item?.days, 1, yearLen?.(cal), 1) > 1 && coversDoy?.(item, todayDoy, cal);
        return {
            name: item?.name,
            days: active ? -1 : daysUntil?.(item?.month, item?.day, anchor, cal),
        };
    });
}

export function collectStageSnapshot({
    todayLabel = '',
    days = [],
    festivals = [],
    ledger = [],
    lines = [],
} = {}) {
    const today = pickTodayPoint(days);
    return Object.freeze({
        todayLabel: String(todayLabel || '').trim(),
        point: today ? Object.freeze({
            date: String(today.dateLabel || today.date || '').trim(),
            events: Object.freeze((today.events || []).map(event => Object.freeze({
                title: String(event.title || '').trim(),
                time: String(event.time || '').trim(),
                location: String(event.location || '').trim(),
            })).filter(event => event.title)),
        }) : null,
        festivals: Object.freeze(pickUpcomingFestivals(festivals).map(item => Object.freeze({
            name: String(item.name || '').trim(),
            days: item.days,
        })).filter(item => item.name)),
        ledger: Object.freeze(pickDueLedger(ledger).map(entry => Object.freeze({
            id: String(entry.id || '').trim(),
            title: String(entry.事由 || entry.title || '').trim(),
            type: String(entry.类型 || '').trim(),
            due: entry.due || null,
        })).filter(entry => entry.title)),
        lines: Object.freeze(pickNearLines(lines).map(line => Object.freeze({
            name: String(line.name || '').trim(),
            when: String(line.when || '').trim(),
            stage: String(line.stage || '').trim(),
        }))),
    });
}

export function festivalWhenLabel(days) {
    if (days === -1) return '进行中';
    if (days === 0) return '今天';
    if (Number.isFinite(days) && days > 0) return `还有${days}天`;
    return '';
}

export function ledgerWhenLabel(entry) {
    if (entry?.type === '持续状态') return '还在';
    const due = entry?.due;
    if (!due) return '';
    if (due.过期) return `已过期 ${due.天数} 天`;
    if (due.天数 === 0) return '今天到期';
    return `还有${due.天数}天`;
}
