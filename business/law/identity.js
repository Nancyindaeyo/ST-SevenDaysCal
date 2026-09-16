import { LAW_KIND } from './schema.js';

export function createLawIdentity({ chatId = '', chatRevision = 0, storeKey = null } = {}) {
    const id = String(chatId ?? '').trim();
    return Object.freeze({
        chatId: id,
        chatRevision: Number(chatRevision) || 0,
        storeKey: id ? Object.freeze({ ...(storeKey || {}), kind: LAW_KIND, view: 'user', charName: '', chatId: id }) : null,
    });
}

export function sameLawIdentity(left, right) {
    return !!left && !!right
        && left.chatId === right.chatId
        && left.chatRevision === right.chatRevision;
}
