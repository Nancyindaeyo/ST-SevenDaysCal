export function excerptToQuote(item) {
    return {
        who: String(item?.charName || item?.who || '').trim() || '未名',
        floor: Number.isFinite(Number(item?.floorIndex ?? item?.floor)) ? Number(item.floorIndex ?? item.floor) : null,
        quote: String(item?.quote || '').trim(),
        note: String(item?.note || '').trim(),
    };
}

export function wrapQuotedSpaceMessage(quote, typed) {
    const payload = encodeURIComponent(JSON.stringify(excerptToQuote(quote)));
    const rest = String(typed || '').trim();
    return rest ? `<sp_quote>${payload}</sp_quote>\n\n${rest}` : `<sp_quote>${payload}</sp_quote>`;
}

export function parseQuotedSpaceMessage(content) {
    const raw = String(content || '');
    const match = raw.match(/^<sp_quote>([\s\S]*?)<\/sp_quote>(?:\n\n([\s\S]*))?$/);
    if (!match) return null;
    try {
        const data = JSON.parse(decodeURIComponent(match[1]));
        return { ...excerptToQuote(data), typed: String(match[2] || '').trim() };
    } catch {
        return null;
    }
}

export function quotedSpaceMessageForApi(content) {
    const parsed = parseQuotedSpaceMessage(content);
    if (!parsed) return String(content || '');
    const bits = [`【摘抄】${parsed.who}${parsed.floor != null ? ` · #${parsed.floor}` : ''}`, `「${parsed.quote}」`];
    if (parsed.note) bits.push(`点评：${parsed.note}`);
    if (parsed.typed) bits.push(parsed.typed);
    return bits.join('\n');
}

export function quoteCardHtml(quote, escape) {
    if (!quote?.quote || typeof escape !== 'function') return '';
    const meta = [quote.who, quote.floor != null ? `#${quote.floor}` : ''].filter(Boolean).join(' · ');
    const note = quote.note ? `<div class="sp-space-quote-note">${escape(quote.note)}</div>` : '';
    return `<div class="sp-space-quote-card"><div class="sp-space-quote-meta">${escape(meta)}</div><div class="sp-space-quote-text">${escape(quote.quote)}</div>${note}</div>`;
}
