import { SLIP_KIND } from './schema.js';

export function createSlipIdentity({ chatId = '', chatRevision = 0, storeKey = null } = {}) {
    const id = String(chatId ?? '').trim();
    return Object.freeze({
        chatId: id,
        chatRevision: Number(chatRevision) || 0,
        storeKey: id ? Object.freeze({ ...(storeKey || {}), kind: SLIP_KIND, view: 'user', charName: '', chatId: id }) : null,
    });
}

export function sameSlipIdentity(left, right) {
    return !!left && !!right
        && left.chatId === right.chatId
        && left.chatRevision === right.chatRevision;
}
