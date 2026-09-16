import {
    collectChatWorldNames,
    collectGlobalWorldNames,
    collectLinkedWorldNames,
    filterActivatedWorldInfo,
    filterExcludedWorldInfo,
    loadCharacterWorldInfoEntries,
    nextExcludeBooks,
    packWorldInfoContents,
    resolveAllWorldNames,
    resolveWorldInfoActivation,
    wiExcludeSet,
    worldInfoFailureNoticeKey,
} from './world-info-context.js';
import {
    initializeWorldInfoSelection,
    mergeWorldInfoSelection,
    normalizeWorldInfoSelectionBucket,
} from './world-info-selection.js';
import { paintWiEntryFull, paintWiExcludeList, paintWiList, worldInfoPanelIdentity } from './world-info-panel.js';

// chatKey 优先用酒馆 chat_id_hash；没有 hash 时才拼 avatar+chatId。
// 不要用 characterId（数组下标），增删角色会漂到别人的筛选桶。
export function chatStableKey(ctx, charStableKey) {
    const hash = String(ctx?.chatMetadata?.chat_id_hash || '').trim();
    if (hash) return `hash:${hash}`;
    const chatId = String(ctx?.chatId || '').trim();
    const avatar = String(charStableKey?.(ctx) || '').trim();
    return chatId && avatar ? `legacy:${avatar}:${chatId}` : null;
}

function record(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function createWorldInfoHost(env = {}) {
    const panelState = { cache: new Map(), listRevision: 0, excludeRevision: 0, theaterRevision: 0 };
    let lastFailureNoticeKey = '';
    const equals = env.equals || ((left, right) => left === right);
    const diagnosticMessage = env.diagnosticMessage || (err => String(err?.message || err || '未知错误'));
    const settings = () => env.settings?.() || {};
    const persist = () => env.saveSettingsDebounced?.();
    const contextOf = ctx => ctx || env.getContext?.() || {};
    const charKeyOf = ctx => env.charStableKey?.(contextOf(ctx)) || null;

    function getLegacyWiFilter() {
        const s = settings();
        if (!s.wiFilter) s.wiFilter = {};
        return s.wiFilter;
    }
    function getLegacyWiFilterByChat() {
        const s = settings();
        if (!s.wiFilterByChat || !record(s.wiFilterByChat)) s.wiFilterByChat = {};
        return s.wiFilterByChat;
    }
    function getWiSelectionByChat() {
        const s = settings();
        if (!s.wiSelectionByChat || !record(s.wiSelectionByChat)) s.wiSelectionByChat = {};
        return s.wiSelectionByChat;
    }
    function currentChatKey(ctx) {
        return chatStableKey(contextOf(ctx), env.charStableKey);
    }
    function getLegacyDisabledKeys(ctx) {
        const live = contextOf(ctx);
        const chatKey = currentChatKey(live);
        if (chatKey) {
            const byChat = getLegacyWiFilterByChat();
            // 显式存过空桶 = 旧版「这一聊天全放行」，不要再掉回角色卡桶。
            if (Object.prototype.hasOwnProperty.call(byChat, chatKey)) {
                return Array.isArray(byChat[chatKey]) ? byChat[chatKey] : [];
            }
        }
        const charKey = charKeyOf(live);
        const byCharacter = getLegacyWiFilter();
        return charKey && Array.isArray(byCharacter[charKey]) ? byCharacter[charKey] : [];
    }
    function ensureCurrentWiSelection(ctx, entries) {
        // 每条 worldName::uid 只在本聊天初始化一次，随后跟聊天走。旧 wiFilter 只作迁移源。
        const live = contextOf(ctx);
        const chatKey = currentChatKey(live);
        const stored = chatKey ? getWiSelectionByChat()[chatKey] : null;
        const initialized = initializeWorldInfoSelection({
            stored,
            candidates: entries,
            legacyDisabled: getLegacyDisabledKeys(live),
        });
        if (chatKey && initialized.changed) {
            getWiSelectionByChat()[chatKey] = initialized.bucket;
            persist();
        }
        return initialized.bucket;
    }
    function setCurrentWiSelection(ctx, bucket) {
        const chatKey = currentChatKey(ctx);
        const normalized = normalizeWorldInfoSelectionBucket(bucket);
        if (!chatKey || !normalized) return;
        getWiSelectionByChat()[chatKey] = normalized;
        persist();
    }
    function saveVisibleWiSelection(visible, entries) {
        const ctx = env.getContext?.();
        if (!currentChatKey(ctx)) return;
        const current = ensureCurrentWiSelection(ctx, entries);
        const merged = mergeWorldInfoSelection(current, visible);
        if (merged.changed) setCurrentWiSelection(ctx, merged.bucket);
    }

    function getWiExcludeSet() {
        // 全局按书名排除，高于角色卡关联 / 全局启用 / persona。设置列表也不再显示这些书。
        return wiExcludeSet(settings().wiExcludeBooks);
    }
    function setWiExcluded(bookName, excluded) {
        const s = settings();
        s.wiExcludeBooks = nextExcludeBooks(s.wiExcludeBooks, bookName, excluded, equals);
        persist();
    }

    function getLinkedWorldNames(ctx) {
        const live = contextOf(ctx);
        let extraBooks;
        try {
            const fileName = env.getCharaFilename?.(live.characterId);
            extraBooks = env.worldInfoCore?.world_info?.charLore?.find(item => item?.name === fileName)?.extraBooks;
        } catch { /* 没有文件名时退回卡数据 */ }
        return collectLinkedWorldNames({
            tavernHelper: env.tavernHelper?.(),
            character: live.characters?.[live.characterId] ?? {},
            extraBooks,
        });
    }
    function getGlobalWorldNames(ctx) {
        const live = contextOf(ctx);
        return collectGlobalWorldNames({
            tavernHelper: env.tavernHelper?.(),
            lukerSelection: live?.chatWorldInfo?.globalSelection,
            selectedWorldInfo: env.worldInfoCore?.selected_world_info,
            vanillaGlobalSelect: env.vanillaWorldInfo?.()?.globalSelect,
        });
    }
    function getChatWorldNames(ctx) {
        return collectChatWorldNames(contextOf(ctx)?.chatMetadata?.world_info);
    }
    async function getCharBookEntries(ctx) {
        const live = contextOf(ctx);
        const items = await loadCharacterWorldInfoEntries({
            loadWorldInfo: name => live.loadWorldInfo?.(name),
            linkedNames: getLinkedWorldNames(live),
            chatNames: getChatWorldNames(live),
            globalNames: getGlobalWorldNames(live),
            personaBook: live.powerUserSettings?.persona_description_lorebook,
            characterBook: live.characters?.[live.characterId]?.data?.character_book,
        });
        return filterExcludedWorldInfo(items, getWiExcludeSet(), equals);
    }
    async function getAllWorldNames(ctx) {
        const live = contextOf(ctx);
        return resolveAllWorldNames({
            readCached: () => typeof live?.getWorldInfoNames === 'function' ? live.getWorldInfoNames() : [],
            readHelper: async () => {
                const th = env.tavernHelper?.();
                const fn = th?.getWorldbookNames || th?.getLorebooks;
                if (typeof fn !== 'function') return [];
                return fn.call(th);
            },
            refresh: async () => {
                if (typeof live?.updateWorldInfoList !== 'function') return null;
                await live.updateWorldInfoList();
                return typeof live.getWorldInfoNames === 'function' ? live.getWorldInfoNames() : [];
            },
        });
    }

    function notifyWorldInfoActivationFailure(ctx) {
        const key = worldInfoFailureNoticeKey(ctx);
        if (lastFailureNoticeKey === key) return;
        lastFailureNoticeKey = key;
        try { env.showToast?.('世界书激活失败，本次未注入世界书', null, true); } catch { /* toast 未就绪时忽略 */ }
    }

    async function buildWorldInfoContext(ctx, { scopes = null } = {}) {
        const live = contextOf(ctx);
        const allEntries = await getCharBookEntries(live);
        const allow = Array.isArray(scopes) && scopes.length ? new Set(scopes) : null;
        const entries = allow ? allEntries.filter(entry => allow.has(entry.scope)) : allEntries;
        const selection = ensureCurrentWiSelection(live, entries);
        const coreChat = Array.isArray(live?.chat) ? live.chat.filter(message => {
            if (!message || message.is_system) return false;
            return String(message.mes ?? message.content ?? '').trim().length > 0;
        }) : [];
        const core = env.worldInfoCore || {};
        const activation = await resolveWorldInfoActivation(live, coreChat, {
            getMaxPromptTokens: env.getMaxPromptTokens,
            includeNames: core.world_info_include_names !== false,
            checkWorldInfo: core.checkWorldInfo,
            logWarn: (message, error) => env.logWarn?.(message, error),
        });
        if (activation.failed) {
            notifyWorldInfoActivationFailure(live);
            env.logActivationFailure?.({
                candidateCount: entries.length,
                lukerAvailable: typeof live?.simulateWorldInfoActivation === 'function',
                nativeAvailable: typeof core.checkWorldInfo === 'function',
            });
            return '';
        }
        const candidates = filterActivatedWorldInfo(entries, { selection, keys: activation.keys });
        if (!candidates.length) return '';
        const packed = await packWorldInfoContents(candidates);
        return packed.text;
    }

    function identity() {
        return worldInfoPanelIdentity(env.getContext?.(), charKeyOf());
    }
    function panelEnv() {
        return {
            state: panelState,
            $: env.$,
            $in: env.$in,
            $inAll: env.$inAll,
            getContext: env.getContext,
            identity,
            loadEntries: () => getCharBookEntries(env.getContext?.()),
            ensureSelection: (ctx, entries) => ensureCurrentWiSelection(ctx, entries),
            saveVisible: saveVisibleWiSelection,
            diagnosticMessage,
            escapeAttr: env.escapeAttr,
            showEntry: entry => paintWiEntryFull({ $in: env.$in, $: env.$ }, entry),
            listNames: () => getAllWorldNames(env.getContext?.()),
            excludeSet: getWiExcludeSet,
            setExcluded: setWiExcluded,
            onExcludeChange: () => { void renderList(); },
            equals,
        };
    }
    function renderList() { return paintWiList(panelEnv()); }
    function renderExcludeList() { return paintWiExcludeList(panelEnv()); }

    return {
        panelState,
        identity,
        chatStableKey: ctx => currentChatKey(ctx),
        ensureCurrentWiSelection,
        getCharBookEntries,
        getAllWorldNames,
        getLinkedWorldNames,
        getGlobalWorldNames,
        getChatWorldNames,
        getWiExcludeSet,
        setWiExcluded,
        buildWorldInfoContext,
        renderList,
        renderExcludeList,
    };
}
