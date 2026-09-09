export function clickInsideModuleIntro(path) {
    return (path || []).some(el => typeof el?.matches === 'function' && el.matches('#sp-module-intro-pop, .sp-module-intro-btn'));
}

export function bindPanelChrome(env = {}) {
    const $in = env.$in;
    const $ = env.$;
    $in('.sp-close-btn').on('click', env.close);
    $in('.sp-settings-btn').on('click', () => { env.activity?.close?.(); env.toggleSettings?.(); });
    $in('.sp-settings-close-btn').on('click', env.toggleSettings);
    $in('.sp-fab-toggle-btn').on('click', function () {
        const nowEnabled = !env.fabEnabled?.();
        env.settings().fabShow = nowEnabled;
        env.save?.();
        $(`#${env.fabId}`).toggle(nowEnabled);
        $(this).toggleClass('sp-btn-active', nowEnabled);
    });
    $in('.sp-theme-toggle-btn').on('click', env.cycleTheme);
    $in('.sp-backdrop').on('click', env.close);
}

export function bindModuleIntro(env = {}) {
    const $in = env.$in;
    const $ = env.$;
    $in('.sp-module-intro-btn').on('click', function (e) {
        e.stopPropagation();
        const $pop = $in('#sp-module-intro-pop');
        if ($pop.is(':visible')) { $pop.hide(); return; }
        const view = $in('.sp-side-tab.sp-view-active').data('view') || 'schedule';
        $pop.html(env.intros?.[view] || env.intros?.schedule).show();
    });
    $(document).off('click.spIntro').on('click.spIntro', function (e) {
        const path = e.originalEvent?.composedPath?.() || [];
        if (clickInsideModuleIntro(path)) return;
        $in('#sp-module-intro-pop').hide();
    });
}
