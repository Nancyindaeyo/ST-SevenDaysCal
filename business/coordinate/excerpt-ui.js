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
    let touchTimer = 0;
    const emit = () => onChange(readShadowSelection(host));
    const emitSoon = () => {
        globalThis.clearTimeout?.(touchTimer);
        touchTimer = globalThis.setTimeout?.(emit, 360) || 0;
    };
    const shadow = host.shadowRoot;
    shadow?.addEventListener?.('mouseup', emit);
    shadow?.addEventListener?.('keyup', emit);
    shadow?.addEventListener?.('touchend', emitSoon);
    shadow?.addEventListener?.('contextmenu', emitSoon);
    globalThis.document?.addEventListener?.('selectionchange', emit);
    emit();
    return () => {
        globalThis.clearTimeout?.(touchTimer);
        shadow?.removeEventListener?.('mouseup', emit);
        shadow?.removeEventListener?.('keyup', emit);
        shadow?.removeEventListener?.('touchend', emitSoon);
        shadow?.removeEventListener?.('contextmenu', emitSoon);
        globalThis.document?.removeEventListener?.('selectionchange', emit);
    };
}

export function filterSearchList(root, query) {
    const list = root?.querySelector?.('[data-filter-list]');
    if (!list) return 0;
    const raw = String(query || '').trim().toLowerCase();
    const words = raw.split(/\s+/).filter(Boolean);
    let shown = 0;
    list.querySelectorAll('[data-search]').forEach(el => {
        const hay = String(el.getAttribute('data-search') || '').toLowerCase();
        const ok = !words.length || words.every(word => hay.includes(word));
        el.hidden = !ok;
        if (ok) shown++;
    });
    const empty = root.querySelector?.('.sp-search-empty');
    if (empty) empty.hidden = !raw || shown > 0;
    return shown;
}
