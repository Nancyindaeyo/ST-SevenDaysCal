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
    return job ? {
        id: job.id,
        label: job.label || jobLabel(job.id),
        error: job.error || '',
        reason: job.reason || '',
        enqueuedAt: Number(job.enqueuedAt) || 0,
        startedAt: Number(job.startedAt) || 0,
    } : null;
}

export function createFloorJobQueue(env = {}) {
    const now = () => {
        const value = Number(env.now?.());
        return Number.isFinite(value) ? value : Date.now();
    };
    let generation = 0;
    let floor = null;
    let jobs = [];
    let running = null;
    let queued = [];
    let failed = [];
    let skipped = [];
    let rejected = [];
    let cancelled = [];
    let busy = false;

    const snapshot = () => ({
        busy,
        floor,
        running: publicJob(running),
        queued: queued.map(publicJob),
        failed: failed.map(publicJob),
        skipped: skipped.map(publicJob),
        rejected: rejected.map(publicJob),
        cancelled: cancelled.map(publicJob),
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
            rejected = [];
            cancelled = [];
            notify();
        }
        if (!busy) floor = incoming;
        return snapshot();
    };

    const enqueue = (job = {}) => {
        const reject = reason => {
            if (job?.id) {
                rejected = [{ id: job.id, label: job.label || jobLabel(job.id), reason, enqueuedAt: now() }, ...rejected.filter(item => item.id !== job.id)].slice(0, 8);
                notify();
            }
            return false;
        };
        if (!job?.id || typeof job.run !== 'function') return reject('invalid-job');
        if (running?.id === job.id || queued.some(item => item.id === job.id) || jobs.some(item => item.id === job.id)) return reject('duplicate');
        const pending = {
            id: job.id,
            label: job.label || jobLabel(job.id),
            run: job.run,
            retry: job.retry || job.run,
            enqueuedAt: now(),
        };
        rejected = rejected.filter(item => item.id !== job.id);
        cancelled = cancelled.filter(item => item.id !== job.id);
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
        running = { ...job, startedAt: now() };
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
            if (!identityOk()) {
                rejected = [
                    ...queued.map(job => ({ ...job, reason: 'identity-changed' })),
                    ...rejected,
                ].slice(0, 8);
                queued = [];
                notify();
                break;
            }
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
        rejected = [];
        cancelled = [];
        notify();
    };

    const cancelPending = (id) => {
        const jobId = String(id || '');
        if (!jobId) return { status: 'rejected', reason: 'missing-id' };
        if (running?.id === jobId) return { status: 'rejected', reason: 'already-running' };
        const pending = queued.find(item => item.id === jobId) || jobs.find(item => item.id === jobId);
        if (!pending) return { status: 'rejected', reason: 'not-pending' };
        queued = queued.filter(item => item.id !== jobId);
        jobs = jobs.filter(item => item.id !== jobId);
        cancelled = [{ ...pending, reason: 'manual-cancel', startedAt: 0 }, ...cancelled.filter(item => item.id !== jobId)].slice(0, 8);
        notify();
        return { status: 'cancelled', id: jobId };
    };

    return {
        beginFloor,
        enqueue,
        drain,
        abort,
        retry,
        cancelPending,
        resetFailed,
        snapshot,
        get busy() { return busy; },
        get failed() { return failed.map(publicJob); },
        get skipped() { return skipped.map(publicJob); },
        get rejected() { return rejected.map(publicJob); },
        get cancelled() { return cancelled.map(publicJob); },
    };
}
