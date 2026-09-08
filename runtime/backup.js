// 构画迁移包：把插件自己的数据打成一份可再导入的 JSON。
// 不碰聊天正文、不碰别的插件的 chat_metadata / 世界书。
import { THEATER_EXPORT_BOOK, THEATER_TEMPLATE_BOOK } from '../business/theater/constants.js';
import { INDEX_NAME, emptyIndex, fileNameOf, normalizeIndex } from '../business/coordinate/schema.js';

export const BACKUP_KIND = 'gouhua-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_PLUGIN_ID = 'schedule-planner';
export const OWN_KEYS = Object.freeze(['sp-store', 'sp-memory', 'sp-theater', 'sp-ledger']);
export const OWNED_WORLD_BOOKS = Object.freeze([THEATER_TEMPLATE_BOOK, THEATER_EXPORT_BOOK]);
export const UI_LOCAL_KEYS = Object.freeze(['sp-fab-pos', 'sp-outline-chat-h', 'sp-pos', 'sp-size']);
export const EXTERNAL_MARKER_KEY = 'sp-storage';

const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const stripJsonl = value => String(value || '').replace(/\.jsonl$/i, '');
const present = value => value !== undefined && value !== null && String(value) !== '';

export function isGouhuaBackup(data) {
    return !!data && typeof data === 'object' && data.kind === BACKUP_KIND && Number(data.version) >= 1;
}

export function isGouhuaLocalKey(key) {
    const k = String(key || '');
    return UI_LOCAL_KEYS.includes(k) || k.startsWith('sp-cache-');
}

export function isTheaterDraftKey(key) {
    return String(key || '').startsWith('sp-cache-') && /-theater-draft(-|$)/.test(String(key || ''));
}

export function pickOwnRoots(metadata) {
    const roots = {};
    if (!metadata || typeof metadata !== 'object') return roots;
    for (const key of OWN_KEYS) {
        if (metadata[key] != null && typeof metadata[key] === 'object') roots[key] = clone(metadata[key]);
    }
    return roots;
}

export function hasOwnRoots(roots) {
    return !!roots && OWN_KEYS.some(key => roots[key] != null);
}

export function applyOwnRoots(metadata, roots, { overwrite = true } = {}) {
    const target = metadata && typeof metadata === 'object' ? metadata : {};
    const incoming = roots && typeof roots === 'object' ? roots : {};
    for (const key of OWN_KEYS) {
        if (incoming[key] == null) continue;
        if (!overwrite && target[key] != null) continue;
        target[key] = clone(incoming[key]);
    }
    return target;
}

export function collectLocalStorage(storage = globalThis.localStorage, { draftsOnly = false } = {}) {
    const out = {};
    if (!storage) return out;
    for (let i = 0; i < (storage.length || 0); i++) {
        const key = storage.key(i);
        if (!isGouhuaLocalKey(key)) continue;
        if (draftsOnly && !UI_LOCAL_KEYS.includes(key) && !isTheaterDraftKey(key)) continue;
        out[key] = storage.getItem(key);
    }
    return out;
}

export function applyLocalStorage(storage, entries, { draftsOnly = false } = {}) {
    if (!storage || !entries || typeof entries !== 'object') return 0;
    let count = 0;
    for (const [key, value] of Object.entries(entries)) {
        if (!isGouhuaLocalKey(key) || value == null) continue;
        if (draftsOnly && !UI_LOCAL_KEYS.includes(key) && !isTheaterDraftKey(key)) continue;
        storage.setItem(key, String(value));
        count += 1;
    }
    return count;
}

export function applySettingsPatch(target, incoming) {
    if (!target || typeof target !== 'object' || !incoming || typeof incoming !== 'object') return 0;
    let count = 0;
    for (const [key, value] of Object.entries(incoming)) {
        if (key === 'kind' || key === 'version') continue;
        target[key] = clone(value);
        count += 1;
    }
    return count;
}

export function settingsHasSecrets(settings) {
    if (!settings || typeof settings !== 'object') return false;
    if (String(settings.apiKey || '').trim()) return true;
    return (Array.isArray(settings.apiPresets) ? settings.apiPresets : []).some(item => String(item?.key || '').trim());
}

export function chatTargetKey(target = {}) {
    const chatId = stripJsonl(target.chatId || target.file_name || target.id);
    if (target.is_group) return `group:${chatId}`;
    return `char:${String(target.avatar_url || '')}:${chatId}`;
}

export function isSameChatTarget(a, b) {
    if (!a || !b) return false;
    return chatTargetKey(a) === chatTargetKey(b);
}

export function isExternalMetadata(metadata) {
    const marker = metadata?.[EXTERNAL_MARKER_KEY];
    return !!marker && typeof marker === 'object' && marker.provider === 'st-bainiaodata';
}

export function summarizeBackup(pack) {
    if (!isGouhuaBackup(pack)) return '不是构画迁移包。';
    const chats = Array.isArray(pack.chats) ? pack.chats : [];
    const localCount = pack.localStorage && typeof pack.localStorage === 'object' ? Object.keys(pack.localStorage).length : 0;
    const coordCount = Array.isArray(pack.coordinates?.items) ? pack.coordinates.items.length : 0;
    const bookCount = Array.isArray(pack.worldbooks) ? pack.worldbooks.length : 0;
    const lines = [
        `导出时间：${pack.exportedAt || '未知'}`,
        `插件版本：${pack.pluginVersion || '未知'}`,
        pack.settings ? `设置：有${settingsHasSecrets(pack.settings) ? '（含 API 配置，请自己保管）' : ''}` : '设置：无',
        `本机草稿/位置：${localCount} 项`,
        `当前聊天账本：${hasOwnRoots(pack.currentChat?.roots) ? '有' : '无'}`,
        `其它聊天账本：${chats.length} 份`,
        `坐标收藏：${coordCount} 条`,
        `构画世界书：${bookCount} 本`,
    ];
    if (pack.skipped?.chatsFailed) lines.push(`导出时未能读取的聊天：${pack.skipped.chatsFailed}`);
    if (pack.skipped?.externalChats) lines.push(`已迁出白鳥、未写入聊天文件的账本：${pack.skipped.externalChats}（当前打开的那份仍在包里）`);
    return lines.join('\n');
}

export function parseBackupText(text) {
    let data;
    try { data = JSON.parse(String(text || '')); }
    catch { throw new Error('不是有效的 JSON'); }
    if (!isGouhuaBackup(data)) throw new Error('不是构画迁移包');
    return data;
}

export function downloadJsonFile(filename, data) {
    const text = typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`;
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return text;
}

function stampFilename(date = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `gouhua-backup-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
}

function currentChatIdentity(ctx) {
    if (!ctx?.chatId) return null;
    if (present(ctx.groupId)) {
        return { is_group: true, chatId: String(ctx.chatId), groupId: String(ctx.groupId), charName: String(ctx.name2 || '') };
    }
    const character = ctx.characters?.[ctx.characterId];
    return {
        is_group: false,
        chatId: String(ctx.chatId),
        char_name: String(character?.name || ctx.name2 || ''),
        file_name: stripJsonl(character?.chat || ctx.chatId),
        avatar_url: String(character?.avatar || ''),
        charName: String(ctx.name2 || character?.name || ''),
    };
}

function dumpCurrentRoots(ports, ctx) {
    const roots = {};
    for (const key of OWN_KEYS) {
        const fromPort = ports.getChatRoot?.(key);
        const value = fromPort && typeof fromPort === 'object' ? fromPort : ctx?.chatMetadata?.[key];
        if (value != null && typeof value === 'object') roots[key] = clone(value);
    }
    return roots;
}

function replaceRootContents(root, value) {
    if (!root || typeof root !== 'object' || !value || typeof value !== 'object') return false;
    for (const key of Object.keys(root)) delete root[key];
    Object.assign(root, clone(value));
    return true;
}

async function persistCurrent(ports) {
    const external = ports.persistExternalRoots?.({ confirmed: true });
    if (external != null) return await external;
    const ctx = ports.getContext?.();
    if (typeof ctx?.saveMetadata === 'function') return await ctx.saveMetadata();
}

function headersOf(ports) {
    return ports.headers?.() || ports.getContext?.()?.getRequestHeaders?.() || { 'Content-Type': 'application/json' };
}

async function requestJson(ports, url, body) {
    const res = await ports.fetch(url, {
        method: 'POST',
        cache: 'no-cache',
        headers: headersOf(ports),
        body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(payload?.message || payload?.error || `HTTP ${res.status}`), { status: res.status, payload });
    return payload;
}

function rowsFromChatList(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.chats)) return payload.chats;
    if (payload && typeof payload === 'object') return Object.values(payload);
    return [];
}

export async function listBackupChatTargets(ports) {
    const ctx = ports.getContext?.() || {};
    const targets = [];
    const seen = new Set();
    const push = target => {
        const key = chatTargetKey(target);
        if (!target.chatId || seen.has(key)) return;
        seen.add(key);
        targets.push(target);
    };

    const characters = Array.isArray(ctx.characters) ? ctx.characters : [];
    for (const character of characters) {
        if (!character?.avatar || !character?.name) continue;
        let payload = null;
        try {
            payload = await requestJson(ports, '/api/characters/chats', { avatar_url: character.avatar, simple: true });
        } catch {
            continue;
        }
        for (const row of rowsFromChatList(payload)) {
            const fileName = stripJsonl(row?.file_name || row?.fileName || row?.name || '');
            if (!fileName) continue;
            push({
                is_group: false,
                chatId: fileName,
                char_name: String(character.name),
                file_name: fileName,
                avatar_url: String(character.avatar),
            });
        }
    }

    const groups = Array.isArray(ctx.groups) ? ctx.groups : [];
    for (const group of groups) {
        const chats = Array.isArray(group?.chats) ? group.chats : [];
        for (const chat of chats) {
            const chatId = stripJsonl(typeof chat === 'string' ? chat : chat?.file_name || chat?.id || '');
            if (!chatId) continue;
            push({
                is_group: true,
                chatId,
                groupId: String(group.id || ''),
                groupName: String(group.name || ''),
            });
        }
    }
    return targets;
}

async function readChatFile(ports, target) {
    const payload = target.is_group
        ? await requestJson(ports, '/api/chats/group/get', { id: target.chatId })
        : await requestJson(ports, '/api/chats/get', {
            ch_name: target.char_name,
            file_name: target.file_name || target.chatId,
            avatar_url: target.avatar_url,
        });
    if (!Array.isArray(payload) || !payload.length || !payload[0] || !Object.prototype.hasOwnProperty.call(payload[0], 'chat_metadata')) {
        throw new Error('聊天文件缺少有效头部');
    }
    return payload;
}

async function writeChatFile(ports, target, payload) {
    if (target.is_group) {
        await requestJson(ports, '/api/chats/group/save', { id: target.chatId, chat: payload, force: false });
        return;
    }
    await requestJson(ports, '/api/chats/save', {
        ch_name: target.char_name,
        file_name: target.file_name || target.chatId,
        avatar_url: target.avatar_url,
        chat: payload,
        force: false,
    });
}

async function exportWorldbooks(ports) {
    const books = [];
    const load = ports.loadWorldInfo;
    if (typeof load !== 'function') return books;
    for (const name of OWNED_WORLD_BOOKS) {
        try {
            const data = await load(name);
            if (data?.entries && typeof data.entries === 'object') books.push({ name, data: clone(data) });
        } catch { /* 没有这本书就跳过 */ }
    }
    return books;
}

async function importWorldbooks(ports, books) {
    if (!Array.isArray(books) || typeof ports.saveWorldInfo !== 'function') return 0;
    let count = 0;
    for (const book of books) {
        const name = String(book?.name || '').trim();
        const data = book?.data;
        if (!name || !OWNED_WORLD_BOOKS.includes(name) || !data || typeof data !== 'object') continue;
        await ports.saveWorldInfo(name, clone(data), true);
        count += 1;
    }
    await ports.updateWorldInfoList?.();
    return count;
}

async function exportCoordinates(ports) {
    if (typeof ports.readJson !== 'function') return null;
    const result = await ports.readJson(INDEX_NAME);
    if (result?.missing || !result?.value) return { index: emptyIndex(), items: [] };
    const index = normalizeIndex(result.value) || emptyIndex();
    const items = [];
    for (const meta of index.items) {
        if (!meta?.id) continue;
        try {
            const item = await ports.readJson(fileNameOf(meta.id));
            if (!item?.missing && item?.value) items.push(clone(item.value));
        } catch { /* 单条坏了不阻断整包 */ }
    }
    return { index, items };
}

async function importCoordinates(ports, snapshot) {
    if (!snapshot || typeof ports.uploadJson !== 'function' || typeof ports.readJson !== 'function') return 0;
    const existing = await ports.readJson(INDEX_NAME);
    const current = !existing?.missing && existing?.value ? (normalizeIndex(existing.value) || emptyIndex()) : emptyIndex();
    const incoming = normalizeIndex(snapshot.index) || emptyIndex();
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    for (const item of items) {
        if (!item?.id) continue;
        await ports.uploadJson(fileNameOf(item.id), clone(item));
    }
    const itemsById = new Map(current.items.map(item => [item.id, item]));
    for (const meta of incoming.items) if (meta?.id) itemsById.set(meta.id, meta);
    const tagsById = new Map(current.tags.map(tag => [tag.id, tag]));
    for (const tag of incoming.tags) if (tag?.id) tagsById.set(tag.id, tag);
    await ports.uploadJson(INDEX_NAME, {
        version: incoming.version || current.version || 1,
        items: [...itemsById.values()],
        tags: [...tagsById.values()],
    });
    ports.invalidateCoordinates?.();
    return items.length;
}

function progress(ports, info) {
    try { ports.onProgress?.(info); } catch { /* 进度回调失败不阻断导出 */ }
}

export function createBackupController(ports = {}) {
    return {
        async exportPack() {
            const ctx = ports.getContext?.() || {};
            const current = currentChatIdentity(ctx);
            const currentRoots = dumpCurrentRoots(ports, ctx);
            const pack = {
                kind: BACKUP_KIND,
                version: BACKUP_VERSION,
                pluginId: BACKUP_PLUGIN_ID,
                pluginVersion: String(ports.pluginVersion || ''),
                exportedAt: new Date().toISOString(),
                note: '构画迁移包。含设置（可能含 API Key）、聊天账本、本机草稿、坐标、构画世界书。不含聊天正文。',
                settings: clone(ports.getSettings?.() || {}),
                localStorage: collectLocalStorage(ports.localStorage || globalThis.localStorage),
                currentChat: current ? { ...current, storageMode: ports.storageStatus?.()?.mode || 'chat', roots: currentRoots } : null,
                chats: [],
                coordinates: null,
                worldbooks: [],
                skipped: { chatsFailed: 0, externalChats: 0 },
            };

            progress(ports, { phase: 'chats', done: 0, total: 0, message: '正在枚举聊天…' });
            const targets = await listBackupChatTargets(ports);
            let done = 0;
            for (const target of targets) {
                done += 1;
                progress(ports, { phase: 'chats', done, total: targets.length, message: `正在读取聊天 ${done}/${targets.length}` });
                if (current && isSameChatTarget(current, target)) continue;
                try {
                    const payload = await readChatFile(ports, target);
                    const metadata = payload[0]?.chat_metadata || {};
                    if (isExternalMetadata(metadata)) {
                        pack.skipped.externalChats += 1;
                        continue;
                    }
                    const roots = pickOwnRoots(metadata);
                    if (!hasOwnRoots(roots)) continue;
                    pack.chats.push({ ...target, roots });
                } catch {
                    pack.skipped.chatsFailed += 1;
                }
            }

            progress(ports, { phase: 'coordinates', message: '正在导出坐标…' });
            try { pack.coordinates = await exportCoordinates(ports); }
            catch { pack.coordinates = { index: emptyIndex(), items: [] }; }

            progress(ports, { phase: 'worldbooks', message: '正在导出构画世界书…' });
            pack.worldbooks = await exportWorldbooks(ports);
            return pack;
        },

        async importPack(pack, { overwrite = true } = {}) {
            if (!isGouhuaBackup(pack)) throw new Error('不是构画迁移包');
            const result = { settings: 0, local: 0, currentChat: false, chats: 0, chatsSkipped: 0, chatsExternal: 0, coordinates: 0, worldbooks: 0 };

            result.local = applyLocalStorage(ports.localStorage || globalThis.localStorage, pack.localStorage, { draftsOnly: true });
            result.settings = applySettingsPatch(ports.getSettings?.(), pack.settings);
            if (result.settings) await ports.saveSettings?.();

            progress(ports, { phase: 'worldbooks', message: '正在导入构画世界书…' });
            result.worldbooks = await importWorldbooks(ports, pack.worldbooks);

            progress(ports, { phase: 'coordinates', message: '正在导入坐标…' });
            result.coordinates = await importCoordinates(ports, pack.coordinates);

            const ctx = ports.getContext?.() || {};
            const current = currentChatIdentity(ctx);
            const chats = Array.isArray(pack.chats) ? [...pack.chats] : [];
            if (pack.currentChat && hasOwnRoots(pack.currentChat.roots)) {
                if (current && isSameChatTarget(current, pack.currentChat)) {
                    applyCurrentChatRoots(ports, ctx, pack.currentChat.roots, overwrite);
                    await persistCurrent(ports);
                    result.currentChat = true;
                } else {
                    chats.unshift(pack.currentChat);
                }
            }

            let done = 0;
            for (const chat of chats) {
                done += 1;
                progress(ports, { phase: 'chats', done, total: chats.length, message: `正在写入聊天 ${done}/${chats.length}` });
                if (current && isSameChatTarget(current, chat)) {
                    applyCurrentChatRoots(ports, ctx, chat.roots, overwrite);
                    await persistCurrent(ports);
                    result.currentChat = true;
                    continue;
                }
                try {
                    const payload = await readChatFile(ports, chat);
                    const metadata = payload[0].chat_metadata || (payload[0].chat_metadata = {});
                    if (isExternalMetadata(metadata)) {
                        result.chatsExternal += 1;
                        continue;
                    }
                    applyOwnRoots(metadata, chat.roots, { overwrite });
                    payload[0].chat_metadata = metadata;
                    await writeChatFile(ports, chat, payload);
                    result.chats += 1;
                } catch {
                    result.chatsSkipped += 1;
                }
            }
            return result;
        },

        download(pack, filename) {
            return downloadJsonFile(filename || stampFilename(), pack);
        },
    };
}

function applyCurrentChatRoots(ports, ctx, roots, overwrite) {
    for (const key of OWN_KEYS) {
        if (roots?.[key] == null) continue;
        const live = ports.getChatRoot?.(key, { create: true, factory: () => ({}) });
        if (live && typeof live === 'object') {
            if (!overwrite && Object.keys(live).length) continue;
            replaceRootContents(live, roots[key]);
            continue;
        }
        if (!ctx?.chatMetadata) continue;
        if (!overwrite && ctx.chatMetadata[key] != null) continue;
        ctx.chatMetadata[key] = clone(roots[key]);
    }
}
