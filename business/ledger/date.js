// 刻度日期纯逻辑：只依赖轴提供的当前日期与环形日期差，不读取宿主状态。
let deps = { today: () => null, daysUntil: () => null, daysUntilFull: null, listEntries: () => [] };

export function bindLedgerDate(next = {}) {
    deps = { ...deps, ...next };
}

export function ledgerDaysSince(entry, today = deps.today()) {
    const a = entry?.起始锚?.历日期;
    if (!a || !Number.isFinite(+a.month) || !Number.isFinite(+a.day)) return null;
    return deps.daysUntil(today.month, today.day, a);
}

export function ledgerDueInfo(entry, today = deps.today()) {
    const d = entry?.到期锚?.历日期;
    if (!d || !Number.isFinite(+d.month) || !Number.isFinite(+d.day)) return null;
    // 一次性与周期：两边都有年才用完整序差；没有年保持 unknown，不用年环猜过期。
    if (!Number.isFinite(+d.year) || !Number.isFinite(+today?.year) || typeof deps.daysUntilFull !== 'function') return null;
    const delta = deps.daysUntilFull(today, d);
    if (!Number.isFinite(delta)) return null;
    return delta === 0 ? { 天数: 0, 过期: false } : (delta > 0 ? { 天数: delta, 过期: false } : { 天数: Math.abs(delta), 过期: true });
}

export function listJudgeableLedger({ includePending = false } = {}) {
    return deps.listEntries().filter(entry => entry.锁 !== '用户锁'
        && (includePending || entry.来源状态 !== '待确认')
        && entry.来源状态 !== '来源已删除');
}

export function fmtLedgerForJudge(entry, today = deps.today()) {
    const since = ledgerDaysSince(entry, today);
    const sinceText = since == null ? '起始不明' : (since === 0 ? '今天登记' : `距登记 ${since} 天`);
    const due = ledgerDueInfo(entry, today);
    const dueText = !due ? '' : (due.天数 === 0 ? '·今天到期' : (due.过期 ? `·已过期 ${due.天数} 天` : `·还有 ${due.天数} 天到期`));
    const cycle = entry.周期长度 ? `·周期 ${entry.周期长度} 天` : '';
    const who = entry.牵扯?.length ? `·涉及 ${entry.牵扯.join('、')}` : '';
    const pending = entry.来源状态 === '待确认' ? '·来源待确认，请以最新可见正文校对' : '';
    return `[${entry.id}] ${entry.事由}（${entry.类型}）：现状「${entry.现状 || '—'}」｜${sinceText}${dueText}${cycle}${who}${pending}`;
}
