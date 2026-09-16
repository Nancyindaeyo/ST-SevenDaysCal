// 清存储善后端口：abort / 空账刷新。分发仍走 storage-clear.js，这里不再包一层。
export function createStoreClearHost(env = {}) {
    return {
        trace(kind) {
            env.traceAbort?.({
                module: kind,
                chatId: env.chatId?.() ?? null,
                chatRevision: env.chatRevision?.(),
                boundaryEpoch: env.boundaryEpoch?.(),
                abortReason: 'store-clear',
                status: 'dispatch',
            });
        },
        abortSchedule() {
            env.abortPointSchedule?.('store-clear');
            env.abortAutoRegen?.('store-clear');
            env.setPointGenerating?.(false);
        },
        invalidateOutline: kind => env.outline?.invalidateStoreKind?.(kind),
        abortLines: () => env.lines?.abortGeneration?.({ reason: 'store-clear' }),
        invalidateSpace: kind => env.space?.invalidateStoreKind?.(kind),
        invalidateSlip: kind => env.slip?.invalidateStoreKind?.(kind),
        invalidateLaw: kind => env.law?.invalidateStoreKind?.(kind),
        abortDashed: () => env.lines?.dashed?.abort?.('store-clear'),
        refreshScheduleEmpty() {
            env.setPointCache?.(null);
            env.setBody?.(env.emptyPointHtml?.());
            env.syncScheduleBlock?.();
        },
        refreshOutlineEmpty: kind => {
            env.outline?.refreshAfterStoreClear?.(kind);
            env.syncInlineBlock?.();
        },
        refreshLinesEmpty() {
            env.resetLinesRuntime?.();
            if (env.linesMode?.()) env.lines?.renderBody?.(env.emptyLinesHtml?.());
            env.refreshLinesInjection?.();
            env.syncInlineBlock?.();
        },
        refreshDashed() {
            env.lines?.dashed?.resetError?.();
            if (env.linesMode?.()) env.lines?.refreshPanel?.();
            env.syncInlineBlock?.();
        },
        refreshCreativeEmpty: kind => env.outline?.refreshAfterStoreClear?.(kind),
        refreshSpaceEmpty: kind => env.space?.refreshAfterStoreClear?.(kind),
        refreshSlipEmpty: kind => env.slip?.refreshAfterStoreClear?.(kind),
        refreshLawEmpty: kind => env.law?.refreshAfterStoreClear?.(kind),
        refreshScheduleFromStore() {
            const saved = env.readPoint?.();
            const ctx = env.getContext?.() || {};
            const view = env.currentView?.();
            const charName = env.charViewName?.();
            const subject = view === 'char' ? (charName || ctx.name2 || '角色') : (ctx.name1 || '用户');
            const html = saved?.raw ? env.renderSchedule?.(saved.raw, saved.userName || subject) : null;
            env.setPointCache?.(html);
            if (env.scheduleVisible?.()) env.setBody?.(html || env.emptyPointHtml?.());
            env.syncScheduleBlock?.();
        },
        refreshOutlineFromStore: kind => env.outline?.refreshFromStore?.(kind),
        refreshLinesFromStore() {
            env.resetLinesRuntime?.();
            if (env.linesMode?.()) env.lines?.refreshPanel?.();
            env.refreshLinesInjection?.();
        },
        refreshCreativeFromStore: kind => env.outline?.refreshFromStore?.(kind),
        refreshSpaceFromStore: kind => env.space?.refreshFromStore?.(kind),
        refreshSlipFromStore: kind => env.slip?.refreshFromStore?.(kind),
        refreshLawFromStore: kind => env.law?.refreshFromStore?.(kind),
        refreshDashedFromStore() {
            env.lines?.dashed?.resetError?.();
            if (env.linesMode?.()) env.lines?.refreshPanel?.();
            env.syncInlineBlock?.();
        },
    };
}
