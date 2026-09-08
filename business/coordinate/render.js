import { isCurrentRevision } from './identity.js';
import { hayOf, groupItemsByTag } from './browse.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const tagChips = (tags, map) => (Array.isArray(tags) ? tags : []).map(id => map.get(id)).filter(Boolean).map(tag => `<span class="sp-anchor-tagchip" data-color="${esc(tag.color || 'slate')}">${esc(tag.name)}</span>`).join('');
const tagNamesOf = (tags, map) => (Array.isArray(tags) ? tags : []).map(id => map.get(id)?.name).filter(Boolean);

export function createCoordinateRenderer({ repository, excerptRepo = null, setBody, getState, setState, getTheme = () => 'day', escapeHtml = esc, formatTimestamp = value => new Date(value || 0).toLocaleString(), svg = () => '', documentRef = globalThis.document, queryRoot = null } = {}) {
    const current = () => getState?.() || { level: 'chars', charName: null, chatId: null, itemId: null, filter: null, shelf: 'snaps', snapSearch: '', clipSearch: '', browse: 'char', groupId: null, composer: null, excerptEditId: null, fullTagEdit: false };
    const visible = (items, filter) => filter ? items.filter(item => item.tags?.includes(filter)) : items;
    const filterBar = (tags, active) => tags.length ? `<div class="sp-anchor-filterbar"><button type="button" class="sp-anchor-filter-chip${!active ? ' sp-anchor-filter-on' : ''}" data-id="">全部</button>${tags.map(tag => `<button type="button" class="sp-anchor-filter-chip sp-anchor-filter-tag${tag.id === active ? ' sp-anchor-filter-on' : ''}" data-id="${esc(tag.id)}"><span class="sp-anchor-tagchip" data-color="${esc(tag.color || 'slate')}">${esc(tag.name)}</span></button>`).join('')}</div>` : '';
    const searchBox = (shelf, value, placeholder) => `<label class="sp-excerpt-search-wrap"><i class="fa-solid fa-magnifying-glass"></i><input type="text" class="sp-anchor-search sp-input" id="sp-anchor-search-${shelf}" data-shelf="${shelf}" placeholder="${esc(placeholder)}" value="${esc(value || '')}" autocomplete="off" spellcheck="false"></label>`;
    const browseBar = browse => `<div class="sp-anchor-browse" role="tablist"><button type="button" class="sp-anchor-browse-tab${browse !== 'tag' ? ' sp-anchor-browse-on' : ''}" data-browse="char">按角色</button><button type="button" class="sp-anchor-browse-tab${browse === 'tag' ? ' sp-anchor-browse-on' : ''}" data-browse="tag">按分组</button></div>`;
    const searchEmpty = text => `<div class="sp-search-empty" hidden>${esc(text)}</div>`;
    const itemCard = (item, map, { showChat = false } = {}) => {
        const hay = hayOf([item.charName, item.chatName, item.textPreview, item.note, item.floorIndex, ...tagNamesOf(item.tags, map)]);
        const chat = showChat && item.chatName ? `<span class="sp-anchor-item-chat">${escapeHtml(item.chatName)}</span>` : '';
        return `<article class="sp-anchor-item-card" data-id="${esc(item.id)}" data-search="${esc(hay)}"><button type="button" class="sp-anchor-item-open"><span class="sp-anchor-item-tags">${tagChips(item.tags, map)}</span><span class="sp-anchor-item-main"><span class="sp-anchor-item-floor">#${item.floorIndex ?? '?'}</span><span class="sp-anchor-item-preview">${escapeHtml(item.textPreview || '(无正文预览)')}</span><span class="sp-anchor-item-ts">${formatTimestamp(item.ts)}</span></span>${chat}</button><input type="text" class="sp-anchor-item-note-input" data-id="${esc(item.id)}" maxlength="80" placeholder="写一句备注…" value="${esc(item.note || '')}" autocomplete="off" spellcheck="false"></article>`;
    };
    const flattenItems = buckets => {
        const items = [];
        for (const bucket of buckets || []) for (const item of bucket.items || []) items.push(item);
        return items;
    };
    const shelfBar = async (shelf) => {
        let snapN = ''; let clipN = '';
        try { const n = await repository.countItems?.(); if (n) snapN = ` <span class="sp-anchor-shelf-n">${n}</span>`; } catch { /* 计数失败不挡渲染 */ }
        try { const n = await excerptRepo?.count?.(); if (n) clipN = ` <span class="sp-anchor-shelf-n">${n}</span>`; } catch { /* 同上 */ }
        return `<div class="sp-anchor-shelf" role="tablist"><button type="button" class="sp-anchor-shelf-tab${shelf !== 'clips' ? ' sp-anchor-shelf-on' : ''}" data-shelf="snaps" role="tab">快照${snapN}</button><button type="button" class="sp-anchor-shelf-tab${shelf === 'clips' ? ' sp-anchor-shelf-on' : ''}" data-shelf="clips" role="tab">摘抄${clipN}</button></div>`;
    };
    const snapHead = async (s, extra = '') => `<div class="sp-anchor-head sp-anchor-chars-head">${await shelfBar(s.shelf)}${s.shelf !== 'clips' ? browseBar(s.browse) : ''}${extra}</div>`;
    const composerHtml = composer => !composer?.quote ? '' : `<div class="sp-excerpt-composer"><div class="sp-excerpt-composer-kicker">新摘抄</div><blockquote class="sp-excerpt-quote">${escapeHtml(composer.quote)}</blockquote><textarea class="sp-excerpt-note-input sp-input" rows="3" maxlength="4000" placeholder="写一句点评，也可以先留空…">${escapeHtml(composer.note || '')}</textarea><div class="sp-excerpt-composer-foot"><button type="button" class="sp-excerpt-cancel sp-mini-btn">取消</button><button type="button" class="sp-excerpt-save sp-mini-btn">收下这条</button></div></div>`;
    const snapTheme = () => {
        const root = queryRoot?.closest?.('.sp-root') || queryRoot?.querySelector?.('.sp-root') || documentRef?.querySelector?.('.sp-root');
        const cs = root ? globalThis.getComputedStyle?.(root) : null;
        const pick = (name, fallback) => String(cs?.getPropertyValue?.(name) || '').trim() || fallback;
        const opaque = (value, fallback) => {
            const v = String(value || '').trim();
            if (!v) return fallback;
            const lower = v.toLowerCase();
            if (lower === 'transparent') return fallback;
            if (/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*0(?:\.0+)?\s*\)/.test(lower)) return fallback;
            if (/\/\s*0(?:\.0+)?\s*\)/.test(lower)) return fallback;
            return v;
        };
        const night = getTheme?.() === 'night';
        const legacyBg = pick('--sp-sheet-bg-legacy', night ? '#272829' : '#FAF9F6');
        return {
            fg: opaque(pick('--sp-on-surface', ''), night ? '#D8D9DA' : '#27323A'),
            bg: opaque(pick('--sp-sheet-bg', ''), legacyBg),
            link: opaque(pick('--sp-primary', ''), night ? '#A8A49E' : '#457892'),
        };
    };
    async function chars() {
        const s = current();
        if (s.browse === 'tag') return tagHome();
        const all = await repository.listByChat?.() || []; const tags = await repository.getTags(); const map = new Map(tags.map(tag => [tag.id, tag])); const groups = new Map();
        for (const bucket of all) { const items = visible(bucket.items || [], s.filter); if (!items.length) continue; const key = bucket.charName || '(未知角色)'; const group = groups.get(key) || { name: key, chatCount: 0, count: 0, latestTs: 0, hay: [] }; group.chatCount++; group.count += items.length; group.latestTs = Math.max(group.latestTs, ...items.map(item => item.ts || 0)); group.hay.push(key, ...items.map(item => item.textPreview || ''), ...items.map(item => item.note || ''), ...items.flatMap(item => tagNamesOf(item.tags, map))); groups.set(key, group); }
        const list = [...groups.values()].sort((a, b) => b.latestTs - a.latestTs);
        const cards = list.map(group => `<button type="button" class="sp-anchor-char-card" data-char="${esc(group.name)}" data-search="${esc(hayOf(group.hay))}"><span class="sp-anchor-chat-icon">${svg('sp-anchor-chat-svg')}</span><span class="sp-anchor-chat-main"><span class="sp-anchor-chat-name">${escapeHtml(group.name)}</span><span class="sp-anchor-chat-sub">${group.count} 条快照</span></span><span class="sp-anchor-chat-meta"><span class="sp-anchor-chat-count">${group.count}</span><span class="sp-anchor-chat-ts">${formatTimestamp(group.latestTs)}</span></span></button>`).join('');
        setBody(`${await snapHead(s, '<button type="button" class="sp-icon-btn sp-anchor-tagmgr-btn" title="管理分组" aria-label="管理分组">分组</button>')}<div class="sp-anchor-scroll">${searchBox('snaps', s.snapSearch, '搜角色、预览、备注、分组名…')}<div class="sp-anchor-char-list" data-filter-list>${cards || '<div class="sp-anchor-filter-empty">没有含此分组的收藏</div>'}</div>${searchEmpty('没有匹配的角色')}</div>`);
    }
    async function tagHome() {
        const s = current();
        const tags = await repository.getTags();
        const map = new Map(tags.map(tag => [tag.id, tag]));
        const items = flattenItems(await repository.listByChat?.() || []);
        const { groups, untagged } = groupItemsByTag(items, tags);
        const card = (id, title, count, latestTs, hay, color = '') => `<button type="button" class="sp-anchor-group-card" data-group="${esc(id)}" data-search="${esc(hay)}"><span class="sp-anchor-chat-main"><span class="sp-anchor-chat-name">${color ? `<span class="sp-anchor-tagchip" data-color="${esc(color)}">${escapeHtml(title)}</span>` : escapeHtml(title)}</span><span class="sp-anchor-chat-sub">${count} 条快照</span></span><span class="sp-anchor-chat-meta"><span class="sp-anchor-chat-count">${count}</span><span class="sp-anchor-chat-ts">${latestTs ? formatTimestamp(latestTs) : ''}</span></span></button>`;
        const groupCards = groups.map(group => card(group.tag.id, group.tag.name, group.items.length, Math.max(0, ...group.items.map(item => item.ts || 0)), hayOf([group.tag.name, ...group.items.map(item => item.textPreview), ...group.items.map(item => item.note), ...group.items.map(item => item.charName)]), group.tag.color || 'slate')).join('');
        const noneCard = untagged.length ? card('__none__', '未分组', untagged.length, Math.max(0, ...untagged.map(item => item.ts || 0)), hayOf(['未分组', ...untagged.map(item => item.textPreview), ...untagged.map(item => item.note), ...untagged.map(item => item.charName)])) : '';
        const cards = groupCards + noneCard;
        setBody(`${await snapHead(s, '<button type="button" class="sp-icon-btn sp-anchor-tagmgr-btn" title="管理分组" aria-label="管理分组">分组</button>')}<div class="sp-anchor-scroll">${searchBox('snaps', s.snapSearch, '搜分组名、预览…')}<div class="sp-anchor-char-list" data-filter-list>${cards || '<div class="sp-anchor-filter-empty">还没有分组。收藏时打上标签，或点右上角「分组」新建。</div>'}</div>${searchEmpty('没有匹配的分组')}</div>`);
        return map;
    }
    async function group() {
        const s = current();
        const tags = await repository.getTags();
        const map = new Map(tags.map(tag => [tag.id, tag]));
        const items = flattenItems(await repository.listByChat?.() || []);
        const { groups, untagged } = groupItemsByTag(items, tags);
        const packed = s.groupId === '__none__' ? { name: '未分组', list: untagged } : { name: map.get(s.groupId)?.name || '分组', list: groups.find(entry => entry.tag.id === s.groupId)?.items || [] };
        const list = packed.list.slice().sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
        setBody(`<div class="sp-anchor-head"><button type="button" class="sp-anchor-back" data-browse="tag">‹</button><span class="sp-anchor-head-title">${escapeHtml(packed.name)}</span><span class="sp-anchor-head-count">${list.length} 条</span></div><div class="sp-anchor-scroll">${searchBox('snaps', s.snapSearch, '搜预览、备注、角色…')}<div class="sp-anchor-item-list" data-filter-list>${list.map(item => itemCard(item, map, { showChat: true })).join('') || '<div class="sp-anchor-filter-empty">这一组还是空的</div>'}</div>${searchEmpty('没有匹配的快照')}</div>`);
    }
    async function tags() {
        const list = await repository.getTags(); const state = current();
        const palette = ['rose', 'amber', 'olive', 'teal', 'indigo', 'plum', 'slate', 'clay'];
        const buckets = await repository.listByChat?.() || []; const usage = new Map();
        for (const bucket of buckets) for (const item of bucket.items || []) for (const id of item.tags || []) usage.set(id, (usage.get(id) || 0) + 1);
        try { for (const item of await excerptRepo?.list?.() || []) for (const id of item.tags || []) usage.set(id, (usage.get(id) || 0) + 1); } catch { /* 摘抄计数失败不挡 */ }
        const swatches = active => palette.map(color => `<button type="button" class="sp-tagmgr-swatch${color === active ? ' sp-tp-swatch-on' : ''}" data-color="${color}"><span class="sp-anchor-tagchip" data-color="${color}">A</span></button>`).join('');
        const rows = list.length ? list.map(tag => {
            const n = usage.get(tag.id) || 0;
            if (state.tagEditId === tag.id) return `<div class="sp-anchor-tagmgr-row sp-tagmgr-editing" data-id="${esc(tag.id)}"><input type="text" class="sp-tagmgr-name-input sp-input" value="${esc(tag.name)}" maxlength="20"><div class="sp-tagmgr-swatches">${swatches(state.tagEditColor)}</div><div class="sp-tagmgr-row-actions"><button type="button" class="sp-tagmgr-save sp-mini-btn"><i class="fa-solid fa-check"></i></button><button type="button" class="sp-tagmgr-cancel sp-mini-btn"><i class="fa-solid fa-xmark"></i></button></div></div>`;
            if (state.tagDeleteId === tag.id) return `<div class="sp-anchor-tagmgr-row sp-tagmgr-confirming" data-id="${esc(tag.id)}"><span class="sp-tagmgr-confirm-text">删除「${esc(tag.name)}」？将从 ${n} 条收藏/摘抄移除</span><div class="sp-tagmgr-row-actions"><button type="button" class="sp-tagmgr-del-yes sp-mini-btn sp-mini-btn-danger">删除</button><button type="button" class="sp-tagmgr-del-no sp-mini-btn">取消</button></div></div>`;
            return `<div class="sp-anchor-tagmgr-row" data-id="${esc(tag.id)}"><span class="sp-anchor-tagchip" data-color="${esc(tag.color || 'slate')}">${esc(tag.name)}</span><span class="sp-tagmgr-usage">${n} 条</span><div class="sp-tagmgr-row-actions"><button type="button" class="sp-tagmgr-edit sp-icon-btn" title="改名 / 改色"><i class="fa-solid fa-pen"></i></button><button type="button" class="sp-tagmgr-del sp-icon-btn" title="删除分组"><i class="fa-solid fa-trash"></i></button></div></div>`;
        }).join('') : '<div class="sp-anchor-filter-empty">还没有分组。建好后，收藏和摘抄都能归进去。</div>';
        setBody(`<div class="sp-anchor-head sp-anchor-tagmgr-head"><button type="button" class="sp-anchor-back" data-to="chars"><i class="fa-solid fa-chevron-left"></i></button><span class="sp-anchor-head-title">管理分组</span><span class="sp-anchor-head-count">${list.length} 个</span></div><div class="sp-anchor-scroll"><p class="sp-anchor-clip-hint">分组用来把快照和摘抄归堆。在快照里打标签，摘抄会跟着走；点「按分组」就能按堆翻。</p><div class="sp-anchor-tagmgr-new"><input type="text" class="sp-tagmgr-new-name sp-input" placeholder="新建分组名…" maxlength="20"><div class="sp-tagmgr-swatches sp-tagmgr-new-swatches">${swatches(state.tagNewColor || 'rose')}</div><button type="button" class="sp-tagmgr-new-add sp-mini-btn"><i class="fa-solid fa-plus"></i> 新建</button></div><div class="sp-anchor-tagmgr-list">${rows}</div></div>`);
    }
    async function chats(charName) {
        const all = (await repository.listByChat?.() || []).filter(bucket => !charName || (bucket.charName || '(未知角色)') === charName); const tags = await repository.getTags(); const map = new Map(tags.map(tag => [tag.id, tag])); const s = current(); const buckets = all.map(bucket => { const items = visible(bucket.items || [], s.filter); return { ...bucket, items, count: items.length, latestTs: Math.max(0, ...items.map(item => item.ts || 0)) }; }).filter(bucket => bucket.items.length);
        const cards = buckets.map(bucket => `<button type="button" class="sp-anchor-chat-card" data-chatid="${esc(bucket.chatId ?? '')}" data-search="${esc(hayOf([bucket.chatName, bucket.charName, ...bucket.items.map(item => item.textPreview), ...bucket.items.flatMap(item => tagNamesOf(item.tags, map))]))}"><span class="sp-anchor-chat-icon">${svg('sp-anchor-chat-svg')}</span><span class="sp-anchor-chat-main"><span class="sp-anchor-chat-name">${escapeHtml(bucket.chatName || '(未命名聊天)')}</span><span class="sp-anchor-chat-sub">${escapeHtml(bucket.charName || '')}</span></span><span class="sp-anchor-chat-meta"><span class="sp-anchor-chat-count">${bucket.count}</span><span class="sp-anchor-chat-ts">${formatTimestamp(bucket.latestTs)}</span></span></button>`).join('');
        setBody(`<div class="sp-anchor-head"><button type="button" class="sp-anchor-back" data-to="chars">‹</button><span class="sp-anchor-head-title">${escapeHtml(charName || '(未知角色)')}</span><span class="sp-anchor-head-count">${buckets.length} 个聊天</span></div><div class="sp-anchor-scroll">${searchBox('snaps', s.snapSearch, '搜聊天名、预览…')}${filterBar(tags, s.filter)}<div class="sp-anchor-chat-list" data-filter-list>${cards || '<div class="sp-anchor-filter-empty">没有含此分组的收藏</div>'}</div>${searchEmpty('没有匹配的聊天')}</div>`);
    }
    async function items(chatId) {
        const s = current();
        const tags = await repository.getTags();
        const map = new Map(tags.map(tag => [tag.id, tag]));
        const buckets = await repository.listByChat?.() || [];
        if (s.charName && (s.chatId == null || s.chatId === '')) {
            const owned = buckets.filter(bucket => (bucket.charName || '(未知角色)') === s.charName);
            const list = visible(owned.flatMap(bucket => bucket.items || []), s.filter).sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
            setBody(`<div class="sp-anchor-head"><button type="button" class="sp-anchor-back" data-to="chars">‹</button><span class="sp-anchor-head-title">${escapeHtml(s.charName)}</span><span class="sp-anchor-head-count">${list.length} 条</span></div><div class="sp-anchor-scroll">${searchBox('snaps', s.snapSearch, '搜预览、备注、分组…')}${filterBar(tags, s.filter)}<div class="sp-anchor-item-list" data-filter-list>${list.map(item => itemCard(item, map, { showChat: true })).join('') || '<div class="sp-anchor-filter-empty">没有含此分组的收藏</div>'}</div>${searchEmpty('没有匹配的快照')}</div>`);
            return;
        }
        const bucket = buckets.find(entry => String(entry.chatId) === String(chatId ?? s.chatId));
        if (!bucket) return chars();
        const list = visible(bucket.items, s.filter);
        setBody(`<div class="sp-anchor-head"><button type="button" class="sp-anchor-back" data-to="chars">‹</button><span class="sp-anchor-head-title">${escapeHtml(bucket.chatName || bucket.charName || '收藏')}</span><span class="sp-anchor-head-count">${list.length} 条</span></div><div class="sp-anchor-scroll">${searchBox('snaps', s.snapSearch, '搜预览、备注、分组…')}${filterBar(tags, s.filter)}<div class="sp-anchor-item-list" data-filter-list>${list.map(item => itemCard(item, map)).join('') || '<div class="sp-anchor-filter-empty">没有含此分组的收藏</div>'}</div>${searchEmpty('没有匹配的快照')}</div>`);
    }
    async function full(itemId, revision = null, theme = null) {
        theme = theme || getTheme?.() || 'day';
        const item = await repository.getItem(itemId); if (!item || (revision && !isCurrentRevision(revision, getState?.()))) return chars(); const tags = await repository.getTags(); const map = new Map(tags.map(tag => [tag.id, tag]));
        setState?.({ level: 'full', itemId, shelf: 'snaps' }); const s = current(); const noteBox = `<div class="sp-anchor-full-note"><input type="text" class="sp-anchor-full-note-input sp-input" data-id="${esc(item.id)}" maxlength="80" placeholder="给这条快照写一句备注…" value="${esc(item.note || '')}" autocomplete="off" spellcheck="false"></div>`; const edit = s.fullTagEdit ? `<div class="sp-anchor-full-tagedit"><div class="sp-anchor-ftag-chips">${tags.map(tag => `<button type="button" class="sp-anchor-ftag-chip${item.tags?.includes(tag.id) ? ' sp-tp-chip-on' : ''}" data-id="${esc(tag.id)}"><span class="sp-anchor-tagchip" data-color="${esc(tag.color || 'slate')}">${esc(tag.name)}</span></button>`).join('')}</div><div class="sp-anchor-ftag-new"><input class="sp-anchor-ftag-name sp-input" placeholder="新建分组名…"></div><div class="sp-anchor-ftag-foot"><button type="button" class="sp-anchor-ftag-add sp-mini-btn">新增</button><button type="button" class="sp-anchor-ftag-done sp-mini-btn">完成</button></div></div>` : `<div class="sp-anchor-full-tags">${tagChips(item.tags, map)}<button type="button" class="sp-anchor-tag-edit sp-mini-btn">编辑分组</button></div>`; setBody(`<div class="sp-anchor-head"><button type="button" class="sp-anchor-back" data-back="from">‹</button><span class="sp-anchor-head-title">${escapeHtml(item.charName || '')}<span class="sp-anchor-head-floor"> · #${item.floorIndex ?? '?'}</span></span><span class="sp-anchor-head-actions"><button type="button" class="sp-icon-btn sp-anchor-clip" title="把划选的句子做成摘抄">摘抄选中</button><button type="button" class="sp-icon-btn sp-anchor-fullscreen" title="全屏浏览">⛶</button><button type="button" class="sp-icon-btn sp-anchor-del" title="删除此收藏"><i class="fa-solid fa-trash"></i></button></span></div><div class="sp-anchor-scroll">${noteBox}${edit}${composerHtml(s.composer)}<div class="sp-anchor-full-host" id="sp-anchor-full-host"></div><p class="sp-anchor-clip-hint">手机长按划一段，电脑直接拖选，再点右上角「摘抄选中」。摘抄单独保存，删快照也不会带走它。</p><div class="sp-anchor-full-ts">收藏于 ${formatTimestamp(item.ts)}</div></div><div class="sp-anchor-fs-resize" title="拖拽调整大小"></div>`);
        const host = queryRoot?.querySelector?.('#sp-anchor-full-host') || documentRef?.querySelector?.('#sp-anchor-full-host');
        if (host) {
            const shadow = host.shadowRoot || host.attachShadow?.({ mode: 'open' });
            if (shadow) {
                const { fg, bg, link } = snapTheme();
                const mark = `color-mix(in oklab, ${link} 32%, transparent)`;
                shadow.innerHTML = `<style>:host{all:initial;display:block;color:${fg}}.sp-anchor-snap{display:block;color:${fg};background:${bg};padding:16px 18px !important;margin:0 !important;border:none !important;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;font-size:12px;line-height:1.6;word-break:break-word;user-select:text !important;-webkit-user-select:text !important;-webkit-touch-callout:default;touch-action:pan-y;cursor:text}.sp-anchor-snap ::selection{background:${mark}}.sp-anchor-snap img{max-width:100%;height:auto}.sp-anchor-snap a{color:${link}}.sp-anchor-snap q:before,.sp-anchor-snap q:after{content:''}</style><div class="mes_text sp-anchor-snap">${item.html || ''}</div>`;
            }
        }
        return item;
    }
    async function excerpts() {
        const s = current();
        const tags = await repository.getTags();
        const map = new Map(tags.map(tag => [tag.id, tag]));
        const all = await excerptRepo?.list?.() || [];
        const list = s.filter ? all.filter(item => item.tags?.includes(s.filter)) : all;
        const cards = list.map(item => {
            const names = tagNamesOf(item.tags, map);
            const editing = s.excerptEditId === item.id;
            const quote = `<blockquote class="sp-excerpt-quote">${escapeHtml(item.quote)}</blockquote>`;
            const note = editing
                ? `<textarea class="sp-excerpt-note-input sp-input" rows="3" maxlength="4000" data-id="${esc(item.id)}" placeholder="点评…">${escapeHtml(item.note || '')}</textarea>`
                : (item.note ? `<div class="sp-excerpt-note">${escapeHtml(item.note)}</div>` : `<div class="sp-excerpt-note sp-excerpt-note-empty">还没有点评</div>`);
            const actions = editing
                ? `<div class="sp-excerpt-actions"><button type="button" class="sp-excerpt-edit-save sp-mini-btn" data-id="${esc(item.id)}">保存</button><button type="button" class="sp-excerpt-edit-cancel sp-mini-btn" data-id="${esc(item.id)}">取消</button></div>`
                : `<div class="sp-excerpt-actions"><button type="button" class="sp-excerpt-locate sp-mini-btn" data-id="${esc(item.id)}" title="打开对应快照，不切换酒馆聊天档">看快照</button><button type="button" class="sp-excerpt-send-space sp-mini-btn" data-id="${esc(item.id)}" title="做成间里的引用，输入框留给你接着写">发给间</button><button type="button" class="sp-excerpt-edit sp-mini-btn" data-id="${esc(item.id)}">改点评</button><button type="button" class="sp-excerpt-del sp-mini-btn" data-id="${esc(item.id)}">删除</button></div>`;
            const hay = hayOf([item.quote, item.note, item.charName, item.chatName, ...names]);
            return `<article class="sp-excerpt-card" data-id="${esc(item.id)}" data-search="${esc(hay)}">${quote}${note}<div class="sp-excerpt-meta"><span>${escapeHtml(item.charName || '未名')}</span><span>#${item.floorIndex ?? '?'}</span><span>${formatTimestamp(item.ts)}</span></div><div class="sp-excerpt-tags">${tagChips(item.tags, map)}</div>${actions}</article>`;
        }).join('');
        const empty = list.length
            ? ''
            : '<div class="sp-excerpt-empty"><p>快照是整楼副本，摘抄是你划下的句子和点评，两边互不覆盖。</p><p>打开一条快照，划选文字，点「摘抄选中」。发给间会做成引用条，输入框留给你接着写，不会代你发送。</p></div>';
        setBody(`${await snapHead(s)}<div class="sp-anchor-scroll">${searchBox('clips', s.clipSearch, '搜摘抄、点评、角色、分组…')}${filterBar(tags, s.filter)}<div class="sp-excerpt-list" data-filter-list>${cards || empty}</div>${searchEmpty('没有匹配的摘抄或点评')}</div>`);
    }
    async function render() {
        const s = current();
        if (s.shelf === 'clips' && s.level !== 'full' && s.level !== 'tags') return excerpts();
        if (s.level === 'full' && s.itemId) return full(s.itemId);
        if (s.level === 'group') return group();
        if (s.level === 'items' && (s.chatId != null || s.charName)) return items(s.chatId);
        if (s.level === 'chats') return chats(s.charName);
        if (s.level === 'tags') return tags();
        return chars();
    }
    return { render, chars, chats, items, full, tags, excerpts, group, filterBar };
}

export function createFullscreenController({ body, sheet, documentRef = globalThis.document } = {}) {
    let escHandler = null; let gesture = null;
    const clearInline = () => { if (!body?.style) return; for (const key of ['left','top','right','bottom','width','height']) body.style[key] = ''; };
    const clear = () => { body?.classList?.remove('sp-anchor-fs-on'); sheet?.classList?.remove('sp-fs-flat'); documentRef?.body?.classList?.remove('sp-anchor-fs-lock'); clearInline(); if (escHandler) documentRef?.removeEventListener?.('keydown', escHandler); escHandler = null; };
    const toggle = () => { if (!body) return false; const on = body.classList.toggle('sp-anchor-fs-on'); sheet?.classList?.toggle('sp-fs-flat', on); documentRef?.body?.classList?.toggle('sp-anchor-fs-lock', on); if (!on) clearInline(); if (on && !escHandler) { escHandler = event => { if (event.key === 'Escape') clear(); }; documentRef?.addEventListener?.('keydown', escHandler); } return on; };
    const beginGesture = (mode, event) => { if (!body?.classList?.contains('sp-anchor-fs-on') || (globalThis.innerWidth || 0) <= 640) return; gesture = { mode, x: event.clientX, y: event.clientY, left: body.offsetLeft, top: body.offsetTop, width: body.offsetWidth, height: body.offsetHeight }; };
    const moveGesture = event => { if (!gesture || !body) return; if (event.buttons === 0) return endGesture(); const dx = event.clientX - gesture.x; const dy = event.clientY - gesture.y; if (gesture.mode === 'move') { body.style.left = `${gesture.left + dx}px`; body.style.top = `${gesture.top + dy}px`; } else { body.style.width = `${Math.max(280, gesture.width + dx)}px`; body.style.height = `${Math.max(240, gesture.height + dy)}px`; } };
    const endGesture = () => { gesture = null; };
    return { toggle, clear, beginGesture, moveGesture, endGesture, destroy() { endGesture(); clear(); } };
}
