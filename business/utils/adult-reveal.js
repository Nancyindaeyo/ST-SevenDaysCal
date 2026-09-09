export const ADULT_REVEAL_ROOT = '.sp-line-card, .sp-inline-line, .sp-event, .sp-sch-drawer-item';

export function isAdultRevealKey(key) {
    return key === 'Enter' || key === ' ';
}

export function bindAdultReveal(env = {}) {
    const $ = env.$;
    const revealAdult = function (e) {
        const node = $(this);
        const root = node.closest(ADULT_REVEAL_ROOT);
        if (root.hasClass('sp-adult-revealed')) return;
        e.preventDefault();
        e.stopPropagation();
        root.addClass('sp-adult-revealed');
        root.find('.sp-adult-sensitive').removeAttr('role tabindex aria-label title').find('[aria-hidden="true"]').removeAttr('aria-hidden');
    };
    const revealAdultKey = function (e) {
        if (!isAdultRevealKey(e.key)) return;
        revealAdult.call(this, e);
    };
    const bind = $root => $root
        .off('click.spAdultReveal keydown.spAdultReveal', '.sp-adult-sensitive')
        .on('click.spAdultReveal', '.sp-adult-sensitive', revealAdult)
        .on('keydown.spAdultReveal', '.sp-adult-sensitive', revealAdultKey);
    bind(env.$in('#sp-lines-wrap'));
    bind(env.$in('#sp-body'));
    bind(env.$chat);
}
