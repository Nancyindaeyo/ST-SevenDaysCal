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

export const LIFECYCLE_EFFECTS = Object.freeze({
    enable: Object.freeze([
        Object.freeze({ port: 'theater.openIfActive', level: 'best-effort' }),
        Object.freeze({ port: 'showFab', level: 'best-effort' }),
        Object.freeze({ port: 'backfillInline', level: 'best-effort' }),
        Object.freeze({ port: 'refreshOutlineInjection', level: 'critical' }),
        Object.freeze({ port: 'refreshCoordinateButtons', level: 'best-effort' }),
        Object.freeze({ port: 'refreshInline', level: 'best-effort' }),
        Object.freeze({ port: 'applyBoundCalendar', level: 'best-effort' }),
    ]),
    disableBeforeAbort: Object.freeze([
        Object.freeze({ port: 'slip.flush', level: 'critical', falseIsFailure: true }),
        Object.freeze({ port: 'law.flush', level: 'critical', falseIsFailure: true }),
        Object.freeze({ port: 'coordinate.close', level: 'best-effort' }),
        Object.freeze({ port: 'hideFab', level: 'best-effort' }),
        Object.freeze({ port: 'clearInline', level: 'best-effort' }),
    ]),
    disableAfterAbort: Object.freeze([
        Object.freeze({ port: 'clearLinesInjection', level: 'critical' }),
        Object.freeze({ port: 'clearOutlineInjection', level: 'critical' }),
        Object.freeze({ port: 'clearLedgerInjection', level: 'critical' }),
        Object.freeze({ port: 'clearLawInjection', level: 'critical' }),
    ]),
    finish: Object.freeze([
        Object.freeze({ port: 'refreshStoryClock', level: 'critical', args: [{ announce: true }] }),
        Object.freeze({ port: 'paintPaceSoon', level: 'best-effort' }),
    ]),
});

function lifecycleFailure(spec, error) {
    return Object.freeze({
        port: spec.port,
        level: spec.level,
        critical: spec.level === 'critical',
        message: String(error?.message || error || 'unknown-error').slice(0, 200),
        errorClass: String(error?.name || 'error').toLowerCase(),
    });
}

function reportLifecycleFailure(h, failure, failures, async = false) {
    if (!async) failures.push(failure);
    try { h.traceLifecycleFailure?.(failure); } catch {}
    if (async) {
        try { h.reportLifecycleFailures?.([failure]); } catch {}
    }
}

function invokeLifecycleEffect(h, spec, failures) {
    const fn = readPath(h, spec.port);
    if (typeof fn !== 'function') {
        if (spec.level === 'critical') reportLifecycleFailure(h, lifecycleFailure(spec, new Error(`missing lifecycle port: ${spec.port}`)), failures);
        return;
    }
    const ownerPath = spec.port.includes('.') ? spec.port.slice(0, spec.port.lastIndexOf('.')) : null;
    const owner = ownerPath ? readPath(h, ownerPath) : h;
    try {
        const result = fn.apply(owner, spec.args || []);
        if (spec.falseIsFailure && result === false) {
            reportLifecycleFailure(h, lifecycleFailure(spec, new Error(`${spec.port} returned false`)), failures);
            return;
        }
        if (result && typeof result.then === 'function') {
            result.catch(error => reportLifecycleFailure(h, lifecycleFailure(spec, error), failures, true));
        }
    } catch (error) {
        reportLifecycleFailure(h, lifecycleFailure(spec, error), failures);
    }
}

export function applyPluginEnabled(h, on) {
    const failures = [];
    if (on) {
        for (const spec of LIFECYCLE_EFFECTS.enable) invokeLifecycleEffect(h, spec, failures);
    } else {
        for (const spec of LIFECYCLE_EFFECTS.disableBeforeAbort) invokeLifecycleEffect(h, spec, failures);
        try { abortAllBackground(h); }
        catch (error) {
            reportLifecycleFailure(h, lifecycleFailure({ port: 'abortAllBackground', level: 'critical' }, error), failures);
        }
        for (const spec of LIFECYCLE_EFFECTS.disableAfterAbort) invokeLifecycleEffect(h, spec, failures);
    }
    for (const spec of LIFECYCLE_EFFECTS.finish) invokeLifecycleEffect(h, spec, failures);
    if (failures.length) {
        try { h.reportLifecycleFailures?.(failures); } catch {}
    }
    return { ok: !failures.some(item => item.critical), failures };
}

export function createPluginLifecycle(h) {
    return {
        abortAllBackground: (reason = PLUGIN_DISABLE_REASON) => abortAllBackground(h, reason),
        applyPluginEnabled: on => applyPluginEnabled(h, on),
    };
}
