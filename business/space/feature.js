import { createSpaceChat } from './chat.js';
import { createSpaceContext } from './context.js';
import { createSpaceIdentity, sameSpaceIdentity } from './identity.js';
import { createSpaceGuide } from './guide.js';
import { getSpaceChatPlaceholder } from './prompts.js';
import { createSpaceRenderer } from './render.js';
import { createSpaceRepository } from './repository.js';
import { createSpaceUi } from './ui.js';

export function createSpaceFeature(env = {}) {
    let chatRevision = 0;
    const captureIdentity = () => createSpaceIdentity({
        chatId: env.context?.()?.chatId || '',
        chatRevision,
        historyKey: env.keyDesc?.('space-chat', 'user', ''),
    });
    const isCurrent = target => sameSpaceIdentity(target, captureIdentity());
    const repository = createSpaceRepository({
        captureIdentity,
        isCurrent,
        readStore: env.readStore,
        writeStore: env.writeStore,
    });
    const context = createSpaceContext(env.contextEnv);
    const renderer = createSpaceRenderer(env.renderEnv);
    const ui = createSpaceUi(env.ui);
    const chat = createSpaceChat({
        repository,
        loadConfig: env.loadConfig,
        buildMessages: context.buildMessages,
        postCompletion: env.postCompletion,
        openSettings: env.openSettings,
        maxTokens: 30000,
        temperature: env.temperature,
        ui,
    });
    ui.bindControllers({ chat, renderer });
    const guide = createSpaceGuide({
        loadConfig: env.loadConfig,
        postCompletion: env.postCompletion,
        temperature: env.temperature,
        context: env.context,
        openSettings: env.openSettings,
        toast: (message, error) => env.ui?.toast?.(message, error),
        collectContext: env.collectGuideContext,
        applyDraft: env.applyGuideDraft,
        snapshotModules: env.snapshotGuideModules,
        recordActivity: env.recordGuideActivity,
        generateBeat: env.generateBeat,
        onChange: () => {
            if (!env.isOpen?.()) return;
            if (guide.isActive()) ui.renderGuide(guide.snapshot());
            else ui.renderHistory(chat.history());
        },
    });
    ui.bindGuide(guide);

    const open = () => {
        ui.setPlaceholder(env.placeholder?.() || getSpaceChatPlaceholder());
        chat.load();
        if (guide.isActive()) ui.renderGuide(guide.snapshot());
        else ui.renderHistory(chat.history());
    };
    const onChatChanged = ({ enabled = true } = {}) => {
        chatRevision += 1;
        chat.abort('chat-boundary');
        guide.leave();
        if (!enabled) return;
        repository.clearMemory();
        ui.emptyMessages();
        ui.clearQuote?.();
    };
    const abortAll = (reason = 'manual-abort') => {
        chat.abort(reason);
        guide.abort(reason);
        if (env.isOpen?.()) {
            if (guide.isActive()) ui.renderGuide(guide.snapshot());
            else ui.renderHistory(chat.history());
        }
    };
    const invalidateStoreKind = kind => {
        if (kind === 'space-chat') chat.abort('store-clear');
    };
    const refreshAfterStoreClear = kind => {
        if (kind !== 'space-chat') return;
        repository.clearMemory();
        ui.clearWidgets();
        if (env.isOpen?.()) ui.renderHistory(chat.history());
    };
    const refreshFromStore = kind => {
        if (kind !== 'space-chat') return;
        chat.load();
        if (env.isOpen?.()) ui.renderHistory(chat.history());
    };
    return Object.freeze({
        repository,
        context,
        renderer,
        ui,
        chat,
        guide,
        bindUi: ui.bind,
        open,
        onChatChanged,
        abortAll,
        invalidateStoreKind,
        refreshAfterStoreClear,
        refreshFromStore,
        get chatRevision() { return chatRevision; },
    });
}
