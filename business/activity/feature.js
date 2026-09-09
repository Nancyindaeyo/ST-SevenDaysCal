import { diffSnapshots, sameSnapshot } from './diff.js';
import { normalizeActivityEntry } from './schema.js';
import { createActivityStore } from './store.js';
import { activityButtonHtml, activityOverlayHtml, renderActivityList } from './ui.js';

export function createActivityFeature(env = {}) {
    const store = env.store || createActivityStore({
        storage: env.storage,
        keyForChat: env.keyForChat,
    });
    let open = false;
    let unread = 0;

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
        $in?.('.sp-activity-btn')?.toggleClass('sp-btn-active', open);
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
        $in?.('.sp-activity-btn')?.toggleClass('sp-btn-active', open);
        env.onToggle?.(open);
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
            undone: false,
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
        store.update(chatId(), entry.id, { undone: true });
        env.onRestored?.(entry);
        paint();
        return { status: 'updated' };
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
    };

    return {
        record,
        undo,
        capture,
        restore,
        list: () => store.list(chatId()),
        bindUi,
        paint,
        open: () => setOpen(true),
        close: () => setOpen(false),
        isOpen: () => open,
        overlayHtml: activityOverlayHtml,
        buttonHtml: activityButtonHtml,
        onChatChanged: () => { unread = 0; if (open) paint(); },
        get unread() { return unread; },
    };
}
