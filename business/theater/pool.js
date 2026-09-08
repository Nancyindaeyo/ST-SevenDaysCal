import { drawTheaterRecipesAcrossBooks, normalizeTheaterCount, worldInfoEntries } from './recipe.js';

export function createTheaterPool({ loadWorldInfo } = {}) {
    return {
        async draw({ books = [], count = 2, random = Math.random } = {}) {
            const names = [...new Set((Array.isArray(books) ? books : []).map(name => String(name || '').trim()).filter(Boolean))];
            const loaded = [];
            for (const name of names) {
                let data = null;
                try { data = await loadWorldInfo?.(name); } catch { data = null; }
                loaded.push({ name, entries: worldInfoEntries(data) });
            }
            return drawTheaterRecipesAcrossBooks(loaded, normalizeTheaterCount(count), { random });
        },
    };
}
