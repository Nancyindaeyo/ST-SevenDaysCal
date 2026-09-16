import { renderStageHtml } from './ui.js';

export function enterStageSidebar({ resetModes, show, feature } = {}) {
    resetModes?.();
    show?.();
    feature?.open?.();
}

export function createStageFeature(env = {}) {
    let open = false;
    const wrap = () => env.$in?.('#sp-stage-wrap');
    const main = () => env.$in?.('#sp-stage-main');
    const paint = () => {
        if (!open) return;
        const $main = main();
        const $wrap = wrap();
        if ($main?.length) $main.html(renderStageHtml(env.collect?.() || {}));
        else if ($wrap?.length) $wrap.html(`<div class="sp-stage-main" id="sp-stage-main">${renderStageHtml(env.collect?.() || {})}</div>`);
    };
    const openPage = () => {
        open = true;
        paint();
        env.onOpen?.();
    };
    const close = () => { open = false; };
    const onChatChanged = () => { open = false; };
    return Object.freeze({
        isOpen: () => open,
        open: openPage,
        close,
        refresh: paint,
        onChatChanged,
        bindUi() {
            wrap()?.on?.('click.spStage', '.sp-stage-row', function () {
                env.jump?.({
                    module: this.getAttribute('data-jump-mod'),
                    title: this.getAttribute('data-jump-key'),
                    ref: this.getAttribute('data-jump-ref'),
                });
            });
        },
    });
}
