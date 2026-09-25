// 笺 / 律 / 间 / 面共用的聊天范围身份。键名仍由各领域包装器决定。
// 棱和坐标语义不同，不要接到这里。

export function normalizeChatId(chatId) {
    return String(typeof chatId === 'function' ? chatId() : chatId ?? '').trim();
}

export function normalizeChatRevision(chatRevision) {
    return Number(chatRevision) || 0;
}

export function freezeChatScopedKey(value, { kind, chatId, extras = {} } = {}) {
    if (!chatId) return null;
    return Object.freeze({ ...(value || {}), ...extras, kind, chatId });
}

export function createChatScopedIdentity({ chatId = '', chatRevision = 0, keys = {} } = {}) {
    const id = normalizeChatId(chatId);
    const revision = normalizeChatRevision(chatRevision);
    const out = { chatId: id, chatRevision: revision };
    for (const [name, spec] of Object.entries(keys || {})) {
        out[name] = freezeChatScopedKey(spec?.value, {
            kind: spec?.kind,
            chatId: id,
            extras: spec?.extras || {},
        });
    }
    return Object.freeze(out);
}

export function sameChatScopedIdentity(left, right) {
    return !!left && !!right
        && left.chatId === right.chatId
        && left.chatRevision === right.chatRevision;
}
