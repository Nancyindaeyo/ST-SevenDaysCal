// 生成上下文的 reroll 隔离规则。保持为纯函数，供生产消息构建器与仓外动态测试共用。
export function stripRerollModuleArtifacts(text) {
    return String(text || '')
        .replace(/<(?:calendar|schedule|storylines|line|outline|almanac|era)_widget(?:\s[^>]*)?>[\s\S]*?<\/(?:calendar|schedule|storylines|line|outline|almanac|era)_widget>/gi, '')
        .replace(/<\/?(?:calendar|schedule|storylines|line|outline|almanac|era)_widget(?:\s[^>]*)?>/gi, '')
        .trim();
}

export function resolveAlmanacContextText(options = {}, readAlmanac = () => '') {
    return options.noAlmanac ? '' : String(readAlmanac?.() || '');
}

// reroll 旧模块隔离必须先于通用标签清洗：若用户把 almanac_widget 写进 keepTags，
// stripTags 会保留其中正文并仅剥标签；先删完整 widget 才能保证旧历不会以裸文本泄漏。
export function sanitizeGenerationContextText(text, { reroll = false, stripTags = value => String(value ?? '') } = {}) {
    const isolated = reroll ? stripRerollModuleArtifacts(text) : String(text ?? '');
    return stripTags(isolated);
}

export const PARTICIPANT_IDENTITY_KEYS = Object.freeze([
    'boundaryEpoch', 'chatId', 'characterId', 'characterKey', 'personaKey', 'userName', 'charName',
]);

export function runtimeIdentityHash(value) {
    let hash = 2166136261;
    for (const ch of String(value ?? '')) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16);
}

export function sameParticipantIdentity(left, right) {
    return !!left && !!right && PARTICIPANT_IDENTITY_KEYS.every(key => String(left[key] ?? '') === String(right[key] ?? ''));
}

export function captureGenerationContext(ctx = {}) {
    const chat = Array.isArray(ctx?.chat)
        ? ctx.chat.map(message => ({
            ...message,
            extra: message?.extra && typeof message.extra === 'object' ? { ...message.extra } : message?.extra,
        }))
        : [];
    return { ...ctx, chat, name1: ctx?.name1 || '用户', name2: ctx?.name2 || '角色' };
}

export function captureChatBoundary(ctx, epoch) {
    return Object.freeze({ epoch, chatId: String(ctx?.chatId ?? '') });
}

export function isCurrentChatBoundary(boundary, ctx, epoch) {
    return !!boundary && boundary.epoch === epoch && boundary.chatId === String(ctx?.chatId ?? '');
}

export function captureParticipantIdentity(ctx = {}, { epoch = 0, charStableKey } = {}) {
    const character = ctx?.characters?.[ctx?.characterId] || {};
    const personaDescriptor = ctx?.powerUserSettings?.persona_name
        ?? ctx?.powerUserSettings?.default_persona
        ?? ctx?.powerUserSettings?.persona_description
        ?? '';
    return Object.freeze({
        boundaryEpoch: epoch,
        chatId: String(ctx?.chatId ?? ''),
        characterId: String(ctx?.characterId ?? ''),
        characterKey: String(character?.avatar || charStableKey?.(ctx) || ''),
        personaKey: runtimeIdentityHash(personaDescriptor),
        userName: String(ctx?.name1 || '用户'),
        charName: String(ctx?.name2 || '角色'),
    });
}

function latestFloorIdentity(ctx, epoch, floorSignature) {
    const messageId = (ctx?.chat?.length ?? 0) - 1;
    if (messageId < 0) return null;
    return Object.freeze({
        ...captureChatBoundary(ctx, epoch),
        messageId,
        swipeId: Number(ctx.chat?.[messageId]?.swipe_id ?? 0),
        contentSignature: floorSignature?.(messageId) || 'empty',
    });
}

// 身份 / 聊天边界闸：epoch 与延迟回调同生共死。切聊天只走 beginBoundary。
export function createChatBoundaryGate(env = {}) {
    let epoch = 0;
    let activeIdentity = null;
    let pendingDateBootstrap = null;
    const context = () => env.getContext?.() || {};
    const delay = typeof env.setTimeout === 'function' ? env.setTimeout : (fn, ms) => setTimeout(fn, ms);

    function currentBoundary() {
        return captureChatBoundary(context(), epoch);
    }
    function currentParticipant(ctx = context()) {
        return captureParticipantIdentity(ctx, { epoch, charStableKey: env.charStableKey });
    }
    function currentGeneration(ctx = context()) {
        return captureGenerationContext(ctx);
    }
    function boundaryMatches(boundary) {
        return isCurrentChatBoundary(boundary, context(), epoch);
    }
    function scheduleForChatBoundary(callback, ms) {
        const boundary = currentBoundary();
        return delay(() => { if (boundaryMatches(boundary)) callback(boundary); }, ms);
    }
    function latestFloorBoundaryIdentity() {
        return latestFloorIdentity(context(), epoch, env.floorSignature);
    }
    function consumeDateBootstrap(messageId) {
        const pending = pendingDateBootstrap;
        if (!pending) return false;
        const current = env.floorKey?.(messageId);
        const matches = boundaryMatches(pending)
            && pending.messageId === current?.messageId
            && pending.swipeId === current?.swipeId
            && pending.contentSignature === current?.contentSignature;
        if (matches) pendingDateBootstrap = null;
        return matches;
    }
    function markReady() {
        activeIdentity = currentBoundary();
        return activeIdentity;
    }
    function beginBoundary() {
        const previousEpoch = epoch;
        epoch += 1;
        activeIdentity = currentBoundary();
        pendingDateBootstrap = latestFloorBoundaryIdentity();
        return Object.freeze({
            previousEpoch,
            epoch,
            chatId: activeIdentity.chatId,
            identity: activeIdentity,
        });
    }

    return {
        epoch: () => epoch,
        activeIdentity: () => activeIdentity,
        captureParticipantIdentity: currentParticipant,
        sameParticipantIdentity,
        captureGenerationContext: currentGeneration,
        captureChatBoundary: currentBoundary,
        isCurrentChatBoundary: boundaryMatches,
        scheduleForChatBoundary,
        latestFloorBoundaryIdentity,
        consumeDateBootstrap,
        markReady,
        beginBoundary,
    };
}
