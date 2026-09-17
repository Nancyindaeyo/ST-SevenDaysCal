export const FLOOR_JOB_ORDER = Object.freeze([
    'align',
    'advance',
    'supplement',
    'ledger-capture',
    'ledger-judge',
    'outline',
    'dashed',
]);

export const FLOOR_JOB_LABELS = Object.freeze({
    align: '对齐',
    advance: '推进',
    supplement: '补录',
    'ledger-capture': '刻度标注',
    'ledger-judge': '刻度现状',
    outline: '面判定',
    dashed: '冷知识',
});

export const VISIBLE_SKIP_REASONS = Object.freeze(['no-stamp', 'config-missing', 'no-api']);

export function jobLabel(id) {
    return FLOOR_JOB_LABELS[id] || id;
}

export function isVisibleSkipReason(reason) {
    return VISIBLE_SKIP_REASONS.includes(String(reason || ''));
}

function sortJobs(jobs) {
    return [...jobs].sort((a, b) => {
        const left = FLOOR_JOB_ORDER.indexOf(a.id);
        const right = FLOOR_JOB_ORDER.indexOf(b.id);
        return (left < 0 ? 99 : left) - (right < 0 ? 99 : right);
    });
}

function publicJob(job) {
    return job ? { id: job.id, label: job.label || jobLabel(job.id), error: job.error || '', reason: job.reason || '' } : null;
}

export function createFloorJobQueue(env = {}) {
    let generation = 0;
    let floor = null;
    let jobs = [];
    let running = null;
    let queued = [];
    let failed = [];
    let skipped = [];
    let busy = false;

    const snapshot = () => ({
        busy,
        floor,
        running: publicJob(running),
        queued: queued.map(publicJob),
        failed: failed.map(publicJob),
        skipped: skipped.map(publicJob),
    });

    const notify = () => { try { env.onChange?.(snapshot()); } catch {} };

    const identityOk = () => env.identityCurrent?.(floor) !== false;

    const beginFloor = (next = {}) => {
        const incoming = {
            chatId: next.chatId ?? null,
            floorId: Number.isInteger(Number(next.floorId)) ? Number(next.floorId) : null,
            signature: String(next.signature || ''),
        };
        if (busy && floor && (floor.chatId !== incoming.chatId || floor.floorId !== incoming.floorId)) {
            abort('new-floor');
        }
        if (!busy && (!floor || floor.chatId !== incoming.chatId || floor.floorId !== incoming.floorId)) {
            jobs = [];
            queued = [];
            running = null;
            failed = [];
            skipped = [];
            notify();
        }
        if (!busy) floor = incoming;
        return snapshot();
    };

    const enqueue = (job = {}) => {
        if (!job?.id || typeof job.run !== 'function') return false;
        if (running?.id === job.id || queued.some(item => item.id === job.id) || jobs.some(item => item.id === job.id)) return false;
        const pending = {
            id: job.id,
            label: job.label || jobLabel(job.id),
            run: job.run,
            retry: job.retry || job.run,
        };
        if (busy) queued = sortJobs([...queued, pending]);
        else {
            jobs.push(pending);
            jobs = sortJobs(jobs);
            queued = jobs.slice();
        }
        notify();
        return true;
    };

    const markFailed = (job, result) => {
        failed = failed.filter(item => item.id !== job.id);
        failed.push({
            ...job,
            error: String(result?.error?.message || result?.error || result?.reason || ''),
            reason: String(result?.reason || ''),
        });
        try { env.onJobFailed?.(publicJob(job), result, snapshot()); } catch {}
    };

    const markSkipped = (job, result) => {
        skipped = skipped.filter(item => item.id !== job.id);
        skipped.push({
            ...job,
            error: String(result?.reason || result?.error?.message || result?.error || ''),
            reason: String(result?.reason || ''),
        });
        failed = failed.filter(item => item.id !== job.id);
    };

    const markOk = (job) => {
        failed = failed.filter(item => item.id !== job.id);
        skipped = skipped.filter(item => item.id !== job.id);
    };

    const runOne = async (job) => {
        running = job;
        notify();
        let result;
        try {
            result = await job.run();
        } catch (error) {
            result = { status: 'failed', error };
        }
        const status = result?.status || 'skipped';
        if (status === 'failed') markFailed(job, result);
        else if (status === 'skipped' && isVisibleSkipReason(result?.reason)) markSkipped(job, result);
        else markOk(job);
        running = null;
        notify();
        return result;
    };

    const drain = async () => {
        if (busy) return snapshot();
        if (!jobs.length) return snapshot();
        busy = true;
        const token = ++generation;
        queued = jobs.slice();
        jobs = [];
        try { env.setBusy?.(true); } catch {}
        notify();
        while (queued.length) {
            if (token !== generation) break;
            if (!identityOk()) break;
            const job = queued.shift();
            await runOne(job);
        }
        queued = [];
        running = null;
        busy = false;
        try { env.setBusy?.(false); } catch {}
        notify();
        return snapshot();
    };

    const abort = (reason = 'abort') => {
        generation += 1;
        queued = [];
        jobs = [];
        running = null;
        busy = false;
        try { env.setBusy?.(false); } catch {}
        notify();
        return { status: 'cancelled', reason };
    };

    const retry = async (id) => {
        const job = failed.find(item => item.id === id) || skipped.find(item => item.id === id);
        if (!job) return { status: 'skipped', reason: 'no-failed' };
        const result = await runOne({ ...job, run: job.retry || job.run });
        if (result?.status !== 'failed') markOk(job);
        return result;
    };

    const resetFailed = () => {
        failed = [];
        skipped = [];
        notify();
    };

    return {
        beginFloor,
        enqueue,
        drain,
        abort,
        retry,
        resetFailed,
        snapshot,
        get busy() { return busy; },
        get failed() { return failed.map(publicJob); },
        get skipped() { return skipped.map(publicJob); },
    };
}
