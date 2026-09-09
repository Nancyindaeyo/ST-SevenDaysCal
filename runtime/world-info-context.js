import { worldInfoSelectionAllows } from './world-info-selection.js';

export const WORLD_INFO_TOKEN_BUDGET = 60000;

export function worldInfoCandidateKey(world, uid) {
    const book = String(world ?? '').trim();
    const id = String(uid ?? '').trim();
    return book && id ? `${book}::${id}` : '';
}

export function worldInfoActivationEntries(result, mode) {
    if (!result || typeof result !== 'object') return null;
    const entries = mode === 'luker' ? result.activatedEntries : result.allActivatedEntries;
    if (mode === 'luker') {
        if (!Array.isArray(entries)) return null;
    } else if (!(entries instanceof Set)) {
        return null;
    }
    const values = mode === 'luker' ? entries : [...entries];
    const valid = values.filter(entry => entry && typeof entry === 'object' && worldInfoCandidateKey(entry.world, entry.uid));
    return valid.length ? valid : null;
}

export function worldInfoMaxContext(ctx, { getMaxPromptTokens } = {}) {
    try {
        const value = Number(typeof getMaxPromptTokens === 'function' ? getMaxPromptTokens() : NaN);
        if (Number.isFinite(value) && value > 0) return value;
    } catch { /* fall through */ }
    const fallback = Number(ctx?.maxContext);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : undefined;
}

export function worldInfoGlobalScanData(ctx) {
    let fields = null;
    try {
        if (typeof ctx?.getCharacterCardFields === 'function') fields = ctx.getCharacterCardFields() || null;
    } catch { /* ignore card-field probe */ }
    const character = ctx?.characters?.[ctx?.characterId] || {};
    const data = character?.data || {};
    const cardValue = (field, ...fallbacks) => {
        const value = fields?.[field];
        if (value !== undefined && value !== null) return String(value);
        for (const fallback of fallbacks) if (typeof fallback === 'string') return fallback;
        return '';
    };
    const persona = ctx?.powerUserSettings?.persona_description;
    return {
        personaDescription: cardValue('persona', persona),
        characterDescription: cardValue('description', character.description, data.description),
        characterPersonality: cardValue('personality', character.personality, data.personality),
        characterDepthPrompt: typeof fields?.charDepthPrompt === 'string'
            ? fields.charDepthPrompt
            : cardValue('charDepthPrompt', character.extensions?.depth_prompt?.prompt, data.extensions?.depth_prompt?.prompt),
        scenario: cardValue('scenario', character.scenario, data.scenario),
        creatorNotes: cardValue('creatorNotes', character.creator_notes, data.creator_notes),
        trigger: 'quiet',
    };
}

export function worldInfoFailureNoticeKey(ctx, now = Date.now()) {
    return `${String(ctx?.chatId || ctx?.chatMetadata?.chat_id_hash || 'default')}:${Math.floor(now / 2000)}`;
}

export function utf8ByteLength(value) {
    const text = String(value || '');
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length;
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code <= 0x7f) bytes++;
        else if (code <= 0x7ff) bytes += 2;
        else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) {
            bytes += 4;
            i++;
        } else bytes += 3;
    }
    return bytes;
}

export async function countWorldInfoTokens(text, { getTokenCountAsync } = {}) {
    const value = String(text || '');
    try {
        if (typeof getTokenCountAsync === 'function') {
            const total = Number(await getTokenCountAsync(value));
            if (Number.isFinite(total) && total >= 0) return { tokens: total, exact: true };
        }
    } catch { /* fall through to utf-8 estimate */ }
    return { tokens: utf8ByteLength(value), exact: false };
}

export function nativeWorldInfoChat(coreChat, includeNames) {
    return (coreChat || []).map(message => {
        const text = String(message.mes ?? message.content ?? '').trim();
        if (!includeNames) return text;
        return `${String(message.name || '').trim()}: ${text}`;
    }).filter(Boolean).reverse();
}

export function collectLinkedWorldNames({ tavernHelper, character, extraBooks } = {}) {
    const names = new Set();
    try {
        if (typeof tavernHelper?.getCharLorebooks === 'function') {
            const books = tavernHelper.getCharLorebooks();
            if (books?.primary) names.add(String(books.primary).trim());
            if (Array.isArray(books?.additional)) {
                for (const n of books.additional) if (n) names.add(String(n).trim());
            }
            if (names.size) return [...names].filter(Boolean);
        }
    } catch { /* fall through to card data */ }
    const primary = String(character?.data?.extensions?.world || '').trim();
    if (primary) names.add(primary);
    if (Array.isArray(extraBooks)) for (const name of extraBooks) if (name) names.add(String(name).trim());
    const embeddedName = String(character?.data?.character_book?.name || '').trim();
    if (embeddedName && !primary) names.add(embeddedName);
    return [...names].filter(Boolean);
}

export function collectGlobalWorldNames({ tavernHelper, lukerSelection, selectedWorldInfo, vanillaGlobalSelect } = {}) {
    try {
        if (typeof tavernHelper?.getLorebookSettings === 'function') {
            const s = tavernHelper.getLorebookSettings();
            if (Array.isArray(s?.selected_global_lorebooks)) return s.selected_global_lorebooks.filter(Boolean);
        }
    } catch { /* next layer */ }
    try {
        if (Array.isArray(lukerSelection)) return lukerSelection.filter(Boolean);
    } catch { /* next layer */ }
    try {
        if (Array.isArray(selectedWorldInfo)) return selectedWorldInfo.filter(Boolean);
        if (Array.isArray(vanillaGlobalSelect)) return vanillaGlobalSelect.filter(Boolean);
    } catch { /* empty */ }
    return [];
}

export function collectChatWorldNames(raw) {
    const list = Array.isArray(raw) ? raw : [raw];
    return [...new Set(list.map(name => String(name || '').trim()).filter(Boolean))];
}

export function worldInfoEntryFromLoaded(entry, uid, name, { scope, embedded = false } = {}) {
    const label = entry?.comment
        || (Array.isArray(entry?.key) ? entry.key.join(', ') : entry?.key)
        || `条目 ${uid}`;
    const content = entry?.content || '';
    const preview = String(content).replace(/\s+/g, ' ').slice(0, 120);
    const hostEnabled = embedded
        ? (typeof entry?.enabled === 'boolean' ? entry.enabled : entry?.disabled !== true)
        : entry?.disable !== true;
    return {
        key: `${name}::${uid}`,
        uid: String(uid),
        label,
        preview,
        content,
        source: name,
        embedded,
        scope,
        hostEnabled,
    };
}

export function appendWorldInfoBook(items, seen, entries, bookName, { scope, embedded = false } = {}) {
    if (!entries) return;
    if (Array.isArray(entries)) {
        for (const entry of entries) {
            const uid = String(entry?.uid ?? entry?.id ?? '');
            const item = worldInfoEntryFromLoaded(entry, uid, bookName, { scope, embedded });
            if (seen.has(item.key)) continue;
            seen.add(item.key);
            items.push(item);
        }
        return;
    }
    for (const [uid, entry] of Object.entries(entries)) {
        const item = worldInfoEntryFromLoaded(entry, uid, bookName, { scope, embedded });
        if (seen.has(item.key)) continue;
        seen.add(item.key);
        items.push(item);
    }
}

export function filterActivatedWorldInfo(entries, { selection, keys, allows = worldInfoSelectionAllows } = {}) {
    const activated = keys instanceof Set ? keys : new Set();
    return (entries || [])
        .filter(e => allows(selection, e.key))
        .filter(e => activated.has(worldInfoCandidateKey(e.source, e.uid)))
        .map(e => e.content)
        .filter(Boolean);
}

export async function resolveWorldInfoActivation(ctx, coreChat, env = {}) {
    const maxContext = worldInfoMaxContext(ctx, { getMaxPromptTokens: env.getMaxPromptTokens });
    const includeNames = env.includeNames !== false;
    const globalScanData = worldInfoGlobalScanData(ctx);
    const simulate = env.simulate ?? ctx?.simulateWorldInfoActivation;
    let lukerFailed = false;
    if (typeof simulate === 'function') {
        try {
            const result = await simulate.call(ctx, {
                coreChat,
                dryRun: true,
                type: 'quiet',
                ...(maxContext ? { maxContext } : {}),
                includeNames,
                globalScanData,
            });
            const entries = worldInfoActivationEntries(result, 'luker');
            if (!entries) throw new Error('invalid Luker world-info activation result');
            return { supported: true, keys: new Set(entries.map(entry => worldInfoCandidateKey(entry?.world, entry?.uid)).filter(Boolean)) };
        } catch (error) {
            env.logWarn?.('[构画] Luker 世界书激活失败，回退兼容模式', error);
            lukerFailed = true;
        }
    }
    const check = env.checkWorldInfo;
    if (typeof check === 'function') {
        try {
            const result = await check(nativeWorldInfoChat(coreChat, includeNames), maxContext, true, globalScanData);
            const entries = worldInfoActivationEntries(result, 'native');
            if (!entries) throw new Error('invalid native world-info activation result');
            return { supported: true, keys: new Set(entries.map(entry => worldInfoCandidateKey(entry?.world, entry?.uid)).filter(Boolean)) };
        } catch (error) {
            env.logWarn?.('[构画] 原生世界书激活失败，回退兼容模式', error);
        }
    }
    return { supported: false, failed: true, keys: new Set(), lukerFailed };
}

export async function packWorldInfoContents(candidates, { budget = WORLD_INFO_TOKEN_BUDGET, countTokens } = {}) {
    const count = countTokens || (text => countWorldInfoTokens(text));
    const kept = [];
    let skipped = 0;
    if (!candidates?.length) return { text: '', skipped, kept, finalCount: { tokens: 0, exact: true }, exactCount: true };
    const titleCount = await count('【世界书】\n');
    const separatorCount = await count('\n\n');
    let estimatedTokens = titleCount.tokens;
    let exactCount = titleCount.exact && separatorCount.exact;
    for (const content of candidates) {
        const counted = await count(content);
        const nextTokens = estimatedTokens + counted.tokens + (kept.length ? separatorCount.tokens : 0);
        estimatedTokens = nextTokens;
        exactCount = exactCount && counted.exact;
        if (nextTokens > budget) {
            skipped++;
            estimatedTokens -= counted.tokens + (kept.length ? separatorCount.tokens : 0);
            continue;
        }
        kept.push(content);
    }
    let finalCount = await count(`【世界书】\n${kept.join('\n\n')}`);
    while (finalCount.tokens > budget && kept.length) {
        const removed = kept.pop();
        skipped++;
        estimatedTokens -= (await count(removed)).tokens + (kept.length ? separatorCount.tokens : 0);
        finalCount = await count(`【世界书】\n${kept.join('\n\n')}`);
    }
    return {
        text: kept.length ? `【世界书】\n${kept.join('\n\n')}` : '',
        skipped,
        kept,
        finalCount,
        exactCount: finalCount.exact && exactCount,
        estimatedTokens: finalCount.tokens,
    };
}

export async function resolveAllWorldNames(env = {}) {
    try {
        const cached = await env.readCached?.();
        if (Array.isArray(cached) && cached.length) return cached;
    } catch { /* next layer */ }
    try {
        const list = await env.readHelper?.();
        if (Array.isArray(list) && list.length) return list;
    } catch { /* next layer */ }
    try {
        const refreshed = await env.refresh?.();
        if (Array.isArray(refreshed)) return refreshed;
    } catch { /* empty */ }
    return [];
}

export function normalizeWorldNameList(names) {
    return [...new Set((names || []).filter(n => typeof n === 'string' && n))].sort((a, b) => a.localeCompare(b, 'zh'));
}

export function wiExcludeSet(raw) {
    const arr = Array.isArray(raw) ? raw : [];
    return new Set(arr.filter(x => typeof x === 'string' && x));
}

export function bookNameExcluded(bookName, excluded, equals) {
    const name = String(bookName || '').trim();
    if (!name || !excluded?.size) return false;
    return [...excluded].some(saved => equals(saved, name));
}

export function nextExcludeBooks(raw, bookName, excluded, equals) {
    const name = String(bookName || '').trim();
    const current = Array.isArray(raw) ? raw : [];
    if (!name) return [...current];
    const set = new Set(current);
    for (const saved of set) if (equals(saved, name)) set.delete(saved);
    if (excluded) set.add(name);
    return [...set];
}

export function filterExcludedWorldInfo(items, excluded, equals) {
    if (!excluded?.size) return items || [];
    return (items || []).filter(entry => !bookNameExcluded(entry?.source, excluded, equals));
}

export async function loadCharacterWorldInfoEntries({
    loadWorldInfo,
    linkedNames = [],
    chatNames = [],
    globalNames = [],
    personaBook = '',
    characterBook = null,
} = {}) {
    const items = [];
    const seen = new Set();
    for (const name of linkedNames) {
        try {
            const data = await loadWorldInfo?.(name);
            appendWorldInfoBook(items, seen, data?.entries, name, { scope: 'char' });
        } catch { /* ignore individual load failure */ }
    }
    if (items.length === 0 && characterBook?.entries?.length) {
        appendWorldInfoBook(items, seen, characterBook.entries, characterBook.name || '角色内置世界书', { scope: 'char', embedded: true });
    }
    for (const name of chatNames) {
        try {
            const data = await loadWorldInfo?.(name);
            appendWorldInfoBook(items, seen, data?.entries, name, { scope: 'chat' });
        } catch { /* ignore chat lore load failure */ }
    }
    for (const name of globalNames) {
        if (linkedNames.includes(name)) continue;
        try {
            const data = await loadWorldInfo?.(name);
            appendWorldInfoBook(items, seen, data?.entries, name, { scope: 'global' });
        } catch { /* ignore individual load failure */ }
    }
    const persona = String(personaBook || '').trim();
    if (persona && !linkedNames.includes(persona) && !globalNames.includes(persona)) {
        try {
            const data = await loadWorldInfo?.(persona);
            appendWorldInfoBook(items, seen, data?.entries, persona, { scope: 'persona' });
        } catch { /* ignore persona book load failure */ }
    }
    return items;
}
