import { DIALOG_HOST_ID, MODAL_ID } from './ids.js';

export const DIALOG_HOST_CSS = 'position:fixed;inset:0;z-index:2000003;pointer-events:none';
export const MODAL_HOST_CSS = 'display:none;position:fixed;z-index:2000001';

export function shadowStylesHtml(extBase, stBase) {
    return `<link rel="stylesheet" href="${extBase}style.css">
        <link rel="stylesheet" href="${stBase}css/fontawesome.min.css">`;
}

export function shouldStopShadowKeydown(ev) {
    if (ev?.key === 'Escape') return false;
    const t = ev?.composedPath?.()[0] || ev?.target;
    return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
}

export function bindShadowKeyBoundary(root) {
    root?.addEventListener?.('keydown', ev => {
        if (shouldStopShadowKeydown(ev)) ev.stopPropagation();
    });
}

export function modalHostClass(theme) {
    return `sp-root sp-${theme}`;
}

export function panelShadowHtml(theme, html, extBase, stBase) {
    return `
        ${shadowStylesHtml(extBase, stBase)}
        <div class="sp-root sp-${theme}" style="display:contents">${html}</div>`;
}

export function mountPluginHosts(env = {}) {
    const document = env.document;
    document.querySelectorAll(`#${MODAL_ID}, #${DIALOG_HOST_ID}`).forEach(el => el.remove());

    // 弹窗宿主独立于主面板：主面板关闭时仍保持可见，空宿主不拦截页面点击。
    const dialogHost = document.createElement('div');
    dialogHost.id = DIALOG_HOST_ID;
    dialogHost.style.cssText = DIALOG_HOST_CSS;
    const dialogShadow = dialogHost.attachShadow({ mode: 'open' });
    dialogShadow.innerHTML = shadowStylesHtml(env.extBase, env.stBase);
    document.documentElement.appendChild(dialogHost);

    const host = document.createElement('div');
    host.id = MODAL_ID;
    host.className = modalHostClass(env.theme);
    host.style.cssText = MODAL_HOST_CSS;
    env.markSurface?.(host, 'fullscreen-window');
    const root = host.attachShadow({ mode: 'open' });
    bindShadowKeyBoundary(root);
    root.innerHTML = panelShadowHtml(env.theme, env.html, env.extBase, env.stBase);
    document.documentElement.appendChild(host);

    return { host, root, dialogHost, dialogShadow };
}
