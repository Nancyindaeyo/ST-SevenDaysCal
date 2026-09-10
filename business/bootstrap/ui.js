import { BOOTSTRAP_LABELS, booksAreEmpty } from './queue.js';

export function emptyBooksHtml() {
    return `<div class="sp-empty sp-bootstrap-empty">
        <i class="fa-solid fa-layer-group"></i>
        <p>这串聊天还没有账本</p>
        <p class="sp-cfg-hint">按 面 → 点 → 线 → 轴 → 冷知识 排队生成，一次一项。失败会停在该项，前面已经写入的保留。</p>
        <button type="button" class="sp-gen-btn" id="sp-gen-books-now">生成账本</button>
    </div>`;
}

export function emptyPointHtml(flags) {
    if (booksAreEmpty(flags)) return emptyBooksHtml();
    return '<div class="sp-empty"><i class="fa-regular fa-calendar"></i><p>还没有点</p><button class="sp-gen-btn" id="sp-gen-schedule-now">生成点</button></div>';
}

export function emptyLinesHtml(flags) {
    if (booksAreEmpty(flags)) return emptyBooksHtml();
    return '<div class="sp-empty"><i class="fa-solid fa-diagram-project"></i><p>还没有追踪的线，可以生成一版</p><button class="sp-gen-btn" id="sp-gen-lines-now">生成线</button></div>';
}

export function emptyOutlineHtml(flags) {
    if (booksAreEmpty(flags)) return emptyBooksHtml();
    return '<div class="sp-empty"><i class="fa-solid fa-scroll"></i><p>当前还没有面，可以先直接聊天讨论，也可以生成一版面作为起点</p><button class="sp-gen-btn sp-outline-gen-btn" id="sp-gen-outline-now">生成面</button></div>';
}

export function bootstrapProgressHtml(state = {}) {
    const steps = Array.isArray(state.steps) ? state.steps : [];
    const index = Number(state.index) || 0;
    const failed = state.failed === true;
    const current = steps[index];
    const rows = steps.map((id, i) => {
        const label = BOOTSTRAP_LABELS[id] || id;
        const mark = i < index ? '✓' : i === index && failed ? '✗' : i === index ? '…' : '';
        const cls = i < index ? ' is-done' : i === index ? (failed ? ' is-failed' : ' is-run') : '';
        return `<li class="sp-bootstrap-step${cls}"><span>${label}</span><em>${mark}</em></li>`;
    }).join('');
    const hint = failed
        ? `${BOOTSTRAP_LABELS[current] || '这一项'}生成失败。前面已经写入的保留。`
        : current
            ? `正在生成${BOOTSTRAP_LABELS[current] || ''}（${index + 1}/${steps.length}）`
            : '正在生成账本';
    const actions = failed
        ? `<button type="button" class="sp-gen-btn" id="sp-bootstrap-retry">重试这一项</button><button type="button" class="sp-btn" id="sp-bootstrap-skip">跳过，继续后面</button><button type="button" class="sp-btn" id="sp-bootstrap-abort">中止</button>`
        : `<button type="button" class="sp-btn" id="sp-bootstrap-abort">中止</button>`;
    return `<div class="sp-empty sp-bootstrap-progress">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>${hint}</p>
        <ol class="sp-bootstrap-steps">${rows}</ol>
        ${state.error ? `<p class="sp-cfg-hint">${state.error}</p>` : ''}
        <div class="sp-bootstrap-actions">${actions}</div>
    </div>`;
}

export function openRefreshFold($root, selected = []) {
    if (!$root?.length) return false;
    const $fold = $root.is?.('#sp-refresh-fold') ? $root : $root.find('#sp-refresh-fold');
    if (!$fold.length) return false;
    $fold.prop('open', true);
    const want = new Set(Array.isArray(selected) ? selected : []);
    $fold.find('.sp-refresh-mod').each(function () {
        this.checked = want.has(String(this.getAttribute('data-mod') || ''));
    });
    $fold[0]?.scrollIntoView?.({ block: 'nearest' });
    return true;
}
