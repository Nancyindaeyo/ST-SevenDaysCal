import { createGenerationDiagnosticScope, diagnosticMessage, makeDiagnosticError } from '../../api/diagnostics.js';
import { itemsFromPatches } from '../activity/diff.js';
import { alignSourceOf, floorUnchangedNote } from '../activity/schema.js';
import { pointDayEventGap } from '../point/horizon.js';
import { pointTodayDayIndex } from '../point/shift.js';
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

function writeRejected(saved) {
    if (saved === true) return false;
    return !saved || typeof saved !== 'object' || saved.ok !== true || saved.stale === true;
}

export function createRefreshController(env = {}) {
    let busy = false;
    let lastFloor = -1;
    let counter = 0;
    let lastReconcileFloor = -1;
    let generation = null;
    const stagger = env.stagger || createStaggerGate();
    const selectedOf = options => normalizeRefreshSelection(options?.selected || []);
    const snapshotSelected = names => env.snapshotModules?.(names) || {};
    const linesOn = () => env.linesEnabled?.() !== false;

    function endGeneration(token) {
        if (generation === token) {
            generation = null;
            busy = false;
        }
    }

    function abort(reason = 'manual-abort') {
        const current = generation;
        generation = null;
        busy = false;
        current?.controller?.abort(reason);
    }

    function beginGeneration(kind) {
        if (busy) return null;
        const token = { kind, controller: kind === 'align' ? new AbortController() : null };
        generation = token;
        busy = true;
        return token;
    }

    function ownerStillHere(token, ownerChatId) {
        return generation === token && String(env.context?.()?.chatId ?? '') === ownerChatId;
    }

    async function align(options = {}) {
        const token = beginGeneration('align');
        if (!token) return { status: 'skipped', reason: 'busy' };
        let selected = selectedOf(options).filter(name => name === 'point' || name === 'lines');
        if (!linesOn()) selected = selected.filter(name => name !== 'lines');
        if (!selected.length) {
            endGeneration(token);
            return { status: 'skipped', reason: 'none' };
        }
        const ctx = env.context?.() || {};
        const ownerChatId = String(ctx.chatId ?? '');
        const latest = latestAiFloor(ctx.chat);
        const latestStory = env.cleanText?.(latest?.text || '') || String(latest?.text || '');
        const cfg = env.loadConfig?.() || {};
        const activityBase = () => ({
            source: alignSourceOf(options),
            cause: options.cause || (options.auto ? 'auto' : 'manual'),
            floorId: latest?.index,
            swipeId: ctx.chat?.[latest?.index]?.swipe_id,
            signature: env.floorSignature?.(latest?.index),
        });
        const recordFailed = error => {
            env.onActivity?.({
                ...activityBase(),
                outcome: 'failed',
                error: diagnosticMessage(error),
                note: diagnosticMessage(error),
            });
        };
        if (options.signal) {
            if (options.signal.aborted) token.controller.abort(options.signal.reason ?? 'external-abort');
            else options.signal.addEventListener('abort', () => token.controller.abort(options.signal.reason ?? 'external-abort'), { once: true });
        }
        const diagnostic = createGenerationDiagnosticScope('ledger-reconcile', { background: options.auto === true || options.cause === 'reroll' || options.cause === 'retry' });
        if (!String(latestStory).trim()) {
            const error = new Error('没有可读的最新 AI 楼正文');
            recordFailed(error);
            endGeneration(token);
            return { status: 'failed', error };
        }
        if (!cfg.url || !cfg.key) {
            const error = makeDiagnosticError('config-missing');
            recordFailed(error);
            endGeneration(token);
            return { status: 'failed', error };
        }
        try {
            const pointRaw = selected.includes('point') ? String(env.readPointRaw?.() || '') : '';
            const linesRaw = selected.includes('lines') ? String(env.readLinesRaw?.() || '') : '';
            if (!pointRaw && !linesRaw) return { status: 'skipped', reason: 'empty' };
            const before = snapshotSelected(selected);
            const todayDayIndex = pointRaw ? pointTodayDayIndex(pointRaw, env.today?.(), env.calendar?.()) : null;
            const todayDayNumber = todayDayIndex == null ? 1 : todayDayIndex + 1;
            const prompt = buildReconcilePrompt({
                userName: ctx.name1 || '用户',
                charName: ctx.name2 || '角色',
                latestStory,
                pointRaw,
                linesRaw,
                reason: options.reason,
                feedback: options.feedback,
                promptAddon: options.promptAddon,
                todayGap: pointRaw && todayDayIndex != null ? pointDayEventGap(pointRaw, todayDayIndex, env.calendar?.()) : 0,
                todayDayNumber,
            });
            const raw = await env.callApi?.(ctx, prompt, cfg, ctx.name1 || '用户', ctx.name2 || '角色', token.controller.signal, 5, { promptMode: 'mechanical', diagnosticModule: 'ledger-reconcile', diagnosticSink: diagnostic.sink, fullMemory: false });
            if (!ownerStillHere(token, ownerChatId)) return { status: 'cancelled', reason: 'chat-changed' };
            const parsed = parseReconcilePatches(raw);
            const point = selected.includes('point') && pointRaw ? applyPointPatches(pointRaw, parsed.patches, { feedback: options.feedback, calendar: env.calendar?.() }) : { changed: false, raw: pointRaw, skippedLocks: [] };
            const lines = selected.includes('lines') && linesRaw ? applyLinePatches(linesRaw, parsed.patches, { feedback: options.feedback }) : { changed: false, raw: linesRaw, skippedLocks: [] };
            const ownerGuard = () => ownerStillHere(token, ownerChatId);
            if (point.changed && lines.changed) {
                if (typeof env.writeBatchRaw !== 'function') return { status: 'cancelled', reason: 'atomic-write-unavailable' };
                const saved = await env.writeBatchRaw({ point: point.raw, lines: lines.raw }, { ownerGuard });
                if (writeRejected(saved) || !ownerStillHere(token, ownerChatId)) return { status: 'cancelled', reason: saved?.reason || 'chat-changed' };
            } else {
                if (point.changed) {
                    const saved = await env.writePointRaw?.(point.raw, { ownerGuard });
                    if (writeRejected(saved) || !ownerStillHere(token, ownerChatId)) return { status: 'cancelled', reason: saved?.reason || 'chat-changed' };
                }
                if (lines.changed) {
                    const saved = await env.writeLinesRaw?.(lines.raw, { ownerGuard });
                    if (writeRejected(saved) || !ownerStillHere(token, ownerChatId)) return { status: 'cancelled', reason: saved?.reason || 'chat-changed' };
                }
            }
            diagnostic.accepted({ phase: 'validation', reasonCode: parsed.unchanged ? 'reconcile-unchanged' : 'reconcile-patched' });
            const summary = summarizeReconcile({ point, lines, note: parsed.note });
            env.onPatched?.({ point: point.changed, lines: lines.changed });
            const after = snapshotSelected(selected);
            const items = itemsFromPatches(point, lines);
            const patched = point.changed || lines.changed;
            env.onActivity?.({
                ...activityBase(),
                outcome: patched ? 'patched' : 'unchanged',
                items,
                snapshot: patched ? before : null,
                after: patched ? after : null,
                note: patched ? parsed.note : [floorUnchangedNote(latest?.index), parsed.note].filter(Boolean).join('。'),
            });
            return { status: 'updated', summary, items, unchanged: !patched, skippedLocks: [...(point.skippedLocks || []), ...(lines.skippedLocks || [])] };
        } catch (error) {
            if (error?.name === 'AbortError') return { status: 'cancelled' };
            diagnostic.rejected?.(error, { phase: 'request' });
            recordFailed(error);
            return { status: 'failed', error };
        } finally { endGeneration(token); }
    }

    async function regenerate(options = {}) {
        const token = beginGeneration('regen');
        if (!token) return { status: 'skipped', reason: 'busy' };
        try {
            const selected = selectedOf(options);
            if (!selected.length) return { status: 'skipped', reason: 'none' };
            const reason = String(options.reason || '').trim();
            if (!reason) return { status: 'invalid', reason: 'need-reason' };
            const addon = buildRefreshAddon({ reason, feedback: options.feedback, align: false });
            const travel = { feedback: 'refresh-bar', promptAddon: addon };
            const before = snapshotSelected(selected);
            const results = {};
            if (selected.includes('point')) results.point = await env.regenPoint?.(travel);
            if (generation !== token) return { status: 'cancelled', reason: 'aborted' };
            if (selected.includes('lines')) results.lines = await env.regenLines?.(travel);
            if (generation !== token) return { status: 'cancelled', reason: 'aborted' };
            if (selected.includes('dashed')) results.dashed = await env.regenDashed?.({ reroll: true, manual: true, promptAddon: addon });
            if (generation !== token) return { status: 'cancelled', reason: 'aborted' };
            if (selected.includes('outline')) results.outline = await env.regenOutline?.({ reroll: true, module: 'outline', promptAddon: addon, mode: options.outlineMode || 'current' });
            if (generation !== token) return { status: 'cancelled', reason: 'aborted' };
            const after = snapshotSelected(selected);
            env.onActivity?.({ source: 'refresh', snapshot: before, after });
            return { status: 'updated', results };
        } finally { endGeneration(token); }
    }

    async function onAiFloor(messageId) {
        if (!env.enabled?.()) return { status: 'skipped' };
        if (env.pluginEnabled?.() === false) return { status: 'skipped' };
        const ctx = env.context?.() || {};
        const chat = ctx.chat;
        if (!Array.isArray(chat) || messageId !== chat.length - 1) return { status: 'skipped' };
        const message = chat[messageId];
        if (!message || message.is_user || message.is_system) return { status: 'skipped' };
        if (messageId <= lastFloor) return { status: 'skipped', reason: 'seen' };
        if (env.sameFloor?.() === true) {
            lastFloor = messageId;
            return { status: 'skipped', reason: 'seen' };
        }
        lastFloor = messageId;
        if (env.isSuppressed?.(messageId)) return { status: 'skipped', reason: 'time-travel' };
        const interval = Math.max(1, Math.floor(Number(env.interval?.()) || 3));
        if (++counter < interval) return { status: 'skipped', reason: 'interval' };
        counter = 0;
        lastReconcileFloor = messageId;
        const selected = ['point', ...(linesOn() ? ['lines'] : [])];
        const result = await align({ auto: true, selected, cause: 'auto' });
        if (result?.status === 'failed') env.toastAlways?.(`点/线对齐失败：${diagnosticMessage(result.error)}`, true);
        return result;
    }

    let lastRerollKey = '';
    async function onRerollAlign(messageId) {
        if (!env.enabled?.()) return { status: 'skipped' };
        if (env.pluginEnabled?.() === false) return { status: 'skipped' };
        if (env.rerollEnabled?.() === false) return { status: 'skipped', reason: 'off' };
        const ctx = env.context?.() || {};
        const chat = ctx.chat;
        if (!Array.isArray(chat) || messageId !== chat.length - 1) return { status: 'skipped' };
        if (lastReconcileFloor !== Number(messageId)) return { status: 'skipped', reason: 'not-align-floor' };
        if (env.isSuppressed?.(messageId)) return { status: 'skipped', reason: 'time-travel' };
        const key = `${messageId}:${env.floorSignature?.(messageId) || ''}`;
        if (lastRerollKey === key) return { status: 'skipped', reason: 'already' };
        lastRerollKey = key;
        if (typeof env.rerollAlign === 'function') return env.rerollAlign({ messageId });
        const selected = ['point', ...(linesOn() ? ['lines'] : [])];
        return align({
            auto: true,
            selected,
            cause: 'reroll',
            reason: '这楼重 roll 了，请按最新 AI 楼重新校对未锁的点和线。',
        });
    }

    return {
        align, regenerate, onAiFloor, onRerollAlign, abort, stagger,
        resetCounter: () => { counter = 0; lastFloor = -1; lastReconcileFloor = -1; lastRerollKey = ''; stagger.reset(); },
        hydrate(state = {}) {
            counter = Math.max(0, Math.floor(Number(state.counter) || 0));
            lastFloor = Number.isInteger(Number(state.lastFloor)) ? Number(state.lastFloor) : -1;
            lastReconcileFloor = Number.isInteger(Number(state.lastReconcileFloor)) ? Number(state.lastReconcileFloor) : -1;
            stagger.hydrate?.({ pendingAdvance: state.pendingAdvance === true, pendingDashed: state.pendingDashed === true });
        },
        didReconcile: messageId => lastReconcileFloor === Number(messageId),
        state: () => ({ counter, lastFloor, lastReconcileFloor, busy, pendingAdvance: stagger.pendingAdvance, pendingDashed: stagger.pendingDashed }),
        get busy() { return busy; },
    };
}
