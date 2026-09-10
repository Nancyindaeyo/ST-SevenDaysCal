import {
    TIME_TRAVEL_DIRECTION_OPTIONS,
    buildTravelDirectionPrompt,
    buildTravelStoryPrompt,
    createTimeTravelController,
    formatTravelDate,
    parseTravelDirections,
    sameMonthDay,
} from '../../time-travel.js';
import {
    collectTimeTravelContext,
    isTimeTravelSelectionCurrent,
    runTimeTravelDirectionFlow,
    timeTravelAbortReason,
    travelAnniversaryCoverage,
} from './time-travel-session.js';

function abortError(message) {
    return Object.assign(new Error(message), { name: 'AbortError' });
}

// 时旅宿主：控制器仍只跑步骤；这里管独占闸 token、方向选择 run、开始/取消/清会话。
// 装配根只注入日历/生成/对话框等端口，不再堆会话胶水。
export function createTimeTravelHost(env = {}) {
    const claimTokens = env.claimTokens || new Map();
    let selectionSeq = 0;
    let activeSelection = null;

    function releaseClaim(sessionId) {
        const token = claimTokens.get(sessionId);
        if (!token) return;
        claimTokens.delete(sessionId);
        env.automationGate?.release?.(token);
    }

    function clearClaims() {
        claimTokens.clear();
    }

    const createController = env.createController || createTimeTravelController;
    const controller = createController({
        getChatId: env.getChatId,
        getChat: env.getChat,
        getCalendar: env.getCalendar,
        resolveDestinationDate: env.resolveDestinationDate,
        onStateChange: env.onStateChange,
        onStepResult: env.onStepResult,
        onSequenceEnd: payload => {
            releaseClaim(payload?.sessionId);
            env.onSequenceEnd?.(payload);
        },
        onError: env.onError,
        steps: env.steps,
    });

    function resetSelection() {
        selectionSeq += 1;
        activeSelection = null;
    }

    function collectLiveContext(sourceDate, targetDate) {
        const calendar = env.getCalendar?.();
        return collectTimeTravelContext(sourceDate, targetDate, {
            calendar,
            weekdayFor: env.weekdayFor,
            weekdayRef: env.weekdayRef,
            weekdays: env.weekdays,
            readOutlineSnapshot: env.readOutlineSnapshot,
            readLines: env.readLines,
            terminalStages: env.terminalStages,
            injectionOn: env.injectionOn?.(),
            settings: env.settings?.(),
            ledgerEchoLength: env.ledgerEchoLength?.(),
            almanacItems: env.almanacItems?.(),
            coverage: (item, date, cal) => travelAnniversaryCoverage(item, date, cal, env.coverageHelpers?.() || {}),
            typeLabel: env.typeLabel,
        });
    }

    function isLiveSelection(run) {
        return isTimeTravelSelectionCurrent(run, {
            active: activeSelection,
            pluginEnabled: env.pluginEnabled?.(),
            chatId: env.getChatId?.(),
            travelState: controller.getState(),
            validTarget: env.validMonthDay?.(run.targetDate),
        });
    }

    async function start(targetDate) {
        const sourceDate = env.sourceDate?.();
        const validTarget = env.validMonthDay?.(targetDate);
        if (!validTarget || sameMonthDay(sourceDate, validTarget)) return false;
        const initialChatId = env.getChatId?.();
        const existing = controller.getState();
        if (existing?.phase === 'syncing') {
            env.toast?.('时光旅行正在同步，完成或中断后才能开始新的时旅');
            return false;
        }
        if (existing?.phase === 'waiting') {
            const confirmed = await env.confirm?.({
                title: '先中断旧的时光旅行？',
                body: '输入框里还有一段尚未发送的时旅指令。开始新的时旅会移除旧指令。',
                confirmText: '中断并继续',
                cancelText: '保留旧时旅',
            });
            const current = controller.getState();
            if (!current || current.sessionId !== existing.sessionId || current.phase !== existing.phase || env.getChatId?.() !== initialChatId) {
                env.toast?.('时旅状态已经变化，本次没有覆盖当前会话');
                return false;
            }
            if (!confirmed) return false;
            clearSession(existing, { removeWaitingBlock: true, reason: 'replaced' });
        }

        const run = {
            id: ++selectionSeq,
            chatId: initialChatId,
            sourceDate: { month: sourceDate.month, day: sourceDate.day },
            targetDate: { month: validTarget.month, day: validTarget.day },
        };
        activeSelection = run;
        try {
            return await runTimeTravelDirectionFlow({
                run,
                isCurrent: isLiveSelection,
                collectContext: collectLiveContext,
                jumpTitle: (date, cal) => `跳到 ${formatTravelDate(date, cal)}`,
                selectDirection: async ({ title, initialValue, customValue }) => env.selectOne?.({
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
                inject: env.inject,
                begin: payload => controller.begin(payload),
                backValue: '__back__',
                selectAiDirection: async ({ excluded, preference, run: directionRun, onDirections }) => env.selectOneAsync?.({
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
                        if (!isLiveSelection(directionRun)) throw abortError('时旅选择已结束');
                        const cfg = env.loadCfg?.() || {};
                        if (!cfg.url || !cfg.key) throw new Error('请先在设置中填写自定义 API 的 URL 和 Key；也可以返回后直接采用');
                        const live = collectLiveContext(directionRun.sourceDate, directionRun.targetDate);
                        const prompt = buildTravelDirectionPrompt({ ...live, preference, excluded });
                        const ctx = env.getContext?.() || {};
                        const raw = await env.callApi?.(ctx, prompt, cfg, ctx.name1 || '用户', ctx.name2 || '角色', signal, 10, {
                            temperature: env.temperature,
                            promptMode: 'creative',
                            diagnosticModule: 'time-travel-direction',
                        });
                        if (signal?.aborted || !isLiveSelection(directionRun)) throw abortError('时旅选择已结束');
                        const directions = parseTravelDirections(raw, excluded);
                        if (!directions.length) throw new Error('AI 没有返回可用方向，请刷新重试');
                        onDirections?.(directions);
                        return directions.map(value => ({ value, label: value }));
                    },
                }),
            });
        } finally {
            if (activeSelection === run) activeSelection = null;
        }
    }

    function clearSession(active = controller.getState(), { removeWaitingBlock = false, reason = 'cleared' } = {}) {
        if (!active) return false;
        const abortReason = timeTravelAbortReason(reason);
        env.traceAbort?.(active, abortReason);
        controller.clear(reason);
        // clear() 不触发 onSequenceEnd（controller 只在 handleRendered 收尾时发），闸/协调器须随取消显式释放，
        // 否则 token 滞留 → 后续正常自动化被误抑制（同 chatId+messageId 复活场景）或协调器内存滞留。
        clearClaims();
        env.automationGate?.clear?.();
        env.dateCoordinator?.clear?.();
        env.abortRelated?.(abortReason);
        if (removeWaitingBlock && active.phase === 'waiting') env.stripWaitingBlock?.();
        return true;
    }

    async function cancel() {
        const active = controller.getState();
        if (!active) return false;
        const waiting = active.phase === 'waiting';
        const confirmed = await env.confirm?.({
            title: waiting ? '取消这次时光旅行？' : '中止时光旅行同步？',
            body: waiting
                ? '确认后会移除输入框中尚未发送的时旅指令。'
                : '确认后会停止当前及后续同步；已经完成的模块更新会保留。',
            confirmText: waiting ? '取消时旅' : '中止同步',
            cancelText: '继续当前时旅',
        });
        const current = controller.getState();
        if (!current || current.sessionId !== active.sessionId || current.phase !== active.phase) {
            env.toast?.('时旅状态已经变化，本次没有中断当前会话');
            return false;
        }
        if (!confirmed) return false;
        clearSession(active, { removeWaitingBlock: waiting, reason: 'cancelled' });
        env.toast?.(waiting ? '已取消时光旅行' : '已中止时光旅行同步；已完成的更新会保留');
        return true;
    }

    function cancelForDeletion() {
        const active = controller.getState();
        if (!active) return false;
        const waiting = active.phase === 'waiting';
        clearSession(active, { removeWaitingBlock: waiting, reason: 'message-deleted' });
        env.toast?.(waiting
            ? '楼层已删除，未发送的时旅指令也已移除'
            : '楼层已删除，时旅同步已中止；已完成的更新会保留');
        return true;
    }

    function abortAll(reason = 'plugin-disabled') {
        const active = controller.getState();
        if (active) clearSession(active, { removeWaitingBlock: active.phase === 'waiting', reason });
        resetSelection();
        return !!active;
    }

    return {
        controller,
        claimTokens,
        releaseClaim,
        clearClaims,
        resetSelection,
        abortAll,
        start,
        cancel,
        cancelForDeletion,
        clearSession,
        getState: (...args) => controller.getState(...args),
        begin: (...args) => controller.begin(...args),
        clear: (...args) => controller.clear(...args),
        isInitialFloor: (...args) => controller.isInitialFloor(...args),
        handleRendered: (...args) => controller.handleRendered(...args),
    };
}
