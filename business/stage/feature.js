import { renderStageHtml } from './ui.js';

export function enterStageSidebar({ resetModes, show, feature } = {}) {
    resetModes?.();
    show?.();
    feature?.open?.();
}

export function createStageFeature(env = {}) {
    let open = false;
    const root = () => env.$in?.('#sp-stage-wrap');
    const paint = () => {
        if (!open) return;
        const $root = root();
        if (!$root?.length) return;
        $root.html(renderStageHtml(env.collect?.() || {}));
    };
    const openPage = () => {
        open = true;
        paint();
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
            env.$in?.('#sp-stage-wrap')?.on?.('click.spStage', '.sp-stage-row', function () {
                env.jump?.({
                    module: this.getAttribute('data-jump-mod'),
                    title: this.getAttribute('data-jump-key'),
                    ref: this.getAttribute('data-jump-ref'),
                });
            });
        },
    });
}
