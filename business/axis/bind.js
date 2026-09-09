export const CALENDAR_SPACE_PREFILL = '我想为当前世界设计一套自定义历法。请结合世界观和我讨论纪年名、月份数量、每个月的名称与天数，并在确认后给出完整历法。';

export function resolveAlmanacToolbarAction($button) {
    if ($button.hasClass('sp-action-menu-toggle')) return { type: 'menu' };
    const named = $button.attr('data-action');
    if (named) return { type: 'action', action: named };
    if ($button.hasClass('sp-alm-add')) return { type: 'action', action: 'add-almanac' };
    if ($button.hasClass('sp-alm-gen')) return { type: 'action', action: 'generate-almanac' };
    if ($button.hasClass('sp-alm-supplement')) return { type: 'action', action: 'supplement-anniversary' };
    return { type: 'action', action: 'manage-calendar' };
}

export function bindAlmanacPanel($almanac, env = {}) {
    const $ = env.$;
    const $in = env.$in;
    const $inAll = env.$inAll;
    const state = env.state;
    const manager = env.manager;

    $almanac.on('click', '.sp-alm-today-prev', function () { env.nudgeToday?.(-1); });
    $almanac.on('click', '.sp-alm-today-next', function () { env.nudgeToday?.(1); });
    $almanac.on('click', '.sp-alm-today-edit', function () {
        state._almTodayEditing = true;
        env.render?.();
        setTimeout(() => $in('#sp-alm-today-month').trigger('focus'), 30);
    });
    $almanac.on('click', '.sp-alm-today-cancel', function () { state._almTodayEditing = false; env.render?.(); });
    $almanac.on('click', '.sp-alm-today-save', async function () {
        const mo = parseInt($in('#sp-alm-today-month').val(), 10);
        const da = parseInt($in('#sp-alm-today-day').val(), 10);
        const weekday = parseInt($in('#sp-alm-today-weekday').val(), 10);
        const result = await env.dateActions?.saveManual?.(mo, da, { storyClock: true, weekday });
        if (!result?.ok) return;
        state._almTodayEditing = false;
    });
    $almanac.on('click', '.sp-alm-today-clear', function () {
        const key = env.charKey?.();
        if (!key) return;
        const cleared = env.dateActions?.clearAnchor?.(key);
        if (!cleared?.ok) { env.toast?.('日期清除失败，请重试', null, true); return; }
        env.aftermath?.();
        env.relandClock?.();
        env.toast?.('已清除手动日期，恢复自动确认');
    });
    $almanac.on('click', '.sp-alm-cal-prev', function () { env.navMonth?.(-1); });
    $almanac.on('click', '.sp-alm-cal-next', function () { env.navMonth?.(1); });
    $almanac.on('click', '.sp-alm-time-travel', function () {
        const day = Number($(this).attr('data-day'));
        if (Number.isInteger(day)) void env.startTravel?.({ month: env.calMonth?.() + 1, day });
    });
    $almanac.on('click', '.sp-alm-time-travel-stop', function () { void env.cancelTravel?.(); });
    $almanac.on('click', '.sp-alm-cell[data-day]', function () { env.calendarActions?.selectDay?.(parseInt($(this).attr('data-day'), 10)); });
    $almanac.on('click', '.sp-alm-cal-clearsel', function () { env.calendarActions?.selectDay?.(null); });
    $almanac.on('click', '.sp-alm-add-day', function () {
        env.openEditor?.(null, { month: env.calMonth?.() + 1, day: parseInt($(this).attr('data-day'), 10) || 1 });
    });

    const dispatch = action => {
        if (action === 'add-almanac') return env.openEditor?.();
        if (action === 'generate-almanac') return env.generate?.();
        if (action === 'supplement-anniversary') return env.supplement?.();
        if (action === 'manage-calendar') return env.openManager?.();
        return undefined;
    };
    const toggleMenu = element => {
        const menu = $(element).closest('.sp-action-menu').get(0);
        if (!menu) return;
        const open = !$(menu).hasClass('sp-action-menu-open');
        env.closeActionMenus?.(open ? menu : null);
        $(menu).toggleClass('sp-action-menu-open', open)
            .find('.sp-action-menu-list').attr('hidden', !open)
            .end().find('.sp-action-menu-toggle').attr('aria-expanded', String(open));
    };
    $almanac.off('click.spAxisToolbar', '.sp-alm-add, .sp-alm-gen, .sp-alm-supplement, .sp-alm-manage, .sp-action-menu-toggle, .sp-action-menu-item')
        .on('click.spAxisToolbar', '.sp-alm-add, .sp-alm-gen, .sp-alm-supplement, .sp-alm-manage, .sp-action-menu-toggle, .sp-action-menu-item', function (event) {
            event.preventDefault();
            const resolved = resolveAlmanacToolbarAction($(this));
            if (resolved.type === 'menu') return toggleMenu(this);
            const result = dispatch(resolved.action);
            if (result?.then) result.finally(() => env.closeActionMenus?.());
            else env.closeActionMenus?.();
        });

    $almanac.on('click', '.sp-alm-cal-detail .sp-alm-item', function (e) {
        if ($(e.target).closest('button').length) return;
        env.calendarActions?.toggleItem?.($(this).attr('data-id'), { targetIsButton: false });
    });
    $almanac.on('click.spAxisItems', '.sp-alm-pin, .sp-alm-edit, .sp-alm-del', function (e) {
        e.preventDefault(); e.stopPropagation(); const id = $(this).attr('data-id');
        if ($(this).hasClass('sp-alm-pin')) env.togglePin?.(id);
        else if ($(this).hasClass('sp-alm-edit')) env.openEditor?.(id);
        else env.deleteItem?.(id);
    });
    $almanac.on('click', '#sp-abort-almanac', () => env.abortGen?.());
    $almanac.on('click', function (e) {
        if (!state.almanacMode || state._almanacEditor || state._almanacSheet !== 'calendar') return;
        if ($(e.target).closest('.sp-alm-cell,.sp-alm-item,button,input,select,textarea,.sp-alm-cal-detail-head').length) return;
        env.calendarActions?.blankClick?.();
    });
    $almanac.on('click', '.sp-alm-editor-save', () => env.saveEditor?.());
    $almanac.on('click', '.sp-alm-editor-cancel, .sp-alm-editor-back', () => env.closeEditor?.());
    $almanac.on('input', '#sp-alm-f-month, #sp-alm-f-day, #sp-alm-f-days', () => env.renderWdHint?.());
    $almanac.on('click', '.sp-alm-manager-back', () => env.closeManager?.());
    $almanac.on('click', '.sp-alm-manager-chat-link', async function () {
        const filled = await env.openSpacePrefill?.('space', '#sp-space-input', CALENDAR_SPACE_PREFILL);
        if (!filled) env.toast?.('已经打开间，但没有找到输入框，请手动填写历法需求', null, true);
        else if (env.settings?.().notifyMode !== 'off') env.toast?.('已把历法需求预填到间');
    });
    $almanac.on('click', '.sp-alm-manager-edit-start', function () { manager.startEditing(); });
    $almanac.on('click', '.sp-alm-manager-edit-cancel', function () { manager.cancelEditing(); });
    $almanac.on('click', '.sp-alm-manager-add-month', function () { manager.addMonth(); });
    $almanac.on('click', '.sp-alm-manager-month-delete', async function () {
        const index = Number($(this).closest('.sp-alm-manager-month-row').attr('data-index'));
        await manager.deleteMonth(index);
    });
    $almanac.on('click', '.sp-alm-manager-month-copy', function () {
        const index = Number($(this).closest('.sp-alm-manager-month-row').attr('data-index'));
        manager.copyMonth(index);
    });
    $almanac.on('click', '.sp-alm-manager-month-up, .sp-alm-manager-month-down', function () {
        const index = Number($(this).closest('.sp-alm-manager-month-row').attr('data-index'));
        manager.moveMonth(index, $(this).hasClass('sp-alm-manager-month-up') ? -1 : 1);
    });
    $almanac.on('input', '.sp-alm-manager-edit-fields input', function () {
        if (!manager.hasError()) return;
        manager.clearError();
        $inAll('#sp-almanac-wrap .sp-alm-manager-error').remove();
    });
    $almanac.on('click', '.sp-alm-manager-edit-save', async function () {
        const result = await manager.saveDraft();
        if (!result.ok) {
            if (result.cancelled) return;
            env.toast?.(result.error || '历法保存失败', null, true);
            return;
        }
        if (env.settings?.().notifyMode !== 'off') env.toast?.(`历法已更新：${env.calendarSummary?.(result.cal)}`);
    });
    $almanac.on('click', '.sp-alm-manager-template-head', function () { manager.toggleTemplates(); });
    $almanac.on('click', '.sp-alm-manager-template-save-current', async function () {
        const list = env.loadTemplates?.() || [];
        const name = await env.prompt?.({
            title: '保存当前历法为模板',
            body: '为当前历法填写一个便于识别的模板名称。',
            initialValue: env.loadCal?.().era || '',
            placeholder: '模板名称',
            maxLength: env.templateNameLength,
            validate: value => !value ? '请填写模板名称' : (list.some(template => template.name === value) ? '模板名称已存在，请换一个名称' : ''),
        });
        if (name == null || !manager.isOpen()) return;
        const result = await manager.create({ name, calendar: env.loadCal?.() });
        if (!result.ok) env.toast?.(result.error || '模板保存失败', null, true);
    });
    $almanac.on('click', '.sp-alm-manager-template-rename', async function () {
        const id = $(this).attr('data-id');
        const list = env.loadTemplates?.() || [];
        const template = manager.template(id);
        if (!template) { env.toast?.('模板已不存在', null, true); env.render?.(); return; }
        const name = await env.prompt?.({
            title: '重命名历法模板',
            body: '填写一个便于识别的新名称。',
            initialValue: template.name,
            placeholder: '模板名称',
            maxLength: env.templateNameLength,
            validate: value => !value ? '请填写模板名称' : (list.some(item => item.id !== id && item.name === value) ? '模板名称已存在，请换一个名称' : ''),
        });
        if (name == null || !manager.isOpen() || name === template.name) return;
        const result = await manager.rename(id, name);
        if (!result.ok) env.toast?.(result.error || '模板重命名失败', null, true);
    });
    $almanac.on('click', '.sp-alm-manager-template-apply', async function () {
        const id = $(this).attr('data-id');
        const template = manager.template(id);
        if (!template) { env.toast?.('模板已不存在', null, true); env.render?.(); return; }
        const ok = await env.confirm?.({ title: '应用历法模板', body: `确定用「${template.name}」覆盖当前历法吗？`, confirmText: '应用', cancelText: '取消' });
        if (!ok || !manager.isOpen()) return;
        const result = await manager.apply(id);
        if (!result.ok) { if (!result.cancelled) env.toast?.(result.error || '模板应用失败', null, true); return; }
        manager.cancelEditing();
        env.render?.({ reveal: { kind: 'template', id: template.id }, focus: { kind: 'template', id: template.id, selector: '.sp-alm-manager-template-apply' } });
        if (env.settings?.().notifyMode !== 'off') env.toast?.(`已应用历法模板：${template.name}`);
    });
    $almanac.on('click', '.sp-alm-manager-template-delete', async function () {
        const id = $(this).attr('data-id');
        const template = manager.template(id);
        if (!template) { env.toast?.('模板已不存在', null, true); env.render?.(); return; }
        const result = await manager.delete(id, { confirm: () => env.confirm?.({ title: '删除历法模板', body: `确定删除「${template.name}」吗？角色卡绑定也会一并解除。`, confirmText: '删除', cancelText: '取消' }) });
        if (!result.ok && result.reason !== 'cancelled') env.toast?.(result.error || '模板删除失败', null, true);
    });
    $almanac.on('click', '.sp-alm-manager-template-bind', function () {
        const id = $(this).attr('data-id');
        manager.setBindingView(id, manager.bindingId() !== id);
    });
    $almanac.on('input', '.sp-alm-manager-bind-search', function () {
        if (!manager.isOpen()) return;
        manager.setBindingQuery($(this).val());
        const id = $(this).attr('data-template-id');
        $(this).closest('.sp-alm-manager-bind-panel').find('.sp-alm-manager-bind-results').html(manager.renderBindingOptions(id));
    });
    $almanac.on('click', '.sp-alm-manager-bind-option', async function () {
        await manager.updateBinding($(this).attr('data-avatar'), $(this).attr('data-template-id'));
    });
    $almanac.on('click', '.sp-alm-manager-bind-chip-remove', async function () {
        await manager.updateBinding($(this).attr('data-avatar'), null, $(this).attr('data-template-id'));
    });
}
