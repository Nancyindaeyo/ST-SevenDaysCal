export function createLawUi({ $in } = {}) {
    const input = () => $in?.('#sp-law-input');
    const box = () => $in?.('#sp-law-inject');
    return Object.freeze({
        bind({ onInput, onBlur, onInject } = {}) {
            input()?.on?.('input.spLaw', function () { onInput?.(this.value); });
            input()?.on?.('blur.spLaw', function () { onBlur?.(this.value); });
            box()?.on?.('change.spLaw', function () { onInject?.(this.checked === true); });
        },
        paint(text, inject, { force = false } = {}) {
            const $field = input();
            if ($field?.length) {
                const el = $field[0];
                const next = String(text ?? '');
                const active = typeof document !== 'undefined' ? document.activeElement : null;
                if (force || !(el && active === el)) $field.val(next);
            }
            const $box = box();
            if ($box?.length) $box.prop?.('checked', inject === true);
        },
        value() {
            return String(input()?.val?.() ?? '');
        },
        inject() {
            return box()?.prop?.('checked') === true;
        },
    });
}

export function enterLawSidebar({ resetModes, show, feature } = {}) {
    resetModes?.();
    show?.();
    feature?.open?.();
}
