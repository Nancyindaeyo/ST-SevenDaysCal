export const REFRESH_MODULES = Object.freeze(['point', 'lines', 'dashed', 'outline']);

export function normalizeRefreshSelection(value) {
    const set = new Set(Array.isArray(value) ? value.map(String) : []);
    return REFRESH_MODULES.filter(name => set.has(name));
}

export function refreshBarHtml({ selected = ['point', 'lines'], reason = '', feedback = '' } = {}) {
    const on = name => selected.includes(name) ? ' checked' : '';
    return `<div class="sp-refresh-bar" id="sp-refresh-bar">
        <div class="sp-refresh-bar-row">
            <span class="sp-refresh-bar-label">本次要动</span>
            <label class="sp-mode-opt"><input type="checkbox" class="sp-refresh-mod" data-mod="point"${on('point')}><span>点（日程）</span></label>
            <label class="sp-mode-opt"><input type="checkbox" class="sp-refresh-mod" data-mod="lines"${on('lines')}><span>线（平行事件）</span></label>
            <label class="sp-mode-opt"><input type="checkbox" class="sp-refresh-mod" data-mod="dashed"${on('dashed')}><span>冷知识</span></label>
            <label class="sp-mode-opt"><input type="checkbox" class="sp-refresh-mod" data-mod="outline"${on('outline')}><span>面</span></label>
            <button type="button" class="sp-btn sp-refresh-all">全选</button>
        </div>
        <label class="sp-refresh-field"><span>为什么刷新</span><textarea id="sp-refresh-reason" class="sp-input" rows="2" placeholder="剧情不满意，我想改成…… / 平行事件写成了 A，实际是 B">${reason}</textarea></label>
        <label class="sp-refresh-field"><span>上次哪些设定可能写错了（可选）</span><textarea id="sp-refresh-feedback" class="sp-input" rows="2" placeholder="点把体检写成了今天；线把柳当在场；冷知识把校规写反了">${feedback}</textarea></label>
        <div class="sp-refresh-bar-actions">
            <button type="button" class="sp-btn" id="sp-refresh-align">按正文对齐</button>
            <button type="button" class="sp-btn sp-btn-primary" id="sp-refresh-regen">重新生成勾选项</button>
        </div>
    </div>`;
}

export function refreshFoldHtml(options = {}) {
    return `<details class="sp-fold-card" id="sp-refresh-fold">
        <summary class="sp-fold-summary">
            <i class="fa-solid fa-chevron-right sp-fold-chevron" aria-hidden="true"></i>
            <span>刷新账本</span>
            <span class="sp-fold-hint">勾选后对齐或重做点 / 线 / 冷知识 / 面</span>
        </summary>
        ${refreshBarHtml(options)}
    </details>`;
}

export function readRefreshBar($root) {
    if (!$root?.length) return { selected: [], reason: '', feedback: '' };
    const selected = [];
    $root.find('.sp-refresh-mod:checked').each(function () { selected.push(String(this.getAttribute('data-mod') || '')); });
    return {
        selected: normalizeRefreshSelection(selected),
        reason: String($root.find('#sp-refresh-reason').val() || '').trim(),
        feedback: String($root.find('#sp-refresh-feedback').val() || '').trim(),
    };
}
