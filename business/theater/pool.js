import { drawTheaterRecipes, normalizeTheaterCount, worldInfoEntries } from './recipe.js';

export function createTheaterPool({ loadWorldInfo } = {}) {
    return {
        async draw({ books = [], count = 2, random = Math.random } = {}) {
            const names = [...new Set((Array.isArray(books) ? books : []).map(name => String(name || '').trim()).filter(Boolean))];
            const want = normalizeTheaterCount(count);
            const headers = [];
            const recipes = [];
            const seen = new Set();
            for (const name of names) {
                let data = null;
                try { data = await loadWorldInfo?.(name); } catch { data = null; }
                const drawn = drawTheaterRecipes(worldInfoEntries(data), want, { random, bookName: name });
                for (const header of drawn.headers) {
                    const key = `h:${name}:${header.uid}:${header.title}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    headers.push(header);
                }
                for (const recipe of drawn.recipes) {
                    if (recipes.length >= want) break;
                    const key = `r:${name}:${recipe.uid}:${recipe.title}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    recipes.push(recipe);
                }
                if (recipes.length >= want) break;
            }
            return { headers, recipes: recipes.slice(0, want) };
        },
    };
}
