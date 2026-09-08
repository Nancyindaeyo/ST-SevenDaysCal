import { createGenerationDiagnosticScope, diagnosticMessage, makeDiagnosticError } from '../../api/diagnostics.js';
import { clampBeatShots, parseBeatShots } from './schema.js';
import { buildBeatPrompt } from './prompt.js';

export function createBeatController(env = {}) {
    let shots = [];
    let busy = false;
    let abortController = null;

    const setShots = next => {
        shots = clampBeatShots(next);
        env.onChange?.(shots);
        return shots;
    };

    const abort = (reason = 'manual-abort') => {
        abortController?.abort(reason);
        busy = false;
    };

    const generate = async () => {
        if (busy) return { status: 'busy' };
        const cfg = env.loadConfig?.() || {};
        if (!cfg.url || !cfg.key) {
            env.openSettings?.();
            return { status: 'failed', error: makeDiagnosticError('config-missing') };
        }
        busy = true;
        const controller = new AbortController();
        abortController = controller;
        env.onBusy?.(true);
        const diagnostic = createGenerationDiagnosticScope('beat');
        try {
            const ctx = env.context?.() || {};
            const prompt = buildBeatPrompt(env.collectContext?.() || {});
            const raw = await env.callApi?.(
                ctx,
                prompt,
                cfg,
                ctx.name1 || '用户',
                ctx.name2 || '角色',
                controller.signal,
                3,
                { promptMode: 'creative', diagnosticModule: 'beat', diagnosticSink: diagnostic.sink },
            );
            if (abortController !== controller || controller.signal.aborted) return { status: 'cancelled' };
            const parsed = parseBeatShots(raw);
            if (parsed.length < 4) {
                const error = diagnostic.rejected(makeDiagnosticError('parse', { phase: 'parse' }), { phase: 'parse', reasonCode: 'beat-count' });
                env.toast?.('本轮拍需要 4～5 条短大纲，这次没有解析出来', true);
                return { status: 'failed', error };
            }
            diagnostic.accepted({ phase: 'validation', reasonCode: 'beat-valid' });
            setShots(parsed);
            return { status: 'updated', shots };
        } catch (error) {
            if (error?.name === 'AbortError') return { status: 'cancelled' };
            diagnostic.rejected(error, { phase: 'request' });
            env.toast?.(`本轮拍失败：${diagnosticMessage(error)}`, true);
            return { status: 'failed', error };
        } finally {
            if (abortController === controller) abortController = null;
            busy = false;
            env.onBusy?.(false);
        }
    };

    return {
        generate,
        abort,
        reset: () => setShots([]),
        updateShot(index, patch) {
            shots = clampBeatShots(shots.map((shot, i) => (i === Number(index) ? { ...shot, ...patch } : shot)));
            return shots;
        },
        get shots() { return shots; },
        get busy() { return busy; },
    };
}
