import { getContext, extension_settings, extensionNames } from '../../../extensions.js';
import * as worldInfoCore from '../../../world-info.js';
import { equalsIgnoreCaseAndAccents, getCharaFilename } from '../../../utils.js';
import * as scriptCore from '../../../../script.js';
import { eventSource, event_types, substituteParams, saveSettingsDebounced, saveSettings as stSaveSettings, system_message_types } from '../../../../script.js';
import {
    buildCreativeChatSystemPrompt,
    getCreativeChatPlaceholder,
} from './state.js';
import * as memory from './memory.js';
import { createTheaterRuntime } from './business/theater/runtime.js';
import { THEATER_COUNT_DEFAULT, THEATER_EXPORT_BOOK, THEATER_TARGET_CHARS } from './business/theater/constants.js';
import { refreshFoldHtml } from './business/refresh/bar.js';
import { collectPaceRows, paceStripHtml } from './business/refresh/pace.js';
import { createPaceBook } from './business/refresh/pace-book.js';
import { createRefreshController, latestAiFloor } from './business/refresh/controller.js';
import { createActivityFeature } from './business/activity/feature.js';
import { createActivityChatStorage } from './business/activity/store.js';
import { beatFoldHtml } from './business/beat/ui.js';
import { createBeatFeature } from './business/beat/feature.js';
import { spaceMessagePlainText } from './business/space/schema.js';
import { normalizeOutlineResponse } from './business/outline/schema.js';
import { createCoordinateRuntime, getCoordinateRuntime } from './business/coordinate/runtime.js';
import { enterCoordinateSidebar } from './business/coordinate/ui.js';
import { paintScheduleHome, showPanelView } from './business/shell/panel.js';
import { panelMarkup } from './business/shell/markup.js';
import { FAB_ID, MODAL_ID } from './business/shell/ids.js';
import { createFab } from './business/shell/fab.js';
import { detectSTTheme, getEffectiveTheme as resolveTheme, nextThemeMode, paintThemeClasses, themeToggleIcon as themeIconOf, themeToggleTitle as themeTitleOf } from './business/shell/theme.js';
import { handlePanelViewClick } from './business/shell/view-switch.js';
import { createPanelWindow, runOpenSchedule } from './business/shell/window.js';
import { createTaDrawer, guessCharName } from './business/shell/ta-drawer.js';
import { bindModuleIntro, bindPanelChrome } from './business/shell/chrome.js';
import { mountPluginHosts } from './business/shell/hosts.js';
import { bindRefreshBar } from './business/refresh/bind.js';
import { bindAlmanacPanel } from './business/axis/bind.js';
import { bindLinesPanel } from './business/lines/bind.js';
import { bindInjectAndJump, bindPointPanel } from './business/point/bind.js';
import { bindAdultReveal } from './business/utils/adult-reveal.js';
import { bindActionMenuDismiss, bindManualActionMenus, closeOpenActionMenus } from './business/utils/action-menu.js';
import { bindSettingsPanel } from './runtime/settings-bind.js';
import { bindApiFields, bindDiagnostics, filterModelList } from './runtime/api-fields-bind.js';
import { bindMemorySettings } from './business/memory/settings-bind.js';
import { bindTheaterSettings } from './business/theater/settings-bind.js';
import { bindStoragePanel, migrationProgressCopy, paintStorageMode, paintStorageUsage, readStorageChatIdentity } from './runtime/storage-panel.js';
import { runChatChanged } from './runtime/chat-changed.js';
import { createApiPresetUi } from './runtime/api-presets-ui.js';
import { bindChatFloorListeners } from './runtime/st-listeners.js';
import { captureSnapshotElement } from './business/coordinate/capture.js';
import * as store from './store.js';
import { bindStoreViewFallback, keyDesc, readStore, writeStore, writeStoreConfirmed, removeStore } from './store.js';
import * as ledger from './business/ledger/repository.js';
import { createBestEffortMetadataSaver, createTargetMetadataSaver, dispatchTargetMetadataWithRefresh } from './runtime/target-metadata-save.js';
import * as theaterDeviceCache from './runtime/theater-device-cache.js';
import { createTheaterHostPorts } from './runtime/theater-host-ports.js';
import { selectVisibleChatHistory } from './business/lines/history.js';
import * as snapshot from './snapshot.js';
import { createDialogManager } from './modal.js';
import { createAutomationGate } from './automation-gate.js';
import { createDateCoordinator } from './date-coordinator.js';
import {
    TIME_TRAVEL_DIRECTION_OPTIONS,
    buildTravelDirectionPrompt,
    buildTravelStoryPrompt,
    createTimeTravelController,
    didStepComplete,
    formatTravelDate,
    parseTravelDirections,
    snapshotLastAssistant,
    removeTimeTravelBlocks,
    sameMonthDay,
} from './time-travel.js';
import {
    appendTravelPromptContext,
    collectTimeTravelContext,
    isTimeTravelSelectionCurrent,
    runTimeTravelDirectionFlow,
    timeTravelAbortReason,
    travelAnniversaryCoverage,
} from './business/axis/time-travel-session.js';
import { escapeHtml, escapeAttr, autoGrowTextarea, cleanText } from './utils/dom.js';
import { _cnToNumber, _CN_MONTH_ALIAS, extractDayFromTime } from './utils/cn-date.js';
import { weatherGlyph, maskKey } from './utils/format.js';
import { getSettings, parseExcludeParams, loadCfg, loadUtilityCfg, saveCfg, loadApiPresets, upsertApiPreset, deleteApiPreset, renameApiPreset, fabEnabled, pluginEnabled, injectEnabled, getLinesInterval, saveLinesInterval, getLinesMode, saveLinesMode, getLedgerReconcileInterval } from './runtime/settings.js';
import { postChatCompletion, callCustomApi, callMemoryApi, callTheaterApi, bindApiClient, GEN_TEMPERATURE } from './api/client.js';
import { normalizeApiUrl } from './api/sse.js';
import { safeDiagnosticLog, diagnosticMessage, makeDiagnosticError, shouldNotifyGeneration, classifyGenerationError } from './api/diagnostics.js';
import { readDiagnosticTrace, recordChatBoundary, shareRecentDiagnosticTrace, traceDiagnosticEvent } from './runtime/diagnostic-trace.js';
import {
    abortMigration,
    bindExternalChatStorage,
    buildCurrentChatDiagnosticPackage,
    getChatRoot,
    isExternalMode,
    loadExternalChat,
    migrateCurrentChat,
    persistExternalRoots,
    probeExternalBackend,
    pruneExternalSnapshots,
    refreshDiagnosticRetention,
    storageStatus,
} from './runtime/external-chat-storage.js';
import { createCoordinateHostPorts, readJson as readCoordinateJson, uploadJson as uploadCoordinateJson } from './runtime/coordinate-host-ports.js';
import { isManagedChatSurface, markTauriMobileSurface, registerChatSurfaceParticipant } from './runtime/chat-surface.js';
import { createBackupController, parseBackupText, summarizeBackup } from './runtime/backup.js';
import { ADULT_MODES, ADULT_MODE_LABELS, adultModeForCharacter } from './business/lines/adult.js';
import { axisState } from './business/axis/state.js';
import {
    ALM_TYPES,
    almId,
    getAlmanacKey,
    almClampInt,
    normalizeAlmItem,
    loadAlmanac,
    saveAlmanacItems,
    saveAlmanacItemsConfirmed,
    almTypeMeta,
    almDateLabel,
    monthDayFromDayKey,
    almValidMonthDay,
    ALM_CHAT_SCAN_LIMIT,
    almDayOfYear,
    ALM_WEEKDAYS,
    weekdayAdjacentDate,
    validRealDate,
    almMonthDayFromDoy,
    almEndMonthDay,
    almItemCoversDoy,
    getCalDescInjectText,
    parseAlmanacWidget,
    parseEraWidget,
    almDedupKey,
    mergeAlmanac,
    loadCalDesc,
    getCalDescKey,
    saveCalDesc,
    DEFAULT_CAL,
    calYearLen,
    calMonthCount,
    calMonthDays,
    calMonthName,
    calHasEra,
    CALENDAR_LIMITS,
    CALENDAR_TEMPLATE_NAME_LENGTH,
    cloneCalDesc,
    validateCalendarDesc,
    loadCalendarTemplates,
    saveCalendarTemplates,
    calendarTemplateId,
    calendarTemplateBindings,
    sortCalendarTemplatesForCurrent,
} from './business/axis/data.js';
import {
    calendarSummary,
    calendarConflicts,
    formatCalendarDate,
    formatStoryClockHeadParts,
} from './business/axis/ui.js';
// 轴锚点/周几/距今/将至排序已抽出到 business/axis/anchor.js；index.js 内部跨域读取器经 bindAxisAnchor 注入。
import {
    bindAxisAnchor,
    almTodayAnchor, almDaysUntil, almDaysBetweenFull, almWeekdayRef, almWeekdayFor,
} from './business/axis/anchor.js';
// 历注入文本构造（纯函数，仅依赖 data.js/anchor.js）已抽出到 business/axis/inject.js。
import { getAlmanacInjectText } from './business/axis/inject.js';
import { createAxisPanel } from './business/axis/panel.js';
import { renderAxisToolbar } from './business/axis/toolbar.js';
import { renderAxisUpcoming } from './business/axis/upcoming.js';
import { renderAxisCalendar } from './business/axis/calendar.js';
import { openAxisEditor, closeAxisEditor, setAxisSheet, navigateAxisMonth, createAxisEditorController, renderAxisEditor, renderAxisWeekdayHint } from './business/axis/editor.js';
import { createCalendarManager, calendarCards, calendarBindingKey, calendarBoundTemplateId, setCalendarBinding, calendarBindingCandidates } from './business/axis/manager.js';
import { createAxisUi } from './business/axis/ui.js';
import { createAxisItemUi } from './business/axis/item-ui.js';
import { createAxisActions } from './business/axis/actions.js';
import { createAxisDateActions } from './business/axis/date-actions.js';
import { createAxisCalendarActions } from './business/axis/calendar-actions.js';
import { createAxisGenerationController, validateAlmanacResponse } from './business/axis/generation.js';
import { createAxisInlineRenderer } from './business/axis/inline.js';
import { createInlineFeature } from './business/inline/feature.js';
import { createAxisWidgetActions } from './business/axis/widget.js';
import { createAxisTransactionController } from './business/axis/transaction.js';
import { createAxisPromptBuilder } from './business/axis/prompts.js';
import { createAxisDateContext } from './business/axis/date-context.js';
import { sanitizeGenerationContextText } from './runtime/generation-context.js';
import {
    almanacBlockForOptions,
    assembleGenerationMessages,
    calendarLibraryBlock,
    ledgerSourceHistory,
    mapVisibleHistoryMessage,
    memoryLibraryBlock,
    observerSystemPrompt,
    readCardExtras,
} from './runtime/generation-messages.js';
import { mountBackupOverlay as createBackupOverlay, mountMigrationOverlay as createMigrationOverlay } from './runtime/storage-overlay.js';
import { bindStoryClock, parseStoryClock as parseStoryClockPure, parseJudgedDate as parseJudgedDatePure, latestStoryClock as latestStoryClockPure, storyClockDate as storyClockDatePure, storyWeekdayRef as storyWeekdayRefPure, completeStoryClock as completeStoryClockPure, storyClockNarrativeBody, buildStoryClockPrompt, applyStoryClockToMessage, previousCompleteStoryClock, STORY_CLOCK_KEY, createStoryClockController, extensionStoryClockState } from './business/axis/story-clock.js';
import { createWeekdayConsumerContext } from './business/axis/weekday-coordinator.js';
import { buildDateJudgePrompt as buildDateJudgePromptPure } from './business/axis/date-detection.js';
import { createDateDetectionController } from './business/axis/date-detection.js';

bindExternalChatStorage({ getContext, coreModule: scriptCore, fetchImpl: (...args) => globalThis.fetch(...args) });

// Must be initialized before the top-level bindAxisAnchor() wiring below.
// Keeping this as a const preserves the shared terminal-stage semantics while
// avoiding a temporal-dead-zone read during module evaluation.
const TERMINAL_STAGES = TERMINAL_LINE_STAGES;

// ─── 点（日程）域：状态 / 解析 / 提示词 / 渲染 ────────────────────────────────
// point 业务域已从本文件抽出到 business/point/*，此处仅按需导入（机械迁移，不改行为）。
import { pointState } from './business/point/state.js';
import { parseCalendar, validateGeneratedCalendar, bindPointAdultTickets, parsePointEventRecord, firstPointEventBlock, replacePointEventBlock, buildPointInjectText, numberedPointList, mergePinnedPoints, forceStartDate } from './business/point/parse.js';
import { isGregorian as isGregorianCalendar } from './business/calendar/date.js';
import { buildPrompt } from './business/point/prompt.js';
import { bindPointRender, renderSchedule, scheduleDayCtx, scheduleDayLabel, TYPE_META } from './business/point/render.js';
import { togglePointPinRaw, deletePointEventRaw, editPointDescription, editPointFields } from './business/point/mutations.js';
import { bindPointRepository, getScheduleKey, loadCachedSchedule, refreshCachedSchedule } from './business/point/repository.js';
import { createPointActions } from './business/point/actions.js';
import { createPointWidgetActions } from './business/point/widget.js';
import { createPointController, pointScheduleNeedsDateSync } from './business/point/controller.js';
import { createPointInlineRenderer } from './business/point/inline.js';
import { pointTicketPlan } from './business/point/adult.js';
// ledger 检索前置选择器（纯逻辑三件套）已抽出到 business/ledger/select.js；到期/距今口径经 bindLedgerSelect 注入。
import { bindLedgerSelect, selectLedgerForInject } from './business/ledger/select.js';
import { bindLedgerDate, ledgerDaysSince, ledgerDueInfo, listJudgeableLedger, fmtLedgerForJudge } from './business/ledger/date.js';
import { bindLedgerSchema, splitCnList, normGist, parseLedgerCapture as parseLedgerCaptureSchema, parseLedgerJudge as parseLedgerJudgeSchema } from './business/ledger/schema.js';
import { createLedgerInjectionController } from './business/ledger/inject.js';
import { createLedgerJudgeController } from './business/ledger/judge.js';
import { createLedgerInlineRenderer } from './business/ledger/inline.js';
import { createLedgerSnapshotBridge } from './business/ledger/snapshot.js';
import { createLedgerActions } from './business/ledger/actions.js';
import { bindLedgerEvents, createLedgerDeletedHandler } from './business/ledger/events.js';
import { buildLedgerSources } from './business/ledger/reconcile.js';
import { ledgerOwnerIdentity, sameLedgerOwner } from './business/ledger/owner.js';
import { bindLedgerCapture, createLedgerCaptureController, ledgerNarrativeMessage, ledgerFloorDateContext, ledgerAiFloorRecords, LEDGER_EVENT_TYPES, LEDGER_FIELD_SPEC } from './business/ledger/capture.js';
import { filterRerollItems, shouldRunPendingPointFollowup } from './runtime/refactor-adapters.js';
import { baiBaiBookCoverage, baiBaiBookStatusHtml, readBaiBaiBookHistory, usesBaiBaiBook } from './business/memory/baibaoshu.js';
import { createTaskOwnerManager } from './runtime/task-owner.js';
import { evaluateTaskLifecycle } from './runtime/task-orchestration.js';
import { parseLines as parseCanonicalLines, TERMINAL_LINE_STAGES } from './business/lines/schema.js';
import { buildLinesPrompt as buildCanonicalLinesPrompt } from './business/lines/prompt.js';
import { createAdvanceStrategy, latestStampDay } from './business/lines/strategy.js';
import { createLinesFeature } from './business/lines/feature.js';
import { syncVectorGlyphTheme } from './business/lines/vectors/glyph.js';
import { createOutlineFeature } from './business/outline/feature.js';
import { createSpaceFeature } from './business/space/feature.js';
import { getSpaceChatPlaceholder } from './business/space/prompts.js';
import { createChatAnchorRepository } from './runtime/chat-date-anchor.js';
import {
    initializeWorldInfoSelection,
    mergeWorldInfoSelection,
    normalizeWorldInfoSelectionBucket,
    worldInfoSelectionAllows,
} from './runtime/world-info-selection.js';
import {
    appendWorldInfoBook,
    collectChatWorldNames,
    collectGlobalWorldNames,
    collectLinkedWorldNames,
    countWorldInfoTokens as countWorldInfoTokenValue,
    filterActivatedWorldInfo,
    packWorldInfoContents,
    resolveWorldInfoActivation,
    WORLD_INFO_TOKEN_BUDGET,
    worldInfoFailureNoticeKey,
} from './runtime/world-info-context.js';
import { capMemTextAsync } from './business/memory/recall.js';
import {
    dispatchStoreClearInvalidate,
    dispatchStoreClearRefreshAfter,
    dispatchStoreClearRefreshFromStore,
    STORE_CLEAR_EMPTY_LINES_HTML,
    STORE_CLEAR_EMPTY_SCHEDULE_HTML,
} from './runtime/storage-clear.js';

// 坐标与楼内框各自持有唯一 runtime 句柄。
let coordinateRuntime = null;
let inlineFeature = null;

// TauriTavern 打开聊天虚拟化后，投影变化不会伪造 CHARACTER_MESSAGE_RENDERED。
// 必须在第一次 projection 前注册；第三方扩展常常赶不上，失败则退回 DOM 观察。
const chatSurfaceRegistration = registerChatSurfaceParticipant({
    didMount({ element, mesid }) {
        coordinateRuntime?.feature?.mountMessageButton?.(element, { rebindMessageId: Number(mesid) });
        return () => coordinateRuntime?.feature?.unmountMessageButton?.(element);
    },
    didCommitContent({ element, mesid }) {
        inlineFeature?.mountElement?.(element);
        coordinateRuntime?.feature?.mountMessageButton?.(element, { rebindMessageId: Number(mesid) });
    },
});
const chatSurfaceOwnsDom = Boolean(chatSurfaceRegistration && isManagedChatSurface());

function refreshInlineWindow(immediate = false) { return inlineFeature?.refresh?.(immediate); }
function _clearAllInlineBoxes() { return inlineFeature?.clear?.(); }
function syncLatestAlmanacBlock(expectedChatId = null) {
    if (expectedChatId != null && getContext().chatId !== expectedChatId) return;
    return refreshInlineWindow(true);
}
function syncLatestScheduleBlock(expectedChatId = null) {
    if (expectedChatId != null && getContext().chatId !== expectedChatId) return;
    return refreshInlineWindow(true);
}
// ledger 暗账页渲染/编辑/批量（Option B）已抽出到 business/ledger/render.js；index.js 宿主经 bindLedgerRender 注入。
import {
    bindLedgerRender,
    batchReset, resetLedgerRenderState,
    getBatchScope, setBatchScope, getBatchSelected,
    toggleLedgerArchiveOpen, getLedgerEditor,
    ledgerTypeClass,
    openLedgerEditor, closeLedgerEditor, renderLedgerEditor,
    saveLedgerEditor,
    batchBarHtml, BATCH_SCOPES, batchScopeIds, execBatch, renderLedgerSheet, renderLedgerControls,
} from './business/ledger/render.js';
import { formatLedgerList } from './business/ledger/inline.js';

// Ledger 优先使用固定聊天目标的 integrity/commitState saver；不支持时回退 best-effort saver，均不支持才保持不可用。
const ledgerMetadataSaverReady = (() => {
    const advanced = createTargetMetadataSaver({ coreModule: scriptCore });
    return advanced?.supported ? advanced : createBestEffortMetadataSaver({ context: getContext });
})();
const getLedgerTarget = () => {
    try { return typeof scriptCore.resolveChatStateTarget === 'function' ? scriptCore.resolveChatStateTarget() : null; }
    catch { return null; }
};
ledger.bindLedgerMetadataPersistence({
    async commit(ctx, options = {}) {
        const saver = await ledgerMetadataSaverReady;
        if (!saver?.supported) return { ok: false, reason: saver?.reason || 'metadata-saver-unavailable', commitState: 'not-dispatched' };
        const current = ctx || getContext?.();
        const target = options.target || getLedgerTarget();
        if (typeof saver.commit === 'function') return saver.commit(current, { ...options, target, ownerGuard: options.compensate ? () => true : (options.ownerGuard || (() => true)) });
        const after = { ...(current?.chatMetadata || {}) };
        if (current?.chatMetadata?.['sp-ledger']) after['sp-ledger'] = current.chatMetadata['sp-ledger'];
        return dispatchTargetMetadataWithRefresh({ saver, target, afterMetadata: after, refresh: scriptCore.refreshChatWriteSnapshotsFromServer, isCurrent: options.compensate ? () => true : (options.ownerGuard || (() => true)) });
    },
});
store.bindStoreMetadataPersistence({
    async commit(ctx, options = {}) {
        const current = ctx || getContext?.();
        const ownerGuard = typeof options.ownerGuard === 'function' ? options.ownerGuard : () => true;
        const target = options.target || getLedgerTarget();
        if (!current?.chatId || !ownerGuard()) return { ok: false, reason: 'stale-before-save', commitState: 'not-dispatched', dispatched: false };
        if (ledgerMetadataSaverReady?.supported && ledgerMetadataSaverReady.mode !== 'legacy-unconfirmed') {
            const after = { ...(current.chatMetadata || {}) };
            if (current.chatMetadata?.['sp-store']) after['sp-store'] = current.chatMetadata['sp-store'];
            return dispatchTargetMetadataWithRefresh({
                saver: ledgerMetadataSaverReady,
                target,
                afterMetadata: after,
                refresh: scriptCore.refreshChatWriteSnapshotsFromServer,
                isCurrent: ownerGuard,
            });
        }
        if (typeof current.saveMetadata !== 'function') return { ok: false, reason: 'saveMetadata-unavailable', commitState: 'not-dispatched', dispatched: false };
        try {
            const result = current.saveMetadata();
            if (!result || typeof result.then !== 'function') return { ok: false, reason: 'saveMetadata-unconfirmed', commitState: 'legacy-unconfirmed', dispatched: true };
            await result;
            if (!ownerGuard()) return { ok: false, reason: 'stale-after-save', commitState: 'legacy-unconfirmed', dispatched: true };
            return { ok: true, reason: 'saveMetadata-promise-resolved', commitState: 'confirmed', dispatched: true };
        } catch (error) {
            const status = Number(error?.status ?? error?.statusCode ?? error?.httpStatus);
            return { ok: false, reason: Number.isInteger(status) ? `http-${status}` : 'saveMetadata-rejected', ...(Number.isInteger(status) ? { status } : {}), commitState: 'not-dispatched', dispatched: false, error };
        }
    },
});

const pointTaskOwners = createTaskOwnerManager();
let chatBoundaryEpoch = 0;
let pendingDateBootstrap = null;
let activeChatBoundaryIdentity = null;
function runtimeIdentityHash(value) {
    let hash = 2166136261;
    for (const ch of String(value ?? '')) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16);
}
function captureParticipantIdentity(ctx = getContext()) {
    const character = ctx?.characters?.[ctx?.characterId] || {};
    const personaDescriptor = ctx?.powerUserSettings?.persona_name ?? ctx?.powerUserSettings?.default_persona ?? ctx?.powerUserSettings?.persona_description ?? '';
    return Object.freeze({
        boundaryEpoch: chatBoundaryEpoch,
        chatId: String(ctx?.chatId ?? ''),
        characterId: String(ctx?.characterId ?? ''),
        characterKey: String(character?.avatar || charStableKey(ctx) || ''),
        personaKey: runtimeIdentityHash(personaDescriptor),
        userName: String(ctx?.name1 || '用户'),
        charName: String(ctx?.name2 || '角色'),
    });
}
function sameParticipantIdentity(left, right) {
    return !!left && !!right && ['boundaryEpoch', 'chatId', 'characterId', 'characterKey', 'personaKey', 'userName', 'charName'].every(key => String(left[key] ?? '') === String(right[key] ?? ''));
}
function captureGenerationContext(ctx = getContext()) {
    const chat = Array.isArray(ctx?.chat) ? ctx.chat.map(message => ({ ...message, extra: message?.extra && typeof message.extra === 'object' ? { ...message.extra } : message?.extra })) : [];
    return { ...ctx, chat, name1: ctx?.name1 || '用户', name2: ctx?.name2 || '角色' };
}
function captureChatBoundary() { return Object.freeze({ epoch: chatBoundaryEpoch, chatId: String(getContext()?.chatId ?? '') }); }
function isCurrentChatBoundary(boundary) { return !!boundary && boundary.epoch === chatBoundaryEpoch && boundary.chatId === String(getContext()?.chatId ?? ''); }
function scheduleForChatBoundary(callback, delay) {
    const boundary = captureChatBoundary();
    return setTimeout(() => { if (isCurrentChatBoundary(boundary)) callback(boundary); }, delay);
}
function latestFloorBoundaryIdentity() {
    const ctx = getContext(); const messageId = (ctx?.chat?.length ?? 0) - 1;
    if (messageId < 0) return null;
    return Object.freeze({ ...captureChatBoundary(), messageId, swipeId: Number(ctx.chat?.[messageId]?.swipe_id ?? 0), contentSignature: _floorSig(messageId) || 'empty' });
}
function downloadJsonFile(filename, text) {
    const blob = new Blob([String(text ?? '')], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function consumeDateBootstrap(messageId) {
    const pending = pendingDateBootstrap;
    if (!pending) return false;
    const current = buildDateRenderKey(messageId);
    const matches = isCurrentChatBoundary(pending) && pending.messageId === current.messageId && pending.swipeId === current.swipeId && pending.contentSignature === current.contentSignature;
    if (matches) pendingDateBootstrap = null;
    return matches;
}
let theaterFeature;
let memoryPauseNoticeShown = false;
function createTheaterHostFeature() {
    const runtime = createTheaterRuntime({
        storage: globalThis.localStorage, coreModule: scriptCore, getContext, callTheaterApi,
        buildWorldInfoContext: (ctx, opts) => buildWorldInfoContext(ctx, opts), readCardExtras: ctx => readCardExtras(ctx), getMemText: () => getMemText(),
        names: () => ({ userName: getContext().name1 || '用户', charName: getContext().name2 || '角色' }),
        settings: () => { const s = getSettings(); return { theaterStylePrompt: typeof s.theaterStylePrompt === 'string' ? s.theaterStylePrompt : '', theaterCount: s.theaterCount, theaterPoolBooks: Array.isArray(s.theaterPoolBooks) ? s.theaterPoolBooks : [] }; },
        onDiagnostic: diagnostic => { console.warn('[SP theater]', diagnostic); if (getSettings().notifyMode === 'full') showToast('棱生成时有可恢复错误，已尽量保留结果', null, true); },
        stage: text => { if (theaterMode) setTheaterBody(loadingHtml(`正在${text}`, 'sp-abort-theater')); }, renderAiMessageHtml,
        downloadJson: downloadJsonFile,
        ports: createTheaterHostPorts({ $, $in, inEl, documentRef: globalThis.document, getContext, captureTarget: chatId => runtime?.captureTarget?.(chatId), theaterMode: () => theaterMode, modalId: () => MODAL_ID, setBody: html => setTheaterBody(html), loading: loadingHtml, escapeHtml, escapeAttr, settings: getSettings, saveSettingsDebounced, showToast, showPanel, spConfirm, scriptCore, listWorldNames: () => getAllWorldNames(getContext()), syncSettingsPoolList: () => { void renderTheaterPoolList(); }, snapshotContext: () => { const ctx = getContext() || {}; const el = document.querySelector('#selected_chat_pole, #chat_name_pole, .current_chat_name'); return { chatId: ctx.chatId ?? null, chatIdHash: ctx.chatMetadata?.chat_id_hash ?? null, chatName: el?.value || el?.textContent?.trim() || ctx.chatId || '当前聊天', charName: ctx.name2 || '角色' }; }, saveSnapshot: item => { const coordinate = getCoordinateRuntime(); if (!coordinate?.feature?.saveFromTheater) throw new Error('坐标还没就绪'); return coordinate.feature.saveFromTheater(item); } }),
    });
    return runtime.feature;
}

// Shadow-DOM accessors are dependencies of the top-level DI wiring below.
// Declare them before any bind/create call can evaluate the dependency.
let _spShadow = null;
let _spDialogShadow = null;
let _activeSpConfirmCancel = null;
let _activeStoreConflictFinish = null;
const $in  = (sel) => { const el = _spShadow?.querySelector(sel); return el ? $(el) : $(); };
const inEl = (sel) => _spShadow?.querySelector(sel) ?? null;
const $inAll = (sel) => $(Array.from(_spShadow?.querySelectorAll(sel) ?? []));
const $dialog = (sel) => {
    const el = _spDialogShadow?.querySelector(sel);
    return el ? $(el) : $();
};
const removeDialogOverlays = () => {
    $dialog('#sp-confirm, #sp-store-conflict, #sp-addon-dialog').remove();
};

// store 视图态回退桥：keyDesc 缺省 view/charName 时回退到当前视图/角色（闭包捕获实时值）。
bindStoreViewFallback(() => currentView, () => charViewName);

const chatAnchorRepository = createChatAnchorRepository({
    chatId: () => getContext()?.chatId,
    read: () => readStore(keyDesc('date-anchor', 'user', '')),
    write: value => writeStore(keyDesc('date-anchor', 'user', ''), value),
    writeConfirmed: (value, options) => writeStoreConfirmed(keyDesc('date-anchor', 'user', ''), value, options),
    legacy: () => {
        const key = charStableKey(getContext());
        const value = key ? getSettings().dateAnchor?.[key] : null;
        return value ? { ...value, identity: `${key}:${value.month}/${value.day}` } : null;
    },
});
function latestStoryOwnerIdentity() {
    const context = getContext(); const clock = latestStoryClockPure(context, ALM_CHAT_SCAN_LIMIT); const floor = Number.isInteger(clock?.floor) ? clock.floor : null; const message = floor == null ? null : context?.chat?.[floor];
    return { chatId: context?.chatId || null, floor, swipe: message?.swipe_id ?? message?.mes_id ?? null };
}
const axisDateActions = createAxisDateActions({
    repository: chatAnchorRepository,
    charKey: () => charStableKey(getContext()),
    calendar: loadCalDesc,
    today: almTodayAnchor,
    dayOfYear: almDayOfYear,
    monthDayFromDoy: almMonthDayFromDoy,
    monthCount: calMonthCount,
    monthDays: calMonthDays,
    pending: () => chatAnchorRepository.pending(),
    weekday: (month, day, ref, cal) => almWeekdayFor(month, day, ref, cal),
    floor: () => latestStoryOwnerIdentity().floor,
    chatId: () => latestStoryOwnerIdentity().chatId,
    swipe: () => latestStoryOwnerIdentity().swipe,
    confirm: spConfirm,
    aftermath: () => runAnchorAftermath(),
    monthName: (cal, month) => calMonthName(cal, month),
    toast: showToast,
});

// 绑定 API 网络层所需的 UI/业务回调（避免 api/client.js 反向依赖 index.js 造成循环引用）。
bindApiClient({
    setFabBusy,
    setLastDebugPayload: (v) => { lastDebugPayload = v; },
    buildMessages,
    getDiagnosticContext: () => {
        const ctx = getContext?.() || {};
        let messageId = null;
        for (let i = (ctx.chat?.length || 0) - 1; i >= 0; i--) {
            const message = ctx.chat[i];
            if (message && !message.is_user && !message.is_system && !message.is_hidden && !message?.extra?.is_hidden && String(message.mes || '').trim()) { messageId = i; break; }
        }
        return {
            chatId: ctx.chatId ?? null,
            chatRevision: pointTaskOwners.currentChatRevision(),
            boundaryEpoch: chatBoundaryEpoch,
            floor: messageId,
            messageId,
        };
    },
});

// 点渲染回调注入：render.js 的点日期上下文、标签与辅助渲染函数需访问本文件的
// almTodayAnchor/almWeekdayRef/almWeekdayFor/makeInjectBtn，经 bindPointRender 注入以避免反向依赖（循环引用）。
bindPointRender({ almTodayAnchor, almWeekdayRef, almWeekdayFor, makeInjectBtn, settings: getSettings });
bindPointRepository({ keyDesc, readStore, renderSchedule, loadCalendar: loadCalDesc });
const pointActions = createPointActions({
    inShadow: $inAll,
    $,
    getCacheKey: (...args) => getCacheKey(...args),
    readStore,
    writeStore,
    renderSchedule,
    loadCalendar: loadCalDesc,
    parseCalendar,
    togglePointPinRaw,
    deletePointEventRaw,
    editPointDescription,
    editPointFields: (raw, day, index, values) => editPointFields(raw, day, index, values),
    promptFields: options => customDialog.promptFields(options),
    setEditing: value => { manualEditing.point = value; },
    isBusy: () => pointState.isGenerating || axisState._almSyncingPoint,
    setCached: html => { pointState.cachedSchedule = html; },
    setBody,
    currentView: () => currentView,
    currentChar: () => charViewName,
    syncLatestScheduleBlock,
    showToast,
    confirm: spConfirm,
    chatId: () => getContext().chatId,
    captureParticipantIdentity,
    sameParticipantIdentity,
});
const applyPointWidget = createPointWidgetActions({
    firstPointEventBlock,
    parsePointEventRecord,
    getCacheKey: (...args) => getCacheKey(...args),
    readStore,
    writeStore,
    replaceNthEventLine,
    getUserName: () => getContext().name1 || '用户',
    currentView: () => currentView,
    renderSchedule,
    loadCalendar: loadCalDesc,
    setCached: html => { pointState.cachedSchedule = html; },
    shouldShowPanel: () => !outlineMode && !linesMode && !spaceMode && $(`#${MODAL_ID}`).is(':visible'),
    setBody,
    syncLatestScheduleBlock,
    showToast,
});
const pointController = createPointController({
    owners: pointTaskOwners,
    state: pointState,
    evaluate: evaluateTaskLifecycle,
    chatId: () => getContext().chatId,
    enabled: pluginEnabled,
    setButton: setExtBtnState,
    showEmpty: showEmptyGenerate,
    syncing: () => axisState._almSyncingPoint,
    toast: showToast,
    view: () => currentView,
    char: () => charViewName,
    precheck: memoryPreCheckConfirm,
    panelVisible: () => $(`#${MODAL_ID}`).is(':visible'),
    showPanel,
    setBody,
    loading: loadingHtml,
    abortAuto: () => { _autoRegenSchedAbort?.abort('superseded-owner'); },
    context: getContext,
    captureContext: captureGenerationContext,
    captureParticipantIdentity,
    sameParticipantIdentity,
    key: (...args) => getCacheKey(...args),
    read: readStore,
    write: writeStore,
    writeConfirmed: writeStoreConfirmed,
    parse: parseCalendar,
    calendar: loadCalDesc,
    generate,
    validate: validateGeneratedCalendar,
    mergePinned: mergePinnedPoints,
    today: almTodayAnchor,
    forceStart: forceStartDate,
    render: renderSchedule,
    sync: syncLatestScheduleBlock,
    setChar: value => { charViewName = value; },
    setCached: html => { pointState.cachedSchedule = html; },
    notify: () => getSettings().notifyMode,
    canCommit: (owner, travel) => evaluateTaskLifecycle({ manager: pointTaskOwners, owner, chatId: getContext().chatId, chatRevision: pointTaskOwners.currentChatRevision(), signal: travel?.signal, pluginEnabled: pluginEnabled() }).canCommit,
    editing: () => manualEditing.point,
    adultMode: identity => getAdultMode(identity?.characterKey || charStableKey(getContext())),
    bindAdult: bindPointAdultTickets,
    logDiagnostic: diagnostic => console.warn('[SP point failure]', diagnostic),
    canCallback: owner => evaluateTaskLifecycle({ manager: pointTaskOwners, owner, chatId: getContext().chatId, chatRevision: pointTaskOwners.currentChatRevision(), pluginEnabled: pluginEnabled(), phase: 'callback' }).canCallback,
    setView,
    showEmpty: showEmptyGenerate,
    escape: text => escapeHtml(text),
    config: loadCfg,
    setAuto: controller => { _autoRegenSchedAbort = controller; return controller; },
    setSyncing: value => { axisState._almSyncingPoint = value; },
    clearBusy: () => { if (axisState.almanacMode) renderAlmanacPanel(); $in('#sp-body .sp-refresh-schedule').removeClass('sp-refresh-busy'); },
    cached: () => pointState.cachedSchedule,
    monthName: month => calMonthName(loadCalDesc(), month),
    followupState: (owner, travel, allow, pending) => evaluateTaskLifecycle({ manager: pointTaskOwners, owner, chatId: getContext().chatId, chatRevision: owner.chatRevision, signal: travel?.signal, pluginEnabled: pluginEnabled(), allowPendingFollowup: allow, pending }),
    shouldFollowup: (life, travel, allow, owner) => shouldRunPendingPointFollowup({ pending: life.canFollowup, allowPendingFollowup: allow, signalAborted: travel?.signal?.aborted, chatSame: getContext().chatId === owner.chatId && pointTaskOwners.currentChatRevision() === owner.chatRevision, pointGenerating: pointState.isGenerating, needsSync: schedulePointNeedsSync(travel?.targetScope || { view: owner.view, charName: owner.charName }, travel?.targetDate) }) && life.canFollowup,
});
const pointInlineRenderer = createPointInlineRenderer({
    settings: getSettings,
    readRaw: () => readCacheRaw(getCacheKey('user', '')),
    loadCalendar: loadCalDesc,
    parseCalendar,
    scheduleDayCtx,
    scheduleDayLabel,
    weatherGlyph,
    escapeHtml,
    escapeAttr,
    weekdays: ALM_WEEKDAYS,
    typeMeta: TYPE_META,
    makeInjectBtn,
    buildPointInjectText,
    cleanText,
});
const parseJudgedDate = parseJudgedDatePure;

// ledger 选择器注入：select.js 的打分/门槛依赖到期/距今口径 ledgerDueInfo/ledgerDaysSince
// （二者仍滞留本文件、且另经历法助手触达），经 bindLedgerSelect 注入以免反向依赖循环引用。
bindLedgerSelect({ ledgerDaysSince, ledgerDueInfo });
const axisDateContext = createAxisDateContext({ today: almTodayAnchor, daysUntil: almDaysUntil, daysUntilFull: almDaysBetweenFull, weekdayRef: almWeekdayRef, weekdayFor: almWeekdayFor });
bindLedgerDate({ today: () => axisDateContext.today(), daysUntil: axisDateContext.daysUntil, daysUntilFull: axisDateContext.daysUntilFull, listEntries: () => ledger.listEntries() });
bindLedgerSchema({ parseJudgedDate, ledgerTypes: ledger.TYPES });
bindLedgerCapture({
    context: getContext,
    parseClock: parseStoryClockPure,
    parseDate: parseJudgedDate,
    stripTags: (text) => memory.stripTags(text, { keepTags: getSettings().keepTags, extraTags: getSettings().extraTags }),
    settings: getSettings,
    systemTypes: system_message_types,
    eventTypes: LEDGER_EVENT_TYPES,
    fieldSpec: LEDGER_FIELD_SPEC,
});
const ledgerCaptureController = createLedgerCaptureController({
    context: getContext,
    target: getLedgerTarget,
    charKey: charStableKey,
    config: loadCfg,
    provenanceConfig: loadUtilityCfg,
    calendar: loadCalDesc,
    validDate: almValidMonthDay,
    today: almTodayAnchor,
    appendTravel: appendTravelPromptContext,
    callApi: callCustomApi,
    parseCapture: parseLedgerCaptureSchema,
    listEntries: options => ledger.listEntries(options),
    normGist,
    addAtomic: ledger.addEntriesAtomic,
    applyAtomic: (plan, owner) => ledger.applyCapturePlanAtomic(plan, owner),
    bridge: bridgeAbortSignal,
    confirm: spConfirm,
    toast: showToast,
    settings: getSettings,
    refresh: () => ledgerInjectionController.refresh(),
    refreshInline: refreshInlineWindow,
    render: () => { if (axisState.almanacMode && axisState._almanacSheet === 'ledger') renderAlmanacPanel(); },
    setProgress: () => { if (axisState.almanacMode) renderAlmanacPanel(); },
});
const reconcileLedgerSources = async (owner = null) => {
    const logSourceError = (error, counts = {}) => { try { const save = error?.saveResult; console.error('[SP ledger source reconcile]', { phase: error?.phase || 'source-state-invalid', cause: error?.code || error?.phase || 'unknown', reason: save?.reason || null, commitState: save?.commitState || null, saveReason: save?.saveReason || null, path: save?.path || null, httpStatus: save?.status || null, dispatched: save?.dispatched ?? null, counts: { cleaned: counts.cleaned || 0, remapped: counts.remapped || 0, pending: counts.pending || 0, lockedMissing: counts.lockedMissing || 0, kept: counts.kept || 0, deleted: counts.deleted || 0 } }); } catch {} };
    let records;
    try { records = ledgerAiFloorRecords(); } catch (error) { error.phase = 'source-scan-failed'; logSourceError(error); return { changed: false, summary: {}, phase: error.phase, error }; }
    let sources;
    try { sources = buildLedgerSources(records); } catch (error) { error.phase = 'source-state-invalid'; logSourceError(error); return { changed: false, summary: {}, phase: error.phase, error }; }
    try { return await ledger.reconcileEntriesAtomic(sources, getContext()?.chat?.length || 0, owner); }
    catch (error) { logSourceError(error, error.planSummary); return { changed: false, summary: error.planSummary || {}, phase: error.phase || 'source-save-failed', error }; }
};
const runLedgerCaptureStep = (manual = false, travelContext = null) => ledgerCaptureController.run(manual, travelContext);
const ledgerInjectionController = createLedgerInjectionController({
    context: getContext,
    enabled: injectEnabled,
    settings: getSettings,
    entries: () => ledger.listEntries(),
    select: selectLedgerForInject,
    today: almTodayAnchor,
    daysSince: ledgerDaysSince,
    dueInfo: ledgerDueInfo,
    narrative: ledgerNarrativeMessage,
    stripTags: text => memory.stripTags(text, { keepTags: getSettings().keepTags, extraTags: getSettings().extraTags }),
});
const refreshLedgerInjection = () => ledgerInjectionController.refresh();
const ledgerJudgeController = createLedgerJudgeController({
    context: getContext,
    target: getLedgerTarget,
    charKey: charStableKey,
    listJudgeable: options => listJudgeableLedger(options),
    fmtLedger: fmtLedgerForJudge,
    config: loadCfg,
    calendar: loadCalDesc,
    validDate: almValidMonthDay,
    today: almTodayAnchor,
    floorContext: ledgerFloorDateContext,
    appendTravel: appendTravelPromptContext,
    callApi: callCustomApi,
    parseJudge: parseLedgerJudgeSchema,
    getEntry: id => ledger.getEntry(id),
    identity: () => ledgerOwnerIdentity(getContext() || {}),
    applyAtomic: (patches, owner) => ledger.applyJudgePatchesAtomic(patches, owner),
    reconcile: reconcileLedgerSources,
    update: (id, patch) => ledger.updateEntry(id, patch),
    close: id => ledger.closeEntry(id),
    dayOfYear: almDayOfYear,
    monthDayFromDoy: almMonthDayFromDoy,
    bridge: bridgeAbortSignal,
    setFabBusy,
    settings: getSettings,
    toast: showToast,
    refreshInject: refreshLedgerInjection,
    refreshInline: refreshInlineWindow,
    render: () => { if (axisState.almanacMode && axisState._almanacSheet === 'ledger') renderAlmanacPanel(); },
});
const runLedgerJudgeStep = (manual = false, travelContext = null) => ledgerJudgeController.run(manual, travelContext);
const ledgerInlineRenderer = createLedgerInlineRenderer({
    settings: getSettings,
    calendar: loadCalDesc,
    entries: () => ledger.listEntries(),
    echo: () => ledgerInjectionController.echo,
    capturing: () => ledgerCaptureController.isBusy,
    judging: () => ledgerJudgeController.isBusy,
    typeClass: ledgerTypeClass,
});
const _buildLedgerBlockHtml = (poolArg = null, readOnly = false, calendarOverride = undefined) => ledgerInlineRenderer.buildPool(poolArg, readOnly, calendarOverride);
const _buildUserRecallBoxHtml = (snap, isLatest, calendarOverride = undefined) => ledgerInlineRenderer.buildRecall(snap, isLatest, calendarOverride);
const ledgerSnapshotBridge = createLedgerSnapshotBridge({
    context: getContext,
    readPoint: () => readCacheRaw(getCacheKey('user', '')),
    readLine: () => readStore(getLinesCacheKey())?.raw || '',
    loadAlmanac,
    today: almTodayAnchor,
    entries: () => ledger.listEntries(),
    calendar: loadCalDesc,
    cloneCalendar: cloneCalDesc,
    weekdayRef: () => almWeekdayRef(loadCalDesc()),
    echo: () => ledgerInjectionController.echo,
    write: (id, value) => snapshot.writeSnapshot(id, value),
});
const freezeSnapshotToFloor = mesId => ledgerSnapshotBridge.freeze(mesId);
const ledgerActions = createLedgerActions({
    get: id => ledger.getEntry(id), lock: id => ledger.lockEntry(id), unlock: id => ledger.unlockEntry(id),
    mute: id => ledger.muteEntry(id), unmute: id => ledger.unmuteEntry(id), close: id => ledger.closeEntry(id),
    reopen: id => ledger.reopenEntry(id), remove: id => ledger.removeEntry(id), confirm: spConfirm, toast: showToast,
    refreshInject: refreshLedgerInjection,
    refreshPanel: () => { if (axisState.almanacMode && axisState._almanacSheet === 'ledger') renderAlmanacPanel(); },
    refreshInline: refreshInlineWindow,
});

// 轴锚点注入：anchor.js 的 almTodayAnchor/almWeekdayRef 需读本文件内的跨域来源
// （日期锚点/角色键/线缓存键+解析/点缓存键/终态集），经 bindAxisAnchor 注入以避免反向依赖循环引用。
bindAxisAnchor({
    getDateAnchor,
    getStoryCalibration: () => getStoryCalibration(charStableKey(getContext())),
    charStableKey,
    getLinesCacheKey,
    parseLines,
    TERMINAL_STAGES,
    getCacheKey: () => getCacheKey('user', ''),
});

// ledger 暗账页渲染注入：render.js 的行/编辑/批量需本文件宿主的 shadow 查询/提示/确认/主楼同步/
// 面板重绘/标注间隔与忙碌态。isCapturingLedger/isJudgingLedger 经 controller getter 读取实时状态。
bindLedgerRender({
    $in,
    showToast,
    splitCnList,
    spConfirm,
    syncLatestAlmanacBlock,
    renderAlmanacPanel: (...args) => renderAlmanacPanel(...args),
    getLedgerCaptureInterval,
    getLedgerCaptureProgress: () => ledgerCaptureController.progress,
    isCapturingLedger: () => ledgerCaptureController.isBusy,
    isJudgingLedger: () => ledgerJudgeController.isBusy,
    renderLedgerControls,
});

const almToolbarHtml = () => renderAxisToolbar(actionMenuHtml);
const axisItemUi = createAxisItemUi({
    typeMeta: almTypeMeta, weekdays: ALM_WEEKDAYS, weekdayFor: almWeekdayFor,
    clampInt: almClampInt, yearLength: calYearLen, itemCoversDoy: almItemCoversDoy,
    dateLabel: almDateLabel, batchScope: getBatchScope, batchSelected: getBatchSelected,
    escapeHtml,
});
const renderAlmanacUpcoming = () => renderAxisUpcoming({ renderAlmanacEmpty: axisItemUi.emptyHtml, batchBarHtml, almRowHtml: axisItemUi.rowHtml });
const renderAlmanacCalendar = () => renderAxisCalendar({ almRowHtml: axisItemUi.rowHtml });
const axisCalendarManager = createCalendarManager({
    render: (...args) => renderAlmanacPanel(...args),
    load: loadCalDesc,
    clone: cloneCalDesc,
    createState: () => ({ editing: false, draft: cloneCalDesc(loadCalDesc()), error: '', templatesOpen: false, bindTemplateId: null, bindQuery: '' }),
    readDraft: () => readCalendarDraftForm(),
    limits: CALENDAR_LIMITS,
    confirm: (...args) => customDialog.confirm(...args),
    chatId: () => getContext().chatId,
    cards: currentCharacterCards,
    bindings: calendarTemplateBindings,
    currentAvatar: () => charStableKey(getContext()),
    boundId: calendarBoundTemplateId,
    bindingCandidates: calendarBindingCandidates,
    templates: loadCalendarTemplates,
    templateId: calendarTemplateId,
    saveTemplates: saveCalendarTemplates,
    sortTemplates: sortCalendarTemplatesForCurrent,
    batchScope: getBatchScope,
    batchSelected: getBatchSelected,
    batchBar: batchBarHtml,
    escapeHtml,
    escapeAttr,
    setBinding: setCalendarBinding,
    writeBindings: bindings => { getSettings().calendarTemplateBindings = bindings; },
    save: saveSettingsDebounced,
    applyTemplate: options => maybeApplyBoundCalendarTemplate(options),
    validate: validateCalendarDesc,
    commit: cal => axisTransactionController.commit(cal),
    applyCalendar: (template) => axisTransactionController.commit(template),
    writeBindings: bindings => { getSettings().calendarTemplateBindings = bindings; },
    onApplyError: error => { console.error('[SP calendar] 角色默认历法应用失败', safeDiagnosticLog('axis', 'save', error)); showToast('角色绑定已更新，但默认历法没有应用成功，请稍后重试', null, true); },
    limits: { ...CALENDAR_LIMITS, monthNameLength: CALENDAR_LIMITS.monthNameLength, eraNameLength: CALENDAR_LIMITS.eraNameLength },
    root: () => $in('#sp-almanac-wrap'),
    $,
    activeElement: () => _spShadow?.activeElement,
});
const axisEditorController = createAxisEditorController({
    read: () => ({ name: String($in('#sp-alm-f-name').val() || '').trim(), type: $in('#sp-alm-f-type').val(), month: $in('#sp-alm-f-month').val(), day: $in('#sp-alm-f-day').val(), days: $in('#sp-alm-f-days').val(), displayDate: $in('#sp-alm-f-disp').val(), note: $in('#sp-alm-f-note').val() }),
    load: loadAlmanac,
    id: almId,
    normalize: normalizeAlmItem,
    persist: items => saveAlmanacItems(items),
    render: () => closeAxisEditor(renderAlmanacPanel),
    afterSave: syncLatestAlmanacBlock,
});
function deferredRenderAlmanacPanel(...args) { return renderAlmanacPanel(...args); }
const axisActions = createAxisActions({
    load: loadAlmanac, save: saveAlmanacItems, confirm: spConfirm, toast: showToast,
    render: deferredRenderAlmanacPanel, sync: syncLatestAlmanacBlock, clear: () => $inAll('#sp-almanac-wrap .sp-alm-cell-linked').removeClass('sp-alm-cell-linked'),
    calendar: loadCalDesc, month: almCalMonth, clamp: almClampInt, yearLength: calYearLen, dayOfYear: almDayOfYear, monthDayFromDoy: almMonthDayFromDoy,
    chatId: () => getContext().chatId, captureParticipantIdentity, sameParticipantIdentity,
});
const axisCalendarActions = createAxisCalendarActions({
    selectedDay: () => axisState._almanacCalDay,
    setSelectedDay: value => { axisState._almanacCalDay = value; },
    render: () => renderAlmanacPanel(),
    clearItemClass: () => $inAll('#sp-almanac-wrap .sp-alm-item-linked').removeClass('sp-alm-item-linked'),
    clearCellClass: () => $inAll('#sp-almanac-wrap .sp-alm-cell-linked').removeClass('sp-alm-cell-linked'),
    itemLinked: id => $in(`#sp-almanac-wrap .sp-alm-item[data-id="${id}"]`).hasClass('sp-alm-item-linked'),
    setItemLinked: id => $in(`#sp-almanac-wrap .sp-alm-item[data-id="${id}"]`).addClass('sp-alm-item-linked'),
    item: id => loadAlmanac().find(item => item.id === id),
    highlight: item => axisActions.highlight(item),
    linkCell: day => $in(`#sp-almanac-wrap .sp-alm-cell[data-day="${day}"]`).addClass('sp-alm-cell-linked'),
    hasLinked: () => $inAll('#sp-almanac-wrap .sp-alm-item-linked').length > 0,
});
const axisPromptBuilder = createAxisPromptBuilder({ loadCalDesc, calMonthCount, calYearLen, isGregorianCalendar, getCalDescInjectText });
const buildAlmanacPrompt = axisPromptBuilder.buildAlmanacPrompt;
const buildAnniversarySupplementPrompt = axisPromptBuilder.buildAnniversarySupplementPrompt;
const axisGenerationController = createAxisGenerationController({
    context: () => captureGenerationContext(), config: loadCfg, callApi: callCustomApi,
    prompt: (user, char) => buildAlmanacPrompt(user, char),
    supplementPrompt: (user, char, existing) => buildAnniversarySupplementPrompt(user, char, existing),
    validate: validateAlmanacResponse, parse: parseAlmanacWidget, merge: mergeAlmanac,
    loadItems: loadAlmanac, saveItems: saveAlmanacItemsConfirmed, dedupKey: almDedupKey, dateLabel: almDateLabel,
    sync: syncLatestAlmanacBlock, render: () => { if (axisState.almanacMode) renderAlmanacPanel(); },
    notify: (message, generated) => { if (generated) { if (axisState.almanacMode) { if (getSettings().notifyMode !== 'off') showToast(message); } else showToast(message, () => { $in('.sp-view-btn[data-view="almanac"]').trigger('click'); showPanel(); }); } else if (getSettings().notifyMode !== 'off') showToast(message); },
    error: (error, supplement) => showToast(`${supplement ? '补录失败：' : '轴生成失败：'}${diagnosticMessage(error)}`, null, true),
    missingApi: () => { if (!settingsOpen) toggleSettings(); showToast('请先在设置中填写自定义 API', null, true); },
    missingChat: () => showToast('请先打开一个聊天', null, true),
    confirm: () => spConfirm({ title: '重新生成节日', body: '将按当前世界观重新铺一整年的既定日期。已锁定的条目和你手动添加的日期会保留，未锁定的 AI 条目会被替换。', confirmText: '生成', cancelText: '取消' }),
    captureParticipantIdentity,
    sameParticipantIdentity,
});
const axisTransactionController = createAxisTransactionController({
    chatId: () => getContext().chatId, items: loadAlmanac, conflicts: calendarConflicts, charKey: () => charStableKey(getContext()), anchor: key => getSettings().dateAnchor?.[key],
    monthCount: cal => calMonthCount(cal), monthDays: (cal, month) => calMonthDays(cal, month), choose: options => customDialog.choose(options), writeBatch: entries => store.writeBatch(entries), setAnchor: (key, month, day) => setDateAnchor(key, month, day),
    syncAlmanac: syncLatestAlmanacBlock, syncSchedule: syncLatestScheduleBlock, pluginEnabled, readCal: () => readStore(getCalDescKey()), readItems: () => readStore(getAlmanacKey())?.items,
    bindings: calendarTemplateBindings, bindingKey: calendarBindingKey, cards: currentCharacterCards, templates: loadCalendarTemplates, clone: cloneCalDesc, saveCal: saveCalDesc, saveSettings: saveSettingsDebounced,
    render: () => { if (axisState.almanacMode) renderAlmanacPanel(); }, notifyMode: () => getSettings().notifyMode, toast: showToast,
    captureParticipantIdentity, sameParticipantIdentity,
});
const renderCalendarManager = axisCalendarManager.renderCalendarManager;
const refreshCalendarManager = axisCalendarManager.refreshCalendarManager;

// 面板工厂在 axisUi 的后置初始化前创建；包装只在实际渲染时读取目标函数。
function deferredAlmTodayBarHtml(...args) { return almTodayBarHtml(...args); }
function deferredStoryClockBarHtml(...args) { return storyClockBarHtml(...args); }

// Axis sheet orchestration lives in business/axis; render details are injected
// from this host to keep DOM/runtime dependencies out of the business module.
const renderAlmanacPanel = createAxisPanel({
    $in,
    getLedgerEditor,
    refreshCalendarManager,
    renderCalendarManager,
    renderAlmanacEditor,
    renderLedgerEditor,
    renderLedgerSheet,
    renderLedgerControls,
    renderAlmanacCalendar,
    renderAlmanacUpcoming,
    almToolbarHtml,
    almTodayBarHtml: deferredAlmTodayBarHtml,
    storyClockBarHtml: deferredStoryClockBarHtml,
    almRenderWdHint,
    loadingHtml,
    _almGenLabel: () => axisState._almGenLabel,
});

// Time travel orchestration stays at the host boundary: the controller is
// transport/UI agnostic while each existing domain keeps its own generation
// and persistence logic. The gate/coordinator prevent duplicate automation
// when the rendered floor triggers the normal listeners in the same tick.
const automationGate = createAutomationGate();
const dateCoordinator = createDateCoordinator();
const AUTOMATION_MODULES = Object.freeze({ LINES: 'lines', OUTLINE: 'outline', POINT: 'point', LEDGER_CAPTURE: 'ledger-capture', LEDGER_JUDGE: 'ledger-judge' });
function bridgeAbortSignal(externalSignal, internalController) {
    if (!externalSignal) return () => {};
    const abort = () => internalController.abort(externalSignal.reason ?? 'external-abort');
    if (externalSignal.aborted) internalController.abort(externalSignal.reason ?? 'external-abort');
    else externalSignal.addEventListener('abort', abort, { once: true });
    return () => externalSignal.removeEventListener('abort', abort);
}

bindStoryClock({
    loadCalendar: loadCalDesc,
    validMonthDay: almValidMonthDay,
    validRealDate,
    defaultCalendar: DEFAULT_CAL,
    monthDayFromKey: monthDayFromDayKey,
    extractDay: extractDayFromTime,
    cnToNumber: _cnToNumber,
    monthAlias: _CN_MONTH_ALIAS,
    explicitWeekdayDate: (text, cal) => weekdayAdjacentDate(text, cal == null || cal === DEFAULT_CAL || cal.kind === 'gregorian' || cal.id === 'default-gregorian'),
    context: getContext,
    dayOfYear: almDayOfYear,
});
const storyClockController = createStoryClockController({
    context: getContext,
    pluginEnabled,
    enabled: () => getSettings().storyClockEnabled !== false,
    settings: getSettings,
    peerState: () => extensionStoryClockState({ extensionNames, disabledExtensions: extension_settings.disabledExtensions, extensionSuffix: '/ST-QianQianJie', peerSettings: extension_settings.qianqianjie }),
});
const storyClockEnabled = () => getSettings().storyClockEnabled !== false;
const STORY_CLOCK_COORDINATION_EVENT = 'qqj-sdc-story-clock-settings-changed';
const storyClockStatusCopy = state => ({
    custom: '使用自定义时间戳提示词',
    'adapted-peer-custom': '已适配千千结时间戳',
    injected: '已调用构画时间戳',
    cleared: '正文时间戳已关闭',
    unavailable: '宿主暂不支持时间戳注入',
})[state?.status] || '时间戳状态会在下一次正文生成前刷新';
const announceStoryClockChange = () => {
    try { if (typeof globalThis.CustomEvent === 'function') globalThis.dispatchEvent?.(new globalThis.CustomEvent(STORY_CLOCK_COORDINATION_EVENT, { detail: { owner: 'sdc' } })); } catch {}
};
const refreshStoryClockInjection = ({ announce = false } = {}) => {
    const state = storyClockController.refresh();
    try { $('#sp-storyclock-coordination').text(storyClockStatusCopy(state)); } catch {}
    if (announce) announceStoryClockChange();
    return state;
};
globalThis.addEventListener?.(STORY_CLOCK_COORDINATION_EVENT, event => { if (event?.detail?.owner !== 'sdc') refreshStoryClockInjection(); });
const latestStoryClock = () => latestStoryClockPure(getContext(), ALM_CHAT_SCAN_LIMIT);
const storyClockDate = () => storyClockDatePure(getContext(), parseJudgedDatePure, ALM_CHAT_SCAN_LIMIT);
const dateDetectionController = createDateDetectionController({
    context: () => captureGenerationContext(),
    charKey: ctx => charStableKey(ctx),
    config: loadUtilityCfg,
    storyEnabled: storyClockEnabled,
    storyDate: storyClockDate,
    storyClock: () => latestStoryClockPure(getContext(), ALM_CHAT_SCAN_LIMIT),
    completeStoryClock: clock => completeStoryClockPure(clock),
    identity: latestStoryOwnerIdentity,
    getCalibration: () => getStoryCalibration(charStableKey(getContext())),
    prompt: () => buildDateJudgePromptPure(getCalDescInjectText()),
    callApi: callCustomApi,
    parse: parseJudgedDatePure,
    bridge: bridgeAbortSignal,
    getAnchor: getDateAnchor,
    setAnchor: setDateAnchor,
    setAnchorConfirmed: (_charKey, month, day, source, anchorOptions, persistenceOptions) => chatAnchorRepository.setConfirmed(month, day, source, anchorOptions, persistenceOptions),
    settings: getSettings,
    monthName: month => calMonthName(loadCalDesc(), month),
    toast: showToast,
    logDiagnostic: diagnostic => console.warn('[SP axis failure]', diagnostic),
    aftermath: () => runAnchorAftermath(),
    captureParticipantIdentity,
    sameParticipantIdentity,
});
const applyDetectedDate = (charKey, md, { notify = true } = {}) => dateDetectionController.apply(charKey, md, notify);
const relandStoryClockAnchor = options => dateDetectionController.reland(options);
const runJudgeDateStep = options => dateDetectionController.run(options);
const timeTravel = createTimeTravelController({
    getChatId: () => getContext().chatId,
    getChat: () => getContext().chat,
    getCalendar: () => loadCalDesc(),
    resolveDestinationDate: async ({ chatId, messageId, selectedTargetDate, signal }) => {
        const cal = loadCalDesc();
        const target = almValidMonthDay(selectedTargetDate, cal);
        if (!target) throw new Error('无法读取时光旅行选择的目标日期');
        if (chatId !== getContext().chatId || signal?.aborted) throw Object.assign(new Error('时光旅行会话已失效'), { name: 'AbortError' });
        const chat = getContext().chat || [];
        const floor = chat[Number(messageId)];
        const clock = parseStoryClockPure(floor?.mes || '');
        const clockDate = parseJudgedDate(clock.end) || parseJudgedDate(clock.start);
        const key = buildDateRenderKey(messageId);
        if (clockDate) {
            const applied = applyDetectedDate(charStableKey(getContext()), clockDate, { notify: false });
            if (applied.status === 'failed') throw new Error('日期锚点保存失败');
            dateCoordinator.recordResult(key, { ...applied, date: clockDate });
            return clockDate;
        }
        if (getSettings().almanacAutoDetect === false) {
            const applied = applyDetectedDate(charStableKey(getContext()), target, { notify: false });
            if (applied.status === 'failed') throw new Error('日期锚点保存失败');
            dateCoordinator.recordResult(key, { ...applied, date: target });
            return target;
        }
        const result = await dateCoordinator.ensureResolved(key, {
            signal,
            // 时旅是普通日期监听的下游消费者：同一版正文只要已有一次判定终态，
            // 无论有日期、未知或失败，都直接复用；只有完全没有记录时才补跑一次。
            // 这是调用方窄策略，不改变 coordinator 其他调用方默认的“只接受有日期结果”。
            acceptPrevious: previous => previous != null && typeof previous === 'object',
            resolve: ({ signal: coordinatorSignal }) => runJudgeDateStep({ messageId, signal: coordinatorSignal }),
        });
        if (signal?.aborted || result?.status === 'cancelled') throw Object.assign(new Error('日期确认已取消'), { name: 'AbortError' });
        const judged = almValidMonthDay(result?.date, cal);
        if (judged) return judged;
        const currentKey = buildDateRenderKey(messageId);
        const sameRender = currentKey.chatId === key.chatId
            && currentKey.messageId === key.messageId
            && currentKey.swipeId === key.swipeId
            && currentKey.contentSignature === key.contentSignature;
        if (!sameRender || chatId !== getContext().chatId || signal?.aborted) throw Object.assign(new Error('正文版本已变化'), { name: 'AbortError' });
        const applied = applyDetectedDate(charStableKey(getContext()), target, { notify: false });
        if (applied.status === 'failed') throw new Error('日期锚点保存失败');
        dateCoordinator.recordResult(key, { ...applied, date: target });
        showToast('未能从正文确认日期，已采用你选择的时旅目标日');
        return target;
    },
    onStateChange: ({ state }) => {
        axisState.timeTravelState = state;
        const calendarVisible = axisState.almanacMode
            && axisState._almanacSheet === 'calendar'
            && !axisState._almanacManager
            && !axisState._almanacEditor
            && !getLedgerEditor()
            && !axisState.isGeneratingAlmanac;
        if (calendarVisible) renderAlmanacPanel({ preserveBodyScroll: true });
    },
    onStepResult: ({ key, result, destinationDate }) => {
        if (!didStepComplete(result)) return;
        if (key === AUTOMATION_MODULES.LINES) { if (getLinesMode() !== 'manual') linesFeature.resetCounter(); }
        if (key === AUTOMATION_MODULES.OUTLINE) outlineFeature.resetJudgeCounter();
        if (key === AUTOMATION_MODULES.LEDGER_CAPTURE) paceBook.ledgerCapture.resetCounter();
        if (key === AUTOMATION_MODULES.LEDGER_JUDGE) paceBook.ledgerJudge.resetCounter();
        if (key === AUTOMATION_MODULES.LINES && getLinesMode() === 'days') {
            const target = destinationDate;
            if (target?.month != null && target?.day != null) linesFeature.setLastDay(`${+target.month}-${+target.day}`);
        }
        persistPaceNow();
    },
    onSequenceEnd: ({ sessionId }) => releaseTimeTravelClaim(sessionId),
    onError: error => {
        console.error('[SP 时光旅行] 同步流程失败', safeDiagnosticLog('time-travel', 'request', error));
        showToast('时光旅行同步未完整完成，请手动检查各模块', null, true);
    },
    steps: [
        // 线不再被时旅步骤直生；若时旅确实落地正常新 AI 楼，由 MESSAGE_RECEIVED→CMR 统一入口处理。
        { key: AUTOMATION_MODULES.LINES, canRun: () => false, run: async () => ({ status: 'skipped' }) },
        { key: AUTOMATION_MODULES.OUTLINE, canRun: () => outlineFeature.canRelocate(), run: ({ promptAddon, signal }) => outlineFeature.relocate(promptAddon, signal) },
        { key: AUTOMATION_MODULES.POINT, canRun: () => !!readStore(getCacheKey('user', ''))?.raw, run: ({ destinationDate, promptAddon, signal }) => syncPointToToday(false, { targetDate: destinationDate, targetScope: { view: 'user', charName: '' }, promptAddon, feedback: 'time-travel', signal, allowPendingFollowup: false }) },
        { key: AUTOMATION_MODULES.LEDGER_CAPTURE, canRun: () => getSettings().ledgerCaptureEnabled === true, run: ({ destinationDate, promptAddon, signal }) => runLedgerCaptureStep(true, { targetDate: destinationDate, promptAddon, feedback: 'time-travel', signal }) },
        { key: AUTOMATION_MODULES.LEDGER_JUDGE, canRun: () => getSettings().ledgerCaptureEnabled === true, run: ({ destinationDate, promptAddon, signal }) => runLedgerJudgeStep(true, { targetDate: destinationDate, promptAddon, feedback: 'time-travel', signal }) },
    ],
});

// 自动化闸·会话级 token 登记：CMR 预检抢占（isInitialFloor 才占）→ 流程收尾（完成/失败/取消）经 onSequenceEnd 释放。
const _timeTravelClaimTokens = new Map();   // sessionId → automationGate token
function isAutomationSuppressed(messageId, moduleName) {
    return automationGate.isSuppressed({ scopeId: getContext().chatId, messageId, module: moduleName });
}
function releaseTimeTravelClaim(sessionId) {
    const token = _timeTravelClaimTokens.get(sessionId);
    if (!token) return;
    _timeTravelClaimTokens.delete(sessionId);
    automationGate.release(token);
}
function clearAutomationClaims() {
    _timeTravelClaimTokens.clear();
    automationGate.clear();
}
// 日期协调的楼层级 key：chatId + messageId + swipe + 内容签名，与 almanacJudge 共用同一把 key，
// 保证「戳直读」与「API 兜底」对同一楼层只解析一次（并发渲染去重）。
function buildDateRenderKey(messageId) {
    const ctx = getContext();
    const mid = Number(messageId);
    return {
        chatId: String(ctx.chatId ?? ''),
        messageId: mid,
        swipeId: Number(ctx.chat?.[mid]?.swipe_id ?? 0),
        contentSignature: _floorSig(mid) || 'empty',
    };
}

let _timeTravelSelectionSeq = 0;
let _activeTimeTravelSelection = null;

function timeTravelCoverageHelpers() {
    return {
        dayOfYear: almDayOfYear,
        itemCoversDoy: almItemCoversDoy,
        yearLength: calYearLen,
        clampInt: almClampInt,
        endMonthDay: almEndMonthDay,
    };
}

function collectLiveTimeTravelContext(sourceDate, targetDate) {
    return collectTimeTravelContext(sourceDate, targetDate, {
        calendar: loadCalDesc(),
        weekdayFor: (m, d, ref, cal) => axisDateContext.weekdayFor(m, d, ref, cal),
        weekdayRef: cal => axisDateContext.weekdayRef(cal),
        weekdays: ALM_WEEKDAYS,
        readOutlineSnapshot: () => outlineFeature.readSnapshot(),
        readLines: () => parseCanonicalLines(readStore(getLinesCacheKey())?.raw || ''),
        terminalStages: TERMINAL_LINE_STAGES,
        injectionOn: injectEnabled(),
        settings: getSettings(),
        ledgerEchoLength: ledgerInjectionController.echo.length,
        almanacItems: loadAlmanac(),
        coverage: (item, date, cal) => travelAnniversaryCoverage(item, date, cal, timeTravelCoverageHelpers()),
        typeLabel: type => almTypeMeta(type).label,
    });
}

function isLiveTimeTravelSelection(run) {
    return isTimeTravelSelectionCurrent(run, {
        active: _activeTimeTravelSelection,
        pluginEnabled: pluginEnabled(),
        chatId: getContext().chatId,
        travelState: timeTravel.getState(),
        validTarget: almValidMonthDay(run.targetDate, loadCalDesc()),
    });
}

async function startTimeTravel(targetDate) {
    const sourceDate = almTodayAnchor();
    const validTarget = almValidMonthDay(targetDate, loadCalDesc());
    if (!validTarget || sameMonthDay(sourceDate, validTarget)) return false;
    const initialChatId = getContext().chatId;
    const existing = timeTravel.getState();
    if (existing?.phase === 'syncing') {
        showToast('时光旅行正在同步，完成或中断后才能开始新的时旅');
        return false;
    }
    if (existing?.phase === 'waiting') {
        const confirmed = await customDialog.confirm({
            title: '先中断旧的时光旅行？',
            body: '输入框里还有一段尚未发送的时旅指令。开始新的时旅会移除旧指令。',
            confirmText: '中断并继续',
            cancelText: '保留旧时旅',
        });
        const current = timeTravel.getState();
        if (!current || current.sessionId !== existing.sessionId || current.phase !== existing.phase || getContext().chatId !== initialChatId) {
            showToast('时旅状态已经变化，本次没有覆盖当前会话');
            return false;
        }
        if (!confirmed) return false;
        clearTimeTravelSession(existing, { removeWaitingBlock: true, reason: 'replaced' });
    }

    const run = {
        id: ++_timeTravelSelectionSeq,
        chatId: initialChatId,
        sourceDate: { month: sourceDate.month, day: sourceDate.day },
        targetDate: { month: validTarget.month, day: validTarget.day },
    };
    _activeTimeTravelSelection = run;
    try {
        return await runTimeTravelDirectionFlow({
            run,
            isCurrent: isLiveTimeTravelSelection,
            collectContext: collectLiveTimeTravelContext,
            jumpTitle: (date, cal) => `跳到 ${formatTravelDate(date, cal)}`,
            selectDirection: async ({ title, initialValue, customValue }) => customDialog.selectOne({
                title,
                body: '选择这次时间变化后的剧情方向。直接采用不会调用 API；AI 推演会先给出三个候选方向。',
                choices: TIME_TRAVEL_DIRECTION_OPTIONS,
                initialValue,
                custom: { value: 'custom', initialValue: customValue, placeholder: '写下希望发生的剧情方向…', maxLength: 300, rows: 3 },
                actions: [
                    { value: 'direct', label: '直接采用' },
                    { value: 'ai', label: 'AI 推演', primary: true },
                ],
                validate: value => value.value === 'custom' && !String(value.customValue || '').trim() ? '请先填写自定义剧情方向' : '',
            }),
            buildStoryPrompt: buildTravelStoryPrompt,
            inject: injectToST,
            begin: payload => timeTravel.begin(payload),
            backValue: '__back__',
            selectAiDirection: async ({ excluded, preference, run, onDirections }) => customDialog.selectOneAsync({
                title: '选择 AI 推演方向',
                body: '选择一条作为本次时旅方向；刷新会中止上一轮，并避开本次已经展示过的结果。',
                refreshable: true,
                refreshText: '换一批',
                confirmText: '采用方向',
                cancelText: '返回',
                cancelValue: '__back__',
                loadingText: '正在推演三个方向…',
                emptyText: '没有得到可用方向，请刷新重试',
                loadChoices: async ({ signal }) => {
                    if (!isLiveTimeTravelSelection(run)) throw Object.assign(new Error('时旅选择已结束'), { name: 'AbortError' });
                    const cfg = loadCfg();
                    if (!cfg.url || !cfg.key) throw new Error('请先在设置中填写自定义 API 的 URL 和 Key；也可以返回后直接采用');
                    const live = collectLiveTimeTravelContext(run.sourceDate, run.targetDate);
                    const prompt = buildTravelDirectionPrompt({ ...live, preference, excluded });
                    const ctx = getContext();
                    const raw = await callCustomApi(ctx, prompt, cfg, ctx.name1 || '用户', ctx.name2 || '角色', signal, 10, { temperature: GEN_TEMPERATURE, promptMode: 'creative', diagnosticModule: 'time-travel-direction' });
                    if (signal?.aborted || !isLiveTimeTravelSelection(run)) throw Object.assign(new Error('时旅选择已结束'), { name: 'AbortError' });
                    const directions = parseTravelDirections(raw, excluded);
                    if (!directions.length) throw new Error('AI 没有返回可用方向，请刷新重试');
                    onDirections?.(directions);
                    return directions.map(value => ({ value, label: value }));
                },
            }),
        });
    } finally {
        if (_activeTimeTravelSelection === run) _activeTimeTravelSelection = null;
    }
}

function clearTimeTravelSession(active = timeTravel.getState(), { removeWaitingBlock = false, reason = 'cleared' } = {}) {
    if (!active) return false;
    const abortReason = timeTravelAbortReason(reason);
    traceDiagnosticEvent('abort-boundary', { module: 'time-travel', chatId: active.chatId, chatRevision: pointTaskOwners.currentChatRevision(), boundaryEpoch: chatBoundaryEpoch, abortReason, status: 'dispatch' });
    timeTravel.clear(reason);
    // clear() 不触发 onSequenceEnd（controller 只在 handleRendered 收尾时发），闸/协调器须随取消显式释放，
    // 否则 token 滞留 → 后续正常自动化被误抑制（同 chatId+messageId 复活场景）或协调器内存滞留。
    clearAutomationClaims();
    dateCoordinator.clear();
    dateDetectionController.abort(abortReason);
    linesFeature.abortGeneration({ reason: abortReason });
    outlineFeature.judge.abort(abortReason);
    _autoRegenSchedAbort?.abort(abortReason);
    ledgerCaptureController.abort(abortReason);
    ledgerJudgeController.abort(abortReason);
    if (removeWaitingBlock && active.phase === 'waiting') {
        const input = $('#send_textarea');
        if (input.length) input.val(removeTimeTravelBlocks(String(input.val() || ''))).trigger('input');
    }
    return true;
}

async function cancelTimeTravel() {
    const active = timeTravel.getState();
    if (!active) return false;
    const waiting = active.phase === 'waiting';
    const confirmed = await customDialog.confirm({
        title: waiting ? '取消这次时光旅行？' : '中止时光旅行同步？',
        body: waiting
            ? '确认后会移除输入框中尚未发送的时旅指令。'
            : '确认后会停止当前及后续同步；已经完成的模块更新会保留。',
        confirmText: waiting ? '取消时旅' : '中止同步',
        cancelText: '继续当前时旅',
    });
    const current = timeTravel.getState();
    if (!current || current.sessionId !== active.sessionId || current.phase !== active.phase) {
        showToast('时旅状态已经变化，本次没有中断当前会话');
        return false;
    }
    if (!confirmed) return false;
    clearTimeTravelSession(active, { removeWaitingBlock: waiting, reason: 'cancelled' });
    showToast(waiting ? '已取消时光旅行' : '已中止时光旅行同步；已完成的更新会保留');
    return true;
}

function cancelTimeTravelForDeletion() {
    const active = timeTravel.getState();
    if (!active) return false;
    const waiting = active.phase === 'waiting';
    clearTimeTravelSession(active, { removeWaitingBlock: waiting, reason: 'message-deleted' });
    showToast(waiting
        ? '楼层已删除，未发送的时旅指令也已移除'
        : '楼层已删除，时旅同步已中止；已完成的更新会保留');
    return true;
}

// 扩展目录绝对路径（引自身 style.css 进 shadow）；ST 站点根（引 fontawesome.min.css，
// 与 ST 共用浏览器缓存）。import.meta.url = …/scripts/extensions/third-party/ST-SevenDaysCal/index.js
const EXT_BASE = new URL('.', import.meta.url).href;                 // …/ST-SevenDaysCal/
const ST_BASE  = new URL('../../../../../', import.meta.url).href;   // ST 站点根（public/ 即 /）

// 模块介绍：内容标题旁「?」点开的小气泡文案。键对应侧栏 data-view，面向使用者讲清用途与真实操作。
// 想改文字直接改这里即可（纯展示，不入库、不注入 AI）。
// 小百科·图标图例：模块介绍气泡内容。lede（这模块干嘛的·一句话）+ 若干「真 FontAwesome 图标 + 名称 + 一句话」，
// 图标与界面所见一致，用户对号入座即知每个钮啥意思。渲染端用 .html() 注入（内容全为作者手写、无用户输入，无注入面）。精简为主。
const _iLede = t => `<p class="sp-intro-lede">${t}</p>`;
const _iSub  = t => `<div class="sp-intro-sub">${t}</div>`;
const _iKey  = (icon, name, desc) => `<div class="sp-intro-key"><i class="fa-solid ${icon}"></i><b>${name}</b><span>${desc}</span></div>`;
const _iSvgKey = (svg, name, desc) => `<div class="sp-intro-key">${svg}<b>${name}</b><span>${desc}</span></div>`;
const _coordinateIntroSvg = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3.5 L6 18 L20.5 18"/><circle cx="14" cy="9.4" r="1.9" fill="currentColor" stroke="none"/></svg>';

const MODULE_INTROS = {
    schedule:
        _iLede('「点」从故事里的“今天”开始，为我／TA 安排接下来 3 天的事项，并把更远的事另列在“未来”；它不是人物此刻状态卡。时间戳是全局时间锚点，也负责星期判定，由主楼 AI 随回复输出，构画只读取、解析和展示，不会自行生成；是否出现、格式完整与时间合理取决于模型是否遵循提示词和主楼剧情质量，缺失或不完整时无法凭空补出可靠时间，可能让时间判断失真；没有可靠记录时不猜现实星期。') +
        _iSub('默认不会随日期自动重排，也不会塞给主楼。想更新用顶上的「刷新账本」；卡住下一楼时打开「本轮拍」。后台对齐、推进的结果记在侧栏「改」。设置 → 跟剧情走 里可打开「点/线按楼对齐」。') +
        _iKey('fa-rotate-right', '生成／刷新', '按最新剧情重做未锁事项；新结果会覆盖旧的未锁数据') +
        _iKey('fa-thumbtack',    '固定 TA',    '只把当前 TA 留在 TA▾ 抽屉，方便下次查看；不是锁定事项') +
        _iKey('fa-ellipsis-vertical', '⋮ 菜单', '每条点的操作都收在这里') +
        _iKey('fa-pen',          '编辑',       '手动修改这条事项') +
        _iKey('fa-lock',         '锁定',       '刷新时保住同名事项不被删除；时间、说明等仍可能随新剧情推进') +
        _iKey('fa-arrow-right-to-bracket', '注入', '把这条点写进输入框，供你确认或修改后发送；不是后台注入') +
        _iKey('fa-trash',        '删除',       '移除这条事项'),
    almanac:
        _iLede('「轴」有“即将到来”“日历”“刻度”三页：前两页管理节日、生日、纪念日与故事历法；刻度页跟踪伤情、约定、周期等会随时间变化的账。时间戳是全局时间锚点，也负责星期判定，由主楼 AI 随回复输出，构画只读取、解析和展示，不会自行生成；主楼未输出或格式不完整时无法凭空补出可靠时间，可能让时间判断失真；没有可靠记录时不猜现实星期。') +
        _iSub('节日 · 历法') +
        _iKey('fa-plus',          '添加',       '手动录入节日／生日／纪念日；手动项生成时会保留') +
        _iKey('fa-wand-magic-sparkles', '生成节日', '按世界观重做一整年：保留手动项和锁定项，替换未锁的旧 AI 日期') +
        _iKey('fa-heart-circle-plus', '补录纪念日', '只追加剧情中新出现的重大里程碑，可能没有结果；新增项自动锁定') +
        _iKey('fa-calendar-days', '历法管理',   '查看、编辑月份／天数／纪年和历法模板；换历法遇到无效日期时会先让你选择取消、删除或自动修正') +
        _iKey('fa-lock',          '锁定',       '以后生成节日时保留这条') +
        _iKey('fa-pen',           '编辑',       '修改名称、日期、说明等') +
        _iKey('fa-trash',         '删除',       '移除这条日期') +
        _iSub('刻度 · 时间账') +
        _iLede('刻度分持续状态／约定待办／周期三类。自动标注默认关闭；也可在刻度页或楼内“标注池”点［标注］捞取新条、点［更新］按时间刷新现状。潜伏注入也默认关闭，并且必须同时开启“允许潜伏注入主楼 AI（线 / 面 / 刻度）”总开关和刻度自己的“潜伏注入主楼 AI”才生效。') +
        _iKey('fa-pen',         '编辑',     '手动改字段；保存后自动成为用户锁') +
        _iKey('fa-lock',        '锁定',     'AI 更新不再改这条；与是否注入主楼是两回事') +
        _iKey('fa-bell',        '暂停埋入', '暂不注入主楼，但仍留在活跃账上继续跟进；再点恢复') +
        _iKey('fa-check',       '了结',     '从活跃区移到归档，之后仍可捞回') +
        _iKey('fa-rotate-left', '捞回',     '归档区：让已了结条目回到活跃区') +
        _iKey('fa-trash',       '彻底删除', '归档区：不可恢复地删除'),
    lines:
        _iLede('「线」有“平行事件”和“冷知识”两页。平行事件追踪仍在发展的伏笔、人物行动与局势；冷知识默认关，开了以后住在这一页，楼内只留一句提示。') +
        _iSub('新装默认手动推进。要自动时推荐「故事日期变了就走」；走偏了靠点/线按楼对齐，不要等换日。对齐和推进撞车时本楼先对齐、推进下一楼补。塞给主楼要另开总闸和线自己的开关。') +
        _iKey('fa-rotate-right', '重新生成', '重做未锁定的线；锁定线保留') +
        _iKey('fa-forward',      '推进',     '更新已有线，并可能新增少量真正独立的事件') +
        _iKey('fa-plus',         '新增冷知识', '在“冷知识”页选择主题生成；只在冷知识开关开启后可用') +
        _iKey('fa-ellipsis-vertical', '⋮ 菜单', '每条平行事件的操作都收在这里') +
        _iKey('fa-pen',          '编辑',     '手动修改这条线') +
        _iKey('fa-lock',         '锁定',     '重新生成时保留这条线；AI 不能替你创建用户锁') +
        _iKey('fa-arrow-right-to-bracket', '注入', '把单条线写进输入框，供你确认后发送') +
        _iKey('fa-trash',        '删除',     '移除这条线'),
    outline:
        _iLede('「面」左侧是一整份剧情大纲，右侧是只针对这份面的 AI 讨论。面板上的［重新生成］仍会换整份面；刷新账本勾了面时，可以只改当前节点、往后续写，或整份替换。') +
        _iSub('自动判定只把「现在演到哪」往后指，绝不整份重写。它和“把当前节点塞给主楼”是两件事。塞给主楼要另开总闸和面自己的开关。') +
        _iKey('fa-rotate-right',        '重新生成',   '按最新剧情重做并覆盖整份面；刷新条默认只改当前节点') +
        _iKey('fa-paper-plane',         '发送讨论',   '在右侧向 AI 讨论、修改或索要一版新面') +
        _iKey('fa-broom',               '清空讨论',   '只清右侧讨论记录，不删除左侧现有面') +
        _iKey('fa-ellipsis-vertical',   '⋮ 菜单',     '每个节点的操作都收在这里') +
        _iKey('fa-pen',                 '编辑',       '手动修改这个节点') +
        _iKey('fa-location-crosshairs', '设为当前',   '把这个节点标成正在进行；已是当前时显示“取消当前”') +
        _iKey('fa-arrow-right-to-bracket', '注入',    '把单个节点写进输入框，供你确认后发送') +
        _iKey('fa-copy',                '复制',       '复制这个节点的文字') +
        _iKey('fa-trash',               '删除',       '只删除这个节点'),
    space:
        _iLede('「间」是局外创作顾问：可以聊剧情、设定、人物和世界观，也能把 AI 给出的结构化卡片落到其他模块。这里不会写入正式角色扮演楼层，也不会直接推进剧情。发送新问题时会先清理较旧记录；一轮完整问答结束后，最多可能暂时显示 21 条间内消息。') +
        _iSub('空窗时可以点「引导设计」：给我灵感或我来描述，问答后确认才写入点／线／面。落地规则：新点追加到“未来”且不会自动锁；改点会替换指定条目。新线追加后自动锁定，改已有线则保留它原来的锁态。轴日期只做去重追加并自动锁定。应用历法会换掉当前月份／天数／纪年；若现有日期不适用，会先让你选择取消、删除冲突日期或自动修正。') +
        _iKey('fa-compass',       '引导设计',   '收束点／线／面；确认前不改账本。不问番外，不填棱。可顺手出本轮拍') +
        _iKey('fa-paper-plane',    '发送',       '把问题发给局外创作顾问') +
        _iKey('fa-pen',            '编辑并重发', '只在你的消息上出现；会从这里截断后续记录并重新提问') +
        _iKey('fa-copy',           '复制',       '只复制这条消息的普通文字；结构化卡片不会随消息一起复制') +
        _iKey('fa-trash',          '删除',       '删除单条间内消息') +
        _iKey('fa-broom',          '清空',       '清掉当前聊天的全部间内记录') +
        _iKey('fa-plus',           '应用到点／线／轴', '按上面的规则写入对应模块') +
        _iKey('fa-calendar-check', '应用历法',    '确认冲突处理后换用这套历法'),
    theater:
        _iLede('「棱」＝纯文字番外：空框时先跨书抽签冻结每一面，再像兔子镜那样一次请求连写 1～3 面。世界书只给棱读，不要绑到角色卡。喜欢的条目可导出为新世界书「构画-棱-兔子镜母本」，再自己导进兔子镜。要留下某条正文，点收藏进坐标快照。') +
        _iKey('fa-book', '抽取用世界书', '在棱页顶部勾选。把小回 / 极光 / 小兔导入酒馆后勾上即可，不要绑到角色卡。设置 → 提示词与标签 → 棱 · 写作与抽取世界书里也有同一份清单。') +
        _iKey('fa-shuffle', '随机模板', '从勾选世界书里随便抽一条「内容」填进输入框。再按一次换另一条。框里有内容时只生成这一条。') +
        _iKey('fa-wand-magic-sparkles', '生成番外', '可空输入：空着就抽 N 条。框里有字（含随机模板）时只按这一条写。') +
        _iKey('fa-heart', '喜欢', '勾选后点「导出已选」生成新世界书母本，不是把原书再导一遍。') +
        _iKey('fa-star', '收藏', '把这条小剧场存进坐标快照，和楼层收藏同一份永久库。草稿只是本机草稿纸，新会挤旧。') +
        _iSub('［重新生成］再抽一轮。可先改标题再点［收藏］。草稿最多 12 条。'),
    anchor:
        _iLede('「坐标」收藏的是 AI 楼层正文的副本，也可以收下棱里的小剧场。方便以后回看，不是完整样式快照。入口受设置 → 通用设置 → 显示与通知管理里的“收藏此楼入口”控制，只会出现在 AI 楼；收藏后可立即选择标签，再点同一枚按钮会取消收藏。') +
        _iSub('收藏夹按角色 → 聊天 → 楼层分组，可用标签筛选和管理。删除收藏只删副本，不会删除或改动原楼层。') +
        _iSvgKey(_coordinateIntroSvg, '坐标形收藏', 'AI 楼上的这枚坐标形按钮：点击收藏，再次点击取消收藏') +
        _iSub('［标签管理］可新建、改名、改色或删除标签，删标签不会删收藏。收藏全文右上角的［⛶］进入全屏，［×］删除这份收藏副本。手机点句子勾选（长按也能勾），电脑拖选，再点「摘抄选中」。'),
};

let lastDebugPayload = null;

function lastDebugPayloadJson() {
    if (lastDebugPayload === null || lastDebugPayload === undefined) return null;
    try {
        const json = JSON.stringify(lastDebugPayload, null, 2);
        return typeof json === 'string' ? json : null;
    } catch { return null; }
}

function refreshLastDebugPayloadPreview() {
    const json = lastDebugPayloadJson();
    const hasPayload = Boolean(json);
    const preview = inEl('#sp-diagnostics-ai-input-pre');
    if (preview) preview.textContent = json || '（尚未发送请求）';
    $in('#sp-diagnostics-ai-input-preview').toggleClass('sp-diagnostics-preview-empty', !hasPayload);
    $in('#sp-diagnostics-ai-input-actions').prop('hidden', !hasPayload);
    $in('#sp-diagnostics-ai-input-copy').prop('disabled', !hasPayload);
    return json;
}

async function copyLastDebugPayload({
    copyText = copyPlainText,
    promptTextarea = options => customDialog.promptTextarea(options),
    notify = (message, isError) => showToast(message, null, isError),
} = {}) {
    const text = lastDebugPayloadJson();
    if (!text) {
        refreshLastDebugPayloadPreview();
        try { notify?.('尚未发送请求', false); } catch {}
        return Object.freeze({ status: 'empty' });
    }
    let copied = false;
    try { copied = await copyText?.(text) === true; } catch {}
    if (copied) {
        try { notify?.('AI 输入已复制', false); } catch {}
        return Object.freeze({ status: 'copied' });
    }
    if (typeof promptTextarea !== 'function') {
        try { notify?.('自动复制失败，请在预览区手动选择内容', true); } catch {}
        return Object.freeze({ status: 'failed' });
    }
    try {
        await promptTextarea({
            title: '复制 AI 输入',
            body: '自动复制失败，请长按文本复制。这里可能包含最近聊天、上下文、世界书和提示词等敏感内容，请勿公开分享。',
            initialValue: text,
            maxLength: Math.max(1, text.length),
            rows: 12,
            confirmText: '关闭',
            cancelText: '取消',
        });
        return Object.freeze({ status: 'manual-copy' });
    } catch {
        try { notify?.('自动复制失败，请在预览区手动选择内容', true); } catch {}
        return Object.freeze({ status: 'failed' });
    }
}


// 存储描述符 {kind, view, charName}：getCacheKey 是 schedule key alias，其余 key 已归入对应模块。
// 无 chat 时返回 null（保留旧 getter「无 chat → null」语义，各处 if(!key) 守卫照旧生效）。

// view: 'user' | 'char'   charName: confirmed char name
const getCacheKey = getScheduleKey;
const loadCachedForCurrentChat = (view, charName) => {
    const targetView = view ?? currentView;
    const targetCharName = targetView === 'char' ? (charName ?? charViewName) : '';
    return loadCachedSchedule(targetView, targetCharName);
};

function getEffectiveTheme() {
    return resolveTheme(getSettings().themeMode || 'auto');
}

function themeToggleIcon() {
    return themeIconOf(getSettings().themeMode || 'auto');
}

function themeToggleTitle() {
    return themeTitleOf(getSettings().themeMode || 'auto');
}

let currentTheme   = detectSTTheme();

// 新历法编辑使用独立决策弹窗；作者原有 spConfirm 与既有调用保持不变。
// 批次4：mount 用惰性包装——_spDialogShadow 在 injectModal() 运行时才赋值，而本实例化在模块
// 顶层（更早）；弹窗实际 append 发生在运行时，届时 _spDialogShadow 已就绪。removeOverlay 注入
// 让 modal.js 保持通用（独立 shadow 内 $() 查不到 overlay，须走 $dialog）。
const customDialog = createDialogManager({
    $: jQuery,
    mount: { appendChild: el => _spDialogShadow?.appendChild(el) },
    removeOverlay: () => $dialog('#sp-addon-dialog').remove(),
    getRootClass: () => `sp-root sp-${currentTheme}`,
    subscribeContextChange: handler => {
        eventSource.on(event_types.CHAT_CHANGED, handler);
        return () => eventSource.removeListener?.(event_types.CHAT_CHANGED, handler);
    },
});

const apiPresetUi = createApiPresetUi({
    $in,
    jquery: jQuery,
    getSettings,
    loadApiPresets,
    upsertApiPreset,
    deleteApiPreset,
    renameApiPreset,
    saveCfg,
    saveSettingsDebounced,
    parseExcludeParams,
    maskKey,
    escapeAttr,
    escapeHtml,
    choose: options => customDialog.choose(options),
});

let settingsOpen   = false;
let currentView        = 'user';  // 'user' | 'char'
let _lastMainView      = 'schedule';  // 记住上次打开的模块视图（点/历/线/面/间/棱/坐标），同 chat 内跨开关面板保留；切 chat 复位成 schedule（第一页），见 CHAT_CHANGED
let charViewName       = null;    // confirmed char name; preserved when switching to user view
let outlineMode         = false;
let linesMode           = false;
const manualEditing = { point: false, lines: false, outline: false };
const activityFeature = createActivityFeature({
    chatId: () => getContext().chatId,
    storage: createActivityChatStorage({
        read: () => readStore(keyDesc('activity', 'user', '')),
        write: value => writeStore(keyDesc('activity', 'user', ''), value),
        browserStorage: localStorage,
        chatId: () => getContext().chatId,
    }),
    keyForChat: () => 'activity-user',
    query: $in,
    $,
    root: () => $in('.sp-root'),
    toast: (message, error) => showToast(message, null, error),
    closeSettings: () => { if (settingsOpen) toggleSettings(); },
    onToggle: () => syncMobileViewport?.(),
    readPoint: () => readStore(getCacheKey('user', ''))?.raw || '',
    readLines: () => readStore(getLinesCacheKey())?.raw || '',
    readOutline: () => ({ raw: outlineFeature?.readRaw?.() || '', cursor: outlineFeature?.readSnapshot?.()?.cursor || 0 }),
    readDashed: () => linesFeature?.dashed?.read?.() || [],
    writePoint: async raw => {
        const key = getCacheKey('user', '');
        const saved = readStore(key) || {};
        await writeStoreConfirmed(key, { ...saved, raw, ts: Date.now() });
    },
    writeLines: async raw => {
        const key = getLinesCacheKey();
        const saved = readStore(key) || {};
        await writeStoreConfirmed(key, { ...saved, raw, ts: Date.now() });
    },
    writeOutline: async ({ raw, cursor } = {}) => {
        const target = outlineFeature.repository.capture();
        if (!outlineFeature.repository.commitOutline(target, { raw: String(raw || ''), ts: Date.now(), cursor: cursor || 1 })) return false;
        outlineFeature.refreshPanel();
        outlineFeature.injection.refresh();
        return true;
    },
    writeDashed: items => linesFeature.dashed.commit(items),
    onRestored: () => {
        const saved = readStore(getCacheKey('user', ''));
        if (saved?.raw) {
            pointState.cachedSchedule = renderSchedule(saved.raw, saved.userName || '用户', currentView, loadCalDesc());
            if (!outlineMode && !linesMode && !spaceMode && !theaterMode && !axisState.almanacMode) setBody(pointState.cachedSchedule);
        }
        linesFeature.refreshPanel?.();
        outlineFeature.refreshPanel?.();
        syncLatestScheduleBlock();
        refreshInlineWindow(true);
    },
    onPaint: () => paintPaceSoon(),
    missingLatestStamp,
    fillLatestStamp: () => fillLatestStoryClock(),
    realign: opts => refreshController.align({ auto: false, selected: ['point', 'lines'], reason: String(opts?.reason || '') }),
    sendToSpace: async item => {
        if (!item || typeof item !== 'object' || !String(item.quote || '').trim()) return { status: 'failed' };
        spaceFeature.guide?.leave?.();
        spaceFeature.ui?.setQuote?.(item);
        activityFeature.close();
        const ok = await openPluginViewWithPrefill('space');
        spaceFeature.ui?.setQuote?.(item);
        return { status: ok ? 'quoted' : 'failed' };
    },
    openLines: () => {
        activityFeature.close();
        return openPluginViewWithPrefill('lines');
    },
});
// 线·swipe 重算：楼层单调递增闸（区分真·新楼层 vs swipe/历史重渲染），及"待重算 swipe"标记。
const linesFeature = createLinesFeature({
    jumpHint: () => SP_JUMP_HINT_LINES,
    get stageColors() { return STAGE_COLORS; },
    escapeHtml, escapeAttr, cleanText, makeInjectBtn,
    cacheKey: () => getLinesCacheKey(), chatId: () => getContext().chatId,
    boundaryEpoch: () => chatBoundaryEpoch,
    participantIdentity: captureParticipantIdentity,
    sameParticipantIdentity,
    contextSnapshot: captureGenerationContext,
    isEditing: () => manualEditing.lines,
    readSaved: () => readStore(getLinesCacheKey()) || {},
    writeStore, writeStoreConfirmed, readRaw: () => readStore(getLinesCacheKey())?.raw || '',
    restoreBaseline: baseline => { if (!baseline || baseline.chatId !== getContext().chatId) return; const key = getLinesCacheKey(); if (!key) return; if (baseline.raw) writeStore(key, { raw: baseline.raw, ts: baseline.ts || Date.now() }); else removeStore(key); },
    loadConfig: loadCfg, swipeId: mesId => getContext().chat?.[mesId]?.swipe_id ?? 0,
    refreshInlineWindow: refreshInlineWindow,
    freezeSnapshot: freezeSnapshotToFloor,
    isPanelActive: () => linesMode, notifyMode: () => getSettings().notifyMode,
    toast: (message, error) => showToast(message, null, error),
    onActivity: entry => activityFeature.record(entry),
    parseClock: mes => parseStoryClockPure(mes),
    latestFloorAdvance: floorId => activityFeature.latestAdvanceForFloor(floorId),
    replayFloorAdvance: floorId => activityFeature.replayFloorAdvance(floorId),
    didReconcile: mid => refreshController.didReconcile(mid),
    deferAdvance: () => refreshController.stagger.deferAdvance(),
    consumeDeferredAdvance: () => refreshController.stagger.consumeAdvance(),
    tryDashed: (mid, opts) => linesFeature.dashed.onAiFloor(mid, { ...opts, latestStory: cleanText(latestAiFloor(getContext().chat)?.text || '') }),
    pluginEnabled, getSettings, getMode: getLinesMode, getInterval: getLinesInterval,
    floorSignature: _floorSig, messageText: mid => getContext().chat?.[mid]?.mes,
    chat: () => getContext().chat, lastAssistant: () => snapshotLastAssistant(getContext().chat),
    dayAnchor: () => { try { const md = almTodayAnchor(); return md && Number.isFinite(+md.month) && Number.isFinite(+md.day) ? `${+md.month}-${+md.day}` : null; } catch { return null; } },
    dayAdvance: createAdvanceStrategy,
    swipeEnv: {
        loadConfig: loadCfg, chatId: () => getContext().chatId,
        swipeId: mesId => getContext().chat?.[mesId]?.swipe_id ?? 0,
        key: () => getLinesCacheKey(), readCurrent: () => readStore(getLinesCacheKey())?.raw || '',
        previousBaseline: _prevAiFloorLines,
        writeStore, syncInline: syncLatestInlineBlock,
        render: () => {},
    },
    widgetEnv: {
        key: () => getLinesCacheKey(), read: key => readStore(key), write: (key, value) => writeStore(key, value),
        fail: message => showToast(message, null, true), refresh: () => {},
        button: ($btn, editIdx) => { if ($btn) $btn.prop('disabled', true).html(`<i class="fa-solid fa-check"></i> ${editIdx != null ? `已改第 ${editIdx} 条` : '已加到线'}`); showToast(editIdx != null ? `已替换线·第 ${editIdx} 条` : '已加到线'); },
    },
    readRaw: () => readStore(getLinesCacheKey())?.raw || '',
    empty: () => renderEmptyLinesState(),
    loading: () => loadingHtml('正在推演线', 'sp-abort-lines'),
    renderPanelDom: ({ toolbar, body }) => { $in('#sp-lines-toolbar').html(toolbar); $in('#sp-lines-list').html(body); },
    injectionEnv: {
        context: () => getContext(), settings: getSettings, enabled: injectEnabled,
        adultMode: () => getAdultMode(charStableKey(getContext())),
        readRaw: () => readStore(getLinesCacheKey())?.raw || '',
        promptTypes: getContext()?.constants?.promptTypes || {}, promptRoles: getContext()?.constants?.promptRoles || {}, clean: cleanText,
    },
    dashedEnv: {
        keyDesc, readStore, writeStore, writeStoreConfirmed, removeStore, getSettings,
        context: getContext, chatId: () => getContext().chatId, loadConfig: loadCfg,
        callApi: (...args) => callCustomApi(...args), filterRerollItems, dialog: customDialog,
        uuid: () => globalThis.crypto?.randomUUID?.(), now: () => Date.now(), random: () => Math.random(),
        toast: (message, error) => showToast(message, null, error), escapeHtml, escapeAttr,
        onActivity: entry => activityFeature.record(entry),
        logDiagnostic: diagnostic => console.warn('[SP dashed failure]', diagnostic),
        refreshPanel: () => {}, refreshInline: () => {},
    },
    dashedEnabled: () => getSettings().dashedEnabled === true,
    generationEnv: {
        isEditing: () => manualEditing.lines,
        chatId: () => getContext().chatId, loadConfig: loadCfg,
        adultMode: identity => getAdultMode(identity?.characterKey || charStableKey(getContext())),
        readSaved: () => readStore(getLinesCacheKey()) || {},
        participantIdentity: captureParticipantIdentity,
        sameParticipantIdentity,
        contextSnapshot: captureGenerationContext,
        buildPrompt: (previousRaw, travelContext, vectorContext, identity) => appendTravelPromptContext(buildLinesPrompt(identity?.userName || '用户', identity?.charName || '角色', 'user', previousRaw, getScale(identity?.characterKey || charStableKey(getContext())), vectorContext, getAdultMode(identity?.characterKey || charStableKey(getContext()))), travelContext),
        random: () => Math.random(),
        callApi: (prompt, signal, options, identity, contextSnapshot) => callCustomApi(contextSnapshot || getContext(), prompt, loadCfg(), identity?.userName || '用户', identity?.charName || '角色', signal, options?.historyLimit ?? 3, options),
        missingApi: ({ silent }) => { if (!silent && !settingsOpen) toggleSettings(); },
        onStart: () => {},
        commit: () => {},
        fail: (error, { silent = false } = {}) => { const code = classifyGenerationError(error, { phase: error?.phase || 'request' }); const manual = !silent; const notify = shouldNotifyGeneration({ manual, notifyMode: getSettings().notifyMode, code }); const diagnostic = safeDiagnosticLog('lines', error?.phase || 'request', error, { background: !manual }); console.warn('[SP lines failure]', diagnostic); if (notify && getContext().chatId) showToast(`线生成失败：${diagnosticMessage(error)}`, null, true); }, cleanup: () => {},
    },
    actionsEnv: {
        setEditing: value => { manualEditing.lines = value; },
        isBusy: () => false, readSaved: () => readStore(getLinesCacheKey()), readRaw: () => readStore(getLinesCacheKey())?.raw || '',
        write: value => writeStore(getLinesCacheKey(), value), remove: () => removeStore(getLinesCacheKey()), confirm: spConfirm, toast: (message, error) => showToast(message, null, error),
        promptFields: options => customDialog.promptFields(options),
        render: raw => raw, setCached: () => {}, refreshPanel: () => {}, refreshInline: () => {},
        resetCounter: () => {}, runGenerate: () => {}, precheck: memoryPreCheckConfirm, silent: () => !linesMode,
    },
});
const linesRuntime = linesFeature.runtime;
const outlineFeature = createOutlineFeature({
    context: getContext,
    keyDesc,
    readStore,
    writeStore,
    writeStoreConfirmed,
    removeStore,
    settings: getSettings,
    pluginEnabled,
    injectEnabled,
    loadConfig: loadCfg,
    loadUtilityConfig: loadUtilityCfg,
    callApi: ({ ctx, prompt, config, userName, charName, signal, historyLimit, options }) =>
        callCustomApi(ctx, prompt, config, userName, charName, signal, historyLimit, options),
    precheck: memoryPreCheckConfirm,
    isAutomationSuppressed,
    automationModule: AUTOMATION_MODULES.OUTLINE,
    bridgeAbortSignal,
    buildChatMessages: args => composeCreativeChatMessages(args),
    postCompletion: ({ config, ...options }) => postChatCompletion({ cfg: config, ...options }),
    temperature: GEN_TEMPERATURE,
    chatPlaceholder: getCreativeChatPlaceholder,
    cleanText,
    escapeHtml,
    confirm: spConfirm,
    promptTextarea: options => customDialog.promptTextarea(options),
    openSettings: () => { if (!settingsOpen) toggleSettings(); },
    ui: {
        $,
        query: $in,
        element: inEl,
        escapeHtml,
        autoGrow: autoGrowTextarea,
        formatAi: renderAiMessageHtml,
        confirm: spConfirm,
        copyText: copyPlainText,
        injectToInput: injectToST,
        setOutline: html => setOutlineBody(html),
        loading: loadingHtml,
        isOutlineMode: () => outlineMode,
        isPanelVisible: () => $(`#${MODAL_ID}`).is(':visible'),
        toast: (message, error) => showToast(message, null, error),
        closedSuccess: () => showToast('面已生成，点击查看', () => {
            if (!outlineMode) $in('.sp-view-btn[data-view="outline"]').trigger('click');
            showPanel();
        }),
    },
    onActivity: entry => activityFeature.record(entry),
    logDiagnostic: diagnostic => console.warn('[SP outline failure]', diagnostic),
});
let spaceMode = false;
const spaceFeature = createSpaceFeature({
    context: getContext,
    keyDesc,
    readStore,
    writeStore,
    loadConfig: loadCfg,
    postCompletion: ({ config, ...options }) => postChatCompletion({ cfg: config, ...options }),
    temperature: GEN_TEMPERATURE,
    placeholder: getSpaceChatPlaceholder,
    openSettings: () => { if (!settingsOpen) toggleSettings(); },
    isOpen: () => spaceMode,
    contextEnv: {
        context: getContext,
        settings: getSettings,
        readOutline: () => outlineFeature.readRaw(),
        readPointRaw: () => readCacheRaw(getCacheKey('user', '')),
        numberedPoints: numberedPointList,
        readLineRaw: () => readStore(getLinesCacheKey())?.raw || '',
        parseLines: parseCanonicalLines,
        readLedgerText: () => {
            try {
                const items = ledger.listEntries() || [];
                return items.length ? formatLedgerList(items, { daysSince: ledgerDaysSince, dueInfo: ledgerDueInfo }) : '';
            } catch { return ''; }
        },
        readWorldInfo: ctx => buildWorldInfoContext(ctx),
        readMemory: () => getMemText(),
        readRecent: ctx => buildRecentChatContext(ctx),
        readCardExtras,
        readAlmanacText: () => getAlmanacInjectText(),
        readCalendarText: () => getCalDescInjectText(),
    },
    renderEnv: {
        escapeHtml,
        formatAi: renderAiMessageHtml,
        parseAlmanac: parseAlmanacWidget,
        parseEra: parseEraWidget,
        loadCalendar: loadCalDesc,
        calendarMonthName: calMonthName,
        calendarMonthCount: calMonthCount,
        calendarYearLength: calYearLen,
    },
    ui: {
        $,
        query: $in,
        element: inEl,
        escapeHtml,
        autoGrow: autoGrowTextarea,
        copyText: copyPlainText,
        confirm: spConfirm,
        toast: (message, error) => showToast(message, null, error),
        // 轴动作在本 facade 之后初始化；只在真实点击时读取，严禁顶层提前解引用造成 TDZ。
        widgetActions: () => ({
            point: (body, $button, editIdx) => applyPointWidget(body, $button, editIdx),
            lines: (body, editIdx, $button) => linesFeature.widget.apply(body, editIdx, $button),
            almanac: (body, $button, index) => axisWidgetActions.applyAlmanacWidget(body, $button, index),
            era: (body, $button) => axisWidgetActions.applyEraWidget(body, $button),
        }),
    },
    collectGuideContext: () => collectBeatLedgerContext(),
    applyGuideDraft: (name, draft) => applyGuideDraft(name, draft),
    snapshotGuideModules: names => activityFeature.capture(names),
    recordGuideActivity: entry => activityFeature.record(entry),
    generateBeat: () => revealBeatAndGenerate(),
});
let theaterMode          = false;
let beatFeature          = null;
const refreshController = createRefreshController({
    context: getContext,
    loadConfig: loadCfg,
    callApi: callCustomApi,
    calendar: loadCalDesc,
    cleanText,
    pluginEnabled,
    enabled: () => getSettings().ledgerReconcileEnabled === true,
    interval: getLedgerReconcileInterval,
    isSuppressed: messageId => isAutomationSuppressed(messageId, AUTOMATION_MODULES.POINT) || isAutomationSuppressed(messageId, AUTOMATION_MODULES.LINES),
    readPointRaw: () => readStore(getCacheKey('user', ''))?.raw || '',
    readLinesRaw: () => readStore(getLinesCacheKey())?.raw || '',
    writePointRaw: async raw => {
        const key = getCacheKey('user', '');
        const saved = readStore(key) || {};
        await writeStoreConfirmed(key, { ...saved, raw, ts: Date.now() });
    },
    writeLinesRaw: async raw => {
        const key = getLinesCacheKey();
        const saved = readStore(key) || {};
        await writeStoreConfirmed(key, { ...saved, raw, ts: Date.now() });
    },
    regenPoint: travel => pointController.triggerGenerate(travel),
    regenLines: travel => linesFeature.actions.reroll(travel),
    regenDashed: opts => linesFeature.dashed.run(opts),
    regenOutline: opts => outlineFeature.generation.trigger(opts),
    snapshotModules: names => activityFeature.capture(names),
    onActivity: entry => activityFeature.record(entry),
    floorSignature: _floorSig,
    onPatched: () => {
        const saved = readStore(getCacheKey('user', ''));
        if (saved?.raw) {
            pointState.cachedSchedule = renderSchedule(saved.raw, saved.userName || '用户', currentView, loadCalDesc());
            if (!outlineMode && !linesMode && !spaceMode && !theaterMode && !axisState.almanacMode) setBody(pointState.cachedSchedule);
        }
        linesFeature.refreshPanel?.();
        syncLatestScheduleBlock();
        refreshInlineWindow(true);
    },
    toastAlways: (msg, isError) => {
        if (isError) { showToast(msg, null, true); return; }
        showToast(`${msg} · 点此查看本轮拍`, () => revealBeatAndGenerate());
    },
});
const paceBook = createPaceBook({
    read: () => readStore(keyDesc('pace', 'user', '')),
    write: value => writeStore(keyDesc('pace', 'user', ''), value),
    chatId: () => getContext()?.chatId,
    latestFloor: () => latestAiFloor(getContext()?.chat)?.index ?? -1,
    refresh: refreshController,
    outline: outlineFeature.judge,
    dashed: linesFeature.dashed,
    linesLifecycle: linesFeature.lifecycle,
    paintSoon: () => paintPaceSoon(),
});
function syncRefreshBar(view = _lastMainView) {
    const show = view === 'schedule' || view === 'lines' || view === 'outline';
    $in('#sp-panel-tools').css('display', show ? 'block' : 'none');
}
function collectBeatLedgerContext() {
    const ctx = getContext() || {};
    const snap = outlineFeature.readSnapshot?.() || { beats: [], cursor: 0 };
    const current = snap.beats?.[Number(snap.cursor) - 1];
    const outlineNode = current
        ? `${current.time ? current.time + '·' : ''}《${current.title || ''}》${current.scene ? `\n${current.scene}` : ''}`
        : '';
    const spaceRecent = (spaceFeature.chat.history() || []).slice(-8)
        .map(message => `${message.role === 'assistant' ? '顾问' : '作者'}：${spaceMessagePlainText(message)}`)
        .join('\n');
    return {
        userName: ctx.name1 || '用户',
        charName: ctx.name2 || '角色',
        pointRaw: readStore(getCacheKey('user', ''))?.raw || '',
        linesRaw: readStore(getLinesCacheKey())?.raw || '',
        outlineRaw: outlineFeature.readRaw?.() || '',
        outlineNode,
        spaceRecent,
        latestStory: cleanText(latestAiFloor(getContext().chat)?.text || '').slice(0, 1600),
    };
}
async function applyGuideDraft(name, draft) {
    const raw = String(draft || '').trim();
    if (!raw) return false;
    if (name === 'point') {
        const key = getCacheKey('user', '');
        if (!key) return false;
        const saved = readStore(key) || {};
        await writeStoreConfirmed(key, { ...saved, raw, userName: getContext()?.name1 || saved.userName, ts: Date.now() });
        pointState.cachedSchedule = renderSchedule(raw, saved.userName || getContext()?.name1 || '用户', currentView, loadCalDesc());
        if (!outlineMode && !linesMode && !spaceMode && !theaterMode && !axisState.almanacMode) setBody(pointState.cachedSchedule);
        syncLatestScheduleBlock();
        return true;
    }
    if (name === 'lines') {
        const key = getLinesCacheKey();
        if (!key) return false;
        const saved = readStore(key) || {};
        await writeStoreConfirmed(key, { ...saved, raw, ts: Date.now() });
        linesFeature.refreshPanel?.();
        syncLatestInlineBlock();
        return true;
    }
    if (name === 'outline') {
        const normalized = normalizeOutlineResponse(raw);
        if (!normalized) { showToast('面草案解析失败，没有写入', null, true); return false; }
        const target = outlineFeature.repository.capture();
        const saved = outlineFeature.repository.readOutline(target);
        if (!outlineFeature.repository.commitOutline(target, { raw: normalized, ts: Date.now(), cursor: saved?.cursor || 1 })) return false;
        outlineFeature.refreshPanel();
        outlineFeature.injection.refresh();
        return true;
    }
    return false;
}
function revealBeatAndGenerate() {
    showPanel();
    if (_lastMainView !== 'schedule' && _lastMainView !== 'lines' && _lastMainView !== 'outline') {
        $in('.sp-side-tab.sp-view-btn[data-view="schedule"]').trigger('click');
    }
    beatFeature?.reveal?.();
    void beatFeature?.generate?.();
}
beatFeature = createBeatFeature({
    context: getContext,
    loadConfig: loadCfg,
    callApi: callCustomApi,
    openSettings: () => { if (!settingsOpen) toggleSettings(); },
    toast: (message, error) => showToast(message, null, error),
    collectContext: collectBeatLedgerContext,
    floorId: () => latestAiFloor(getContext().chat)?.index ?? -1,
    read: () => readStore(keyDesc('beat', 'user', '')),
    write: value => {
        const key = keyDesc('beat', 'user', '');
        if (!key) return;
        if (!value) removeStore(key);
        else writeStore(key, value);
    },
    uiHost: {
        $,
        query: $in,
        escapeHtml,
        copyText: copyPlainText,
        injectToInput: injectToST,
        toast: (message, error) => showToast(message, null, error),
    },
});
// 暗历内联编辑态/归档折叠态/批量模式已随 ledger 渲染层迁入 business/ledger/render.js
// （经 getLedgerEditor、归档/批量 actions 与 resetLedgerRenderState 复位）。
const _injectTexts      = {};
let   _injectIdSeq      = 0;

const isMobile = () => window.innerWidth <= 640;

const fabRuntime = createFab({
    $,
    $in,
    document,
    window,
    isMobile,
    theme: () => currentTheme,
    fabEnabled,
    markSurface: markTauriMobileSurface,
    sheet: () => inEl('.sp-sheet'),
    panelVisible: () => $(`#${MODAL_ID}`).is(':visible'),
    open: () => openSchedule(),
    close: () => closePanel(),
    clearShadows() { _spShadow = null; _spDialogShadow = null; },
});
function setFabBusy(on) { fabRuntime.setBusy(on); }
function setExtBtnState(state) { fabRuntime.setExtBtnState(state); }
function injectFab() { fabRuntime.inject(); }
function injectExtButton() { fabRuntime.injectExtButton(); }
function removeStalePluginHosts() { fabRuntime.removeStaleHosts(); }

const panelWindow = createPanelWindow({
    $, $in, inEl, document, window, isMobile,
    settingsOpen: () => settingsOpen,
    shadow: () => _spShadow,
});
function showPanel() { panelWindow.show(); }
function syncMobileViewport() { panelWindow.syncMobile(); }
function closePanel() {
    coordinateRuntime?.feature?.close?.();
    theaterFeature.onPanelClosed();
    _activeSpConfirmCancel?.();
    _activeStoreConflictFinish?.('defer');
    removeDialogOverlays();
    customDialog.cancelActive();
    panelWindow.hide();
}

const taDrawer = createTaDrawer({
    $in, $,
    escapeAttr, escapeHtml,
    currentView: () => currentView,
    charViewName: () => charViewName,
    pins: () => store.readPinnedChars(),
    activate: name => activateCharView(name),
    openPicker: () => switchToCharView(),
    removePin: name => store.removePinnedChar(name),
    refreshPinIcon: () => refreshCharPinIcon(),
});
function updateTaTriggerLabel() { taDrawer.updateLabel(); }
function openTaDrawer() { taDrawer.show(); }
function closeTaDrawer() { taDrawer.close(); }
function toggleTaDrawer() { taDrawer.toggle(); }

// 通用操作菜单只描述动作；具体页面决定何时显示、如何处理动作。
const ACTION_MENU_CONFIGS = Object.freeze({
    almanac: Object.freeze([
        Object.freeze({ action: 'generate-almanac', icon: 'fa-wand-magic-sparkles', label: '生成节日', title: 'AI 按世界观逐月考虑，按素材生成' }),
        Object.freeze({ action: 'supplement-anniversary', icon: 'fa-heart-circle-plus', label: '补录纪念日', title: '只增补新里程碑，不重铺、不动现有日历' }),
        Object.freeze({ action: 'manage-calendar', icon: 'fa-calendar-days', label: '历法管理', title: '查看、编辑和管理历法模板' }),
    ]),
});

// ─── Init ─────────────────────────────────────────────────────────────────────

// Module-level handles so hot-reload / re-init doesn't double-register.
// If the module loads again in the same page (rare but possible with ST's
// dev workflows), we need to be able to unregister and rewire cleanly.
let _themeObserver = null;
const _stListeners = { chat: null, char: null };
// 柏宝书加载顺序不固定：就绪事件监听句柄（幂等注册，见 jQuery init）
let _bbbReadyListener = null;

// 界面字体·自管控：按 settings.uiFontUrl / uiFontFamily 动态挂 <link> + 写 --sp-font-user。
// 幂等：复用固定 id 的 link 节点，重复调用只改 href / 不叠加。早期 bootstrap + 设置改动时各调一次。
const SP_FONT_LINK_ID = 'sp-ui-font-link';
const SP_FONT_DEFAULT_URL    = 'https://fontsapi.zeoseven.com/387/main/result.css';
const SP_FONT_DEFAULT_FAMILY = 'Nowar Rounded TW Wc';
function applyUiFont() {
    const s = getSettings();
    const url    = (s.uiFontUrl    ?? SP_FONT_DEFAULT_URL).trim();
    let   family = (s.uiFontFamily ?? SP_FONT_DEFAULT_FAMILY).trim();

    // <link> 侧：有 URL 就挂/换，留空则移除（=只用系统栈兜底）。href 用绝对 URL——
    // zeoseven 那份 CSS 里 @font-face src 是相对路径 ./xxx.woff2，浏览器基于 link href 解析，
    // 故必须走 <link href> 而非把 CSS 内容内联（内联会丢失基准 URL、woff2 404）。
    let link = document.getElementById(SP_FONT_LINK_ID);
    if (url) {
        if (!link) {
            link = document.createElement('link');
            link.id  = SP_FONT_LINK_ID;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        if (link.getAttribute('href') !== url) link.setAttribute('href', url);
    } else if (link) {
        link.remove();
    }

    // --sp-font-user 侧：写生效 family 名（供 style.css 的 --sp-font 打头）。family 留空则回落默认名。
    // 名字含空格 / 非纯标识符时补引号，避免 CSS 里被拆成多个 family。
    if (!family) family = SP_FONT_DEFAULT_FAMILY;
    const quoted = ((family.startsWith('"') && family.endsWith('"')) || (family.startsWith("'") && family.endsWith("'")) || /^[A-Za-z_][A-Za-z0-9_-]*$/.test(family))
        ? family
        : `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    document.documentElement.style.setProperty('--sp-font-user', quoted);
}

// 从用户提供的 CSS 中读取首个有效 @font-face 字体名；只认 @font-face，
// 不猜测普通选择器里的 body/font 声明，避免把无关 CSS 当成界面字体。
export function parseFontFamilyFromCss(cssText) {
    if (typeof cssText !== 'string') return '';
    const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
    const blocks = withoutComments.matchAll(/@font-face\s*\{([\s\S]*?)\}/gi);
    for (const match of blocks) {
        const declaration = /(?:^|;)\s*font-family\s*:\s*([^;}]*)/i.exec(match[1]);
        if (!declaration) continue;
        const family = declaration[1].trim();
        if (!family || family.includes(',')) continue;
        const quote = family[0];
        if (quote === '"' || quote === "'") {
            const body = family.slice(1, -1);
            let escaped = false;
            let hasUnescapedSameQuote = false;
            for (const character of body) {
                if (character === quote && !escaped) { hasUnescapedSameQuote = true; break; }
                if (character === '\\' && !escaped) escaped = true;
                else escaped = false;
            }
            let closingSlashCount = 0;
            for (let i = family.length - 2; i >= 0 && family[i] === '\\'; i--) closingSlashCount++;
            if (family.length < 3 || family.at(-1) !== quote || closingSlashCount % 2 === 1 || hasUnescapedSameQuote) continue;
            let unquoted = '';
            let invalidEscape = false;
            for (let i = 0; i < body.length;) {
                if (body[i] !== '\\') {
                    unquoted += body[i++];
                    continue;
                }
                i++;
                if (i >= body.length) { invalidEscape = true; break; }
                if (body[i] === '\r' || body[i] === '\n') {
                    if (body[i] === '\r' && body[i + 1] === '\n') i++;
                    i++;
                    continue;
                }
                const hex = /^[0-9a-f]{1,6}/i.exec(body.slice(i));
                if (hex) {
                    const codePoint = Number.parseInt(hex[0], 16);
                    i += hex[0].length;
                    if (/[\t\n\r ]/.test(body[i] || '')) i++;
                    if (!codePoint || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) { invalidEscape = true; break; }
                    unquoted += String.fromCodePoint(codePoint);
                    continue;
                }
                unquoted += body[i++];
            }
            unquoted = unquoted.trim();
            if (invalidEscape || /[\u0000-\u001f\u007f]/.test(unquoted)) continue;
            if (unquoted) return unquoted;
        } else if (/^[^{};'"\"]+$/.test(family)) {
            return family;
        }
    }
    return '';
}

jQuery(async () => {
    const initialStorageLoad = loadExternalChat({ force: true });
    if (isExternalMode()) await initialStorageLoad;
    // 界面字号缩放：把持久化的 uiScale 写进 --sp-scale，令牌即刻按此缩放（早于注入 UI，防首帧闪错号）
    document.documentElement.style.setProperty('--sp-scale', String(Number(getSettings().uiScale) || 1));
    // 界面字体：按持久化的 uiFontUrl/uiFontFamily 挂 <link> + 写 --sp-font-user（早于注入 UI，防字体闪切）
    applyUiFont();
    injectExtButton();
    // 重新挂载主 Shadow root 前先销毁旧棱实例，清理 Esc、图片监听、owner 与 UI 委托。
    theaterFeature?.destroy?.();
    theaterFeature = createTheaterHostFeature();
    removeStalePluginHosts();
    injectModal();
    injectFab();
    injectToastContainer();
    // Apply saved theme mode (day/night/auto) now that settings are guaranteed loaded
    applyTheme(getEffectiveTheme());
    // Initialize memory system — wires event listeners internally
    memory.initMemory({
        getSettings: () => {
            const s = getSettings();
            return {
                pluginEnabled  : s.pluginEnabled !== false,
                useBaiBaiBook  : !!s.useBaiBaiBook,
                memoryEnabled  : s.memoryEnabled !== false,
                memoryL0Group  : Number.isFinite(+s.memoryL0Group) ? +s.memoryL0Group : 5,
                memoryL1Group  : Number.isFinite(+s.memoryL1Group) ? +s.memoryL1Group : 10,
                memorySkipShort: Number.isFinite(+s.memorySkipShort) ? +s.memorySkipShort : 50,
                keepTags       : typeof s.keepTags  === 'string' ? s.keepTags  : 'content',
                extraTags      : typeof s.extraTags === 'string' ? s.extraTags : '',
            };
        },
        callApi: callMemoryApi,
        onPause: log => {
            console.warn('[SP memory pause]', log);
            if (getSettings().notifyMode === 'full' && !memoryPauseNoticeShown) { memoryPauseNoticeShown = true; showToast('记忆系统因连续失败已暂停：请检查 API 后点击补齐或重构', null, true); }
        },
    });
    coordinateRuntime = createCoordinateRuntime({
        forceNew: true,
        root: $in('#sp-anchor-body')?.[0] || null,
        warnBytes: Number(getSettings().anchorSizeWarnBytes) || 8 * 1024 * 1024,
        hostPorts: { settings: () => getSettings(), dom: () => document, context: () => getContext() },
        host: {
            document, context: () => getContext(), settings: () => getSettings(), enabled: () => pluginEnabled(),
            sheet: () => _spShadow?.querySelector?.('.sp-sheet') || document.querySelector('.sp-sheet'),
            chatName: () => { const el = document.querySelector('#selected_chat_pole, #chat_name_pole, .current_chat_name'); return el?.value || el?.textContent?.trim() || getContext().chatId || '当前聊天'; },
            capture: el => { const ctx = getContext?.() || {}; return captureSnapshotElement(el, { documentRef: document, DOMPurify: globalThis.DOMPurify, messageFormatting: ctx.messageFormatting }); },
            toast: (message, action, error) => showToast(message, action, error),
            theme: () => getEffectiveTheme(),
            saveChatDebounced: () => scriptCore.saveChatDebounced(),
            warn: (message, error) => console.warn(message, error),
            confirm: message => {
                const text = String(message);
                const title = text.includes('摘抄') ? '删除摘抄' : text.includes('收藏') ? '删除收藏' : '删除标签';
                return spConfirm({ title, body: text });
            },
            sendToSpace: async item => {
                if (!item || typeof item !== 'object' || !String(item.quote || '').trim()) return { status: 'failed' };
                spaceFeature.guide?.leave?.();
                spaceFeature.ui?.setQuote?.(item);
                const ok = await openPluginViewWithPrefill('space');
                spaceFeature.ui?.setQuote?.(item);
                return { status: ok ? 'quoted' : 'failed' };
            },
            scrollToFloor: (chatId, floor) => {
                const ctx = getContext?.() || {};
                if (chatId != null && String(ctx.chatId) !== String(chatId)) return false;
                const mid = Number(floor);
                if (!Number.isInteger(mid) || mid < 0) return false;
                const mes = document.querySelector(`#chat .mes[mesid="${mid}"]`);
                if (!mes) return false;
                mes.scrollIntoView({ behavior: 'smooth', block: 'center' });
                mes.classList.add('sp-anchor-locate-flash');
                globalThis.setTimeout(() => mes.classList.remove('sp-anchor-locate-flash'), 1600);
                return true;
            },
            selectMany: options => customDialog.selectMany(options),
            svg: cls => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3.5 L6 18 L20.5 18"/><circle cx="14" cy="9.4" r="1.9" fill="currentColor" stroke="none"/></svg>`,
        },
    });
    coordinateRuntime.feature.init({ chatId: getContext()?.chatId ?? null });
    coordinateRuntime.feature.bindInteractionCapture($in('#sp-anchor-wrap')?.[0] || null);
    coordinateRuntime.feature.bindUi($in('#sp-anchor-wrap')?.[0] || null);
    coordinateRuntime.feature.bindDelete($in('#sp-anchor-wrap')?.[0] || null);
    coordinateRuntime.feature.bindExcerpts($in('#sp-anchor-wrap')?.[0] || null);
    coordinateRuntime.feature.bindGestures($in('#sp-anchor-wrap')?.[0] || null);
    coordinateRuntime.feature.refreshSavedKeys();
    activeChatBoundaryIdentity = captureChatBoundary();
    setTimeout(() => coordinateRuntime.feature.scanButtons(), 900);
    initChatObserver();
    // 首屏补挂：backfill 内部 refreshLinesInjection()（潜伏注入）+ refreshInlineWindow(true)
    // 统一挂线/历/点三段。历/点无独立首屏副作用，全汇流到同一防抖窗口刷新，一次即可。
    scheduleForChatBoundary(backfillLinesInlineBlocks, 800);
    // Reset view state and reload cache on chat switch
    if (_stListeners.chat) eventSource.removeListener?.(event_types.CHAT_CHANGED, _stListeners.chat);
    _stListeners.chat = () => runChatChanged({
        activeChatId: () => activeChatBoundaryIdentity?.chatId ?? null,
        chatLength: () => getContext().chat?.length ?? 0,
        chatId: () => getContext()?.chatId,
        chatMetadata: () => getContext()?.chatMetadata ?? null,
        pluginEnabled,
        beginBoundary({ previousChatId }) {
            const previousBoundaryEpoch = chatBoundaryEpoch;
            const previousChatRevision = pointTaskOwners.currentChatRevision();
            chatBoundaryEpoch++;
            activeChatBoundaryIdentity = captureChatBoundary();
            pendingDateBootstrap = latestFloorBoundaryIdentity();
            const chatRevision = pointTaskOwners.nextChatRevision();
            linesFeature.nextChatRevision();
            recordChatBoundary({ previousChatId, currentChatId: activeChatBoundaryIdentity.chatId, previousBoundaryEpoch, boundaryEpoch: chatBoundaryEpoch, previousChatRevision, chatRevision });
            traceDiagnosticEvent('abort-boundary', { module: 'runtime', chatId: activeChatBoundaryIdentity.chatId, chatRevision, boundaryEpoch: chatBoundaryEpoch, abortReason: 'chat-boundary', status: 'dispatch' });
        },
        pointTasks: pointTaskOwners,
        pointController,
        lines: linesFeature,
        memory,
        customDialog,
        timeTravel,
        dateCoordinator,
        dateDetection: dateDetectionController,
        outline: outlineFeature,
        space: spaceFeature,
        activity: activityFeature,
        dashed: linesFeature.dashed,
        theater: theaterFeature,
        ledgerCapture: ledgerCaptureController,
        ledgerJudge: ledgerJudgeController,
        axisGeneration: axisGenerationController,
        linesRuntime,
        pace: paceBook,
        get coordinate() { return coordinateRuntime?.feature; },
        refresh: refreshController,
        beat: beatFeature,
        clearTravelUi() {
            _timeTravelSelectionSeq++;
            _activeTimeTravelSelection = null;
            _activeSpConfirmCancel?.();
            _activeStoreConflictFinish?.('defer');
        },
        removeDialogOverlays,
        clearAutomationClaims,
        abortAutoRegen(reason) { _autoRegenSchedAbort?.abort(reason); _autoRegenSchedAbort = null; },
        clearPointGenerating() {
            pointState.isGenerating = false;
            pointState.scheduleAbortController = null;
            axisState._almSyncingPoint = false;
        },
        resetViewHome() {
            currentView = 'user';
            charViewName = null;
            outlineMode = false;
            linesMode = false;
            spaceMode = false;
            theaterMode = false;
            manualEditing.point = manualEditing.lines = manualEditing.outline = false;
            axisState.almanacMode = false;
            axisState._almanacSheet = 'upcoming';
            axisState._almanacCalMonth = null;
            axisState._almanacCalDay = null;
            axisState._almanacEditor = null;
            axisState._almTodayEditing = false;
            resetLedgerRenderState();
            axisCalendarManager.close();
            _lastMainView = 'schedule';
        },
        paintPaceSoon,
        loadExternalChat,
        migrateChat: () => store.migrateChatFromLocalStorage(getContext().chatId),
        hydratePace: hydratePaceFromStore,
        reloadPanel() {
            const panelOpen = $(`#${MODAL_ID}`).is(':visible') && !pointState.isGenerating;
            paintScheduleHome($in, $inAll, { sub: 'user', wraps: panelOpen });
            closeTaDrawer();
            updateTaTriggerLabel();
            pointState.cachedSchedule = loadCachedForCurrentChat();
            if (!panelOpen) return;
            $inAll('.sp-outline-btn').removeClass('sp-btn-active');
            updateCreativeChatModeUI();
            $in('#sp-chat-msgs').empty();
            $in('#sp-space-msgs').empty();
            if (pointState.cachedSchedule) setBody(pointState.cachedSchedule);
            else setBody(`<div class="sp-empty"><i class="fa-regular fa-calendar"></i><p>还没有点</p><button class="sp-gen-btn" id="sp-gen-schedule-now">生成点</button></div>`);
        },
        scheduleAfterLoad(mig) {
            scheduleForChatBoundary(backfillLinesInlineBlocks, 300);
            coordinateRuntime?.feature?.refreshSavedKeys();
            scheduleForChatBoundary(() => coordinateRuntime?.feature?.scanButtons(), 300);
            scheduleForChatBoundary(checkMemoryMigrationNotice, 500);
            if (mig.status === 'conflict') scheduleForChatBoundary(() => showStoreConflictDialog(mig), 700);
            const calendarBoundary = captureChatBoundary();
            maybeApplyBoundCalendarTemplate().catch(error => {
                if (!isCurrentChatBoundary(calendarBoundary)) return;
                console.error('[SP calendar] 角色默认历法自动应用失败', safeDiagnosticLog('axis', 'save', error));
                if (getSettings().notifyMode === 'full') showToast('角色默认历法没有自动应用成功', null, true);
            });
        },
        refreshOutlineInjection: () => outlineFeature.injection.refresh(),
        refreshLinesInjection,
        refreshStoryClock: refreshStoryClockInjection,
        refreshLedgerInjection,
    });
    eventSource.on(event_types.CHAT_CHANGED, _stListeners.chat);
    // 首屏补迁移：扩展初始化时当前 chat 往往已 ready（CHAT_CHANGED 早已错过），
    // 否则老用户要手动切一次 chat 才触发迁移。同步搬数据，冲突延后弹窗。
    try {
        const _mig0 = store.migrateChatFromLocalStorage(getContext().chatId);
        if (_mig0.status === 'conflict') scheduleForChatBoundary(() => showStoreConflictDialog(_mig0), 900);
        if (pluginEnabled()) maybeApplyBoundCalendarTemplate().catch(error => {
            console.error('[SP calendar] 首屏角色默认历法自动应用失败', safeDiagnosticLog('axis', 'save', error));
            if (getSettings().notifyMode === 'full') showToast('角色默认历法没有自动应用成功', null, true);
        });
    } catch (err) { console.warn('[SP store] 首屏迁移失败', safeDiagnosticLog('storage', 'save', err)); }
    bindChatFloorListeners({
        eventSource,
        event_types,
        store: _stListeners,
        h: {
            pluginEnabled,
            getContext,
            getSettings,
            automationModules: AUTOMATION_MODULES,
            automationGate,
            timeTravelClaimTokens: _timeTravelClaimTokens,
            timeTravel,
            lines: linesFeature,
            get coordinate() { return coordinateRuntime?.feature; },
            scheduleForChatBoundary,
            syncLatestAlmanacBlock,
            syncLatestScheduleBlock,
            refresh: refreshController,
            beat: beatFeature,
            activity: activityFeature,
            floorSig: _floorSig,
            rememberPace,
            isAutomationSuppressed,
            relandStoryClockAnchor,
            buildDateRenderKey,
            consumeDateBootstrap,
            dateCoordinator,
            pace: paceBook,
            getAlmanacJudgeInterval,
            getLedgerCaptureInterval,
            getLedgerJudgeInterval,
            runJudgeDateStep,
            runLedgerCaptureStep,
            runLedgerJudgeStep,
            refreshLedgerInjection,
            refreshInlineWindow,
            refreshStoryClockInjection,
            outline: outlineFeature,
            timeTravelDeleted: createLedgerDeletedHandler({
                cancel: cancelTimeTravelForDeletion,
                reconcile: reconcileLedgerSources,
                toast: showToast,
                refreshInject: refreshLedgerInjection,
                refreshInline: () => refreshInlineWindow(true),
                refreshPanel: () => { if (axisState.almanacMode && axisState._almanacSheet === 'ledger') renderAlmanacPanel(); },
            }),
            refreshDiagnosticRetention,
            pruneExternalSnapshots,
            isExternalMode,
            warnRename: err => console.warn('[7dayscal] 坐标改名同步失败', safeDiagnosticLog('axis', 'save', err)),
        },
    });
    // 柏宝书就绪事件：加载顺序不固定，早期同步检测可能扑空而误报"未就绪"。
    // 柏宝书文档推荐监听 st-baibai-book:ready 兜底——就绪后清掉"仅警告一次"的闩，
    // 并在面板开着且选了柏宝书源时立刻把状态刷成"已就绪"。
    if (_bbbReadyListener) window.removeEventListener('st-baibai-book:ready', _bbbReadyListener);
    _bbbReadyListener = () => {
        if (!pluginEnabled()) return;   // 插件总关
        getMemText._bbbWarned = false;
        if (getSettings().useBaiBaiBook) { try { renderMemorySection(); } catch {} }
    };
    window.addEventListener('st-baibai-book:ready', _bbbReadyListener);
    // Track ST theme changes via MutationObserver on documentElement style
    _themeObserver?.disconnect();
    _themeObserver = new MutationObserver(() => {
        // Only auto mode follows ST; forced day/night ignores ST changes.
        if ((getSettings().themeMode || 'auto') !== 'auto') return;
        const t = detectSTTheme();
        if (t !== currentTheme) applyTheme(t);
    });
    _themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    // 首屏落地插件总开关：若加载时已是关闭态，藏球 / 清块 / 断后台 / 撤注入（各首屏挂载虽已被 pluginEnabled 闸挡，
    // 这里兜底把已挂的悬浮球藏掉、把注入清干净）。开启态无需动——上面各首屏路径已正常挂载。
    if (!pluginEnabled()) applyPluginEnabled(false);
});
// ─── Config helpers ───────────────────────────────────────────────────────────

// ─── Plugin settings (persisted in ST's settings.json) ────────────────────────


// 剔除参数：解析用户输入（换行/逗号分隔的参数名）成去空去重的数组。
// 用于规避不接受某些参数（如 Gemini 代理不认 frequency_penalty）的兼容端点报 400。


// 机械任务分流用 cfg：仅供「记忆摘要 / 大纲推进判定」这类机械调用。
// 设了 utilityPresetId 且该预设有 url+key → 用该预设快照；否则退回主 cfg（loadCfg）。
// 其他生成类调用按各自调用方读取配置；空/无效时遵循现行默认路径。


// ─── API 存储快切：预设仓库 ────────────────────────────────────────────────────
// 预设是「整套 API 配置的命名快照」。切换后立即填入并应用该快照。


// 把一套 cfg（loadCfg 形状）存成预设。有 id 且已存在→覆盖(改名+更新内容)，否则新建。
// 返回被写入/新建的预设 id。


// 给已存预设改名（就地，不动 url/key/model 等）。空名→保留原名。


// ─── 插件总开关（③）───────────────────────────────────────────────────────────
// pluginEnabled 关 = 全隐身；injectEnabled 关 = 掐线/面/刻度潜伏注入（受 pluginEnabled 统辖）。

// 一键中断所有在飞的后台判定与生成（各域 controller 及日期检测/点后台任务），并清 re-entry 闸，
// 让重新开启后能干净重跑。照 CHAT_CHANGED 的中断序列集中一处。
function _abortAllBackground() {
    const ctx = getContext?.() || {};
    traceDiagnosticEvent('abort-boundary', { module: 'runtime', chatId: ctx.chatId ?? null, chatRevision: pointTaskOwners.currentChatRevision(), boundaryEpoch: chatBoundaryEpoch, abortReason: 'plugin-disabled', status: 'dispatch' });
    memory.abortAll('plugin-disabled');
    const activeTravel = timeTravel.getState();
    if (activeTravel) clearTimeTravelSession(activeTravel, { removeWaitingBlock: activeTravel.phase === 'waiting', reason: 'plugin-disabled' });
    _timeTravelSelectionSeq++;
    _activeTimeTravelSelection = null;
    customDialog.cancelActive();
    linesFeature.abortGeneration({ reason: 'plugin-disabled' });
    for (const c of [
        linesFeature.runtime.controller,
        pointState.scheduleAbortController,
        dateDetectionController.abortController, _autoRegenSchedAbort,
        ledgerCaptureController.abortController, ledgerJudgeController.abortController,
    ]) { try { c?.abort('plugin-disabled'); } catch {} }
    outlineFeature.abortAll('plugin-disabled');
    spaceFeature.abortAll('plugin-disabled');
    linesFeature.dashed.abort('plugin-disabled');
    pointState.scheduleAbortController = null;
    theaterFeature.onPluginDisabled();
    axisGenerationController.reset('plugin-disabled');
    _autoRegenSchedAbort = null;
    ledgerJudgeController.reset('plugin-disabled');
    ledgerCaptureController.reset('plugin-disabled');
    if (outlineMode) outlineFeature.chat.load();
}

// 插件总开关落地。关：藏悬浮球、清所有楼内块与坐标入口（由各 feature 内部闸兜底）、
// 断所有后台任务、撤各域潜伏注入。不关面板——用户往往正站在设置里切它，留着好即时切回。
// 开：按各子开关恢复——显示悬浮球、重挂楼内块与线/面/故事时钟/刻度注入、补锚点入口。事件监听不注销，靠各 listener 的 pluginEnabled() 闸空转。
function applyPluginEnabled(on) {
    const ctx = getContext();
    if (on) {
        if (theaterMode) theaterFeature.open();
        $(`#${FAB_ID}`).css('display', fabEnabled() ? '' : 'none');
        try { backfillLinesInlineBlocks(); } catch {}   // 重挂线/历/点楼内块 + 重设线潜伏注入
        try { outlineFeature.injection.refresh(); } catch {}       // 重设大纲潜伏注入
        try { coordinateRuntime?.feature?.refreshSavedKeys(); coordinateRuntime?.feature?.scanButtons(); } catch {} // 补回锚点收藏入口
        try { refreshInlineWindow(true); } catch {}
        maybeApplyBoundCalendarTemplate().catch(error => {
            console.error('[SP calendar] 重新启用后角色默认历法自动应用失败', safeDiagnosticLog('axis', 'save', error));
            if (getSettings().notifyMode === 'full') showToast('角色默认历法没有自动应用成功', null, true);
        });
    } else {
        try { coordinateRuntime?.feature?.close?.(); } catch {}
        $(`#${FAB_ID}`).css('display', 'none');
        try { _clearAllInlineBoxes(); } catch {}
        _abortAllBackground();
        try { ctx.setExtensionPrompt?.(LINES_INJECT_KEY, ''); } catch {}
        try { outlineFeature.injection.clear(); } catch {}
        try { ledgerInjectionController.clear(); } catch {}
    }
    try { refreshStoryClockInjection({ announce: true }); } catch {}
    paintPaceSoon();
}







// ─── In-game day-change detection (桥接到历·almTodayAnchor) ───────────────────
// days 模式（跟随局内时间）的推进检测：从历的权威「今天」取 {月-日}，变化即推进。
// 历史上这里读柏宝书 state.time，现已改为桥接 almTodayAnchor
// 兜底来源按现行 anchor 优先级解析；柏宝书未安装时仍可由其他可用上下文推进，并与历共用同一个「今天」。
// extractDayFromTime / _cnToNumber / _CN_* 仍被 almTodayAnchor、parseJudgedDate 复用，保留。


// 中文数字 → 阿拉伯数字（覆盖 0–99，足以处理古代年月日）。含农历「廿/卅」与大写/繁体（民国·契据式）。


// 抽出"这一天"的规范化 key。剥掉 era 前缀、时分秒尾巴以及数字前导零，
// 让同一天不同写法（"1287/04/01" ≡ "1287/4/1" ≡ "1287年4月1日"）落到同一
// 个 key 上。返回 null 表示无法识别 → 不推进。

// ─── 楼内渲染框·快照桥 ────────────────────────────────────────────────────
// 采集「当前最新」的点/线/历/锚点 → 一份快照对象。这是权威源（sp-store 缓存 + 锚点）的
// 一次性抓拍；写进某层 AI 楼的 message.extra 后即成为那层楼的「死历史」。
// 只读、无副作用：任何时候调都安全。
// rawArg：null=读当前视角活缓存（最新楼，现状不变）；字符串=快照里的线 raw（历史楼）。
// readOnly：true=历史楼，去掉逐条注入/删除按钮 + 标题条的「推进」按钮（旧楼不触发生成）。
// 历史楼不并虚线子块（虚线是全局冷知识、非那层楼的历史态）。
// 楼内「标注池」框（AI 楼，镜像线块）：显示当前实际打捞到的暗历条目。
// poolArg：历史楼传快照里冻的 pool [{id,事由,类型,起始锚,周期长度,到期锚,标签,锁}]；最新楼传 null → 读活账 ledger.listEntries()
//   （与线/点/历「null=读活缓存」同款：最新楼恒反映当前标注池，historical 楼看当时冻结的）。
// readOnly=false（最新楼）：summary 带「标注/更新」两文字胶囊、每条带「锁定/归档了结」；true（历史楼）：纯只读。
// 空池 → 返回 ''（该楼不挂此段；与线/点/历子块空态、及旧「空回显不挂」一致，默认开关下不冒空条）。
// 字段照标注池闭环：类型胶囊(上色) + 事由 + 起始/周期/终止 + 标签；不显现状（现状归「召回」框）。
// 统一楼内块由当前渲染窗口控制；历史楼保留各自快照，最新楼读活态。
// 虚线冷知识已折进 .sp-lines-inline 的 body（合并成一个楼内块），清线块即连虚线一并清；
// 仍带上 .sp-dashed-inline 兜底，扫掉合并前旧版本残留在 DOM 里的独立虚线块。
// 新楼层挂线块 + （可选）首次推进生成。渲染改由 refreshInlineWindow() 统一负责；
// 入口保留唯一真副作用——首次推进的线生成，以及推进前后的即时刷窗。
// Back-fill：切聊天/初始化/主开关切换时的入口。渲染交给窗口控制器；保留潜伏注入 refresh 真副作用。
async function backfillLinesInlineBlocks() {
    refreshLinesInjection();   // chat 切换/初始化/主开关切换 → 重设潜伏注入（关闭时内部会清空）
    refreshStoryClockInjection();   // 时间戳：首屏/切 chat/主开关一并重设常驻注入
    refreshLedgerInjection();       // 暗历注入：首屏/切 chat/主开关一并重设（关/空时内部自清）
    refreshInlineWindow(true);
}

// Refresh the inline block on the latest AI message using current cache.
// Called after the panel regenerates lines so the message-level block doesn't
// stay stale until page reload.
function syncLatestInlineBlock(expectedChatId = null) {
    // If caller passed a chatId snapshot, skip when chat changed mid-flight
    if (expectedChatId != null && getContext().chatId !== expectedChatId) return;
    refreshLinesInjection();   // 线变化（regen/advance/edit/delete 都汇流到这）→ 重设潜伏注入（这是本函数唯一「非渲染」真副作用，保留）
    refreshInlineWindow(true);  // 线数据变 → 立即重算渲染窗口（最新楼会冻快照+全功能重挂，历史楼各自快照）
}

// ─── 历·楼内日历块（只读，反映历+锚点，无生成）─────────────────────────────────
// 与线块平行、共存于最新 AI 楼。外壳（标题条）仿线：一个 <details>，收起时是扁扁的
// 「历 · N个日程」条，点整条即展开——配色/圆角/边框全走线的 .sp-inline-* 类。
// 展开后的内容是历自己的「往后六天」条：6 格（周X + M/D，从明天起，今天已在大头日期块里、
// 这里不重复），覆盖到历条目的日子高亮打点；窗口内有节日则每格可点、点下方就地展开当天安排（.sp-alm-sday）。
// 纯读 loadAlmanac()+锚点，不请求 API、不受 linesEnabled 影响，只受 almanacInlineEnabled 开关控制。
// itemsArg：null=读当前活历 loadAlmanac()（最新楼）；数组=快照里的历条目（历史楼）。
// anchorArg：null=读当前锚点 almTodayAnchor()；{month,day}=快照锚点。历本就只读，无按钮需 gate。
// 楼内轴渲染统一由 axisInlineRenderer 提供。

// 历楼内只读渲染由 axis inline seam 持有；宿主仅提供实时数据与纯历法 helper。
const axisInlineRenderer = createAxisInlineRenderer({
    settings: getSettings,
    loadItems: loadAlmanac,
    today: almTodayAnchor,
    calendar: loadCalDesc,
    weekdayRef: cal => almWeekdayRef(cal),
    dayOfYear: almDayOfYear,
    weekdayFor: almWeekdayFor,
    yearLength: calYearLen,
    monthDayFromDoy: almMonthDayFromDoy,
    weekdays: ALM_WEEKDAYS,
    itemCoversDoy: almItemCoversDoy,
    typeMeta: almTypeMeta,
    clamp: almClampInt,
    daysUntil: almDaysUntil,
    escapeHtml,
    monthName: calMonthName,
    cleanText,
});
inlineFeature?.destroy?.();
inlineFeature = createInlineFeature({
    getSettings, extensionSettings: extension_settings, getContext, loadAlmanac, almTodayAnchor, loadCalDesc,
    almWeekdayRef, almDayOfYear, almWeekdayFor, ALM_WEEKDAYS, escapeHtml, calMonthName, getDateAnchor,
    charStableKey, readCacheRaw, getCacheKey, parseCalendar, weatherGlyph, calHasEra, validRealDate,
    formatCalendarDate, formatStoryClockHeadParts, storyClockEnabled, latestStoryClock, parseJudgedDate, readStore,
    getLinesCacheKey, parseLines, linesFeature, snapshot, keyDesc, createWeekdayConsumerContext,
    storyWeekdayRefPure, ALM_CHAT_SCAN_LIMIT, pointInlineRenderer, axisInlineRenderer, $, _buildLedgerBlockHtml,
    buildUserRecall: _buildUserRecallBoxHtml,
    pluginEnabled, documentRef: document, windowRef: window,
    freezeSnapshot: freezeSnapshotToFloor,
    readSnapshot: id => snapshot.readSnapshot(id),
    resolveSnapshotCalendar: snap => snapshot.resolveSnapshotCalendar(snap, {
        fallback: readStore(keyDesc('caldesc-fallback', 'user', '')),
        marker: !!readStore(keyDesc('caldesc-fallback', 'user', '')),
        current: loadCalDesc(),
    }),
    chatMessage: floor => getContext()?.chat?.[floor]?.mes || '', parseStoryClock: parseStoryClockPure,
    coordinateChanged: () => coordinateRuntime?.feature?.onChatDomChanged?.(),
    isStreaming: () => linesFeature.isStreaming(),
    syncTheme: () => syncVectorGlyphTheme(document, currentTheme, (getSettings().themeMode || 'auto') !== 'auto'),
    watchChatDom: !chatSurfaceOwnsDom,
});
if (document.querySelector('#chat')) inlineFeature.init();
// ─── 线·伏笔潜伏注入（隐形注入主楼 AI）────────────────────────────────────────
// 把当前视角的活跃线（跳过终态 stage）以 SYSTEM 角色注入聊天上下文（IN_CHAT + depth），
// 让主楼 AI「心里有数」、把伏笔当暗流自然缓慢推进；聊天记录里不显示。默认关（opt-in）——
// 改 AI 行为且增加 token。刷新时机跟内联块同步（见 sync/backfill + 开关 handler）。
const LINES_INJECT_KEY   = 'sp_lines_latent';
// 重设潜伏注入。读当前视角活跃线；关闭或无活跃线时清空。幂等，可随处多调。
function refreshLinesInjection() {
    return linesFeature.injection?.refresh?.();
}

// 历 / 暗账的攒楼闸在 paceBook 里；间隔仍由设置读。
function getAlmanacJudgeInterval() {
    const n = Number(getSettings().almanacJudgeInterval);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 3;
}

// 暗账标注间隔（缺省/非法 → 5；≥1）。抄 getAlmanacJudgeInterval。
function getLedgerCaptureInterval() {
    const n = Number(getSettings().ledgerCaptureInterval);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 5;
}

// 暗账判定（刷现状）间隔（缺省/非法 → 4；≥1）。抄 getLedgerCaptureInterval。
function getLedgerJudgeInterval() {
    const n = Number(getSettings().ledgerJudgeInterval);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 4;
}

function readPaceSnapshot() {
    const settings = getSettings();
    const gates = paceBook.liveGates();
    return {
        alignOn: settings.ledgerReconcileEnabled === true,
        alignUsed: gates.align.counter,
        alignInterval: getLedgerReconcileInterval(),
        linesOn: settings.linesEnabled !== false,
        linesMode: getLinesMode(),
        pendingAdvance: gates.pendingAdvance,
        missingStamp: missingLatestStamp(),
        advanceUsed: gates.advance.counter,
        advanceInterval: getLinesInterval(),
        outlineOn: settings.outlineJudgeEnabled === true,
        outlineUsed: gates.outline.counter,
        outlineInterval: outlineFeature.judge?.getInterval?.() || 3,
        dateOn: settings.almanacAutoDetect !== false,
        dateUsed: gates.date.counter,
        dateInterval: getAlmanacJudgeInterval(),
        dashedOn: settings.dashedEnabled === true,
        dashedUsed: gates.dashed.counter,
        dashedInterval: Math.max(1, Number(settings.dashedAutoInterval) || 6),
        ledgerOn: settings.ledgerCaptureEnabled === true,
        ledgerCaptureUsed: gates.ledgerCapture.counter,
        ledgerCaptureInterval: getLedgerCaptureInterval(),
        ledgerJudgeUsed: gates.ledgerJudge.counter,
        ledgerJudgeInterval: getLedgerJudgeInterval(),
    };
}

function persistPaceNow() { paceBook.persist(); }
function rememberPace() { paceBook.remember(); }
function hydratePaceFromStore() { paceBook.hydrate(); }

hydratePaceFromStore();

function paintPace() {
    const rows = pluginEnabled() ? collectPaceRows(readPaceSnapshot()) : [];
    const empty = pluginEnabled() ? '后台节奏都关着' : '插件关着';
    const $fold = $in('#sp-pace-fold');
    if ($fold.length) $fold.html(paceStripHtml(rows, { empty }));
    const $activityPace = $in('#sp-activity-pace');
    if ($activityPace.length) $activityPace.html(paceStripHtml(rows, { empty, id: 'sp-activity-pace-strip' }));
    const $settings = $in('#sp-pace-settings');
    if ($settings.length) $settings.html(paceStripHtml(rows, { empty, id: 'sp-pace-settings-strip' }));
    for (const row of rows) {
        const $el = $in(`[data-pace-remain="${row.id}"]`);
        if (!$el.length) continue;
        $el.text(row.text).toggleClass('is-off', !!row.off).toggleClass('is-due', !row.off && (!!row.due || row.text === '下一楼' || row.text === '下一楼补'));
    }
    if (!rows.length) $in('[data-pace-remain]').text('').removeClass('is-due is-off');
}

let _pacePaintQueued = false;
function paintPaceSoon() {
    if (_pacePaintQueued) return;
    _pacePaintQueued = true;
    const kick = () => { _pacePaintQueued = false; paintPace(); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(kick);
    else setTimeout(kick, 0);
}

// ─── 时间戳·时间锚点体系（注入 + 结构化回读 + 只读显示）─────────────────────────
// 目标：给整个构画一个「跟着剧情走」的坚固时间源。做法＝强制注入一段提示词，让主楼 AI
// 每楼正文首尾各打一个 HTML 注释时间戳（<!-- SDC-start … --> / <!-- SDC-end … -->），
// 我们再从 chat 末尾往回扫读回。HTML 注释酒馆天然不渲染，无需像柏宝书那样加隐藏正则；
// 但注释必须留在 message.mes 里，下楼主模型才看得见上楼 end、以它为基准往前推。
// 命门（吸收自柏宝书方法论、提示词全自写）：
//   ① 起止双界——一楼是一段区间不是一个点，故首尾两个戳；
//   ② 标签留正文——绝不删，靠它让下楼继承基准，增量在模型脑内、输出成绝对值；
//   ③ 往回扫 + 兜底——读「当前时间」从末楼往前扫第一条可解析的（end 优先），漏了也不崩。
// 当前链路会将时间戳注入、解析为结构化日期，并在完整戳存在时优先落入共享锚；缺失时按设置走 API 兜底。
// 首尾注释的正则（宽松容错：允许注释内外多余空白；内容自由，不强制格式）。

// 时间戳总开关（不受 injectEnabled 统辖，只受 pluginEnabled + 本开关；见 refreshStoryClockInjection）。默认开——用户定：这是全插件时间地基，值得常驻。
// storyClockEnabled 已迁至轴控制器。

// 自写提示词（吸收柏宝书三套路：拔高到系统强制 / 以上楼 end 为基准推进 / 禁用「某天」敷衍；
// 措辞、示例、标签名全原创，绝不照搬）。粒度到小时，年份可写可略。

// 取生效的强注词：用户在设置里二改了(非空)就整段用他的；留空用内置默认（默认词随插件更新）。
// 重设时间戳注入。关闭时清空。幂等，可随处多调。照 refreshLinesInjection 套路。
// refreshStoryClockInjection 已迁至 storyClockController。

// 从单楼正文解析首尾戳，并供结构化日期解析使用。返回 { start, end }（各为去空白后的原文字符串，缺失=null）。
// 从 chat 末尾往回扫，取最近一楼「可解析出至少一个戳」的 AI 楼。end 优先作「当前时间」。
// 漏了/坏了不崩：某楼无戳就继续往上找；全无 → 返回 null（显示层据此不显示这一行）。
// latestStoryClock 已迁至 story-clock.js。

// 从最近一楼的戳解析出结构化 {month,day}。end 优先(当前时间)、退 start。无戳/解析不出 → null（交回兜底）。
// storyClockDate 已迁至 story-clock.js。

// 自定义历法下，正文用的是自定义月名（如「霜月」），公历式发问会答非所问。带上历法描述、
// 并允许 AI 用「第M月D日」或月名作答；内置公历返回上面的原版 prompt（零行为变化）。

// ═══ 暗账·标注 ═════════════════════════════════════════════════════════════════
// 构画 AI 从最近正文里捞「需按时间追踪」的新事件，标注入 sp-ledger（此时·此物·此状态）。
// 起始锚 = 此刻楼层 + 历「今天」(almTodayAnchor)，钉死不改；判定与注入由同域流程负责。
// 触发：每 N 楼自动车(runLedgerCaptureStep 无参) + 轴面板「刻度」页手动「立即标注」(manual=true)。
// capture 窗口与来源批次大小由 business/ledger/capture.js 统一提供。

// ═══ 暗历③·判定·刷现状 ═══════════════════════════════════════════════════════
// 每 N 楼把活跃条目连同「距今几天」（纯 JS 算好，LLM 不擅长日期差）喂给构画 AI，
// 只让它回「状态该随时间变化的那几条」的新现状/了结/周期滚动。CODE 算数、AI 只下结论——正是暗历立意。
// ═══════════════════════════════════════════════════════════════════════════
//  检索·注入前置选择器（挑「哪几条」喂主楼 AI——全亮注入会撑爆 token 且喧宾夺主）
// ═══════════════════════════════════════════════════════════════════════════
// 策略＝场景感知：读最近几楼正文，正文提到某条的牵扯/标签就加权，叠在「临近到期/用户锁/
// 近期登记」基础权重上，砍到 N 条上限；活跃条少于上限时全带（兜底）。已了结由 listEntries
// 天然排除。留 RAG 口子：scoreLedgerEntry 整个可换（将来接 arg 检索只改这一处打分器）。

// 最近 N 楼 AI 正文拼成一段（去标记）。供场景加权命中判断；只读、无副作用。
function missingLatestStamp() {
    if (!pluginEnabled() || getSettings().linesEnabled === false || getLinesMode() !== 'days') return false;
    const chat = getContext()?.chat || [];
    const latest = latestAiFloor(chat);
    if (!latest) return false;
    return !latestStampDay(chat, latest.index, parseStoryClockPure);
}

async function fillLatestStoryClock() {
    const chat = getContext()?.chat || [];
    const latest = latestAiFloor(chat);
    if (!latest) {
        showToast('没有可补的 AI 楼', null, true);
        return { status: 'failed' };
    }
    const current = parseStoryClockPure(latest.text);
    const previous = previousCompleteStoryClock(chat, latest.index);
    const meta = current.endMeta?.valid ? current.endMeta : (current.startMeta?.valid ? current.startMeta : (previous?.endMeta || previous?.startMeta || {}));
    let today = null;
    try { today = almTodayAnchor(); } catch { today = null; }
    const date = (meta.date ? formatCalendarDate(meta.date, loadCalDesc(), calMonthName) : '')
        || (today ? formatCalendarDate(today, loadCalDesc(), calMonthName) : '');
    const weekday = String(meta.weekdayText || (today ? almWeekdayFor(today.month, today.day, almWeekdayRef()) : '') || '周一');
    const startTime = String(current.startMeta?.time || previous?.endMeta?.time || '12:00');
    const endTime = String(current.endMeta?.time || startTime);
    const fields = await customDialog.promptFields({
        title: '补这楼时间戳',
        body: '只写进本楼隐藏注释，不改正文。日期写法跟故事里一致即可。',
        confirmText: '写入',
        fields: [
            { name: 'date', label: '日期', type: 'input', value: date, placeholder: '如 10月4日', maxLength: 40 },
            { name: 'weekday', label: '星期', type: 'input', value: weekday, placeholder: '周一至周日', maxLength: 8 },
            { name: 'startTime', label: '开始时刻', type: 'input', value: startTime, placeholder: '15:30', maxLength: 12 },
            { name: 'endTime', label: '结束时刻', type: 'input', value: endTime, placeholder: '16:00', maxLength: 12 },
        ],
        validate: result => applyStoryClockToMessage('正文', result).ok ? '' : '日期、星期（周一至周日）和时刻都要能解析',
    });
    if (!fields) return { status: 'cancelled' };
    const applied = applyStoryClockToMessage(chat[latest.index].mes || '', {
        date: fields.date,
        weekday: fields.weekday,
        startTime: fields.startTime,
        endTime: fields.endTime,
    });
    if (!applied.ok) {
        showToast('时间戳写不进去，请检查日期和时刻', null, true);
        return { status: 'failed' };
    }
    chat[latest.index].mes = applied.text;
    scriptCore.saveChatDebounced?.();
    eventSource.emit(event_types.MESSAGE_EDITED, latest.index);
    linesFeature.lifecycle.holdConfirmedFloor({ chatId: getContext().chatId, messageId: latest.index });
    runAnchorAftermath();
    showToast('已补上这楼时间戳');
    activityFeature.paint();
    return { status: 'updated' };
}

// ─── 共享锚点善后 ───────────────────────────────────────────────────────────
// 任何一处改「今天」锚点（自动判定 applyDetectedDate / 历面板 ±1天·改·恢复自动）后都走这里，统一善后：
//   1) 刷当前渲染窗口与轴面板；2) 日期制线推进在这里检测换日。
// 点不再随「今天」后台整表重排；时旅仍可显式调用 syncPointToToday。点/线对齐走刷新条或 ledgerReconcileEnabled。
function runAnchorAftermath() {
    syncLatestAlmanacBlock();
    syncLatestScheduleBlock();
    // 星期锚属于纯显示上下文：锚到位/变化时用现有 raw 重画当前点面板，不写 store、不请求 API。
    if (!pointState.isGenerating) {
        refreshCachedSchedule(currentView, charViewName, {
            setCached: html => { pointState.cachedSchedule = html; },
            setBody,
            visible: !outlineMode && !linesMode && !spaceMode && !theaterMode && !axisState.almanacMode && $(`#${MODAL_ID}`).is(':visible'),
        });
    }
    const _linesFloorId = (getContext().chat?.length ?? 0) - 1;
    const _linesDay = almTodayAnchor();
    void linesFeature.onDateAftermath({ messageId: _linesFloorId, chatId: getContext().chatId, day: _linesDay ? `${+_linesDay.month}-${+_linesDay.day}` : null });
    if (axisState.almanacMode) renderAlmanacPanel();
    // 点不再随「今天」后台整表重排；点/线对齐走刷新条或 ledgerReconcileEnabled。
    paintPaceSoon();
}

// schedulePointNeedsSync() —— 判断后台跟随/时旅流程是否仍有 pending follow-up 需要补同步。
function schedulePointNeedsSync(target = { view: 'user', charName: '' }, targetDate = null) {
    const view = target?.view === 'char' ? 'char' : 'user';
    const charName = view === 'char' ? String(target?.charName || '').trim() : '';
    const cacheKey = getCacheKey(view, charName);
    if (!cacheKey) return false;
    const raw = readStore(cacheKey)?.raw || '';
    return pointScheduleNeedsDateSync(raw, targetDate || almTodayAnchor());
}

// syncPointToToday() —— 自动跟随、时旅及 pending follow-up 共用的控制器 facade；将当前视角点重排到共享「今天」。
// 绝不占用 pointState.isGenerating（前台 UI 锁，sidebar 切换靠它挡）——后台占了会把整个面板卡死；防 race 靠自带 abort + 落地前重查。
let _autoRegenSchedAbort = null;
async function syncPointToToday(auto = false, travelContext = null) { return pointController.syncPointToToday(auto, travelContext); }
// 跨模块跳转只复用现有侧栏切换，并在目标 DOM 就绪后做可选预填。
function openPluginViewWithPrefill(view, inputSelector = '', prefill = '') {
    showPanel();
    const $tab = $in(`.sp-side-tab.sp-view-btn[data-view="${view}"]`);
    if (!$tab.hasClass('sp-view-active')) $tab.trigger('click');
    if (!inputSelector || !prefill) return Promise.resolve(true);
    return new Promise(resolve => setTimeout(() => {
        // 面板整棵在 shadow 内，须用 $in 查 shadowRoot（全局 $ 穿不进影子边界 → 找不到输入框）
        const $input = $in(inputSelector);
        if (!$input.length) { resolve(false); return; }
        const old = String($input.val() || '').trimEnd();
        if (!old.includes(prefill)) $input.val(old ? `${old}\n\n${prefill}` : prefill);
        autoGrowTextarea($input[0]);
        $input.trigger('focus');
        resolve(true);
    }, 0));
}

function initChatObserver() {
    if (typeof inlineFeature !== 'undefined' && inlineFeature) {
        inlineFeature.init();
        return;
    }
    const chat = document.querySelector('#chat');
    if (!chat) { setTimeout(initChatObserver, 600); return; }
    let timer = null;
    new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            coordinateRuntime?.feature?.onChatDomChanged();
            if (!linesFeature.isStreaming()) refreshInlineWindow();
        }, 400);
    }).observe(chat, { childList: true, subtree: true });
}

function injectModal() {
    _spShadow = null;
    _spDialogShadow = null;
    const cfg = loadCfg();
    const hasCustomApi = !!(cfg.url && cfg.key);
    const html = panelMarkup({
        themeToggleTitle, themeToggleIcon, fabEnabled,
        refreshFoldHtml, beatFoldHtml, activityFeature,
        getSettings, hasCustomApi, cfg, escapeAttr, escapeHtml,
        storyClockStatusCopy, storyClockController,
        THEATER_TARGET_CHARS, THEATER_COUNT_DEFAULT, THEATER_EXPORT_BOOK,
        linesFeature, paceStripHtml, collectPaceRows, readPaceSnapshot,
        getAlmanacJudgeInterval, getLedgerReconcileInterval, getLinesMode, getLinesInterval,
        outlineFeature,
    });
    // id/类留在 light DOM 的 host 上；内容进 shadow。键盘边界：截断输入框内非 Esc 的 composed keydown，
    // 避免 ST 把宿主 div 当成非输入元素而触发重roll/swipe。见 business/shell/hosts.js。
    const mounted = mountPluginHosts({
        document,
        extBase: EXT_BASE,
        stBase: ST_BASE,
        theme: currentTheme,
        html,
        markSurface: markTauriMobileSurface,
    });
    _spShadow = mounted.root;
    _spDialogShadow = mounted.dialogShadow;

    paintPace();

    if (cfg.key) $in('#sp-cfg-key').val(maskKey(cfg.key)).data('real', cfg.key);

    bindPanelChrome({
        $in, $,
        close: closePanel,
        activity: activityFeature,
        toggleSettings,
        fabEnabled,
        settings: getSettings,
        save: saveSettingsDebounced,
        fabId: FAB_ID,
        cycleTheme: cycleThemeMode,
    });
    activityFeature.bindUi();
    // 模块介绍气泡：点标题旁的 ? 弹出当前模块简介，点外部/切模块即关。
    // shadow 内点击的 e.target 被重定向为 host，改走 composedPath 判断是否落在 pop/btn 内。
    bindModuleIntro({ $in, $, intros: MODULE_INTROS });
    bindDiagnostics({
        $in, inEl,
        refreshPreview: refreshLastDebugPayloadPreview,
        copyPayload: copyLastDebugPayload,
        exportTrace: () => shareRecentDiagnosticTrace({
            copyText: copyPlainText,
            promptTextarea: options => customDialog.promptTextarea(options),
            notify: (message, isError) => showToast(message, null, isError),
        }),
        exportCurrent: exportCurrentChatDiagnosticPackage,
    });

    outlineFeature.bindUi();

    spaceFeature.bindUi();
    beatFeature.bindUi();
    bindLinesPanel({
        $, $in, $chat: $('#chat'),
        lines: linesFeature,
        generate: triggerGenerateLines,
        abort: abortLinesGen,
    });
    bindRefreshBar({
        $in,
        settings: getSettings,
        save: saveSettingsDebounced,
        align: form => refreshController.align(form),
        regenerate: form => refreshController.regenerate(form),
        diagnosticMessage,
        toast: showToast,
    });
    bindPointPanel({
        $, $in, $inAll, $chat: $('#chat'),
        regen: onRegenClick,
        pinChar: onCharPinToggle,
        currentView: () => currentView,
        charViewName: () => charViewName,
        deleteEvent: triggerDeletePointEvent,
        abort: abortScheduleGen,
    });
    taDrawer.bindUi();
    bindAdultReveal({ $, $in, $chat: $('#chat') });
    bindManualActionMenus({
        $, $inAll,
        close: closeActionMenus,
        pointView: () => ({ view: currentView, charName: charViewName }),
        pointEdit: (day, ev, view) => pointActions.editDescription(day, ev, view),
        pointPin: (day, ev) => triggerTogglePointPin(day, ev),
        pointDelete: (day, ev, view) => triggerDeletePointEvent(day, ev, view),
        inject: iid => injectToST(_injectTexts[iid]),
        lineEdit: idx => linesFeature.actions.edit(idx),
        linePin: idx => linesFeature.actions.pin(idx),
        lineDelete: idx => linesFeature.actions.delete(idx),
        outlineEdit: idx => outlineFeature.actions.editScene(idx),
        outlineCurrent: idx => outlineFeature.actions.toggleCursor(idx),
        outlineInject: iid => injectToST(outlineFeature.ui.getInjectText(iid)),
        outlineCopy: cid => {
            const text = outlineFeature.ui.getCopyText(cid);
            void copyPlainText(text).then(ok => showToast(ok ? '已复制' : '复制失败', null, !ok));
        },
        outlineDelete: idx => outlineFeature.actions.deleteBeat(idx),
    });
    bindInjectAndJump({
        $, $in, $inAll, $chat: $('#chat'),
        injectText: iid => _injectTexts[iid],
        inject: injectToST,
    });

    // ── 棱（小剧场）事件（全部委托到注入式 ui；旧委托仅作为无 UI 兼容路径）──
    const $theater = $in('#sp-theater-wrap');
    theaterFeature.bindUi($theater);

    // ── 历（日历）事件（委托到 #sp-almanac-wrap，两个 sheet 动态重渲染）──
    const $almanac = $in('#sp-almanac-wrap');
    $almanac.on('click', '.sp-alm-sheet-btn', function () { almSetSheet($(this).attr('data-sheet')); });
    bindLedgerEvents({
        almanac: $almanac, chat: $('#chat'), $, settings: getSettings, saveSettings: saveSettingsDebounced,
        capture: { run: runLedgerCaptureStep, abort: () => ledgerCaptureController.abort() },
        judge: { run: runLedgerJudgeStep }, captureState: () => ({ busy: ledgerCaptureController.isBusy, controller: ledgerCaptureController.abortController }), actions: ledgerActions,
        render: renderAlmanacPanel,
        refreshInline: () => refreshInlineWindow(true),
        identity: () => ledgerOwnerIdentity(getContext() || {}),
        isCurrentIdentity: owner => sameLedgerOwner(owner, ledgerOwnerIdentity(getContext() || {})),
        editor: { open: openLedgerEditor, save: saveLedgerEditor, close: closeLedgerEditor, get: getLedgerEditor },
        archive: { toggle: toggleLedgerArchiveOpen },
        batch: { scopes: BATCH_SCOPES, scope: getBatchScope, setScope: setBatchScope, selected: getBatchSelected, reset: batchReset, ids: batchScopeIds, exec: execBatch },
        toast: showToast, resetCapture: () => { paceBook.ledgerCapture.resetCounter(); },
    });
    bindAlmanacPanel($almanac, {
        $, $in, $inAll,
        state: axisState,
        settings: getSettings,
        toast: showToast,
        render: renderAlmanacPanel,
        nudgeToday: almNudgeToday,
        dateActions: axisDateActions,
        charKey: () => charStableKey(getContext()),
        aftermath: runAnchorAftermath,
        relandClock: relandStoryClockAnchor,
        navMonth: almNavMonth,
        calMonth: almCalMonth,
        startTravel: startTimeTravel,
        cancelTravel: cancelTimeTravel,
        calendarActions: axisCalendarActions,
        openEditor: openAlmanacEditor,
        generate: triggerGenerateAlmanac,
        supplement: triggerSupplementAnniversary,
        openManager: openCalendarManager,
        closeActionMenus,
        togglePin: toggleAlmanacPin,
        deleteItem: deleteAlmanacItem,
        abortGen: abortAlmanacGen,
        saveEditor: saveAlmanacEditor,
        closeEditor: closeAlmanacEditor,
        renderWdHint: almRenderWdHint,
        closeManager: closeCalendarManager,
        openSpacePrefill: openPluginViewWithPrefill,
        manager: axisCalendarManager,
        prompt: options => customDialog.prompt(options),
        confirm: options => customDialog.confirm(options),
        loadTemplates: loadCalendarTemplates,
        loadCal: loadCalDesc,
        templateNameLength: CALENDAR_TEMPLATE_NAME_LENGTH,
        calendarSummary,
    });

    // 批次3：同 spIntro——action 菜单在 shadow 内，target 重定向失效，改 composedPath 判断。
    // hotfix3：合成事件无 originalEvent → ?. 防御，path 为空 → some()=false → 走关闭分支（安全默认）
    bindActionMenuDismiss({ $, close: closeActionMenus });

    $in('.sp-root').on('click', '.sp-view-btn', function () {
        handlePanelViewClick({
            $in,
            hideIntro: () => $in('#sp-module-intro-pop').hide(),
            settingsOpen: () => settingsOpen,
            toggleSettings,
            activity: activityFeature,
            theaterOn: () => theaterMode,
            get theater() { return theaterFeature; },
            closeTaDrawer,
            toggleTaDrawer,
            pointGenerating: () => pointState.isGenerating,
            markSideTab(view, $btn) {
                $inAll('.sp-side-tab.sp-view-btn').removeClass('sp-view-active');
                $btn.addClass('sp-view-active');
                _lastMainView = view;
                syncRefreshBar(view);
            },
            markSubBtn(view, $btn) {
                $inAll('.sp-sub-btn').removeClass('sp-view-active');
                $btn.addClass('sp-view-active');
            },
            modes: () => ({ outline: outlineMode, lines: linesMode, space: spaceMode, theater: theaterMode, almanac: axisState.almanacMode }),
            setModes(next) {
                outlineMode = !!next.outline;
                linesMode = !!next.lines;
                spaceMode = !!next.space;
                theaterMode = !!next.theater;
                axisState.almanacMode = !!next.almanac;
            },
            outline: outlineFeature,
            space: spaceFeature,
            paintLines() {
                if (linesRuntime.busy) linesFeature.renderBody(loadingHtml('正在推演线', 'sp-abort-lines'));
                else {
                    const cached = loadCachedLinesForCurrentChat();
                    linesFeature.renderBody(cached || renderEmptyLinesState());
                }
            },
            paintTheater() {
                if (theaterFeature.busy) setTheaterBody(loadingHtml('正在折射', 'sp-abort-theater'));
                else theaterFeature.open();
            },
            paintAlmanac: () => renderAlmanacPanel(),
            paintSchedule() {
                $inAll('.sp-sub-btn').removeClass('sp-view-active');
                $inAll(`.sp-sub-btn[data-view="${currentView}"]`).addClass('sp-view-active');
                updateTaTriggerLabel();
                if (pointState.isGenerating) setBody(loadingHtml('正在规划', 'sp-abort-generate'));
                else if (pointState.cachedSchedule) setBody(pointState.cachedSchedule);
                else showEmptyGenerate();
            },
            enterAnchor: () => enterCoordinateSidebar({
                resetModes: () => { outlineMode = false; linesMode = false; spaceMode = false; theaterMode = false; axisState.almanacMode = false; },
                show: () => showPanelView($in, 'anchor'),
                feature: coordinateRuntime?.feature,
            }),
            get coordinate() { return coordinateRuntime?.feature; },
            currentView: () => currentView,
            setView,
        }, $(this));
    });

    bindApiFields({
        $, $in, $inAll,
        settings: getSettings,
        save: saveSettingsDebounced,
        settingsOpen: () => settingsOpen,
        toggleSettings,
        toggleKey: toggleKeyVisibility,
        fetchModels,
        syncPreset: () => apiPresetUi.syncState(),
        renderModelList,
        cachedModels: () => _cachedModels,
        maskKey,
        parseExcludeParams,
    });
    apiPresetUi.bind();
    apiPresetUi.render();
    apiPresetUi.renderUtility();
    bindSettingsPanel({
        $in,
        settings: getSettings,
        save: saveSettingsDebounced,
        saveNow: stSaveSettings,
        saveLinesMode,
        saveLinesInterval,
        resetLinesCounter: () => linesFeature.resetCounter(),
        rememberPace,
        paintPaceSoon,
        charKey: () => charStableKey(getContext()),
        setScale,
        setAdultMode,
        applyPluginEnabled,
        refreshLinesInjection,
        refreshOutlineInjection: () => outlineFeature.injection.refresh(),
        refreshLedgerInjection,
        refreshStoryClockInjection,
        refreshInline: refreshInlineWindow,
        backfillInline: backfillLinesInlineBlocks,
        onAdultBlurChanged: () => {
            if (linesMode) linesFeature.refreshPanel();
            if (!outlineMode && !linesMode && !spaceMode) {
                const saved = readStore(getCacheKey(currentView, charViewName));
                pointState.cachedSchedule = saved?.raw ? renderSchedule(saved.raw, saved.userName || '用户', currentView, loadCalDesc()) : null;
                if (pointState.cachedSchedule) setBody(pointState.cachedSchedule);
            }
        },
        isAlmanacMode: () => axisState.almanacMode,
        isLinesMode: () => linesMode,
        isOutlineMode: () => outlineMode,
        renderAlmanacPanel,
        refreshLinesPanel: () => linesFeature.refreshPanel(),
        syncLatestInlineBlock,
        resetDashedAuto: () => linesFeature.dashed.resetAuto?.(),
        cleanupDashed: notify => linesFeature.dashed.cleanup(notify),
        normalizeDashedKeepCount: value => linesFeature.dashed.normalizeKeepCount(value),
        resetOutlineJudge: () => outlineFeature.resetJudgeCounter(),
        refreshOutlinePanel: () => outlineFeature.refreshPanel(),
        resetDateCounter: () => paceBook.date.resetCounter(),
        toast: showToast,
        parseFontFamily: parseFontFamilyFromCss,
        applyUiFont,
        fontDefaultUrl: SP_FONT_DEFAULT_URL,
        fontDefaultFamily: SP_FONT_DEFAULT_FAMILY,
        resetAlignCounter: () => refreshController.resetCounter(),
        resetLedgerCaptureCounter: () => paceBook.ledgerCapture.resetCounter(),
        resetLedgerJudgeCounter: () => paceBook.ledgerJudge.resetCounter(),
        scanAnchorButtons: () => coordinateRuntime?.feature?.scanButtons(),
    });

    panelWindow.bindDrag(inEl('.sp-content-head'));
    panelWindow.bindResize($in('#sp-resize-handle'), inEl('#sp-resize-handle'));
    panelWindow.bindOutlineDivider();
    panelWindow.restoreOutlineChatHeight();
    bindMemorySettings({
        $, $in,
        settings: getSettings,
        save: saveSettingsDebounced,
        saveNow: stSaveSettings,
        memory,
        render: renderMemorySection,
        toast: showToast,
        diagnosticMessage,
        refreshStoryClock: refreshStoryClockInjection,
        defaultStoryClockPrompt: () => buildStoryClockPrompt({}),
        refreshStatus: refreshMemoryStatus,
        setProgressVisible: setMemoryProgressVisible,
        updateProgress: updateMemoryProgress,
        confirm: options => spConfirm(options),
    });
    bindTheaterSettings({
        $, $in,
        settings: getSettings,
        save: saveSettingsDebounced,
        theater: theaterFeature,
    });
    bindStoragePanel({
        $, $in, store,
        identity: () => readStorageChatIdentity(getContext()),
        toast: showToast,
        confirm: options => spConfirm(options),
        renderUsage: renderStorageUsage,
        renderMode: renderCurrentChatStorageMode,
        exportBackup: exportGouhuaBackup,
        importBackup: importGouhuaBackup,
        migrate: startCurrentChatMigration,
        storageStatus,
        reloadExternal: loadExternalChat,
        invalidateAlmanac: invalidateAlmanacTasksForStoreClear,
        refreshAlmanac: refreshAlmanacAfterStoreClear,
        invalidateKind: invalidateKindTasksForStoreClear,
        refreshEditors: refreshEditorsAfterStoreClear,
        refreshEditorsFromStore: refreshEditorsFromCurrentStore,
        invalidateLedger: invalidateLedgerTasksForStoreClear,
        refreshLedger: refreshLedgerAfterStoreClear,
        refreshMemory: refreshMemoryStatus,
        theater: theaterFeature,
        theaterOn: () => theaterMode,
        coordinate: () => coordinateRuntime?.feature,
        logAnchorError: err => console.error('[SP storage] 清空收藏失败', safeDiagnosticLog('storage', 'save', err)),
        clearLocalCache: () => theaterDeviceCache.clearPluginCache(),
    });
}

// ─── View (我 / TA) ───────────────────────────────────────────────────────────

function onRegenClick() {
    if (outlineMode) {
        void outlineFeature.generation.trigger({ reroll: true, module: 'outline' });
        return;
    }
    if (axisState._almSyncingPoint) { showToast('点正在同步到今天，稍候再刷新', null, true); return; }   // 同步在飞：别让点这边的刷新跟后台同步抢 store（否则重排点会被同步写回）
    if (pointState.isGenerating) return;
    // 刷新 = 对当前视角（我 / 当前 char）原地重排，永不弹填写框。
    // 「换人」已彻底交给 TA▾ 抽屉，与刷新解耦——故 user / char 两视角在此完全对称，同走 triggerGenerate。
    // （char 视角靠 charViewName 定主体，triggerGenerate→runGenerate 内部按 currentView/charViewName 取 subject。）
    triggerGenerate();
}

function setView(view, charName) {
    currentView = view;
    // 记住"最近看的 char 是谁"：切到 char 更新它；切回 user **不清**——否则再切回 char 时
    // 没了名字，只能退回填名界面（老 bug）。user 视角下泄漏无虞：store.scopeOf 用
    // `view==='char' && charName` 双重门，user 视角 charViewName 再有值也拼不进 char 子键。
    // 真正该清 charViewName 的只有换聊天(CHAT_CHANGED)/主动重选角色(onRegenClick)。
    if (view === 'char' && charName) charViewName = charName;
    $inAll('.sp-view-btn').removeClass('sp-view-active');
    $inAll(`.sp-view-btn[data-view="${view}"]`).addClass('sp-view-active');
    pointState.cachedSchedule = loadCachedForCurrentChat();
}

function switchToCharView() {
    currentView = 'char';
    const ctx     = getContext();
    // Prefer previously confirmed name; fall back to guessing from chat messages
    const guessed = charViewName || guessCharName(ctx);
    // 最近填过的名字（本卡），做快捷 chip；排掉正预填在输入框里的那个，避免重复。
    const recents = store.readRecentCharNames().filter(n => n !== guessed);
    const chipsHtml = recents.length
        ? `<div class="sp-char-recent">
               <span class="sp-char-recent-label">最近：</span>
               ${recents.map(n => `<button type="button" class="sp-char-recent-chip" data-name="${escapeAttr(n)}">${escapeHtml(n)}</button>`).join('')}
           </div>`
        : '';
    setBody(`<div class="sp-char-picker">
        <p class="sp-char-picker-hint"><i class="fa-solid fa-user-pen"></i> 输入要查看点的角色名</p>
        <div class="sp-char-picker-row">
            <input id="sp-char-name-input" class="sp-input" type="text"
                   placeholder="角色 / NPC / 反派皆可" value="${escapeAttr(guessed)}">
            <button id="sp-char-name-confirm" class="sp-save-btn">确认</button>
        </div>
        ${chipsHtml}
        <p class="sp-char-picker-sub">${guessed ? '根据近期对话预填，可直接修改。' : ''}不必是主角，任何出场人物、NPC、反派都能查看其点；查看不占固定槽，想常驻再去 📌 固定</p>
    </div>`);
    $inAll('.sp-view-btn').removeClass('sp-view-active');
    $inAll(`.sp-view-btn[data-view="char"]`).addClass('sp-view-active');
    // .off().on() prevents duplicate bindings on repeated calls
    $in('#sp-char-name-input').off('keydown.charview').on('keydown.charview', e => { if (e.key === 'Enter') confirmCharView(); });
    $in('#sp-char-name-confirm').off('click.charview').on('click.charview', confirmCharView);
    // 点 chip：填进输入框（不直接确认，留一步给用户改），聚焦到末尾。
    $inAll('.sp-char-recent-chip').off('click.charview').on('click.charview', function () {
        $in('#sp-char-name-input').val($(this).attr('data-name')).focus();
    });
    setTimeout(() => { $in('#sp-char-name-input').focus().select(); }, 50);
}

function confirmCharView() {
    const name = $in('#sp-char-name-input').val().trim();
    if (!name) { $in('#sp-char-name-input').focus(); return; }
    store.pushRecentCharName(name);   // 记进"最近填过的名字"，供多人卡下次预填
    setView('char', name);
    updateTaTriggerLabel();
    if (pointState.cachedSchedule) {
        setBody(pointState.cachedSchedule);
    } else {
        triggerGenerate();
    }
}

// 切到某固定槽 char：读缓存、不弹框、不重生成（无缓存 → 落「生成点」空态，不自动烧 API）。
function activateCharView(name) {
    const n = String(name || '').trim();
    if (!n) return;
    if (pointState.isGenerating) { showToast('点正在生成，稍候再换人', null, true); return; }
    closeTaDrawer();
    setView('char', n);          // 内部置 currentView/charViewName + active 态 + 载 pointState.cachedSchedule
    updateTaTriggerLabel();
    if (pointState.cachedSchedule) setBody(pointState.cachedSchedule);
    else showEmptyGenerate();
}

// 点视图头部 📌 切换：固定/取消固定当前 char（查看与固定解耦，此按钮是唯一的「固定」动作）。
// name 由调用方从按钮 data-name 传入（本卡渲染时的真名），兜底 charViewName——避免全局漂移致「没反应」。
function onCharPinToggle(name) {
    const n = String(name || charViewName || '').trim();
    if (!n) return;
    if (store.isPinnedChar(n)) {
        store.removePinnedChar(n);
        showToast(`已取消固定「${n}」`);
    } else {
        const r = store.addPinnedChar(n);
        if (r === 'full') { showToast(`固定槽已满（最多 ${store.PIN_CAP} 个），先在 TA▾ 里移除一个`, null, true); return; }
        showToast(`已固定「${n}」到 TA▾`);
    }
    // 固定态活在 store（独立于点 raw），故不重写 raw；但要用当前 raw 重跑 renderSchedule（内部读
    // isPinnedChar 定钉子高亮）刷新 pointState.cachedSchedule——否则重开面板/切视图回放旧字符串，钉态丢失
    // （对齐兄弟 triggerTogglePointPin：改完必更 pointState.cachedSchedule，别只改就地 DOM）。
    const saved = readStore(getCacheKey(currentView, charViewName));
    if (saved?.raw) {
        pointState.cachedSchedule = renderSchedule(saved.raw, saved.userName || '用户', currentView, loadCalDesc());
        setBody(pointState.cachedSchedule);
    } else {
        refreshCharPinIcon();   // 无 raw（罕见）→ 至少就地刷图标
    }
    if (taDrawer.isOpen()) openTaDrawer();   // 抽屉开着则同步重渲（槽增减/高亮）
}

// 就地刷新 📌 图标态（不重渲整份点正文）。图标恒 solid，只切颜色类 .sp-pinned（见 renderSchedule 注释）。
// 以 DOM 上按钮的 data-name 为准（兜底 charViewName）。
function refreshCharPinIcon() {
    const $btn = $in('#sp-body .sp-point-pin-char');
    const pinned = store.isPinnedChar(String($btn.attr('data-name') || charViewName || '').trim());
    $btn.attr('title', pinned ? '已固定·点击取消固定' : '固定 TA 到 TA▾ 抽屉');
    $btn.toggleClass('sp-pinned', pinned);
}

// ─── Open / close ─────────────────────────────────────────────────────────────

// 面板打开时先重置到点首页作为干净基线，再恢复同聊天上次的 lastMainView；切聊天时该值已复位为点。
// 清掉上次残留的子视图（历/线/面/间/棱/坐标）+ 内联编辑器，不 abort 生成、不动数据缓存。
// 无条件隐藏所有非点 wrap（不靠 mode 标志守卫）：CHAT_CHANGED 在面板隐藏时会把标志清成
// false 却不动 DOM，若这里再按标志判断就会漏隐藏 → 出现「点 + 坐标」同屏。故一律硬隐藏。
function resetPanelToScheduleHome() {
    outlineMode = linesMode = spaceMode = theaterMode = axisState.almanacMode = false;
    axisState._almanacEditor = null;
    resetLedgerRenderState();
    axisCalendarManager.close();
    paintScheduleHome($in, $inAll, { sub: currentView, wraps: true });
    $inAll('.sp-outline-btn').removeClass('sp-btn-active');
    syncRefreshBar('schedule');
}
function openSchedule() {
    runOpenSchedule({
        show: showPanel,
        resetHome: resetPanelToScheduleHome,
        lastMainView: () => _lastMainView,
        restoreLastView() {
            const $tab = $in('.sp-side-tab.sp-view-btn[data-view="' + _lastMainView + '"]');
            if (!$tab.length) return false;
            $tab.trigger('click');
            return true;
        },
        paintHome() {
            if (pointState.isGenerating) {
                setBody('<div class="sp-loading"><div class="sp-spinner"></div><p class="sp-loading-text">正在规划中…</p><button class="sp-abort-btn" id="sp-abort-generate"><i class="fa-solid fa-circle-stop"></i>中止生成</button></div>');
            } else if (pointState.cachedSchedule) {
                setBody(pointState.cachedSchedule);
            } else {
                showEmptyGenerate();
            }
        },
        afterOpen: checkMemoryMigrationNotice,
    });
}

function showEmptyGenerate() {
    setBody(`<div class="sp-empty">
        <i class="fa-regular fa-calendar"></i>
        <button class="sp-gen-btn" id="sp-gen-now">生成点</button>
    </div>`);
    $in('#sp-gen-now').on('click', triggerGenerate);
}

function setBody(html) { $in('#sp-body').html(html); }

// ─── Memory pre-check helpers ─────────────────────────────────────────────────
// Show a one-time toast when memory schema migration wiped this chat's summaries.
// Called from CHAT_CHANGED and openSchedule so users see it on the next chat
// switch OR the first time they open the panel post-upgrade.
function checkMemoryMigrationNotice() {
    const _ms = getSettings();
    if (_ms.useBaiBaiBook) return;      // 柏宝书不受内置记忆迁移影响
    const notice = memory.consumeMigrationNotice?.();
    if (!notice) return;
    const { l0Count, l1Count } = notice;
    const msg = `故事记忆库已升级：${l0Count} 段 L0 + ${l1Count} 章 L1 需重算（点此打开设置补齐）`;
    showToast(msg, () => {
        showPanel();
        if (!settingsOpen) toggleSettings();
        // Expand the memory section so the "补齐缺失" button is visible
        $in('#sp-mem-section').attr('open', 'open');
    });
}

// Called by the three generation triggers (schedule/outline/lines).
// Returns a Promise<boolean>: true if user wants to continue, false if canceled.
async function memoryPreCheckConfirm() {
    if (usesBaiBaiBook(getSettings())) {
        const coverage = baiBaiBookCoverage(globalThis.STBaiBaiBook);
        if (!coverage.ready) {
            return spConfirm({
                title  : '柏宝书未就绪',
                body   : '当前选的是柏宝书记忆源，但检测不到柏宝书 API。\n继续生成会没有历史记忆注入。',
                note   : '请把柏宝书更新到最新版（旧版没有读取接口），或临时关掉本插件的"使用柏宝书作为记忆源"。',
                confirmText: '仍然继续',
                cancelText : '取消',
            });
        }
        if (coverage.complete === false) {
            return spConfirm({
                title  : '柏宝书记忆未覆盖完整',
                body   : `柏宝书报告缺 ${coverage.missing} 楼摘要（missingAiFloors）。`,
                note   : '继续生成会使用当前柏宝书的历史（可能不完整）。你也可以先去柏宝书补齐。',
                confirmText: '继续生成',
                cancelText : '取消',
            });
        }
        return true;
    }
    const report = memory.getHealthReport();
    // No memory data yet is OK (fresh chat) — only warn when there ARE issues
    const hasPending = report.pending > 0 || report.permaFailed > 0 || report.strippedEmpty > 0 || report.paused;
    if (!hasPending) return true;
    const lines = [];
    if (report.paused) lines.push('• 记忆系统已暂停（连续失败或单楼超过 3 次）');
    if (report.pending > 0)    lines.push(`• 有 ${report.pending} 楼待摘要`);
    if (report.permaFailed > 0) lines.push(`• 有 ${report.permaFailed} 楼摘要永久失败（需手动补齐）`);
    if (report.strippedEmpty > 0) lines.push(`• 有 ${report.strippedEmpty} 组净化后正文几乎为空（请重查「保留标签」设置）`);
    if (report.busy)           lines.push('• 记忆系统正在后台生成');
    return spConfirm({
        title  : '记忆库不完整',
        body   : lines.join('\n'),
        note   : '继续生成会使用当前记忆库（可能不完整）。你也可以先去修复。',
        confirmText: '继续生成',
        cancelText : '取消',
    });
}

// Simple modal confirm — returns Promise<boolean>.
// Auto-resolves(false) on CHAT_CHANGED or when the panel closes, so callers
// awaiting the promise won't hang.
function spConfirm({ title, body, note, confirmText = '确定', cancelText = '取消' }) {
    return new Promise(resolve => {
        _activeSpConfirmCancel?.();
        $dialog('#sp-confirm').remove();
        let done = false;
        const finish = (v) => {
            if (done) return;
            done = true;
            if (_activeSpConfirmCancel === cancel) _activeSpConfirmCancel = null;
            $ov.remove();
            eventSource.removeListener?.(event_types.CHAT_CHANGED, onExternalClose);
            resolve(v);
        };
        const cancel = () => finish(false);
        const onExternalClose = () => finish(false);
        const $ov = $(`<div id="sp-confirm" class="sp-confirm-overlay">
            <div class="sp-confirm-sheet">
                <div class="sp-confirm-head">${escapeHtml(title)}</div>
                <div class="sp-confirm-body">${escapeHtml(body).replace(/\n/g, '<br>')}</div>
                ${note ? `<div class="sp-confirm-note">${escapeHtml(note)}</div>` : ''}
                <div class="sp-confirm-actions">
                    <button class="sp-confirm-cancel">${escapeHtml(cancelText)}</button>
                    <button class="sp-confirm-ok">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        </div>`);
        $ov.find('.sp-confirm-ok').on('click', () => finish(true));
        $ov.find('.sp-confirm-cancel').on('click', () => finish(false));
        $ov.on('click', function (e) { if (e.target === this) finish(false); });
        // 独立弹窗宿主不随 #sp-modal-root 隐藏；空宿主 pointer-events:none，实际遮罩自行开启交互。
        $ov.addClass(`sp-root sp-${currentTheme}`);
        _spDialogShadow.appendChild($ov[0]);
        _activeSpConfirmCancel = cancel;
        eventSource.on(event_types.CHAT_CHANGED, onExternalClose);
    });
}

// ─── 跨设备存储冲突弹窗（迁移检测到云端/本机各一份不同数据）──────────────────────
// 三态：保留云端(丢 localStorage 副本) / 保留本机(localStorage 覆盖云端 + 重载) /
// 点窗外=暂不决定(什么都不动，下次进本 chat 再问)。故意不设「默认破坏动作」——
// 数据两难时，不选就谁都不动。
const KIND_LABEL = { schedule: '点', outline: '面', lines: '线', 'creative-chat': '面·讨论', 'space-chat': '间', almanac: '轴' };

function fmtStoreSide(sum) {
    const labels = (sum?.kinds || []).map(k => KIND_LABEL[k] || k).join('、') || '（无）';
    const when   = sum?.latestTs ? new Date(sum.latestTs).toLocaleString() : '时间未知';
    return `含 ${labels}　·　最近改动 ${when}`;
}

function showStoreConflictDialog(mig) {
    if (!mig || mig.status !== 'conflict') return;
    // 冲突可能在主面板关闭时由 CHAT_CHANGED 触发，必须使用始终可用的独立弹窗宿主。
    _activeStoreConflictFinish?.('defer');
    $dialog('#sp-store-conflict').remove();
    let done = false;
    const finish = (choice) => {
        if (done) return;
        done = true;
        if (_activeStoreConflictFinish === finish) _activeStoreConflictFinish = null;
        $ov.remove();
        eventSource.removeListener?.(event_types.CHAT_CHANGED, onExternalClose);
        if (choice === 'cloud')      store.discardLegacy(mig.legacy);
        else if (choice === 'local') { store.applyLegacyOverCloud(mig.legacy); reloadAfterConflict(); }
        // choice === 'defer' → 什么都不动，下次进本 chat 再弹
    };
    // 换 chat 视为「暂不决定」——绝不趁机替用户改数据
    const onExternalClose = () => finish('defer');
    const $ov = $(`<div id="sp-store-conflict" class="sp-confirm-overlay">
        <div class="sp-confirm-sheet">
            <div class="sp-confirm-head">构画数据冲突</div>
            <div class="sp-confirm-body">这个聊天在别的设备/浏览器也编辑过构画（点线面间），云端和本机各有一份、内容不同。保留哪一份？<br><br>
                <b>云端（跟聊天走）</b>：${escapeHtml(fmtStoreSide(mig.cloud))}<br>
                <b>本机（这台浏览器）</b>：${escapeHtml(fmtStoreSide(mig.local))}</div>
            <div class="sp-confirm-note">只影响构画自己的点线面间，不动记忆 / 棱 / 其他插件。点窗外＝暂不决定，下次再问。</div>
            <div class="sp-confirm-actions">
                <button class="sp-confirm-cancel" data-choice="local">保留本机</button>
                <button class="sp-confirm-ok" data-choice="cloud">保留云端</button>
            </div>
        </div>
    </div>`);
    $ov.find('[data-choice="cloud"]').on('click', () => finish('cloud'));
    $ov.find('[data-choice="local"]').on('click', () => finish('local'));
    $ov.on('click', function (e) { if (e.target === this) finish('defer'); });
    $ov.addClass(`sp-root sp-${currentTheme}`);
    _spDialogShadow.appendChild($ov[0]);
    _activeStoreConflictFinish = finish;
    eventSource.on(event_types.CHAT_CHANGED, onExternalClose);
}

// 冲突「保留本机」善后：localStorage 已覆盖进 metadata 并清空，重跑一遍 CHAT_CHANGED 逻辑
// （重置视图 + 从新 metadata 重载全部缓存 + 重渲染可见视图 + 补内联块）。此刻再扫 legacy 为空 → none，不会自触发。
function reloadAfterConflict() {
    _stListeners.chat?.();
}

// Dynamic loading text: reflect whether memory is currently being built
function loadingHtml(baseText, abortId) {
    // 柏宝书没有内置后台队列 — never show "补全记忆" text.
    const _ms = getSettings();
    const busy = !_ms.useBaiBaiBook && memory.isMemoryBusy();
    const text = busy
        ? `正在补全记忆并${baseText}…`
        : `${baseText}中…`;
    return `<div class="sp-loading">
        <div class="sp-spinner"></div>
        <p class="sp-loading-text">${escapeHtml(text)}</p>
        <button class="sp-abort-btn" id="${abortId}"><i class="fa-solid fa-circle-stop"></i>中止生成</button>
    </div>`;
}

// ─── Generation ───────────────────────────────────────────────────────────────

async function triggerGenerate() {
    return pointController.triggerGenerate();
}

// 前置阶段（世界书组装等）不可打断，若只 abort 不即时复位界面，用户点"中止"会觉得没反应。
// 被中止的旧管线随后走各自 run* 的身份守卫（controller !== myCtrl）静默丢弃，不覆盖界面。
function abortScheduleGen() {
    pointController.abort('manual-abort');
}
function abortLinesGen() {
    if (!linesRuntime.busy) return;
    linesFeature.abortGeneration({ reason: 'manual-abort' });
    if (linesMode && linesFeature.sheet === 'events') linesFeature.refreshPanel();
}
function abortAlmanacGen() {
    if (!axisState.isGeneratingAlmanac) return;
    axisGenerationController.reset('manual-abort');
    if (axisState.almanacMode) renderAlmanacPanel();
}

async function generate(ctx, userName, charName, perspective = 'user', signal = null, pinned = null, travelContext = null, adultMode = 'off', diagnosticSink = null) {
    const cfg = loadCfg();
    if (!cfg.url || !cfg.key) {
        if (!settingsOpen) toggleSettings();
        throw makeDiagnosticError('config-missing');
    }
    const prompt = appendTravelPromptContext(buildPrompt(userName, charName, perspective, pinned, loadCalDesc(), { mode: adultMode, tickets: pointTicketPlan(adultMode, 14) }), travelContext);
    const apiOpts = { ...(travelContext?.feedback === 'time-travel' ? { fullMemory: true, ...travelContext } : (travelContext || {})), promptMode: 'creative', diagnosticModule: 'point', diagnosticSink };
    apiOpts.pointView = perspective;
    return callCustomApi(ctx, prompt, cfg, userName, charName, signal, 3, apiOpts);
}


// ─── World-info entry filter (per chat) ───────────────────────────────────────
// New model: extension_settings[PLUGIN_ID].wiSelectionByChat[chatKey]
// = { version: 1, decisions: { ["worldName::uid"]: boolean } }.
// Every key is initialized exactly once from the host switch, then belongs to this chat.
// Legacy wiFilter / wiFilterByChat remain read-only migration sources.
//
// charKey 用**角色卡文件名 avatar**（如 `坏狗.png`）——它跟着卡文件走、稳定不变。
// 早期误用 ctx.characterId（= this_chid，characters 数组的**下标索引**）：一旦增删/重排
// 角色，索引就漂移，同一张卡下次读到的是别人的（或空）设置——表现为每次进聊天筛选都被重置。
// 2.0.0 换稳定键，旧的数字键数据不迁移（已知会重置一次，发版公告告知用户重选）。
function charStableKey(ctx) {
    const c = ctx?.characters?.[ctx?.characterId];
    return c?.avatar || null;   // 无角色（群聊/未选卡）→ null，各 getter 守卫返回默认
}

function getLegacyWiFilter() {
    const s = getSettings();
    if (!s.wiFilter) s.wiFilter = {};
    return s.wiFilter;
}

function chatStableKey(ctx) {
    const hash = String(ctx?.chatMetadata?.chat_id_hash || '').trim();
    if (hash) return `hash:${hash}`;
    const chatId = String(ctx?.chatId || '').trim();
    const avatar = String(charStableKey(ctx) || '').trim();
    return chatId && avatar ? `legacy:${avatar}:${chatId}` : null;
}

function getLegacyWiFilterByChat() {
    const s = getSettings();
    if (!s.wiFilterByChat || typeof s.wiFilterByChat !== 'object' || Array.isArray(s.wiFilterByChat)) s.wiFilterByChat = {};
    return s.wiFilterByChat;
}

function getWiSelectionByChat() {
    const s = getSettings();
    if (!s.wiSelectionByChat || typeof s.wiSelectionByChat !== 'object' || Array.isArray(s.wiSelectionByChat)) s.wiSelectionByChat = {};
    return s.wiSelectionByChat;
}

function getLegacyDisabledKeys(ctx) {
    const chatKey = chatStableKey(ctx);
    if (chatKey) {
        const byChat = getLegacyWiFilterByChat();
        // An explicitly stored empty chat bucket means "all formerly visible entries allowed".
        if (Object.prototype.hasOwnProperty.call(byChat, chatKey)) {
            return Array.isArray(byChat[chatKey]) ? byChat[chatKey] : [];
        }
    }
    const charKey = charStableKey(ctx);
    const byCharacter = getLegacyWiFilter();
    return charKey && Array.isArray(byCharacter[charKey]) ? byCharacter[charKey] : [];
}

function ensureCurrentWiSelection(ctx, entries) {
    const chatKey = chatStableKey(ctx);
    const stored = chatKey ? getWiSelectionByChat()[chatKey] : null;
    const initialized = initializeWorldInfoSelection({
        stored,
        candidates: entries,
        legacyDisabled: getLegacyDisabledKeys(ctx),
    });
    if (chatKey && initialized.changed) {
        getWiSelectionByChat()[chatKey] = initialized.bucket;
        saveSettingsDebounced();
    }
    return initialized.bucket;
}

function setCurrentWiSelection(ctx, bucket) {
    const chatKey = chatStableKey(ctx);
    const normalized = normalizeWorldInfoSelectionBucket(bucket);
    if (!chatKey || !normalized) return;
    getWiSelectionByChat()[chatKey] = normalized;
    saveSettingsDebounced();
}

function saveCurrentWiSelection() {
    const ctx = getContext();
    const chatKey = chatStableKey(ctx);
    if (!chatKey) return;
    const visible = [];
    $inAll('#sp-wi-list .sp-wi-cb').each(function () { visible.push({ key: $(this).data('key'), checked: this.checked }); });
    const current = ensureCurrentWiSelection(ctx, [..._wiEntryCache.values()]);
    const merged = mergeWorldInfoSelection(current, visible);
    if (merged.changed) setCurrentWiSelection(ctx, merged.bucket);
}

// ─── World-book global exclusion (B方案) ─────────────────────────────────────
// 全局、按书名（非按条目、也非按角色卡）。被排除的书构画**一律不读**——优先级高于「角色卡
// 关联 / 全局启用 / persona 链接」任何一条收录途径（这类书通常是给主楼 AI 读的，不该混进
// 点/线/轴/暗历的判定）。剔除发生在 getCharBookEntries 末尾这一咽喉处，故连设置里「按角色卡
// 挑选」列表也不再显示被排除的书。存 extension_settings[PLUGIN_ID].wiExcludeBooks = [书名,…]
// （书名即 ctx.getWorldInfoNames() 的项）。照 wiFilter 的懒创建：无 DEFAULT_SETTINGS 项，getter 兜空。
function getWiExcludeSet() {
    const s = getSettings();
    const arr = Array.isArray(s.wiExcludeBooks) ? s.wiExcludeBooks : [];
    return new Set(arr.filter(x => typeof x === 'string' && x));
}
function hasWiExcluded(bookName, excluded = getWiExcludeSet()) {
    const name = String(bookName || '').trim();
    return !!name && [...excluded].some(saved => equalsIgnoreCaseAndAccents(saved, name));
}

function setWiExcluded(bookName, excluded) {
    const name = String(bookName || '').trim();
    if (!name) return;
    const s = getSettings();
    const set = new Set(Array.isArray(s.wiExcludeBooks) ? s.wiExcludeBooks : []);
    for (const saved of set) if (equalsIgnoreCaseAndAccents(saved, name)) set.delete(saved);
    if (excluded) set.add(name);
    s.wiExcludeBooks = [...set];
    saveSettingsDebounced();
}

// 当前聊天共享的历/点日期锚（{month, day}），可含人工校准；pending/unresolved 不是有效锚。
// 完整故事时间戳在恢复自动后可重新接管日期来源。
function getDateAnchor(charKey) {
    if (!charKey) return null;
    const local = chatAnchorRepository.get();
    if (local && (local.status === 'unresolved' || local.status === 'pending')) return null;
    if (local) {
        const cal = loadCalDesc();
        if (local.calibration) {
            if (!local.calibration || !Number.isInteger(local.calibration.weekday)) return null;
            const current = latestStoryClockPure(getContext(), ALM_CHAT_SCAN_LIMIT);
            // 半残 SDC 只能作为人工校准的日期相位，不能提前停用校准；
            // 只有当前 AI 楼的 start/end 两侧都完整且无重复歧义时才允许接管。
            if (completeStoryClockPure(current)) {
                const calibrationFloor = local.calibration?.floor;
                if (!Number.isInteger(calibrationFloor) || current.floor !== calibrationFloor) return null;
            }
        }
        return local.month >= 1 && local.month <= calMonthCount(cal) && local.day >= 1 && local.day <= calMonthDays(cal, local.month) ? { month: local.month, day: local.day, ...(local.year != null ? { year: local.year } : {}), ...(local.eraLabel ? { eraLabel: local.eraLabel } : {}) } : null;
    }
    return null;
}

function getStoryCalibration(charKey) {
    if (!charKey) return null;
    const local = chatAnchorRepository.get();
    if (!local?.calibration) return null;
    const cal = loadCalDesc();
    if (local.month < 1 || local.month > calMonthCount(cal) || local.day < 1 || local.day > calMonthDays(cal, local.month)) return null;
    if (!Number.isInteger(local.calibration.weekday) || local.calibration.weekday < 0 || local.calibration.weekday > 6) return null;
    return { month: local.month, day: local.day, refMonth: local.calibration.refMonth ?? local.month, refDay: local.calibration.refDay ?? local.day, weekday: local.calibration.weekday, floor: local.calibration.floor, sourceFloor: local.calibration.sourceFloor, swipe: local.calibration.swipe };
}

function setDateAnchor(charKey, month, day, source = 'explicit', options = {}) {
    return axisDateActions.saveAnchor(charKey, month, day, source, options);
}

// ─── Per-character narrative scale ──────────────────────────────────────────
// Controls the granularity of storyline events. 'auto' means the LLM decides
// from card context; explicit values override that.
// Stored: extension_settings[PLUGIN_ID].scale = { [charStableKey/avatar]: 'auto'|'macro'|'meso'|'micro' }
const SCALE_VALUES = ['auto', 'macro', 'meso', 'micro'];
const SCALE_LABELS = {
    auto : '自动（由 AI 依据剧情判断）',
    macro: '宏观（阴谋 / 势力 / 天下大势）',
    meso : '中观（家族 / 组织 / 职场 / 学派）',
    micro: '微观（人际 / 情感 / 日常）',
};

function getScaleMap() {
    const s = getSettings();
    if (!s.scale || typeof s.scale !== 'object') s.scale = {};
    return s.scale;
}

// charKey = charStableKey(ctx)（角色卡 avatar 文件名），与 wiFilter 同源，理由见 charStableKey 注释。
function getScale(charKey) {
    if (charKey == null) return 'auto';
    const v = getScaleMap()[charKey];
    return SCALE_VALUES.includes(v) ? v : 'auto';
}

function setScale(charKey, value) {
    if (charKey == null) return;
    getScaleMap()[charKey] = SCALE_VALUES.includes(value) ? value : 'auto';
    saveSettingsDebounced();
}

function getAdultModeMap() {
    const s = getSettings();
    if (!s.adultMode || typeof s.adultMode !== 'object') s.adultMode = {};
    return s.adultMode;
}

function getAdultMode(charKey) {
    return adultModeForCharacter(getSettings(), charKey);
}

function setAdultMode(charKey, value) {
    if (charKey == null) return;
    getAdultModeMap()[charKey] = ADULT_MODES.includes(value) ? value : 'off';
    saveSettingsDebounced();
}

// Resolve the list of world-book names to load for the current character.
// Prefers TavernHelper's getCharLorebooks (works uniformly across vanilla ST
// and Luker), falls back to reading character.data directly.
function getLinkedWorldNames(ctx) {
    let extraBooks;
    try {
        const fileName = getCharaFilename(ctx.characterId);
        extraBooks = worldInfoCore.world_info?.charLore?.find(item => item?.name === fileName)?.extraBooks;
    } catch { /* 没有文件名时退回卡数据 */ }
    return collectLinkedWorldNames({
        tavernHelper: globalThis?.TavernHelper,
        character: ctx.characters?.[ctx.characterId] ?? {},
        extraBooks,
    });
}

// Global world-info names enabled in ST's right-panel WI selector.
// Three-layer resolution — first hit wins:
//   1. TavernHelper.getLorebookSettings().selected_global_lorebooks (universal)
//   2. Luker-only: ctx.chatWorldInfo.globalSelection
//   3. Vanilla ST: globalThis.world_info.globalSelect
// Empty on any failure — plugin still works with just character books.
function getGlobalWorldNames(ctx) {
    return collectGlobalWorldNames({
        tavernHelper: globalThis?.TavernHelper,
        lukerSelection: ctx?.chatWorldInfo?.globalSelection,
        selectedWorldInfo: worldInfoCore.selected_world_info,
        vanillaGlobalSelect: globalThis?.world_info?.globalSelect,
    });
}

function getChatWorldNames(ctx) {
    return collectChatWorldNames(ctx?.chatMetadata?.world_info);
}

// Returns live world-info entries for the current character. Uses ctx.loadWorldInfo
// (the live editable copy), NOT ctx.characters[].data.character_book (stale snapshot).
// Fallback to character_book if no linked world book exists.
// Each item: { key, uid, label, preview, content, source, embedded, scope, hostEnabled }
//   scope = 'char'/'chat'/'persona'/'global' → 角色卡、当前聊天、用户 persona 或全局世界书来源
async function getCharBookEntries(ctx) {
    const items = [];
    const seen = new Set();

    const worldNames = getLinkedWorldNames(ctx);
    for (const name of worldNames) {
        try {
            const data = await ctx.loadWorldInfo(name);
            appendWorldInfoBook(items, seen, data?.entries, name, { scope: 'char' });
        } catch { /* ignore individual load failure */ }
    }

    if (items.length === 0) {
        const char = ctx.characters?.[ctx.characterId] ?? {};
        const charBook = char.data?.character_book;
        if (charBook?.entries?.length) {
            appendWorldInfoBook(items, seen, charBook.entries, charBook.name || '角色内置世界书', { scope: 'char', embedded: true });
        }
    }

    for (const name of getChatWorldNames(ctx)) {
        try {
            const data = await ctx.loadWorldInfo(name);
            appendWorldInfoBook(items, seen, data?.entries, name, { scope: 'chat' });
        } catch { /* ignore chat lore load failure */ }
    }

    const globalNames = getGlobalWorldNames(ctx);
    for (const name of globalNames) {
        if (worldNames.includes(name)) continue;
        try {
            const data = await ctx.loadWorldInfo(name);
            appendWorldInfoBook(items, seen, data?.entries, name, { scope: 'global' });
        } catch { /* ignore individual load failure */ }
    }

    const personaBook = String(ctx.powerUserSettings?.persona_description_lorebook || '').trim();
    if (personaBook && !worldNames.includes(personaBook) && !globalNames.includes(personaBook)) {
        try {
            const data = await ctx.loadWorldInfo(personaBook);
            appendWorldInfoBook(items, seen, data?.entries, personaBook, { scope: 'persona' });
        } catch { /* ignore persona book load failure */ }
    }

    const excluded = getWiExcludeSet();
    return excluded.size ? items.filter(e => !hasWiExcluded(e.source, excluded)) : items;
}

// Recent chat context — fills the gap between memory (delayed L0/L1 summaries)
// and "what the user just typed". Both 间 and 面 discussions previously saw
// only outline+wi+memText, so the last few floors of the main chat were
// invisible to the assistant — feels like it "ignores context".
// Returns a formatted block or '' when the chat is empty.
async function buildRecentChatContext(ctx, floorCount = 6, perMessageChars = 2500) {
    const chat = ctx?.chat;
    if (!Array.isArray(chat) || !chat.length) return '';
    const charName = ctx.name2 || '角色';
    const s = getSettings();
    const stripOpts = { keepTags: s.keepTags, extraTags: s.extraTags };
    // Walk from the end backwards, collect up to N visible AI entries.
    const rows = [];
    for (let i = chat.length - 1; i >= 0 && rows.length < floorCount; i--) {
        const m = chat[i];
        if (!m || m.is_user || m.is_system) continue;   // only visible AI narrative
        const raw = String(m.mes || '');
        if (!raw.trim()) continue;
        const cleaned = memory.stripTags(raw, stripOpts).trim();
        if (!cleaned) continue;
        const speaker = m.name || charName;
        const capped = cleaned.length > perMessageChars
            ? cleaned.slice(0, perMessageChars) + '…'
            : cleaned;
        rows.unshift(`【${speaker}】${capped}`);
    }
    if (!rows.length) return '';
    return `【最近对话】以下是主聊天中最近几层对话原文，供理解当前剧情走向。\n\n${rows.join('\n\n')}`;
}

let lastWorldInfoFailureNoticeKey = '';

async function countWorldInfoTokens(text) {
    return countWorldInfoTokenValue(text, {
        getTokenCountAsync: value => getContext()?.getTokenCountAsync?.call(getContext(), value),
    });
}

function notifyWorldInfoActivationFailure(ctx) {
    const key = worldInfoFailureNoticeKey(ctx);
    if (lastWorldInfoFailureNoticeKey === key) return;
    lastWorldInfoFailureNoticeKey = key;
    try { showToast('世界书激活失败，本次未注入世界书', null, true); } catch { /* toast 未就绪时忽略 */ }
}

async function buildWorldInfoContext(ctx, { scopes = null } = {}) {
    const allEntries = await getCharBookEntries(ctx);
    const allow = Array.isArray(scopes) && scopes.length ? new Set(scopes) : null;
    const entries = allow ? allEntries.filter(entry => allow.has(entry.scope)) : allEntries;
    const selection = ensureCurrentWiSelection(ctx, entries);
    const coreChat = Array.isArray(ctx?.chat) ? ctx.chat.filter(message => {
        if (!message || message.is_system) return false;
        return String(message.mes ?? message.content ?? '').trim().length > 0;
    }) : [];
    const activation = await resolveWorldInfoActivation(ctx, coreChat, {
        getMaxPromptTokens: scriptCore.getMaxPromptTokens,
        includeNames: worldInfoCore.world_info_include_names !== false,
        checkWorldInfo: worldInfoCore.checkWorldInfo,
        logWarn: (message, error) => console.warn(message, safeDiagnosticLog('world-info', 'activation', error)),
    });
    if (activation.failed) {
        notifyWorldInfoActivationFailure(ctx);
        console.warn('[构画] 世界书激活失败诊断', {
            ...safeDiagnosticLog('world-info', 'activation', null),
            candidateCount: entries.length,
            lukerAvailable: typeof ctx?.simulateWorldInfoActivation === 'function',
            nativeAvailable: typeof worldInfoCore.checkWorldInfo === 'function',
        });
        return '';
    }
    const candidates = filterActivatedWorldInfo(entries, { selection, keys: activation.keys });
    if (!candidates.length) return '';
    const packed = await packWorldInfoContents(candidates, { countTokens: countWorldInfoTokens });
    if (packed.skipped) {
        console.warn('[构画] 世界书预算跳过条目诊断', {
            candidateCount: candidates.length,
            activatedCount: activation.keys.size,
            finalEntryCount: packed.kept.length,
            estimatedTokens: packed.finalCount.tokens,
            exactCount: packed.exactCount,
            skippedCount: packed.skipped,
            budget: WORLD_INFO_TOKEN_BUDGET,
        });
    }
    return packed.text;
}

async function _getMemTextRaw(opts = {}) {
    if (usesBaiBaiBook(getSettings())) {
        const api = globalThis.STBaiBaiBook;
        if (!api || typeof api.getInjectedHistory !== 'function') {
            if (!getMemText._bbbWarned) {
                getMemText._bbbWarned = true;
                console.info('[7dayscal] 使用柏宝书记忆但 API 未就绪，本次生成无历史注入');
            }
            return '';
        }
        try {
            // opts.full：通读全故事的分析任务（如「历」编排全年纪念日）要完整时间线——
            // 用 getHistory（柏宝书「全部压缩历史」，含滑动窗口楼层）；而非 getInjectedHistory
            // （后者是按当前剧情向量召回、跳过滑动窗口的注入版，会漏掉与"此刻"无关的旧里程碑）。
            // 点/线/面贴当前剧情，保持 getInjectedHistory（聚焦近景、省额度）。
            return readBaiBaiBookHistory(api, { full: !!opts.full });
        } catch (err) {
            console.warn('[7dayscal] 柏宝书取历史出错', safeDiagnosticLog('memory', 'request', err, { background: true }));
            return '';
        }
    }
    return memory.getMemoryContext();
}

// 记忆块 tk 预算封顶：把记忆源产出的文本压到预算内再交给生成。
// 柏宝书注入版靠向量召回自封顶，但内置 L1 早期章节全塞时，长故事会飙到 10w+ tk。
//   full=true（历·排全年日期）→ 保覆盖：跨全程等距抽块，别掐中段（会漏中段生日/纪念日）。
//   full=false（点/线/面/间）→ 近景优先：留最近的块 + 一小段最早梗概，中段省略。
// 不超预算 → 原样返回、零改动。按空行块边界切，不切碎句子。
async function getMemText(opts = {}) {
    const raw = await _getMemTextRaw(opts);
    try {
        return await capMemTextAsync(raw, !!opts.full, {
            countTokens: async text => getContext().getTokenCountAsync(text),
        });
    } catch (err) { console.warn('[7dayscal] 记忆预算封顶出错，回退原文', safeDiagnosticLog('memory', 'request', err, { background: true })); return raw; }
}

// historyLimit：喂给这次调用的「最近可见 AI 楼」条数上限。默认 3。
// 传 0 = 完全不喂近景，只靠 system 块（人设/卡描述/世界书/记忆库）。
async function buildMessages(ctx, prompt, userName, charName, historyLimit = 3, opts = {}) {
    const char = ctx.characters?.[ctx.characterId] ?? {};
    const wiContext = await buildWorldInfoContext(ctx);
    const { personaDesc, authorNote } = readCardExtras(ctx);
    const rawMemText = await getMemText({ full: opts.fullMemory, query: prompt });
    const memText = sanitizeGenerationContextText(rawMemText, { reroll: opts.reroll });
    const memBlock = memoryLibraryBlock(memText, { userName, charName, pointView: opts.pointView });
    const almanacBlock = almanacBlockForOptions(opts, getAlmanacInjectText);
    const calDescBlock = calendarLibraryBlock(getCalDescInjectText());
    const sys = observerSystemPrompt({
        userName,
        charName,
        personaDesc,
        character: char,
        authorNote,
        extraBlocks: [wiContext, memBlock, almanacBlock, calDescBlock],
    });
    const allMsgs = ctx.chat ?? [];
    let history = [];
    if (historyLimit > 0) {
        const s = getSettings();
        const stripOpts = { keepTags: s.keepTags, extraTags: s.extraTags };
        history = selectVisibleChatHistory(allMsgs, historyLimit, {
            excludedAssistant: opts.excludedAssistant,
            mapMessage: m => mapVisibleHistoryMessage(m, {
                substituteParams,
                sanitize: value => sanitizeGenerationContextText(value ?? '', { reroll: opts.reroll, stripTags: text => memory.stripTags(text, stripOpts) }),
            }),
        });
    }
    if (Array.isArray(opts.ledgerSourceFloors)) history = ledgerSourceHistory(opts.ledgerSourceFloors);
    return assembleGenerationMessages({ system: sys, history, prompt });
}

// ─── Inject ───────────────────────────────────────────────────────────────────

function makeInjectBtn(text) {
    const id = ++_injectIdSeq;
    _injectTexts[id] = text;
    return `<button class="sp-inject-btn" data-iid="${id}" title="注入到输入框"><i class="fa-solid fa-arrow-right-to-bracket"></i></button>`;
}

function injectToST(text) {
    const $ta = $('#send_textarea');
    if (!$ta.length) { showToast('找不到输入框', null, true); return false; }
    // Append instead of overwrite — don't nuke whatever the user was typing.
    // Empty box → just set; non-empty → prepend a blank line separator so the
    // injection stays visually distinct from prior text.
    const prev = String($ta.val() || '');
    const combined = prev.trim() ? `${prev.replace(/\s+$/, '')}\n\n${text}` : text;
    const el = $ta.val(combined)[0];
    // SillyTavern listens with native addEventListener('input') for its autosize path.
    el?.dispatchEvent(new Event('input', { bubbles: true }));
    // Move caret to end + scroll into view so the newly injected text is
    // visible even if the box already had content.
    if (el && typeof el.setSelectionRange === 'function') {
        el.setSelectionRange(combined.length, combined.length);
    }
    el?.scrollTo?.({ top: el.scrollHeight });
    showToast(prev.trim() ? '已追加到输入框' : '已注入到输入框');
    return true;
}

// ─── Outline chat ─────────────────────────────────────────────────────────────

// Turn AI reply text into safe rendered HTML via ST's own messageFormatting
// (markdown + sanitizer + quote-wrap), so 间/面/棱 match the main chat area.
// Falls back to escaped text with <br> if the API isn't available. Never used
// for user messages — they typed plain text, don't reinterpret it as markdown.
//
// Regex isolation (约定：构画渲染绝不被用户正则改写)：构画的气泡没有真实楼层，
// messageId 只能传 null → ST 把它当成最远深度的楼，于是「显示域 + 按深度过滤」的
// 用户正则会命中并清空气泡（曾有用户装「不发送远楼信息」正则后 间/面/棱 全白）。
// 做法：调用期间临时把 'regex' 塞进 disabledExtensions，getRegexedString 开头即
// 短路返回原文（engine.js），markdown / 引号包裹 / 净化等其余步骤照跑，渲染与主
// 聊天一致。调用是同步的、随即在 finally 还原，不落盘、不触发保存、对别处无副作用。
function renderAiMessageHtml(text) {
    const ctx = getContext();
    if (typeof ctx?.messageFormatting === 'function') {
        const de = extension_settings?.disabledExtensions;
        const guardRegex = Array.isArray(de) && !de.includes('regex');
        if (guardRegex) de.push('regex');
        try {
            return ctx.messageFormatting(String(text ?? ''), '', false, false, null, {}, false);
        } catch (err) {
            console.warn('[7dayscal] messageFormatting failed, falling back to plain', safeDiagnosticLog('generation', 'parse', err));
        } finally {
            if (guardRegex) {
                const i = de.indexOf('regex');
                if (i !== -1) de.splice(i, 1);
            }
        }
    }
    return escapeHtml(String(text ?? '')).replace(/\n/g, '<br>');
}


// idx0 从 0 起。就地替换 calendar_widget 内第 idx0 个 Event: 行（保留其 Day/Future 归属与缩进），找不到返回 null。
function replaceNthEventLine(raw, idx0, newEventLine) {
    return replacePointEventBlock(raw, idx0, newEventLine);
}

function readCacheRaw(desc) {
    const saved = readStore(desc);
    return saved?.raw || '';
}

// ─── Apply widget to almanac (历) ─────────────────────────────────────────
// 历是一张扁平日期表（非 raw 文本）。一张卡一个日期，按 idx 取该条单独注入。
// **纯追加**：只把这一条去重后加进去，绝不动任何已有项——尤其不能碰「生成节日」出的
// 未锁 AI 节日（那是 source='ai' pin=false，用 mergeAlmanac 会被当未锁 AI 项清掉 → 原版节日全没）。
// 间来的日期默认 pin，日后「生成节日」重算也保得住（与「间加线默认锁定」一致）。
// 历法 widget 动作统一由 axisWidgetActions 提供。

const axisWidgetActions = createAxisWidgetActions({
    parseAlmanac: parseAlmanacWidget,
    parseEra: parseEraWidget,
    key: getAlmanacKey,
    calKey: getCalDescKey,
    loadItems: loadAlmanac,
    dedupKey: almDedupKey,
    saveItems: saveAlmanacItems,
    render: () => { if (axisState.almanacMode) renderAlmanacPanel(); },
    sync: syncLatestAlmanacBlock,
    done: ($btn, label) => $btn.prop('disabled', true).html(`<i class="fa-solid fa-check"></i> ${label}`),
    error: message => { showToast(message, null, true); return { ok: false }; },
    notify: message => showToast(message),
    commitCalendar: commitCalendarDesc,
    notifyEra: cal => { if (getSettings().notifyMode !== 'off') showToast(`历法已更新：${cal.era ? cal.era + '·' : ''}${calendarSummary(cal)}`); },
});

async function composeCreativeChatMessages({ target, userMsg, historySnapshot }) {
    const ctx      = getContext();
    const userName = ctx.name1 || '用户';
    const charName = ctx.name2 || '角色';
    const outlineCtx = outlineFeature.repository.readRaw(target);
    const { personaDesc, authorNote } = readCardExtras(ctx);
    const almanacText = getAlmanacInjectText();
    const calDescText = getCalDescInjectText();
    const wiContext = await buildWorldInfoContext(ctx);
    const recentCtx = await buildRecentChatContext(ctx);
    const sys = buildCreativeChatSystemPrompt({
        userName,
        charName,
        personaDesc,
        authorNote,
        outlineRaw: outlineCtx,
        wiContext,
        recentCtx,
        almanacText,
        calDescText,
    });
    // 历史快照已包含刚写入的 user turn；末尾再追加一次是当前生产合同，禁止在本轮去重。
    return [{ role: 'system', content: sys }, ...historySnapshot, { role: 'user', content: userMsg }];
}

// 写剪贴板：优先 navigator.clipboard（需安全上下文），失败/不可用则退回 execCommand。
// 酒馆常跑在非 https 的 WebView 里，clipboard API 可能缺失或抛权限错——execCommand 兜底保证手机也能复制。
async function copyPlainText(text) {
    const s = String(text ?? '');
    if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(s); return true; } catch {}
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = s;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, s.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch { return false; }
}

// ─── 棱（小剧场）render ─────────────────────────────────────────────────────────

function setTheaterBody(html) { $in('#sp-theater-body').html(html); }

// 预览折叠：内容超过阈值才折叠并露出「展开全文」按钮，短内容不折。
function setOutlineBody(html) {
    const $beats = $in('#sp-outline-beats').html(html);
    $in('#sp-outline-node-count').text(`${$beats.children('.sp-beat').length} 个节点`);
}

// ─── Storylines (事件线) ─────────────────────────────────────────────────────

function getLinesCacheKey(view, charName) {
    return keyDesc('lines', 'user', '');
}

// ── 线·swipe 临时层（localStorage）─────────────────────────────────────────
// 楼层没「固定」（用户还没发下一条消息）前，每份 swipe 的线临时存这里：
// key = sp-lines-swipe-<chatId>-<mesId>；value = { baseline:<B0>, swipes:{ "<swipeId>": <merged> }, view, charName }。
// baseline = 本楼生成前的线（pre-commit B0），保证每份 swipe 都从 B0 重推、不互相叠加污染。
// swipe 存储与恢复由 linesFeature 持有；此处只适配宿主 chat/store/UI 能力。
// 滑回已生成的 swipe：从临时层取回该 swipe 的线写回 store 当前活跃集 + 刷 UI，不请求 API。
// 命中返回 true；无记录返回 false（交给调用方决定是否重算）。
// 楼主文本签名（长度 + 首尾 32 字，避免全量哈希）：给「同 mesId 主文本变了 → 原楼重生成 = 重roll」检出用。
// 不依赖 ST 的 CMR type / GENERATION_STARTED genType——实测流式重roll下 type=undefined、latch 也不触发，三路检测全漏。
// 有时间戳则只签 <!-- SDC-start --> 与 <!-- SDC-end --> 之间的正文：正文出完后第三方插件在楼尾追加的变量块落在戳外、
// 不再扰动签名 → 不再把「追加变量块」误判成重 roll、省一次 API。无戳（时钟关/AI 漏戳）回退整条 mes，零回归。
function _floorSig(mid) {
    try {
        const t = String(getContext().chat?.[Number(mid)]?.mes ?? '');
        const body = storyClockNarrativeBody(t);
        return body.length + '|' + body.slice(0, 32) + '|' + body.slice(-32);
    } catch { return ''; }
}
// 上一 AI 楼的定稿快照线（raw）：从 mesId-1 往前找第一条非 user/非 system 楼，读其快照 .line。
// 那正是「本楼推进前」的线态 B0。快照每楼渲染即同步冻结、无 API 依赖，比 swipe 临时层可靠得多。
// 找不到（本楼即首楼/greeting）返回 ''。供🔄重生成在临时层基线丢失时重建楼层基线 B0。
function _prevAiFloorLines(mesId) {
    try {
        const chat = getContext().chat;
        if (!Array.isArray(chat)) return '';
        for (let i = Math.min(Number(mesId), chat.length) - 1; i >= 0; i--) {
            const m = chat[i];
            if (m && !m.is_user && !m.is_system) return snapshot.readSnapshot(i)?.line || '';
        }
    } catch { /* 空 */ }
    return '';
}
// swipe / 重 roll 事件本身不自动请求线 API；滑回旧 swipe 时只复用已有临时层并本地重画。
// 正常新 AI 楼的线推进仍只走 MESSAGE_RECEIVED → CHARACTER_MESSAGE_RENDERED 的统一入口。
function loadCachedLinesForCurrentChat(view, charName) {
    const saved = readStore(getLinesCacheKey(view, charName));
    if (saved?.raw) return linesFeature.renderLines(saved.raw);
    return null;
}

// ─── 存储管理面板 ──────────────────────────────────────────────────────────────
// 三层：①本聊天 chat_metadata（点线面间讨论 + 记忆 + 棱永久）②收藏（坐标·服务器）
//       ③本机缓存（localStorage：棱草稿 + UI 位置）。构画只统计/清理自己的数据。
// 清理委托与确认文案在 runtime/storage-panel.js；日历条目必须走精确 dataKey，不能按 kind 前缀清。

async function renderCurrentChatStorageMode() {
    return paintStorageMode({
        $status: $in('#sp-storage-mode-status'),
        $migrate: $in('#sp-storage-migrate'),
        $retry: $in('#sp-storage-retry'),
        storageStatus,
        probe: probeExternalBackend,
    });
}

function mountMigrationOverlay() {
    return createMigrationOverlay({
        document,
        onAbort: abortMigration,
        progressCopy: migrationProgressCopy,
    });
}

async function startCurrentChatMigration() {
    const initial = storageStatus();
    if (!initial.chatId || initial.mode !== 'chat') return;
    const confirmed = await customDialog.confirm({
        title: '迁出当前聊天的构画数据',
        body: '仅迁移当前聊天。期间页面会被锁定并暂停构画任务；复制阶段可中断，最终提交阶段必须等待确认。迁出后，单独导出聊天不再包含完整构画数据。',
        note: '请确保后端数据也有备份。此次迁移不会搬动正文、其它插件数据、世界书、坐标收藏或设备草稿。',
        confirmText: '开始迁移', cancelText: '取消',
    });
    if (!confirmed || storageStatus().chatId !== initial.chatId) return;
    _abortAllBackground();
    const overlay = mountMigrationOverlay();
    let result;
    try { result = await migrateCurrentChat({ onProgress: info => overlay.progress(info) }); }
    catch (error) { result = { ok: false, reason: 'migration-failed', error }; }
    if (result.ok) {
        overlay.close(); showToast('当前聊天的构画数据已迁出并完成回读校验');
        renderStorageUsage(); renderCurrentChatStorageMode();
    } else if (result.reason === 'publish-unknown') {
        overlay.unknown(result.error?.message || '最终提交结果未知，请刷新聊天核实后再继续使用构画。');
    } else {
        overlay.close();
        showToast(result.reason === 'aborted' ? '迁移已中断，原聊天数据未切换' : `迁移失败：${result.error?.message || result.reason || '未知错误'}`, null, result.reason !== 'aborted');
        renderCurrentChatStorageMode();
    }
}

function createGouhuaBackupController(onProgress) {
    const coordPorts = createCoordinateHostPorts({ context: () => getContext() });
    return createBackupController({
        pluginVersion: '3.6.9.1',
        getContext,
        getSettings,
        saveSettings: () => stSaveSettings(),
        localStorage: globalThis.localStorage,
        storageStatus,
        getChatRoot,
        persistExternalRoots,
        fetch: (...args) => globalThis.fetch(...args),
        headers: () => getContext()?.getRequestHeaders?.() || { 'Content-Type': 'application/json' },
        readJson: name => readCoordinateJson(coordPorts, name),
        uploadJson: (name, value) => uploadCoordinateJson(coordPorts, name, value),
        invalidateCoordinates: () => {
            coordinateRuntime?.repository?.invalidate?.();
            coordinateRuntime?.excerpts?.invalidate?.();
        },
        loadWorldInfo: name => getContext()?.loadWorldInfo?.(name),
        saveWorldInfo: (name, data, immediate) => getContext()?.saveWorldInfo?.(name, data, immediate),
        updateWorldInfoList: () => getContext()?.updateWorldInfoList?.(),
        onProgress,
    });
}

function mountBackupOverlay(title) {
    return createBackupOverlay({ document, title, escapeHtml });
}

async function exportGouhuaBackup() {
    const confirmed = await customDialog.confirm({
        title: '导出构画迁移包',
        body: '会打包设置（可能含 API Key）、能读到的聊天账本、本机草稿、坐标收藏、构画自己的世界书。不含聊天正文、也不含别的插件数据。',
        note: '卸本体再装自己这份时，把这份 JSON 再导入即可。请自行保管，不要发给别人。',
        confirmText: '导出', cancelText: '取消',
    });
    if (!confirmed) return;
    const overlay = mountBackupOverlay('正在导出构画迁移包');
    try {
        const controller = createGouhuaBackupController(info => overlay.progress(info));
        const pack = await controller.exportPack();
        controller.download(pack);
        overlay.close();
        showToast('构画迁移包已导出');
    } catch (error) {
        overlay.close();
        showToast(`导出失败：${error?.message || '未知错误'}`, null, true);
    }
}

async function importGouhuaBackup(file) {
    let pack;
    try { pack = parseBackupText(await file.text()); }
    catch (error) { showToast(`无法读取迁移包：${error?.message || '未知错误'}`, null, true); return; }
    const confirmed = await customDialog.confirm({
        title: '导入构画迁移包',
        body: summarizeBackup(pack),
        note: '只会写入构画自己的数据。同名设置、账本、草稿、坐标和构画世界书会被包里的内容覆盖。导入后会刷新页面。',
        confirmText: '导入并刷新', cancelText: '取消',
    });
    if (!confirmed) return;
    const overlay = mountBackupOverlay('正在导入构画迁移包');
    try {
        const controller = createGouhuaBackupController(info => overlay.progress(info));
        const result = await controller.importPack(pack);
        overlay.close();
        const skipped = (result.chatsSkipped || 0) + (result.chatsExternal || 0);
        showToast(skipped ? `已导入。有 ${skipped} 份聊天未能写入（可能已迁出或聊天不在本机）` : '构画数据已导入，即将刷新');
        window.location.reload();
    } catch (error) {
        overlay.close();
        showToast(`导入失败：${error?.message || '未知错误'}`, null, true);
    }
}

function downloadDiagnosticPackage(data) {
    const text = JSON.stringify(data, null, 2);
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `gouhua-diagnostic-${Date.now()}.json`; anchor.style.display = 'none';
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    return text;
}

async function exportCurrentChatDiagnosticPackage() {
    const choice = await customDialog.choose({
        title: '导出当前聊天诊断包',
        body: '诊断包会包含最近两个有效 AI 楼的请求记录（每个模块仅保留最新一次），包括完整输入与原始回复，可能含剧情。默认不附带聊天正文，也绝不导出 API 配置、URL、密码、请求头或其它聊天。',
        note: '这不是完整可导入备份。若当前聊天已迁出，仍需另外保留白鳥数据后端。',
        choices: [
            { value: 'cancel', label: '取消' },
            { value: 'safe', label: '导出（不附正文）', primary: true },
            { value: 'narrative', label: '导出并附正文' },
        ],
    });
    if (!choice || choice === 'cancel') return;
    try {
        const data = await buildCurrentChatDiagnosticPackage({ includeNarrative: choice === 'narrative', safeTrace: readDiagnosticTrace() });
        const text = downloadDiagnosticPackage(data);
        showToast('当前聊天诊断包已导出', async () => { if (await copyPlainText(text)) showToast('诊断包已复制'); });
    } catch (error) { showToast(`诊断包导出失败：${error?.message || '未知错误'}`, null, true); }
}

// 渲染三层用量到 #sp-storage-body。异步（坐标要读服务器索引）。
async function renderStorageUsage() {
    return paintStorageUsage({
        $body: $in('#sp-storage-body'),
        $in,
        formatBytes: store.formatBytes,
        hasStore: () => store.hasStore(),
        ownKeyBytes: key => store.ownKeyBytes(key),
        usageByKind: () => store.usageByKind(),
        userClearKinds: store.USER_CLEAR_KINDS,
        localBytes: () => theaterDeviceCache.pluginCacheBytes(),
        renderMode: renderCurrentChatStorageMode,
        anchorUsage: () => coordinateRuntime?.feature?.storageUsage?.() || { count: 0, bytes: 0 },
        formatAnchorBytes: bytes => coordinateRuntime.feature.formatBytes(bytes),
    });
}

function invalidateLedgerTasksForStoreClear() {
    traceDiagnosticEvent('abort-boundary', { module: 'ledger', chatId: getContext?.()?.chatId ?? null, chatRevision: pointTaskOwners.currentChatRevision(), boundaryEpoch: chatBoundaryEpoch, abortReason: 'store-clear', status: 'dispatch' });
    ledgerCaptureController.reset('store-clear');
    ledgerJudgeController.reset('store-clear');
    resetLedgerRenderState();
}

function refreshLedgerAfterStoreClear() {
    refreshLedgerInjection();
    refreshInlineWindow(true);
    if (axisState.almanacMode && axisState._almanacSheet === 'ledger') renderAlmanacPanel();
}

function invalidateAlmanacTasksForStoreClear() {
    traceDiagnosticEvent('abort-boundary', { module: 'axis-generation', chatId: getContext?.()?.chatId ?? null, chatRevision: pointTaskOwners.currentChatRevision(), boundaryEpoch: chatBoundaryEpoch, abortReason: 'store-clear', status: 'dispatch' });
    axisGenerationController.reset('store-clear');
    axisState._almanacEditor = null;
    axisCalendarManager.close();
    axisState._almanacCalDay = null;
    axisState._almanacCalMonth = null;
    axisState._almTodayEditing = false;
}

function refreshAlmanacAfterStoreClear() {
    syncLatestAlmanacBlock();
    if (axisState.almanacMode) renderAlmanacPanel();
}

function storeClearTrace(kind) {
    traceDiagnosticEvent('abort-boundary', { module: kind, chatId: getContext?.()?.chatId ?? null, chatRevision: pointTaskOwners.currentChatRevision(), boundaryEpoch: chatBoundaryEpoch, abortReason: 'store-clear', status: 'dispatch' });
}

function storeClearHost() {
    return {
        trace: storeClearTrace,
        abortSchedule() {
            pointState.scheduleAbortController?.abort('store-clear'); pointState.scheduleAbortController = null;
            _autoRegenSchedAbort?.abort('store-clear'); _autoRegenSchedAbort = null;
            pointState.isGenerating = false;
        },
        invalidateOutline: kind => outlineFeature.invalidateStoreKind(kind),
        abortLines: () => linesFeature.abortGeneration({ reason: 'store-clear' }),
        invalidateSpace: kind => spaceFeature.invalidateStoreKind(kind),
        abortDashed: () => linesFeature.dashed.abort('store-clear'),
        refreshScheduleEmpty() {
            pointState.cachedSchedule = null;
            setBody(STORE_CLEAR_EMPTY_SCHEDULE_HTML);
            syncLatestScheduleBlock();
        },
        refreshOutlineEmpty: kind => { outlineFeature.refreshAfterStoreClear(kind); syncLatestInlineBlock(); },
        refreshLinesEmpty() {
            linesRuntime.reset();
            if (linesMode) linesFeature.renderBody(renderEmptyLinesState());
            refreshLinesInjection();
            syncLatestInlineBlock();
        },
        refreshDashed() {
            linesFeature.dashed.resetError();
            if (linesMode) linesFeature.refreshPanel();
            syncLatestInlineBlock();
        },
        refreshCreativeEmpty: kind => outlineFeature.refreshAfterStoreClear(kind),
        refreshSpaceEmpty: kind => spaceFeature.refreshAfterStoreClear(kind),
        refreshScheduleFromStore() {
            const key = getCacheKey(currentView, charViewName);
            const saved = readStore(key);
            const subject = currentView === 'char' ? (charViewName || getContext().name2 || '角色') : (getContext().name1 || '用户');
            pointState.cachedSchedule = saved?.raw ? renderSchedule(saved.raw, saved.userName || subject, currentView, loadCalDesc()) : null;
            if (!outlineMode && !linesMode && !spaceMode && !theaterMode && $(`#${MODAL_ID}`).is(':visible')) {
                setBody(pointState.cachedSchedule || STORE_CLEAR_EMPTY_SCHEDULE_HTML);
            }
            syncLatestScheduleBlock();
        },
        refreshOutlineFromStore: kind => outlineFeature.refreshFromStore(kind),
        refreshLinesFromStore() {
            linesRuntime.reset();
            if (linesMode) linesFeature.refreshPanel();
            refreshLinesInjection();
        },
        refreshCreativeFromStore: kind => outlineFeature.refreshFromStore(kind),
        refreshSpaceFromStore: kind => spaceFeature.refreshFromStore(kind),
        refreshDashedFromStore() {
            linesFeature.dashed.resetError();
            if (linesMode) linesFeature.refreshPanel();
            syncLatestInlineBlock();
        },
    };
}

function invalidateKindTasksForStoreClear(kind) {
    dispatchStoreClearInvalidate(kind, storeClearHost());
}

function refreshEditorsAfterStoreClear(kind) {
    dispatchStoreClearRefreshAfter(kind, storeClearHost());
}

function refreshEditorsFromCurrentStore(kind) {
    dispatchStoreClearRefreshFromStore(kind, storeClearHost());
}

function renderEmptyLinesState() {
    return STORE_CLEAR_EMPTY_LINES_HTML;
}

async function triggerGenerateLines() {
    return linesFeature.generate();
}

function buildLinesPrompt(userName, charName, perspective = 'user', previousRaw = '', scale = 'auto', vectorContext = {}, adultMode = 'off') {
    return buildCanonicalLinesPrompt(userName, charName, perspective, previousRaw, scale, vectorContext, adultMode);
}

// ─── Storylines parse / render ────────────────────────────────────────────────


// 线解析统一委托给 business/lines/schema.js。
function parseLines(raw) { return parseCanonicalLines(raw); }
// 锁定保护：把 oldRaw 里 pin 的线并进 AI 新输出。无锁定线时原样返回（零副作用）。

const STAGE_COLORS = {
    起线: '#7de9d9', 延展: '#58e8b3', 成形: '#d6b85a', 收束: '#2a8a5d', 淡出: '#888888',
};

// 点/线面板 header 下方另起一行的「去间改」引导，视觉对齐历法管理页的 .sp-alm-manager-hint。
// 「间」能把讨论落地成点/线，想调整时一键跳过去（handler 见 injectModal 委托）。
const SP_JUMP_HINT_LINES = `<div class="sp-jump-hint">想调整这些线？<button type="button" class="sp-jump-link">和「间」聊聊 →</button></div>`;


// ─── 历（日历 / 历法）─────────────────────────────────────────────────────────
// 独立模块，与点/线/面共通但存储隔离：点是 AI 每轮重算的易失数据，历要稳，
// 单独存 chat_metadata（kind='almanac'，不分我/TA，固定 user scope，抄 dashed）。
// 历数据供构画生成与讨论上下文使用，不作为主楼常驻注入。数据形状：{ items:[{id,name,type,month,day,displayDate,note,pin,source}], ts }






// 历「当前日期」锚点体系（almTodayAnchor/almDaysUntil/almWeekdayRef/almWeekdayFor 及日期差 helpers）
// 已抽出到 business/axis/anchor.js（纯数据层从 data.js/叶子模块 import，跨域读取器经 bindAxisAnchor 注入）。

// 历注入文本构造 getAlmanacInjectText 已抽出到 business/axis/inject.js（纯函数，仅依赖 data.js/anchor.js）。

// 当前历法描述（供间做「改历法」增量编辑参考）；内置公历返回 ''（无需告知，AI 直接按需新建）。

// AI 输出解析：<almanac_widget> 内 Item: name|type|month|day|days|displayDate|note

// 解析间落地的 <era_widget>（纪年/历法描述符）：一行可选 Era: 纪年名 + N 行 Month: 月名|天数。
// 交给现行历法 parse/validate/manager/actions 链校验；无有效月份描述时返回空结果。

// 重算合并：保留所有已锁 + 所有自填(user)，丢弃未锁 AI 项，再并入新 AI 项（按名+月日去重）。

// ── 渲染 ──
function closeActionMenus(except = null) {
    closeOpenActionMenus($inAll, $, except);
}

const axisUi = createAxisUi({
    actionMenus: ACTION_MENU_CONFIGS,
    escapeHtml, escapeAttr,
    storyClockEnabled,
    latestClock: latestStoryClock,
    charKey: () => charStableKey(getContext()),
    calendar: loadCalDesc,
    today: almTodayAnchor,
    weekday: almWeekdayFor,
    weekdays: ALM_WEEKDAYS,
    monthName: (cal, month) => calMonthName(cal, month),
    monthCount: cal => calMonthCount(cal),
    anchor: key => getDateAnchor(key),
    storyCalibration: () => getStoryCalibration(charStableKey(getContext())),
    editing: () => axisState._almTodayEditing,
});
const actionMenuHtml = axisUi.actionMenuHtml;
const almTodayBarHtml = axisUi.todayBarHtml;
const storyClockBarHtml = axisUi.storyClockBarHtml;
function almNudgeToday(delta) {
    axisDateActions.nudgeToday(delta, { storyClock: true });
}
function currentCharacterCards() { return calendarCards(getContext(), charStableKey); }

function openCalendarManager() {
    axisState._almanacEditor = null;
    axisCalendarManager.begin();
    if (axisState.almanacMode) renderAlmanacPanel();
}

function closeCalendarManager() {
    axisCalendarManager.close();
}

function readCalendarDraftForm() {
    if (!axisCalendarManager.isEditing()) return null;
    return {
        era: String($in('#sp-alm-manager-era').val() || ''),
        displayStyle: String($in('#sp-alm-manager-display-style').val() || 'numeric') === 'classical' ? 'classical' : 'numeric',
        months: $inAll('#sp-almanac-wrap .sp-alm-manager-month-row').map(function () {
            return { name: String($(this).find('.sp-alm-manager-month-name').val() || ''), days: $(this).find('.sp-alm-manager-month-days').val() };
        }).get(),
    };
}

async function commitCalendarDesc(cal) { return axisTransactionController.commit(cal); }
async function maybeApplyBoundCalendarTemplate(options = {}) { return axisTransactionController.applyBound(options); }
function almCalMonth() {
    if (Number.isFinite(axisState._almanacCalMonth)) return axisState._almanacCalMonth;
    axisState._almanacCalMonth = almTodayAnchor().month - 1;
    return axisState._almanacCalMonth;
}

// ── 子视图 / 导航 ──
function almSetSheet(sheet) {
    if (axisState._almanacSheet === sheet) return;
    setAxisSheet(sheet, renderAlmanacPanel, batchReset);
}
function almNavMonth(delta) {
    navigateAxisMonth(delta, () => calMonthCount(loadCalDesc()), almCalMonth, renderAlmanacPanel);
}
// ── 生成 ──
async function triggerGenerateAlmanac() { return axisGenerationController.trigger(false); }

// 跑补录：复用 axisGenerationController（由 axisState.isGeneratingAlmanac 维护互斥），
// 但合并阶段走**纯追加去重**（非 mergeAlmanac）+ pin=true，且补 0 条时给出「没有够格」的正常态提示、不报错。
async function triggerSupplementAnniversary() { return axisGenerationController.trigger(true); }
// ── 手动新增 / 编辑（内联窗，不用弹窗）──
// 用户明确怕浮层弹窗出问题（会盖住/卡住），故表单直接渲进 #sp-almanac-wrap 里，
// 走 renderAlmanacPanel 的正常重渲，跟着 CHAT_CHANGED 一起被清，绝不残留浮层。
function openAlmanacEditor(id, prefill) {
    openAxisEditor(id, prefill, renderAlmanacPanel);
}
function closeAlmanacEditor() {
    closeAxisEditor(renderAlmanacPanel);
}
function renderAlmanacEditor() {
    return renderAxisEditor({
        calendar: loadCalDesc, items: loadAlmanac, monthIndex: almCalMonth, today: almTodayAnchor,
        types: ALM_TYPES, typeLabel: type => almTypeMeta(type).label, monthCount: calMonthCount,
        monthDays: calMonthDays, yearLength: calYearLen, escapeHtml, escapeAttr,
    });
}
// 编辑器里月/日/天数变动时，实时刷新只读周几提示（纯提示，不入库）。
function almRenderWdHint() {
    const $h = $in('#sp-alm-f-wdhint');
    if (!$h.length) return;
    $h.text(renderAxisWeekdayHint({ calendar: loadCalDesc, monthValue: () => $in('#sp-alm-f-month').val(), dayValue: () => $in('#sp-alm-f-day').val(), durationValue: () => $in('#sp-alm-f-days').val(), clamp: almClampInt, monthCount: calMonthCount, monthDays: calMonthDays, yearLength: calYearLen, weekdayRef: almWeekdayRef, weekdayFor: almWeekdayFor, weekdays: ALM_WEEKDAYS, monthName: calMonthName, endMonthDay: almEndMonthDay }));
}
function saveAlmanacEditor() {
    if (!axisState._almanacEditor) return;
    const result = axisEditorController.save();
    if (!result.ok) {
        if (result.reason === 'name') { showToast('请填写名称', null, true); $in('#sp-alm-f-name').trigger('focus'); }
        else if (result.reason === 'persist') showToast('日期保存失败，请重试', null, true);
    }
}

function toggleAlmanacPin(id) {
    const result = axisActions.togglePin(id); if (!result) return;
    // 就地更新该行（锁不改排序），不整面重渲 → 不会把滚动/视觉焦点弹回页头
    if (axisState.almanacMode) {
        const $rows = $in(`#sp-almanac-wrap .sp-alm-item[data-id="${id}"]`);
        $rows.toggleClass('sp-alm-pinned', result.pin);
        $rows.find('.sp-alm-pin')
            .attr('title', result.pin ? '已锁定 · 生成时保留（点击解锁）' : '锁定 · 生成时保留')
            .find('i').attr('class', `fa-solid ${result.pin ? 'fa-lock' : 'fa-lock-open'}`);
    }
}
// 日历详情↔网格联动：把某条目在当前月覆盖到的日子高亮到上方网格（直接改 class，不重渲）。
async function deleteAlmanacItem(id) {
    await axisActions.remove(id);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

// Inline model list state — cached models from last fetch. Not persisted
// across page reloads (matches original <select> behavior — user re-fetches
// if they refresh). Lives only while the tab is open.
let _cachedModels = [];

function renderModelList(models, filter = '') {
    _cachedModels = Array.isArray(models) ? models : [];
    $in('#sp-model-list-count').text(`已加载 ${_cachedModels.length} 个模型`);
    const shown = filterModelList(_cachedModels, filter);
    const current = ($in('#sp-cfg-model').val() || '').trim();
    if (!shown.length) {
        $in('#sp-model-list-items').html(`<div class="sp-model-list-empty">${String(filter ?? '').trim() ? '无匹配项' : '暂无模型'}</div>`);
        return;
    }
    // Cap the initial render at 200 items with a "show more" tail for MASSIVE lists;
    // in practice most APIs return <200 so this is defensive.
    const html = shown.map(m =>
        `<button type="button" class="sp-model-list-item${m === current ? ' sp-model-list-item-active' : ''}" data-model="${escapeAttr(m)}">${escapeHtml(m)}</button>`
    ).join('');
    $in('#sp-model-list-items').html(html);
}

async function fetchModels() {
    const rawUrl = $in('#sp-cfg-url').val().trim();
    const key = ($in('#sp-cfg-key').data('real') || $in('#sp-cfg-key').val()).trim();
    if (!rawUrl || !key) { showToast('请先填写 URL 和 Key', null, true); return; }
    const url = normalizeApiUrl(rawUrl);
    const ctx = getContext();

    const $btn = $in('#sp-fetch-models');
    $btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i>');
    try {
        // Same proxy strategy as generation: go through ST's /status endpoint
        // which supports listing OpenAI-compatible models via a POST body.
        const res = await fetch('/api/backends/chat-completions/status', {
            method : 'POST',
            headers: ctx.getRequestHeaders(),
            body   : JSON.stringify({
                chat_completion_source: 'openai',
                reverse_proxy         : url,
                proxy_password        : key,
            }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 120)}`);
        const data = await res.json();
        if (data?.error) throw makeDiagnosticError('unknown', { phase: 'request' });
        const models = (data.data || data.models || [])
            .map(m => (typeof m === 'string' ? m : m.id))
            .filter(Boolean).sort();
        if (!models.length) throw new Error('接口未返回任何模型');

        // Inline model list — no popup, no z-index chaos. Render directly into
        // the settings body's <details> section so any browser/WebView that can
        // render <button> can render this. Fixes "popup appears behind plugin"
        // reports from in-app browsers (WeChat/QQ WebView, etc.) that don't
        // give <select> the native fullscreen picker treatment.
        renderModelList(models);
        // Auto-expand so user sees the result of their action
        $in('#sp-model-list-section').attr('open', 'open').show();
        showToast(`已加载 ${models.length} 个模型`);
    } catch (err) {
        showToast(`获取模型失败：${diagnosticMessage(err)}`, null, true);
    } finally {
        $btn.prop('disabled', false).html('<i class="fa-solid fa-list"></i>');
    }
}

function toggleSettings() {
    if (!settingsOpen) activityFeature.close();
    settingsOpen = !settingsOpen;
    const $overlay = $in('#sp-settings-overlay');
    if (settingsOpen) {
        const savedLinesMode = getLinesMode();
        for (const value of ['turns', 'days', 'manual']) {
            $in(`input[name="sp-lines-mode"][value="${value}"]`).prop('checked', value === savedLinesMode);
        }
        renderWiList();     // async, fire-and-forget — fills list when done
        renderWiExcludeList();   // 全局排除清单（async fire-and-forget；冷缓存会强刷世界书全表）
        renderScaleRow();   // per-character scale radios (sync)
        renderAdultRow();
        renderMemorySection();   // memory status + settings sync
        renderTheaterSection();  // 棱 settings + cache usage + template manager
        renderStorageUsage();    // 存储管理面板：本聊天、坐标收藏、本机缓存三层用量统计
        $overlay.stop(true).css({ display: 'flex', opacity: 0 }).animate({ opacity: 1 }, 180);
        paintPace();
    } else {
        $overlay.stop(true).animate({ opacity: 0 }, 150, function () { $(this).css('display', 'none'); });
        stSaveSettings();   // 关面板即把面板内所有改动立即写盘：兜底防抖未 flush 的字段（customPrompt 等），根治重启丢失
    }
    $in('.sp-settings-btn').toggleClass('sp-btn-active', settingsOpen);
    syncMobileViewport();
}

function renderMemorySection() {
    const s = getSettings();
    const useBbb = usesBaiBaiBook(s);
    $in('#sp-mem-source-bbb').prop('checked', useBbb);
    $in('#sp-mem-keeptags').val(typeof s.keepTags === 'string' ? s.keepTags : 'content');
    $in('#sp-mem-extratags').val(typeof s.extraTags === 'string' ? s.extraTags : '');
    $in('#sp-custom-prompt').val(typeof s.customPrompt === 'string' ? s.customPrompt : '');
    $in('#sp-storyclock-prompt').val(buildStoryClockPrompt(s));
    $in('#sp-space-persona').val(typeof s.spacePersona === 'string' ? s.spacePersona : '');
    if (useBbb) {
        $in('#sp-mem-internal').hide();
        $in('#sp-mem-bbb-status').show().html(baiBaiBookStatusHtml(baiBaiBookCoverage(globalThis.STBaiBaiBook), escapeHtml));
        return;
    }
    $in('#sp-mem-internal').show();
    $in('#sp-mem-bbb-status').hide();
    $in('#sp-mem-enabled').prop('checked', s.memoryEnabled !== false);
    $in('#sp-mem-l0').val(Number.isFinite(+s.memoryL0Group) ? +s.memoryL0Group : 5);
    $in('#sp-mem-l1').val(Number.isFinite(+s.memoryL1Group) ? +s.memoryL1Group : 10);
    $in('#sp-mem-skipshort').val(Number.isFinite(+s.memorySkipShort) ? +s.memorySkipShort : 50);
    refreshMemoryStatus();
}


function refreshMemoryStatus() {
    const r = memory.getHealthReport();
    if (!r.paused) memoryPauseNoticeShown = false;
    const rows = [
        `<div class="sp-mem-stat"><span class="sp-mem-stat-k">AI 楼总数</span><span class="sp-mem-stat-v">${r.totalAi}</span></div>`,
        `<div class="sp-mem-stat"><span class="sp-mem-stat-k">稳定分组数</span><span class="sp-mem-stat-v">${r.totalGroups}</span></div>`,
        `<div class="sp-mem-stat"><span class="sp-mem-stat-k">已生成 L0</span><span class="sp-mem-stat-v">${r.withL0}</span></div>`,
        `<div class="sp-mem-stat"><span class="sp-mem-stat-k">待生成</span><span class="sp-mem-stat-v${r.pending > 0 ? ' sp-mem-warn' : ''}">${r.pending}</span></div>`,
        `<div class="sp-mem-stat"><span class="sp-mem-stat-k">永久失败</span><span class="sp-mem-stat-v${r.permaFailed > 0 ? ' sp-mem-warn' : ''}">${r.permaFailed}</span></div>`,
        `<div class="sp-mem-stat"><span class="sp-mem-stat-k">L1 章节数</span><span class="sp-mem-stat-v">${r.l1Chapters}</span></div>`,
    ];
    if (r.strippedEmpty > 0) rows.splice(5, 0,
        `<div class="sp-mem-stat"><span class="sp-mem-stat-k">标签致空</span><span class="sp-mem-stat-v sp-mem-warn">${r.strippedEmpty}</span></div>`);
    if (r.strippedEmpty > 0) rows.push(`<div class="sp-mem-alert">⚠ 有 ${r.strippedEmpty} 组净化后正文几乎为空，请重查「保留标签」设置（非模型问题，无需换模型）。</div>`);
    if (r.paused) rows.push(`<div class="sp-mem-alert">⚠ 记忆系统已暂停：${escapeHtml(r.lastError || '连续失败')}。点补齐或重构以恢复。</div>`);
    if (r.busy)   rows.push(`<div class="sp-mem-alert sp-mem-alert-info">🔄 记忆系统正在后台工作</div>`);
    $in('#sp-mem-status').html(rows.join(''));
}

// ─── 棱 settings renderer ───────────────────────────────────────────────────
function renderTheaterSection() {
    const s = getSettings();
    $in('#sp-theater-style').val(typeof s.theaterStylePrompt === 'string' ? s.theaterStylePrompt : '');
    $in('#sp-theater-count').val(String(s.theaterCount || THEATER_COUNT_DEFAULT));
    void renderTheaterPoolList();
    void theaterFeature?.refreshUi();
}

async function renderTheaterPoolList() {
    const $list = $in('#sp-theater-pool-list');
    if (!$list.length) return;
    const names = [...new Set((await getAllWorldNames(getContext()) || []).filter(n => typeof n === 'string' && n))].sort((a, b) => a.localeCompare(b, 'zh'));
    const selected = new Set(getSettings().theaterPoolBooks || []);
    if (!names.length) {
        $list.html('<span class="sp-cfg-hint">当前没有任何世界书。把小回 / 极光 / 小兔导入酒馆后再来勾选。</span>');
        return;
    }
    $list[0].innerHTML = names.map(name => {
        const on = selected.has(name);
        return `<label class="sp-wi-exclude-row${on ? ' sp-wi-exclude-on' : ''}" data-name="${escapeAttr(name)}"><input type="checkbox" class="sp-theater-pool-cb" data-name="${escapeAttr(name)}"${on ? ' checked' : ''}><span class="sp-wi-exclude-name">${escapeHtml(name)}</span></label>`;
    }).join('');
    const query = String($in('#sp-theater-pool-search').val() || '').trim().toLowerCase();
    if (query) {
        $list.find('.sp-wi-exclude-row').each(function () {
            const name = String($(this).data('name') || '').toLowerCase();
            $(this).toggle(name.includes(query));
        });
    }
}

function setMemoryProgressVisible(visible) {
    $in('#sp-mem-progress').toggle(!!visible);
    if (visible) updateMemoryProgress(0, 0);
}

function updateMemoryProgress(current, total, aborted = false) {
    $in('#sp-mem-progress-count').text(aborted ? `已中止 (${current}/${total})` : `${current}/${total}`);
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    $in('#sp-mem-progress-fill').css('width', pct + '%');
}

// Renders the narrative-scale radio group into #sp-scale-row using the current
// character's saved value. Regenerated each time settings opens (character can
// change between opens).
function renderScaleRow() {
    const $row = $in('#sp-scale-row');
    if (!$row.length) return;
    const ctx = getContext();
    const current = getScale(charStableKey(ctx));
    const opts = SCALE_VALUES.map(v => `
        <label class="sp-mode-opt">
            <input type="radio" name="sp-lines-scale" value="${v}"${v === current ? ' checked' : ''}>
            <span>${escapeHtml(SCALE_LABELS[v])}</span>
        </label>`).join('');
    $row.html(opts);
}

function renderAdultRow() {
    const $row = $in('#sp-adult-row');
    if (!$row.length) return;
    const current = getAdultMode(charStableKey(getContext()));
    $row.html(ADULT_MODES.map(v => `<label class="sp-mode-opt"><input type="radio" name="sp-lines-adult-mode" value="${v}"${v === current ? ' checked' : ''}><span>${escapeHtml(ADULT_MODE_LABELS[v])}</span></label>`).join(''));
}

// Render world-info entry checklist for the current character into #sp-wi-list.
// Perf: builds one HTML string + inserts once, uses event delegation on the list root.
let _wiEntryCache = new Map();   // key → entry object, for eye-button popup lookup
let _wiListRevision = 0;

function _wiListIdentity(ctx) {
    return JSON.stringify({
        chatId: String(ctx?.chatId ?? ''),
        characterId: String(ctx?.characterId ?? ''),
        characterKey: charStableKey(ctx),
    });
}

// Nearest scrollable ancestor — used to keep the viewport steady across a
// re-render (adding/removing an extra book rebuilds the whole list).
function _wiScrollParent(el) {
    let p = el && el.parentElement;
    while (p) {
        const oy = getComputedStyle(p).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
        p = p.parentElement;
    }
    return null;
}

async function renderWiList() {
    const ctx = getContext();
    const $list = $in('#sp-wi-list');
    const revision = ++_wiListRevision;
    const identity = _wiListIdentity(ctx);
    const isCurrent = () => revision === _wiListRevision && identity === _wiListIdentity(getContext());

    // Snapshot the current expand + scroll state BEFORE the loading placeholder
    // wipes the DOM, so a re-render doesn't spring every <details> group back open
    // or bounce the viewport. First open has no groups yet → everything defaults
    // open as before.
    const prevSources = new Set();
    const openSources = new Set();
    $list.find('.sp-wi-group').each(function () {
        const src = String(this.getAttribute('data-source') || '');
        prevSources.add(src);
        if (this.open) openSources.add(src);
    });
    const hadGroups = prevSources.size > 0;
    const scrollEl = _wiScrollParent($list[0]);
    const savedScroll = scrollEl ? scrollEl.scrollTop : 0;

    $list.html('<span class="sp-cfg-hint">正在加载世界书条目…</span>');

    let entries;
    try {
        entries = await getCharBookEntries(ctx);
    } catch (err) {
        if (!isCurrent()) return;
        $list.html(`<span class="sp-cfg-hint">加载失败：${escapeHtml(diagnosticMessage(err))}</span>`);
        return;
    }
    if (!isCurrent()) return;

    // Cache entries for the eye-button popup
    if (!isCurrent()) return;
    _wiEntryCache = new Map(entries.map(e => [e.key, e]));

    const selection = ensureCurrentWiSelection(ctx, entries);

    // Two-level group: scope (char / chat / persona / global) → source (book name) → entries.
    // Preserves entry order within each source: char, chat, persona, then global.
    const scopes = new Map([['char', new Map()], ['chat', new Map()], ['persona', new Map()], ['global', new Map()]]);
    for (const e of entries) {
        const scopeGroup = scopes.get(e.scope) || scopes.get('char');
        if (!scopeGroup.has(e.source)) scopeGroup.set(e.source, []);
        scopeGroup.get(e.source).push(e);
    }
    const SCOPE_LABELS = { char: '角色卡世界书', chat: '当前聊天世界书', persona: '用户世界书', global: '全局世界书' };

    // Build HTML in one pass.
    const parts = [];
    if (entries.length) {
        parts.push(`<div class="sp-wi-all-row">
            <label class="sp-wi-toggle-all">
                <input type="checkbox" id="sp-wi-select-all"> 全选 / 全不选
            </label>
            <span class="sp-wi-count">${entries.length} 条</span>
        </div>`);
    } else {
        parts.push('<span class="sp-cfg-hint">当前角色没有关联 / 全局启用的世界书。</span>');
    }

    for (const [scope, groups] of scopes) {
        if (!groups.size) continue;
        const scopeCount = [...groups.values()].reduce((n, g) => n + g.length, 0);
        parts.push(`<div class="sp-wi-scope">
            <div class="sp-wi-scope-label">${escapeHtml(SCOPE_LABELS[scope])} <span class="sp-wi-scope-count">${scopeCount} 条</span></div>`);
        for (const [source, group] of groups) {
            // Each book is collapsible; default open. summary shows a
            // per-book "select-all" checkbox (indeterminate when partial).
            const groupChecked = group.filter(e => worldInfoSelectionAllows(selection, e.key)).length;
            const groupAllOn   = groupChecked === group.length;
            const groupAllOff  = groupChecked === 0;
            const escSrc       = escapeAttr(source);
            // Preserve prior expand state across re-renders; open by default on the
            // first render and for a newly-appearing book (source not seen before).
            const groupOpen = !hadGroups || openSources.has(source) || !prevSources.has(source);
            parts.push(`<details class="sp-wi-group" data-source="${escSrc}"${groupOpen ? ' open' : ''}>
                <summary class="sp-wi-source-label">
                    <input type="checkbox" class="sp-wi-group-cb" data-source="${escSrc}"${groupAllOn ? ' checked' : ''}${!groupAllOn && !groupAllOff ? ' data-indeterminate="true"' : ''}>
                    <span class="sp-wi-source-name">${escapeHtml(source)}</span>
                    <span class="sp-wi-group-count">${group.length} 条</span>
                </summary>
                <div class="sp-wi-items">`);
            for (const e of group) {
                const checked = worldInfoSelectionAllows(selection, e.key);
                parts.push(`<div class="sp-wi-card${checked ? '' : ' sp-wi-card-off'}" data-key="${escapeAttr(e.key)}" data-source="${escSrc}" role="button" tabindex="0">
                    <div class="sp-wi-card-head">
                        <input type="checkbox" class="sp-wi-cb" data-key="${escapeAttr(e.key)}"${checked ? ' checked' : ''}>
                        <span class="sp-wi-label">${escapeHtml(e.label)}</span>
                    </div>
                    <div class="sp-wi-card-body">
                        <div class="sp-wi-preview">${e.preview ? escapeHtml(e.preview) + '…' : '<span class="sp-wi-empty">（无内容）</span>'}</div>
                        <button class="sp-wi-view-btn" type="button" title="查看全文" data-key="${escapeAttr(e.key)}"><i class="fa-regular fa-eye"></i></button>
                    </div>
                </div>`);
            }
            parts.push(`</div></details>`);
        }
        parts.push(`</div>`);
    }

    // Single DOM write
    if (!isCurrent()) return;
    $list[0].innerHTML = parts.join('');

    // Event delegation — one handler for the whole list, regardless of entry count
    $list.off('.wi').on('click.wi', '.sp-wi-view-btn', function (ev) {
        ev.stopPropagation();
        const key = $(this).data('key');
        const entry = _wiEntryCache.get(key);
        if (entry) showWiEntryFull(entry);
    }).on('click.wi', '.sp-wi-card', function (ev) {
        if ($(ev.target).closest('.sp-wi-view-btn').length) return;
        const $card = $(this);
        const $cb   = $card.find('.sp-wi-cb');
        if (ev.target !== $cb[0]) {
            $cb.prop('checked', !$cb.prop('checked'));
        }
        $card.toggleClass('sp-wi-card-off', !$cb.prop('checked'));
        syncWiSelectAll();
        saveCurrentWiSelection();
    }).on('keydown.wi', '.sp-wi-card', function (ev) {
        if (ev.key !== ' ' && ev.key !== 'Enter') return;
        ev.preventDefault();
        const $card = $(this);
        const $cb   = $card.find('.sp-wi-cb');
        $cb.prop('checked', !$cb.prop('checked'));
        $card.toggleClass('sp-wi-card-off', !$cb.prop('checked'));
        syncWiSelectAll();
        saveCurrentWiSelection();
    }).on('change.wi', '#sp-wi-select-all', function () {
        const checked = this.checked;
        $list.find('.sp-wi-cb').prop('checked', checked);
        $list.find('.sp-wi-card').toggleClass('sp-wi-card-off', !checked);
        $list.find('.sp-wi-group-cb').prop({ checked, indeterminate: false });
        saveCurrentWiSelection();
    }).on('change.wi', '.sp-wi-group-cb', function (ev) {
        // Per-book select-all — flip every entry in this <details> group
        ev.stopPropagation();
        const $group = $(this).closest('.sp-wi-group');
        const checked = this.checked;
        $group.find('.sp-wi-cb').prop('checked', checked);
        $group.find('.sp-wi-card').toggleClass('sp-wi-card-off', !checked);
        this.indeterminate = false;
        syncWiSelectAll();
        saveCurrentWiSelection();
    }).on('click.wi', '.sp-wi-group-cb', function (ev) {
        // Don't let click on the summary's checkbox also toggle <details> open/close
        ev.stopPropagation();
    });

    // Keep the viewport where it was across a re-render (skip on first open).
    if (scrollEl && hadGroups) scrollEl.scrollTop = savedScroll;

    syncWiSelectAll();
}

function syncWiSelectAll() {
    const $cbs = $inAll('#sp-wi-list .sp-wi-cb');
    if (!$cbs.length) return;
    const total   = $cbs.length;
    const checked = $cbs.filter(':checked').length;
    const $all = $in('#sp-wi-select-all')[0];
    if ($all) {
        $all.checked       = checked === total;
        $all.indeterminate = checked > 0 && checked < total;
    }
    // Refresh each group's per-book checkbox based on its own entries
    $inAll('#sp-wi-list .sp-wi-group').each(function () {
        const $g = $(this);
        const $groupCb = $g.find('.sp-wi-group-cb')[0];
        if (!$groupCb) return;
        const gCbs = $g.find('.sp-wi-cb');
        const gTotal = gCbs.length;
        const gChecked = gCbs.filter(':checked').length;
        $groupCb.checked       = gChecked === gTotal;
        $groupCb.indeterminate = gChecked > 0 && gChecked < gTotal;
    });
}

// 解析 ST 里注册的「全部世界书名」——供全局排除清单用。
// getWorldInfoNames() 只读内存缓存 world_names，而它要 updateWorldInfoList()（拉
// /api/worldinfo/list）才填；用户没开过酒馆 WI 面板 → 缓存冷 → 清单空。读书路径不受影响
// （走 loadWorldInfo/TavernHelper 直取），所以会出现「读书正常、排除清单空」。分层兜底、
// 首个非空即用：
//   1. 暖缓存 getWorldInfoNames()（已填则零成本，行为同旧版）
//   2. TavernHelper（跨分支便携：新 getWorldbookNames / 旧 getLorebooks）
//   3. 强制刷新 updateWorldInfoList() 再读——/api/worldinfo/list 权威、根治空清单
async function getAllWorldNames(ctx) {
    try {
        const cached = typeof ctx.getWorldInfoNames === 'function' ? ctx.getWorldInfoNames() : [];
        if (Array.isArray(cached) && cached.length) return cached;
    } catch {}
    try {
        const th = globalThis?.TavernHelper;
        const fn = th?.getWorldbookNames || th?.getLorebooks;
        if (typeof fn === 'function') {
            const list = await fn.call(th);
            if (Array.isArray(list) && list.length) return list;
        }
    } catch {}
    try {
        if (typeof ctx.updateWorldInfoList === 'function') {
            await ctx.updateWorldInfoList();
            const refreshed = typeof ctx.getWorldInfoNames === 'function' ? ctx.getWorldInfoNames() : [];
            if (Array.isArray(refreshed)) return refreshed;
        }
    } catch {}
    return [];
}

// 全局排除清单（B方案）：列出 ST 里所有世界书（与角色卡无关），勾选 = 拉黑、构画一律不读。
// 存 s.wiExcludeBooks（全局），与 renderWiList 的按角色卡挑选正交。书多（三四十本）时套进
// 内联抽屉 + 查找框：本函数只铺行，查找靠 _filterWiExcludeList 纯前端隐/显，不重渲（重渲会
// 打断查找框输入焦点）。名单经 getAllWorldNames 解析（冷缓存会强刷 /api/worldinfo/list）。
async function renderWiExcludeList() {
    const $list = $in('#sp-wi-exclude-list');
    if (!$list.length) return;
    const ctx = getContext();
    let names = await getAllWorldNames(ctx);
    names = [...new Set((names || []).filter(n => typeof n === 'string' && n))].sort((a, b) => a.localeCompare(b, 'zh'));
    const excluded = getWiExcludeSet();
    _syncWiExcludeCount(excluded.size, names.length);
    if (!names.length) {
        $list.html('<span class="sp-cfg-hint">当前没有任何世界书。</span>');
        return;
    }
    const rows = names.map(name => {
        const on = hasWiExcluded(name, excluded);
        return `<label class="sp-wi-exclude-row${on ? ' sp-wi-exclude-on' : ''}" data-name="${escapeAttr(name)}">
            <input type="checkbox" class="sp-wi-exclude-cb" data-name="${escapeAttr(name)}"${on ? ' checked' : ''}>
            <span class="sp-wi-exclude-name">${escapeHtml(name)}</span>
        </label>`;
    }).join('');
    $list[0].innerHTML = rows;
    $list.off('.wix').on('change.wix', '.sp-wi-exclude-cb', function () {
        const name = String($(this).data('name') || '');
        setWiExcluded(name, this.checked);
        $(this).closest('.sp-wi-exclude-row').toggleClass('sp-wi-exclude-on', this.checked);
        _syncWiExcludeCount(getWiExcludeSet().size, names.length);
        renderWiList();   // 排除变化即时反映到上面的按角色卡挑选列表（被排除的书从中消失/重现）
    });
    // 查找框：一次性绑定（每次 render 都重绑，off 先解旧的），输入即隐/显匹配行。
    const $search = $in('#sp-wi-exclude-search');
    $search.off('.wix').on('input.wix', function () {
        _filterWiExcludeList(String(this.value || '').trim().toLowerCase());
    });
    if ($search.val()) _filterWiExcludeList(String($search.val()).trim().toLowerCase());
}

// 查找框纯前端过滤：名字含关键词的行显示、其余隐藏；空词全显。
function _filterWiExcludeList(kw) {
    const $rows = $inAll('#sp-wi-exclude-list .sp-wi-exclude-row');
    if (!kw) { $rows.show(); return; }
    $rows.each(function () {
        const name = String(this.getAttribute('data-name') || '').toLowerCase();
        this.style.display = name.includes(kw) ? '' : 'none';
    });
}

// 抽屉标题右侧的计数徽标：「已排除 M / 共 N」，M=0 时只显总数、淡化。
function _syncWiExcludeCount(excludedN, totalN) {
    const $c = $in('#sp-wi-exclude-count');
    if (!$c.length) return;
    $c.text(excludedN > 0 ? `已排除 ${excludedN} / 共 ${totalN}` : `共 ${totalN}`)
      .toggleClass('sp-wi-exclude-count-active', excludedN > 0);
}

// Full-text popup for a single world-info entry
function showWiEntryFull(entry) {
    $in('#sp-wi-fullview').remove();
    const $overlay = $(`<div id="sp-wi-fullview" class="sp-wi-fullview">
        <div class="sp-wi-fullview-sheet">
            <div class="sp-wi-fullview-head">
                <div class="sp-wi-fullview-title">
                    <div class="sp-wi-fullview-source">${escapeHtml(entry.source)}</div>
                    <div class="sp-wi-fullview-label">${escapeHtml(entry.label)}</div>
                </div>
                <button class="sp-icon-btn sp-wi-fullview-close" title="关闭"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="sp-wi-fullview-body">${escapeHtml(entry.content || '').replace(/\n/g, '<br>')}</div>
        </div>
    </div>`);
    $overlay.on('click', function (e) {
        if (e.target === this) $overlay.remove();
    });
    $overlay.find('.sp-wi-fullview-close').on('click', () => $overlay.remove());
    $in('.sp-sheet').append($overlay);
}

function toggleKeyVisibility() {
    const $el = $in('#sp-cfg-key'), $icon = $in('#sp-key-toggle i');
    if ($el.attr('type') === 'password') {
        $el.attr('type', 'text').val($el.data('real') || $el.val());
        $icon.removeClass('fa-eye').addClass('fa-eye-slash');
    } else {
        const r = $el.val(); $el.data('real', r).attr('type', 'password').val(maskKey(r));
        $icon.removeClass('fa-eye-slash').addClass('fa-eye');
    }
}

function applyTheme(theme) {
    currentTheme = theme;
    const forced = (getSettings().themeMode || 'auto') !== 'auto';
    paintThemeClasses({
        theme,
        forced,
        nodes: [$(`#${MODAL_ID}`), $(`#${FAB_ID} .sp-fab-btn`), $('#sp-toast-wrap')],
        wrapper: _spShadow?.querySelector('.sp-root'),
    });
    syncVectorGlyphTheme(document, theme, forced);
    coordinateRuntime?.feature?.onThemeChanged?.(theme);
}

function cycleThemeMode() {
    getSettings().themeMode = nextThemeMode(getSettings().themeMode || 'auto');
    saveSettingsDebounced();
    applyTheme(getEffectiveTheme());
    const $btn = $in('.sp-theme-toggle-btn');
    $btn.attr('title', themeToggleTitle());
    $btn.find('i').attr('class', `fa-solid ${themeToggleIcon()}`);
}

// ─── Toast (top) ──────────────────────────────────────────────────────────────
// 批次4决议：toast 暂留 light DOM，不迁 shadow。
// 理由：sp-toast 类 + text-shadow 清零已免疫大部分 ST 污染；有 zmer-toast-theme-loader
// 插件接管分支（见 showToast），动了易踩第三方；toast 是短命元素，受污染面最小。
// TODO(批次5+)：若用户反馈污染再迁——injectToastContainer 的
// documentElement.insertAdjacentHTML → _spShadow，showToast 的 $('#sp-toast-wrap') → $in，
// 并复核 zmer 插件分支。

function injectToastContainer() {
    // 带上主题类：#sp-toast-wrap 挂在 <html> 下、在 .sp-root 之外，拿不到 .sp-night/.sp-day
    // 作用域里的 --sp-*-legacy 令牌。双层背景的不透明底板 var(--sp-surface-legacy) 会落空→透底。
    // 加 sp-${theme} 把 legacy 令牌带进作用域（applyTheme 会随主题切换更新）。
    const nav = globalThis.navigator;
    const userAgent = nav?.userAgent || '';
    const isIos = /iphone|ipad|ipod/i.test(userAgent)
        || ((nav?.maxTouchPoints || 0) > 1 && (nav?.platform === 'MacIntel' || /Macintosh/i.test(userAgent)));
    const tauriIosAttr = globalThis.__TAURITAVERN__?.abiVersion >= 1 && isIos ? ' data-sp-tauritavern-ios' : '';
    if (!$('#sp-toast-wrap').length) document.documentElement.insertAdjacentHTML('beforeend', `<div id="sp-toast-wrap" class="sp-${currentTheme}"${tauriIosAttr}></div>`);
}

function showToast(msg, onClick, isError = false) {
    // 失败 toast 停留更久：失败需要用户处置（查 API/网络/重试），4 秒对不盯屏的用户太短、易错过；
    // 成功仍 4 秒。（用户反馈：生成失败常没留意到，正是因为告警一闪而过。）
    const holdMs = isError ? 10000 : 4000;
    // 若装了「酒馆提示框美化 (zmer-toast-theme-loader)」插件，改走原生 toastr，
    // 让它的 MutationObserver 捕获 #toast-container 里的 toast 并统一美化风格。
    // 探测其 init 时无条件挂上的全局清理钩子——与任何 UI 开关无关，最稳；
    // 探测失败（未装/改版/换名）则无害回退到下方自绘 toast。
    const tr = globalThis.toastr;
    if (globalThis.__zmerUniversalToastThemeCleanup && tr) {
        // 视觉参数交给美化插件统一；但失败破例覆盖 timeOut，保证告警停留够久（可靠性 > 风格统一）。
        const opts = onClick ? { onclick: onClick } : {};
        if (isError) { opts.timeOut = holdMs; opts.extendedTimeOut = holdMs; }
        (isError ? tr.error : tr.success)(msg, '', opts);
        return;
    }
    const $t = $(`<div class="sp-toast${isError ? ' sp-toast-error' : ''}">
        <i class="fa-solid ${isError ? 'fa-circle-exclamation' : 'fa-calendar-check'}"></i>
        <span>${escapeHtml(msg)}</span>
    </div>`);
    $('#sp-toast-wrap').append($t);
    requestAnimationFrame(() => $t.addClass('sp-toast-show'));
    if (onClick) $t.css('cursor', 'pointer').on('click', () => { onClick(); $t.remove(); });
    else if (isError) $t.css('cursor', 'pointer').on('click', () => { $t.removeClass('sp-toast-show'); setTimeout(() => $t.remove(), 350); });   // 失败 toast 停留久，允许点掉提前消失，免堆叠挡视线
    setTimeout(() => { $t.removeClass('sp-toast-show'); setTimeout(() => $t.remove(), 350); }, holdMs);
}

// 点行内 actions 已迁入 business/point/actions.js；这里仅保留薄事件转发。
const triggerTogglePointPin = (...args) => pointActions.togglePin(...args);
const triggerDeletePointEvent = (...args) => pointActions.deleteEvent(...args);

// 聊天输入框随内容自增高：先归零再按 scrollHeight 撑，CSS 用 max-height 封顶后转滚动条。
// 清空发送后也调一次即可缩回单行。
