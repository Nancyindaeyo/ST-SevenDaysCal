export function readShadowSelection(host) {
    if (!host) return '';
    const shadow = host.shadowRoot;
    const fromSel = sel => String(sel?.toString?.() || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const shadowText = fromSel(shadow?.getSelection?.());
    if (shadowText) return shadowText;
    const docSel = globalThis.getSelection?.();
    if (!docSel || docSel.rangeCount === 0) return '';
    const node = docSel.anchorNode;
    if (!node) return '';
    const inside = shadow?.contains?.(node) || host.contains?.(node);
    return inside ? fromSel(docSel) : '';
}

export function bindSnapSelection({ host, onChange } = {}) {
    if (!host || typeof onChange !== 'function') return () => {};
    const emit = () => onChange(readShadowSelection(host));
    const shadow = host.shadowRoot;
    shadow?.addEventListener?.('mouseup', emit);
    shadow?.addEventListener?.('keyup', emit);
    shadow?.addEventListener?.('touchend', emit);
    globalThis.document?.addEventListener?.('selectionchange', emit);
    emit();
    return () => {
        shadow?.removeEventListener?.('mouseup', emit);
        shadow?.removeEventListener?.('keyup', emit);
        shadow?.removeEventListener?.('touchend', emit);
        globalThis.document?.removeEventListener?.('selectionchange', emit);
    };
}
