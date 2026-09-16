export const SLIP_KIND = 'slip';
export const SLIP_SAVE_MS = 400;

export function normalizeSlip(value) {
    if (typeof value === 'string') return { text: value, ts: 0 };
    if (!value || typeof value !== 'object') return { text: '', ts: 0 };
    return {
        text: String(value.text ?? ''),
        ts: Number(value.ts) || 0,
    };
}

export function slipRecord(text, ts = Date.now()) {
    return { text: String(text ?? ''), ts: Number(ts) || 0 };
}
