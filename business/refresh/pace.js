export function remainingFloors(used, interval) {
    const step = Math.max(1, Math.floor(Number(interval) || 1));
    const count = Math.max(0, Math.floor(Number(used) || 0));
    const rem = count % step;
    return rem === 0 ? step : step - rem;
}

export function formatRemain(used, interval) {
    const left = remainingFloors(used, interval);
    return left <= 1 ? '下一楼' : `还差 ${left} 楼`;
}

export function overlayQueueOnRows(rows = [], queue = null) {
    const runningId = queue?.running?.id || '';
    const queuedIds = new Set((queue?.queued || []).map(job => job.id));
    const failedIds = new Set((queue?.failed || []).map(job => job.id));
    const next = (Array.isArray(rows) ? rows : []).map(row => {
        if (runningId && row.id === runningId) return { ...row, text: '正在跑', due: true, live: 'running' };
        if (queuedIds.has(row.id)) return { ...row, text: '排队', due: true, live: 'queued' };
        if (failedIds.has(row.id)) return { ...row, text: '失败', due: true, live: 'failed' };
        return row;
    });
    const known = new Set(next.map(row => row.id));
    for (const job of [...(queue?.failed || []), ...(queue?.queued || []), queue?.running].filter(Boolean)) {
        if (known.has(job.id)) continue;
        const live = queue?.running?.id === job.id ? 'running' : (queuedIds.has(job.id) ? 'queued' : 'failed');
        next.push({
            id: job.id,
            label: job.label,
            text: live === 'running' ? '正在跑' : live === 'queued' ? '排队' : '失败',
            due: true,
            live,
        });
        known.add(job.id);
    }
    return next;
}

export function collectPaceRows(snap = {}) {
    const rows = [];
    const push = row => rows.push(row);

    if (snap.alignOn) {
        if (snap.alignFailed) push({ id: 'align', label: '对齐', text: '失败', due: true });
        else push({ id: 'align', label: '对齐', text: formatRemain(snap.alignUsed, snap.alignInterval) });
    }
    else push({ id: 'align', label: '对齐', text: '关着', off: true });

    if (!snap.linesOn) push({ id: 'advance', label: '推进', text: '线关着', off: true });
    else if (snap.linesMode === 'manual') push({ id: 'advance', label: '推进', text: '只手动', off: true });
    else if (snap.advanceFailed) push({ id: 'advance', label: '推进', text: '失败', due: true });
    else if (snap.pendingAdvance) push({ id: 'advance', label: '推进', text: '下一楼补', due: true });
    else if (snap.missingStamp) push({ id: 'advance', label: '推进', text: '缺时间戳', due: true });
    else if (snap.linesMode === 'days') push({ id: 'advance', label: '推进', text: '等日期变了' });
    else push({ id: 'advance', label: '推进', text: formatRemain(snap.advanceUsed, snap.advanceInterval) });

    if (snap.outlineOn) push({ id: 'outline', label: '面', text: formatRemain(snap.outlineUsed, snap.outlineInterval) });
    else push({ id: 'outline', label: '面', text: '关着', off: true });

    if (snap.dateOn) push({ id: 'date', label: '补日期', text: formatRemain(snap.dateUsed, snap.dateInterval), strip: false });
    else push({ id: 'date', label: '补日期', text: '关着', off: true, strip: false });

    if (!snap.dashedOn) push({ id: 'dashed', label: '冷知识', text: '关着', off: true });
    else if (snap.pendingDashed) push({ id: 'dashed', label: '冷知识', text: '下一楼补', due: true });
    else push({ id: 'dashed', label: '冷知识', text: formatRemain(snap.dashedUsed, snap.dashedInterval) });

    if (snap.ledgerOn) {
        push({ id: 'ledger-capture', label: '刻度标注', text: formatRemain(snap.ledgerCaptureUsed, snap.ledgerCaptureInterval) });
        push({ id: 'ledger-judge', label: '刻度现状', text: formatRemain(snap.ledgerJudgeUsed, snap.ledgerJudgeInterval) });
    } else {
        push({ id: 'ledger-capture', label: '刻度标注', text: '关着', off: true });
        push({ id: 'ledger-judge', label: '刻度现状', text: '关着', off: true });
    }

    return rows;
}

export function paceStripHtml(rows = [], { empty = '后台节奏都关着', id = 'sp-pace-strip', interactive = [] } = {}) {
    const live = rows.filter(row => !row.off && row.strip !== false);
    const clickable = new Set(Array.isArray(interactive) ? interactive : []);
    if (!live.length) {
        return `<div id="${id}" class="sp-pace-strip is-empty" role="status">${empty}</div>`;
    }
    const chips = live.map(row => {
        const live = row.live ? ` is-${row.live}` : '';
        const due = row.due || row.text === '下一楼' || row.text === '下一楼补' || row.text === '失败' || row.live === 'running' || row.live === 'queued' || row.live === 'failed' ? ' is-due' : '';
        const tag = clickable.has(row.id) ? 'button' : 'span';
        const type = tag === 'button' ? ' type="button"' : '';
        return `<${tag}${type} class="sp-pace-chip${due}${live}" data-pace="${row.id}"><span class="sp-pace-chip-label">${row.label}</span><span class="sp-pace-chip-value">${row.text}</span></${tag}>`;
    }).join('');
    return `<div id="${id}" class="sp-pace-strip" role="status">${chips}</div>`;
}

export function paceFoldHtml(rows) {
    return `<div class="sp-pace-fold" id="sp-pace-fold">${paceStripHtml(rows)}</div>`;
}
