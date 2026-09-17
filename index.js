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
import { THEATER_COUNT_DEFAULT, THEATER_EXPORT_BOOK } from './business/theater/constants.js';
import {
    createTheaterHost,
    readTheaterSnapshotContext,
    saveTheaterSnapshotToCoordinate,
    theaterParticipantNames,
    theaterSettingsSlice,
} from './business/theater/host.js';
import { refreshFoldHtml } from './business/refresh/bar.js';
import { collectPaceRows, paceStripHtml } from './business/refresh/pace.js';
import { createFloorJobQueue } from './business/refresh/floor-queue.js';
import { createPaceBook } from './business/refresh/pace-book.js';
import { createSameFloorGate } from './business/refresh/same-floor.js';
import { createRefreshController, latestAiFloor } from './business/refresh/controller.js';
import { createFloorAutomationRerunner } from './business/refresh/reroll.js';
import { createAdvanceQueue } from './business/refresh/advance-queue.js';
import { createActivityFeature } from './business/activity/feature.js';
import { activityClockLabel } from './business/activity/ui.js';
import { createActivityChatStorage } from './business/activity/store.js';
import { jumpViewOf, revealActivityTarget } from './business/activity/jump.js';
import { beatFoldHtml } from './business/beat/ui.js';
import { createBeatFeature } from './business/beat/feature.js';
import { createBeatContextCollector } from './business/beat/context.js';
import { createCoordinateRuntime, getCoordinateRuntime } from './business/coordinate/runtime.js';
import { enterCoordinateSidebar } from './business/coordinate/ui.js';
import { createSlipFeature } from './business/slip/feature.js';
import { enterSlipSidebar } from './business/slip/ui.js';
import { createLawFeature } from './business/law/feature.js';
import { enterLawSidebar } from './business/law/ui.js';
import { enterStageSidebar } from './business/stage/feature.js';
import { createStageHost } from './business/stage/host.js';
import { createLampFeature, enterLampSidebar } from './business/lamp/feature.js';
import { createLampHost } from './business/lamp/host.js';
import { intentFromGuide } from './business/lamp/intent.js';
import { paintScheduleHome, showPanelView, tabNavigationTarget } from './business/shell/panel.js';
import { panelMarkup } from './business/shell/markup.js';
import { FAB_ID, MODAL_ID } from './business/shell/ids.js';
import { createFab } from './business/shell/fab.js';
import { detectSTTheme, getEffectiveTheme as resolveTheme, nextThemeMode, paintThemeClasses, themeToggleIcon as themeIconOf, themeToggleTitle as themeTitleOf } from './business/shell/theme.js';
import {
    createUiFontController,
    parseFontFamilyFromCss,
    SP_FONT_DEFAULT_FAMILY,
    SP_FONT_DEFAULT_URL,
} from './business/shell/font.js';
import { handlePanelViewClick } from './business/shell/view-switch.js';
import { createPanelWindow, runOpenSchedule } from './business/shell/window.js';
import { createTaDrawer, guessCharName } from './business/shell/ta-drawer.js';
import { bindModuleIntro, bindPanelChrome } from './business/shell/chrome.js';
import { MODULE_INTROS } from './business/shell/module-intros.js';
import { mountPluginHosts } from './business/shell/hosts.js';
import { createPanelHost } from './business/shell/panel-host.js';
import { bindRefreshBar } from './business/refresh/bind.js';
import { bindAlmanacPanel } from './business/axis/bind.js';
import { bindLinesPanel } from './business/lines/bind.js';
import { bindInjectAndJump, bindPointPanel } from './business/point/bind.js';
import { bindAdultReveal } from './business/utils/adult-reveal.js';
import { bindActionMenuDismiss, bindManualActionMenus, closeOpenActionMenus } from './business/utils/action-menu.js';
import { bindSettingsPanel } from './runtime/settings-bind.js';
import { bindApiFields, bindDiagnostics } from './runtime/api-fields-bind.js';
import { createModelListHost } from './runtime/model-list-host.js';
import { createDebugPayload } from './runtime/debug-payload.js';
import { createPaceHost } from './business/refresh/pace-host.js';
import { bindMemorySettings } from './business/memory/settings-bind.js';
import { bindTheaterSettings } from './business/theater/settings-bind.js';
import { bindStoragePanel, migrationProgressCopy, paintStorageMode, paintStorageUsage, readStorageChatIdentity } from './runtime/storage-panel.js';
import { runChatChanged } from './runtime/chat-changed.js';
import { createPluginLifecycle } from './runtime/plugin-lifecycle.js';
import { createApiPresetUi } from './runtime/api-presets-ui.js';
import { bindChatFloorListeners } from './runtime/st-listeners.js';
import { captureSnapshotElement } from './business/coordinate/capture.js';
import * as store from './store.js';
import { bindStoreViewFallback, keyDesc, readStore, writeStore, writeStoreConfirmed, writeStoreBatchConfirmed, removeStore } from './store.js';
import * as ledger from './business/ledger/repository.js';
import { createBestEffortMetadataSaver, createTargetMetadataSaver, dispatchTargetMetadataWithRefresh } from './runtime/target-metadata-save.js';
import * as theaterDeviceCache from './runtime/theater-device-cache.js';
import { selectVisibleChatHistory } from './business/lines/history.js';
import * as snapshot from './snapshot.js';
import { createDialogManager } from './modal.js';
import { PLUGIN_VERSION } from './version.js';
import { createAutomationGate } from './automation-gate.js';
import { createDateCoordinator } from './date-coordinator.js';
import {
    didStepComplete,
    formatTravelDate,
    snapshotLastAssistant,
    removeTimeTravelBlocks,
} from './time-travel.js';
import {
    appendTravelPromptContext,
    travelAlignReason,
} from './business/axis/time-travel-session.js';
import { createTimeTravelHost } from './business/axis/time-travel-host.js';
import { createTimeTravelDestinationResolver } from './business/axis/time-travel-destination.js';
import { escapeHtml, escapeAttr, autoGrowTextarea, cleanText } from './utils/dom.js';
import { _cnToNumber, _CN_MONTH_ALIAS, extractDayFromTime } from './utils/cn-date.js';
import { weatherGlyph, maskKey } from './utils/format.js';
import { getSettings, parseExcludeParams, loadCfg, loadUtilityCfg, saveCfg, loadApiPresets, upsertApiPreset, deleteApiPreset, renameApiPreset, fabEnabled, pluginEnabled, injectEnabled, getLinesInterval, saveLinesInterval, getLinesMode, saveLinesMode, getLedgerReconcileInterval } from './runtime/settings.js';
import { postChatCompletion, callCustomApi, callMemoryApi, callTheaterApi, bindApiClient, GEN_TEMPERATURE } from './api/client.js';
import { normalizeApiUrl } from './api/sse.js';
import { safeDiagnosticLog, diagnosticMessage, makeDiagnosticError, shouldNotifyGeneration, classifyGenerationError } from './api/diagnostics.js';
import { readDiagnosticTrace, recordChatBoundary, traceDiagnosticEvent } from './runtime/diagnostic-trace.js';
import { createDiagnosticPackHost } from './runtime/diagnostic-pack-host.js';
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
import { createGouhuaBackupController as assembleGouhuaBackupController } from './runtime/backup-host.js';
import { formatAiMessageHtml } from './runtime/ai-message-html.js';
import { isManagedChatSurface, markTauriMobileSurface, registerChatSurfaceParticipant } from './runtime/chat-surface.js';
import { createChatSurfaceParticipantHooks } from './runtime/chat-surface-participant.js';
import { migrateCanonicalBookIds } from './runtime/book-id-migrate.js';
import { createInlineHost } from './runtime/inline-host.js';
import { backupExportWarnings, parseBackupText, summarizeBackup } from './runtime/backup.js';
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
    readAxisHistoryStore,
    almTypeMeta,
    almDateLabel,
    monthDayFromDayKey,
    almValidMonthDay,
    ALM_CHAT_SCAN_LIMIT,
    almDayOfYear,
    ALM_WEEKDAYS,
    weekdayAdjacentDate,
    validRealDate,
    calRealWeekdayRef,
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
import {
    bindAxisAnchor,
    almTodayAnchor, almTodayAnchorEvidence, almStoryYear, almDaysUntil, almDaysBetweenFull, almWeekdayRef, almWeekdayFor, sortAlmanacUpcoming,
} from './business/axis/anchor.js';
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
import { createAnchorAftermath } from './business/axis/aftermath.js';
import { createAxisCalendarActions } from './business/axis/calendar-actions.js';
import { createAxisGenerationController, validateAlmanacResponse } from './business/axis/generation.js';
import { createAxisInlineRenderer } from './business/axis/inline.js';
import { createInlineFeature } from './business/inline/feature.js';
import { createAxisWidgetActions } from './business/axis/widget.js';
import { createAxisTransactionController } from './business/axis/transaction.js';
import { createAxisPromptBuilder } from './business/axis/prompts.js';
import { createAxisDateContext } from './business/axis/date-context.js';
import {
    baiBaiBookGarnishBlock,
    createGenerationMessagesHost,
    readCardExtras,
} from './runtime/generation-messages.js';
import { createChatBoundaryGate } from './runtime/generation-context.js';
import { mountBackupOverlay as createBackupOverlay, mountMigrationOverlay as createMigrationOverlay } from './runtime/storage-overlay.js';
import { bindStoryClock, parseStoryClock as parseStoryClockPure, parseJudgedDate as parseJudgedDatePure, latestStoryClock as latestStoryClockPure, storyClockDate as storyClockDatePure, storyWeekdayRef as storyWeekdayRefPure, completeStoryClock as completeStoryClockPure, storyClockNarrativeBody, buildStoryClockPrompt, STORY_CLOCK_KEY, createStoryClockController, extensionStoryClockState } from './business/axis/story-clock.js';
import { createStoryClockFillHost } from './business/axis/story-clock-fill.js';
import { createWeekdayConsumerContext } from './business/axis/weekday-coordinator.js';
import { createDateDetectionHost } from './business/axis/date-detection-host.js';

bindExternalChatStorage({ getContext, coreModule: scriptCore, fetchImpl: (...args) => globalThis.fetch(...args) });

// Must be initialized before the top-level bindAxisAnchor() wiring below.
// Keeping this as a const preserves the shared terminal-stage semantics while
// avoiding a temporal-dead-zone read during module evaluation.
const TERMINAL_STAGES = TERMINAL_LINE_STAGES;

import { pointState } from './business/point/state.js';
import { formatPointDayDate } from './business/point/event-when.js';
import { parseCalendar, serializeCalendar, validateGeneratedCalendar, bindPointAdultTickets, parsePointEventRecord, firstPointEventBlock, replacePointEventBlock, buildPointInjectText, numberedPointList, mergePinnedPoints, forceStartDate } from './business/point/parse.js';
import { createBootstrapFeature } from './business/bootstrap/feature.js';
import { automationAllowed, booksAreEmpty } from './business/bootstrap/queue.js';
import { historyToolbarState } from './business/history/dialog.js';
import { createHistoryHost } from './business/history/host.js';
import { axisAdapter, ledgerAdapter } from './business/history/versions.js';
import { emptyLinesHtml, emptyOutlineHtml, emptyPointHtml, openRefreshFold } from './business/bootstrap/ui.js';
import { isGregorian as isGregorianCalendar, addCalendarDays } from './business/calendar/date.js';
import { buildPrompt, buildHorizonFillPrompt } from './business/point/prompt.js';
import { bindPointRender, renderSchedule, scheduleDayCtx, scheduleDayLabel, TYPE_META } from './business/point/render.js';
import { togglePointPinRaw, deletePointEventRaw, editPointDescription, editPointFields, movePointEvent } from './business/point/mutations.js';
import { bindPointRepository, getScheduleKey, loadCachedSchedule, refreshCachedSchedule } from './business/point/repository.js';
import { createPointActions } from './business/point/actions.js';
import { createPointWidgetActions } from './business/point/widget.js';
import { createPointController } from './business/point/controller.js';
import { appendHorizonDays, planAdvanceSteps } from './business/point/horizon.js';
import { createPointInlineRenderer } from './business/point/inline.js';
import { pointTicketPlan } from './business/point/adult.js';
import { shiftPointCalendar } from './business/point/shift.js';
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
import { baiBaiBookCoverage, baiBaiBookStatusHtml, readBaiBaiBookGarnish, usesBaiBaiBook } from './business/memory/baibaoshu.js';
import { createMemoryInjectHost } from './business/memory/inject-host.js';
import { createTaskOwnerManager } from './runtime/task-owner.js';
import { evaluateTaskLifecycle } from './runtime/task-orchestration.js';
import { parseLines, TERMINAL_LINE_STAGES } from './business/lines/schema.js';
import { buildLinesPrompt } from './business/lines/prompt.js';
import { advanceCatchupNeeded, createAdvanceStrategy, dayCrossedSincePreviousFloor, latestStampDay, activeLines } from './business/lines/strategy.js';
import { createLinesFeature } from './business/lines/feature.js';
import { syncVectorGlyphTheme } from './business/lines/vectors/glyph.js';
import { createOutlineFeature } from './business/outline/feature.js';
import { createSpaceFeature } from './business/space/feature.js';
import { getSpaceChatPlaceholder } from './business/space/prompts.js';
import { createChatAnchorRepository } from './runtime/chat-date-anchor.js';
import { createDateAnchorPolicy } from './runtime/date-anchor-policy.js';
import { createWorldInfoHost } from './runtime/world-info-host.js';
import {
    dispatchStoreClearInvalidate,
    dispatchStoreClearRefreshAfter,
    dispatchStoreClearRefreshFromStore,
} from './runtime/storage-clear.js';
import { createStoreClearHost } from './runtime/store-clear-host.js';

// 坐标与楼内框各自持有唯一 runtime 句柄。
let coordinateRuntime = null;
const inlineHost = createInlineHost({
    getChatId: () => getContext().chatId,
    refreshLinesInjection: () => refreshLinesInjection(),
    refreshStoryClockInjection: () => refreshStoryClockInjection(),
    refreshLedgerInjection: () => refreshLedgerInjection(),
    onChatDomChanged: () => coordinateRuntime?.feature?.onChatDomChanged(),
    isStreaming: () => linesFeature?.isStreaming?.(),
    scheduleRetry: (fn, ms) => setTimeout(fn, ms),
});

// TauriTavern 打开聊天虚拟化后，投影变化不会伪造 CHARACTER_MESSAGE_RENDERED。
// 必须在第一次 projection 前注册；第三方扩展常常赶不上，失败则退回 DOM 观察。
const chatSurfaceRegistration = registerChatSurfaceParticipant(createChatSurfaceParticipantHooks({
    getInlineHost: () => inlineHost,
    getCoordinate: () => coordinateRuntime?.feature,
}));
const chatSurfaceOwnsDom = Boolean(chatSurfaceRegistration && isManagedChatSurface());

function refreshInlineWindow(immediate = false) { return inlineHost.refresh(immediate); }
function _clearAllInlineBoxes() { return inlineHost.clear(); }
function syncLatestAlmanacBlock(expectedChatId = null) { return inlineHost.syncLatest(expectedChatId); }
const syncLatestScheduleBlock = syncLatestAlmanacBlock;
function syncLatestInlineBlock(expectedChatId = null) { return inlineHost.syncLines(expectedChatId); }
async function backfillLinesInlineBlocks() { return inlineHost.backfill(); }
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
const chatBoundary = createChatBoundaryGate({
    getContext,
    charStableKey,
    floorSignature: mid => _floorSig(mid),
    floorKey: mid => buildDateRenderKey(mid),
});
function captureParticipantIdentity(ctx) { return chatBoundary.captureParticipantIdentity(ctx); }
function sameParticipantIdentity(left, right) { return chatBoundary.sameParticipantIdentity(left, right); }
function captureGenerationContext(ctx) { return chatBoundary.captureGenerationContext(ctx); }
function captureChatBoundary() { return chatBoundary.captureChatBoundary(); }
function isCurrentChatBoundary(boundary) { return chatBoundary.isCurrentChatBoundary(boundary); }
function scheduleForChatBoundary(callback, delay) { return chatBoundary.scheduleForChatBoundary(callback, delay); }
function consumeDateBootstrap(messageId) { return chatBoundary.consumeDateBootstrap(messageId); }
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
let theaterFeature;
let memoryPauseNoticeShown = false;
function createTheaterHostFeature() {
    return createTheaterHost({
        storage: globalThis.localStorage, coreModule: scriptCore, getContext, callTheaterApi,
        buildWorldInfoContext: (ctx, opts) => buildWorldInfoContext(ctx, opts), readCardExtras: ctx => readCardExtras(ctx), getMemText: () => getMemText(),
        names: () => theaterParticipantNames(getContext()),
        settings: () => theaterSettingsSlice(getSettings()),
        onDiagnostic: diagnostic => { console.warn('[SP theater]', diagnostic); if (getSettings().notifyMode === 'full') showToast('棱生成时有可恢复错误，已尽量保留结果', null, true); },
        stage: text => { if (theaterMode) setTheaterBody(loadingHtml(`正在${text}`, 'sp-abort-theater')); }, renderAiMessageHtml,
        downloadJson: downloadJsonFile,
        ports: { $, $in, inEl, documentRef: globalThis.document, getContext, theaterMode: () => theaterMode, modalId: () => MODAL_ID, setBody: html => setTheaterBody(html), loading: loadingHtml, escapeHtml, escapeAttr, settings: getSettings, saveSettingsDebounced, showToast, showPanel, spConfirm, promptTextarea: options => customDialog.promptTextarea(options), scriptCore },
        listWorldNames: () => getAllWorldNames(getContext()),
        syncSettingsPoolList: () => { void renderTheaterPoolList(); },
        snapshotContext: () => readTheaterSnapshotContext(getContext() || {}, globalThis.document),
        saveSnapshot: item => saveTheaterSnapshotToCoordinate(item, getCoordinateRuntime),
    });
}

// Shadow-DOM accessors are dependencies of the top-level DI wiring below.
// Declare them before any bind/create call can evaluate the dependency.
let _spShadow = null;
let _spDialogShadow = null;
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

const worldInfo = createWorldInfoHost({
    getContext,
    settings: getSettings,
    saveSettingsDebounced,
    charStableKey,
    getCharaFilename,
    worldInfoCore,
    tavernHelper: () => globalThis.TavernHelper,
    vanillaWorldInfo: () => globalThis.world_info,
    equals: equalsIgnoreCaseAndAccents,
    getMaxPromptTokens: (...args) => scriptCore.getMaxPromptTokens?.(...args),
    $, $in, $inAll,
    escapeAttr,
    diagnosticMessage,
    showToast,
    logWarn: (message, error) => console.warn(message, safeDiagnosticLog('world-info', 'activation', error)),
    logActivationFailure: payload => console.warn('[构画] 世界书激活失败诊断', { ...safeDiagnosticLog('world-info', 'activation', null), ...payload }),
});
function buildWorldInfoContext(ctx, opts) { return worldInfo.buildWorldInfoContext(ctx, opts); }
function getAllWorldNames(ctx) { return worldInfo.getAllWorldNames(ctx); }
function renderWiList() { return worldInfo.renderList(); }
function renderWiExcludeList() { return worldInfo.renderExcludeList(); }

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
    addCalendarDays,
    monthCount: calMonthCount,
    monthDays: calMonthDays,
    pending: () => chatAnchorRepository.pending(),
    weekday: (month, day, ref, cal) => almWeekdayFor(month, day, ref, cal),
    floor: () => latestStoryOwnerIdentity().floor,
    chatId: () => latestStoryOwnerIdentity().chatId,
    swipe: () => latestStoryOwnerIdentity().swipe,
    confirm: spConfirm,
    aftermath: () => runAnchorAftermath('manual-axis', { dayChanged: true }),
    monthName: (cal, month) => calMonthName(cal, month),
    toast: showToast,
});
const dateAnchorPolicy = createDateAnchorPolicy({
    repository: chatAnchorRepository,
    calendar: loadCalDesc,
    storyClock: () => latestStoryClockPure(getContext(), ALM_CHAT_SCAN_LIMIT),
    completeStoryClock: completeStoryClockPure,
    monthCount: calMonthCount,
    monthDays: calMonthDays,
    saveAnchor: (charKey, month, day, source, options) => axisDateActions.saveAnchor(charKey, month, day, source, options),
});
function getDateAnchor(charKey) { return dateAnchorPolicy.getDateAnchor(charKey); }
function getStoryCalibration(charKey) { return dateAnchorPolicy.getStoryCalibration(charKey); }
function setDateAnchor(charKey, month, day, source, options) { return dateAnchorPolicy.setDateAnchor(charKey, month, day, source, options); }

// 绑定 API 网络层所需的 UI/业务回调（避免 api/client.js 反向依赖 index.js 造成循环引用）。
bindApiClient({
    setFabBusy,
    setLastDebugPayload: (v) => debugPayload.set(v),
    buildMessages: (...args) => generationMessages.buildMessages(...args),
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
            boundaryEpoch: chatBoundary.epoch(),
            floor: messageId,
            messageId,
        };
    },
});

// 点渲染回调注入：render.js 的点日期上下文、标签与辅助渲染函数需访问本文件的
// almTodayAnchor/almWeekdayRef/almWeekdayFor/makeInjectBtn，经 bindPointRender 注入以避免反向依赖（循环引用）。
bindPointRender({
    almTodayAnchor, almWeekdayRef, almWeekdayFor, makeInjectBtn, settings: getSettings,
    chatId: () => getContext().chatId,
    readPointStore: () => readStore(getCacheKey(currentView, charViewName)) || {},
});
bindPointRepository({ keyDesc, readStore, renderSchedule, loadCalendar: loadCalDesc });
const pointActions = createPointActions({
    inShadow: $inAll,
    $,
    getCacheKey: (...args) => getCacheKey(...args),
    readStore,
    writeStore,
    writeStoreConfirmed,
    logError: (...args) => console.error(...args),
    renderSchedule,
    loadCalendar: loadCalDesc,
    parseCalendar,
    togglePointPinRaw,
    deletePointEventRaw,
    rollToToday: shiftPointCalendar,
    movePointEvent,
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
    today: almTodayAnchor,
    fillAfterRoll: () => pointController.fillHorizon(false),
    onActivity: entry => activityFeature.record(entry),
});
const applyPointWidget = createPointWidgetActions({
    firstPointEventBlock,
    parsePointEventRecord,
    getCacheKey: (...args) => getCacheKey(...args),
    readStore,
    writeStore,
    replaceNthEventLine: replacePointEventBlock,
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
    appendHorizon: (existing, fill, calendar) => appendHorizonDays(existing, fill, calendar),
    recordFill: payload => activityFeature.record(payload),
    render: renderSchedule,
    sync: syncLatestScheduleBlock,
    refreshStoryClock: () => refreshStoryClockInjection({ announce: true }),
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
    today: almTodayAnchor,
});
const parseJudgedDate = parseJudgedDatePure;
function readFloorStory(raw) {
    const settings = getSettings();
    return memory.extractStoryText(raw, { keepTags: settings.keepTags, extraTags: settings.extraTags });
}

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
    stripTags: (text) => memory.extractStoryText(text, { keepTags: getSettings().keepTags, extraTags: getSettings().extraTags }),
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
    captureState: () => ledger.getCaptureState(),
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
const runLedgerCaptureStep = async (manual = false, travelContext = null) => {
    const floorId = Number(travelContext?.automationFloor);
    const latest = latestAiFloor(getContext()?.chat)?.index;
    const trackedFloor = Number.isInteger(floorId) ? floorId : (manual && Number.isInteger(latest) ? latest : null);
    const before = ledger.snapshotLedgerState();
    const result = await ledgerCaptureController.run(manual, travelContext);
    const after = ledger.snapshotLedgerState();
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    activityFeature.record({
        source: 'ledger-capture',
        floorId: trackedFloor,
        cause: travelContext?.reroll ? 'reroll' : manual ? 'manual' : 'auto',
        outcome: result?.status === 'failed' ? 'failed' : changed ? 'updated' : 'unchanged',
        reasonCode: result?.reason || '',
        note: result?.status === 'failed'
            ? '刻度标注失败。可在【改】里重试，或去刻度页再跑一次。'
            : changed ? '' : '本轮刻度标注没有改动',
        error: result?.status === 'failed' ? String(result?.error?.message || result?.error || result?.reason || '刻度标注失败').slice(0, 200) : '',
        items: changed ? [{ module: 'ledger', title: manual ? '手动更新刻度标注' : '按本楼正文更新刻度标注', action: 'edit' }] : [],
        snapshot: changed ? { ledger: before } : null,
        after: changed ? { ledger: after } : null,
    });
    return result;
};
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
    stripTags: text => memory.extractStoryText(text, { keepTags: getSettings().keepTags, extraTags: getSettings().extraTags }),
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
    addCalendarDays,
    bridge: bridgeAbortSignal,
    setFabBusy,
    settings: getSettings,
    toast: showToast,
    refreshInject: refreshLedgerInjection,
    refreshInline: refreshInlineWindow,
    render: () => { if (axisState.almanacMode && axisState._almanacSheet === 'ledger') renderAlmanacPanel(); },
});
const runLedgerJudgeStep = async (manual = false, travelContext = null) => {
    const floorId = Number(travelContext?.automationFloor);
    const latest = latestAiFloor(getContext()?.chat)?.index;
    const trackedFloor = Number.isInteger(floorId) ? floorId : (manual && Number.isInteger(latest) ? latest : null);
    const before = ledger.snapshotLedgerState();
    const result = await ledgerJudgeController.run(manual, travelContext);
    const after = ledger.snapshotLedgerState();
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    activityFeature.record({
        source: 'ledger-judge',
        floorId: trackedFloor,
        cause: travelContext?.reroll ? 'reroll' : manual ? 'manual' : 'auto',
        outcome: result?.status === 'failed' ? 'failed' : changed ? 'updated' : 'unchanged',
        reasonCode: result?.reason || '',
        note: result?.status === 'failed'
            ? '刻度现状失败。可在【改】里重试，或去刻度页再跑一次。'
            : changed ? '' : '本轮刻度现状没有改动',
        error: result?.status === 'failed' ? String(result?.error?.message || result?.error || result?.reason || '刻度现状失败').slice(0, 200) : '',
        items: changed ? [{ module: 'ledger', title: manual ? '手动更新刻度现状' : '按本楼正文更新刻度现状', action: 'edit' }] : [],
        snapshot: changed ? { ledger: before } : null,
        after: changed ? { ledger: after } : null,
    });
    return result;
};
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

const almToolbarHtml = () => renderAxisToolbar(actionMenuHtml, {
    axis: historyToolbarState({
        hasChat: !!getContext().chatId,
        busy: axisState.isGeneratingAlmanac,
        store: readAxisHistoryStore(),
        adapter: axisAdapter,
    }),
    ledger: historyToolbarState({
        hasChat: !!getContext().chatId,
        busy: ledgerCaptureController.isBusy || ledgerJudgeController.isBusy,
        store: ledger.snapshotLedgerState(),
        adapter: ledgerAdapter,
    }),
});
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
    notify: (message, generated, meta = {}) => {
        if (!generated && meta.autoEmpty && (getSettings().notifyMode || 'lite') === 'lite') return;
        if (generated) { if (axisState.almanacMode) { if (getSettings().notifyMode !== 'off') showToast(message); } else showToast(message, () => { $in('.sp-view-btn[data-view="almanac"]').trigger('click'); showPanel(); }); } else if (getSettings().notifyMode !== 'off') showToast(message);
    },
    onActivity: entry => activityFeature.record(entry),
    latestFloor: () => (getContext()?.chat?.length || 0) - 1,
    error: (error, supplement) => showToast(`${supplement ? '补录失败：' : '轴生成失败：'}${diagnosticMessage(error)}`, null, true),
    missingApi: () => { if (!settingsOpen) toggleSettings(); showToast('请先在设置中填写自定义 API', null, true); },
    missingChat: () => showToast('请先打开一个聊天', null, true),
    confirm: () => spConfirm({ title: '重新生成节日', body: '将按当前世界观重新铺一整年的既定日期。已锁定的条目和你手动添加的日期会保留，未锁定的 AI 条目会被替换。', confirmText: '生成', cancelText: '取消' }),
    captureParticipantIdentity,
    sameParticipantIdentity,
});
const axisTransactionController = createAxisTransactionController({
    chatId: () => getContext().chatId, items: loadAlmanac, conflicts: calendarConflicts, charKey: () => charStableKey(getContext()), anchor: key => getSettings().dateAnchor?.[key],
    monthCount: cal => calMonthCount(cal), monthDays: (cal, month) => calMonthDays(cal, month), choose: options => customDialog.choose(options),
    writeConfirmed: writeStoreConfirmed,
    getCalDescKey,
    getAlmanacKey,
    setAnchor: (_key, month, day, source = 'explicit', options = {}, persistenceOptions = {}) => (
        month == null
            ? chatAnchorRepository.clearConfirmed(persistenceOptions)
            : chatAnchorRepository.setConfirmed(month, day, source, options, persistenceOptions)
    ),
    syncAlmanac: syncLatestAlmanacBlock, syncSchedule: syncLatestScheduleBlock, pluginEnabled, readCal: () => readStore(getCalDescKey()), readAlmanac: () => readStore(getAlmanacKey()), readItems: () => readStore(getAlmanacKey())?.items,
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
const AUTOMATION_MODULES = Object.freeze({ LINES: 'lines', OUTLINE: 'outline', POINT: 'point', AXIS: 'axis', LEDGER_CAPTURE: 'ledger-capture', LEDGER_JUDGE: 'ledger-judge' });
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
    realWeekdayRef: (text, cal) => calRealWeekdayRef(text, cal),
    storyTimeText: () => {
        try { return String(globalThis.STBaiBaiBook?.getSnapshot?.()?.state?.time || ''); }
        catch { return ''; }
    },
    context: getContext,
    dayOfYear: almDayOfYear,
});
const storyClockController = createStoryClockController({
    context: getContext,
    pluginEnabled,
    enabled: () => getSettings().storyClockEnabled !== false && !booksAreEmpty(readBooksFlags()),
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
const dateDetection = createDateDetectionHost({
    captureGenerationContext,
    charStableKey,
    getContext,
    config: loadUtilityCfg,
    storyEnabled: storyClockEnabled,
    storyDate: storyClockDate,
    storyClock: latestStoryClock,
    completeStoryClock: completeStoryClockPure,
    identity: latestStoryOwnerIdentity,
    getCalibration: getStoryCalibration,
    calendarInjectText: getCalDescInjectText,
    callApi: callCustomApi,
    parse: parseJudgedDatePure,
    bridge: bridgeAbortSignal,
    getAnchor: getDateAnchor,
    setAnchor: setDateAnchor,
    setAnchorConfirmed: (month, day, source, anchorOptions, persistenceOptions) =>
        chatAnchorRepository.setConfirmed(month, day, source, anchorOptions, persistenceOptions),
    settings: getSettings,
    loadCalendar: loadCalDesc,
    monthName: calMonthName,
    toast: showToast,
    aftermath: runAnchorAftermath,
    captureParticipantIdentity,
    sameParticipantIdentity,
});
const dateDetectionController = dateDetection.controller;
const applyDetectedDate = (charKey, md, options) => dateDetection.applyDetectedDate(charKey, md, options);
const relandStoryClockAnchor = options => dateDetection.reland(options);
const runJudgeDateStep = options => dateDetection.run(options);
const timeTravelDestination = createTimeTravelDestinationResolver({
    calendar: loadCalDesc,
    validMonthDay: almValidMonthDay,
    getChatId: () => getContext().chatId,
    getChat: () => getContext().chat,
    parseClock: parseStoryClockPure,
    parseJudgedDate,
    renderKey: buildDateRenderKey,
    charKey: () => charStableKey(getContext()),
    applyDetectedDate: (charKey, date, options) => applyDetectedDate(charKey, date, options),
    recordResult: (key, result) => dateCoordinator.recordResult(key, result),
    autoDetect: () => getSettings().almanacAutoDetect,
    ensureResolved: (key, options) => dateCoordinator.ensureResolved(key, options),
    runJudge: options => runJudgeDateStep(options),
    toast: showToast,
});
const timeTravel = createTimeTravelHost({
    getChatId: () => getContext().chatId,
    getChat: () => getContext().chat,
    getCalendar: () => loadCalDesc(),
    resolveDestinationDate: payload => timeTravelDestination.resolve(payload),
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
    onError: error => {
        console.error('[SP 时光旅行] 同步流程失败', safeDiagnosticLog('time-travel', 'request', error));
        showToast('时光旅行同步未完整完成，请手动检查各模块', null, true);
    },
    steps: [
        { key: AUTOMATION_MODULES.POINT, canRun: () => !!readStore(getCacheKey('user', ''))?.raw, run: ({ destinationDate, promptAddon, signal }) => syncPointToToday(false, { targetDate: destinationDate, targetScope: { view: 'user', charName: '' }, promptAddon, feedback: 'time-travel', signal, allowPendingFollowup: false }) },
        { key: AUTOMATION_MODULES.LINES, canRun: () => {
            if (readStore(getCacheKey('user', ''))?.raw) return true;
            return getSettings().linesEnabled !== false && !!readStore(getLinesCacheKey())?.raw;
        }, run: ({ destinationDate, promptAddon, signal }) => {
            const selected = ['point'];
            if (getSettings().linesEnabled !== false) selected.push('lines');
            return refreshController.align({
                selected,
                reason: travelAlignReason(destinationDate, loadCalDesc(), formatTravelDate),
                feedback: 'time-travel',
                promptAddon,
                signal,
            });
        } },
        { key: AUTOMATION_MODULES.AXIS, canRun: () => true, run: async () => { runAnchorAftermath('time-travel'); return { status: 'updated' }; } },
        { key: AUTOMATION_MODULES.OUTLINE, canRun: () => outlineFeature.canRelocate(), run: ({ promptAddon, signal }) => outlineFeature.relocate(promptAddon, signal) },
        { key: AUTOMATION_MODULES.LEDGER_CAPTURE, canRun: () => getSettings().ledgerCaptureEnabled === true, run: ({ destinationDate, promptAddon, signal }) => runLedgerCaptureStep(true, { targetDate: destinationDate, promptAddon, feedback: 'time-travel', signal }) },
        { key: AUTOMATION_MODULES.LEDGER_JUDGE, canRun: () => getSettings().ledgerCaptureEnabled === true, run: ({ destinationDate, promptAddon, signal }) => runLedgerJudgeStep(true, { targetDate: destinationDate, promptAddon, feedback: 'time-travel', signal }) },
    ],
    automationGate,
    dateCoordinator,
    sourceDate: almTodayAnchor,
    validMonthDay: date => almValidMonthDay(date, loadCalDesc()),
    pluginEnabled,
    toast: showToast,
    confirm: options => customDialog.confirm(options),
    selectOne: options => customDialog.selectOne(options),
    selectOneAsync: options => customDialog.selectOneAsync(options),
    inject: injectToST,
    loadCfg,
    callApi: callCustomApi,
    getContext,
    temperature: GEN_TEMPERATURE,
    weekdayFor: (m, d, ref, cal) => axisDateContext.weekdayFor(m, d, ref, cal),
    weekdayRef: cal => axisDateContext.weekdayRef(cal),
    weekdays: ALM_WEEKDAYS,
    readOutlineSnapshot: () => outlineFeature.readSnapshot(),
    readLines: () => parseLines(readStore(getLinesCacheKey())?.raw || ''),
    terminalStages: TERMINAL_LINE_STAGES,
    injectionOn: injectEnabled,
    settings: getSettings,
    ledgerEchoLength: () => ledgerInjectionController.echo.length,
    almanacItems: loadAlmanac,
    coverageHelpers: () => ({
        dayOfYear: almDayOfYear,
        itemCoversDoy: almItemCoversDoy,
        yearLength: calYearLen,
        clampInt: almClampInt,
        endMonthDay: almEndMonthDay,
    }),
    typeLabel: type => almTypeMeta(type).label,
    abortRelated: abortReason => {
        dateDetectionController.abort(abortReason);
        linesFeature.abortGeneration({ reason: abortReason });
        outlineFeature.judge.abort(abortReason);
        _autoRegenSchedAbort?.abort(abortReason);
        ledgerCaptureController.abort(abortReason);
        ledgerJudgeController.abort(abortReason);
    },
    stripWaitingBlock: () => {
        const input = $('#send_textarea');
        if (input.length) input.val(removeTimeTravelBlocks(String(input.val() || ''))).trigger('input');
    },
    traceAbort: (active, abortReason) => {
        traceDiagnosticEvent('abort-boundary', { module: 'time-travel', chatId: active.chatId, chatRevision: pointTaskOwners.currentChatRevision(), boundaryEpoch: chatBoundary.epoch(), abortReason, status: 'dispatch' });
    },
});

// 自动化闸·会话级 token 登记：CMR 预检抢占（isInitialFloor 才占）→ 流程收尾（完成/失败/取消）经 onSequenceEnd 释放。
function isAutomationSuppressed(messageId, moduleName) {
    return automationGate.isSuppressed({ scopeId: getContext().chatId, messageId, module: moduleName });
}
function clearAutomationClaims() {
    timeTravel.clearClaims();
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

// 扩展目录绝对路径（引自身 style.css 进 shadow）；ST 站点根（引 fontawesome.min.css，
// 与 ST 共用浏览器缓存）。import.meta.url = …/scripts/extensions/third-party/ST-SevenDaysCal/index.js
const EXT_BASE = new URL('.', import.meta.url).href;                 // …/ST-SevenDaysCal/
const ST_BASE  = new URL('../../../../../', import.meta.url).href;   // ST 站点根（public/ 即 /）

const debugPayload = createDebugPayload({
    $in, inEl,
    copyText: (...args) => copyPlainText(...args),
    promptTextarea: options => customDialog.promptTextarea(options),
    notify: (message, isError) => showToast(message, null, isError),
});

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
let _lastMainView      = 'schedule';  // 记住上次打开的模块视图（点/历/线/面/间/棱/坐标/笺/律/日台/对账灯），同 chat 内跨开关面板保留；切 chat 复位成 schedule（第一页），见 CHAT_CHANGED
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
    onPersistenceError: failure => {
        console.error('[SP activity] 改动记录未持久化', failure);
        showToast('改动已执行，但“最近更改”未能保存；刷新页面后记录可能消失', null, true);
    },
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
    readLedger: () => ledger.snapshotLedgerState(),
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
        if (!outlineFeature.repository.commitOutline(target, { raw: String(raw || ''), ts: Date.now(), cursor: cursor ?? 1 })) return false;
        outlineFeature.refreshPanel();
        outlineFeature.injection.refresh();
        return true;
    },
    writeDashed: items => linesFeature.dashed.commit(items),
    writeLedger: async state => {
        const chatId = getContext()?.chatId;
        const result = await ledger.replaceLedgerStateAtomic(state, {
            target: getLedgerTarget(),
            guard: () => getContext()?.chatId === chatId,
        });
        if (result?.ok !== true) throw Object.assign(new Error(result?.reason || 'ledger-restore-failed'), { saveResult: result });
        refreshLedgerInjection();
        return true;
    },
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
    needsAdvanceCatchup,
    fillLatestStamp: () => fillLatestStoryClock(),
    clockLabel: () => activityClockLabel({
        clock: latestStoryClock(),
        today: almTodayAnchor(),
        calendar: loadCalDesc(),
        monthName: (cal, month) => calMonthName(cal, month),
        weekdayFor: almWeekdayFor,
    }),
    realign: opts => refreshController.align({
        auto: opts?.cause === 'reroll' || opts?.cause === 'retry' || opts?.cause === 'auto',
        selected: ['point', 'lines'],
        reason: String(opts?.reason || ''),
        cause: opts?.cause || 'manual',
    }),
    readvance: opts => linesFeature.forceAdvance({
        cause: opts?.cause || 'retry',
        floorId: opts?.floorId,
    }),
    catchUpAdvance: opts => linesFeature.forceAdvance({
        cause: opts?.cause || 'manual',
        floorId: opts?.floorId,
    }),
    alignPointDate: () => pointActions.alignStartDate(),
    rollPointDate: () => pointActions.rollToToday(),
    sendToSpace: async item => {
        if (!item || typeof item !== 'object' || !String(item.quote || '').trim()) return { status: 'failed' };
        spaceFeature.guide?.leave?.();
        spaceFeature.ui?.setQuote?.(item);
        activityFeature.close();
        const ok = await openPluginViewWithPrefill('space');
        spaceFeature.ui?.setQuote?.(item);
        return { status: ok ? 'quoted' : 'failed' };
    },
    openItem: item => openActivityItem(item),
    queueSnapshot: () => floorQueue?.snapshot?.() || null,
    retryQueueJob: id => retryFloorAutomation(id),
    retryBootstrap: () => retryBootstrapGeneration(),
    retryFill: () => pointController.fillHorizon(false),
    retryRefresh: entry => retryRefreshModule(entry),
});
const floorQueue = createFloorJobQueue({
    identityCurrent: (floor) => {
        if (!pluginEnabled() || !floor) return false;
        const ctx = getContext();
        if (String(ctx?.chatId ?? '') !== String(floor.chatId ?? '')) return false;
        if (Number((ctx?.chat?.length || 0) - 1) !== Number(floor.floorId)) return false;
        if (floor.signature && _floorSig(floor.floorId) !== floor.signature) return false;
        return true;
    },
    setBusy: on => setFabBusy(on),
    onChange: () => {
        syncFabFailed();
        paintPaceSoon();
        activityFeature.paint?.();
    },
    onJobFailed: (job, result, snap) => {
        const more = (snap?.queued || []).length ? '；后面的继续' : '';
        showToast(`${job.label}失败，可在【改】里重试${more}`, null, true);
    },
});
let _floorDrainTimer = null;
function scheduleFloorDrain() {
    if (_floorDrainTimer != null) return;
    _floorDrainTimer = setTimeout(() => {
        _floorDrainTimer = null;
        void floorQueue.drain();
    }, 0);
}
function enqueueFloorJob(job) {
    if (!automationAllowed(job?.id, readBooksFlags())) return false;
    const ok = floorQueue.enqueue(job);
    if (ok) scheduleFloorDrain();
    return ok;
}
function beginFloorAutomation(messageId) {
    floorQueue.beginFloor({
        chatId: getContext()?.chatId,
        floorId: Number(messageId),
        signature: _floorSig(messageId),
    });
}
async function retryFloorAutomation(id) {
    const key = String(id || '');
    if (key === 'align' || key === 'align-auto') return activityFeature.realign({ cause: 'retry' });
    if (key === 'advance') return activityFeature.readvance({ cause: 'retry' });
    if (key === 'bootstrap') return retryBootstrapGeneration();
    if (key === 'fill') return pointController.fillHorizon(false);
    if (floorQueue.failed.some(job => job.id === key)) return floorQueue.retry(key);
    if (key === 'supplement') return triggerSupplementAnniversary();
    if (key === 'outline') return outlineFeature.judge.runAdvance((getContext()?.chat?.length || 0) - 1);
    if (key === 'dashed') {
        const mid = (getContext()?.chat?.length || 0) - 1;
        return linesFeature.dashed.rerunAutoFloor(mid, { latestStory: readFloorStory(latestAiFloor(getContext().chat)?.text || '') });
    }
    if (key === 'ledger-capture') return runLedgerCaptureStep(false, { automationFloor: (getContext()?.chat?.length || 0) - 1 });
    if (key === 'ledger-judge') return runLedgerJudgeStep(false, { automationFloor: (getContext()?.chat?.length || 0) - 1 });
    return { status: 'skipped' };
}
async function retryBootstrapGeneration() {
    const state = bootstrapFeature?.state?.() || {};
    if (state.busy && state.failed) return bootstrapFeature.retry();
    if (state.busy) return { status: 'skipped', reason: 'busy' };
    return bootstrapFeature.start();
}
async function retryRefreshModule(entry) {
    const retry = entry?.retry || entry || {};
    const kind = String(retry.kind || (entry?.source === 'fight' ? 'fight' : 'regen'));
    if (kind === 'fight') return refreshController.fight({ intent: retry.intent || { text: retry.reason, items: entry.items }, cause: 'retry' });
    if (kind === 'align') {
        return refreshController.align({
            selected: Array.isArray(retry.selected) && retry.selected.length ? retry.selected : ['point', 'lines'],
            reason: String(retry.reason || ''),
            feedback: String(retry.feedback || ''),
            cause: 'retry',
        });
    }
    const module = String(entry?.items?.[0]?.module || '');
    const selected = module && (module === 'point' || module === 'lines' || module === 'dashed' || module === 'outline')
        ? [module]
        : (Array.isArray(retry.selected) && retry.selected.length ? retry.selected : ['point', 'lines']);
    return refreshController.regenerate({
        selected,
        reason: String(retry.reason || '【改】重试这次失败的刷新'),
        feedback: String(retry.feedback || ''),
        outlineMode: retry.outlineMode || (selected.includes('outline') ? 'current' : undefined),
    });
}
function syncFabFailed() {
    const failed = (floorQueue.snapshot().failed || []).length > 0;
    fabRuntime.setFailed?.(failed);
}
function enqueueStoryDateBeat() {
    const ctx = getContext();
    const mid = (ctx?.chat?.length ?? 0) - 1;
    if (mid < 0) return;
    beginFloorAutomation(mid);
    if (getSettings().linesEnabled !== false && getLinesMode() === 'days') {
        enqueueFloorJob({
            id: 'advance',
            run: () => linesFeature.onDateAftermath({ messageId: mid, chatId: ctx.chatId, fromQueue: true }),
        });
    }
    if (getSettings().dashedEnabled === true) {
        enqueueFloorJob({
            id: 'dashed',
            run: () => linesFeature.dashed.onAiFloor(mid, {
                blocked: false,
                latestStory: readFloorStory(latestAiFloor(getContext().chat)?.text || ''),
            }),
        });
    }
    scheduleFloorDrain();
}
const sameFloorGate = createSameFloorGate();
const diagnosticPack = createDiagnosticPackHost({
    pluginVersion: PLUGIN_VERSION,
    getContext,
    settings: getSettings,
    latestStoryClock,
    todayAnchor: almTodayAnchor,
    latestAiFloor,
    sameFloorPending: () => sameFloorGate.pending(),
    linesMode: getLinesMode,
    queueSnapshot: () => floorQueue?.snapshot?.() || null,
    compactActivity: limit => activityFeature.compactEntries(limit),
    readTrace: readDiagnosticTrace,
    buildCurrentChat: opts => buildCurrentChatDiagnosticPackage(opts),
    copyText: copyPlainText,
    promptTextarea: options => customDialog.promptTextarea(options),
    choose: options => customDialog.choose(options),
    toast: showToast,
});
function exportDiagnosticJson() { return diagnosticPack.exportDiagnostic(); }
const STAGE_COLORS = {
    起线: '#7de9d9', 延展: '#58e8b3', 成形: '#d6b85a', 收束: '#2a8a5d', 淡出: '#888888',
};
const SP_JUMP_HINT_LINES = `<div class="sp-jump-hint">想调整这些线？<button type="button" class="sp-jump-link">和「间」聊聊 →</button></div>`;
// 线·swipe 重算：楼层单调递增闸（区分真·新楼层 vs swipe/历史重渲染），及"待重算 swipe"标记。
const linesFeature = createLinesFeature({
    jumpHint: () => SP_JUMP_HINT_LINES,
    get stageColors() { return STAGE_COLORS; },
    escapeHtml, escapeAttr, cleanText, readFloorStory, enqueueJob: enqueueFloorJob, makeInjectBtn,
    cacheKey: () => getLinesCacheKey(), chatId: () => getContext().chatId,
    boundaryEpoch: () => chatBoundary.epoch(),
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
    refreshStoryClock: () => refreshStoryClockInjection({ announce: true }),
    onActivity: entry => activityFeature.record(entry),
    parseClock: mes => parseStoryClockPure(mes),
    latestFloorAdvance: floorId => activityFeature.latestAdvanceForFloor(floorId),
    replayFloorAdvance: floorId => activityFeature.replayFloorAdvance(floorId),
    didReconcile: mid => refreshController.didReconcile(mid),
    deferAdvance: () => refreshController.stagger.deferAdvance(),
    consumeDeferredAdvance: () => refreshController.stagger.consumeAdvance(),
    tryDashed: (mid, opts) => {
        const blocked = opts?.blocked === true;
        const owed = !blocked && refreshController.stagger.consumeDashed();
        return linesFeature.dashed.onAiFloor(mid, {
            ...opts,
            blocked,
            owed,
            latestStory: readFloorStory(latestAiFloor(getContext().chat)?.text || ''),
        });
    },
    pluginEnabled, getSettings, getMode: getLinesMode, getInterval: getLinesInterval,
    deferSameFloorDateAftermath: () => true,
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
    empty: () => booksEmptyHtml('lines'),
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
        markActivityFloor: (source, floorId, patch) => activityFeature.markLatestSourceFloor(source, floorId, patch),
        logDiagnostic: diagnostic => console.warn('[SP dashed failure]', diagnostic),
        refreshPanel: () => {}, refreshInline: () => {},
        deferDashed: () => refreshController.stagger.deferDashed(),
        sameFloor: () => sameFloorGate.pending(),
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
    enqueueJob: enqueueFloorJob,
    automationModule: AUTOMATION_MODULES.OUTLINE,
    bridgeAbortSignal,
    buildChatMessages: args => generationMessages.composeCreativeChat(args),
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
        openRefresh: selected => openRefreshFor(selected),
        openHistory: () => openBookHistory('outline'),
        closedSuccess: () => showToast('面已生成，点击查看', () => {
            if (!outlineMode) $in('.sp-view-btn[data-view="outline"]').trigger('click');
            showPanel();
        }),
    },
    onActivity: entry => activityFeature.record(entry),
    logDiagnostic: diagnostic => console.warn('[SP outline failure]', diagnostic),
    emptyOutlineHtml: () => booksEmptyHtml('outline'),
    sameFloor: () => sameFloorGate.pending(),
    refreshStoryClock: () => refreshStoryClockInjection({ announce: true }),
});
let bootstrapFeature = null;
function bootstrapStatus(result) {
    if (result?.status === 'updated' || result?.status === 'cancelled' || result?.status === 'unchanged' || result?.status === 'skipped') return result;
    if (result?.status === 'failed') {
        return { status: 'failed', errorMessage: result.errorMessage || diagnosticMessage(result.error) || '生成失败', error: result.error };
    }
    return { status: 'failed', errorMessage: result?.reason || '没有生成' };
}
bootstrapFeature = createBootstrapFeature({
    chatId: () => getContext().chatId,
    flags: readBooksFlags,
    runners: {
        outline: async () => bootstrapStatus(await outlineFeature.generation.trigger({ mode: 'all', reroll: true, module: 'outline' })),
        point: async () => {
            if (!await memoryPreCheckConfirm()) return { status: 'cancelled' };
            return bootstrapStatus(await pointController.runGenerate());
        },
        lines: async () => bootstrapStatus(await linesFeature.generate()),
        axis: async () => bootstrapStatus(await triggerGenerateAlmanac()),
        'ledger-capture': async () => bootstrapStatus(await runLedgerCaptureStep(true)),
        dashed: async () => bootstrapStatus(await linesFeature.dashed.run({
            manual: true,
            nearText: true,
            latestStory: readFloorStory(latestAiFloor(getContext().chat)?.text || ''),
        })),
    },
    abortRunners: () => {
        abortScheduleGen();
        abortLinesGen();
        outlineFeature.abortAll('bootstrap-abort');
        abortAlmanacGen();
        ledgerCaptureController.abort('bootstrap-abort');
        linesFeature.dashed.abort('bootstrap-abort');
    },
    setProgress: html => paintBootstrapProgress(html),
    toast: (message, error) => showToast(message, null, error),
    onActivity: payload => activityFeature.record(payload),
    onDone: () => {
        paintCurrentBookAfterBootstrap();
        try { refreshStoryClockInjection({ announce: true }); } catch {}
    },
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
        parseLines,
        readLedgerText: () => {
            try {
                const items = ledger.listEntries() || [];
                return items.length ? formatLedgerList(items, { daysSince: ledgerDaysSince, dueInfo: ledgerDueInfo }) : '';
            } catch { return ''; }
        },
        readWorldInfo: ctx => buildWorldInfoContext(ctx),
        readMemory: () => getMemText(),
        readRecent: ctx => buildRecentChatContext(ctx, 6, Infinity),
        readCardExtras,
        readAlmanacText: () => getAlmanacInjectText(),
        readCalendarText: () => getCalDescInjectText(),
        readBaiBaiGarnish: () => getSettings().useBaiBaiBook ? baiBaiBookGarnishBlock(readBaiBaiBookGarnish(globalThis.STBaiBaiBook)) : '',
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
        handoffMessage: message => lampHost.receiveSpaceMessage(message),
        // 轴动作在本 facade 之后初始化；只在真实点击时读取，严禁顶层提前解引用造成 TDZ。
        widgetActions: () => ({
            point: (body, $button, editIdx) => applyPointWidget(body, $button, editIdx),
            lines: (body, editIdx, $button) => linesFeature.widget.apply(body, editIdx, $button),
            almanac: (body, $button, index) => axisWidgetActions.applyAlmanacWidget(body, $button, index),
            era: (body, $button) => axisWidgetActions.applyEraWidget(body, $button),
        }),
    },
    collectGuideContext: () => collectBeatLedgerContext(),
    generateBeat: () => revealBeatAndGenerate(),
    intentFromGuide: state => intentFromGuide(state, { kind: 'fight' }),
    handoffToLamp: intent => lampHost.handoffFromGuide(intent),
});
const slipFeature = createSlipFeature({
    context: getContext,
    keyDesc,
    readStore,
    writeStore,
    $in,
});
const lawFeature = createLawFeature({
    context: getContext,
    keyDesc,
    readStore,
    writeStore,
    injectEnabled,
    $in,
});
const stageHost = createStageHost({
    calendar: loadCalDesc,
    todayEvidence: almTodayAnchorEvidence,
    todayAnchor: almTodayAnchor,
    formatDayDate: formatPointDayDate,
    storyYear: almStoryYear,
    readPoint: () => readStore(getCacheKey('user', '')),
    loadAlmanac,
    daysUntil: almDaysUntil,
    dayOfYear: almDayOfYear,
    coversDoy: almItemCoversDoy,
    clampInt: almClampInt,
    yearLen: calYearLen,
    sortUpcoming: sortAlmanacUpcoming,
    listLedger: () => ledger.listEntries() || [],
    dueInfo: ledgerDueInfo,
    readLinesRaw: () => readStore(getLinesCacheKey())?.raw || '',
    jump: openActivityItem,
    $in,
    onOpen: () => beatFeature.ui?.render?.(),
});
const stageFeature = stageHost.feature;
const lampHost = createLampHost({
    calendar: loadCalDesc,
    settings: getSettings,
    baiBaiSnapshot: () => globalThis.STBaiBaiBook?.getSnapshot?.(),
    readPoint: () => readStore(getCacheKey('user', '')),
    writePoint: value => writeStoreConfirmed(getCacheKey('user', ''), value),
    pointKey: () => getCacheKey('user', ''),
    readLinesRaw: () => readStore(getLinesCacheKey())?.raw || '',
    readLines: () => readStore(getLinesCacheKey()) || {},
    writeLines: value => writeStoreConfirmed(getLinesCacheKey(), value),
    listLedger: () => ledger.listEntries() || [],
    updateLedger: (id, patch) => ledger.updateEntry(id, patch),
    dueInfo: ledgerDueInfo,
    loadAlmanac,
    saveAlmanac: items => saveAlmanacItemsConfirmed(items),
    outline: () => outlineFeature,
    lines: () => linesFeature,
    lamp: () => lampFeature,
    space: () => spaceFeature,
    activity: () => activityFeature,
    openSpace: () => openPluginViewWithPrefill('space'),
    fillSpaceInput: text => $in('#sp-space-input')?.val?.(text),
    resetModes: () => { outlineMode = false; linesMode = false; spaceMode = false; theaterMode = false; axisState.almanacMode = false; },
    showLamp: () => showPanelView($in, 'lamp'),
    toast: message => showToast(message),
});
const lampFeature = createLampFeature({
    collect: () => lampHost.collect(),
    jump: openActivityItem,
    $in,
    $,
    toast: (message, error) => showToast(message, null, error),
    onOpen: () => { $in('#sp-refresh-fold')?.prop?.('open', false); },
    sendToSpace: opts => lampHost.sendBasketToSpace(opts),
    clarifyIntent: intent => lampHost.clarifyIntent(intent),
    runKind: (kind, intent) => {
        if (kind === 'align') return refreshController.align({ selected: intent.modules?.length ? intent.modules.filter(name => name === 'point' || name === 'lines') : ['point', 'lines'], reason: intent.text, cause: 'manual' });
        if (kind === 'regen') return refreshController.regenerate({ selected: intent.modules?.length ? intent.modules.filter(name => name === 'point' || name === 'lines' || name === 'dashed' || name === 'outline') : ['point', 'lines'], reason: intent.text || '灯上按意图重做' });
        return refreshController.fight({ intent, cause: 'manual' });
    },
    saveItem: payload => lampHost.applyHandEdit(payload),
});
let theaterMode          = false;
let beatFeature          = null;
const refreshController = createRefreshController({
    context: getContext,
    loadConfig: loadCfg,
    callApi: callCustomApi,
    calendar: loadCalDesc,
    cleanText,
    readFloorStory,
    enqueueJob: enqueueFloorJob,
    today: almTodayAnchor,
    pluginEnabled,
    enabled: () => getSettings().ledgerReconcileEnabled === true,
    rerollEnabled: () => getSettings().ledgerReconcileReroll !== false,
    rerollAlign: opts => activityFeature.realign({ cause: 'reroll', floorId: opts?.messageId }),
    interval: getLedgerReconcileInterval,
    linesEnabled: () => getSettings().linesEnabled !== false,
    isSuppressed: messageId => isAutomationSuppressed(messageId, AUTOMATION_MODULES.POINT) || isAutomationSuppressed(messageId, AUTOMATION_MODULES.LINES),
    readPointRaw: () => readStore(getCacheKey('user', ''))?.raw || '',
    readLinesRaw: () => readStore(getLinesCacheKey())?.raw || '',
    writePointRaw: async (raw, options = {}) => {
        const key = getCacheKey('user', '');
        const saved = readStore(key) || {};
        return writeStoreConfirmed(key, { ...saved, raw, ts: Date.now() }, options);
    },
    writeLinesRaw: async (raw, options = {}) => {
        const key = getLinesCacheKey();
        const saved = readStore(key) || {};
        return writeStoreConfirmed(key, { ...saved, raw, ts: Date.now() }, options);
    },
    writeBatchRaw: async ({ point, lines }, options = {}) => {
        const pointKey = getCacheKey('user', '');
        const linesKey = getLinesCacheKey();
        const ts = Date.now();
        return writeStoreBatchConfirmed([
            { desc: pointKey, value: { ...(readStore(pointKey) || {}), raw: point, ts } },
            { desc: linesKey, value: { ...(readStore(linesKey) || {}), raw: lines, ts } },
        ], options);
    },
    regenPoint: travel => pointController.triggerGenerate(travel),
    regenLines: travel => linesFeature.actions.reroll(travel),
    regenDashed: opts => linesFeature.dashed.run(opts),
    regenOutline: opts => outlineFeature.generation.trigger(opts),
    snapshotModules: names => activityFeature.capture(names),
    collectFightBooks: () => ({
        pointRaw: readStore(getCacheKey('user', ''))?.raw || '',
        linesRaw: readStore(getLinesCacheKey())?.raw || '',
        ledgerText: (ledger.listEntries() || []).map(entry => `${entry.事由 || entry.title}｜${entry.现状 || ''}`).join('\n'),
        almanacText: (loadAlmanac() || []).map(item => `${item.name}｜${item.note || ''}`).join('\n'),
        dashedText: (linesFeature.dashed?.read?.() || []).map(item => item.text || item.body || '').join('\n'),
        outlineRaw: outlineFeature.readRaw?.() || '',
    }),
    applyFightExtras: patches => lampHost.applyFightExtras(patches),
    onActivity: entry => activityFeature.record(entry),
    floorSignature: _floorSig,
    sameFloor: () => sameFloorGate.pending(),
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
    sameFloor: () => sameFloorGate.pending(),
    paintSoon: () => paintPaceSoon(),
});
const paceHost = createPaceHost({
    $in,
    settings: getSettings,
    pluginEnabled,
    paceBook,
    queueSnapshot: () => floorQueue.snapshot(),
    alignInterval: getLedgerReconcileInterval,
    linesMode: getLinesMode,
    advanceInterval: getLinesInterval,
    outlineInterval: () => outlineFeature.judge?.getInterval?.() || 3,
    missingLatestStamp,
    latestAlignFailed: () => activityFeature.latestAlignAttempt?.()?.outcome === 'failed',
    latestAdvanceFailed: () => activityFeature.latestAdvanceAttempt?.()?.outcome === 'failed',
    syncActivityPaceOpen: () => activityFeature.syncPaceOpen?.(),
});
paceHost.hydrate();
function syncRefreshBar() {
    $in('#sp-panel-tools').css('display', 'none');
}
const beatContext = createBeatContextCollector({
    getContext,
    readOutlineSnapshot: () => outlineFeature.readSnapshot?.() || { beats: [], cursor: 0 },
    readPointRaw: () => readStore(getCacheKey('user', ''))?.raw || '',
    readLinesRaw: () => readStore(getLinesCacheKey())?.raw || '',
    readOutlineRaw: () => outlineFeature.readRaw?.() || '',
    readSpaceHistory: () => spaceFeature.chat.history() || [],
    readLatestStory: () => readFloorStory(latestAiFloor(getContext().chat)?.text || ''),
});
function collectBeatLedgerContext() { return beatContext.collect(); }
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

const uiFont = createUiFontController({ settings: getSettings, document });
function applyUiFont() { return uiFont.apply(); }
export { parseFontFamilyFromCss };

jQuery(async () => {
    const panelLifecycleKey = '__sevenDaysCalPanelCleanup';
    globalThis[panelLifecycleKey]?.();
    const cleanupPanelLifecycle = () => {
        panelWindow.dispose();
        jQuery(window).off('pagehide.sevenDaysCalPanel');
        if (globalThis[panelLifecycleKey] === cleanupPanelLifecycle) delete globalThis[panelLifecycleKey];
    };
    globalThis[panelLifecycleKey] = cleanupPanelLifecycle;
    jQuery(window).off('pagehide.sevenDaysCalPanel').on('pagehide.sevenDaysCalPanel', cleanupPanelLifecycle);
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
            managedChatSurface: () => chatSurfaceOwnsDom,
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
    chatBoundary.markReady();
    setTimeout(() => coordinateRuntime.feature.scanButtons(), 900);
    // 首屏补挂：backfill 内部 refreshLinesInjection()（潜伏注入）+ refreshInlineWindow(true)
    // 统一挂线/历/点三段。历/点无独立首屏副作用，全汇流到同一防抖窗口刷新，一次即可。
    scheduleForChatBoundary(backfillLinesInlineBlocks, 800);
    // Reset view state and reload cache on chat switch
    if (_stListeners.chat) eventSource.removeListener?.(event_types.CHAT_CHANGED, _stListeners.chat);
    _stListeners.chat = () => runChatChanged({
        activeChatId: () => chatBoundary.activeIdentity()?.chatId ?? null,
        chatLength: () => getContext().chat?.length ?? 0,
        chatId: () => getContext()?.chatId,
        chatMetadata: () => getContext()?.chatMetadata ?? null,
        pluginEnabled,
        beginBoundary({ previousChatId }) {
            const previousChatRevision = pointTaskOwners.currentChatRevision();
            const boundary = chatBoundary.beginBoundary();
            const chatRevision = pointTaskOwners.nextChatRevision();
            linesFeature.nextChatRevision();
            recordChatBoundary({ previousChatId, currentChatId: boundary.chatId, previousBoundaryEpoch: boundary.previousEpoch, boundaryEpoch: boundary.epoch, previousChatRevision, chatRevision });
            traceDiagnosticEvent('abort-boundary', { module: 'runtime', chatId: boundary.chatId, chatRevision, boundaryEpoch: boundary.epoch, abortReason: 'chat-boundary', status: 'dispatch' });
        },
        clearLinesInjection: () => linesFeature.injection?.clear?.(),
        clearOutlineInjection: () => outlineFeature.injection.clear(),
        clearLedgerInjection: () => ledgerInjectionController.clear(),
        clearLawInjection: () => lawFeature.clearInjection(),
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
        slip: slipFeature,
        law: lawFeature,
        stage: stageFeature,
        lamp: lampFeature,
        activity: activityFeature,
        dashed: linesFeature.dashed,
        theater: theaterFeature,
        resetMemoryPauseNotice() { memoryPauseNoticeShown = false; },
        ledgerCapture: ledgerCaptureController,
        ledgerJudge: ledgerJudgeController,
        axisGeneration: axisGenerationController,
        linesRuntime,
        pace: paceBook,
        get coordinate() { return coordinateRuntime?.feature; },
        refresh: refreshController,
        floorQueue,
        syncFabFailed,
        sameFloor: sameFloorGate,
        beat: beatFeature,
        clearTravelUi() {
            timeTravel.resetSelection();
            customDialog.cancelActive();
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
        migrateBookIds: () => migrateCanonicalBookIds({
            chatId: () => getContext().chatId,
            read: key => readStore(key),
            writeConfirmed: writeStoreConfirmed,
            pointKey: () => getCacheKey('user', ''),
            linesKey: () => keyDesc('lines', 'user', ''),
        }),
        hydratePace: hydratePaceFromStore,
        reloadPanel() {
            const panelOpen = $(`#${MODAL_ID}`).is(':visible') && !pointState.isGenerating;
            paintScheduleHome($in, $inAll, { sub: 'user', wraps: panelOpen });
            taDrawer.close();
            taDrawer.updateLabel();
            pointState.cachedSchedule = loadCachedForCurrentChat();
            if (!panelOpen) return;
            $inAll('.sp-outline-btn').removeClass('sp-btn-active');
            updateCreativeChatModeUI();
            $in('#sp-chat-msgs').empty();
            $in('#sp-space-msgs').empty();
            if (pointState.cachedSchedule) setBody(pointState.cachedSchedule);
            else setBody(booksEmptyHtml('point'));
        },
        scheduleAfterLoad(mig) {
            scheduleForChatBoundary(backfillLinesInlineBlocks, 300);
            coordinateRuntime?.feature?.refreshSavedKeys();
            scheduleForChatBoundary(() => coordinateRuntime?.feature?.scanButtons(), 300);
            scheduleForChatBoundary(checkMemoryMigrationNotice, 500);
            if (mig.status === 'conflict') scheduleForChatBoundary(() => showStoreConflictDialog(mig), 700);
            if (mig.status === 'failed' || mig.status === 'commit-unknown' || mig.status?.endsWith?.('cleanup-failed')) {
                console.error('[SP store] 旧版数据迁移未完成', mig);
                scheduleForChatBoundary(() => showToast('旧版数据迁移未完成，本机旧数据已保留，请稍后重试', null, true), 700);
            }
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
        refreshLawInjection: () => lawFeature.refreshInjection(),
    });
    eventSource.on(event_types.CHAT_CHANGED, _stListeners.chat);
    // 首屏补迁移：扩展初始化时当前 chat 往往已 ready（CHAT_CHANGED 早已错过），
    // 否则老用户要手动切一次 chat 才触发迁移。确认落盘后再删旧副本，冲突延后弹窗。
    try {
        store.migrateChatFromLocalStorage(getContext().chatId).then(_mig0 => {
            if (_mig0.status === 'conflict') scheduleForChatBoundary(() => showStoreConflictDialog(_mig0), 900);
            else if (_mig0.status === 'failed' || _mig0.status === 'commit-unknown' || _mig0.status?.endsWith?.('cleanup-failed')) {
                console.error('[SP store] 首屏旧版数据迁移未完成', _mig0);
                scheduleForChatBoundary(() => showToast('旧版数据迁移未完成，本机旧数据已保留，请稍后重试', null, true), 900);
            }
        }).catch(error => console.error('[SP store] 首屏旧版数据迁移失败', safeDiagnosticLog('storage', 'save', error)));
        migrateCanonicalBookIds({
            chatId: () => getContext().chatId,
            read: key => readStore(key),
            writeConfirmed: writeStoreConfirmed,
            pointKey: () => getCacheKey('user', ''),
            linesKey: () => keyDesc('lines', 'user', ''),
        }).catch(error => console.warn('[SP store] 首屏 Id 迁移失败', safeDiagnosticLog('storage', 'save', error)));
        if (pluginEnabled()) maybeApplyBoundCalendarTemplate().catch(error => {
            console.error('[SP calendar] 首屏角色默认历法自动应用失败', safeDiagnosticLog('axis', 'save', error));
            if (getSettings().notifyMode === 'full') showToast('角色默认历法没有自动应用成功', null, true);
        });
    } catch (err) { console.warn('[SP store] 首屏迁移失败', safeDiagnosticLog('storage', 'save', err)); }
    const floorAutomationRerunner = createFloorAutomationRerunner({
        chatId: () => getContext()?.chatId,
        latestFloor: () => (getContext()?.chat?.length || 0) - 1,
        floorSignature: _floorSig,
        plans: mid => [
            getSettings().ledgerReconcileReroll !== false && refreshController.didReconcile(mid)
                ? { source: 'align', label: '自动对齐', restore: () => activityFeature.revertLatestAlign(mid), run: () => refreshController.onRerollAlign(mid) }
                : null,
            linesFeature.lifecycle.lastAdvanceFloor === mid || linesFeature.rerollStampCrossed?.(mid)
                ? {
                    source: 'advance',
                    label: '线推进',
                    restore: () => activityFeature.replayFloorSource('advance', mid),
                    run: () => getLinesMode() === 'days' ? linesFeature.rerunDateFloorAdvance(mid) : linesFeature.rerunFloorAdvance(mid),
                }
                : null,
            linesFeature.dashed.state().lastDueFloor === mid
                ? { source: 'dashed', label: '冷知识', restore: () => activityFeature.replayFloorSource('dashed', mid), run: () => linesFeature.dashed.rerunAutoFloor(mid, { latestStory: readFloorStory(latestAiFloor(getContext().chat)?.text || '') }) }
                : null,
            outlineFeature.judge.state().lastDueFloor === mid
                ? { source: 'outline', label: '面判定', restore: () => activityFeature.replayFloorSource('outline', mid), run: () => outlineFeature.judge.runAdvance(mid) }
                : null,
            paceBook.ledgerCapture.state().lastDueFloor === mid
                ? { source: 'ledger-capture', label: '刻度标注', restore: () => activityFeature.replayFloorSource('ledger-capture', mid), run: () => runLedgerCaptureStep(false, { automationFloor: mid, reroll: true }) }
                : null,
            paceBook.ledgerJudge.state().lastDueFloor === mid
                ? { source: 'ledger-judge', label: '刻度现状', restore: () => activityFeature.replayFloorSource('ledger-judge', mid), run: () => runLedgerJudgeStep(false, { automationFloor: mid, reroll: true }) }
                : null,
        ].filter(Boolean),
        toast: (message, error) => showToast(message, null, error),
        remember: rememberPace,
        onBlocked: labels => activityFeature.setBlockedReroll(labels),
    });
    const rerunFloorAutomations = messageId => floorAutomationRerunner.run(messageId);
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
            timeTravelClaimTokens: timeTravel.claimTokens,
            timeTravel,
            lines: linesFeature,
            get coordinate() { return coordinateRuntime?.feature; },
            scheduleForChatBoundary,
            syncLatestAlmanacBlock,
            syncLatestScheduleBlock,
            refresh: refreshController,
            beginFloorAutomation,
            enqueueJob: enqueueFloorJob,
            scheduleFloorDrain,
            sameFloor: sameFloorGate,
            beat: beatFeature,
            activity: activityFeature,
            rerunFloorAutomations,
            floorSig: _floorSig,
            rememberPace,
            isAutomationSuppressed,
            booksAreEmpty: () => booksAreEmpty(readBooksFlags()),
            relandStoryClockAnchor,
            buildDateRenderKey,
            consumeDateBootstrap,
            dateCoordinator,
            pace: paceBook,
            getAlmanacJudgeInterval,
            getAlmanacSupplementInterval,
            getLedgerCaptureInterval,
            getLedgerJudgeInterval,
            loadAlmanac,
            triggerSupplementAnniversary,
            runJudgeDateStep,
            runLedgerCaptureStep,
            runLedgerJudgeStep,
            refreshLedgerInjection,
            refreshInlineWindow,
            refreshStoryClockInjection,
            outline: outlineFeature,
            timeTravelDeleted: createLedgerDeletedHandler({
                cancel: () => timeTravel.cancelForDeletion(),
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

// 插件总开关：关则隐身并撤注入；injectEnabled 受它统辖。
const pluginLifecycle = createPluginLifecycle({
    context: () => getContext?.() || {},
    chatRevision: () => pointTaskOwners.currentChatRevision(),
    boundaryEpoch: () => chatBoundary.epoch(),
    traceAbort: payload => traceDiagnosticEvent('abort-boundary', payload),
    memory,
    timeTravel,
    customDialog,
    lines: linesFeature,
    linesRuntime: { abort: reason => { try { linesFeature.runtime?.controller?.abort?.(reason); } catch {} } },
    abortPointSchedule: reason => {
        try { pointState.scheduleAbortController?.abort(reason); } catch {}
        pointState.scheduleAbortController = null;
    },
    abortDateDetection: reason => { try { dateDetectionController.abortController?.abort(reason); } catch {} },
    abortAutoRegen: reason => {
        try { _autoRegenSchedAbort?.abort(reason); } catch {}
        _autoRegenSchedAbort = null;
    },
    abortLedgerCapture: reason => { try { ledgerCaptureController.abortController?.abort(reason); } catch {} },
    abortLedgerJudge: reason => { try { ledgerJudgeController.abortController?.abort(reason); } catch {} },
    outline: outlineFeature,
    space: spaceFeature,
    slip: slipFeature,
    law: lawFeature,
    stage: stageFeature,
    lamp: lampFeature,
    dashed: linesFeature.dashed,
    refresh: refreshController,
    floorQueue,
    syncFabFailed,
    theater: {
        onPluginDisabled: () => theaterFeature?.onPluginDisabled?.(),
        openIfActive: () => { if (theaterMode) theaterFeature?.open?.(); },
    },
    axisGeneration: axisGenerationController,
    ledgerJudge: ledgerJudgeController,
    ledgerCapture: ledgerCaptureController,
    reloadOutlineChatIfOpen: () => { if (outlineMode) outlineFeature.chat.load(); },
    coordinate: { close: () => coordinateRuntime?.feature?.close?.() },
    showFab: () => { $(`#${FAB_ID}`).css('display', fabEnabled() ? '' : 'none'); },
    hideFab: () => { $(`#${FAB_ID}`).css('display', 'none'); },
    backfillInline: () => backfillLinesInlineBlocks(),
    refreshOutlineInjection: () => outlineFeature.injection.refresh(),
    refreshCoordinateButtons: () => {
        coordinateRuntime?.feature?.refreshSavedKeys();
        coordinateRuntime?.feature?.scanButtons();
    },
    refreshInline: () => refreshInlineWindow(true),
    applyBoundCalendar: () => maybeApplyBoundCalendarTemplate().catch(error => {
        console.error('[SP calendar] 重新启用后角色默认历法自动应用失败', safeDiagnosticLog('axis', 'save', error));
        if (getSettings().notifyMode === 'full') showToast('角色默认历法没有自动应用成功', null, true);
    }),
    clearInline: () => _clearAllInlineBoxes(),
    clearLinesInjection: () => linesFeature.injection?.clear?.(),
    clearOutlineInjection: () => outlineFeature.injection.clear(),
    clearLedgerInjection: () => ledgerInjectionController.clear(),
    clearLawInjection: () => lawFeature.clearInjection(),
    refreshStoryClock: opts => refreshStoryClockInjection(opts),
    paintPaceSoon,
});
function _abortAllBackground() { return pluginLifecycle.abortAllBackground(); }
function applyPluginEnabled(on) { return pluginLifecycle.applyPluginEnabled(on); }

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
inlineHost.replaceFeature(createInlineFeature({
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
            managedChatSurface: chatSurfaceOwnsDom,
}));
if (document.querySelector('#chat')) inlineHost.init();
function refreshLinesInjection() {
    return linesFeature.injection?.refresh?.();
}

// 历 / 暗账的攒楼闸在 paceBook 里；间隔、快照和画条在 paceHost。这些名字留给声明提升的早接线。
function getAlmanacJudgeInterval() { return paceHost.almanacJudgeInterval(); }
function getAlmanacSupplementInterval() { return paceHost.almanacSupplementInterval(); }
function getLedgerCaptureInterval() { return paceHost.ledgerCaptureInterval(); }
function getLedgerJudgeInterval() { return paceHost.ledgerJudgeInterval(); }
function readPaceSnapshot() { return paceHost.readSnapshot(); }
function persistPaceNow() { paceHost.persist(); }
function rememberPace() { paceHost.remember(); }
function hydratePaceFromStore() { paceHost.hydrate(); }
function paintPace() { paceHost.paint(); }
function paintPaceSoon() { paceHost.paintSoon(); }

function missingLatestStamp() {
    if (!pluginEnabled() || getSettings().linesEnabled === false || getLinesMode() !== 'days') return false;
    const chat = getContext()?.chat || [];
    const latest = latestAiFloor(chat);
    if (!latest) return false;
    return !latestStampDay(chat, latest.index, parseStoryClockPure);
}

function needsAdvanceCatchup() {
    if (!pluginEnabled() || getSettings().linesEnabled === false || getLinesMode() !== 'days') return false;
    const chat = getContext()?.chat || [];
    const latest = latestAiFloor(chat);
    if (!latest) return false;
    const latestDay = latestStampDay(chat, latest.index, parseStoryClockPure);
    return advanceCatchupNeeded({
        mode: getLinesMode(),
        linesOn: getSettings().linesEnabled !== false,
        missingStamp: !latestDay,
        pendingAdvance: refreshController.stagger?.hasPendingAdvance?.() === true,
        lastAdvanceFailed: activityFeature.latestAdvanceAttempt?.()?.outcome === 'failed',
        latestFloorCrossed: !!latestDay && dayCrossedSincePreviousFloor({
            chat,
            latestIndex: latest.index,
            latestDay,
            parseClock: parseStoryClockPure,
            scanLimit: ALM_CHAT_SCAN_LIMIT,
        }),
        latestFloorAdvanced: !!activityFeature.latestAdvanceForFloor?.(latest.index),
    });
}

const storyClockFill = createStoryClockFillHost({
    getContext,
    latestAiFloor,
    todayAnchor: almTodayAnchor,
    calendar: loadCalDesc,
    formatDate: formatCalendarDate,
    monthName: calMonthName,
    weekdayFor: almWeekdayFor,
    weekdayRef: almWeekdayRef,
    promptFields: options => customDialog.promptFields(options),
    saveChat: () => scriptCore.saveChatDebounced?.(),
    emitEdited: messageId => eventSource.emit(event_types.MESSAGE_EDITED, messageId),
    holdConfirmedFloor: payload => linesFeature.lifecycle.holdConfirmedFloor(payload),
    aftermath: runAnchorAftermath,
    toast: showToast,
    paintActivity: () => activityFeature.paint(),
});
async function fillLatestStoryClock() { return storyClockFill.fill(); }

// ─── 共享锚点善后 ───────────────────────────────────────────────────────────
// 任何一处改「今天」锚点后都走这里。今日游标 / 刷楼内框与轴 / 日期制线换日：business/axis/aftermath.js。
const anchorAftermath = createAnchorAftermath({
    today: almTodayAnchor,
    calendar: loadCalDesc,
    cacheKey: getCacheKey,
    readStore,
    writeStore,
    currentView: () => currentView,
    charViewName: () => charViewName,
    recordActivity: payload => activityFeature.record(payload),
    warn: error => console.warn('[SP shift] 换日滚点失败', error),
    fillAfterShift: () => fillPointHorizons(true),
    syncAlmanacBlock: syncLatestAlmanacBlock,
    syncScheduleBlock: syncLatestScheduleBlock,
    pointGenerating: () => pointState.isGenerating,
    refreshPointPanel: () => refreshCachedSchedule(currentView, charViewName, {
        setCached: html => { pointState.cachedSchedule = html; },
        setBody,
        visible: !outlineMode && !linesMode && !spaceMode && !theaterMode && !axisState.almanacMode && $(`#${MODAL_ID}`).is(':visible'),
    }),
    notifyLinesDate: ({ source } = {}) => {
        if (source === 'time-travel') return;
        const floorId = (getContext().chat?.length ?? 0) - 1;
        const day = almTodayAnchor();
        if (source === 'manual-axis') {
            void advanceQueue.run({
                trigger: 'date',
                messageId: floorId,
                chatId: getContext().chatId,
                day: day ? `${+day.month}-${+day.day}` : null,
            });
            return;
        }
        enqueueStoryDateBeat();
    },
    almanacVisible: () => axisState.almanacMode,
    renderAlmanac: renderAlmanacPanel,
    paintPace: paintPaceSoon,
});
function runAnchorAftermath(source, info) { anchorAftermath.run(source, info); }
async function fillPointHorizons(auto = false) {
    const user = await pointController.fillHorizon(auto, { targetScope: { view: 'user', charName: '' } });
    const charName = String(charViewName || '').trim();
    if (currentView === 'char' && charName) await pointController.fillHorizon(false, { targetScope: { view: 'char', charName } });
    return user;
}
const advanceQueue = createAdvanceQueue({
    plan: () => {
        const raw = readStore(getCacheKey('user', ''))?.raw || '';
        return planAdvanceSteps({
            hasPoint: !!raw,
            pointRaw: raw,
            today: almTodayAnchor(),
            calendar: loadCalDesc(),
            linesOn: true,
        });
    },
    shift: () => anchorAftermath.shiftPointsToToday(),
    fill: options => fillPointHorizons(options.trigger === 'date'),
    lines: options => {
        if (options.trigger === 'date') {
            return linesFeature.onDateAftermath({
                messageId: options.messageId,
                chatId: options.chatId,
                day: options.day,
            });
        }
        return linesFeature.actions.advance();
    },
    onError: (error, options) => {
        console.error('[SP date advance failed]', { error, options });
        showToast('日期推进补跑失败，请检查存储或网络状态后重试', null, true);
    },
});
function schedulePointNeedsSync(target = { view: 'user', charName: '' }, targetDate = null) {
    return anchorAftermath.pointNeedsSync(target, targetDate);
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

function openActivityItem(item) {
    const dest = jumpViewOf(item?.module);
    if (!dest) return Promise.resolve({ status: 'skipped' });
    showPanel();
    if (dest.view === 'lines') linesFeature.setSheet?.(dest.sheet);
    if (dest.view === 'almanac' && dest.sheet) almSetSheet(dest.sheet);
    const $tab = $in(`.sp-side-tab.sp-view-btn[data-view="${dest.view}"]`);
    const already = $tab.hasClass('sp-view-active');
    if (!already) $tab.trigger('click');
    else if (dest.view === 'lines') linesFeature.refreshPanel?.();
    return new Promise(resolve => {
        const go = () => {
            const found = revealActivityTarget(_spShadow, item);
            resolve(found ? { status: 'opened' } : { status: 'missing' });
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(go));
        else setTimeout(go, 0);
    });
}

const panelHost = createPanelHost({
    outlineMode: () => outlineMode,
    rerollOutline: () => outlineFeature.generation.trigger({ reroll: true, module: 'outline' }),
    syncingPoint: () => axisState._almSyncingPoint,
    toast: showToast,
    pointGenerating: () => pointState.isGenerating,
    triggerGenerate: () => pointController.triggerGenerate(),
    setCurrentView: view => { currentView = view; },
    setCharViewName: name => { charViewName = name; },
    getCharViewName: () => charViewName,
    markViewButtons(view) {
        $inAll('.sp-sub-btn').removeClass('sp-view-active').attr({ 'aria-selected': 'false', tabindex: '-1' });
        $inAll(`.sp-sub-btn[data-view="${view}"]`).addClass('sp-view-active').attr({ 'aria-selected': 'true', tabindex: '0' });
    },
    loadCachedSchedule() { pointState.cachedSchedule = loadCachedForCurrentChat(); },
    hasCachedSchedule: () => !!pointState.cachedSchedule,
    cachedScheduleHtml: () => pointState.cachedSchedule,
    setBody,
    showEmptyGenerate,
    updateTaTriggerLabel: () => taDrawer.updateLabel(),
    closeTaDrawer: () => taDrawer.close(),
    pushRecentCharName: name => store.pushRecentCharName(name),
    getContext,
    guessCharName,
    readRecentCharNames: () => store.readRecentCharNames(),
    escapeAttr, escapeHtml,
    isPinnedChar: name => store.isPinnedChar(name),
    removePinnedChar: name => store.removePinnedChar(name),
    addPinnedChar: name => store.addPinnedChar(name),
    pinCap: () => store.PIN_CAP,
    reloadPinnedSchedule() {
        const saved = readStore(getCacheKey(currentView, charViewName));
        if (!saved?.raw) return false;
        pointState.cachedSchedule = renderSchedule(saved.raw, saved.userName || '用户', currentView, loadCalDesc());
        setBody(pointState.cachedSchedule);
        return true;
    },
    taDrawerOpen: () => taDrawer.isOpen(),
    openTaDrawer: () => taDrawer.show(),
    $in, $inAll, $,
    clearShadows() { _spShadow = null; _spDialogShadow = null; },
    buildMarkup() {
        const cfg = loadCfg();
        return {
            cfg,
            html: panelMarkup({
                themeToggleTitle, themeToggleIcon, fabEnabled,
                refreshFoldHtml, beatFoldHtml, activityFeature,
                getSettings, hasCustomApi: !!(cfg.url && cfg.key), cfg, escapeAttr, escapeHtml,
                storyClockStatusCopy, storyClockController,
                THEATER_COUNT_DEFAULT, THEATER_EXPORT_BOOK,
                linesFeature, paceStripHtml, collectPaceRows, readPaceSnapshot,
                getAlmanacJudgeInterval, getAlmanacSupplementInterval, getLedgerReconcileInterval, getLinesMode, getLinesInterval,
                outlineFeature,
            }),
        };
    },
    mountHosts: html => mountPluginHosts({
        document,
        extBase: EXT_BASE,
        stBase: ST_BASE,
        theme: currentTheme,
        html,
        markSurface: markTauriMobileSurface,
    }),
    setShadows(mounted) { _spShadow = mounted.root; _spDialogShadow = mounted.dialogShadow; },
    afterMount(cfg) {
        paintPace();
        if (cfg?.key) $in('#sp-cfg-key').val(maskKey(cfg.key)).data('real', cfg.key);
    },
    bindShell() {
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
        bindModuleIntro({ $in, $, intros: MODULE_INTROS });
        bindDiagnostics({
            $in, inEl,
            refreshPreview: () => debugPayload.refreshPreview(),
            overview: () => diagnosticPack.overview(),
            exportCurrent: exportDiagnosticJson,
        });
    },
});

const historyHost = createHistoryHost({
    getContext,
    toast: showToast,
    dialog: customDialog,
    readStore,
    writeStoreConfirmed,
    pointKey: () => getCacheKey(currentView, charViewName),
    linesKey: () => getLinesCacheKey(),
    dashedKey: () => keyDesc('dashed', 'user', ''),
    outlineKey: () => keyDesc('outline', 'user', ''),
    almanacKey: getAlmanacKey,
    readAxis: readAxisHistoryStore,
    saveCalDesc,
    snapshotLedger: () => ledger.snapshotLedgerState(),
    replaceLedger: (value, options) => ledger.replaceLedgerStateAtomic(value, options),
    afterRestore: {
        point: () => {
            refreshCachedSchedule(currentView, charViewName, {
                setCached: html => { pointState.cachedSchedule = html; },
                setBody,
                visible: true,
            });
            syncLatestScheduleBlock();
            refreshInlineWindow(true);
            refreshStoryClockInjection({ announce: true });
        },
        lines: () => {
            linesFeature.refreshPanel();
            syncLatestInlineBlock();
            refreshInlineWindow(true);
            refreshStoryClockInjection({ announce: true });
        },
        dashed: () => {
            linesFeature.refreshPanel();
            refreshInlineWindow(true);
        },
        outline: () => {
            outlineFeature.refreshPanel();
            outlineFeature.injection?.refresh?.();
            refreshStoryClockInjection({ announce: true });
        },
        axis: () => {
            if (axisState.almanacMode) renderAlmanacPanel();
            syncLatestAlmanacBlock();
            syncLatestScheduleBlock();
        },
        ledger: () => {
            if (axisState.almanacMode && axisState._almanacSheet === 'ledger') renderAlmanacPanel();
            refreshLedgerInjection();
            refreshInlineWindow(true);
        },
    },
});
function openBookHistory(kind) { return historyHost.open(kind); }

function injectModal() {
    panelHost.mount();

    outlineFeature.bindUi();

    spaceFeature.bindUi();
    slipFeature.bindUi();
    lawFeature.bindUi();
    stageFeature.bindUi();
    lampFeature.bindUi();
    beatFeature.bindUi();
    bindLinesPanel({
        $, $in, $chat: $('#chat'),
        lines: linesFeature,
        generate: () => linesFeature.generate(),
        abort: abortLinesGen,
        openRefresh: () => openRefreshFor(['lines']),
        openHistory: kind => openBookHistory(kind),
        advance: () => advanceQueue.run({ trigger: 'manual' }),
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
        openRefresh: () => openRefreshFor(['point']),
        pinChar: onCharPinToggle,
        currentView: () => currentView,
        charViewName: () => charViewName,
        deleteEvent: (...args) => pointActions.deleteEvent(...args),
        abort: abortScheduleGen,
        openHistory: () => openBookHistory('point'),
        alignStartDate: () => pointActions.alignStartDate(),
        rollToToday: () => pointActions.rollToToday(),
    });
    $in('.sp-sheet').on('click', '#sp-gen-books-now', () => void bootstrapFeature.start());
    $in('.sp-sheet').on('click', '#sp-bootstrap-retry', () => void bootstrapFeature.retry());
    $in('.sp-sheet').on('click', '#sp-bootstrap-skip', () => void bootstrapFeature.skip());
    $in('.sp-sheet').on('click', '#sp-bootstrap-abort', () => bootstrapFeature.abort());
    taDrawer.bindUi();
    bindAdultReveal({ $, $in, $chat: $('#chat') });
    bindManualActionMenus({
        $, $inAll,
        close: closeActionMenus,
        pointView: () => ({ view: currentView, charName: charViewName }),
        pointEdit: (day, ev, view) => pointActions.editDescription(day, ev, view),
        pointPin: (day, ev) => pointActions.togglePin(day, ev),
        pointDelete: (day, ev, view) => pointActions.deleteEvent(day, ev, view),
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
        startTravel: targetDate => timeTravel.start(targetDate),
        cancelTravel: () => timeTravel.cancel(),
        calendarActions: axisCalendarActions,
        openEditor: openAlmanacEditor,
        generate: triggerGenerateAlmanac,
        supplement: triggerSupplementAnniversary,
        openManager: openCalendarManager,
        openHistory: kind => openBookHistory(kind),
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
            slipOn: () => slipFeature.isOpen(),
            lawOn: () => lawFeature.isOpen(),
            stageOn: () => stageFeature.isOpen(),
            lampOn: () => lampFeature.isOpen(),
            get theater() { return theaterFeature; },
            closeTaDrawer: () => taDrawer.close(),
            toggleTaDrawer: () => taDrawer.toggle(),
            pointGenerating: () => pointState.isGenerating,
            markSideTab(view, $btn) {
                $inAll('.sp-side-tab.sp-view-btn').removeClass('sp-view-active').attr({ 'aria-selected': 'false', tabindex: '-1' });
                $btn.addClass('sp-view-active').attr({ 'aria-selected': 'true', tabindex: '0' });
                _lastMainView = view;
                syncRefreshBar(view);
            },
            markSubBtn(view, $btn) {
                $inAll('.sp-sub-btn').removeClass('sp-view-active').attr({ 'aria-selected': 'false', tabindex: '-1' });
                $btn.addClass('sp-view-active').attr({ 'aria-selected': 'true', tabindex: '0' });
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
                if (bootstrapFeature?.busy) linesFeature.renderBody(bootstrapFeature.progressHtml());
                else if (linesRuntime.busy) linesFeature.renderBody(loadingHtml('正在推演线', 'sp-abort-lines'));
                else {
                    const cached = loadCachedLinesForCurrentChat();
                    linesFeature.renderBody(cached || booksEmptyHtml('lines'));
                }
            },
            paintTheater() {
                if (theaterFeature.busy) setTheaterBody(loadingHtml('正在折射', 'sp-abort-theater'));
                else theaterFeature.open();
            },
            paintAlmanac: () => renderAlmanacPanel(),
            paintSchedule() {
                $inAll('.sp-sub-btn').removeClass('sp-view-active').attr({ 'aria-selected': 'false', tabindex: '-1' });
                $inAll(`.sp-sub-btn[data-view="${currentView}"]`).addClass('sp-view-active').attr({ 'aria-selected': 'true', tabindex: '0' });
                taDrawer.updateLabel();
                if (bootstrapFeature?.busy) setBody(bootstrapFeature.progressHtml());
                else if (pointState.isGenerating) setBody(loadingHtml('正在规划', 'sp-abort-generate'));
                else if (pointState.cachedSchedule) setBody(pointState.cachedSchedule);
                else showEmptyGenerate();
            },
            enterAnchor: () => enterCoordinateSidebar({
                resetModes: () => { outlineMode = false; linesMode = false; spaceMode = false; theaterMode = false; axisState.almanacMode = false; },
                show: () => showPanelView($in, 'anchor'),
                feature: coordinateRuntime?.feature,
            }),
            enterSlip: () => enterSlipSidebar({
                resetModes: () => { outlineMode = false; linesMode = false; spaceMode = false; theaterMode = false; axisState.almanacMode = false; },
                show: () => showPanelView($in, 'slip'),
                feature: slipFeature,
            }),
            enterLaw: () => enterLawSidebar({
                resetModes: () => { outlineMode = false; linesMode = false; spaceMode = false; theaterMode = false; axisState.almanacMode = false; },
                show: () => showPanelView($in, 'law'),
                feature: lawFeature,
            }),
            enterStage: () => enterStageSidebar({
                resetModes: () => { outlineMode = false; linesMode = false; spaceMode = false; theaterMode = false; axisState.almanacMode = false; },
                show: () => showPanelView($in, 'stage'),
                feature: stageFeature,
            }),
            enterLamp: () => enterLampSidebar({
                resetModes: () => { outlineMode = false; linesMode = false; spaceMode = false; theaterMode = false; axisState.almanacMode = false; },
                show: () => showPanelView($in, 'lamp'),
                feature: lampFeature,
            }),
            get slip() { return slipFeature; },
            get law() { return lawFeature; },
            get stage() { return stageFeature; },
            get lamp() { return lampFeature; },
            get coordinate() { return coordinateRuntime?.feature; },
            currentView: () => currentView,
            setView,
        }, $(this));
    });
    $in('.sp-root').on('keydown', '[role="tab"]', function (event) {
        const tablist = this.closest?.('[role="tablist"]');
        if (!tablist) return;
        const tabs = Array.from(tablist.children || []).filter(element => element.getAttribute?.('role') === 'tab' && !element.disabled);
        const target = tabNavigationTarget(tabs, this, event.key);
        if (!target) return;
        event.preventDefault();
        target.focus();
        target.click();
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
        cachedModels: () => modelList.cached(),
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
        refreshLawInjection: () => lawFeature.refreshInjection(),
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
        resetSupplementCounter: () => paceBook.supplement.resetCounter(),
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

function onRegenClick() { return panelHost.onRegenClick(); }
function setView(view, charName) { return panelHost.setView(view, charName); }
function switchToCharView() { return panelHost.switchToCharView(); }
function activateCharView(name) { return panelHost.activateCharView(name); }
function onCharPinToggle(name) { return panelHost.onCharPinToggle(name); }
function refreshCharPinIcon() { return panelHost.refreshCharPinIcon(); }

// ─── Open / close ─────────────────────────────────────────────────────────────

// 面板打开时先重置到点首页作为干净基线，再恢复同聊天上次的 lastMainView；切聊天时该值已复位为点。
// 清掉上次残留的子视图（历/线/面/间/棱/坐标）+ 内联编辑器，不 abort 生成、不动数据缓存。
// 无条件隐藏所有非点 wrap（不靠 mode 标志守卫）：CHAT_CHANGED 在面板隐藏时会把标志清成
// false 却不动 DOM，若这里再按标志判断就会漏隐藏 → 出现「点 + 坐标」同屏。故一律硬隐藏。
function resetPanelToScheduleHome() {
    slipFeature.close();
    lawFeature.close();
    stageFeature.close();
    lampFeature.close();
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
            if (bootstrapFeature?.busy) {
                setBody(bootstrapFeature.progressHtml());
            } else if (pointState.isGenerating) {
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
    setBody(booksEmptyHtml('point'));
}

function setBody(html) { $in('#sp-body').html(html); }

function readBooksFlags() {
    return {
        hasPoint: !!readStore(getCacheKey('user', ''))?.raw,
        hasLines: !!readStore(getLinesCacheKey())?.raw,
        hasOutline: !!String(outlineFeature?.readRaw?.() || '').trim(),
        hasAlmanac: (loadAlmanac() || []).length > 0,
        ledgerCaptureEnabled: getSettings().ledgerCaptureEnabled === true,
        ledgerEmpty: !(ledger.listEntries({ includeClosed: true }) || []).length,
        dashedEnabled: getSettings().dashedEnabled === true,
        dashedEmpty: !(linesFeature?.dashed?.read?.() || []).length,
    };
}

function booksEmptyHtml(kind) {
    if (bootstrapFeature?.busy) return bootstrapFeature.progressHtml();
    if (kind === 'outline') return emptyOutlineHtml(readBooksFlags());
    if (kind === 'lines') return emptyLinesHtml(readBooksFlags());
    return emptyPointHtml(readBooksFlags());
}

function openRefreshFor(selected) {
    enterLampSidebar({
        resetModes: () => { outlineMode = false; linesMode = false; spaceMode = false; theaterMode = false; axisState.almanacMode = false; },
        show: () => showPanelView($in, 'lamp'),
        feature: lampFeature,
    });
    return openRefreshFold($in('#sp-refresh-fold'), selected);
}

function paintBootstrapProgress(html) {
    if (outlineMode) setOutlineBody(html);
    else if (linesMode) linesFeature.renderBody(html);
    else setBody(html);
}

function paintCurrentBookAfterBootstrap() {
    if (outlineMode) outlineFeature.refreshPanel();
    else if (linesMode) linesFeature.refreshPanel();
    else if (!spaceMode && !theaterMode && !axisState.almanacMode) {
        pointState.cachedSchedule = loadCachedForCurrentChat();
        if (pointState.cachedSchedule) setBody(pointState.cachedSchedule);
        else showEmptyGenerate();
    }
}

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
const memoryInject = createMemoryInjectHost({
    settings: getSettings,
    getApi: () => globalThis.STBaiBaiBook,
    confirm: options => spConfirm(options),
    healthReport: () => memory.getHealthReport(),
    builtinContext: () => memory.getMemoryContext(),
    warnMissingApi: () => {
        if (!getMemText._bbbWarned) {
            getMemText._bbbWarned = true;
            console.info('[7dayscal] 使用柏宝书记忆但 API 未就绪，本次生成无历史注入');
        }
    },
    warnReadError: err => console.warn('[7dayscal] 柏宝书取历史出错', safeDiagnosticLog('memory', 'request', err, { background: true })),
});
async function memoryPreCheckConfirm() { return memoryInject.precheck(); }

function spConfirm(options, fallbackBody) {
    return customDialog.confirm(options, fallbackBody);
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

async function showStoreConflictDialog(mig) {
    if (!mig || mig.status !== 'conflict') return;
    const choice = await customDialog.choose({
        title: '构画数据冲突',
        body: `这个聊天在别的设备/浏览器也编辑过构画（点线面间），云端和本机各有一份、内容不同。保留哪一份？\n\n云端（跟聊天走）：${fmtStoreSide(mig.cloud)}\n本机（这台浏览器）：${fmtStoreSide(mig.local)}`,
        note: '只影响构画自己的点线面间，不动记忆 / 棱 / 其他插件。点窗外或按 Esc＝暂不决定，下次再问。',
        choices: [
            { value: 'local', label: '保留本机' },
            { value: 'cloud', label: '保留云端', primary: true },
        ],
    });
    if (choice === 'cloud') store.discardLegacy(mig.legacy);
    else if (choice === 'local') {
        const result = await store.applyLegacyOverCloud(mig.legacy);
        if (result?.ok) reloadAfterConflict();
        else {
            console.error('[SP store] 本机副本覆盖失败', result);
            showToast('本机副本没有确认保存，旧数据仍保留；请稍后重试', null, true);
        }
    }
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
    const horizonFill = Number(travelContext?.horizonFill) || 0;
    const prompt = appendTravelPromptContext(
        horizonFill
            ? buildHorizonFillPrompt(userName, charName, perspective, {
                gap: horizonFill,
                existingSummary: travelContext?.existingSummary || '',
            })
            : buildPrompt(userName, charName, perspective, pinned, loadCalDesc(), { mode: adultMode, tickets: pointTicketPlan(adultMode, 14) }),
        travelContext,
    );
    const apiOpts = { ...(travelContext?.feedback === 'time-travel' ? { fullMemory: true, ...travelContext } : (travelContext || {})), promptMode: 'creative', diagnosticModule: 'point', diagnosticSink };
    apiOpts.pointView = perspective;
    return callCustomApi(ctx, prompt, cfg, userName, charName, signal, 3, apiOpts);
}


// charKey 用**角色卡文件名 avatar**（如 `坏狗.png`）——它跟着卡文件走、稳定不变。
// 早期误用 ctx.characterId（= this_chid，characters 数组的**下标索引**）：一旦增删/重排
// 角色，索引就漂移，同一张卡下次读到的是别人的（或空）设置。
function charStableKey(ctx) {
    const c = ctx?.characters?.[ctx?.characterId];
    return c?.avatar || null;   // 无角色（群聊/未选卡）→ null，各 getter 守卫返回默认
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

// Recent chat context — fills the gap between memory (delayed L0/L1 summaries)
// and "what the user just typed". Both 间 and 面 discussions previously saw
// only outline+wi+memText, so the last few floors of the main chat were
// invisible to the assistant — feels like it "ignores context".
// Returns a formatted block or '' when the chat is empty.
async function buildRecentChatContext(ctx, floorCount = 6, perMessageChars = Infinity) {
    const chat = ctx?.chat;
    if (!Array.isArray(chat) || !chat.length) return '';
    const charName = ctx.name2 || '角色';
    const s = getSettings();
    const stripOpts = { keepTags: s.keepTags, extraTags: s.extraTags };
    const rows = [];
    for (const m of selectVisibleChatHistory(chat, floorCount)) {
        const raw = String(m.mes || '');
        if (!raw.trim()) continue;
        const cleaned = memory.extractStoryText(raw, stripOpts).trim();
        if (!cleaned) continue;
        const speaker = m.name || charName;
        const capped = Number.isFinite(perMessageChars) && cleaned.length > perMessageChars
            ? cleaned.slice(0, perMessageChars) + '…'
            : cleaned;
        rows.push(`【${speaker}】${capped}`);
    }
    if (!rows.length) return '';
    return `【最近对话】以下是主聊天中最近几层对话原文，供理解当前剧情走向。\n\n${rows.join('\n\n')}`;
}

async function _getMemTextRaw(opts = {}) { return memoryInject.getTextRaw(opts); }

// 记忆原文交给生成，不再按 60000 tk 抽块。柏宝书自己召回；内置 L0/L1 宁可变长，也不要再节选成「读不全」。
async function getMemText(opts = {}) {
    return _getMemTextRaw(opts);
}

const generationMessages = createGenerationMessagesHost({
    settings: getSettings,
    buildWorldInfoContext,
    getMemText,
    getAlmanacInjectText,
    getCalDescInjectText,
    garnish: () => getSettings().useBaiBaiBook ? baiBaiBookGarnishBlock(readBaiBaiBookGarnish(globalThis.STBaiBaiBook)) : '',
    substituteParams,
    stripTags: (text, opts) => memory.extractStoryText(text, opts),
    selectVisibleHistory: selectVisibleChatHistory,
    getContext,
    readOutline: target => outlineFeature.repository.readRaw(target),
    buildRecentChatContext,
    buildCreativeChatSystemPrompt,
});

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

// Turn AI reply text into safe rendered HTML via ST's own messageFormatting
// (markdown + sanitizer + quote-wrap), so 间/面/棱 match the main chat area.
// Falls back to escaped text with <br> if the API isn't available. Never used
// for user messages — they typed plain text, don't reinterpret it as markdown.
function renderAiMessageHtml(text) {
    return formatAiMessageHtml(text, {
        getContext,
        disabledExtensions: () => extension_settings?.disabledExtensions,
        escapeHtml,
        logWarn: err => console.warn('[7dayscal] messageFormatting failed, falling back to plain', safeDiagnosticLog('generation', 'parse', err)),
    });
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
    commitCalendar: cal => axisTransactionController.commit(cal),
    notifyEra: cal => { if (getSettings().notifyMode !== 'off') showToast(`历法已更新：${cal.era ? cal.era + '·' : ''}${calendarSummary(cal)}`); },
});

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

// 有时间戳只签 SDC-start/end 之间，避免楼尾变量块被当成重 roll。
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
    return assembleGouhuaBackupController({
        pluginVersion: PLUGIN_VERSION,
        getContext,
        getSettings,
        saveSettings: () => stSaveSettings(),
        localStorage: globalThis.localStorage,
        storageStatus,
        getChatRoot,
        persistExternalRoots,
        invalidateCoordinates: () => {
            coordinateRuntime?.repository?.invalidate?.();
            coordinateRuntime?.excerpts?.invalidate?.();
        },
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
        const warnings = backupExportWarnings(pack);
        if (warnings.length) showToast(`迁移包已导出，但不完整：${warnings.join('；')}。请勿把它当作完整备份。`, null, true);
        else showToast('构画迁移包已完整导出');
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
    traceDiagnosticEvent('abort-boundary', { module: 'ledger', chatId: getContext?.()?.chatId ?? null, chatRevision: pointTaskOwners.currentChatRevision(), boundaryEpoch: chatBoundary.epoch(), abortReason: 'store-clear', status: 'dispatch' });
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
    traceDiagnosticEvent('abort-boundary', { module: 'axis-generation', chatId: getContext?.()?.chatId ?? null, chatRevision: pointTaskOwners.currentChatRevision(), boundaryEpoch: chatBoundary.epoch(), abortReason: 'store-clear', status: 'dispatch' });
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

const storeClear = createStoreClearHost({
    traceAbort: payload => traceDiagnosticEvent('abort-boundary', payload),
    chatId: () => getContext?.()?.chatId ?? null,
    chatRevision: () => pointTaskOwners.currentChatRevision(),
    boundaryEpoch: () => chatBoundary.epoch(),
    abortPointSchedule: reason => {
        pointState.scheduleAbortController?.abort(reason);
        pointState.scheduleAbortController = null;
    },
    abortAutoRegen: reason => { _autoRegenSchedAbort?.abort(reason); _autoRegenSchedAbort = null; },
    setPointGenerating: value => { pointState.isGenerating = value; },
    outline: outlineFeature,
    lines: linesFeature,
    space: spaceFeature,
    slip: slipFeature,
    law: lawFeature,
    setPointCache: html => { pointState.cachedSchedule = html; },
    setBody,
    emptyPointHtml: () => booksEmptyHtml('point'),
    emptyLinesHtml: () => booksEmptyHtml('lines'),
    syncScheduleBlock: syncLatestScheduleBlock,
    syncInlineBlock: syncLatestInlineBlock,
    resetLinesRuntime: () => linesRuntime.reset(),
    refreshLinesInjection,
    linesMode: () => linesMode,
    readPoint: () => readStore(getCacheKey(currentView, charViewName)),
    getContext,
    currentView: () => currentView,
    charViewName: () => charViewName,
    renderSchedule: (raw, userName) => renderSchedule(raw, userName, currentView, loadCalDesc()),
    scheduleVisible: () => !outlineMode && !linesMode && !spaceMode && !theaterMode && $(`#${MODAL_ID}`).is(':visible'),
});

function invalidateKindTasksForStoreClear(kind) {
    dispatchStoreClearInvalidate(kind, storeClear);
}

function refreshEditorsAfterStoreClear(kind) {
    dispatchStoreClearRefreshAfter(kind, storeClear);
}

function refreshEditorsFromCurrentStore(kind) {
    dispatchStoreClearRefreshFromStore(kind, storeClear);
}

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
async function triggerSupplementAnniversary(options = {}) { return axisGenerationController.trigger(true, options); }
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

// Inline model list — cached models from last fetch. Not persisted across reloads.
const modelList = createModelListHost({
    $in, escapeHtml, escapeAttr, normalizeUrl: normalizeApiUrl, getContext,
    toast: showToast, diagnosticMessage,
});
function renderModelList(models, filter = '') { return modelList.render(models, filter); }
async function fetchModels() { return modelList.fetch(); }

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
    const revision = ++worldInfo.panelState.theaterRevision;
    const identity = worldInfo.identity();
    const names = [...new Set((await getAllWorldNames(getContext()) || []).filter(n => typeof n === 'string' && n))].sort((a, b) => a.localeCompare(b, 'zh'));
    if (revision !== worldInfo.panelState.theaterRevision || identity !== worldInfo.identity()) return;
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
            const name = String($(this).attr('data-name') || '').toLowerCase();
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

// 聊天输入框随内容自增高：先归零再按 scrollHeight 撑，CSS 用 max-height 封顶后转滚动条。
// 清空发送后也调一次即可缩回单行。
