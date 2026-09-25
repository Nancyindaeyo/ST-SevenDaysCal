import { createChatScopedIdentity, sameChatScopedIdentity } from '../chat-scoped-identity.js';

export function createSpaceIdentity({ chatId = '', chatRevision = 0, historyKey = null } = {}) {
    return createChatScopedIdentity({
        chatId,
        chatRevision,
        keys: {
            historyKey: { value: historyKey, kind: 'space-chat', extras: { view: 'user', charName: '' } },
        },
    });
}

export function sameSpaceIdentity(left, right) {
    return sameChatScopedIdentity(left, right);
}
