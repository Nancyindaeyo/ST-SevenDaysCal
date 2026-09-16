import { normalizeSlip, slipRecord } from './schema.js';

export function createSlipRepository({ captureIdentity, isCurrent, readStore, writeStore } = {}) {
    let record = normalizeSlip(null);
    const capture = () => captureIdentity?.();
    const current = target => !!target && !!isCurrent?.(target);
    const read = target => target?.storeKey ? readStore?.(target.storeKey) : null;
    const load = (target = capture()) => {
        if (!current(target)) return record;
        record = normalizeSlip(read(target));
        return record;
    };
    const replace = (target, next) => {
        if (!current(target)) return false;
        const value = slipRecord(next?.text, next?.ts);
        if (writeStore?.(target.storeKey, value) === false) return false;
        record = value;
        return true;
    };
    const saveText = (text, target = capture()) => replace(target, slipRecord(text));
    const clearMemory = () => {
        record = normalizeSlip(null);
        return record;
    };
    return Object.freeze({
        capture,
        isCurrent: current,
        read,
        load,
        record: () => record,
        text: () => record.text,
        replace,
        saveText,
        clearMemory,
    });
}
