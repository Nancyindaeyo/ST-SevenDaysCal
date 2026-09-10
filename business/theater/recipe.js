// 棱挂载世界书：剥除 HTML/交互/主楼插入合同，按 group 抽签。纯函数，无 DOM。

const HEADER_COMMENT = /必开|使用必开|^(?:开启|头|尾)$|[（(【]\s*(?:头|尾)\s*[）)】]|开启[（(]|（头）|（尾）/;
const DROP_LINE = /(?:^|[^\S\r\n])(?:<style|<script|<\/style|<\/script|@media|@keyframes|scrollbar|onclick|oninput|addEventListener)|全文使用\s*HTML|使用 HTML\s*与\s*CSS|美化排版并适配|适配移动端|严禁低对比度|禁止使用\s*HTML|每次正文结束后|正文结束后生成|所有内容需包裹在|需包裹在\s*<snow|使用\s*<details|<snow>|<\/snow>|<toto>|<\/toto>|构画以外的主楼插入/i;

export function isTheaterHeaderEntry(comment) {
    const text = String(comment || '').trim();
    if (!text) return false;
    return HEADER_COMMENT.test(text);
}

export function stripTheaterMarkup(content) {
    let text = String(content || '');
    text = text.replace(/```[\s\S]*?```/g, '\n');
    text = text.replace(/<script\b[\s\S]*?<\/script>/gi, '\n');
    text = text.replace(/<style\b[\s\S]*?<\/style>/gi, '\n');
    text = text.replace(/<\/?(?:snow|toto|snow_rules)[^>]*>/gi, '\n');
    text = text.replace(/<details\b[^>]*>/gi, '\n');
    text = text.replace(/<\/details>/gi, '\n');
    text = text.replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/gi, '\n');
    text = text.replace(/<[^>]+>/g, ' ');
    return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function stripTheaterRecipe(content) {
    const stripped = stripTheaterMarkup(content);
    if (!stripped) return '';
    const kept = stripped.split('\n').map(line => line.trimEnd()).filter(line => {
        const t = line.trim();
        if (!t) return true;
        if (DROP_LINE.test(t)) return false;
        return true;
    });
    const text = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return text;
}

export function normalizeTheaterCount(value, fallback = 2) {
    const n = Math.floor(Number(value));
    if (Number.isInteger(n) && n >= 1 && n <= 3) return n;
    return fallback;
}

function weightedPick(list, random) {
    const weights = list.map(item => {
        const w = Number(item.groupWeight);
        return Number.isFinite(w) && w > 0 ? w : 100;
    });
    const total = weights.reduce((sum, w) => sum + w, 0) || list.length;
    let roll = random() * total;
    for (let i = 0; i < list.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return list[i];
    }
    return list[list.length - 1];
}

export function worldInfoEntries(data) {
    const entries = data?.entries;
    if (!entries) return [];
    if (Array.isArray(entries)) return entries.filter(item => item && typeof item === 'object');
    return Object.values(entries).filter(item => item && typeof item === 'object');
}

export function splitTheaterPool(entries) {
    const headers = [];
    const grouped = new Map();
    const ungrouped = [];
    for (const entry of entries || []) {
        if (entry.disable === true) continue;
        const comment = String(entry.comment || '').trim();
        if (isTheaterHeaderEntry(comment)) {
            headers.push(entry);
            continue;
        }
        const group = String(entry.group ?? '').trim();
        if (!group) ungrouped.push(entry);
        else {
            const list = grouped.get(group) || [];
            list.push(entry);
            grouped.set(group, list);
        }
    }
    return { headers, grouped, ungrouped };
}

function toRecipe(entry, bookName = '') {
    const stripped = stripTheaterRecipe(entry?.content);
    if (!stripped) return null;
    return {
        uid: entry.uid,
        bookName: String(bookName || ''),
        title: String(entry.comment || '').trim() || '(无标题)',
        group: String(entry.group || '').trim(),
        stripped,
    };
}

function slotsOfBook(entries, bookName) {
    const { headers, grouped, ungrouped } = splitTheaterPool(entries);
    const slots = [
        ...[...grouped.values()].map(list => ({ kind: 'group', list })),
        ...ungrouped.map(entry => ({ kind: 'entry', list: [entry] })),
    ];
    return {
        headers: headers.map(entry => toRecipe(entry, bookName)).filter(Boolean),
        slots,
    };
}

export function drawTheaterRecipesAcrossBooks(books, count = 2, { random = Math.random } = {}) {
    const want = normalizeTheaterCount(count);
    const libraries = [];
    for (const book of books || []) {
        const name = String(book?.name || book?.bookName || '').trim();
        const packed = slotsOfBook(book?.entries || [], name);
        libraries.push({ name, ...packed });
    }
    const recipes = [];
    const usedBooks = new Set();
    const usedKeys = new Set();
    while (recipes.length < want) {
        const available = libraries.filter(library => library.slots.length);
        if (!available.length) break;
        const unused = available.filter(library => !usedBooks.has(library.name));
        const pool = unused.length ? unused : available;
        const library = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
        const slotAt = Math.min(library.slots.length - 1, Math.floor(random() * library.slots.length));
        const slot = library.slots.splice(slotAt, 1)[0];
        const candidates = slot.list.slice();
        let recipe = null;
        while (candidates.length && !recipe) {
            const entry = slot.kind === 'group' ? weightedPick(candidates, random) : candidates[0];
            const at = candidates.indexOf(entry);
            if (at >= 0) candidates.splice(at, 1);
            recipe = toRecipe(entry, library.name);
        }
        if (!recipe) continue;
        const key = `${library.name}:${recipe.uid}:${recipe.title}`;
        if (usedKeys.has(key)) continue;
        usedKeys.add(key);
        usedBooks.add(library.name);
        recipes.push(recipe);
    }
    const headers = libraries.filter(library => usedBooks.has(library.name)).flatMap(library => library.headers);
    return { headers, recipes };
}

export function drawTheaterRecipes(entries, count = 2, { random = Math.random, bookName = '' } = {}) {
    return drawTheaterRecipesAcrossBooks([{ name: bookName, entries }], count, { random });
}

export function poolEntryKey(item) {
    return `${item?.bookName || ''}:${item?.uid ?? ''}`;
}

export function listPlayablePoolEntries(books = []) {
    const items = [];
    for (const book of books || []) {
        const name = String(book?.name || book?.bookName || '').trim();
        for (const entry of worldInfoEntries(book)) {
            if (entry?.disable === true) continue;
            const comment = String(entry.comment || '').trim();
            if (isTheaterHeaderEntry(comment)) continue;
            const content = String(entry.content || '').trim();
            if (!content) continue;
            items.push({
                uid: entry.uid,
                bookName: name,
                title: comment || '(无标题)',
                content,
            });
        }
    }
    return items;
}

export function pickRandomPoolEntry(books, { random = Math.random, avoidKey = '' } = {}) {
    const items = listPlayablePoolEntries(books);
    if (!items.length) return null;
    const skip = String(avoidKey || '');
    const choices = skip && items.length > 1 ? items.filter(item => poolEntryKey(item) !== skip) : items;
    const pool = choices.length ? choices : items;
    return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] || null;
}
