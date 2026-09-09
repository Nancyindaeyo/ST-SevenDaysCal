import { diffSnapshots, sameSnapshot } from './diff.js';
import { normalizeActivityEntry, sourceLabel } from './schema.js';
import { createActivityStore } from './store.js';
import { activityButtonHtml, activityOverlayHtml, quoteTextForSpace, renderActivityList } from './ui.js';

export function createActivityFeature(env = {}) {
    const store = env.store || createActivityStore({
        storage: env.storage,
        keyForChat: env.keyForChat,
    });
    let open = false;
    let unread = 0;
    let watched = { floorId: -1, signature: '' };
    let restyled = false;

    const chatId = () => env.chatId?.() ?? null;
    const $in = sel => env.query?.(sel);
    const capture = (names = []) => {
        const snapshot = {};
        if (names.includes('point')) snapshot.point = String(env.readPoint?.() || '');
        if (names.includes('lines')) snapshot.lines = String(env.readLines?.() || '');
        if (names.includes('outline')) {
            const outline = env.readOutline?.() || {};
            snapshot.outline = { raw: String(outline.raw || ''), cursor: Number(outline.cursor) || 0 };
        }
        if (names.includes('dashed')) snapshot.dashed = env.readDashed?.() || [];
        return snapshot;
    };
    const restore = async snapshot => {
        if (snapshot?.point != null) await env.writePoint?.(snapshot.point);
        if (snapshot?.lines != null) await env.writeLines?.(snapshot.lines);
        if (snapshot?.outline) await env.writeOutline?.(snapshot.outline);
        if (snapshot?.dashed) await env.writeDashed?.(snapshot.dashed);
    };
    const paint = () => {
        const $body = $in?.('#sp-activity-body');
        if ($body?.length) $body.html(renderActivityList(store.list(chatId())));
        const $badge = $in?.('.sp-activity-badge');
        if ($badge?.length) {
            $badge.text(unread > 9 ? '9+' : String(unread)).prop('hidden', unread <= 0);
        }
        $in?.('#sp-activity-restyle')?.prop?.('hidden', !restyled);
        $in?.('#sp-activity-stamp')?.prop?.('hidden', env.missingLatestStamp?.() !== true);
        $in?.('.sp-activity-btn')?.toggleClass?.('sp-btn-active', open);
        env.onPaint?.();
    };
    const setOpen = value => {
        open = value === true;
        const $overlay = $in?.('#sp-activity-overlay');
        if (!$overlay?.length) return;
        if (open) {
            unread = 0;
            $overlay.stop?.(true).css({ display: 'flex', opacity: 0 }).animate?.({ opacity: 1 }, 180) || $overlay.css({ display: 'flex', opacity: 1 });
            paint();
        } else {
            $overlay.stop?.(true).animate?.({ opacity: 0 }, 150, function () { env.$(this).css('display', 'none'); }) || $overlay.css({ display: 'none' });
        }
        $in?.('.sp-activity-btn')?.toggleClass?.('sp-btn-active', open);
        env.onToggle?.(open);
    };
    const clearRestyle = () => {
        if (!restyled) return;
        restyled = false;
        for (const entry of store.list(chatId())) {
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
        if (!items.length && !snapshot) return null;
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

    const undo = async id => {
        const entry = store.list(chatId()).find(item => item.id === String(id));
        if (!entry || entry.undone) return { status: 'skipped' };
        if (!entry.snapshot) return { status: 'failed', reason: 'no-snapshot' };
        const current = capture(Object.keys(entry.snapshot));
        if (entry.after && !sameSnapshot(current, entry.after)) {
            env.toast?.('之后又改过了，没法原样撤回', true);
            return { status: 'failed', reason: 'diverged' };
        }
        await restore(entry.snapshot);
        store.update(chatId(), entry.id, { undone: true, stale: false });
        env.onRestored?.(entry);
        paint();
        return { status: 'updated' };
    };

    const latestAdvanceForFloor = floorId => store.list(chatId()).find(item => (
        item.source === 'advance'
        && Number(item.floorId) === Number(floorId)
        && !item.undone
        && item.snapshot?.lines != null
    )) || null;

    const replayFloorAdvance = async floorId => {
        const entry = latestAdvanceForFloor(floorId);
        if (!entry) return { status: 'empty' };
        const current = capture(Object.keys(entry.snapshot));
        if (entry.after && !sameSnapshot(current, entry.after)) {
            return { status: 'diverged' };
        }
        await restore(entry.snapshot);
        store.update(chatId(), entry.id, { undone: true, stale: false });
        env.onRestored?.(entry);
        paint();
        return { status: 'updated' };
    };

    const markFloorRestyle = ({ floorId, signature } = {}) => {
        const id = Number(floorId);
        const sig = String(signature || '');
        if (!Number.isInteger(id) || id < 0) return { status: 'skipped' };
        if (watched.floorId === id && watched.signature && sig && watched.signature !== sig) {
            restyled = true;
            for (const entry of store.list(chatId())) {
                if (entry.undone || Number(entry.floorId) !== id) continue;
                if (entry.source === 'align-auto' || entry.source === 'align' || entry.source === 'advance') {
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

    const realign = async () => {
        const result = await env.realign?.({
            reason: '这楼重 roll 了，请按最新 AI 楼重新校对未锁的点和线。',
        });
        if (result?.status === 'failed') {
            env.toast?.('按新正文对齐失败', true);
            return result;
        }
        if (result?.status === 'cancelled') return result;
        clearRestyle();
        return result || { status: 'skipped' };
    };

    const quoteToSpace = async id => {
        const entry = store.list(chatId()).find(item => item.id === String(id));
        const quote = quoteTextForSpace(entry);
        if (!quote) return { status: 'skipped' };
        const sent = await env.sendToSpace?.({
            who: sourceLabel(entry.source),
            floorIndex: entry.floorId,
            quote,
        });
        return sent || { status: 'skipped' };
    };

    const bindUi = () => {
        const $root = env.root?.();
        $root?.on?.('click', '.sp-activity-btn', () => {
            if (open) setOpen(false);
            else {
                env.closeSettings?.();
                setOpen(true);
            }
        });
        $root?.on?.('click', '.sp-activity-close-btn', () => setOpen(false));
        $root?.on?.('click', '.sp-activity-undo', function () {
            void undo(env.$(this).attr('data-id'));
        });
        $root?.on?.('click', '.sp-activity-quote', function () {
            void quoteToSpace(env.$(this).attr('data-id'));
        });
        $root?.on?.('click', '.sp-activity-open-lines', function () {
            void env.openLines?.();
        });
        $root?.on?.('click', '.sp-activity-realign', function () {
            void realign();
        });
        $root?.on?.('click', '.sp-activity-stamp-fill', function () {
            void env.fillLatestStamp?.();
        });
    };

    return {
        record,
        undo,
        capture,
        restore,
        latestAdvanceForFloor,
        replayFloorAdvance,
        markFloorRestyle,
        realign,
        quoteToSpace,
        list: () => store.list(chatId()),
        bindUi,
        paint,
        open: () => setOpen(true),
        close: () => setOpen(false),
        isOpen: () => open,
        overlayHtml: activityOverlayHtml,
        buttonHtml: activityButtonHtml,
        onChatChanged: () => {
            unread = 0;
            restyled = false;
            watched = { floorId: -1, signature: '' };
            store.clearMemory();
            if (open) paint();
        },
        get unread() { return unread; },
        get restyled() { return restyled; },
    };
}
