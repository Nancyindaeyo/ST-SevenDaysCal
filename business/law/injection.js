import { LAW_INJECT_DEPTH, LAW_INJECT_KEY, buildLawInjectionText } from './schema.js';

export function createLawInjection({ context, injectEnabled, readRecord } = {}) {
    const clear = () => {
        const ctx = typeof context === 'function' ? context() : context;
        ctx?.setExtensionPrompt?.(LAW_INJECT_KEY, '');
    };
    const refresh = () => {
        const ctx = typeof context === 'function' ? context() : context;
        if (!ctx || typeof ctx.setExtensionPrompt !== 'function') return false;
        const record = typeof readRecord === 'function' ? readRecord() : readRecord;
        const text = String(record?.text || '').trim();
        if (!injectEnabled?.() || record?.inject !== true || !text) {
            clear();
            return true;
        }
        const pt = ctx.constants?.promptTypes?.IN_CHAT ?? 1;
        const pr = ctx.constants?.promptRoles?.SYSTEM ?? 0;
        ctx.setExtensionPrompt(LAW_INJECT_KEY, buildLawInjectionText(text), pt, LAW_INJECT_DEPTH, false, pr);
        return true;
    };
    return Object.freeze({ refresh, clear });
}
