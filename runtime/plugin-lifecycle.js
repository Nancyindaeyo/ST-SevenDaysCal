// 插件总开关：后台中止、注入清理、重开后恢复。各 controller 必须显式注入，缺端口直接抛错。

export const PLUGIN_DISABLE_REASON = 'plugin-disabled';

export const BACKGROUND_ABORT_PORTS = Object.freeze([
    Object.freeze({ port: 'memory.abortAll', args: 'reason' }),
    Object.freeze({ port: 'timeTravel.abortAll', args: 'reason' }),
    Object.freeze({ port: 'customDialog.cancelActive', args: 'none' }),
    Object.freeze({ port: 'lines.abortGeneration', args: 'generation' }),
    Object.freeze({ port: 'linesRuntime.abort', args: 'reason' }),
    Object.freeze({ port: 'abortPointSchedule', args: 'reason' }),
    Object.freeze({ port: 'abortDateDetection', args: 'reason' }),
    Object.freeze({ port: 'abortAutoRegen', args: 'reason' }),
    Object.freeze({ port: 'abortLedgerCapture', args: 'reason' }),
    Object.freeze({ port: 'abortLedgerJudge', args: 'reason' }),
    Object.freeze({ port: 'outline.abortAll', args: 'reason' }),
    Object.freeze({ port: 'space.abortAll', args: 'reason' }),
    Object.freeze({ port: 'dashed.abort', args: 'reason' }),
    Object.freeze({ port: 'refresh.abort', args: 'reason' }),
    Object.freeze({ port: 'floorQueue.abort', args: 'reason' }),
    Object.freeze({ port: 'floorQueue.resetFailed', args: 'none' }),
    Object.freeze({ port: 'syncFabFailed', args: 'none' }),
    Object.freeze({ port: 'theater.onPluginDisabled', args: 'none' }),
    Object.freeze({ port: 'axisGeneration.reset', args: 'reason' }),
    Object.freeze({ port: 'ledgerJudge.reset', args: 'reason' }),
    Object.freeze({ port: 'ledgerCapture.reset', args: 'reason' }),
    Object.freeze({ port: 'reloadOutlineChatIfOpen', args: 'none' }),
]);

function readPath(root, path) {
    return String(path || '').split('.').reduce((obj, key) => obj?.[key], root);
}

function portArgs(spec, reason) {
    if (spec.args === 'reason') return [reason];
    if (spec.args === 'generation') return [{ reason }];
    return [];
}

export function invokeAbortPort(h, spec, reason) {
    const fn = readPath(h, spec.port);
    if (typeof fn !== 'function') throw new Error(`[SP lifecycle] missing abort port: ${spec.port}`);
    const ownerPath = spec.port.includes('.') ? spec.port.slice(0, spec.port.lastIndexOf('.')) : null;
    const owner = ownerPath ? readPath(h, ownerPath) : h;
    return fn.apply(owner, portArgs(spec, reason));
}

export function abortAllBackground(h, reason = PLUGIN_DISABLE_REASON) {
    const ctx = h.context?.() || {};
    if (typeof h.traceAbort !== 'function') throw new Error('[SP lifecycle] missing abort port: traceAbort');
    h.traceAbort({
        module: 'runtime',
        chatId: ctx.chatId ?? null,
        chatRevision: h.chatRevision?.(),
        boundaryEpoch: h.boundaryEpoch?.(),
        abortReason: reason,
        status: 'dispatch',
    });
    for (const spec of BACKGROUND_ABORT_PORTS) invokeAbortPort(h, spec, reason);
}

export function applyPluginEnabled(h, on) {
    if (on) {
        try { h.theater?.openIfActive?.(); } catch {}
        try { h.showFab?.(); } catch {}
        try { h.backfillInline?.(); } catch {}
        try { h.refreshOutlineInjection?.(); } catch {}
        try { h.refreshCoordinateButtons?.(); } catch {}
        try { h.refreshInline?.(); } catch {}
        try { h.applyBoundCalendar?.(); } catch {}
    } else {
        try { h.slip?.flush?.(); } catch {}
        try { h.coordinate?.close?.(); } catch {}
        try { h.hideFab?.(); } catch {}
        try { h.clearInline?.(); } catch {}
        abortAllBackground(h);
        try { h.clearLinesInjection?.(); } catch {}
        try { h.clearOutlineInjection?.(); } catch {}
        try { h.clearLedgerInjection?.(); } catch {}
    }
    try { h.refreshStoryClock?.({ announce: true }); } catch {}
    try { h.paintPaceSoon?.(); } catch {}
}

export function createPluginLifecycle(h) {
    return {
        abortAllBackground: (reason = PLUGIN_DISABLE_REASON) => abortAllBackground(h, reason),
        applyPluginEnabled: on => applyPluginEnabled(h, on),
    };
}
