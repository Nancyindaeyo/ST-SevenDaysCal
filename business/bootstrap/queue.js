export const BOOTSTRAP_STEPS = Object.freeze(['outline', 'point', 'lines', 'axis', 'ledger-capture', 'dashed']);

export const BOOTSTRAP_LABELS = Object.freeze({
    outline: '面',
    point: '点',
    lines: '线',
    axis: '轴',
    'ledger-capture': '刻度标注',
    dashed: '冷知识',
});

export const BOOTSTRAP_MODULES = Object.freeze({
    outline: 'outline',
    point: 'point',
    lines: 'lines',
    axis: 'axis',
    'ledger-capture': 'ledger',
    dashed: 'dashed',
});

export function bootstrapStepActivity(step, { outcome = 'failed', error = '', reasonCode = '' } = {}) {
    const id = String(step || '');
    const label = BOOTSTRAP_LABELS[id] || '这一项';
    const module = BOOTSTRAP_MODULES[id] || '';
    if (outcome === 'failed') {
        return {
            source: 'bootstrap',
            outcome: 'failed',
            error: String(error || '').trim().slice(0, 200),
            reasonCode: String(reasonCode || `bootstrap-${id || 'step'}-failed`).slice(0, 80),
            note: `${label}开局生成失败`,
            items: [{ module, title: label, action: 'replace' }],
        };
    }
    return {
        source: 'bootstrap',
        outcome,
        note: outcome === 'unchanged' ? `${label}开局没有变化` : `开局已生成${label}`,
        items: [{ module, title: label, action: 'replace' }],
    };
}

export function booksAreEmpty(flags = {}) {
    return !flags.hasOutline && !flags.hasPoint && !flags.hasLines;
}

export function storyClockAllowed(flags = {}) {
    return !booksAreEmpty(flags);
}

export function automationAllowed(jobId, flags = {}) {
    if (booksAreEmpty(flags)) return false;
    switch (String(jobId || '')) {
        case 'align': return !!(flags.hasPoint || flags.hasLines);
        case 'advance': return !!flags.hasLines;
        case 'supplement': return !!flags.hasAlmanac;
        case 'ledger-capture':
        case 'ledger-judge': return flags.ledgerCaptureEnabled === true;
        case 'outline': return !!flags.hasOutline;
        case 'dashed': return flags.dashedEnabled === true;
        default: return true;
    }
}

export function planBootstrapSteps(flags = {}) {
    if (!booksAreEmpty(flags)) return [];
    const steps = [];
    if (!flags.hasOutline) steps.push('outline');
    if (!flags.hasPoint) steps.push('point');
    if (!flags.hasLines) steps.push('lines');
    if (!flags.hasAlmanac) steps.push('axis');
    if (flags.ledgerCaptureEnabled && flags.ledgerEmpty) steps.push('ledger-capture');
    if (flags.dashedEnabled && flags.dashedEmpty) steps.push('dashed');
    return steps;
}

export function nextBootstrapIndex(steps, from = 0) {
    const start = Math.max(0, Math.floor(Number(from) || 0));
    return start < steps.length ? start : -1;
}
