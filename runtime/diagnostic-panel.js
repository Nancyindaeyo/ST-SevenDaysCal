import { escapeHtml } from '../utils/dom.js';

const SOURCE_LABELS = Object.freeze({
    queue: '后台队列',
    activity: '改动记录',
    trace: '运行日志',
});

function errorTime(ts) {
    const value = Number(ts);
    if (!Number.isFinite(value) || value <= 0) return '';
    try {
        return new Date(value).toLocaleString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    } catch { return ''; }
}

export function diagnosticOverviewHtml(overview = {}) {
    const errors = Array.isArray(overview.errors) ? overview.errors : [];
    if (!errors.length) {
        return '<div class="sp-diagnostics-empty"><i class="fa-regular fa-circle-check"></i><span>最近没有记录到错误</span></div>';
    }
    return errors.map(item => {
        const meta = [
            SOURCE_LABELS[item.source] || item.source,
            item.module,
            item.floorId == null ? '' : `#${item.floorId}`,
            errorTime(item.ts),
        ].filter(Boolean).map(escapeHtml).join(' · ');
        return `<article class="sp-diagnostics-error-item">
            <div class="sp-diagnostics-error-mark" aria-hidden="true"><i class="fa-solid fa-exclamation"></i></div>
            <div class="sp-diagnostics-error-copy">
                <div class="sp-diagnostics-error-title">${escapeHtml(item.title || '未知错误')}</div>
                ${item.detail ? `<div class="sp-diagnostics-error-detail">${escapeHtml(item.detail)}</div>` : ''}
                ${meta ? `<div class="sp-diagnostics-error-meta">${meta}</div>` : ''}
            </div>
        </article>`;
    }).join('');
}
