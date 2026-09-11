import { diffSnapshots, sameSnapshot } from './diff.js';
import {
    canUndoActivity,
    isAlignEntry,
    normalizeActivityEntry,
    remainingUndoItems,
    sourceLabel,
    undoItemKey,
} from './schema.js';
import { restoreLineItem, restorePointItem } from './revert.js';
import { createActivityStore } from './store.js';
import { activityButtonHtml, activityOverlayHtml, quoteTextForSpace, renderActivityList, renderPaceDetail } from './ui.js';
import { isPaceExpandable, canJumpActivityItem } from './jump.js';

export function createActivityFeature(env = {}) {
    const store = env.store || createActivityStore({
        storage: env.storage,
        keyForChat: env.keyForChat,
    });
    let open = false;
    let unread = 0;
    let watched = { floorId: -1, signature: '' };
    let restyled = false;
    let paceOpen = '';

    const chatId = () => env.chatId?.() ?? null;
    const $in = sel => env.query?.(sel);
    const list = () => store.list(chatId());
    const capture = (names = []) => {
        const snapshot = {};
        if (names.includes('point')) snapshot.point = String(env.readPoint?.() || '');
        if (names.includes('lines')) snapshot.lines = String(env.readLines?.() || '');
        if (names.includes('outline')) {
            const outline = env.readOutline?.() || {};
            snapshot.outline = { raw: String(outline.raw || ''), cursor: Number(outline.cursor) || 0 };
        }
        if (names.includes('dashed')) snapshot.dashed = env.readDashed?.() || [];
        if (names.includes('ledger')) snapshot.ledger = env.readLedger?.() || null;
        return snapshot;
    };
    const restore = async snapshot => {
        if (snapshot?.point != null) await env.writePoint?.(snapshot.point);
        if (snapshot?.lines != null) await env.writeLines?.(snapshot.lines);
        if (snapshot?.outline) await env.writeOutline?.(snapshot.outline);
        if (snapshot?.dashed) await env.writeDashed?.(snapshot.dashed);
        if (snapshot?.ledger) await env.writeLedger?.(snapshot.ledger);
    };
    const syncPaceOpen = () => {
        const $overlay = $in?.('#sp-activity-overlay');
        $overlay?.attr?.('data-pace-open', paceOpen || '');
        $in?.('#sp-activity-pace-strip')?.find?.('[data-pace]')?.each?.(function () {
            env.$(this).toggleClass('is-open', String(env.$(this).attr('data-pace') || '') === paceOpen);
        });
        const $detail = $in?.('#sp-activity-pace-detail');
        if ($detail?.length) {
            $detail.html(paceOpen ? renderPaceDetail(paceOpen, list()) : '');
            $detail.prop('hidden', !paceOpen);
        }
    };
    const paint = () => {
        const $body = $in?.('#sp-activity-body');
        if ($body?.length) $body.html(renderActivityList(list()));
        const $badge = $in?.('.sp-activity-badge');
        if ($badge?.length) {
            $badge.text(unread > 9 ? '9+' : String(unread)).prop('hidden', unread <= 0);
        }
        $in?.('#sp-activity-clock')?.text?.(env.clockLabel?.() || '还没有故事日期');
        $in?.('#sp-activity-restyle')?.prop?.('hidden', !restyled);
        $in?.('#sp-activity-stamp')?.prop?.('hidden', env.missingLatestStamp?.() !== true);
        $in?.('.sp-activity-btn')?.toggleClass?.('sp-btn-active', open);
        syncPaceOpen();
        env.onPaint?.();
    };
    const setOpen = (value, { immediate } = {}) => {
        open = value === true;
        const $overlay = $in?.('#sp-activity-overlay');
        if (!$overlay?.length) return;
        if (open) {
            unread = 0;
            $overlay.stop?.(true).css({ display: 'flex', opacity: 0 }).animate?.({ opacity: 1 }, 180) || $overlay.css({ display: 'flex', opacity: 1 });
            paint();
        } else {
            paceOpen = '';
            if (immediate) $overlay.stop?.(true).css({ display: 'none', opacity: 0 });
            else $overlay.stop?.(true).animate?.({ opacity: 0 }, 150, function () { env.$(this).css('display', 'none'); }) || $overlay.css({ display: 'none' });
        }
        $in?.('.sp-activity-btn')?.toggleClass?.('sp-btn-active', open);
        env.onToggle?.(open);
    };
    const clearRestyle = () => {
        if (!restyled) return;
        restyled = false;
        for (const entry of list()) {
            if (entry.stale && Number(entry.floorId) === watched.floorId) store.update(chatId(), entry.id, { stale: false });
        }
        paint();
    };

    const record = (input = {}) => {
        const snapshot = input.snapshot || null;
        const after = input.after || null;
        const items = Array.isArray(input.items) && input.items.length
            ? input.items
            : diffSnapshots(snapshot || {}, after || {});
        const outcome = input.outcome || '';
        if (!items.length && !snapshot && outcome !== 'failed' && outcome !== 'unchanged') return null;
        const entry = store.prepend(chatId(), normalizeActivityEntry({
            ...input,
            items,
            snapshot,
            after,
            note: String(input.note || '').trim(),
            undone: false,
            stale: false,
        }));
        if (!open) unread += 1;
        paint();
        return entry;
    };

    const revertIfCurrent = async (entry, onlyItem = null) => {
        const names = Object.keys(entry.snapshot || {});
        const current = capture(names);
        if (onlyItem && (entry.undoneRefs || []).includes(undoItemKey(onlyItem))) return { status: 'skipped' };
        if (!onlyItem && (!entry.after || sameSnapshot(current, entry.after))) {
            await restore(entry.snapshot);
            store.update(chatId(), entry.id, { undone: true, stale: false, undoneRefs: (entry.items || []).map(undoItemKey) });
            env.onRestored?.(entry);
            paint();
            return { status: 'updated', mode: 'full' };
        }
        const targets = (onlyItem ? [onlyItem] : remainingUndoItems(entry)).filter(item => item.module === 'point' || item.module === 'lines');
        let nextPoint = current.point;
        let nextLines = current.lines;
        const restored = [];
        for (const item of targets) {
            if (item.module === 'point' && entry.snapshot.point != null) {
                const result = restorePointItem(nextPoint, entry.snapshot.point, entry.after?.point, item);
                if (result.changed) { nextPoint = result.raw; restored.push(item); }
            } else if (item.module === 'lines' && entry.snapshot.lines != null) {
                const result = restoreLineItem(nextLines, entry.snapshot.lines, entry.after?.lines, item);
                if (result.changed) { nextLines = result.raw; restored.push(item); }
            }
        }
        if (!restored.length) return { status: 'diverged' };
        const writes = [];
        if (nextPoint !== current.point) writes.push(env.writePoint?.(nextPoint));
        if (nextLines !== current.lines) writes.push(env.writeLines?.(nextLines));
        await Promise.all(writes);
        const undoneRefs = [...new Set([...(entry.undoneRefs || []), ...restored.map(undoItemKey)])];
        const leftover = remainingUndoItems({ ...entry, undoneRefs });
        store.update(chatId(), entry.id, { undone: leftover.length === 0, stale: false, undoneRefs });
        env.onRestored?.(entry);
        paint();
        return { status: 'updated', mode: leftover.length ? 'partial' : 'items', restored: restored.length };
    };

    const latestUndoableAlign = floorId => list().find(item => {
        if (!isAlignEntry(item) || item.undone || !item.snapshot) return false;
        if (item.outcome === 'failed' || item.outcome === 'unchanged') return false;
        if (!Number.isInteger(Number(floorId)) || Number(floorId) < 0) return true;
        return Number(item.floorId) === Number(floorId);
    }) || null;

    const revertLatestAlign = async floorId => {
        const entry = latestUndoableAlign(floorId);
        if (!entry) return { status: 'empty' };
        return revertIfCurrent(entry);
    };

    const undo = async (id, item = null) => {
        const entries = list();
        const entry = entries.find(row => row.id === String(id));
        if (!entry || !canUndoActivity(entry, entries)) return { status: 'skipped' };
        const result = await revertIfCurrent(entry, item);
        if (result.status === 'diverged') {
            env.toast?.(item ? '这条后来又改过了，没法原样撤回' : '之后又改过了，没法原样撤回', true);
            return { status: 'failed', reason: 'diverged' };
        }
        if (result.mode === 'partial') env.toast?.(`已撤回未再改过的 ${result.restored} 条`);
        return result;
    };

    const latestAdvanceForFloor = floorId => list().find(item => (
        item.source === 'advance'
        && Number(item.floorId) === Number(floorId)
        && !item.undone
        && item.snapshot?.lines != null
    )) || null;

    const replayFloorAdvance = async floorId => {
        const entry = latestAdvanceForFloor(floorId);
        if (!entry) return { status: 'empty' };
        return revertIfCurrent(entry);
    };

    const latestSourceForFloor = (source, floorId) => list().find(item => (
        item.source === source
        && Number(item.floorId) === Number(floorId)
        && !item.undone
    )) || null;

    const markLatestSourceFloor = (source, floorId, patch = {}) => {
        const since = Number(patch.since) || 0;
        const { since: _since, ...details } = patch;
        const entry = list().find(item => item.source === source && item.floorId == null && !item.undone && item.ts >= since);
        if (entry) {
            store.prepend(chatId(), { ...entry, ...details, floorId });
            paint();
            return entry.id;
        }
        return record({ source, floorId, ...details });
    };

    const replayFloorSource = async (source, floorId) => {
        const entry = latestSourceForFloor(source, floorId);
        if (!entry) return { status: 'empty' };
        if (!entry.snapshot) return { status: 'unchanged', entry };
        return revertIfCurrent(entry);
    };

    const markFloorRestyle = ({ floorId, signature } = {}) => {
        const id = Number(floorId);
        const sig = String(signature || '');
        if (!Number.isInteger(id) || id < 0) return { status: 'skipped' };
        if (watched.floorId === id && watched.signature && sig && watched.signature !== sig) {
            restyled = true;
            for (const entry of list()) {
                if (entry.undone || Number(entry.floorId) !== id) continue;
                if (isAlignEntry(entry) || entry.source === 'advance') {
                    store.update(chatId(), entry.id, { stale: true });
                }
            }
        } else if (watched.floorId !== id) {
            restyled = false;
        }
        watched = { floorId: id, signature: sig };
        paint();
        return { status: restyled ? 'stale' : 'ok' };
    };

    const defaultReason = cause => cause === 'reroll'
        ? '这楼重 roll 了，请按最新 AI 楼重新校对未锁的点和线。'
        : '请按最新 AI 楼重新校对未锁的点和线。今天若空了或不足 3 条，有正文依据就补到今天。';

    const realign = async ({ cause = 'retry', reason, floorId } = {}) => {
        const floor = Number.isInteger(Number(floorId)) ? Number(floorId) : watched.floorId;
        const restored = await revertLatestAlign(floor);
        if (restored.status === 'diverged' && cause === 'reroll') {
            env.toast?.('之后又改过了，没法按新正文自动补对齐。可在【改】里重试。', true);
            return restored;
        }
        const result = await env.realign?.({
            reason: String(reason || defaultReason(cause)),
            cause,
        });
        if (result?.status === 'failed') {
            env.toast?.('按新正文对齐失败', true);
            return result;
        }
        if (result?.status === 'cancelled') return result;
        clearRestyle();
        paint();
        if (cause === 'reroll' && result?.status === 'updated') env.toast?.('已按这楼的新正文重新对齐点和线');
        return result || { status: 'skipped' };
    };

    const quoteToSpace = async id => {
        const entry = list().find(item => item.id === String(id));
        const quote = quoteTextForSpace(entry);
        if (!quote) return { status: 'skipped' };
        const sent = await env.sendToSpace?.({
            who: sourceLabel(entry.source),
            floorIndex: entry.floorId,
            quote,
        });
        return sent || { status: 'skipped' };
    };

    const togglePace = paceId => {
        if (!isPaceExpandable(paceId)) return;
        paceOpen = paceOpen === paceId ? '' : paceId;
        syncPaceOpen();
    };

    const jumpToItem = async item => {
        if (!canJumpActivityItem(item)) return { status: 'skipped' };
        setOpen(false, { immediate: true });
        const result = await env.openItem?.(item);
        if (result?.status === 'missing') env.toast?.('这条已经不在了', true);
        return result || { status: 'skipped' };
    };

    const bindUi = () => {
        const $root = env.root?.();
        const click = (sel, fn) => $root?.on?.('click', sel, fn);
        const clickId = (sel, fn) => click(sel, function () { void fn(env.$(this).attr('data-id')); });
        click('.sp-activity-btn', () => {
            if (open) setOpen(false);
            else {
                env.closeSettings?.();
                setOpen(true);
            }
        });
        click('.sp-activity-close-btn', () => setOpen(false));
        clickId('.sp-activity-undo', undo);
        click('.sp-activity-undo-item', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const $btn = env.$(this);
            void undo($btn.attr('data-id'), {
                module: String($btn.attr('data-module') || ''),
                title: String($btn.attr('data-title') || ''),
                action: String($btn.attr('data-action') || ''),
                ref: String($btn.attr('data-ref') || ''),
            });
        });
        clickId('.sp-activity-quote', quoteToSpace);
        click('.sp-activity-realign, .sp-activity-retry', () => { void realign({ cause: 'retry' }); });
        click('.sp-activity-stamp-fill', () => { void env.fillLatestStamp?.(); });
        click('#sp-activity-pace-strip [data-pace]', event => {
            const paceId = env.$(event.currentTarget).attr('data-pace');
            if (!isPaceExpandable(paceId)) return;
            event.preventDefault();
            togglePace(paceId);
        });
        click('.sp-activity-jump', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const $btn = env.$(this);
            void jumpToItem({
                module: String($btn.attr('data-module') || ''),
                title: String($btn.attr('data-title') || ''),
                ref: String($btn.attr('data-ref') || ''),
            });
        });
    };

    return {
        record,
        undo,
        capture,
        restore,
        latestAdvanceForFloor,
        replayFloorAdvance,
        latestSourceForFloor,
        markLatestSourceFloor,
        replayFloorSource,
        revertLatestAlign,
        markFloorRestyle,
        realign,
        quoteToSpace,
        jumpToItem,
        list,
        latestAlignAttempt: () => list().find(isAlignEntry) || null,
        bindUi,
        paint,
        syncPaceOpen,
        open: () => setOpen(true),
        close: (opts) => setOpen(false, opts),
        isOpen: () => open,
        overlayHtml: activityOverlayHtml,
        buttonHtml: activityButtonHtml,
        onChatChanged: () => {
            unread = 0;
            restyled = false;
            paceOpen = '';
            watched = { floorId: -1, signature: '' };
            store.clearMemory();
            if (open) paint();
        },
        get unread() { return unread; },
        get restyled() { return restyled; },
        get paceOpen() { return paceOpen; },
    };
}
