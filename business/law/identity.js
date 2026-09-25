import { createChatScopedIdentity, sameChatScopedIdentity } from '../chat-scoped-identity.js';
import { LAW_KIND } from './schema.js';

export function createLawIdentity({ chatId = '', chatRevision = 0, storeKey = null } = {}) {
    return createChatScopedIdentity({
        chatId,
        chatRevision,
        keys: {
            storeKey: { value: storeKey, kind: LAW_KIND, extras: { view: 'user', charName: '' } },
        },
    });
}

export function sameLawIdentity(left, right) {
    return sameChatScopedIdentity(left, right);
}
