import { createChatScopedIdentity, sameChatScopedIdentity } from '../chat-scoped-identity.js';

export function createOutlineIdentity({ chatId, chatRevision = 0, outlineKey = null, creativeChatKey = null } = {}) {
    return createChatScopedIdentity({
        chatId,
        chatRevision,
        keys: {
            outlineKey: { value: outlineKey, kind: 'outline' },
            creativeChatKey: { value: creativeChatKey, kind: 'creative-chat' },
        },
    });
}

export function sameOutlineIdentity(left, right) {
    return sameChatScopedIdentity(left, right);
}
