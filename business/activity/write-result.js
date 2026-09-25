export const RESTORE_WRITE_ORDER = Object.freeze(['point', 'lines', 'outline', 'dashed', 'ledger']);

export function normalizeRestoreWriteResult(saved, { reason = 'restore-write-failed' } = {}) {
    if (saved && typeof saved === 'object') {
        const commitState = saved.commitState || (saved.ok === true ? 'confirmed' : 'not-dispatched');
        const ok = saved.ok === true && saved.stale !== true && commitState !== 'unknown';
        return {
            ok,
            stale: saved.stale === true,
            commitState,
            reason: saved.reason || (ok ? '' : reason),
            items: Array.isArray(saved.items) ? saved.items : undefined,
        };
    }
    if (saved === true) return { ok: true, stale: false, commitState: 'confirmed', reason: 'legacy-true' };
    if (saved === false) return { ok: false, stale: false, commitState: 'not-dispatched', reason };
    if (saved == null) return { ok: true, stale: false, commitState: 'confirmed', reason: 'legacy-void' };
    return { ok: false, stale: false, commitState: 'not-dispatched', reason };
}

export function isRestoreWriteConfirmed(result) {
    return result?.ok === true && result?.stale !== true && result?.commitState !== 'unknown';
}

export function snapshotHasModule(snapshot, name) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (name === 'dashed') return Array.isArray(snapshot.dashed);
    if (name === 'outline' || name === 'ledger') return snapshot[name] != null && typeof snapshot[name] === 'object';
    return snapshot[name] != null;
}

export function restoreFailureReason(results = {}) {
    const failed = Object.values(results).find(result => !isRestoreWriteConfirmed(result));
    if (failed?.stale) return 'stale';
    if (failed?.commitState === 'unknown') return 'unknown';
    return failed?.reason || 'restore-write-failed';
}
