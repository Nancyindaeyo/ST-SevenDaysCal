import { lawRecord, normalizeLaw } from './schema.js';

export function createLawRepository({ captureIdentity, isCurrent, readStore, writeStore } = {}) {
    let record = normalizeLaw(null);
    const capture = () => captureIdentity?.();
    const current = target => !!target && !!isCurrent?.(target);
    const read = target => target?.storeKey ? readStore?.(target.storeKey) : null;
    const load = (target = capture()) => {
        if (!current(target)) return record;
        record = normalizeLaw(read(target));
        return record;
    };
    const replace = (target, next) => {
        if (!current(target)) return false;
        const value = lawRecord(next?.text, next?.inject, next?.ts);
        if (writeStore?.(target.storeKey, value) === false) return false;
        record = value;
        return true;
    };
    const save = (text, inject, target = capture()) => replace(target, lawRecord(text, inject));
    const clearMemory = () => {
        record = normalizeLaw(null);
        return record;
    };
    return Object.freeze({
        capture,
        isCurrent: current,
        read,
        load,
        record: () => record,
        text: () => record.text,
        inject: () => record.inject,
        replace,
        save,
        clearMemory,
    });
}
