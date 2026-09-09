export function validLinesSheet(sheet) {
    return sheet === 'events' || sheet === 'dashed';
}

export function parseLineIndex(value) {
    const idx = Number(value);
    return Number.isInteger(idx) ? idx : null;
}

function stopThen(handler) {
    return function (e) {
        e.stopPropagation();
        return handler.call(this, e);
    };
}

export function bindLinesPanel(env = {}) {
    const $ = env.$;
    const lines = env.lines;
    const $wrap = env.$in('#sp-lines-wrap');
    const $chat = env.$chat;

    $wrap.on('click', '#sp-gen-lines-now', env.generate);
    $wrap.on('click', '.sp-lines-sheet-btn', function () {
        const sheet = $(this).attr('data-sheet');
        if (!validLinesSheet(sheet)) return;
        lines.setSheet(sheet);
        lines.refreshPanel();
    });
    $wrap.on('click', '.sp-lines-dashed-add', () => lines.dashed.openDialog());
    $wrap.on('click', '.sp-lines-dashed-lock', function () { lines.dashed.toggle($(this).attr('data-id')); });
    $wrap.on('click', '.sp-lines-dashed-delete', function () { lines.dashed.remove($(this).attr('data-id')); });

    const reroll = stopThen(() => lines.actions.reroll());
    $wrap.on('click', '.sp-refresh-lines, .sp-inline-refresh-lines', reroll);
    $chat.on('click', '.sp-refresh-lines, .sp-inline-refresh-lines', reroll);

    const advance = stopThen(() => lines.actions.advance());
    $wrap.on('click', '.sp-advance-lines, .sp-inline-advance-lines', advance);
    $chat.on('click', '.sp-advance-lines, .sp-inline-advance-lines', advance);

    $chat.on('click', '.sp-inline-refresh-dashed', stopThen(() => lines.dashed.run({ reroll: true })));

    const onIdx = fn => stopThen(function () {
        const idx = parseLineIndex($(this).attr('data-line-idx'));
        if (idx != null) fn(idx);
    });
    $wrap.on('click', '.sp-line-del-one', onIdx(idx => lines.actions.delete(idx)));
    $chat.on('click', '.sp-line-del-one', onIdx(idx => lines.actions.delete(idx)));
    $wrap.on('click', '.sp-line-pin-toggle', onIdx(idx => lines.actions.pin(idx)));
    $chat.on('click', '.sp-line-pin-toggle', onIdx(idx => lines.actions.pin(idx)));
    $wrap.on('click', '#sp-abort-lines', env.abort);
}
