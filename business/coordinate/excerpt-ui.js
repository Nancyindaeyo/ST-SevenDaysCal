const SKIP_PICK = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'BUTTON', 'SELECT', 'OPTION']);
const SHOW_TEXT = globalThis.NodeFilter?.SHOW_TEXT ?? 4;
const FILTER_REJECT = globalThis.NodeFilter?.FILTER_REJECT ?? 2;
const FILTER_ACCEPT = globalThis.NodeFilter?.FILTER_ACCEPT ?? 1;

export function splitPickUnits(text) {
    const raw = String(text ?? '');
    if (!raw.trim()) return raw ? [raw] : [];
    return raw.split(/(?<=[。！？!?…])\s*|(?<=[.!?])\s+|\n+/).filter(unit => unit.length);
}

export function joinPickedText(parts) {
    return (Array.isArray(parts) ? parts : [])
        .map(value => String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' ');
}

export function useTapPick(width = globalThis.innerWidth, media = globalThis.matchMedia) {
    try {
        if (typeof media === 'function' && media.call(globalThis, '(pointer: coarse)')?.matches) return true;
        if (typeof media === 'function' && media.call(globalThis, '(hover: none)')?.matches) return true;
    } catch { /* ignore */ }
    return Number(width) > 0 && Number(width) <= 640;
}

export function wrapPickableText(root, documentRef = globalThis.document) {
    if (!root || !documentRef?.createTreeWalker || !documentRef.createElement) return 0;
    const walker = documentRef.createTreeWalker(root, SHOW_TEXT, {
        acceptNode(node) {
            if (!node?.nodeValue?.trim()) return FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent || parent.closest?.('.sp-anchor-pick')) return FILTER_REJECT;
            if (SKIP_PICK.has(parent.tagName)) return FILTER_REJECT;
            return FILTER_ACCEPT;
        },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let count = 0;
    for (const node of nodes) {
        const units = splitPickUnits(node.nodeValue);
        if (!units.length) continue;
        const frag = documentRef.createDocumentFragment();
        for (const unit of units) {
            if (!unit.trim()) {
                frag.appendChild(documentRef.createTextNode(unit));
                continue;
            }
            const span = documentRef.createElement('span');
            span.className = 'sp-anchor-pick';
            span.textContent = unit;
            frag.appendChild(span);
            count++;
        }
        node.parentNode?.replaceChild(frag, node);
    }
    return count;
}

export function readPickedText(host) {
    const picks = host?.shadowRoot?.querySelectorAll?.('.sp-anchor-pick-on') || [];
    return joinPickedText([...picks].map(el => el.textContent));
}

export function readShadowSelection(host) {
    if (!host) return '';
    const shadow = host.shadowRoot;
    const fromSel = sel => String(sel?.toString?.() || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const shadowText = fromSel(shadow?.getSelection?.());
    if (shadowText) return shadowText;
    const docSel = globalThis.getSelection?.();
    if (docSel?.rangeCount) {
        const node = docSel.anchorNode;
        const inside = node && (shadow?.contains?.(node) || host.contains?.(node));
        const text = inside ? fromSel(docSel) : '';
        if (text) return text;
    }
    return readPickedText(host);
}

export function bindSnapSelection({ host, onChange, tapPick = useTapPick } = {}) {
    if (!host || typeof onChange !== 'function') return () => {};
    let touchTimer = 0;
    let pressTimer = 0;
    let pressed = null;
    let longToggled = false;
    const emit = () => onChange(readShadowSelection(host));
    const emitSoon = () => {
        globalThis.clearTimeout?.(touchTimer);
        touchTimer = globalThis.setTimeout?.(emit, 360) || 0;
    };
    const togglePick = pick => {
        if (!pick) return;
        pick.classList.toggle('sp-anchor-pick-on');
        emit();
    };
    const shadow = host.shadowRoot;
    const onClick = event => {
        if (!tapPick?.()) return;
        const pick = event.target?.closest?.('.sp-anchor-pick');
        if (!pick || (shadow && !shadow.contains(pick))) return;
        event.preventDefault();
        if (longToggled) { longToggled = false; return; }
        togglePick(pick);
    };
    const onPointerDown = event => {
        if (!tapPick?.() || event.pointerType === 'mouse') return;
        const pick = event.target?.closest?.('.sp-anchor-pick');
        if (!pick) return;
        pressed = { pick, x: event.clientX, y: event.clientY };
        longToggled = false;
        globalThis.clearTimeout?.(pressTimer);
        pressTimer = globalThis.setTimeout?.(() => {
            if (!pressed) return;
            longToggled = true;
            togglePick(pressed.pick);
            pressed = null;
        }, 380) || 0;
    };
    const onPointerMove = event => {
        if (!pressed) return;
        if (Math.abs(event.clientX - pressed.x) > 10 || Math.abs(event.clientY - pressed.y) > 10) {
            globalThis.clearTimeout?.(pressTimer);
            pressed = null;
        }
    };
    const onPointerUp = () => {
        globalThis.clearTimeout?.(pressTimer);
        pressed = null;
    };
    shadow?.addEventListener?.('click', onClick);
    shadow?.addEventListener?.('pointerdown', onPointerDown);
    shadow?.addEventListener?.('pointermove', onPointerMove);
    shadow?.addEventListener?.('pointerup', onPointerUp);
    shadow?.addEventListener?.('pointercancel', onPointerUp);
    shadow?.addEventListener?.('mouseup', emit);
    shadow?.addEventListener?.('keyup', emit);
    shadow?.addEventListener?.('touchend', emitSoon);
    shadow?.addEventListener?.('contextmenu', emitSoon);
    globalThis.document?.addEventListener?.('selectionchange', emit);
    emit();
    return () => {
        globalThis.clearTimeout?.(touchTimer);
        globalThis.clearTimeout?.(pressTimer);
        shadow?.removeEventListener?.('click', onClick);
        shadow?.removeEventListener?.('pointerdown', onPointerDown);
        shadow?.removeEventListener?.('pointermove', onPointerMove);
        shadow?.removeEventListener?.('pointerup', onPointerUp);
        shadow?.removeEventListener?.('pointercancel', onPointerUp);
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
        const extra = typeof el.querySelectorAll === 'function'
            ? [...el.querySelectorAll('.sp-anchor-item-note-input')].map(input => input.value).join('\n')
            : '';
        const hay = `${el.getAttribute('data-search') || ''}\n${extra}`.toLowerCase();
        const ok = !words.length || words.every(word => hay.includes(word));
        el.hidden = !ok;
        if (ok) shown++;
    });
    const empty = root.querySelector?.('.sp-search-empty');
    if (empty) empty.hidden = !raw || shown > 0;
    return shown;
}
