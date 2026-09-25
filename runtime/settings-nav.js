export const SETTINGS_NAV = Object.freeze([
    { id: 'sp-settings-general', label: '通用设置', kind: 'layer' },
    { id: 'sp-prompts-section', label: '提示词与标签', kind: 'section' },
    { id: 'sp-settings-content', label: '塞给主楼 AI', kind: 'layer' },
    { id: 'sp-settings-pace', label: '跟剧情走', kind: 'layer' },
    { id: 'sp-settings-manual', label: '我自己点', kind: 'layer' },
    { id: 'sp-settings-data', label: '数据设置', kind: 'layer' },
    { id: 'sp-storage-section', label: '存储管理', kind: 'section' },
    { id: 'sp-diagnostics-section', label: '诊断管理', kind: 'section' },
]);

export const TAG_SETTINGS_TARGET = Object.freeze({
    sectionId: '#sp-prompts-section',
    subsectionSel: '.sp-prompt-tags',
    focusSel: '#sp-mem-keeptags',
});

export function settingsNavHtml(escape = value => String(value ?? '')) {
    const links = SETTINGS_NAV.map(item => (
        `<button type="button" class="sp-settings-toc-btn" data-settings-target="${escape(item.id)}">${escape(item.label)}</button>`
    )).join('');
    return `<div class="sp-settings-nav" id="sp-settings-nav">
        <div class="sp-settings-here">
            <span>当前位置</span>
            <strong id="sp-settings-here">通用设置</strong>
        </div>
        <nav class="sp-settings-toc" aria-label="设置目录">${links}</nav>
        <button type="button" class="sp-settings-top" id="sp-settings-top">返回顶部</button>
    </div>`;
}

export function openSettingsTarget(root, {
    sectionId = '',
    subsectionSel = '',
    focusSel = '',
    scrollSel = '',
} = {}) {
    if (!root) return { ok: false, reason: 'missing-root' };
    const section = sectionId ? root.querySelector(sectionId) : null;
    let cursor = section;
    while (cursor) {
        if (cursor.matches?.('details')) cursor.open = true;
        cursor = cursor.parentElement;
    }
    const subsection = subsectionSel ? root.querySelector(subsectionSel) : null;
    if (subsection?.matches?.('details')) subsection.open = true;
    const focus = focusSel ? root.querySelector(focusSel) : null;
    const scroll = (scrollSel ? root.querySelector(scrollSel) : null) || focus || section || subsection;
    try { scroll?.scrollIntoView?.({ block: 'center' }); } catch { /* 无布局环境 */ }
    try { focus?.focus?.(); } catch { /* 无焦点环境 */ }
    return { ok: !!(section || subsection || focus), focused: !!focus };
}

export function settingsHereLabel(container, nowTop = 0) {
    if (!container) return '';
    const layers = Array.from(container.querySelectorAll?.('details.sp-settings-layer, details.sp-settings-section') || []);
    const boxTop = Number(container.getBoundingClientRect?.()?.top) || 0;
    let current = '';
    for (const node of layers) {
        const rect = node.getBoundingClientRect?.();
        if (!rect) continue;
        if (rect.bottom > boxTop + 12 && rect.top < boxTop + (Number(nowTop) || 80) + 160) {
            const title = node.querySelector?.('.sp-settings-layer-title, .sp-settings-section-title');
            const text = String(title?.textContent || '').trim();
            if (text) current = text;
        }
    }
    return current;
}

export function bindSettingsNav(env = {}) {
    const $in = env.$in;
    const root = () => env.root?.() || $in?.('#sp-settings-overlay')?.[0] || null;
    const body = () => $in?.('#sp-settings-overlay .sp-settings-body')?.[0] || root()?.querySelector?.('.sp-settings-body');
    const paintHere = () => {
        const label = settingsHereLabel(body()) || '通用设置';
        $in?.('#sp-settings-here')?.text?.(label);
    };
    $in?.('#sp-settings-nav')?.on?.('click', '.sp-settings-toc-btn', function () {
        const id = this.getAttribute('data-settings-target');
        openSettingsTarget(root(), { sectionId: id ? `#${id}` : '' });
        paintHere();
    });
    $in?.('#sp-settings-top')?.on?.('click', () => {
        const scroller = body();
        if (scroller) scroller.scrollTop = 0;
        $in?.('#sp-settings-here')?.text?.('通用设置');
    });
    body()?.addEventListener?.('scroll', paintHere, { passive: true });
    return { paintHere, openTagSettings: () => openSettingsTarget(root(), TAG_SETTINGS_TARGET) };
}
