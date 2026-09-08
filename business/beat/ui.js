import { formatBeatForInput } from './schema.js';

const ANGLE_LABEL = {
    today: '今天的点',
    line: '线侧面',
    date: '日期压力',
    daily: '纯日常',
    space: '间的方向',
};

export function beatFoldHtml() {
    return `<details class="sp-fold-card" id="sp-beat-fold">
        <summary class="sp-fold-summary">
            <i class="fa-solid fa-chevron-right sp-fold-chevron" aria-hidden="true"></i>
            <span>本轮拍</span>
            <span class="sp-fold-hint">卡住时出 4～5 条下一楼短大纲</span>
        </summary>
        <div class="sp-beat-panel" id="sp-beat-panel">
            <p class="sp-cfg-hint">读纠偏后的点/线、面当前节点、间近期发言和近文。可改、可复制、可填主楼输入框。不代发，不填棱。</p>
            <div class="sp-beat-list" id="sp-beat-list"></div>
            <div class="sp-refresh-bar-actions">
                <button type="button" class="sp-btn sp-btn-primary" id="sp-beat-gen">生成本轮拍</button>
            </div>
        </div>
    </details>`;
}

export function createBeatUi(host = {}) {
    const query = host.query || (() => null);
    let controller = null;
    let bound = false;

    const render = () => {
        const $list = query('#sp-beat-list');
        if (!$list?.length) return;
        const shots = controller?.shots || [];
        const busy = controller?.busy;
        query('#sp-beat-gen')?.prop?.('disabled', !!busy).text(busy ? '生成中…' : '生成本轮拍');
        if (!shots.length) {
            $list.html(busy
                ? '<div class="sp-empty sp-fold-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>正在写下一拍…</p></div>'
                : '<div class="sp-empty sp-fold-empty"><p>还没有本轮拍。点下面生成；纠偏结束后的提示也可以点进来。</p></div>');
            return;
        }
        $list.html(shots.map((shot, index) => {
            const angle = ANGLE_LABEL[shot.angle] || shot.angle;
            const title = host.escapeHtml?.(shot.title) || shot.title;
            const body = host.escapeHtml?.(shot.body) || shot.body;
            return `<article class="sp-beat-shot" data-idx="${index}">
                <div class="sp-beat-shot-head">
                    <span class="sp-seq-badge">#${index + 1}</span>
                    <span class="sp-beat-type">${angle}</span>
                    <span class="sp-beat-shot-actions">
                        <button type="button" class="sp-icon-btn sp-beat-copy" title="复制"><i class="fa-solid fa-copy"></i></button>
                        <button type="button" class="sp-icon-btn sp-beat-inject" title="填入输入框"><i class="fa-solid fa-arrow-right-to-bracket"></i></button>
                    </span>
                </div>
                <input class="sp-input sp-beat-shot-title" value="${title}">
                <textarea class="sp-input sp-beat-shot-body" rows="3">${body}</textarea>
            </article>`;
        }).join(''));
    };

    const bind = () => {
        if (bound) return;
        const $root = query('#sp-beat-fold');
        if (!$root?.length) return;
        bound = true;
        $root.off('.spBeat');
        $root.on('click.spBeat', '#sp-beat-gen', event => {
            event.preventDefault();
            event.stopPropagation();
            void controller?.generate?.();
        });
        $root.on('input.spBeat', '.sp-beat-shot-title, .sp-beat-shot-body', function () {
            const index = Number(host.$(this).closest('.sp-beat-shot').attr('data-idx'));
            const $card = host.$(this).closest('.sp-beat-shot');
            controller?.updateShot?.(index, {
                title: String($card.find('.sp-beat-shot-title').val() || ''),
                body: String($card.find('.sp-beat-shot-body').val() || ''),
            });
        });
        $root.on('click.spBeat', '.sp-beat-copy', async function () {
            const index = Number(host.$(this).closest('.sp-beat-shot').attr('data-idx'));
            const shot = controller?.shots?.[index];
            if (!shot) return;
            const ok = await host.copyText?.(formatBeatForInput(shot));
            host.toast?.(ok ? '已复制' : '复制失败', !ok);
        });
        $root.on('click.spBeat', '.sp-beat-inject', function () {
            const index = Number(host.$(this).closest('.sp-beat-shot').attr('data-idx'));
            const shot = controller?.shots?.[index];
            if (!shot) return;
            const ok = host.injectToInput?.(formatBeatForInput(shot));
            if (ok !== false) host.toast?.('已填入输入框');
        });
    };

    const reveal = () => {
        query('#sp-beat-fold')?.prop?.('open', true);
        const el = query('#sp-beat-fold')?.[0];
        el?.scrollIntoView?.({ block: 'nearest' });
    };

    return {
        bindController: value => { controller = value; },
        bind,
        render,
        reveal,
    };
}
