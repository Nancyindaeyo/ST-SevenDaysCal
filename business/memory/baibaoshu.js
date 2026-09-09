export function usesBaiBaiBook(settings = {}) {
    return settings.useBaiBaiBook === true;
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
