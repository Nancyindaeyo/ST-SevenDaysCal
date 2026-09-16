export const SP_FONT_LINK_ID = 'sp-ui-font-link';
export const SP_FONT_DEFAULT_URL = 'https://fontsapi.zeoseven.com/387/main/result.css';
export const SP_FONT_DEFAULT_FAMILY = 'Nowar Rounded TW Wc';

export function quoteCssFontFamily(family) {
    const name = String(family || '');
    if ((name.startsWith('"') && name.endsWith('"')) || (name.startsWith("'") && name.endsWith("'")) || /^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) {
        return name;
    }
    return `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// 从用户提供的 CSS 中读取首个有效 @font-face 字体名；只认 @font-face，
// 不猜测普通选择器里的 body/font 声明，避免把无关 CSS 当成界面字体。
export function parseFontFamilyFromCss(cssText) {
    if (typeof cssText !== 'string') return '';
    const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
    const blocks = withoutComments.matchAll(/@font-face\s*\{([\s\S]*?)\}/gi);
    for (const match of blocks) {
        const declaration = /(?:^|;)\s*font-family\s*:\s*([^;}]*)/i.exec(match[1]);
        if (!declaration) continue;
        const family = declaration[1].trim();
        if (!family || family.includes(',')) continue;
        const quote = family[0];
        if (quote === '"' || quote === "'") {
            const body = family.slice(1, -1);
            let escaped = false;
            let hasUnescapedSameQuote = false;
            for (const character of body) {
                if (character === quote && !escaped) { hasUnescapedSameQuote = true; break; }
                if (character === '\\' && !escaped) escaped = true;
                else escaped = false;
            }
            let closingSlashCount = 0;
            for (let i = family.length - 2; i >= 0 && family[i] === '\\'; i--) closingSlashCount++;
            if (family.length < 3 || family.at(-1) !== quote || closingSlashCount % 2 === 1 || hasUnescapedSameQuote) continue;
            let unquoted = '';
            let invalidEscape = false;
            for (let i = 0; i < body.length;) {
                if (body[i] !== '\\') {
                    unquoted += body[i++];
                    continue;
                }
                i++;
                if (i >= body.length) { invalidEscape = true; break; }
                if (body[i] === '\r' || body[i] === '\n') {
                    if (body[i] === '\r' && body[i + 1] === '\n') i++;
                    i++;
                    continue;
                }
                const hex = /^[0-9a-f]{1,6}/i.exec(body.slice(i));
                if (hex) {
                    const codePoint = Number.parseInt(hex[0], 16);
                    i += hex[0].length;
                    if (/[\t\n\r ]/.test(body[i] || '')) i++;
                    if (!codePoint || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) { invalidEscape = true; break; }
                    unquoted += String.fromCodePoint(codePoint);
                    continue;
                }
                unquoted += body[i++];
            }
            unquoted = unquoted.trim();
            if (invalidEscape || /[\u0000-\u001f\u007f]/.test(unquoted)) continue;
            if (unquoted) return unquoted;
        } else if (/^[^{};'"\"]+$/.test(family)) {
            return family;
        }
    }
    return '';
}

// 界面字体·自管控：按 settings.uiFontUrl / uiFontFamily 动态挂 <link> + 写 --sp-font-user。
// 幂等：复用固定 id 的 link 节点，重复调用只改 href / 不叠加。
export function createUiFontController(env = {}) {
    const linkId = env.linkId || SP_FONT_LINK_ID;
    const defaultUrl = env.defaultUrl ?? SP_FONT_DEFAULT_URL;
    const defaultFamily = env.defaultFamily ?? SP_FONT_DEFAULT_FAMILY;

    function apply() {
        const doc = env.document || globalThis.document;
        const s = env.settings?.() || {};
        const url = String(s.uiFontUrl ?? defaultUrl).trim();
        let family = String(s.uiFontFamily ?? defaultFamily).trim();

        // <link> 侧：有 URL 就挂/换，留空则移除（=只用系统栈兜底）。href 用绝对 URL——
        // zeoseven 那份 CSS 里 @font-face src 是相对路径 ./xxx.woff2，浏览器基于 link href 解析，
        // 故必须走 <link href> 而非把 CSS 内容内联（内联会丢失基准 URL、woff2 404）。
        let link = doc.getElementById(linkId);
        if (url) {
            if (!link) {
                link = doc.createElement('link');
                link.id = linkId;
                link.rel = 'stylesheet';
                doc.head.appendChild(link);
            }
            if (link.getAttribute('href') !== url) link.setAttribute('href', url);
        } else if (link) {
            link.remove();
        }

        // --sp-font-user 侧：写生效 family 名（供 style.css 的 --sp-font 打头）。family 留空则回落默认名。
        // 名字含空格 / 非纯标识符时补引号，避免 CSS 里被拆成多个 family。
        if (!family) family = defaultFamily;
        doc.documentElement.style.setProperty('--sp-font-user', quoteCssFontFamily(family));
    }

    return { apply, parse: parseFontFamilyFromCss, defaultUrl, defaultFamily, linkId };
}
