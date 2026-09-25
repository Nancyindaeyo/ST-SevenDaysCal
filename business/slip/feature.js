import { createSlipIdentity, sameSlipIdentity } from './identity.js';
import { createSlipRepository } from './repository.js';
import { createSlipUi } from './ui.js';
import { SLIP_KIND, SLIP_SAVE_MS, slipRecord } from './schema.js';
import {
    authorDraftUnchanged,
    canWriteDraftToCurrent,
    freezeAuthorDraft,
    listAuthorDrafts,
    parkAuthorDraft,
    removeAuthorDraft,
    sanitizeDraftEvent,
    writeDraftResult,
} from '../utils/author-draft.js';

export function createSlipFeature(env = {}) {
    let chatRevision = 0;
    let open = false;
    let timer = 0;
    let pending = null;
    const captureIdentity = () => createSlipIdentity({
        chatId: env.context?.()?.chatId || '',
        chatRevision,
        storeKey: env.keyDesc?.(SLIP_KIND, 'user', ''),
    });
    const isCurrent = target => sameSlipIdentity(target, captureIdentity());
    const repository = createSlipRepository({
        captureIdentity,
        isCurrent,
        readStore: env.readStore,
        writeStore: env.writeStore,
    });
    const ui = createSlipUi({ $in: env.$in });
    const recoveryPorts = () => ({
        readRecovery: env.readRecovery,
        writeRecovery: env.writeRecovery,
        toast: env.toast,
        onDraftEvent: env.onDraftEvent,
        toastMessage: '笺未保存，可恢复',
    });
    const liveChatId = () => String(env.context?.()?.chatId || '');
    const recoveryItems = () => listAuthorDrafts(SLIP_KIND, env.readRecovery?.() || []);
    const paintRecovery = () => {
        if (!open) return;
        ui.paintRecovery(recoveryItems(), { currentChatId: liveChatId() });
    };
    const remember = (text, identity = captureIdentity()) => {
        pending = freezeAuthorDraft({ kind: SLIP_KIND, text, identity });
        return pending;
    };
    const persistLive = (draft, target) => {
        if (!target?.storeKey || !isCurrent(target)) {
            return writeDraftResult({ ok: false, stale: true, reason: 'stale' });
        }
        if (typeof env.writeStoreConfirmed === 'function') {
            return Promise.resolve(env.writeStoreConfirmed(target.storeKey, slipRecord(draft.text), {
                ownerGuard: () => liveChatId() === draft.chatId,
            })).then(saved => {
                if (saved?.ok) {
                    repository.load(target);
                    return writeDraftResult({
                        ok: true,
                        commitState: saved.commitState || 'confirmed',
                        reason: saved.reason || '',
                    });
                }
                return writeDraftResult({
                    ok: false,
                    stale: saved?.stale === true,
                    commitState: saved?.commitState || 'failed',
                    reason: saved?.reason || 'write-failed',
                });
            });
        }
        const ok = repository.saveText(draft.text, target);
        return writeDraftResult({ ok, commitState: ok ? 'confirmed' : 'failed', reason: ok ? '' : 'write-failed' });
    };
    const commitDraft = (draft, { allowCrossChat = false } = {}) => {
        if (!draft) return writeDraftResult({ ok: true, reason: 'empty' });
        if (authorDraftUnchanged(draft, { text: repository.text(), inject: false })) {
            return writeDraftResult({ ok: true, reason: 'unchanged' });
        }
        const sameChat = liveChatId() === draft.chatId && captureIdentity().chatId === draft.chatId;
        if (!sameChat && !allowCrossChat) return parkAuthorDraft(draft, 'stale', recoveryPorts());
        const target = captureIdentity();
        if (!target.storeKey) return parkAuthorDraft(draft, 'missing-target', recoveryPorts());
        const finish = result => {
            if (result.ok) {
                env.onDraftEvent?.(sanitizeDraftEvent({ kind: draft.kind, chatId: draft.chatId, reason: 'saved' }));
                return result;
            }
            return parkAuthorDraft(draft, result.commitState === 'unknown' ? 'unknown' : (result.reason || 'write-failed'), recoveryPorts());
        };
        const result = persistLive(draft, target);
        return result && typeof result.then === 'function' ? result.then(finish) : finish(result);
    };

    const cancelTimer = () => {
        if (timer) clearTimeout(timer);
        timer = 0;
    };
    const flush = (text = ui.value()) => {
        cancelTimer();
        const typed = String(text ?? '');
        const draft = pending && pending.text === typed ? pending : remember(typed);
        pending = null;
        return commitDraft(draft);
    };
    const scheduleSave = text => {
        cancelTimer();
        const typed = String(text ?? '');
        const draft = remember(typed);
        const target = captureIdentity();
        timer = setTimeout(() => {
            timer = 0;
            if (!isCurrent(target)) return;
            const result = persistLive(draft, target);
            const settle = saved => {
                if (saved.ok) {
                    if (pending && pending.chatRevision === draft.chatRevision && pending.text === draft.text) pending = null;
                    return;
                }
                pending = null;
                parkAuthorDraft(draft, saved.commitState === 'unknown' ? 'unknown' : (saved.reason || 'write-failed'), recoveryPorts());
                paintRecovery();
            };
            if (result && typeof result.then === 'function') result.then(settle);
            else settle(result);
        }, SLIP_SAVE_MS);
    };
    const paint = () => {
        if (!open) return;
        ui.paint(repository.text());
        paintRecovery();
    };
    const openPage = () => {
        open = true;
        repository.load();
        paint();
    };
    const close = () => {
        if (open) flush();
        open = false;
    };
    const onChatChanged = () => {
        cancelTimer();
        const draft = pending;
        pending = null;
        if (draft && !authorDraftUnchanged(draft, { text: repository.text(), inject: false })) {
            parkAuthorDraft(draft, 'stale', recoveryPorts());
        }
        chatRevision += 1;
        repository.clearMemory();
        open = false;
        ui.paint('', { force: true });
        ui.paintRecovery([], { currentChatId: liveChatId() });
    };
    const invalidateStoreKind = kind => {
        if (kind !== SLIP_KIND) return;
        cancelTimer();
        repository.clearMemory();
    };
    const refreshAfterStoreClear = kind => {
        if (kind !== SLIP_KIND) return;
        repository.clearMemory();
        if (open) ui.paint(repository.text(), { force: true });
        paintRecovery();
    };
    const refreshFromStore = kind => {
        if (kind !== SLIP_KIND) return;
        repository.load();
        if (open) ui.paint(repository.text(), { force: true });
        paintRecovery();
    };
    const restore = ({ chatId, mode } = {}) => {
        const draft = recoveryItems().find(item => item.chatId === String(chatId || ''));
        if (!draft) return writeDraftResult({ ok: false, reason: 'missing-draft' });
        if (mode === 'original' && !canWriteDraftToCurrent(draft, liveChatId())) {
            return writeDraftResult({ ok: false, reason: 'wrong-chat' });
        }
        pending = null;
        const result = commitDraft(draft, { allowCrossChat: mode === 'current' });
        const finish = saved => {
            if (saved.ok) env.writeRecovery?.(removeAuthorDraft(env.readRecovery?.() || [], SLIP_KIND, draft.chatId));
            if (open) {
                ui.paint(repository.text(), { force: true });
                paintRecovery();
            }
            return saved;
        };
        return result && typeof result.then === 'function' ? result.then(finish) : finish(result);
    };
    const discard = chatId => {
        env.writeRecovery?.(removeAuthorDraft(env.readRecovery?.() || [], SLIP_KIND, chatId));
        paintRecovery();
        return writeDraftResult({ ok: true, reason: 'discarded' });
    };

    return Object.freeze({
        repository,
        ui,
        bindUi: () => ui.bind({
            onInput: scheduleSave,
            onBlur: flush,
            onRestoreOriginal: chatId => restore({ chatId, mode: 'original' }),
            onRestoreCurrent: chatId => restore({ chatId, mode: 'current' }),
            onDiscard: discard,
        }),
        isOpen: () => open,
        open: openPage,
        close,
        flush,
        onChatChanged,
        invalidateStoreKind,
        refreshAfterStoreClear,
        refreshFromStore,
        restore,
        discard,
        pendingDraft: () => pending,
        recoveryItems,
        get chatRevision() { return chatRevision; },
    });
}
