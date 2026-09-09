export function messageFingerprint(message) {
    return `${message?.is_user ? 'u' : 'a'}|${String(message?.send_date ?? '')}|${String(message?.mes ?? '').length}|${String(message?.mes ?? '').slice(0, 24)}`;
}

export function chatFingerprints(chat = []) {
    return (Array.isArray(chat) ? chat : []).map(messageFingerprint);
}

export function firstRemovedIndex(before = [], after = []) {
    const limit = Math.min(before.length, after.length);
    for (let i = 0; i < limit; i++) {
        if (before[i] !== after[i]) return i;
    }
    return after.length;
}

export function pruneMemoryAfterDelete(memory, deletedFrom) {
    if (!memory || !Number.isInteger(deletedFrom)) return memory;
    for (const [key, l0] of Object.entries(memory.L0 || {})) {
        const end = parseInt(l0?.range?.[1], 10);
        if (!Number.isInteger(end) || end >= deletedFrom) delete memory.L0[key];
    }
    memory.L1 = (memory.L1 || []).filter(l1 => parseInt(l1?.range?.[1], 10) < deletedFrom);
    return memory;
}
