export function pointDeleteTarget(day, ev, { view, charName } = {}) {
    const idx = Number(ev);
    if (!Number.isInteger(idx)) return null;
    return { day: day === 'future' ? 'future' : Number(day), idx, view, charName };
}

export function panelPointDeleteContext(currentView, charViewName) {
    return { view: currentView, charName: currentView === 'char' ? charViewName : '' };
}

export function chatPointDeleteContext() {
    return { view: 'user', charName: '' };
}

export function pointTabIndex(rawDay, total) {
    if (!Number.isInteger(total) || total < 1) return null;
    const raw = String(rawDay || '').trim().toLowerCase();
    const idx = raw === 'future' ? total - 1 : Number(raw);
    if (!Number.isInteger(idx) || idx < 0 || idx >= total) return null;
    return idx;
}

export function bindPointPanel(env = {}) {
    const $ = env.$;
    const $in = env.$in;
    const $chat = env.$chat;

    $in('#sp-body').on('click', '#sp-gen-schedule-now', env.regen);
    $in('#sp-body').on('click', '.sp-refresh-schedule', env.openRefresh || env.regen);
    $in('#sp-body').on('click', '.sp-point-pin-char', function () {
        env.pinChar?.($(this).attr('data-name'));
    });
    $in('#sp-body').on('click', '.sp-sch-del-one', function (e) {
        e.stopPropagation();
        const target = pointDeleteTarget($(this).attr('data-day'), $(this).attr('data-ev'), panelPointDeleteContext(env.currentView?.(), env.charViewName?.()));
        if (target) env.deleteEvent?.(target.day, target.idx, { view: target.view, charName: target.charName });
    });
    $chat.on('click', '.sp-sch-del-one', function (e) {
        e.stopPropagation();
        const target = pointDeleteTarget($(this).attr('data-day'), $(this).attr('data-ev'), chatPointDeleteContext());
        if (target) env.deleteEvent?.(target.day, target.idx, { view: target.view, charName: target.charName });
    });
    $in('#sp-body').on('click', '#sp-abort-generate', env.abort);
    $in('#sp-body').on('click', '.sp-align-point-date', function (e) {
        e.stopPropagation();
        env.alignStartDate?.();
    });
    $in('#sp-body').on('click', '.sp-tab', function () {
        const $track = $(this).closest('#sp-body').find('.sp-days-track').first();
        const total = Number($track.attr('data-total'));
        const idx = pointTabIndex($(this).attr('data-day'), total);
        if (idx == null) return;
        env.$inAll('.sp-tab').removeClass('sp-tab-active');
        $(this).addClass('sp-tab-active');
        $track.css('transform', `translateX(-${idx * 100 / total}%)`);
    });
}

export function bindInjectAndJump(env = {}) {
    const $ = env.$;
    const $in = env.$in;
    const $inAll = env.$inAll;
    $inAll('#sp-body, #sp-lines-wrap').on('click', '.sp-inject-btn', function () {
        const text = env.injectText?.($(this).data('iid'));
        if (text) env.inject?.(text);
    });
    env.$chat.on('click', '.sp-inject-btn', function () {
        const text = env.injectText?.($(this).data('iid'));
        if (text) env.inject?.(text);
    });
    $inAll('#sp-body, #sp-lines-wrap').on('click', '.sp-jump-link', () => $in('.sp-view-btn[data-view="space"]').trigger('click'));
}
