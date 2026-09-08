import { createCoordinateController } from './controller.js';
import { createCoordinateUI } from './ui.js';
import { captureMesText, sanitizeSnapshot, makePreview } from './capture.js';
import { createCoordinateRenderer, createFullscreenController } from './render.js';
import { clearReplyMarker, normalizeId, readReplyMarker, replyVersion, writeReplyMarker } from './identity.js';
import { clipText, NOTE_MAX, QUOTE_MAX } from './excerpt-schema.js';
import { SNAP_NOTE_MAX } from './schema.js';
import { bindSnapSelection, filterSearchList, readShadowSelection } from './excerpt-ui.js';

export function createCoordinateFeature({ repository, excerpts = null, root = null, capture = captureMesText, ports = null, host = {} } = {}) {
    const ui = createCoordinateUI({ root });
    const controller = createCoordinateController({ repository, ui, capture: source => capture(source, { ports }) });
    let currentTheme = host.theme?.() || 'day';
    const applySearchFilter = () => {
        const input = root?.querySelector?.('.sp-anchor-search');
        if (input) filterSearchList(root, input.value);
    };
    let renderToken = 0; let activeRender = null;
    const rendererImpl = createCoordinateRenderer({ repository, excerptRepo: excerpts, setBody: html => { const active = activeRender; if (root && active && active.token === renderToken && controller.isCurrent(active.revision)) root.innerHTML = html; }, getState: () => { const state = ui.state?.() || {}; return { ...state, level: state.level || ui.route(), charName: state.charName, chatId: state.chatId ?? null, itemId: state.itemId }; }, setState: next => ui.setRoute(next), getTheme: () => currentTheme, documentRef: host.document || globalThis.document, queryRoot: root });
    const renderCurrent = task => { const current = { token: ++renderToken, revision: controller.snapshotRevision() }; activeRender = current; return Promise.resolve(task()).finally(() => { if (activeRender === current) activeRender = null; }); };
    let clipOff = null;
    const attachClipPicker = () => {
        clipOff?.();
        clipOff = null;
        const hostEl = root?.querySelector?.('#sp-anchor-full-host');
        if (!hostEl) return;
        clipOff = bindSnapSelection({
            host: hostEl,
            onChange: quote => root?.querySelector?.('.sp-anchor-clip')?.classList.toggle('sp-anchor-clip-ready', Boolean(quote)),
        });
    };
    const renderer = new Proxy(rendererImpl, { get(target, key) { const value = target[key]; return typeof value === 'function' && ['render', 'chars', 'chats', 'items', 'full', 'tags', 'excerpts', 'group'].includes(key) ? (...args) => renderCurrent(() => value.apply(target, args)).then(result => { applySearchFilter(); if (key === 'full' || (key === 'render' && ui.route() === 'full')) attachClipPicker(); return result; }) : value; } });
    const fullscreen = createFullscreenController({ body: root, sheet: host.sheet?.(), documentRef: host.document || globalThis.document });
    let initialized = false; let gestureCleanup = null;
    let savedItems = new Map();
    const busyReplies = new WeakSet();
    const buttonSources = new WeakMap();
    const messageAt = (ctx, mid) => { const id = Number(mid); return Number.isInteger(id) && id >= 0 ? ctx?.chat?.[id] : null; };
    const sourceFor = (ctx, mes) => { const mid = mes?.getAttribute?.('mesid'); const message = messageAt(ctx, mid); const version = replyVersion(message); return message && version ? { chatId: ctx?.chatId ?? null, mid: String(mid), message, version } : null; };
    const sameSource = (left, right) => !!left && !!right && normalizeId(left.chatId) === normalizeId(right.chatId) && left.mid === right.mid && left.message === right.message && left.version === right.version;
    const savedItemFor = (message, chatId) => { const marker = readReplyMarker(message); if (!marker) return null; const item = savedItems.get(marker.itemId); return item && normalizeId(item.chatId) === normalizeId(chatId) ? item : null; };
    const setButtonState = (button, saved) => { if (!button) return; button.classList.toggle('sp-anchor-saved', Boolean(saved)); button.title = saved ? '已收藏 · 点击取消' : '收藏此楼'; };
    const bindButton = (button, source) => { if (button && source) buttonSources.set(button, source); };
    const refreshButton = (mes, button, { trusted = false } = {}) => {
        const ctx = host.context?.() || {}; const source = sourceFor(ctx, mes); const bound = buttonSources.get(button);
        const sameMessage = bound && source && normalizeId(bound.chatId) === normalizeId(source.chatId) && bound.message === source.message;
        if (!bound || trusted || sameMessage) bindButton(button, source);
        const active = buttonSources.get(button);
        if (!sameSource(active, source)) return false;
        setButtonState(button, savedItemFor(source.message, source.chatId));
        return true;
    };
    const currentOperation = (source, expected) => { const ctx = host.context?.() || {}; return sameSource(source, sourceFor(ctx, { getAttribute: name => name === 'mesid' ? source.mid : null })) && controller.isCurrent(expected); };
    const persistChat = async () => { if (typeof host.saveChatDebounced === 'function') return await host.saveChatDebounced(); if (typeof host.saveChat === 'function') return await host.saveChat(); };
    const persistMarker = async task => { try { if (task() === false) throw new Error('marker update rejected'); await persistChat(); return true; } catch (error) { host.warn?.('[SP anchor] 回复关联保存失败', error); return false; } };
    const refreshSavedKeys = async () => { try { const items = await repository.getAllItems(); savedItems = new Map(items.map(item => [normalizeId(item.id), item])); host.document?.querySelectorAll?.('#chat .mes .sp-anchor-btn').forEach(btn => refreshButton(btn.closest('.mes'), btn)); } catch (error) { host.warn?.('[SP anchor] 读取已收藏键失败', error); } return new Set(savedItems.keys()); };
    const placeFloorButton = (mes, button) => {
        const bar = mes.querySelector?.('.mes_buttons');
        if (bar) {
            const edit = bar.querySelector('.mes_edit');
            if (edit) {
                if (button.parentElement !== bar || button.nextElementSibling !== edit) bar.insertBefore(button, edit);
                return;
            }
            if (button.parentElement !== bar) bar.appendChild(button);
            return;
        }
        const extras = mes.querySelector?.('.extraMesButtons');
        if (extras) {
            if (button.parentElement !== extras) extras.appendChild(button);
            return;
        }
        const fallback = mes.querySelector?.('.mes_block') || mes;
        if (button.parentElement !== fallback) fallback.appendChild(button);
    };
    const createFloorButton = (doc, mes) => {
        const button = doc.createElement('div');
        button.className = 'mes_button sp-anchor-btn fa-solid fa-star';
        button.title = '收藏此楼';
        button.setAttribute('role', 'button');
        button.tabIndex = 0;
        const activate = event => { event.preventDefault(); event.stopPropagation(); api.onFloorButton(mes); };
        button.addEventListener('click', activate);
        button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') activate(event); });
        return button;
    };
    const unmountMessageButton = mes => { mes?.querySelectorAll?.('.sp-anchor-btn')?.forEach(el => el.remove()); };
    const mountMessageButton = (mes, { rebindMessageId = null } = {}) => {
        const doc = host.document;
        if (!doc || !mes) return null;
        if (mes.getAttribute?.('is_user') === 'true') { unmountMessageButton(mes); return null; }
        if (!host.enabled?.() || host.settings?.()?.anchorInlineBtn === false) { unmountMessageButton(mes); return null; }
        let button = mes.querySelector('.sp-anchor-btn');
        if (button && button.tagName === 'BUTTON') {
            button.remove();
            button = null;
        }
        if (!button) button = createFloorButton(doc, mes);
        else button.classList.add('mes_button', 'fa-solid', 'fa-star');
        placeFloorButton(mes, button);
        const trusted = rebindMessageId != null && Number.isInteger(Number(rebindMessageId)) && Number(mes.getAttribute('mesid')) === Number(rebindMessageId);
        refreshButton(mes, button, { trusted });
        return button;
    };
    const scanButtons = ({ rebindMessageId = null } = {}) => {
        const doc = host.document;
        if (!doc) return;
        if (!host.enabled?.() || host.settings?.()?.anchorInlineBtn === false) {
            doc.querySelectorAll('#chat .sp-anchor-btn').forEach(el => el.remove());
            return;
        }
        doc.querySelectorAll('#chat .mes[is_user="false"]').forEach(mes => mountMessageButton(mes, { rebindMessageId }));
    };
    const onFloorButton = async mes => {
        const ctx = host.context?.() || {}; const source = sourceFor(ctx, mes); const btn = mes?.querySelector?.('.sp-anchor-btn');
        if (!source) return host.toast?.('找不到楼层数据', null, true);
        const bound = btn ? buttonSources.get(btn) : null;
        if (bound && !sameSource(bound, source)) return host.toast?.('楼层已变化，请稍后重试', null, true);
        if (btn && !bound) bindButton(btn, source);
        if (busyReplies.has(source.message)) return;
        const expected = controller.snapshotRevision();
        busyReplies.add(source.message); btn?.classList.add('sp-anchor-busy');
        const savedItem = savedItemFor(source.message, source.chatId);
        if (savedItem) {
            try {
                await controller.delete(savedItem.id, expected);
            } catch (error) {
                if (currentOperation(source, expected)) host.toast?.(`取消收藏失败：${error?.message || '未知错误'}`, null, true);
                busyReplies.delete(source.message); btn?.classList.remove('sp-anchor-busy');
                return;
            }
            savedItems.delete(normalizeId(savedItem.id));
            if (currentOperation(source, expected)) {
                setButtonState(btn, false);
                const markerSaved = await persistMarker(() => clearReplyMarker(source.message, savedItem.id));
                host.toast?.(markerSaved ? '已取消收藏' : '已取消收藏，但标记保存失败', null, !markerSaved);
            }
            busyReplies.delete(source.message); btn?.classList.remove('sp-anchor-busy');
            return;
        }
        const textEl = mes?.querySelector?.('.mes_text');
        if (!textEl) { busyReplies.delete(source.message); btn?.classList.remove('sp-anchor-busy'); return host.toast?.('找不到楼层内容', null, true); }
        let saved;
        try {
            const raw = host.capture?.(textEl, Number.isFinite(+source.mid) ? +source.mid : null) ?? textEl.innerHTML;
            const sourceHtml = typeof raw === 'string' ? raw : raw?.html;
            const html = typeof raw === 'object' && raw?.html != null ? raw.html : sanitizeSnapshot(sourceHtml);
            const item = { id: globalThis.crypto?.randomUUID?.() || `a-${Date.now()}`, chatId: source.chatId, chatIdHash: ctx.chatMetadata?.chat_id_hash ?? null, chatName: host.chatName?.() || '', charName: mes.getAttribute('ch_name') || ctx.name2 || '角色', messageId: source.mid, floorIndex: Number.isFinite(+source.mid) ? +source.mid : null, textPreview: raw?.preview || makePreview(html), ts: Date.now(), tags: [] };
            saved = await controller.save(item, { html, preview: item.textPreview }, expected);
        } catch (error) {
            if (currentOperation(source, expected)) host.toast?.(`收藏失败：${error?.message || '未知错误'}`, null, true);
            busyReplies.delete(source.message); btn?.classList.remove('sp-anchor-busy');
            return;
        }
        savedItems.set(normalizeId(saved.id), saved);
        if (!currentOperation(source, expected)) { busyReplies.delete(source.message); btn?.classList.remove('sp-anchor-busy'); return; }
        setButtonState(btn, true);
        const markerSaved = await persistMarker(() => !!writeReplyMarker(source.message, saved.id));
        try { await repository.checkSize(); } catch (error) { host.warn?.('[SP anchor] 收藏空间检查失败', error); }
        host.toast?.(markerSaved ? '已收藏此楼' : '收藏已保存，但回复关联保存失败', null, !markerSaved);
        if (saved && host.selectMany) { try { const tags = await repository.getTags(); const customValue = '__new_tag__'; const result = await host.selectMany({ title: '给这条收藏加分组', body: '可多选已有分组，也可以新建一个。', choices: [...tags.map(tag => ({ value: tag.id, label: tag.name })), { value: customValue, label: '新建分组' }], initialValues: saved.tags || [], custom: { value: customValue, placeholder: '输入新分组名…', maxLength: 20, rows: 1 } }); if (result) { const selected = new Set((result.values || []).filter(id => id !== customValue)); if (result.values?.includes(customValue) && result.customValue) { const tag = await repository.addTag(result.customValue, 'slate'); if (tag?.id) selected.add(tag.id); } await repository.setItemTags(saved.id, [...selected]); } } catch (error) { host.toast?.('楼层已收藏，但标签未保存', null, true); } }
        busyReplies.delete(source.message); btn?.classList.remove('sp-anchor-busy');
    };
    const bindExcerpts = target => {
        const clickOff = ui.bind(target, 'click', async event => {
            if (event.target?.closest?.('input, textarea, .sp-excerpt-search-wrap')) return;
            const el = event.target?.closest?.('.sp-anchor-shelf-tab, .sp-anchor-clip, .sp-excerpt-save, .sp-excerpt-cancel, .sp-excerpt-send-space, .sp-excerpt-locate, .sp-excerpt-edit, .sp-excerpt-edit-save, .sp-excerpt-edit-cancel, .sp-excerpt-del');
            if (!el) return;
            if (el.matches('.sp-anchor-shelf-tab')) {
                ui.setShelf(el.dataset.shelf);
                controller.beginView(ui.route());
                return renderer.render();
            }
            if (el.matches('.sp-anchor-clip')) {
                const quote = clipText(readShadowSelection(target.querySelector('#sp-anchor-full-host')), QUOTE_MAX);
                if (!quote) return host.toast?.('先在快照里划选一段文字', null, true);
                ui.setComposer({ quote, note: '', snapshotId: ui.itemId() });
                return renderer.full(ui.itemId());
            }
            if (el.matches('.sp-excerpt-cancel')) {
                ui.setComposer(null);
                return ui.itemId() ? renderer.full(ui.itemId()) : renderer.render();
            }
            if (el.matches('.sp-excerpt-save')) {
                const note = clipText(target.querySelector('.sp-excerpt-composer .sp-excerpt-note-input')?.value, NOTE_MAX, { keepBreaks: true });
                const composer = ui.state().composer;
                if (!composer?.quote || !excerpts) return;
                const snap = await repository.getItem(composer.snapshotId || ui.itemId());
                try {
                    await excerpts.add({
                        quote: composer.quote, note, snapshotId: snap?.id || composer.snapshotId || null,
                        chatId: snap?.chatId ?? null, chatName: snap?.chatName || '', charName: snap?.charName || '',
                        floorIndex: snap?.floorIndex ?? null, tags: [...(snap?.tags || [])],
                    });
                } catch (error) {
                    return host.toast?.(`摘抄失败：${error?.message || '未知错误'}`, null, true);
                }
                ui.setComposer(null);
                host.toast?.('已收下这条摘抄');
                return renderer.full(ui.itemId());
            }
            const id = el.dataset.id;
            if (el.matches('.sp-excerpt-send-space')) {
                const item = await excerpts?.get?.(id);
                if (!item) return;
                if (typeof host.sendToSpace !== 'function') return host.toast?.('间还没接上', null, true);
                try {
                    const result = await host.sendToSpace(item);
                    if (result?.status === 'quoted') return host.toast?.('已做成引用，在间里接着写即可');
                    if (result?.status === 'busy') return host.toast?.('间正在说话，稍后再发', null, true);
                    if (result?.status === 'failed') return host.toast?.('发给间失败', null, true);
                } catch (error) {
                    return host.toast?.(`发给间失败：${error?.message || ''}`, null, true);
                }
                return;
            }
            if (el.matches('.sp-excerpt-locate')) {
                const item = await excerpts?.get?.(id);
                if (!item) return;
                if (item.snapshotId) {
                    const snap = await repository.getItem(item.snapshotId);
                    if (snap) {
                        ui.captureFrom();
                        ui.setShelf('snaps');
                        ui.setRoute({ level: 'full', itemId: snap.id, chatId: snap.chatId ?? null });
                        host.scrollToFloor?.(snap.chatId ?? item.chatId, snap.floorIndex ?? item.floorIndex);
                        return renderer.full(snap.id);
                    }
                }
                if (host.scrollToFloor?.(item.chatId, item.floorIndex)) return host.toast?.('快照不在了，已滚到当前聊天这一楼');
                return host.toast?.('对应快照已经不在，当前聊天里也找不到那一楼', null, true);
            }
            if (el.matches('.sp-excerpt-edit')) { ui.setExcerptEdit(id); return renderer.excerpts(); }
            if (el.matches('.sp-excerpt-edit-cancel')) { ui.setExcerptEdit(null); return renderer.excerpts(); }
            if (el.matches('.sp-excerpt-edit-save')) {
                const note = clipText(target.querySelector(`.sp-excerpt-note-input[data-id="${id}"]`)?.value, NOTE_MAX, { keepBreaks: true });
                try { await excerpts.update(id, { note }); }
                catch (error) { return host.toast?.(`保存失败：${error?.message || ''}`, null, true); }
                ui.setExcerptEdit(null);
                return renderer.excerpts();
            }
            if (el.matches('.sp-excerpt-del')) {
                if ((await host.confirm?.('删除这条摘抄？快照还在。')) === false) return;
                await excerpts.remove(id);
                return renderer.excerpts();
            }
        });
        const inputOff = ui.bind(target, 'input', event => {
            if (event.isComposing) return;
            const search = event.target?.closest?.('.sp-anchor-search');
            if (search) {
                event.stopPropagation();
                ui.setSearch(search.value, search.dataset.searchShelf === 'clips' ? 'clips' : 'snaps');
                filterSearchList(target, search.value);
                return;
            }
            if (event.target?.closest?.('.sp-anchor-item-note-input, .sp-anchor-full-note-input')) {
                event.stopPropagation();
                filterSearchList(target, target.querySelector?.('.sp-anchor-search')?.value || '');
            }
        });
        const composeOff = ui.bind(target, 'compositionend', event => {
            const el = event.target?.closest?.('.sp-anchor-search');
            if (!el) return;
            event.stopPropagation();
            ui.setSearch(el.value, el.dataset.searchShelf === 'clips' ? 'clips' : 'snaps');
            filterSearchList(target, el.value);
        });
        const saveNote = async event => {
            const el = event.target?.closest?.('.sp-anchor-item-note-input, .sp-anchor-full-note-input');
            if (!el) return;
            event.stopPropagation();
            const id = el.dataset.id || ui.itemId();
            if (!id) return;
            const note = clipText(el.value, SNAP_NOTE_MAX);
            if (el.value !== note) el.value = note;
            try { await repository.setItemNote(id, note); }
            catch (error) { return host.toast?.(`备注保存失败：${error?.message || ''}`, null, true); }
            const card = el.closest?.('[data-search]');
            if (card && note && !String(card.getAttribute('data-search') || '').toLowerCase().includes(note.toLowerCase())) {
                card.setAttribute('data-search', `${card.getAttribute('data-search') || ''}\n${note}`);
            }
        };
        const blurOff = ui.bind(target, 'focusout', saveNote);
        const noteKeyOff = ui.bind(target, 'keydown', event => {
            const el = event.target?.closest?.('.sp-anchor-item-note-input, .sp-anchor-full-note-input');
            if (!el) return;
            event.stopPropagation();
            if (event.key === 'Enter') {
                event.preventDefault();
                el.blur();
            }
        });
        const guard = event => {
            if (!event.target?.closest?.('.sp-excerpt-search-wrap, .sp-anchor-search, .sp-anchor-item-note-input, .sp-anchor-full-note-input')) return;
            event.stopPropagation();
        };
        const focusSearch = event => {
            const wrap = event.target?.closest?.('.sp-excerpt-search-wrap');
            if (!wrap) return;
            const input = wrap.querySelector?.('.sp-anchor-search');
            if (input && event.target !== input) input.focus();
        };
        const downOff = ui.bind(target, 'pointerdown', focusSearch);
        const mouseOff = ui.bind(target, 'mousedown', focusSearch);
        const keyOffSearch = ui.bind(target, 'keydown', guard);
        const keyUpOff = ui.bind(target, 'keyup', guard);
        return () => { clickOff?.(); inputOff?.(); composeOff?.(); blurOff?.(); noteKeyOff?.(); downOff?.(); mouseOff?.(); keyOffSearch?.(); keyUpOff?.(); };
    };
        const tagColor = color => ['rose', 'amber', 'olive', 'teal', 'indigo', 'plum', 'slate', 'clay'].includes(String(color)) ? String(color) : 'slate';
    const api = {
        addTag: (name, color) => controller.action(() => repository.addTag(name, tagColor(color))).then(result => result.value),
        deleteTag: id => controller.action(async () => { const n = await repository.deleteTag(id); await excerpts?.stripTag?.(id); return n; }).then(result => result.value),
        setItemTags: (id, tags) => controller.action(async () => {
            const value = await repository.setItemTags(id, tags);
            const related = (await excerpts?.list?.() || []).filter(item => item.snapshotId === id);
            for (const item of related) await excerpts.update(item.id, { tags });
            return value;
        }).then(result => result.value),
        renameTag: (id, name) => controller.action(() => repository.renameTag(id, name)).then(result => result.value),
        recolorTag: (id, color) => controller.action(() => repository.recolorTag(id, tagColor(color))).then(result => result.value),
        onFloorButton,
    };
    return {
        repository, controller, ui,
        init(meta) { if (!initialized) { initialized = true; controller.beginChat(meta); } return this; },
        refreshSavedKeys, scanButtons, mountMessageButton, unmountMessageButton, onFloorButton,
        addTag: (name, color) => api.addTag(name, color),
        renameTag: (id, name) => api.renameTag(id, name),
        recolorTag: (id, color) => api.recolorTag(id, color),
        deleteTag: id => api.deleteTag(id),
        setItemTags: (id, tags) => api.setItemTags(id, tags),
        setItemNote: (id, note) => controller.action(async () => repository.setItemNote(id, clipText(note, SNAP_NOTE_MAX))).then(result => result.value),
        renameChatId: (...args) => repository.renameChatId(...args),
        healChatByHash: (...args) => repository.healChatByHash(...args),
        adoptOrphans: (...args) => repository.adoptOrphans(...args),
        open(route) { ui.open(route); controller.beginView(route || ui.route()); return renderCurrent(() => renderer.render()); },
        openAtChat(chatId) { ui.setRoute({ level: 'items', chatId }); controller.beginView('items', chatId); return renderCurrent(() => renderer.render()); },
        close() { controller.invalidate(); fullscreen.clear(); ui.clearInteraction?.(); ui.close(); controller.beginView('chars'); },
        bind(...args) { return ui.bind(...args); },
        bindInteractionCapture(target) { const clickOff = ui.bind(target, 'click', event => { const el = event.target?.closest?.('.sp-anchor-tag-edit, .sp-anchor-ftag-chip, .sp-anchor-ftag-add, .sp-anchor-ftag-done, .sp-anchor-del, .sp-anchor-tagmgr-btn, .sp-tagmgr-swatch, .sp-tagmgr-del, .sp-tagmgr-del-yes, .sp-tagmgr-del-no, .sp-tagmgr-new-add'); if (el) ui.freezeInteraction?.(); if (el?.matches('.sp-tagmgr-swatch')) { event.stopImmediatePropagation(); el.closest('.sp-anchor-tagmgr-new') ? ui.setTagNewColor(el.dataset.color) : ui.setTagEditColor(el.dataset.color); return renderer.tags(); } if (el?.matches('.sp-anchor-tagmgr-btn')) { event.stopImmediatePropagation(); ui.setRoute({ level: 'tags', tagEditId: null, tagDeleteId: null }); return renderer.render(); } if (el?.matches('.sp-tagmgr-del')) { event.stopImmediatePropagation(); ui.setTagDelete(el.closest('[data-id]')?.dataset.id); return renderer.tags(); } if (el?.matches('.sp-tagmgr-del-no')) { event.stopImmediatePropagation(); ui.setTagDelete(null); return renderer.tags(); } if (el?.matches('.sp-tagmgr-del-yes')) { event.stopImmediatePropagation(); const id = el.closest('[data-id]')?.dataset.id; return api.deleteTag(id).then(() => { if (ui.state().filter === id) ui.setFilter(null); ui.setTagDelete(null); return renderer.tags(); }).catch(error => { host.toast?.(`删除标签失败：${error?.message || ''}`, null, true); return renderer.tags(); }); } if (el?.matches('.sp-tagmgr-new-add')) { event.stopImmediatePropagation(); const input = target.querySelector('.sp-tagmgr-new-name'); if (!input?.value?.trim()) return; return api.addTag(input.value.trim(), ui.state().tagNewColor).then(() => renderer.tags()); } }, true); const keyOff = ui.bind(target, 'keydown', event => { const input = event.target?.closest?.('.sp-tagmgr-new-name'); if (event.key !== 'Enter' || !input?.value?.trim()) return; event.preventDefault(); event.stopImmediatePropagation(); api.addTag(input.value.trim(), ui.state().tagNewColor).then(() => renderer.tags()); }, true); return () => { clickOff?.(); keyOff?.(); }; },
        bindUi(target) { const off = ui.bind(target, 'click', async event => { if (event.target?.closest?.('.sp-excerpt-search-wrap, .sp-anchor-search, .sp-anchor-item-note-input, .sp-anchor-full-note-input')) { event.stopPropagation(); return; } const el = event.target?.closest?.('[data-to], [data-back], [data-browse], .sp-anchor-group-card, .sp-anchor-tagmgr-btn, .sp-anchor-tag-edit, .sp-anchor-ftag-chip, .sp-anchor-ftag-add, .sp-anchor-ftag-done, .sp-anchor-filter-chip, .sp-anchor-char-card, .sp-anchor-chat-card, .sp-anchor-item-open, .sp-anchor-fullscreen, .sp-tagmgr-new-add, .sp-tagmgr-edit, .sp-tagmgr-save, .sp-tagmgr-cancel, .sp-tagmgr-swatch, .sp-tagmgr-del'); if (!el) return; const row = el.closest('[data-id]'); if (el.matches('[data-browse]')) { ui.setBrowse(el.dataset.browse); controller.beginView(ui.route()); return renderer.render(); } if (el.matches('.sp-anchor-group-card')) { ui.setGroup(el.dataset.group); return renderer.render(); } if (el.matches('.sp-anchor-tagmgr-btn')) { ui.setRoute('tags'); return renderer.render(); } if (el.matches('.sp-tagmgr-edit')) { ui.setTagEdit(row?.dataset.id, (await repository.getTags()).find(t => t.id === row?.dataset.id)?.color); return renderer.tags(); } if (el.matches('.sp-tagmgr-swatch')) { ui.setTagEditColor(el.dataset.color); return renderer.tags(); } if (el.matches('.sp-tagmgr-cancel')) { ui.setTagEdit(null); return renderer.tags(); } if (el.matches('.sp-tagmgr-save')) { const input = row?.querySelector('.sp-tagmgr-name-input'); await api.renameTag(row?.dataset.id, input?.value); await api.recolorTag(row?.dataset.id, ui.state().tagEditColor); ui.setTagEdit(null); return renderer.tags(); } if (el.matches('.sp-anchor-tag-edit')) { ui.setFullTagEdit(true); return renderer.full(ui.itemId()); } if (el.matches('.sp-anchor-ftag-chip')) { const item = await repository.getItem(ui.itemId()); const next = new Set(item?.tags || []); next.has(el.dataset.id) ? next.delete(el.dataset.id) : next.add(el.dataset.id); await api.setItemTags(ui.itemId(), [...next]); return renderer.full(ui.itemId()); } if (el.matches('.sp-anchor-ftag-add')) { const input = target.querySelector('.sp-anchor-ftag-name'); if (input?.value?.trim()) { const tag = await api.addTag(input.value.trim(), 'slate'); const item = await repository.getItem(ui.itemId()); await api.setItemTags(ui.itemId(), [...new Set([...(item?.tags || []), tag.id])]); return renderer.full(ui.itemId()); } } if (el.matches('.sp-anchor-ftag-done')) { ui.setFullTagEdit(false); return renderer.full(ui.itemId()); } if (el.matches('.sp-tagmgr-new-add')) { const input = target.querySelector('.sp-tagmgr-new-name'); if (input?.value?.trim()) { await api.addTag(input.value.trim(), 'slate'); return renderer.tags(); } } if (el.matches('.sp-tagmgr-del')) { if (row && (await host.confirm?.(`删除标签「${row.textContent.trim()}」？`)) !== false) { await api.deleteTag(row.dataset.id); return renderer.tags(); } } if (el.matches('.sp-anchor-filter-chip')) { ui.setFilter(el.dataset.id); return renderer.render(); } if (el.matches('.sp-anchor-char-card')) { ui.setRoute({ level: 'items', charName: el.dataset.char, chatId: null }); return renderer.render(); } if (el.matches('.sp-anchor-chat-card')) { ui.setRoute('items', el.dataset.chatid); return renderer.render(); } if (el.matches('.sp-anchor-item-open')) { ui.captureFrom(); ui.setRoute('full', el.closest('[data-id]')?.dataset.id); return renderer.full(el.closest('[data-id]')?.dataset.id); } if (el.matches('.sp-anchor-fullscreen')) return fullscreen.toggle(); if (el.matches('[data-back]')) { ui.backFrom(); controller.beginView(ui.route()); return renderer.render(); } if (el.dataset.to) { ui.setRoute(el.dataset.to, el.dataset.chatid || null); return renderer.render(); } }); const keyOff = ui.bind(target, 'keydown', async event => { if (event.target?.closest?.('.sp-anchor-search, .sp-excerpt-search-wrap, .sp-anchor-item-note-input, .sp-anchor-full-note-input')) return; if (event.key !== 'Enter') return; const input = event.target?.closest?.('.sp-tagmgr-new-name, .sp-anchor-ftag-name, .sp-tagmgr-name-input'); if (!input?.value?.trim()) return; event.preventDefault(); if (input.matches('.sp-tagmgr-name-input')) { const row = input.closest('[data-id]'); await api.renameTag(row?.dataset.id, input.value); await api.recolorTag(row?.dataset.id, ui.state().tagEditColor); ui.setTagEdit(null); return renderer.tags(); } const tag = await api.addTag(input.value.trim(), 'slate'); if (input.matches('.sp-anchor-ftag-name')) { const item = await repository.getItem(ui.itemId()); await api.setItemTags(ui.itemId(), [...new Set([...(item?.tags || []), tag.id])]); return renderer.full(ui.itemId()); } return renderer.tags(); }); return () => { off?.(); keyOff?.(); fullscreen.destroy(); }; },
        bindGestures(target) { gestureCleanup?.(); const offStart = ui.bind(target, 'mousedown', event => { const el = event.target?.closest?.('.sp-anchor-fs-resize, .sp-anchor-fs-on .sp-anchor-head'); if (!el || (globalThis.innerWidth || 0) <= 640) return; if (el.matches('.sp-anchor-fs-on .sp-anchor-head') && event.target?.closest?.('button, .sp-icon-btn, .sp-anchor-back')) return; fullscreen.beginGesture(el.matches('.sp-anchor-fs-resize') ? 'resize' : 'move', event); }); const doc = host.document || globalThis.document; const move = event => fullscreen.moveGesture(event); const end = () => fullscreen.endGesture(); doc?.addEventListener?.('mousemove', move); doc?.addEventListener?.('mouseup', end); gestureCleanup = () => { offStart?.(); doc?.removeEventListener?.('mousemove', move); doc?.removeEventListener?.('mouseup', end); fullscreen.endGesture(); gestureCleanup = null; }; return gestureCleanup; },
        bindDelete(target) { return ui.bind(target, 'click', async event => { const el = event.target?.closest?.('.sp-anchor-del'); if (!el) return; if ((await host.confirm?.('删除这条收藏？')) === false) return; const itemId = ui.itemId(); await controller.delete(itemId, controller.snapshotRevision()); fullscreen.clear(); await refreshSavedKeys(); ui.backFrom(); return renderCurrent(() => renderer.render()); }); },
        bindExcerpts,
        renderer,
        onChatChanged(meta = {}) { fullscreen.clear(); controller.beginChat(meta); const revision = controller.snapshotRevision(); if (meta.enabled === false || host.enabled?.() === false) { this.close(); return Promise.resolve(0); } const ctx = host.context?.() || {}; const currentId = meta.chatId ?? ctx.chatId; const hash = meta.chatIdHash ?? ctx.chatMetadata?.chat_id_hash; const name = meta.chatName || host.chatName?.() || currentId; const charName = meta.charName || ctx.name2 || ctx.character || ''; return (async () => { if (currentId == null) return 0; await repository.healChatByHash?.(currentId, name, hash); if (!controller.isCurrent(revision)) return 0; const existing = await ports?.listCharacterChatIds?.(); if (!controller.isCurrent(revision) || (host.context?.()?.chatId ?? currentId) !== currentId || !existing) return 0; return repository.adoptOrphans?.(charName, existing, currentId, name, hash) || 0; })().catch(error => { host.warn?.('[SP anchor] 切 chat 自愈失败', error); return 0; }); },
        onChatRenamed(meta) { controller.beginChat(meta); },
        onCharacterRendered(meta = {}) { scanButtons({ rebindMessageId: meta.messageId }); },
        onChatDomChanged() { scanButtons(); },
        onThemeChanged(theme) { const next = theme || currentTheme; const same = next === currentTheme; currentTheme = next; scanButtons(); if (!root?.isConnected) return; if (root.querySelector?.('.sp-anchor-search:focus, .sp-anchor-item-note-input:focus, .sp-anchor-full-note-input:focus')) return applySearchFilter(); if (same) return; return renderer.render(); },
        storageUsage: async () => {
            const usage = await repository.checkSize();
            const clipCount = await excerpts?.count?.() || 0;
            const clipBytes = await excerpts?.estimateBytes?.() || 0;
            return { ...usage, bytes: (Number(usage.bytes) || 0) + clipBytes, count: (await repository.countItems()) + clipCount, clipCount, snapCount: await repository.countItems(), bytesText: repository.formatBytes((Number(usage.bytes) || 0) + clipBytes) };
        },
        formatBytes: bytes => repository.formatBytes(bytes),
        clearAll: async () => { const items = await repository.getAllItems(); for (const item of items) await repository.deleteItem(item.id); await excerpts?.clearAll?.(); await refreshSavedKeys(); },
        destroy() { controller.invalidate(); clipOff?.(); gestureCleanup?.(); fullscreen.destroy(); ui.close(); ui.clearInteraction?.(); ui.destroy(); host.document?.querySelectorAll?.('#chat .sp-anchor-btn').forEach(el => el.remove()); initialized = false; },
    };
}
