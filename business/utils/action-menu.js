export function renderActionMenu(menuId, items = [], escapeHtml = value => String(value ?? ''), escapeAttr = value => String(value ?? '')) {
    const rows = items.map(item => `<button type="button" class="sp-action-menu-item" data-action="${escapeAttr(item.action)}" title="${escapeAttr(item.title)}"><i class="fa-solid ${escapeAttr(item.icon)}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></button>`).join('');
    return `<div class="sp-action-menu" data-menu-id="${escapeAttr(menuId)}"><button type="button" class="sp-icon-btn sp-action-menu-toggle" title="更多操作" aria-label="更多操作" aria-expanded="false"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="sp-action-menu-list" hidden>${rows}</div></div>`;
}

export function closeOpenActionMenus($all, $, except = null) {
    $all('.sp-action-menu-open').each(function () {
        if (except && this === except) return;
        $(this).removeClass('sp-action-menu-open').find('.sp-action-menu-list').attr('hidden', true);
        $(this).find('.sp-action-menu-toggle').attr('aria-expanded', 'false');
    });
}

export function clickInsideActionMenu(path) {
    return (path || []).some(el => typeof el?.matches === 'function' && el.matches('.sp-action-menu'));
}

export function parseManualActionItem($item) {
    const menu = $item.closest('.sp-action-menu');
    const attr = name => menu?.attr?.(name);
    return {
        action: $item.attr('data-action'),
        idx: Number(attr('data-line-idx') ?? attr('data-idx')),
        day: attr('data-day'),
        ev: Number(attr('data-ev')),
        iid: attr('data-iid'),
        cid: attr('data-cid'),
    };
}

export function pointMenuDay(day) {
    return day === 'future' || /^past:\d+$/.test(String(day)) ? String(day) : Number(day);
}

export function outlineMenuIndex(action, idx) {
    return action === 'outline-edit' || action === 'outline-delete' ? idx - 1 : idx;
}

export function dispatchManualAction(ctx, env = {}) {
    const action = ctx?.action;
    const day = pointMenuDay(ctx?.day);
    const beat = outlineMenuIndex(action, ctx?.idx);
    if (action === 'point-edit') return env.pointEdit?.(day, ctx.ev, env.pointView?.());
    if (action === 'point-pin') return env.pointPin?.(day, ctx.ev);
    if (action === 'point-delete') return env.pointDelete?.(day, ctx.ev, env.pointView?.());
    if (action === 'point-inject') return env.inject?.(ctx.iid);
    if (action === 'line-edit') return env.lineEdit?.(ctx.idx);
    if (action === 'line-pin') return env.linePin?.(ctx.idx);
    if (action === 'line-delete') return env.lineDelete?.(ctx.idx);
    if (action === 'line-inject') return env.inject?.(ctx.iid);
    if (action === 'outline-edit') return env.outlineEdit?.(beat);
    if (action === 'outline-current') return env.outlineCurrent?.(ctx.idx);
    if (action === 'outline-inject') return env.outlineInject?.(ctx.iid);
    if (action === 'outline-copy') return env.outlineCopy?.(ctx.cid);
    if (action === 'outline-delete') return env.outlineDelete?.(beat);
    return undefined;
}

export function bindManualActionMenus(env = {}) {
    const $ = env.$;
    const close = except => env.close?.(except);
    env.$inAll('#sp-body, #sp-lines-wrap, #sp-outline-wrap').on('click.spManualActionMenu', '.sp-action-menu-toggle', function (e) {
        e.stopPropagation();
        const menu = $(this).closest('.sp-action-menu').get(0);
        const open = !$(menu).hasClass('sp-action-menu-open');
        close(menu);
        $(menu).toggleClass('sp-action-menu-open', open).find('.sp-action-menu-list').attr('hidden', !open).end().find('.sp-action-menu-toggle').attr('aria-expanded', String(open));
    }).on('click.spManualActionMenu', '.sp-action-menu-item', function (e) {
        e.stopPropagation();
        close();
        return dispatchManualAction(parseManualActionItem($(this)), env);
    });
}

export function bindActionMenuDismiss(env = {}) {
    const $ = env.$;
    $(document).off('click.spActionMenu').on('click.spActionMenu', function (event) {
        if (!clickInsideActionMenu(event.originalEvent?.composedPath?.() || [])) env.close?.();
    });
    $(document).off('keydown.spActionMenu').on('keydown.spActionMenu', function (event) {
        if (event.key === 'Escape') env.close?.();
    });
}
