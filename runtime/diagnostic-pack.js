import { PLUGIN_VERSION } from '../version.js';
import { detectPromptContractConflicts, promptContractCatalog } from './prompt-contracts.js';
import { authorDraftsSnapshot } from '../business/utils/author-draft.js';
import { utilityRouteSnapshot } from './utility-route.js';

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
    'utilityPresetId',
    'utilityPaused',
    'utilityAllowMain',
]);

export function settingsSnapshot(settings = {}) {
    const out = {};
    for (const key of SETTING_FLAGS) {
        if (settings[key] !== undefined) out[key] = settings[key];
    }
    if (settings.ledgerCaptureInterval != null) out.ledgerCaptureInterval = settings.ledgerCaptureInterval;
    if (settings.utilityRoute) out.utilityRoute = utilityRouteSnapshot(settings.utilityRoute);
    if (Array.isArray(settings.authorDraftRecovery)) out.authorDrafts = authorDraftsSnapshot(settings.authorDraftRecovery);
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
            enqueuedAt: Number(item.enqueuedAt) || 0,
            startedAt: Number(item.startedAt) || 0,
        });
    };
    if (queue?.running) push(queue.running, 'running');
    for (const item of queue?.queued || []) push(item, 'queued');
    for (const item of queue?.failed || []) push(item, 'failed');
    for (const item of queue?.skipped || []) push(item, 'skipped');
    for (const item of queue?.rejected || []) push(item, 'rejected');
    for (const item of queue?.cancelled || []) push(item, 'cancelled');
    return jobs;
}

function errorItem(source, title, detail, metadata = {}) {
    return {
        source,
        title: String(title || '未知错误').slice(0, 120),
        detail: String(detail || '').slice(0, 240),
        module: String(metadata.module || '').slice(0, 80),
        floorId: Number.isInteger(Number(metadata.floorId)) ? Number(metadata.floorId) : null,
        ts: Number(metadata.ts) || 0,
    };
}

export function buildDiagnosticOverview({ queue = null, activity = [], safeLogs = [] } = {}) {
    const errors = [];
    for (const item of queue?.failed || []) {
        errors.push(errorItem('queue', `${item.label || item.id || '后台任务'}失败`, item.reason || item.error, {
            module: item.id,
        }));
    }
    for (const item of Array.isArray(activity) ? activity : []) {
        if (item?.outcome !== 'failed') continue;
        errors.push(errorItem('activity', item.note || `${item.source || '改动'}失败`, item.error || item.reasonCode, {
            module: item.source,
            floorId: item.floorId,
            ts: item.ts,
        }));
    }
    for (const item of Array.isArray(safeLogs) ? safeLogs : []) {
        if (item?.status !== 'failed' && item?.status !== 'rejected') continue;
        errors.push(errorItem('trace', `${item.module || '运行时'} · ${item.phase || item.event || '失败'}`, item.detail || item.reasonCode || item.errorClass, {
            module: item.module,
            floorId: item.floor,
            ts: item.ts,
        }));
    }
    errors.sort((left, right) => right.ts - left.ts);
    const queueJobs = jobsFromQueue(queue);
    const running = queueJobs.filter(item => item.status === 'running' || item.status === 'queued').length;
    const skipped = queueJobs.filter(item => item.status === 'skipped').length;
    const tone = errors.length ? 'error' : running ? 'busy' : skipped ? 'warning' : 'ok';
    const label = errors.length ? `发现 ${errors.length} 条错误`
        : running ? `${running} 个后台任务处理中`
            : skipped ? `${skipped} 个任务等待处理`
                : '当前运行正常';
    return {
        tone,
        label,
        errorCount: errors.length,
        queueCount: queueJobs.length,
        logCount: Array.isArray(safeLogs) ? safeLogs.length : 0,
        errors: errors.slice(0, 12),
    };
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
        promptContracts: promptContractCatalog(),
        promptContractConflicts: detectPromptContractConflicts(settings.customPrompt).map(item => item.code),
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
            rejected: queue.rejected || [],
            cancelled: queue.cancelled || [],
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
