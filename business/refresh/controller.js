import { createGenerationDiagnosticScope, diagnosticMessage, makeDiagnosticError } from '../../api/diagnostics.js';
import { itemsFromPatches } from '../activity/diff.js';
import { buildReconcilePrompt, buildRefreshAddon } from './prompt.js';
import { applyLinePatches, applyPointPatches, parseReconcilePatches, summarizeReconcile } from './patch.js';
import { normalizeRefreshSelection } from './bar.js';
import { createStaggerGate } from './stagger.js';

export function latestAiFloor(chat = []) {
    for (let i = (chat || []).length - 1; i >= 0; i--) {
        const message = chat[i];
        if (!message || message.is_user || message.is_system) continue;
        return { index: i, text: String(message.mes || message.mes_html || '') };
    }
    return null;
}

export function createRefreshController(env = {}) {
    let busy = false;
    let lastFloor = -1;
    let counter = 0;
    let lastReconcileFloor = -1;
    const stagger = env.stagger || createStaggerGate();
    const selectedOf = options => normalizeRefreshSelection(options?.selected || []);
    const snapshotSelected = names => env.snapshotModules?.(names) || {};

    async function align(options = {}) {
        if (busy) return { status: 'skipped', reason: 'busy' };
        const selected = selectedOf(options).filter(name => name === 'point' || name === 'lines');
        if (!selected.length) return { status: 'skipped', reason: 'none' };
        const ctx = env.context?.() || {};
        const latest = latestAiFloor(ctx.chat);
        const latestStory = env.cleanText?.(latest?.text || '') || String(latest?.text || '');
        if (!String(latestStory).trim()) return { status: 'failed', error: new Error('没有可读的最新 AI 楼正文') };
        const cfg = env.loadConfig?.() || {};
        if (!cfg.url || !cfg.key) return { status: 'failed', error: makeDiagnosticError('config-missing') };
        busy = true;
        const diagnostic = createGenerationDiagnosticScope('ledger-reconcile', { background: options.auto === true });
        try {
            const pointRaw = selected.includes('point') ? String(env.readPointRaw?.() || '') : '';
            const linesRaw = selected.includes('lines') ? String(env.readLinesRaw?.() || '') : '';
            if (!pointRaw && !linesRaw) return { status: 'skipped', reason: 'empty' };
            const before = snapshotSelected(selected);
            const prompt = buildReconcilePrompt({
                userName: ctx.name1 || '用户',
                charName: ctx.name2 || '角色',
                latestStory,
                pointRaw,
                linesRaw,
                reason: options.reason,
                feedback: options.feedback,
            });
            const raw = await env.callApi?.(ctx, prompt, cfg, ctx.name1 || '用户', ctx.name2 || '角色', options.signal || null, 5, { promptMode: 'mechanical', diagnosticModule: 'ledger-reconcile', diagnosticSink: diagnostic.sink, fullMemory: false });
            const parsed = parseReconcilePatches(raw);
            const point = selected.includes('point') && pointRaw ? applyPointPatches(pointRaw, parsed.patches, { feedback: options.feedback, calendar: env.calendar?.() }) : { changed: false, raw: pointRaw, skippedLocks: [] };
            const lines = selected.includes('lines') && linesRaw ? applyLinePatches(linesRaw, parsed.patches, { feedback: options.feedback }) : { changed: false, raw: linesRaw, skippedLocks: [] };
            if (point.changed) await env.writePointRaw?.(point.raw);
            if (lines.changed) await env.writeLinesRaw?.(lines.raw);
            diagnostic.accepted({ phase: 'validation', reasonCode: parsed.unchanged ? 'reconcile-unchanged' : 'reconcile-patched' });
            const summary = summarizeReconcile({ point, lines, note: parsed.note });
            env.onPatched?.({ point: point.changed, lines: lines.changed });
            const after = snapshotSelected(selected);
            const items = itemsFromPatches(point, lines);
            if (point.changed || lines.changed) {
                env.onActivity?.({
                    source: options.auto ? 'align-auto' : 'align',
                    items,
                    snapshot: before,
                    after,
                });
            }
            return { status: 'updated', summary, items, unchanged: parsed.unchanged && !point.changed && !lines.changed, skippedLocks: [...(point.skippedLocks || []), ...(lines.skippedLocks || [])] };
        } catch (error) {
            if (error?.name === 'AbortError') return { status: 'cancelled' };
            diagnostic.rejected?.(error, { phase: 'request' });
            return { status: 'failed', error };
        } finally { busy = false; }
    }

    async function regenerate(options = {}) {
        const selected = selectedOf(options);
        if (!selected.length) return { status: 'skipped', reason: 'none' };
        const reason = String(options.reason || '').trim();
        if (!reason) return { status: 'invalid', reason: 'need-reason' };
        const addon = buildRefreshAddon({ reason, feedback: options.feedback, align: false });
        const travel = { feedback: 'refresh-bar', promptAddon: addon };
        const before = snapshotSelected(selected);
        const results = {};
        if (selected.includes('point')) results.point = await env.regenPoint?.(travel);
        if (selected.includes('lines')) results.lines = await env.regenLines?.(travel);
        if (selected.includes('dashed')) results.dashed = await env.regenDashed?.({ reroll: true, manual: true, promptAddon: addon });
        if (selected.includes('outline')) results.outline = await env.regenOutline?.({ reroll: true, module: 'outline', promptAddon: addon, mode: options.outlineMode || 'current' });
        const after = snapshotSelected(selected);
        env.onActivity?.({ source: 'refresh', snapshot: before, after });
        return { status: 'updated', results };
    }

    async function onAiFloor(messageId) {
        if (!env.enabled?.()) return { status: 'skipped' };
        if (env.pluginEnabled?.() === false) return { status: 'skipped' };
        const ctx = env.context?.() || {};
        const chat = ctx.chat;
        if (!Array.isArray(chat) || messageId !== chat.length - 1) return { status: 'skipped' };
        const message = chat[messageId];
        if (!message || message.is_user || message.is_system) return { status: 'skipped' };
        if (messageId <= lastFloor) return { status: 'skipped' };
        lastFloor = messageId;
        if (env.isSuppressed?.(messageId)) return { status: 'skipped', reason: 'time-travel' };
        const interval = Math.max(1, Math.floor(Number(env.interval?.()) || 3));
        if (++counter < interval) return { status: 'skipped', reason: 'interval' };
        counter = 0;
        const result = await align({ auto: true, selected: ['point', 'lines'] });
        if (result?.status === 'updated' || result?.status === 'failed') lastReconcileFloor = messageId;
        if (result?.status === 'failed') env.toastAlways?.(`点/线对齐失败：${diagnosticMessage(result.error)}`, true);
        return result;
    }

    return {
        align, regenerate, onAiFloor, stagger,
        resetCounter: () => { counter = 0; lastFloor = -1; lastReconcileFloor = -1; stagger.reset(); },
        didReconcile: messageId => lastReconcileFloor === Number(messageId),
        get busy() { return busy; },
    };
}
