// 楼内框宿主：统一窗口刷新、切聊天补挂、DOM 观察器。
// 渲染本身在 business/inline/feature.js；这里只做 chatId 闸和注入重设。
export function createInlineHost(env = {}) {
    let feature = env.feature || null;

    function refresh(immediate = false) {
        return feature?.refresh?.(immediate);
    }

    function clear() {
        return feature?.clear?.();
    }

    function mountElement(element) {
        return feature?.mountElement?.(element);
    }

    function init() {
        return feature?.init?.();
    }

    function destroy() {
        feature?.destroy?.();
        feature = null;
    }

    function replaceFeature(next) {
        feature?.destroy?.();
        feature = next || null;
        return feature;
    }

    function sameChat(expectedChatId) {
        if (expectedChatId == null) return true;
        return env.getChatId?.() === expectedChatId;
    }

    function syncLatest(expectedChatId = null) {
        if (!sameChat(expectedChatId)) return;
        return refresh(true);
    }

    function syncLines(expectedChatId = null) {
        if (!sameChat(expectedChatId)) return;
        env.refreshLinesInjection?.();
        return refresh(true);
    }

    async function backfill() {
        env.refreshLinesInjection?.();
        env.refreshStoryClockInjection?.();
        env.refreshLedgerInjection?.();
        return refresh(true);
    }

    function initObserver() {
        if (feature) {
            feature.init();
            return;
        }
        const doc = env.documentRef || globalThis.document;
        const chat = doc?.querySelector?.('#chat');
        if (!chat) {
            env.scheduleRetry?.(() => initObserver(), 600);
            return;
        }
        const Observer = env.MutationObserver || globalThis.MutationObserver;
        if (typeof Observer !== 'function') return;
        let timer = null;
        new Observer(() => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                env.onChatDomChanged?.();
                if (!env.isStreaming?.()) refresh();
            }, 400);
        }).observe(chat, { childList: true, subtree: true });
    }

    return {
        get feature() { return feature; },
        replaceFeature,
        refresh,
        clear,
        mountElement,
        init,
        destroy,
        syncLatest,
        syncLines,
        backfill,
        initObserver,
    };
}
