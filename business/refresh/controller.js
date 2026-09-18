import { createGenerationDiagnosticScope, diagnosticMessage, makeDiagnosticError } from '../../api/diagnostics.js';
import { itemsFromPatches, sameSnapshot } from '../activity/diff.js';
import { ACTIVITY_MODULES, alignSourceOf, floorUnchangedNote } from '../activity/schema.js';
import { pointDayEventGap } from '../point/horizon.js';
import { pointTodayDayIndex } from '../point/shift.js';
import { buildReconcilePrompt, buildRefreshAddon } from './prompt.js';
import { applyLinePatches, applyPointPatches, parseReconcilePatches, summarizeFight, summarizeReconcile } from './patch.js';
import { buildFightPrompt } from '../lamp/fight-prompt.js';
import { buildAlignStoryWindow, listAiStoryFloors } from '../lamp/story-window.js';
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

function refreshModuleLabel(name) {
    return ACTIVITY_MODULES[name] || name;
}

export function refreshBlockActivity(name, result, before = {}, after = {}) {
    const label = refreshModuleLabel(name);
    const snapshot = before?.[name] != null ? { [name]: before[name] } : {};
    const next = after?.[name] != null ? { [name]: after[name] } : {};
    if (result?.status === 'cancelled') {
        return {
            source: 'refresh',
            outcome: 'skipped',
            note: `刷新账本 · ${label} 已取消`,
            items: [{ module: name, title: label, action: 'replace' }],
        };
    }
    if (result?.status === 'skipped') {
        return {
            source: 'refresh',
            outcome: 'skipped',
            note: `刷新账本 · ${label} 跳过`,
            reasonCode: result.reason ? `refresh-${name}-${result.reason}` : `refresh-${name}-skipped`,
            items: [{ module: name, title: label, action: 'replace' }],
        };
    }
    if (!result || result.status === 'failed') {
        const error = diagnosticMessage(result?.error) || result?.errorMessage || '刷新失败';
        return {
            source: 'refresh',
            outcome: 'failed',
            error,
            reasonCode: result?.error?.diagnosticCode || result?.reasonCode || `refresh-${name}-failed`,
            note: `刷新账本 · ${label} 失败`,
            items: [{ module: name, title: label, action: 'replace' }],
        };
    }
    if (result.status === 'unchanged' || sameSnapshot(snapshot, next)) {
        return {
            source: 'refresh',
            outcome: 'unchanged',
            note: `刷新账本 · ${label} 没有变化`,
            items: [{ module: name, title: label, action: 'replace' }],
        };
    }
    return {
        source: 'refresh',
        outcome: 'patched',
        note: `刷新账本 · ${label} 已重做`,
        items: [{ module: name, title: label, action: 'replace' }],
        snapshot,
        after: next,
    };
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
        const token = { kind, controller: kind === 'align' || kind === 'fight' ? new AbortController() : null };
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
        let diagnostic;
        const recordFailed = error => {
            try {
                const latest = latestAiFloor(env.context?.()?.chat);
                env.onActivity?.({
                    source: alignSourceOf(options),
                    cause: options.cause || (options.auto ? 'auto' : 'manual'),
                    retry: {
                        kind: 'align',
                        selected: selectedOf(options).filter(name => name === 'point' || name === 'lines'),
                        reason: String(options.reason || ''),
                        feedback: String(options.feedback || ''),
                    },
                    floorId: latest?.index,
                    swipeId: env.context?.()?.chat?.[latest?.index]?.swipe_id,
                    signature: env.floorSignature?.(latest?.index),
                    outcome: 'failed',
                    error: diagnosticMessage(error),
                    note: diagnosticMessage(error),
                });
            } catch { /* 记失败不能再把 busy 卡死 */ }
        };
        try {
        let selected = selectedOf(options).filter(name => name === 'point' || name === 'lines');
        if (!linesOn()) selected = selected.filter(name => name !== 'lines');
        if (!selected.length) return { status: 'skipped', reason: 'none' };
        const ctx = env.context?.() || {};
        const ownerChatId = String(ctx.chatId ?? '');
        const latest = latestAiFloor(ctx.chat);
        const readStory = text => env.readFloorStory?.(text) || env.cleanText?.(text) || String(text || '');
        let storyHeading = '最新 AI 楼正文';
        let historyLimit = 5;
        let windowInfo = null;
        let latestStory = readStory(latest?.text || '');
        if (options.storyWindow === 'since-align') {
            windowInfo = typeof env.alignWindow === 'function'
                ? env.alignWindow()
                : buildAlignStoryWindow(listAiStoryFloors(ctx.chat, readStory), {
                    afterFloor: env.lastAlignFloor?.() ?? -1,
                });
            latestStory = windowInfo?.text || latestStory;
            if ((windowInfo?.count || 0) > 1) {
                storyHeading = '自上次对齐以来的正文';
                historyLimit = 0;
            }
        }
        const cfg = env.loadConfig?.() || {};
        const activityBase = () => ({
            source: alignSourceOf(options),
            cause: options.cause || (options.auto ? 'auto' : 'manual'),
            floorId: latest?.index,
            swipeId: ctx.chat?.[latest?.index]?.swipe_id,
            signature: env.floorSignature?.(latest?.index),
        });
        if (options.signal) {
            if (options.signal.aborted) token.controller.abort(options.signal.reason ?? 'external-abort');
            else options.signal.addEventListener('abort', () => token.controller.abort(options.signal.reason ?? 'external-abort'), { once: true });
        }
        diagnostic = createGenerationDiagnosticScope('ledger-reconcile', { background: options.auto === true || options.cause === 'reroll' || options.cause === 'retry' });
        if (!options.applyPatches && !String(latestStory).trim()) {
            const error = new Error('没有可读的最新 AI 楼正文');
            recordFailed(error);
            return { status: 'failed', error };
        }
        if (!options.applyPatches && (!cfg.url || !cfg.key)) {
            const error = makeDiagnosticError('config-missing');
            recordFailed(error);
            return { status: 'failed', error };
        }
            const pointRaw = selected.includes('point') ? String(env.readPointRaw?.() || '') : '';
            const linesRaw = selected.includes('lines') ? String(env.readLinesRaw?.() || '') : '';
            if (!pointRaw && !linesRaw) return { status: 'skipped', reason: 'empty' };
            const before = snapshotSelected(selected);
            const todayDayIndex = pointRaw ? pointTodayDayIndex(pointRaw, env.today?.(), env.calendar?.()) : null;
            const todayDayNumber = todayDayIndex == null ? 1 : todayDayIndex + 1;
            const windowAddon = options.storyWindow === 'since-align' && windowInfo?.count > 1
                ? `【这次对照的是自上次对齐以来的正文窗口（第 ${windowInfo.from}–${windowInfo.to} 楼），不是只看最新一楼】`
                : '';
            let parsed;
            if (Array.isArray(options.applyPatches)) {
                parsed = { note: String(options.note || ''), patches: options.applyPatches, unchanged: !options.applyPatches.length };
            } else {
                const prompt = buildReconcilePrompt({
                    userName: ctx.name1 || '用户',
                    charName: ctx.name2 || '角色',
                    latestStory,
                    pointRaw,
                    linesRaw,
                    reason: options.reason,
                    feedback: options.feedback,
                    promptAddon: [options.promptAddon, windowAddon].filter(Boolean).join('\n\n'),
                    todayGap: pointRaw && todayDayIndex != null ? pointDayEventGap(pointRaw, todayDayIndex, env.calendar?.()) : 0,
                    todayDayNumber,
                    storyHeading,
                });
                const raw = await env.callApi?.(ctx, prompt, cfg, ctx.name1 || '用户', ctx.name2 || '角色', token.controller.signal, historyLimit, { promptMode: 'mechanical', diagnosticModule: 'ledger-reconcile', diagnosticSink: diagnostic.sink, fullMemory: false });
                if (!ownerStillHere(token, ownerChatId)) return { status: 'cancelled', reason: 'chat-changed' };
                parsed = parseReconcilePatches(raw);
            }
            const point = selected.includes('point') && pointRaw ? applyPointPatches(pointRaw, parsed.patches, { feedback: options.feedback, calendar: env.calendar?.() }) : { changed: false, raw: pointRaw, skippedLocks: [], applied: [] };
            const lines = selected.includes('lines') && linesRaw ? applyLinePatches(linesRaw, parsed.patches, { feedback: options.feedback }) : { changed: false, raw: linesRaw, skippedLocks: [], applied: [] };
            const summary = summarizeReconcile({ point, lines, note: parsed.note });
            const items = itemsFromPatches(point, lines);
            const patched = point.changed || lines.changed;
            if (options.preview === true) {
                diagnostic.accepted({ phase: 'validation', reasonCode: parsed.unchanged ? 'reconcile-preview-unchanged' : 'reconcile-preview' });
                return {
                    status: 'preview',
                    patches: parsed.patches,
                    items,
                    note: parsed.note,
                    summary,
                    unchanged: !patched,
                    skippedLocks: [...(point.skippedLocks || []), ...(lines.skippedLocks || [])],
                    selected,
                    window: windowInfo,
                };
            }
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
            env.onPatched?.({ point: point.changed, lines: lines.changed });
            env.onAligned?.({ floorId: latest?.index });
            const after = snapshotSelected(selected);
            env.onActivity?.({
                ...activityBase(),
                retry: {
                    kind: 'align',
                    selected,
                    reason: String(options.reason || ''),
                    feedback: String(options.feedback || ''),
                },
                outcome: patched ? 'patched' : 'unchanged',
                items,
                snapshot: patched ? before : null,
                after: patched ? after : null,
                note: patched ? parsed.note : [floorUnchangedNote(latest?.index), parsed.note].filter(Boolean).join('。'),
            });
            return { status: 'updated', summary, items, unchanged: !patched, skippedLocks: [...(point.skippedLocks || []), ...(lines.skippedLocks || [])] };
        } catch (error) {
            if (error?.name === 'AbortError') return { status: 'cancelled' };
            diagnostic?.rejected?.(error, { phase: 'request' });
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
            const results = {};
            const blocks = [];
            const runModule = async (name, fn) => {
                if (!selected.includes(name)) return;
                if (generation !== token) return;
                const before = snapshotSelected([name]);
                let result;
                try {
                    result = await fn();
                } catch (error) {
                    if (error?.name === 'AbortError') throw error;
                    result = { status: 'failed', error };
                }
                results[name] = result;
                if (generation !== token) return;
                const after = snapshotSelected([name]);
                const entry = {
                    ...refreshBlockActivity(name, result, before, after),
                    retry: {
                        kind: 'regen',
                        selected: [name],
                        reason,
                        feedback: String(options.feedback || ''),
                        outlineMode: options.outlineMode || 'current',
                    },
                };
                blocks.push({ name, label: refreshModuleLabel(name), outcome: entry.outcome, error: entry.error || '', note: entry.note });
                env.onActivity?.(entry);
            };
            await runModule('point', () => env.regenPoint?.(travel));
            await runModule('lines', () => env.regenLines?.(travel));
            await runModule('dashed', () => env.regenDashed?.({ reroll: true, manual: true, promptAddon: addon }));
            await runModule('outline', () => env.regenOutline?.({ reroll: true, module: 'outline', promptAddon: addon, mode: options.outlineMode || 'current' }));
            if (generation !== token) return { status: 'cancelled', reason: 'aborted', results, blocks };
            return { status: 'updated', results, blocks };
        } finally { endGeneration(token); }
    }

    async function fight(options = {}) {
        const token = beginGeneration('fight');
        if (!token) return { status: 'skipped', reason: 'busy' };
        let diagnostic;
        const recordFailed = error => {
            try {
                const latest = latestAiFloor(env.context?.()?.chat);
                env.onActivity?.({
                    source: 'fight',
                    cause: options.cause || 'manual',
                    retry: {
                        kind: 'fight',
                        intent: options.intent || null,
                        reason: String(options.intent?.text || options.reason || ''),
                    },
                    floorId: latest?.index,
                    outcome: 'failed',
                    error: diagnosticMessage(error),
                    note: diagnosticMessage(error),
                });
            } catch { /* 记失败不能再把 busy 卡死 */ }
        };
        try {
            const ctx = env.context?.() || {};
            const ownerChatId = String(ctx.chatId ?? '');
            const latest = latestAiFloor(ctx.chat);
            const latestStory = env.readFloorStory?.(latest?.text || '') || env.cleanText?.(latest?.text || '') || String(latest?.text || '');
            const cfg = env.loadConfig?.() || {};
            const activityBase = () => ({
                source: 'fight',
                cause: options.cause || 'manual',
                retry: {
                    kind: 'fight',
                    intent: options.intent || null,
                    reason: String(options.intent?.text || options.reason || ''),
                },
                floorId: latest?.index,
                swipeId: ctx.chat?.[latest?.index]?.swipe_id,
                signature: env.floorSignature?.(latest?.index),
            });
            diagnostic = createGenerationDiagnosticScope('lamp-fight', { background: options.cause === 'retry' });
            const books = env.collectFightBooks?.() || {};
            const pointRaw = String(books.pointRaw ?? env.readPointRaw?.() ?? '');
            const linesRaw = String(books.linesRaw ?? env.readLinesRaw?.() ?? '');
            const prompt = buildFightPrompt({
                userName: ctx.name1 || '用户',
                charName: ctx.name2 || '角色',
                latestStory,
                pointRaw,
                linesRaw,
                ledgerText: books.ledgerText || '',
                almanacText: books.almanacText || '',
                dashedText: books.dashedText || '',
                outlineRaw: books.outlineRaw || '',
                intent: options.intent || {},
            });
            if (!cfg.url || !cfg.key) {
                const error = makeDiagnosticError('config-missing');
                recordFailed(error);
                return { status: 'failed', error };
            }
            const raw = await env.callApi?.(ctx, prompt, cfg, ctx.name1 || '用户', ctx.name2 || '角色', token.controller.signal, 5, { promptMode: 'mechanical', diagnosticModule: 'lamp-fight', diagnosticSink: diagnostic.sink, fullMemory: false });
            if (!ownerStillHere(token, ownerChatId)) return { status: 'cancelled' };
            diagnostic.accepted({ phase: 'response' });
            const parsed = parseReconcilePatches(raw);
            const before = snapshotSelected(['point', 'lines']);
            const point = applyPointPatches(pointRaw, parsed.patches, { feedback: options.intent?.text || '', calendar: env.calendar?.() });
            const lines = applyLinePatches(linesRaw, parsed.patches, { feedback: options.intent?.text || '' });
            const extras = await env.applyFightExtras?.(parsed.patches.filter(item => item.target !== 'point' && item.target !== 'line'), options.intent) || [];
            const ownerGuard = () => ownerStillHere(token, ownerChatId);
            if (point.changed && lines.changed && typeof env.writeBatchRaw === 'function') {
                const saved = await env.writeBatchRaw({ point: point.raw, lines: lines.raw }, { ownerGuard });
                if (writeRejected(saved)) throw makeDiagnosticError('save', { phase: 'save' });
            } else {
                if (point.changed) {
                    const saved = await env.writePointRaw?.(point.raw, { ownerGuard });
                    if (writeRejected(saved)) throw makeDiagnosticError('save', { phase: 'save' });
                }
                if (lines.changed) {
                    const saved = await env.writeLinesRaw?.(lines.raw, { ownerGuard });
                    if (writeRejected(saved)) throw makeDiagnosticError('save', { phase: 'save' });
                }
            }
            env.onPatched?.({ point: point.changed, lines: lines.changed });
            const after = snapshotSelected(['point', 'lines']);
            const items = [...(point.applied || []), ...(lines.applied || []), ...extras];
            const patched = point.changed || lines.changed || extras.length > 0;
            const summary = summarizeFight({ point, lines, extras, note: parsed.note });
            env.onActivity?.({
                ...activityBase(),
                outcome: patched ? 'patched' : 'unchanged',
                items,
                snapshot: patched ? before : null,
                after: patched ? after : null,
                note: patched ? parsed.note || summary : [floorUnchangedNote(latest?.index), parsed.note].filter(Boolean).join('。'),
            });
            return { status: 'updated', summary, items, unchanged: !patched };
        } catch (error) {
            if (error?.name === 'AbortError') return { status: 'cancelled' };
            diagnostic?.rejected?.(error, { phase: 'request' });
            recordFailed(error);
            return { status: 'failed', error };
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
        if (typeof env.enqueueJob === 'function') {
            env.enqueueJob({
                id: 'align',
                run: async () => align({ auto: true, selected, cause: 'auto' }),
            });
            return { status: 'queued' };
        }
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
        align, regenerate, fight, onAiFloor, onRerollAlign, abort, stagger,
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
