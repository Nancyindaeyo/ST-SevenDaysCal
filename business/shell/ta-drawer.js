const NAME_NOISE = new Set(['series', 'chapter', 'note', 'summary', 'part', 'vol', 'act', 'scene',
    'title', 'author', 'narrator', 'system', 'user', 'assistant', 'ai']);

export function guessCharName(ctx = {}) {
    if (ctx.name2) return ctx.name2;
    const msgs = (ctx.chat || []).filter(m => !m.is_user && !m.is_system).slice(-20);
    const counts = {};
    for (const m of msgs) {
        const matches = [...(m.mes || '').matchAll(/^([^\s：:「」【\[\n*#]{1,12})[：:]/gm)];
        for (const match of matches) {
            const name = match[1].trim();
            if (name && !/[*#<>{}\[\]|\\]/.test(name) && !NAME_NOISE.has(name.toLowerCase()))
                counts[name] = (counts[name] || 0) + 1;
        }
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || '';
}

export function taTriggerLabel(currentView, charViewName) {
    return (currentView === 'char' && charViewName) ? charViewName : 'TA';
}

export function nextTaToggle({ open = false, pinCount = 0, currentView, charViewName } = {}) {
    if (open) return 'close';
    if (pinCount > 0) return 'open';
    if (currentView !== 'char' && charViewName) return 'activate';
    return 'picker';
}

export function clickInsideTaDrawer(path) {
    return (path || []).some(el => el instanceof Element && el.matches('#sp-ta-drawer, #sp-ta-trigger'));
}

export function taDrawerHtml(pins, { currentView, charViewName, escapeAttr, escapeHtml } = {}) {
    const slots = (pins || []).map(n => `
        <div class="sp-ta-slot${currentView === 'char' && charViewName === n ? ' sp-ta-slot-active' : ''}" data-name="${escapeAttr(n)}">
            <span class="sp-ta-slot-name">${escapeHtml(n)}</span>
            <button type="button" class="sp-ta-slot-del" data-name="${escapeAttr(n)}" title="移除固定"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join('');
    return `${slots}<button type="button" class="sp-ta-add"><i class="fa-solid fa-user-plus"></i> 添加 / 查看角色</button>`;
}

export function createTaDrawer(env = {}) {
    const $in = env.$in;
    const $ = env.$;
    let open = false;

    function updateLabel() {
        $in('#sp-ta-trigger .sp-ta-label').text(taTriggerLabel(env.currentView?.(), env.charViewName?.()));
    }

    function close() {
        $in('#sp-ta-drawer').css('display', 'none').empty();
        open = false;
        $in('#sp-ta-trigger').removeClass('sp-ta-open');
        $(document).off('click.tadrawer');
    }

    function show() {
        $in('#sp-ta-drawer').html(taDrawerHtml(env.pins?.() || [], {
            currentView: env.currentView?.(),
            charViewName: env.charViewName?.(),
            escapeAttr: env.escapeAttr,
            escapeHtml: env.escapeHtml,
        })).css('display', 'block');
        open = true;
        $in('#sp-ta-trigger').addClass('sp-ta-open');
        $(document).off('click.tadrawer').on('click.tadrawer', function (e) {
            if (clickInsideTaDrawer(e.originalEvent?.composedPath?.() || [])) return;
            close();
        });
    }

    function toggle() {
        const next = nextTaToggle({
            open,
            pinCount: (env.pins?.() || []).length,
            currentView: env.currentView?.(),
            charViewName: env.charViewName?.(),
        });
        if (next === 'close') { close(); return next; }
        if (next === 'open') { show(); return next; }
        if (next === 'activate') { env.activate?.(env.charViewName?.()); return next; }
        env.openPicker?.();
        return next;
    }

    function bindUi() {
        $in('#sp-ta-drawer').on('click', '.sp-ta-slot-del', function (e) {
            e.stopPropagation();
            env.removePin?.($(this).attr('data-name'));
            if ((env.pins?.() || []).length) show();
            else close();
            env.refreshPinIcon?.();
        });
        $in('#sp-ta-drawer').on('click', '.sp-ta-slot', function () {
            env.activate?.($(this).attr('data-name'));
        });
        $in('#sp-ta-drawer').on('click', '.sp-ta-add', function () {
            close();
            env.openPicker?.();
        });
    }

    return { show, close, toggle, updateLabel, bindUi, isOpen: () => open };
}
