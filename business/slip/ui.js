export function createSlipUi({ $in } = {}) {
    const input = () => $in?.('#sp-slip-input');
    return Object.freeze({
        bind({ onInput, onBlur } = {}) {
            const $field = input();
            $field?.on?.('input.spSlip', function () { onInput?.(this.value); });
            $field?.on?.('blur.spSlip', function () { onBlur?.(this.value); });
        },
        paint(text, { force = false } = {}) {
            const $field = input();
            if (!$field?.length) return;
            const el = $field[0];
            const next = String(text ?? '');
            const active = typeof document !== 'undefined' ? document.activeElement : null;
            if (!force && el && active === el) return;
            $field.val(next);
        },
        value() {
            return String(input()?.val?.() ?? '');
        },
        focus() {
            input()?.trigger?.('focus');
        },
    });
}

export function enterSlipSidebar({ resetModes, show, feature } = {}) {
    resetModes?.();
    show?.();
    feature?.open?.();
}
