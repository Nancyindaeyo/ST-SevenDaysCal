export function freezeAuthorDraft({
    kind = '',
    text = '',
    inject = false,
    identity = null,
    ts = Date.now(),
} = {}) {
    const chatId = String(identity?.chatId || '');
    return Object.freeze({
        kind: String(kind || ''),
        text: String(text ?? ''),
        inject: inject === true,
        chatId,
        chatRevision: Number(identity?.chatRevision) || 0,
        storeKey: identity?.storeKey ? Object.freeze({ ...identity.storeKey }) : null,
        ts: Number(ts) || Date.now(),
    });
}

export function authorDraftUnchanged(draft, stored = {}) {
    if (!draft) return true;
    if (String(draft.text ?? '') !== String(stored.text ?? '')) return false;
    if (draft.inject !== (stored.inject === true)) return false;
    return true;
}

export function writeDraftResult({
    ok = false,
    stale = false,
    commitState = '',
    reason = '',
    parked = false,
} = {}) {
    return Object.freeze({
        ok: ok === true,
        stale: stale === true,
        commitState: commitState || (ok ? 'confirmed' : parked ? 'not-dispatched' : 'failed'),
        reason: String(reason || ''),
        parked: parked === true,
    });
}

export function sanitizeDraftEvent(event = {}) {
    return Object.freeze({
        kind: String(event.kind || ''),
        chatId: String(event.chatId || ''),
        reason: String(event.reason || ''),
        parked: event.parked === true,
    });
}

export function listAuthorDrafts(kind, items) {
    return (Array.isArray(items) ? items : []).filter(item => !kind || item?.kind === kind);
}

export function upsertAuthorDraft(items, draft, reason) {
    const next = (Array.isArray(items) ? items : []).filter(item => !(item?.kind === draft.kind && item?.chatId === draft.chatId));
    next.push({
        kind: draft.kind,
        text: draft.text,
        inject: draft.inject === true,
        chatId: draft.chatId,
        chatRevision: draft.chatRevision,
        storeKey: draft.storeKey ? { ...draft.storeKey } : null,
        ts: draft.ts,
        reason: String(reason || ''),
        parkedAt: Date.now(),
    });
    return next;
}

export function removeAuthorDraft(items, kind, chatId) {
    return (Array.isArray(items) ? items : []).filter(item => !(item?.kind === kind && item?.chatId === String(chatId || '')));
}

export function parkAuthorDraft(draft, reason, {
    readRecovery,
    writeRecovery,
    toast,
    onDraftEvent,
    toastMessage,
} = {}) {
    if (!draft?.kind || !draft.chatId) {
        return writeDraftResult({ ok: false, reason: reason || 'missing-target', parked: false });
    }
    writeRecovery?.(upsertAuthorDraft(readRecovery?.() || [], draft, reason));
    onDraftEvent?.(sanitizeDraftEvent({ kind: draft.kind, chatId: draft.chatId, reason, parked: true }));
    if (toastMessage) toast?.(toastMessage, null, true);
    return writeDraftResult({
        ok: false,
        stale: reason === 'stale',
        commitState: reason === 'unknown' ? 'unknown' : 'not-dispatched',
        reason,
        parked: true,
    });
}

export function canWriteDraftToCurrent(draft, chatId) {
    return !!draft?.chatId && draft.chatId === String(chatId || '');
}

export function authorDraftsSnapshot(items) {
    return (Array.isArray(items) ? items : []).map(item => ({
        kind: String(item?.kind || ''),
        chatId: String(item?.chatId || ''),
        reason: String(item?.reason || ''),
        ts: Number(item?.ts || item?.parkedAt) || 0,
    }));
}
