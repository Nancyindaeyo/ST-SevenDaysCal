import { PLUGIN_VERSION } from '../version.js';

const SETTING_FLAGS = Object.freeze([
    'pluginEnabled',
    'injectEnabled',
    'storyClockEnabled',
    'linesEnabled',
    'linesMode',
    'linesInterval',
    'dashedEnabled',
    'outlineJudgeEnabled',
    'ledgerCaptureEnabled',
    'ledgerJudgeInterval',
    'notifyMode',
]);

export function settingsSnapshot(settings = {}) {
    const out = {};
    for (const key of SETTING_FLAGS) {
        if (settings[key] !== undefined) out[key] = settings[key];
    }
    if (settings.ledgerCaptureInterval != null) out.ledgerCaptureInterval = settings.ledgerCaptureInterval;
    return out;
}

export function compactActivityEntries(entries = [], limit = 8) {
    const cap = Math.max(1, Number(limit) || 8);
    return (Array.isArray(entries) ? entries : []).slice(0, cap).map(entry => ({
        source: entry?.source || '',
        outcome: entry?.outcome || '',
        error: String(entry?.error || '').slice(0, 200),
        reasonCode: String(entry?.reasonCode || '').slice(0, 80),
        note: String(entry?.note || '').slice(0, 280),
        floorId: Number.isInteger(Number(entry?.floorId)) ? Number(entry.floorId) : null,
        items: Array.isArray(entry?.items) ? entry.items.slice(0, 12) : [],
        ts: Number(entry?.ts) || 0,
    }));
}

export function jobsFromQueue(queue = null) {
    const jobs = [];
    const push = (item, status) => {
        if (!item?.id) return;
        jobs.push({
            id: item.id,
            label: item.label || item.id,
            status,
            reason: String(item.reason || item.error || ''),
        });
    };
    if (queue?.running) push(queue.running, 'running');
    for (const item of queue?.queued || []) push(item, 'queued');
    for (const item of queue?.failed || []) push(item, 'failed');
    for (const item of queue?.skipped || []) push(item, 'skipped');
    return jobs;
}

export function dayKey(value) {
    if (!value || typeof value !== 'object') return '';
    const month = Number(value.month);
    const day = Number(value.day);
    if (!Number.isInteger(month) || !Number.isInteger(day)) return '';
    const year = Number(value.year);
    return Number.isInteger(year) && year > 0 ? `${year}-${month}-${day}` : `${month}-${day}`;
}

export function buildSafeDiagnosticPack({
    pluginVersion = PLUGIN_VERSION,
    settings = {},
    chat = {},
    queue = null,
    activity = [],
    safeLogs = [],
    userNote = '',
    exportedAt = new Date().toISOString(),
} = {}) {
    return {
        format: 'st-sevendayscal-safe-pack',
        version: 1,
        pluginVersion: String(pluginVersion || PLUGIN_VERSION),
        exportedAt,
        userNote: String(userNote || '').trim().slice(0, 400),
        chat: {
            floorCount: Number(chat.floorCount) || 0,
            latestAiFloor: Number.isInteger(Number(chat.latestAiFloor)) ? Number(chat.latestAiFloor) : null,
            stampDay: String(chat.stampDay || ''),
            axisToday: String(chat.axisToday || ''),
            sameFloor: chat.sameFloor === true,
            linesMode: String(chat.linesMode || settings.linesMode || ''),
        },
        settings: settingsSnapshot(settings),
        queue: queue && typeof queue === 'object' ? {
            floor: queue.floor || null,
            running: queue.running || null,
            queued: queue.queued || [],
            failed: queue.failed || [],
            skipped: queue.skipped || [],
        } : null,
        jobs: jobsFromQueue(queue),
        activity: compactActivityEntries(activity),
        safeLogs: Array.isArray(safeLogs) ? safeLogs.slice(-30) : [],
    };
}

export function mergeAssistantDiagnosticPackage(base = {}, extras = {}) {
    return {
        ...base,
        format: 'st-sevendayscal-diagnostic-package',
        version: 2,
        pluginVersion: extras.pluginVersion || PLUGIN_VERSION,
        userNote: String(extras.userNote || '').trim().slice(0, 400),
        runtime: extras.runtime || null,
    };
}
