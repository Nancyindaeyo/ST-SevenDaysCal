import { createLawIdentity, sameLawIdentity } from './identity.js';
import { createLawInjection } from './injection.js';
import { createLawRepository } from './repository.js';
import { LAW_KIND, LAW_SAVE_MS } from './schema.js';
import { createLawUi } from './ui.js';

export function createLawFeature(env = {}) {
    let chatRevision = 0;
    let open = false;
    let timer = 0;
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

    const cancelTimer = () => {
        if (timer) clearTimeout(timer);
        timer = 0;
    };
    const persist = (text, inject, target = captureIdentity()) => {
        if (!target.storeKey || !isCurrent(target)) return false;
        if (text === repository.text() && inject === repository.inject()) {
            injection.refresh();
            return true;
        }
        const ok = repository.save(text, inject, target);
        if (ok) injection.refresh();
        return ok;
    };
    const flush = (text = ui.value()) => {
        cancelTimer();
        return persist(text, ui.inject());
    };
    const scheduleSave = text => {
        cancelTimer();
        const typed = String(text ?? '');
        const inject = ui.inject();
        const target = captureIdentity();
        timer = setTimeout(() => {
            timer = 0;
            if (!isCurrent(target)) return;
            persist(typed, inject, target);
        }, LAW_SAVE_MS);
    };
    const setInject = inject => {
        cancelTimer();
        persist(ui.value(), inject === true);
        if (open) ui.paint(repository.text(), repository.inject(), { force: false });
    };
    const paint = (force = false) => {
        if (!open) return;
        ui.paint(repository.text(), repository.inject(), { force });
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
        chatRevision += 1;
        repository.clearMemory();
        open = false;
        ui.paint('', false, { force: true });
        injection.clear();
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

    return Object.freeze({
        repository,
        injection,
        ui,
        bindUi: () => ui.bind({ onInput: scheduleSave, onBlur: flush, onInject: setInject }),
        isOpen: () => open,
        open: openPage,
        close,
        flush,
        onChatChanged,
        refreshInjection: () => injection.refresh(),
        clearInjection: () => injection.clear(),
        invalidateStoreKind,
        refreshAfterStoreClear,
        refreshFromStore,
        get chatRevision() { return chatRevision; },
    });
}
