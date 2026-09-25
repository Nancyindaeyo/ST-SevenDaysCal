// best-effort 失败只进诊断管理，不逐楼 toast。连续相同失败合并成一条。

export function bestEffortFailureKey(item = {}) {
    return `${String(item.module || 'unknown')}|${String(item.reasonCode || item.phase || 'failed')}`;
}

export function isBestEffortFailure(item = {}) {
    return item?.event === 'best-effort-failed' || item?.level === 'best-effort';
}

export function aggregateBestEffortFailures(logs = []) {
    const groups = [];
    for (const item of Array.isArray(logs) ? logs : []) {
        if (!isBestEffortFailure(item)) continue;
        if (item.status !== 'failed' && item.status !== 'rejected') continue;
        const key = bestEffortFailureKey(item);
        const last = groups[groups.length - 1];
        if (last && last.key === key) {
            last.count += 1;
            last.ts = Number(item.ts) || last.ts;
            last.floorId = Number.isInteger(Number(item.floor ?? item.floorId))
                ? Number(item.floor ?? item.floorId)
                : last.floorId;
            continue;
        }
        groups.push({
            key,
            module: String(item.module || 'unknown'),
            reasonCode: String(item.reasonCode || item.phase || ''),
            count: 1,
            ts: Number(item.ts) || 0,
            floorId: Number.isInteger(Number(item.floor ?? item.floorId)) ? Number(item.floor ?? item.floorId) : null,
        });
    }
    return groups;
}

export function noteBestEffortFailure(trace, metadata = {}) {
    const record = {
        event: 'best-effort-failed',
        module: metadata.module || 'unknown',
        status: 'rejected',
        phase: metadata.phase || 'best-effort',
        reasonCode: metadata.reasonCode || 'best-effort-failed',
        floor: metadata.floor,
        detail: metadata.detail,
        level: 'best-effort',
    };
    try { return trace?.(record.event, record) || record; }
    catch { return record; }
}
