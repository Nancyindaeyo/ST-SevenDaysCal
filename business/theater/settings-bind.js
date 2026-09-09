import { THEATER_COUNT_DEFAULT } from './constants.js';

export function clampTheaterCount(value, fallback = THEATER_COUNT_DEFAULT) {
    return Math.max(1, Math.min(3, Math.floor(Number(value) || fallback)));
}

export function nextTheaterPoolBooks(books, name, checked) {
    const set = new Set(books || []);
    const key = String(name || '');
    if (!key) return [...set];
    if (checked) set.add(key);
    else set.delete(key);
    return [...set];
}

export function theaterPoolRowVisible(name, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    return String(name || '').toLowerCase().includes(q);
}

export function bindTheaterSettings(env = {}) {
    const $in = env.$in;
    const $ = env.$;
    const settings = env.settings;
    const save = env.save;
    env.theater?.bindSettings?.($in('.sp-settings-body'));
    $in('#sp-theater-count').on('change', function () {
        const n = clampTheaterCount(this.value);
        settings().theaterCount = n;
        this.value = String(n);
        save?.();
    });
    $in('#sp-theater-pool-list').on('change', '.sp-theater-pool-cb', function () {
        const name = String($(this).data('name') || '');
        settings().theaterPoolBooks = nextTheaterPoolBooks(settings().theaterPoolBooks, name, this.checked);
        save?.();
        $(this).closest('.sp-wi-exclude-row').toggleClass('sp-wi-exclude-on', this.checked);
        env.theater?.refreshPoolList?.();
    });
    $in('#sp-theater-pool-search').on('input', function () {
        const query = this.value;
        $in('#sp-theater-pool-list .sp-wi-exclude-row').each(function () {
            $(this).toggle(theaterPoolRowVisible($(this).data('name'), query));
        });
    });
}
