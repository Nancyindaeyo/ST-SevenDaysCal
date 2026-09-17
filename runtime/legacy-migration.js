export async function commitLegacyMigration({ entries = [], legacy = [], writeConfirmed, removeItem } = {}) {
    let saved;
    try {
        saved = await writeConfirmed?.(entries);
    } catch (error) {
        return {
            ok: false,
            reason: error?.message || 'save-failed',
            error,
            saveResult: error?.saveResult,
        };
    }
    if (saved?.ok !== true || saved?.commitState !== 'confirmed') {
        return {
            ok: false,
            reason: saved?.reason || 'save-unconfirmed',
            unknown: saved?.commitState === 'unknown',
            saveResult: saved,
        };
    }
    const failedKeys = [];
    for (const item of legacy) {
        try { removeItem?.(item.key); }
        catch { failedKeys.push(item.key); }
    }
    if (failedKeys.length) {
        return { ok: false, committed: true, reason: 'legacy-cleanup-failed', failedKeys, saveResult: saved };
    }
    return { ok: true, saveResult: saved };
}
