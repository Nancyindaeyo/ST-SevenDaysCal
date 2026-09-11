export const PANEL_VIEWS = Object.freeze({
    schedule: Object.freeze({ sel: '#sp-body', display: 'show', title: '点', subToggle: true }),
    almanac: Object.freeze({ sel: '#sp-almanac-wrap', display: 'flex', title: '轴' }),
    lines: Object.freeze({ sel: '#sp-lines-wrap', display: 'flex', title: '线' }),
    outline: Object.freeze({ sel: '#sp-outline-wrap', display: 'flex', title: '面' }),
    space: Object.freeze({ sel: '#sp-space-wrap', display: 'flex', title: '间' }),
    theater: Object.freeze({ sel: '#sp-theater-wrap', display: 'flex', title: '棱' }),
    anchor: Object.freeze({ sel: '#sp-anchor-wrap', display: 'flex', title: '坐标' }),
});

function specOf(view) {
    return PANEL_VIEWS[view] ? view : 'schedule';
}

export function tabNavigationTarget(tabs, current, key) {
    const list = Array.from(tabs || []);
    if (!list.length) return null;
    const index = Math.max(0, list.indexOf(current));
    if (key === 'Home') return list[0];
    if (key === 'End') return list.at(-1);
    if (key === 'ArrowRight' || key === 'ArrowDown') return list[(index + 1) % list.length];
    if (key === 'ArrowLeft' || key === 'ArrowUp') return list[(index - 1 + list.length) % list.length];
    return null;
}

export function showPanelView($in, view) {
    const targetName = specOf(view);
    const target = PANEL_VIEWS[targetName];
    for (const [name, spec] of Object.entries(PANEL_VIEWS)) {
        const $el = $in(spec.sel);
        if (name === targetName) {
            if (spec.display === 'show') $el.show();
            else $el.css('display', spec.display);
            $el.attr('aria-hidden', 'false');
        } else {
            $el.hide();
            $el.attr('aria-hidden', 'true');
        }
    }
    if (target.subToggle) $in('#sp-sub-toggle').show();
    else $in('#sp-sub-toggle').hide();
    $in('#sp-content-title').text(target.title);
}

export function setActiveViewTabs($in, $inAll, { main = 'schedule', sub = 'user' } = {}) {
    $inAll('.sp-side-tab.sp-view-btn').removeClass('sp-view-active').attr({ 'aria-selected': 'false', tabindex: '-1' });
    $in(`.sp-side-tab.sp-view-btn[data-view="${main}"]`).addClass('sp-view-active').attr({ 'aria-selected': 'true', tabindex: '0' });
    $inAll('.sp-sub-btn').removeClass('sp-view-active').attr({ 'aria-selected': 'false', tabindex: '-1' });
    $in(`.sp-sub-btn[data-view="${sub}"]`).addClass('sp-view-active').attr({ 'aria-selected': 'true', tabindex: '0' });
}

export function paintScheduleHome($in, $inAll, { sub = 'user', wraps = true } = {}) {
    if (wraps) showPanelView($in, 'schedule');
    else {
        $in('#sp-content-title').text(PANEL_VIEWS.schedule.title);
        $in('#sp-sub-toggle').show();
    }
    setActiveViewTabs($in, $inAll, { main: 'schedule', sub });
}
