import { createChatScopedIdentity, sameChatScopedIdentity } from '../chat-scoped-identity.js';
import { SLIP_KIND } from './schema.js';

export function createSlipIdentity({ chatId = '', chatRevision = 0, storeKey = null } = {}) {
    return createChatScopedIdentity({
        chatId,
        chatRevision,
        keys: {
            storeKey: { value: storeKey, kind: SLIP_KIND, extras: { view: 'user', charName: '' } },
        },
    });
}

export function sameSlipIdentity(left, right) {
    return sameChatScopedIdentity(left, right);
}
