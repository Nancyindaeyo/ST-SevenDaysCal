import { drawTheaterRecipesAcrossBooks, normalizeTheaterCount, pickRandomPoolEntry, worldInfoEntries } from './recipe.js';

async function loadNamedBooks(names, loadWorldInfo) {
    const loaded = [];
    for (const name of names) {
        let data = null;
        try { data = await loadWorldInfo?.(name); } catch { data = null; }
        loaded.push({ name, entries: worldInfoEntries(data) });
    }
    return loaded;
}

function uniqueBookNames(books) {
    return [...new Set((Array.isArray(books) ? books : []).map(name => String(name || '').trim()).filter(Boolean))];
}

export function createTheaterPool({ loadWorldInfo } = {}) {
    return {
        async draw({ books = [], count = 2, random = Math.random } = {}) {
            const loaded = await loadNamedBooks(uniqueBookNames(books), loadWorldInfo);
            return drawTheaterRecipesAcrossBooks(loaded, normalizeTheaterCount(count), { random });
        },
        async pickRandom({ books = [], avoidKey = '', random = Math.random } = {}) {
            const loaded = await loadNamedBooks(uniqueBookNames(books), loadWorldInfo);
            return pickRandomPoolEntry(loaded, { random, avoidKey });
        },
    };
}
