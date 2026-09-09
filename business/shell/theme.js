export function nextThemeMode(mode) {
    const cur = mode || 'auto';
    return cur === 'auto' ? 'day' : cur === 'day' ? 'night' : 'auto';
}

export function themeToggleIcon(mode) {
    if (mode === 'day') return 'fa-sun';
    if (mode === 'night') return 'fa-moon';
    return 'fa-circle-half-stroke';
}

export function themeToggleTitle(mode) {
    if (mode === 'day') return '主题：日间（点击切换到夜间）';
    if (mode === 'night') return '主题：夜间（点击切换到跟随酒馆）';
    return '主题：跟随酒馆（点击切换到日间）';
}

export function detectSTTheme(doc = globalThis.document, win = globalThis.window) {
    try {
        const raw = doc.defaultView.getComputedStyle(doc.documentElement)
            .getPropertyValue('--SmartThemeBodyColor').trim();
        if (raw) {
            const canvas = doc.createElement('canvas');
            canvas.width = canvas.height = 1;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = raw;
            ctx.fillRect(0, 0, 1, 1);
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            return lum > 127 ? 'night' : 'day';
        }
    } catch { /* ignore */ }
    return win.matchMedia('(prefers-color-scheme: light)').matches ? 'day' : 'night';
}

export function getEffectiveTheme(mode, detect = detectSTTheme) {
    if (mode === 'day' || mode === 'night') return mode;
    return detect();
}

const THEME_CLASSES = ['sp-night', 'sp-day', 'sp-forced-day', 'sp-forced-night'];

export function paintThemeClasses({ theme, forced, nodes = [], wrapper } = {}) {
    for (const node of nodes) {
        if (!node) continue;
        if (typeof node.removeClass === 'function') {
            node.removeClass(THEME_CLASSES.join(' ')).addClass(`sp-${theme}`);
            if (forced) node.addClass(`sp-forced-${theme}`);
        } else if (node.classList) {
            node.classList.remove(...THEME_CLASSES);
            node.classList.add(`sp-${theme}`);
            if (forced) node.classList.add(`sp-forced-${theme}`);
        }
    }
    if (wrapper?.classList) {
        wrapper.classList.remove(...THEME_CLASSES);
        wrapper.classList.add(`sp-${theme}`);
        if (forced) wrapper.classList.add(`sp-forced-${theme}`);
    }
}
