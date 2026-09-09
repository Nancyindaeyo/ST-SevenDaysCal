export const STORE_CLEAR_EMPTY_SCHEDULE_HTML = '<div class="sp-empty"><i class="fa-regular fa-calendar"></i><p>还没有点</p><button class="sp-gen-btn" id="sp-gen-schedule-now">生成点</button></div>';
export const STORE_CLEAR_EMPTY_LINES_HTML = '<div class="sp-empty"><i class="fa-solid fa-diagram-project"></i><p>还没有追踪的线，可以生成一版</p><button class="sp-gen-btn" id="sp-gen-lines-now">生成线</button></div>';

export function dispatchStoreClearInvalidate(kind, env = {}) {
    env.trace?.(kind);
    if (kind === 'schedule') env.abortSchedule?.();
    else if (kind === 'outline' || kind === 'creative-chat') env.invalidateOutline?.(kind);
    else if (kind === 'lines') env.abortLines?.();
    else if (kind === 'space-chat') env.invalidateSpace?.(kind);
    else if (kind === 'dashed') env.abortDashed?.();
}

export function dispatchStoreClearRefreshAfter(kind, env = {}) {
    if (kind === 'schedule') env.refreshScheduleEmpty?.();
    if (kind === 'outline') env.refreshOutlineEmpty?.(kind);
    if (kind === 'lines') env.refreshLinesEmpty?.();
    if (kind === 'dashed') env.refreshDashed?.();
    if (kind === 'creative-chat') env.refreshCreativeEmpty?.(kind);
    if (kind === 'space-chat') env.refreshSpaceEmpty?.(kind);
}

export function dispatchStoreClearRefreshFromStore(kind, env = {}) {
    if (kind === 'schedule') env.refreshScheduleFromStore?.();
    else if (kind === 'outline') env.refreshOutlineFromStore?.(kind);
    else if (kind === 'lines') env.refreshLinesFromStore?.();
    else if (kind === 'creative-chat') env.refreshCreativeFromStore?.(kind);
    else if (kind === 'space-chat') env.refreshSpaceFromStore?.(kind);
    else if (kind === 'dashed') env.refreshDashedFromStore?.();
}
