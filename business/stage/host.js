import { parseCalendar } from '../point/parse.js';
import { activeLines } from '../lines/strategy.js';
import { buildFestivalRows, collectStageSnapshot } from './snapshot.js';
import { createStageFeature } from './feature.js';

// 日台取数宿主：把点/历/刻度/线收成只读快照。算法仍在 snapshot.js；这里不进注入、不写账。
export function createStageHost(env = {}) {
    const parseDays = env.parseCalendar || parseCalendar;
    const takeLines = env.activeLines || activeLines;
    const festivalRows = env.buildFestivalRows || buildFestivalRows;
    const snapshot = env.collectSnapshot || collectStageSnapshot;
    const createFeature = env.createFeature || createStageFeature;

    function collect() {
        const cal = env.calendar?.() || {};
        const evidence = env.todayEvidence?.();
        const anchor = evidence || env.todayAnchor?.();
        const todayLabel = evidence
            ? env.formatDayDate?.({ year: env.storyYear?.(evidence), month: evidence.month, day: evidence.day })
            : '';
        let days = [];
        try {
            const saved = env.readPoint?.();
            if (saved?.raw) days = parseDays(saved.raw, cal)?.days || [];
        } catch { days = []; }
        const festivals = festivalRows(env.loadAlmanac?.() || [], {
            cal,
            anchor,
            daysUntil: env.daysUntil,
            dayOfYear: env.dayOfYear,
            coversDoy: env.coversDoy,
            clampInt: env.clampInt,
            yearLen: env.yearLen,
            sort: env.sortUpcoming,
        });
        const ledgerEntries = (env.listLedger?.() || []).map(entry => ({
            ...entry,
            due: env.dueInfo?.(entry),
        }));
        let lines = [];
        try {
            lines = takeLines(env.readLinesRaw?.() || '');
        } catch { lines = []; }
        return snapshot({ todayLabel, days, festivals, ledger: ledgerEntries, lines });
    }

    return {
        collect,
        feature: createFeature({
            collect,
            jump: env.jump,
            $in: env.$in,
            onOpen: env.onOpen,
        }),
    };
}
