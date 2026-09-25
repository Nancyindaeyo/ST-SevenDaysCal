let lastConfirmedWrite = null;

export function lastConfirmedWriteSnapshot() {
    return lastConfirmedWrite ? { ...lastConfirmedWrite } : null;
}

export function rememberConfirmedWrite(saved, extra = {}) {
    if (saved?.ok === true && saved.commitState === 'confirmed') {
        lastConfirmedWrite = {
            at: Number(extra.at) || Date.now(),
            reason: String(saved.reason || '').slice(0, 80),
            commitState: 'confirmed',
        };
    }
    return saved;
}

export function clearLastConfirmedWrite() {
    lastConfirmedWrite = null;
}
