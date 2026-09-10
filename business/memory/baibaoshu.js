export function usesBaiBaiBook(settings = {}) {
    return settings.useBaiBaiBook === true;
}

function clip(value, max = 80) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function formatBaiBaiBookContext(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return '';
    const parts = [];
    const time = clip(snapshot.state?.time, 60);
    const location = clip(snapshot.state?.location, 40);
    if (time || location) {
        parts.push(`【眼下】${[time && `时间：${time}`, location && `地点：${location}`].filter(Boolean).join('；')}`);
    }
    const plans = (Array.isArray(snapshot.plans) ? snapshot.plans : [])
        .filter(item => item && item.status !== 'resolved')
        .slice(0, 8);
    if (plans.length) {
        parts.push('【进行中的计划／悬念】（柏宝书已记账，生成点/线时对齐这些，不要另起一套）');
        for (const plan of plans) {
            const kind = plan.kind === 'suspense' ? '悬念' : '计划';
            const target = clip(plan.targetTime, 24);
            parts.push(`- ${kind}：${clip(plan.content, 72)}${target ? `（目标：${target}）` : ''}`);
        }
    }
    const npcs = (Array.isArray(snapshot.npcs) ? snapshot.npcs : [])
        .filter(item => item && clip(item.name, 20))
        .slice(0, 8);
    if (npcs.length) {
        parts.push('【人物】');
        for (const npc of npcs) {
            const bits = [clip(npc.name, 16), clip(npc.title, 20), clip(npc.relation, 24), clip(npc.condition, 20)].filter(Boolean);
            parts.push(`- ${bits.join(' · ')}`);
        }
    }
    return parts.join('\n');
}

export function readBaiBaiBookGarnish(api) {
    if (!api || typeof api.getSnapshot !== 'function') return '';
    try {
        return formatBaiBaiBookContext(api.getSnapshot());
    } catch {
        return '';
    }
}

export function readBaiBaiBookHistory(api, { full = false } = {}) {
    if (!api || typeof api.getInjectedHistory !== 'function') return '';
    if (full && typeof api.getHistory === 'function') return api.getHistory()?.relativeText || '';
    return api.getInjectedHistory()?.relativeText || '';
}

export function baiBaiBookCoverage(api) {
    if (!api || typeof api.getInjectedHistory !== 'function') return { ready: false };
    try {
        const cov = api.getInjectedHistory()?.coverage;
        if (cov?.complete === false) {
            return { ready: true, complete: false, missing: cov.missingAiFloors?.length ?? '?' };
        }
        return { ready: true, complete: true, missing: 0 };
    } catch {
        return { ready: true };
    }
}

export function baiBaiBookStatusHtml(coverage, escapeHtml = value => String(value ?? '')) {
    if (!coverage?.ready) {
        return '<i class="fa-solid fa-triangle-exclamation" style="color:#e0a54e"></i> 检测不到柏宝书 API：请确认已安装并把柏宝书更新到最新版（旧版无读取接口）；点 / 线 / 面 / 间 生成时不会注入历史记忆';
    }
    const msg = coverage.complete === false
        ? `柏宝书已就绪（缺 ${escapeHtml(String(coverage.missing))} 楼摘要）`
        : coverage.complete === true
            ? '柏宝书已就绪（覆盖完整）'
            : '柏宝书已就绪';
    return `<i class="fa-solid fa-circle-check" style="color:var(--cardhub-accent,#7c9)"></i> ${msg}`;
}
