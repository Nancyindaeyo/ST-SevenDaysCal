import { renderTheaterPieceHtml } from './render.js';
import { buildTheaterSnapshot } from './snapshot.js';
import { selectTheaterView, theaterPieceOpen } from './view.js';
import { classifyGenerationError } from '../../api/diagnostics.js';
import { resolveTheaterContinueSource } from './identity.js';

// 棱 UI 只编排注入的宿主能力；它不读取 SillyTavern 全局对象，也不拥有生成状态。
export function createTheaterUi({ repository, templates, resolveRegen, draftCap = 10, exporter, feature, host = {}, pickPoolEntry } = {}) {
    const injectedCapture = host.captureTarget || (chatId => ({ chatId, isCurrent: () => true }));
    host.captureTarget ||= injectedCapture;
    const esc = host.escapeHtml || (value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])));
    const attr = host.escapeAttr || esc;
    const state = { current: null, templates: [], source: null, retry: null, lastRandom: null, bound: false, mountRoot: null, fsEsc: null, imageCleanup: null, settingsRoots: [], generationSeq: 0, templateSeq: 0, abortPending: false, batchId: '', solo: false, poolNames: [], poolQuery: '' };
    const dataOf = (el, key) => {
        const node = el?.closest?.(`[data-${key}]`) || el;
        const attr = node?.getAttribute?.(`data-${key}`);
        if (attr != null && attr !== '') return attr;
        return host.data?.(el, key);
    };
    const currentChat = () => host.getChatId?.() ?? '';
    const isCurrent = target => target?.isCurrent ? target.isCurrent() : true;
    const body = html => host.setBody?.(html);
    const renderCard = piece => `<div class="sp-theater-card" data-id="${attr(piece.id)}"><div class="sp-theater-card-head"><span class="sp-theater-card-title">${esc(piece.title || '(未命名)')}</span><span class="sp-theater-card-time">${esc(piece.ts ? new Date(piece.ts).toLocaleString('zh-CN', { hour12: false }) : '')}</span></div><div class="sp-theater-card-actions"><label class="sp-theater-like"><input type="checkbox" class="sp-theater-like-cb" data-id="${attr(piece.id)}" data-layer="draft"${piece.liked ? ' checked' : ''}><span>喜欢</span></label><button class="sp-theater-view" data-id="${attr(piece.id)}">查看</button><button class="sp-theater-continue" data-id="${attr(piece.id)}">续写</button><button class="sp-theater-collect" data-id="${attr(piece.id)}">收藏</button><button class="sp-theater-del-draft" data-id="${attr(piece.id)}">删除</button></div></div>`;
    const renderTemplateButtons = templates => templates.length ? templates.map(t => `<button type="button" class="sp-theater-tpl-pick" data-uid="${attr(t.uid)}">${esc(t.title)}</button>`).join('') : '<div class="sp-theater-list-empty">暂无模板，可在设置 · 棱里新增</div>';
    const renderPoolRows = (names, selected, query) => {
        if (!names.length) return '<div class="sp-theater-list-empty">当前没有任何世界书。把小回 / 极光 / 小兔导入酒馆后再来勾选，不要绑到角色卡。</div>';
        const q = String(query || '').trim().toLowerCase();
        const rows = names.filter(name => !q || name.toLowerCase().includes(q)).map(name => {
            const on = selected.has(name);
            return `<label class="sp-wi-exclude-row${on ? ' sp-wi-exclude-on' : ''}" data-name="${attr(name)}"><input type="checkbox" class="sp-theater-pool-cb" data-name="${attr(name)}"${on ? ' checked' : ''}><span class="sp-wi-exclude-name">${esc(name)}</span></label>`;
        });
        return rows.length ? rows.join('') : '<div class="sp-theater-list-empty">没有匹配的世界书</div>';
    };
    const refreshPoolList = async () => {
        if (!host.setPanelPoolHtml) return [];
        let names = [];
        try { names = await host.listWorldNames?.() || []; } catch { names = []; }
        state.poolNames = [...new Set((Array.isArray(names) ? names : []).filter(name => typeof name === 'string' && name))].sort((a, b) => a.localeCompare(b, 'zh'));
        const selected = new Set(host.getPoolBooks?.() || []);
        host.setPanelPoolCount?.(selected.size);
        const query = String(host.val?.('#sp-theater-pool-panel-search') || state.poolQuery || '');
        state.poolQuery = query;
        host.setPanelPoolHtml?.(renderPoolRows(state.poolNames, selected, query));
        return state.poolNames;
    };
    const findPiece = id => (repository.loadDrafts(currentChat()) || []).find(piece => String(piece.id) === String(id));
    const collectPiece = async piece => {
        if (!piece) return;
        if (!host.saveSnapshot) return host.toast?.('坐标还没就绪', null, true);
        const ctx = host.snapshotContext?.() || {};
        const item = buildTheaterSnapshot(piece, { ...ctx, title: piece.title }, { htmlOptions: host.htmlOptions?.() || {}, id: piece.id });
        try {
            const saved = await host.saveSnapshot(item);
            if (saved) host.toast?.('已收藏到坐标');
        } catch (error) {
            host.toast?.(`收藏失败：${error?.message || '未知错误'}`, null, true);
        }
    };
    const renderManager = templates => {
        const count = (templates || []).length;
        const open = Boolean(host.getManagerOpen?.());
        host.setManagerHtml?.(`
            <details class="sp-theater-tpl-library"${open ? ' open' : ''}>
                <summary class="sp-theater-tpl-library-head">
                    <i class="fa-solid fa-chevron-right sp-theater-tpl-library-chevron"></i>
                    <span>模板库</span>
                    <span class="sp-theater-tpl-library-count">${count}</span>
                </summary>
                <div class="sp-theater-tpl-library-body">
                    <div class="sp-theater-tpl-add-row">
                        <input type="text" id="sp-theater-tpl-new-title" class="sp-input" placeholder="新模板标题">
                        <textarea id="sp-theater-tpl-new-text" class="sp-input" placeholder="新模板内容"></textarea>
                        <button class="sp-btn sp-btn-primary" id="sp-theater-tpl-add">+ 新增模板</button>
                    </div>
                    <div class="sp-theater-tpl-import-row">
                        <input type="file" id="sp-theater-tpl-import-file" accept=".txt,text/plain" hidden>
                        <button class="sp-btn" id="sp-theater-tpl-import">批量导入 txt</button>
                        <span class="sp-theater-tpl-import-hint">每条以 <code>title：</code> 起头，正文接 <code>content：</code>（可跨多行）</span>
                    </div>
                    <div class="sp-theater-tpl-manage-hint">查看 / 修改 / 删除模板请到世界书 <code>构画-棱-小剧场模板</code></div>
                </div>
            </details>
        `);
    };
    const renderPieceCard = (piece, open) => {
        const safeHtml = renderTheaterPieceHtml(piece, host.htmlOptions?.() || {});
        return `<details class="sp-theater-piece"${open ? ' open' : ''} data-id="${attr(piece.id)}"><summary class="sp-theater-piece-summary"><span class="sp-theater-piece-title">${esc(piece.title || piece.formName || '(未命名)')}</span><label class="sp-theater-like" onclick="event.stopPropagation()"><input type="checkbox" class="sp-theater-like-cb" data-id="${attr(piece.id)}" data-layer="draft"${piece.liked ? ' checked' : ''}><span>喜欢</span></label></summary><div class="sp-theater-result-inner">${safeHtml}</div></details>`;
    };
    const render = () => {
        const drafts = (repository.loadDrafts(currentChat()) || []).slice().reverse();
        const selected = selectTheaterView(drafts, { current: state.current, batchId: state.batchId, solo: state.solo });
        const piece = state.current = selected.piece;
        const batch = selected.batch;
        const likedCount = drafts.filter(item => item.liked).length;
        const result = batch.length ? `<div class="sp-theater-batch">${batch.map(item => renderPieceCard(item, theaterPieceOpen(item, piece))).join('')}</div>` : '<div class="sp-empty sp-theater-result-empty"><i class="fa-solid fa-masks-theater"></i><p>可留空抽 1～3 条。随机模板会从勾选世界书抽一条内容填进框；框里有字时只写这一条。</p></div>';
        const source = piece?.templateSource?.input ? `<div class="sp-theater-source-wrap"><button type="button" class="sp-theater-source-toggle" aria-expanded="false" title="查看本次实际使用内容"><i class="fa-solid fa-file-lines"></i><span>配方 · ${esc(piece.templateSource.title || '(无标题)')}</span><i class="fa-solid fa-chevron-down sp-theater-source-chevron"></i></button><div id="sp-theater-source-detail" class="sp-theater-source-detail" style="display:none"><div class="sp-theater-source-caption">本次实际使用内容</div><pre>${esc(piece.templateSource.input)}</pre></div></div>` : '';
        const op = piece ? `<div class="sp-theater-opbar"><button class="sp-btn sp-theater-regen">重新生成</button><button class="sp-btn sp-theater-continue" data-id="${attr(piece.id)}">续写</button><input type="text" id="sp-theater-title" class="sp-input" placeholder="标题（可选）" value="${attr(piece.title || '')}"><button class="sp-btn sp-btn-primary sp-theater-save">收藏</button></div>` : '';
        const exportBar = `<div class="sp-theater-export-row"><span class="sp-cfg-hint">已喜欢 ${likedCount} 条</span><button type="button" class="sp-btn sp-theater-export"${likedCount ? '' : ' disabled'}>导出已选为新世界书</button></div>`;
        const resultBlock = piece ? `<div class="sp-theater-result-wrap"><button class="sp-theater-fullscreen-btn" type="button" title="全屏浏览小剧场"><i class="fa-solid fa-expand"></i></button><button class="sp-theater-fold-toggle" type="button" style="display:none"><i class="fa-solid fa-chevron-down"></i><span class="sp-theater-fold-label">展开全文</span></button><div class="sp-theater-result sp-theater-result-collapsible" id="sp-theater-result">${result}</div></div>` : `<div class="sp-theater-result" id="sp-theater-result">${result}</div>`;
        const selectedBooks = new Set(host.getPoolBooks?.() || []);
        const poolOpen = host.isPanelPoolOpen?.() !== false;
        state.poolQuery = String(host.val?.('#sp-theater-pool-panel-search') || state.poolQuery || '');
        const poolBlock = `<details class="sp-theater-tpl-picker" id="sp-theater-pool-panel"${poolOpen ? ' open' : ''}><summary class="sp-theater-tpl-picker-summary"><i class="fa-solid fa-chevron-right sp-theater-tpl-picker-chevron"></i><span>抽取用世界书</span><span class="sp-theater-tpl-library-count" id="sp-theater-pool-panel-count">${selectedBooks.size}</span></summary><div class="sp-theater-tpl-picker-body sp-theater-pool-panel-body"><p class="sp-cfg-hint">勾选小回 / 极光 / 小兔。空框生成会跨书抽 N 条；随机模板只抽一条内容填进框，框里有字就只写这一条。</p><input type="search" id="sp-theater-pool-panel-search" class="sp-input sp-wi-exclude-search" placeholder="查找世界书…" value="${attr(state.poolQuery)}"><div id="sp-theater-pool-panel-list" class="sp-wi-exclude-list"><div class="sp-theater-list-empty">加载中…</div></div></div></details>`;
        body(`<div class="sp-theater-input-area">${poolBlock}<details class="sp-theater-tpl-picker" id="sp-theater-tpl-picker"><summary class="sp-theater-tpl-picker-summary"><i class="fa-solid fa-chevron-right sp-theater-tpl-picker-chevron"></i><span>选择手写模板起草（可选）</span></summary><div class="sp-theater-tpl-picker-body" id="sp-theater-tpl-picker-list"><div class="sp-theater-list-empty">加载中…</div></div></details><textarea id="sp-theater-input" class="sp-input sp-theater-textarea" placeholder="可留空抽 N 条。随机模板会填入勾选世界书的一条内容；框里有字时只生成这一条。">${esc(piece?.request || '')}</textarea><div class="sp-theater-btn-row"><button class="sp-btn sp-theater-random" title="从勾选世界书随机抽一条内容填进框，再按可换一条"><i class="fa-solid fa-shuffle"></i> 随机模板</button><button class="sp-btn sp-btn-primary sp-theater-generate">生成番外</button></div></div><hr class="sp-theater-divider">${resultBlock}${source}${op}${exportBar}<hr class="sp-theater-divider"><div class="sp-theater-lists"><details class="sp-theater-list-group" open><summary>草稿（最多 ${draftCap} 条，新挤旧；要留下就收藏到坐标）</summary><div class="sp-theater-list">${drafts.length ? drafts.map(p => renderCard(p)).join('') : '<div class="sp-theater-list-empty">暂无草稿</div>'}</div></details></div>`);
        measureFold();
        void refreshTemplates();
        void refreshPoolList();
    };
    const refreshTemplates = async () => {
        const seq = ++state.templateSeq;
        let next;
        try { next = await templates.list(); } catch { next = []; }
        if (seq !== state.templateSeq) return state.templates;
        state.templates = Array.isArray(next) ? next : [];
        try { renderManager(state.templates); } catch { /* 宿主设置区尚未挂载时不阻断面板模板列表 */ }
        try { host.setTemplateListHtml?.(renderTemplateButtons(state.templates)); } catch { /* 主面板尚未挂载时不阻断设置区模板管理器 */ }
        return state.templates;
    };
    const bindSettings = root => {
        const rootKey = root?.[0] || root;
        if (!rootKey || state.settingsRoots.some(entry => entry.key === rootKey)) return;
        state.settingsRoots.push({ key: rootKey, root });
        root.on('change.sp-theater-ui', '#sp-theater-style', function () { host.setStylePrompt?.(host.val?.('#sp-theater-style') || ''); });
        root.on('click.sp-theater-ui', '#sp-theater-tpl-add', async function () { const title = String(host.val?.('#sp-theater-tpl-new-title') || '').trim(); const text = String(host.val?.('#sp-theater-tpl-new-text') || '').trim(); if (!title && !text) return host.toast?.('模板标题或内容不能都为空', null, true); try { await templates.add(title || '(无标题)', text); host.val?.('#sp-theater-tpl-new-title', ''); host.val?.('#sp-theater-tpl-new-text', ''); await refreshTemplates(); host.toast?.('模板已新增'); } catch (error) { host.toast?.('新增失败：' + (error?.message || error), null, true); } });
        root.on('click.sp-theater-ui', '#sp-theater-tpl-import', () => host.triggerFileInput?.());
        root.on('change.sp-theater-ui', '#sp-theater-tpl-import-file', async function () { const file = this.files?.[0]; this.value = ''; if (!file) return; try { const items = templates.parse(await file.text()); if (!items.length) return host.toast?.('未解析到模板，请检查 txt 格式（需 title：起头）', null, true); const count = await templates.addBatch(items); await refreshTemplates(); host.toast?.(`已导入 ${count} 条模板`); } catch (error) { host.toast?.('导入失败：' + (error?.message || error), null, true); } });
    };
    const generate = async (input, options = {}) => {
        const inputSnapshot = String(input || '').trim();
        const requestSeq = ++state.generationSeq;
        const requestChatId = currentChat();
        const continueFrom = options.continueFrom || null;
        state.retry = null;
        state.abortPending = false;
        const selectedSource = continueFrom ? null : (state.source ? { ...state.source } : null);
        const requestSource = continueFrom
            ? (continueFrom.templateSource || null)
            : (selectedSource ? { ...selectedSource, input: inputSnapshot || selectedSource.input } : null);
        body(host.loading?.(continueFrom ? '正在续写' : '正在折射', 'sp-abort-theater') || '');
        const result = await feature.generate(inputSnapshot, { templateSource: requestSource, continueFrom });
        // A cancelled request may settle after a new owner starts. Only the latest
        // UI request may restore/render; otherwise A would overwrite B's loading UI.
        if (requestSeq !== state.generationSeq) return result;
        state.abortPending = false;
        if (result?.status === 'updated') {
            if (currentChat() !== requestChatId) return result;
            state.current = result.piece || state.current;
            state.batchId = result.piece?.batchId || result.pieces?.[0]?.batchId || '';
            state.solo = Boolean(continueFrom);
            if (state.source?.uid === selectedSource?.uid && state.source?.input === selectedSource?.input) state.source = null;
            if (host.isOpen?.()) {
                render();
                if (result.persistFailed) host.toast?.('棱已生成。本机草稿未写入，先看上面的正文；刷新前请先收藏到坐标', null, true);
                else if (host.notifyEnabled?.()) host.toast?.(continueFrom ? '已续写' : (result.pieces?.length > 1 ? `棱已生成 ${result.pieces.length} 条` : '棱已生成'));
            }
            else host.closedSuccess?.(result.pieces?.length || 1);
        } else if (result?.status === 'failed') {
            if (currentChat() !== requestChatId) return result;
            const retryable = classifyGenerationError(result.error) !== 'config-missing';
            state.retry = retryable ? { chatId: requestChatId, input: inputSnapshot, templateSource: requestSource, continueFrom } : null;
            state.source = null;
            if (host.isOpen?.()) host.showError?.(result.error, { retryable }); else host.closedFailure?.();
        } else if (result?.status === 'cancelled' || result?.status === 'stale') {
            // Only an explicit user abort in the same still-open chat restores the
            // panel. CHAT_CHANGED/plugin shutdown/stale owners stay silent.
            if (result?.reason === 'aborted' && currentChat() === requestChatId && host.isOpen?.()) render();
        }
        return result;
    };
    const continueSourceOf = piece => resolveTheaterContinueSource(piece, findPiece);
    const askContinue = async piece => {
        if (!piece || feature.busy) return;
        const source = continueSourceOf(piece);
        if (!source) return host.toast?.('这篇没有可续的正文', null, true);
        if (!host.promptTextarea) return host.toast?.('续写对话框还没就绪', null, true);
        const value = await host.promptTextarea({
            title: '续写这篇小剧场',
            body: '可留空。AI 会接着这篇往下写，不会重写前文。',
            placeholder: '接下来想看什么（可选）',
            confirmText: '开始续写',
            cancelText: '取消',
            rows: 4,
            maxLength: 2000,
        });
        if (value == null) return;
        return generate(String(value).trim(), { continueFrom: source });
    };
    const parentForRegen = piece => {
        if (!piece?.continuedFrom && !piece?.continueSource) return null;
        const live = piece.continuedFrom ? findPiece(piece.continuedFrom) : null;
        if (live) return continueSourceOf(live);
        if (piece.continueSource?.raw) {
            return {
                id: String(piece.continuedFrom || ''),
                title: String(piece.continueSource.title || ''),
                raw: String(piece.continueSource.raw || ''),
                templateSource: piece.continueSource.templateSource || piece.templateSource,
            };
        }
        return null;
    };
    const abortCurrent = () => {
        if (state.abortPending || !feature.busy) return false;
        state.abortPending = true;
        host.setAbortPending?.();
        const aborted = feature.abort('aborted');
        if (!aborted) state.abortPending = false;
        return aborted;
    };
    const retry = () => {
        const capsule = state.retry;
        if (!capsule || feature.busy || currentChat() !== capsule.chatId) return false;
        state.source = capsule.continueFrom ? null : (capsule.templateSource ? { ...capsule.templateSource } : null);
        if (capsule.continueFrom) {
            void generate(capsule.input, { continueFrom: capsule.continueFrom });
            return true;
        }
        host.val?.('#sp-theater-input', capsule.input);
        void generate(capsule.input);
        return true;
    };
    const bind = root => {
        if (state.bound) return; state.bound = true; state.mountRoot = root;
        root.on('click.sp-theater-ui', '.sp-theater-tpl-pick', function () { const tpl = state.templates.find(item => String(item.uid) === String(dataOf(this, 'uid'))); if (!tpl) return; host.val?.('#sp-theater-input', tpl.text); state.source = { uid: tpl.uid, title: tpl.title, input: tpl.text }; host.closePicker?.(); host.focus?.('#sp-theater-input'); });
        root.on('change.sp-theater-ui', '#sp-theater-pool-panel-list .sp-theater-pool-cb', function () {
            const name = String(dataOf(this, 'name') || '');
            if (!name) return;
            const books = new Set(host.getPoolBooks?.() || []);
            if (this.checked) books.add(name); else books.delete(name);
            host.setPoolBooks?.([...books]);
            this.closest('.sp-wi-exclude-row')?.classList.toggle('sp-wi-exclude-on', this.checked);
            host.setPanelPoolCount?.(books.size);
            host.syncSettingsPoolList?.();
        });
        root.on('input.sp-theater-ui', '#sp-theater-pool-panel-search', function () {
            state.poolQuery = String(this.value || '');
            host.setPanelPoolHtml?.(renderPoolRows(state.poolNames, new Set(host.getPoolBooks?.() || []), state.poolQuery));
        });
        root.on('click.sp-theater-ui', '.sp-theater-generate', function () { if (!feature.busy) generate(host.val?.('#sp-theater-input') || ''); });
        root.on('click.sp-theater-ui', '.sp-theater-random', async function () {
            if (feature.busy) return;
            const books = host.getPoolBooks?.() || [];
            if (!books.length) return host.toast?.('先勾选抽取用世界书', null, true);
            let pick = null;
            try { pick = await pickPoolEntry?.(state.lastRandom); } catch { pick = null; }
            const text = String(pick?.content || '').trim();
            if (!text) return host.toast?.('勾选的书里没有可抽的条目内容', null, true);
            state.lastRandom = `${pick.bookName || ''}:${pick.uid ?? ''}`;
            state.source = { uid: pick.uid, title: pick.title, input: text, bookName: pick.bookName || '' };
            host.val?.('#sp-theater-input', text);
            host.closePicker?.();
            host.toast?.(`已填入「${pick.title || '无标题'}」，再按可换一条。框里有内容时只生成这一条`);
        });
        root.on('click.sp-theater-ui', '.sp-theater-view', function () {
            const piece = findPiece(dataOf(this, 'id'));
            if (!piece) return;
            state.current = piece;
            state.solo = true;
            state.batchId = '';
            render();
            host.scrollTop?.();
        });
        root.on('click.sp-theater-ui', '.sp-theater-del-draft', async function () {
            const target = host.captureTarget?.(currentChat());
            const id = dataOf(this, 'id');
            const piece = findPiece(id);
            const baseline = repository.draftBaseline?.(target?.chatId, id);
            const ok = await host.confirm?.({
                title: '删除草稿',
                body: `确定删除「${piece?.title || piece?.formName || '未命名'}」这条小剧场草稿吗？此操作不可撤销。`,
                confirmText: '删除',
                cancelText: '取消',
            });
            if (!ok || !isCurrent(target)) return;
            if (String(state.current?.id) === String(id)) { state.current = null; state.solo = false; state.batchId = ''; }
            const result = repository.deleteDraft(target.chatId, id, baseline);
            if (result?.ok && isCurrent(target)) render();
            else if (result?.conflict && isCurrent(target)) host.toast?.('草稿已变化，请重新确认', null, true);
        });
        root.on('click.sp-theater-ui', '.sp-theater-collect', async function () { const piece = findPiece(dataOf(this, 'id')); if (piece) await collectPiece(piece); });
        root.on('click.sp-theater-ui', '.sp-theater-continue', function () {
            if (feature.busy) return;
            const piece = findPiece(dataOf(this, 'id')) || state.current;
            void askContinue(piece);
        });
        root.on('click.sp-theater-ui', '.sp-theater-save', async function () {
            if (!state.current) return;
            const target = host.captureTarget?.(currentChat());
            const title = String(host.val?.('#sp-theater-title') || '').trim();
            const piece = { ...state.current, title };
            const draftBaseline = repository.draftBaseline?.(target.chatId, piece.id);
            const draftResult = repository.updateDraft?.(target.chatId, piece.id, { title }, draftBaseline);
            if (draftResult?.ok === false) {
                if (isCurrent(target)) host.toast?.(draftResult.conflict ? '草稿已变化，请重试' : '收藏失败，请重试', null, true);
                return;
            }
            if (draftResult?.ok) state.current = piece;
            await collectPiece(piece);
        });
        // resolveTheaterRegen(state.current, textarea) is supplied by the feature boundary.
        root.on('click.sp-theater-ui', '.sp-theater-regen', function () {
            if (feature.busy || !state.current) return;
            const parent = parentForRegen(state.current);
            if (parent) {
                void generate(state.current.request || '', { continueFrom: parent });
                return;
            }
            const regen = resolveRegen(state.current, host.val?.('#sp-theater-input') || '');
            state.source = regen.templateSource;
            host.val?.('#sp-theater-input', regen.input);
            generate(regen.input);
        });
        root.on('change.sp-theater-ui', '.sp-theater-like-cb', function () {
            const id = dataOf(this, 'id'); const liked = !!this.checked;
            const target = host.captureTarget?.(currentChat());
            const baseline = repository.draftBaseline?.(currentChat(), id);
            const result = repository.updateDraft?.(currentChat(), id, { liked }, baseline);
            if (result?.ok && isCurrent(target)) {
                if (String(state.current?.id) === String(id)) state.current = { ...state.current, liked };
                render();
            } else if (result?.conflict && isCurrent(target)) host.toast?.('草稿已变化，请重新勾选', null, true);
        });
        root.on('click.sp-theater-ui', '.sp-theater-export', async function () {
            if (!exporter?.export) return host.toast?.('导出不可用', null, true);
            const drafts = repository.loadDrafts(currentChat()) || [];
            const liked = drafts.filter(piece => piece.liked);
            if (!liked.length) return host.toast?.('先勾选喜欢的条目', null, true);
            try {
                const result = await exporter.export(liked);
                if (result?.ok) host.toast?.(`已导出 ${result.count} 条到「${result.bookName}」`);
                else host.toast?.(result?.reason === 'empty' ? '没有可导出的喜欢条目' : '导出失败', null, true);
            } catch (error) { host.toast?.('导出失败：' + (error?.message || error), null, true); }
        });
        root.on('click.sp-theater-ui', '.sp-theater-retry', retry);
        root.on('click.sp-theater-ui', '.sp-theater-back', () => { state.retry = null; render(); });
        root.on('click.sp-theater-ui', '.sp-theater-source-toggle', () => toggleSource());
        root.on('click.sp-theater-ui', '.sp-theater-fullscreen-btn', () => toggleFullscreen());
        root.on('click.sp-theater-ui', '.sp-theater-fold-toggle', () => toggleFold());
        root.on('click.sp-theater-ui', '#sp-abort-theater', abortCurrent);
    };
    const toggleSource = () => {
        const open = !host.isSourceOpen?.();
        host.setSourceVisible?.(open);
        host.setSourceExpanded?.(open);
        host.setSourceChevron?.(open ? 'fa-solid fa-chevron-up sp-theater-source-chevron' : 'fa-solid fa-chevron-down sp-theater-source-chevron');
    };
    const setFoldControl = collapsed => host.setFoldControl?.(
        collapsed ? '展开全文' : '收起',
        collapsed ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up',
    );
    const measureFold = () => {
        if (!host.isResultFoldable?.()) { host.setFoldVisible?.(false); return; }
        const measure = () => {
            // 图片可在进入全屏后才 load；这时不能让迟到复测把“强制展开”的全屏结果重新折回去。
            if (host.isFullscreen?.()) { host.setResultCollapsed?.(false); return; }
            if ((host.getResultScrollHeight?.() || 0) > 400) {
                host.setResultCollapsed?.(true);
                host.setFoldVisible?.(true);
                setFoldControl(true);
            } else {
                host.setResultCollapsed?.(false);
                host.setFoldVisible?.(false);
            }
        };
        measure();
        // 图片可能在初测后才撑高内容；只给尚未完成的图片补一次复测。
        state.imageCleanup?.(); state.imageCleanup = host.onPendingResultImagesLoad?.(measure) || null;
    };
    const removeFullscreenEsc = () => {
        if (!state.fsEsc) return;
        host.removeKeydown?.(state.fsEsc);
        state.fsEsc = null;
    };
    const exitFullscreen = () => {
        host.setFullscreen?.(false);
        host.setSheetFlat?.(false);
        host.setBodyFullscreenLock?.(false);
        host.setFullscreenControl?.('fa-solid fa-expand', '全屏浏览小剧场');
        removeFullscreenEsc();
        measureFold();
    };
    const toggleFullscreen = () => {
        if (host.isFullscreen?.()) { exitFullscreen(); return; }
        host.setFullscreen?.(true);
        host.setSheetFlat?.(true);
        host.setResultCollapsed?.(false);
        host.setBodyFullscreenLock?.(true);
        host.setFullscreenControl?.('fa-solid fa-compress', '退出全屏');
        if (!state.fsEsc) {
            // Esc 的 listener 跟随当前 UI owner；每条退出路径都必须移除，避免重开后累积幽灵监听。
            state.fsEsc = event => {
                if (event?.key === 'Escape' && host.isFullscreen?.()) exitFullscreen();
            };
            host.addKeydown?.(state.fsEsc);
        }
    };
    const toggleFold = () => {
        const collapsed = host.toggleResultCollapsed?.();
        if (typeof collapsed !== 'boolean') return;
        setFoldControl(collapsed);
        if (collapsed) host.scrollFoldTop?.();
    };
    const closeVisual = () => exitFullscreen();
    const clearRetry = () => { state.retry = null; };
    const clearTransient = () => { state.imageCleanup?.(); state.imageCleanup = null; removeFullscreenEsc(); host.setFullscreen?.(false); host.setSheetFlat?.(false); host.setBodyFullscreenLock?.(false); };
    const resetForChat = () => { closeVisual(); state.generationSeq++; state.templateSeq++; state.abortPending = false; state.current = null; state.source = null; state.retry = null; state.templates = []; state.batchId = ''; state.solo = false; state.poolNames = []; };
    const cleanup = root => {
        (root || state.mountRoot)?.off?.('.sp-theater-ui');
        for (const entry of state.settingsRoots) entry.root?.off?.('.sp-theater-ui');
        state.settingsRoots = []; state.mountRoot = null;
        state.bound = false;
        resetForChat();
    };
    const destroy = () => {
        state.imageCleanup?.(); state.imageCleanup = null;
        (state.mountRoot)?.off?.('.sp-theater-ui');
        for (const entry of state.settingsRoots) entry.root?.off?.('.sp-theater-ui');
        state.settingsRoots = []; state.mountRoot = null; state.bound = false;
        removeFullscreenEsc(); state.generationSeq++; state.templateSeq++; state.abortPending = false; state.current = null; state.source = null; state.retry = null; state.templates = []; state.batchId = ''; state.solo = false;
    };
    return { render, bind, bindSettings, refreshTemplates, refreshPoolList, generate, closeVisual, clearRetry, clearTransient, resetForChat, cleanup, destroy, get state() { return state; } };
}
