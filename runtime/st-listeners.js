export function isLatestChatFloor(chat, messageId) {
    return Array.isArray(chat) && Number(messageId) === chat.length - 1;
}

export function stripChatFileExt(value) {
    return String(value ?? '').replace(/\.jsonl$/i, '');
}

export function replaceListener(eventSource, store, key, type, handler) {
    if (store[key]) eventSource.removeListener?.(type, store[key]);
    store[key] = handler;
    if (handler) eventSource.on(type, handler);
}

export function bindNamedListeners(eventSource, store, specs) {
    for (const { key, type, handler } of specs) {
        replaceListener(eventSource, store, key, type, handler);
    }
}

export function createChatFloorHandlers(h) {
    const modules = h.automationModules || {};
    return {
        diagnosticRetention: () => h.refreshDiagnosticRetention?.(h.getContext?.()),
        externalSnapshotPrune: () => {
            if (h.isExternalMode?.()) void h.pruneExternalSnapshots?.(h.getContext?.()?.chat || []);
        },
        // 时光旅行·预检占闸：必须先于 char 注册（同一 CMR tick 内按注册序先跑）——时旅首楼定型时，
        // 先把自动化闸整体占住（isInitialFloor 才占），让同 tick 的线推进/点线 N 楼对齐/面/暗账全部 isSuppressed
        // 短路。点/线/轴改由时旅步骤按目标日重跑，而不是普通新楼通道。token 随 onSequenceEnd 或 cancel 释放。
        timeTravelPreflight: messageId => {
            if (!h.pluginEnabled?.()) return;
            if (!h.timeTravel?.isInitialFloor?.(messageId)) return;
            const session = h.timeTravel.getState?.();
            if (!session?.sessionId) return;
            const token = h.automationGate?.claim?.({
                scopeId: h.getContext?.().chatId,
                messageId: Number(messageId),
                modules: Object.values(modules),
            });
            if (token) h.timeTravelClaimTokens?.set?.(session.sessionId, token);
        },
        received: (messageId, type) => {
            h.lines?.onMessageReceived?.({ messageId: Number(messageId), type });
        },
        char: async (messageId, type) => {
            if (!h.pluginEnabled?.()) return;
            h.coordinate?.onCharacterRendered?.({ messageId: Number(messageId), type });
            h.scheduleForChatBoundary?.(() => h.coordinate?.scanButtons?.(), 150);
            h.syncLatestAlmanacBlock?.();
            h.syncLatestScheduleBlock?.();
            const mid = Number(messageId);
            const tick = await h.refresh?.onAiFloor?.(mid);
            h.beat?.onAiFloor?.(mid);
            h.activity?.markFloorRestyle?.({ floorId: mid, signature: h.floorSig?.(mid) });
            if (tick?.reason === 'seen') await h.refresh?.onRerollAlign?.(mid);
            await h.lines?.onCharacterRendered?.({ messageId: mid, type, autoSuppressed: h.isAutomationSuppressed?.(mid, modules.LINES) });
            h.rememberPace?.();
        },
        timeTravel: async messageId => {
            if (!h.pluginEnabled?.()) return;
            await h.timeTravel?.handleRendered?.(messageId);
        },
        timeTravelDeleted: h.timeTravelDeleted,
        beatDeleted: () => { if (h.pluginEnabled?.()) h.beat?.syncFloor?.(); },
        swiped: async (mesId, info) => {
            if (!h.pluginEnabled?.()) return;
            if (!info?.pendingGeneration) h.relandStoryClockAnchor?.();
            h.syncLatestAlmanacBlock?.();
            h.syncLatestScheduleBlock?.();
            await h.lines?.onSwiped?.({ mesId, info });
            if (!info?.pendingGeneration) {
                const mid = Number(mesId);
                h.activity?.markFloorRestyle?.({ floorId: mid, signature: h.floorSig?.(mid) });
                await h.refresh?.onRerollAlign?.(mid);
            }
        },
        edited: (mesId) => {
            h.lines?.onEdited?.({ mesId });
        },
        sent: (insertAt) => {
            h.lines?.onSent?.({ insertAt });
        },
        genStart: (genType, _opts, dryRun) => {
            h.refreshStoryClockInjection?.();
            h.lines?.onGenerationStarted?.({ genType, dryRun });
            if (!dryRun && (genType === 'regenerate' || genType === 'swipe')) {
                h.refresh?.abort?.('reroll');
                h.sameFloor?.mark?.(genType);
            }
        },
        streamTok: () => { h.lines?.onToken?.(); },
        genEnd: () => {
            h.lines?.onGenerationEnded?.({ stopped: false });
        },
        genStopped: () => {
            h.sameFloor?.clear?.();
            h.lines?.onGenerationEnded?.({ stopped: true });
        },
        sameFloorSettle: messageId => {
            if (!isLatestChatFloor(h.getContext?.().chat, messageId)) return;
            h.sameFloor?.consume?.();
        },
        outlineJudge: messageId => { h.outline?.onCharacterMessage?.(messageId); h.rememberPace?.(); },
        // 历·确认当前剧情日期。戳优先——戳开且本楼有可解析戳 → **每次**最新楼定型都直读落地、零 API、不进单调闸；
        // 读不到戳（漏打 / 「谷雨」无月日）才走单调闸 + almanacAutoDetect 决定是否攒够 N 楼调一次 API 兜底 → 写共享 dateAnchor。
        almanacJudge: async (messageId) => {
            if (!h.pluginEnabled?.()) return;
            const chat = h.getContext?.().chat;
            if (!isLatestChatFloor(chat, messageId)) return;
            const renderKey = h.buildDateRenderKey?.(messageId);
            const bootstrap = h.consumeDateBootstrap?.(messageId);
            const clockResult = h.relandStoryClockAnchor?.({ suppressAftermath: bootstrap }) || { status: 'no-date' };
            if (clockResult.status !== 'no-date') {
                h.dateCoordinator?.recordResult?.(renderKey, { ...clockResult, source: 'story-clock' });
                return;
            }
            if (bootstrap) {
                h.dateCoordinator?.recordResult?.(renderKey, { ...clockResult, source: 'chat-bootstrap' });
                return;
            }
            if (!h.pace?.consumeFloor?.('date', messageId, {
                interval: h.getAlmanacJudgeInterval?.(),
                blocked: h.getSettings?.().almanacAutoDetect === false,
            })) return;
            h.dateCoordinator?.runOnce?.(renderKey, ({ signal }) => h.runJudgeDateStep?.({ messageId, signal }));
            h.rememberPace?.();
        },
        ledgerCapture: async (messageId) => {
            if (!h.pluginEnabled?.()) return;
            if (h.getSettings?.().ledgerCaptureEnabled !== true) return;
            const chat = h.getContext?.().chat;
            if (!isLatestChatFloor(chat, messageId)) return;
            if (!h.pace?.consumeFloor?.('ledgerCapture', messageId, {
                interval: h.getLedgerCaptureInterval?.(),
                blocked: h.isAutomationSuppressed?.(messageId, modules.LEDGER_CAPTURE),
            })) return;
            h.runLedgerCaptureStep?.();
            h.rememberPace?.();
        },
        ledgerJudge: async (messageId) => {
            if (!h.pluginEnabled?.()) return;
            if (h.getSettings?.().ledgerCaptureEnabled !== true) return;
            const chat = h.getContext?.().chat;
            if (!isLatestChatFloor(chat, messageId)) return;
            if (!h.pace?.consumeFloor?.('ledgerJudge', messageId, {
                interval: h.getLedgerJudgeInterval?.(),
                blocked: h.isAutomationSuppressed?.(messageId, modules.LEDGER_JUDGE),
            })) return;
            h.runLedgerJudgeStep?.();
            h.rememberPace?.();
        },
        ledgerInjectRescore: async (messageId) => {
            if (!h.pluginEnabled?.()) return;
            if (h.getSettings?.().ledgerInject !== true) return;
            const chat = h.getContext?.().chat;
            if (!isLatestChatFloor(chat, messageId)) return;
            try { h.refreshLedgerInjection?.(); } catch {}
            try { h.refreshInlineWindow?.(true); } catch {}
        },
        rename: async (data) => {
            if (!h.pluginEnabled?.()) return;
            const oldId = stripChatFileExt(data?.oldFileName), newId = stripChatFileExt(data?.newFileName);
            if (!oldId || !newId) return;
            h.coordinate?.onChatRenamed?.({ oldId, newId });
            try {
                const hash = h.getContext?.()?.chatMetadata?.chat_id_hash ?? null;
                const n = await h.coordinate?.renameChatId?.(oldId, newId, newId, hash);
                if (n) h.coordinate?.open?.('chars');
            } catch (err) { h.warnRename?.(err); }
        },
    };
}

export function bindChatFloorListeners({ eventSource, event_types: et, store, h }) {
    const handlers = createChatFloorHandlers(h);
    bindNamedListeners(eventSource, store, [
        { key: 'diagnosticRetention', type: et.CHARACTER_MESSAGE_RENDERED, handler: handlers.diagnosticRetention },
        { key: 'externalSnapshotPrune', type: et.MESSAGE_DELETED, handler: handlers.externalSnapshotPrune },
        { key: 'timeTravelPreflight', type: et.CHARACTER_MESSAGE_RENDERED, handler: handlers.timeTravelPreflight },
        { key: 'received', type: et.MESSAGE_RECEIVED, handler: handlers.received },
        { key: 'char', type: et.CHARACTER_MESSAGE_RENDERED, handler: handlers.char },
        { key: 'timeTravel', type: et.CHARACTER_MESSAGE_RENDERED, handler: handlers.timeTravel },
        { key: 'timeTravelDeleted', type: et.MESSAGE_DELETED, handler: handlers.timeTravelDeleted },
        { key: 'beatDeleted', type: et.MESSAGE_DELETED, handler: handlers.beatDeleted },
        { key: 'swiped', type: et.MESSAGE_SWIPED, handler: handlers.swiped },
        { key: 'edited', type: et.MESSAGE_EDITED, handler: handlers.edited },
        { key: 'sent', type: et.MESSAGE_SENT, handler: handlers.sent },
        { key: 'genStart', type: et.GENERATION_STARTED, handler: handlers.genStart },
        { key: 'streamTok', type: et.STREAM_TOKEN_RECEIVED, handler: handlers.streamTok },
        { key: 'genEnd', type: et.GENERATION_ENDED, handler: handlers.genEnd },
        { key: 'genStopped', type: et.GENERATION_STOPPED, handler: handlers.genStopped },
        { key: 'outlineJudge', type: et.CHARACTER_MESSAGE_RENDERED, handler: handlers.outlineJudge },
        { key: 'almanacJudge', type: et.CHARACTER_MESSAGE_RENDERED, handler: handlers.almanacJudge },
        { key: 'ledgerCapture', type: et.CHARACTER_MESSAGE_RENDERED, handler: handlers.ledgerCapture },
        { key: 'ledgerJudge', type: et.CHARACTER_MESSAGE_RENDERED, handler: handlers.ledgerJudge },
        { key: 'ledgerInjectRescore', type: et.CHARACTER_MESSAGE_RENDERED, handler: handlers.ledgerInjectRescore },
        { key: 'sameFloorSettle', type: et.CHARACTER_MESSAGE_RENDERED, handler: handlers.sameFloorSettle },
        { key: 'rename', type: et.CHAT_RENAMED, handler: handlers.rename },
    ]);
    return handlers;
}
