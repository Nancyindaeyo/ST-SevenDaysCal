import { createSlipIdentity, sameSlipIdentity } from './identity.js';
import { createSlipRepository } from './repository.js';
import { createSlipUi } from './ui.js';
import { SLIP_KIND, SLIP_SAVE_MS } from './schema.js';

export function createSlipFeature(env = {}) {
    let chatRevision = 0;
    let open = false;
    let timer = 0;
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

    const cancelTimer = () => {
        if (timer) clearTimeout(timer);
        timer = 0;
    };
    const flush = (text = ui.value()) => {
        cancelTimer();
        const target = captureIdentity();
        if (!target.storeKey || !isCurrent(target)) return false;
        if (text === repository.text()) return true;
        return repository.saveText(text, target);
    };
    const scheduleSave = text => {
        cancelTimer();
        const typed = String(text ?? '');
        const target = captureIdentity();
        timer = setTimeout(() => {
            timer = 0;
            if (!isCurrent(target)) return;
            repository.saveText(typed, target);
        }, SLIP_SAVE_MS);
    };
    const paint = () => {
        if (!open) return;
        ui.paint(repository.text());
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
        chatRevision += 1;
        repository.clearMemory();
        open = false;
        ui.paint('', { force: true });
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
    };
    const refreshFromStore = kind => {
        if (kind !== SLIP_KIND) return;
        repository.load();
        if (open) ui.paint(repository.text(), { force: true });
    };

    return Object.freeze({
        repository,
        ui,
        bindUi: () => ui.bind({ onInput: scheduleSave, onBlur: flush }),
        isOpen: () => open,
        open: openPage,
        close,
        flush,
        onChatChanged,
        invalidateStoreKind,
        refreshAfterStoreClear,
        refreshFromStore,
        get chatRevision() { return chatRevision; },
    });
}
