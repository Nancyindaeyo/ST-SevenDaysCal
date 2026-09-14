export function ledgerHistoryScopeFromSettings(settings) {
    const mode = ['all', 'recent', 'custom'].includes(settings?.ledgerHistoryScope) ? settings.ledgerHistoryScope : 'recent';
    const limit = Math.max(1, Math.min(500, Math.floor(Number(settings?.ledgerHistoryLimit) || 50)));
    const start = Math.floor(Number(settings?.ledgerHistoryStartFloor));
    const end = Math.floor(Number(settings?.ledgerHistoryEndFloor));
    return {
        mode,
        limit,
        startFloor: Number.isFinite(start) && start >= 0 ? start : 0,
        endFloor: Number.isFinite(end) && end >= 0 ? end : 999999,
    };
}

export function selectHistoryRecords(records, scope = {}) {
    const list = Array.isArray(records) ? records : [];
    if (scope.mode === 'all') return list;
    if (scope.mode === 'custom') {
        const start = Number(scope.startFloor) || 0;
        const end = Number.isFinite(Number(scope.endFloor)) ? Number(scope.endFloor) : 999999;
        return list.filter(record => record.floor >= start && record.floor <= end);
    }
    return list.slice(-Math.max(1, Number(scope.limit) || 50));
}

export function ledgerHistoryScopeLabel(scope = {}) {
    if (scope.mode === 'all') return '全部历史';
    if (scope.mode === 'custom') return `楼号 ${scope.startFloor}–${scope.endFloor}`;
    return `最近 ${scope.limit} 个有效历史角色回复`;
}
