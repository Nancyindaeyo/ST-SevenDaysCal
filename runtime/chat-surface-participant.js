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

export function createChatSurfaceParticipantHooks({ getInlineHost, getCoordinate } = {}) {
    const inline = () => getInlineHost?.();
    const coordinate = () => getCoordinate?.();
    return {
        prepareContent({ content } = {}, claims) {
            const source = ensureInlineRuntimeSource(content);
            if (!source || typeof claims?.claim !== 'function') return;
            claims.claim(source, ({ element, source: live }) => {
                live?.removeAttribute?.('data-sp-inline-inert');
                inline()?.mountElement?.(element);
                return () => {
                    inline()?.unmountElement?.(element);
                    live?.replaceChildren?.();
                    live?.setAttribute?.('data-sp-inline-inert', '');
                };
            });
        },
        didMount({ element, mesid } = {}) {
            coordinate()?.mountMessageButton?.(element, { rebindMessageId: Number(mesid) });
            return () => coordinate()?.unmountMessageButton?.(element);
        },
        didCommitContent({ element, content } = {}) {
            if (content?.querySelector?.(`[${INLINE_RUNTIME_ATTR}]`)) return;
            inline()?.mountElement?.(element);
            coordinate()?.mountMessageButton?.(element, { rebindMessageId: Number(element?.getAttribute?.('mesid')) });
            return () => {
                inline()?.unmountElement?.(element);
                coordinate()?.unmountMessageButton?.(element);
            };
        },
    };
}
