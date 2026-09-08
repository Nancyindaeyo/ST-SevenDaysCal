// TauriTavern ChatSurface：楼层按钮 / 楼内框在虚拟化投影下会随 .mes 被丢掉。
// 原生 ST 和默认关闭虚拟化的 TauriTavern 都没有这套 API，调用方必须 feature-detect。

const PARTICIPANT_ID = 'schedule-planner/message-runtime';

export function getChatSurfaceApi() {
    return globalThis.__TAURITAVERN__?.api?.chatSurface || null;
}

export function isManagedChatSurface() {
    return getChatSurfaceApi()?.isManagedOwnershipRequired?.() === true;
}

export function isTauriTavernHost() {
    return Number(globalThis.__TAURITAVERN__?.abiVersion) >= 1;
}

export function markTauriMobileSurface(element, surface) {
    if (!element || !isTauriTavernHost() || !surface) return element;
    element.setAttribute('data-tt-mobile-surface', surface);
    return element;
}

export function registerChatSurfaceParticipant(hooks = {}) {
    const api = getChatSurfaceApi();
    if (!api || api.isManagedOwnershipRequired?.() !== true) return null;
    try {
        return api.registerParticipant({
            id: PARTICIPANT_ID,
            protocolVersion: api.protocolVersion || 1,
            ...hooks,
        });
    } catch (error) {
        console.warn('[SP] ChatSurface participant skipped', error);
        return null;
    }
}
