import { createLawIdentity, sameLawIdentity } from './identity.js';
import { createLawInjection } from './injection.js';
import { createLawRepository } from './repository.js';
import { LAW_KIND, LAW_SAVE_MS, lawRecord } from './schema.js';
import { createLawUi } from './ui.js';
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

export function createLawFeature(env = {}) {
    let chatRevision = 0;
    let open = false;
    let timer = 0;
    let pending = null;
    const captureIdentity = () => createLawIdentity({
        chatId: env.context?.()?.chatId || '',
        chatRevision,
        storeKey: env.keyDesc?.(LAW_KIND, 'user', ''),
    });
    const isCurrent = target => sameLawIdentity(target, captureIdentity());
    const repository = createLawRepository({
        captureIdentity,
        isCurrent,
        readStore: env.readStore,
        writeStore: env.writeStore,
    });
    const injection = createLawInjection({
        context: env.context,
        injectEnabled: env.injectEnabled,
        readRecord: () => repository.record(),
    });
    const ui = createLawUi({ $in: env.$in });
    const recoveryPorts = () => ({
        readRecovery: env.readRecovery,
        writeRecovery: env.writeRecovery,
        toast: env.toast,
        onDraftEvent: env.onDraftEvent,
        toastMessage: '律未保存，可恢复',
    });
    const liveChatId = () => String(env.context?.()?.chatId || '');
    const recoveryItems = () => listAuthorDrafts(LAW_KIND, env.readRecovery?.() || []);
    const paintRecovery = () => {
        if (!open) return;
        ui.paintRecovery(recoveryItems(), { currentChatId: liveChatId() });
    };
    const remember = (text, inject, identity = captureIdentity()) => {
        pending = freezeAuthorDraft({ kind: LAW_KIND, text, inject, identity });
        return pending;
    };
    const persistLive = (draft, target) => {
        if (!target?.storeKey || !isCurrent(target)) {
            return writeDraftResult({ ok: false, stale: true, reason: 'stale' });
        }
        if (typeof env.writeStoreConfirmed === 'function') {
            return Promise.resolve(env.writeStoreConfirmed(target.storeKey, lawRecord(draft.text, draft.inject), {
                ownerGuard: () => liveChatId() === draft.chatId,
            })).then(saved => {
                if (saved?.ok) {
                    repository.load(target);
                    injection.refresh();
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
        const ok = repository.save(draft.text, draft.inject, target);
        if (ok) injection.refresh();
        return writeDraftResult({ ok, commitState: ok ? 'confirmed' : 'failed', reason: ok ? '' : 'write-failed' });
    };
    const commitDraft = (draft, { allowCrossChat = false } = {}) => {
        if (!draft) return writeDraftResult({ ok: true, reason: 'empty' });
        if (authorDraftUnchanged(draft, { text: repository.text(), inject: repository.inject() })) {
            injection.refresh();
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
        const inject = ui.inject();
        const draft = pending && pending.text === typed && pending.inject === inject
            ? pending
            : remember(typed, inject);
        pending = null;
        return commitDraft(draft);
    };
    const scheduleSave = text => {
        cancelTimer();
        const typed = String(text ?? '');
        const inject = ui.inject();
        const draft = remember(typed, inject);
        const target = captureIdentity();
        timer = setTimeout(() => {
            timer = 0;
            if (!isCurrent(target)) return;
            const result = persistLive(draft, target);
            const settle = saved => {
                if (saved.ok) {
                    if (pending && pending.chatRevision === draft.chatRevision && pending.text === draft.text && pending.inject === draft.inject) pending = null;
                    return;
                }
                pending = null;
                parkAuthorDraft(draft, saved.commitState === 'unknown' ? 'unknown' : (saved.reason || 'write-failed'), recoveryPorts());
                paintRecovery();
            };
            if (result && typeof result.then === 'function') result.then(settle);
            else settle(result);
        }, LAW_SAVE_MS);
    };
    const setInject = inject => {
        cancelTimer();
        const draft = remember(ui.value(), inject === true);
        pending = null;
        const result = commitDraft(draft);
        if (open) ui.paint(repository.text(), repository.inject(), { force: false });
        return result;
    };
    const paint = (force = false) => {
        if (!open) return;
        ui.paint(repository.text(), repository.inject(), { force });
        paintRecovery();
    };
    const openPage = () => {
        open = true;
        repository.load();
        paint(true);
        injection.refresh();
    };
    const close = () => {
        if (open) flush();
        open = false;
    };
    const onChatChanged = () => {
        cancelTimer();
        injection.clear();
        const draft = pending;
        pending = null;
        if (draft && !authorDraftUnchanged(draft, { text: repository.text(), inject: repository.inject() })) {
            parkAuthorDraft(draft, 'stale', recoveryPorts());
        }
        chatRevision += 1;
        repository.clearMemory();
        open = false;
        ui.paint('', false, { force: true });
        ui.paintRecovery([], { currentChatId: liveChatId() });
    };
    const invalidateStoreKind = kind => {
        if (kind !== LAW_KIND) return;
        cancelTimer();
        repository.clearMemory();
        injection.clear();
    };
    const refreshAfterStoreClear = kind => {
        if (kind !== LAW_KIND) return;
        repository.clearMemory();
        injection.clear();
        paint(true);
    };
    const refreshFromStore = kind => {
        if (kind !== LAW_KIND) return;
        repository.load();
        injection.refresh();
        paint(true);
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
            if (saved.ok) env.writeRecovery?.(removeAuthorDraft(env.readRecovery?.() || [], LAW_KIND, draft.chatId));
            if (open) paint(true);
            return saved;
        };
        return result && typeof result.then === 'function' ? result.then(finish) : finish(result);
    };
    const discard = chatId => {
        env.writeRecovery?.(removeAuthorDraft(env.readRecovery?.() || [], LAW_KIND, chatId));
        paintRecovery();
        return writeDraftResult({ ok: true, reason: 'discarded' });
    };

    return Object.freeze({
        repository,
        injection,
        ui,
        bindUi: () => ui.bind({
            onInput: scheduleSave,
            onBlur: flush,
            onInject: setInject,
            onRestoreOriginal: chatId => restore({ chatId, mode: 'original' }),
            onRestoreCurrent: chatId => restore({ chatId, mode: 'current' }),
            onDiscard: discard,
        }),
        isOpen: () => open,
        open: openPage,
        close,
        flush,
        onChatChanged,
        refreshInjection: () => injection.refresh(),
        clearInjection: () => injection.clear(),
        restore,
        discard,
        pendingDraft: () => pending,
        recoveryItems,
        invalidateStoreKind,
        refreshAfterStoreClear,
        refreshFromStore,
        get chatRevision() { return chatRevision; },
    });
}
