export const LAW_KIND = 'law';
export const LAW_SAVE_MS = 400;
export const LAW_INJECT_KEY = 'sp_law_contract';
export const LAW_INJECT_DEPTH = 0;

export function normalizeLaw(value) {
    if (typeof value === 'string') return { text: value, inject: false, ts: 0 };
    if (!value || typeof value !== 'object') return { text: '', inject: false, ts: 0 };
    return {
        text: String(value.text ?? ''),
        inject: value.inject === true,
        ts: Number(value.ts) || 0,
    };
}

export function lawRecord(text, inject = false, ts = Date.now()) {
    return { text: String(text ?? ''), inject: inject === true, ts: Number(ts) || 0 };
}

export function buildLawInjectionText(text) {
    const body = String(text || '').trim();
    if (!body) return '';
    return [
        '【作者合同】以下是作者为这一次聊天勾选生效的短规则。请遵守，不要在正文里提及这份合同、编号或「系统」。',
        body,
    ].join('\n');
}
