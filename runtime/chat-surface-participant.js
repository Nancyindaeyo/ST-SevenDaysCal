// ChatSurface participant：楼内框走 prepareContent + claim，坐标钮走 didMount。
// 投影回收只认同步 disposer；这里不创建 observer / timer / 异步任务。

export const INLINE_RUNTIME_ATTR = 'data-sp-inline-runtime';

export function ensureInlineRuntimeSource(content) {
    if (!content?.querySelector) return null;
    const existing = content.querySelector(`[${INLINE_RUNTIME_ATTR}]`);
    if (existing) return existing;
    const doc = content.ownerDocument || globalThis.document;
    if (!doc?.createElement) return null;
    const source = doc.createElement('div');
    source.setAttribute(INLINE_RUNTIME_ATTR, '');
    source.setAttribute('data-sp-inline-inert', '');
    content.appendChild(source);
    return source;
}

export function createChatSurfaceParticipantHooks({ getInlineHost, getCoordinate, getChatId } = {}) {
    const inline = () => getInlineHost?.();
    const coordinate = () => getCoordinate?.();
    const liveChat = () => String(getChatId?.() ?? '');
    const mountedButtons = new WeakSet();
    return {
        prepareContent({ content } = {}, claims) {
            const chatId = liveChat();
            const source = ensureInlineRuntimeSource(content);
            if (!source || typeof claims?.claim !== 'function') return;
            claims.claim(source, ({ element, source: live }) => {
                if (liveChat() !== chatId) return () => {};
                live?.removeAttribute?.('data-sp-inline-inert');
                inline()?.mountElement?.(element);
                return () => {
                    if (liveChat() === chatId) inline()?.unmountElement?.(element);
                    live?.replaceChildren?.();
                    live?.setAttribute?.('data-sp-inline-inert', '');
                };
            });
        },
        didMount({ element, mesid } = {}) {
            const chatId = liveChat();
            if (element && mountedButtons.has(element)) {
                return () => {
                    mountedButtons.delete(element);
                    if (liveChat() === chatId) coordinate()?.unmountMessageButton?.(element);
                };
            }
            if (element) mountedButtons.add(element);
            if (liveChat() === chatId) coordinate()?.mountMessageButton?.(element, { rebindMessageId: Number(mesid) });
            return () => {
                if (element) mountedButtons.delete(element);
                if (liveChat() === chatId) coordinate()?.unmountMessageButton?.(element);
            };
        },
        didCommitContent({ element, content } = {}) {
            if (content?.querySelector?.(`[${INLINE_RUNTIME_ATTR}]`)) return;
            const chatId = liveChat();
            inline()?.mountElement?.(element);
            coordinate()?.mountMessageButton?.(element, { rebindMessageId: Number(element?.getAttribute?.('mesid')) });
            return () => {
                if (liveChat() !== chatId) return;
                inline()?.unmountElement?.(element);
                coordinate()?.unmountMessageButton?.(element);
            };
        },
    };
}
