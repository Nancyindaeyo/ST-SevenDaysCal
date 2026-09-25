import { formatCalendarDate } from '../axis/date-format.js';
import {
    ACTIVITY_LIST_PREVIEW,
    actionLabel,
    canUndoActivity,
    causeLabel,
    isAdvanceEntry,
    isAlignEntry,
    isRetryableEntry,
    moduleLabel,
    sourceLabel,
    undoItemKey,
} from './schema.js';
import { canJumpActivityItem, latestPaceEntry } from './jump.js';

function escape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function timeLabel(ts) {
    const date = new Date(Number(ts) || Date.now());
    const pad = n => String(n).padStart(2, '0');
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function elapsedLabel(ts) {
    const seconds = Math.max(0, Math.floor((Date.now() - Number(ts || 0)) / 1000));
    if (seconds < 60) return `${seconds} 秒`;
    return `${Math.floor(seconds / 60)} 分`;
}

export function activityClockLabel({ clock = null, today = null, calendar = null, monthName, weekdayFor } = {}) {
    const meta = [clock?.endMeta, clock?.startMeta].find(item => item && (item.month != null && item.day != null));
    const axis = today && Number.isInteger(Number(today.month)) && Number.isInteger(Number(today.day))
        ? formatCalendarDate({ month: Number(today.month), day: Number(today.day), year: today.year, eraLabel: today.eraLabel }, calendar, monthName)
        : '';
    const axisWeekday = today && weekdayFor ? String(weekdayFor(today) || '').trim() : '';
    if (meta) {
        const stamp = formatCalendarDate(meta, calendar, monthName);
        const extra = [meta.weekdayText, meta.time].filter(Boolean).join(' ');
        return extra ? `当前时间戳 ${stamp} ${extra}` : `当前时间戳 ${stamp}`;
    }
    if (axis) return `这楼还没有时间戳，轴上今天是 ${axis}${axisWeekday ? ` ${axisWeekday}` : ''}`;
    return '还没有故事日期';
}

export function renderQueueStatus(queue = null) {
    const failedJobs = queue?.failed || [];
    const queuedJobs = queue?.queued || [];
    const running = queue?.running;
    const skippedJobs = queue?.skipped || [];
    const rejectedJobs = queue?.rejected || [];
    const cancelledJobs = queue?.cancelled || [];
    if (!running && !queuedJobs.length && !failedJobs.length && !skippedJobs.length && !rejectedJobs.length && !cancelledJobs.length) {
        return `<div class="sp-activity-queue-live is-idle"><span class="sp-activity-queue-idle">这楼后台空闲</span></div>`;
    }
    const floorId = Number(queue?.floor?.floorId);
    const floorHtml = Number.isInteger(floorId)
        ? `<span class="sp-activity-queue-floor">楼层 #${floorId}</span>`
        : '';
    const runningHtml = running
        ? `<span class="sp-activity-queue-running">正在${escape(running.label)}${running.startedAt ? ` · 已运行 ${escape(elapsedLabel(running.startedAt))}` : ''}</span>`
        : '';
    const queuedHtml = queuedJobs.map(job => (
        `<span class="sp-activity-queue-wait"><span>等待 ${escape(job.label)} · 固定顺序${job.enqueuedAt ? ` · ${escape(elapsedLabel(job.enqueuedAt))}` : ''}</span><button type="button" class="sp-activity-queue-cancel" data-queue-cancel="${escape(job.id)}" title="取消尚未运行的${escape(job.label)}">取消</button></span>`
    )).join('');
    const failedHtml = failedJobs.map(job => (
        `<button type="button" class="sp-activity-queue-fail" data-queue-retry="${escape(job.id)}" title="重试${escape(job.label)}">${escape(job.label)}失败 · 重试</button>`
    )).join('');
    const skippedHtml = skippedJobs.map(job => {
        const reason = String(job.reason || job.error || '跳过');
        const hint = reason === 'no-stamp' ? '缺戳'
            : reason === 'config-missing' || reason === 'no-api' ? '没配 API'
                : reason === 'utility-route-invalid' ? '机械路由失效'
                    : reason === 'utility-route-paused' ? '机械任务已暂停'
                        : reason;
        return `<button type="button" class="sp-activity-queue-skip" data-queue-retry="${escape(job.id)}" data-skip-reason="${escape(reason)}" title="${escape(job.label)}跳过">${escape(job.label)}跳过 · ${escape(hint)}</button>`;
    }).join('');
    const rejectedHtml = rejectedJobs.map(job => {
        const reason = job.reason === 'duplicate' ? '重复任务已合并'
            : job.reason === 'invalid-job' ? '任务格式无效'
                : job.reason === 'automation-disabled' ? '自动化开关或账本条件未满足'
                : job.reason === 'identity-changed' ? '聊天或楼层身份已变化'
                    : job.reason || '已拒绝';
        return `<span class="sp-activity-queue-rejected">${escape(job.label)} · ${escape(reason)}</span>`;
    }).join('');
    const cancelledHtml = cancelledJobs.map(job => `<span class="sp-activity-queue-cancelled">${escape(job.label)} · 已取消</span>`).join('');
    return `<div class="sp-activity-queue-live${failedJobs.length ? ' has-failed' : ''}${skippedJobs.length ? ' has-skipped' : ''}">${floorHtml}${runningHtml}${queuedHtml}${failedHtml}${skippedHtml}${rejectedHtml}${cancelledHtml}</div>`;
}

export function activityOverlayHtml() {
    return `<div id="sp-activity-overlay" class="sp-settings-overlay" style="display:none">
        <div class="sp-settings-header">
            <span class="sp-settings-title"><i class="fa-solid fa-layer-group"></i> 后台与改动</span>
            <button type="button" class="sp-icon-btn sp-activity-close-btn" title="关闭"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="sp-activity-clock" class="sp-activity-clock">还没有故事日期</div>
        <section class="sp-activity-live" aria-label="本楼后台">
            <p class="sp-activity-section-kicker">本楼</p>
            <div id="sp-activity-queue" class="sp-activity-queue"></div>
        </section>
        <div id="sp-activity-pace" class="sp-activity-pace">
            <p class="sp-activity-section-kicker">节拍</p>
            <div id="sp-activity-pace-strip-host"></div>
            <div id="sp-activity-pace-detail" class="sp-activity-pace-detail" hidden></div>
        </div>
        <div id="sp-activity-restyle" class="sp-activity-restyle" hidden>
            <p>这楼重 roll 了。换日会按这楼新旧戳再推进；同日只改钟点不推。对齐楼会按新正文自动再对齐；没补上或失败时，点下面这颗，或卡片上的重试。</p>
            <button type="button" class="sp-btn sp-btn-primary sp-activity-realign">按新正文再对齐一次</button>
        </div>
        <div id="sp-activity-stamp" class="sp-activity-restyle" hidden>
            <p>这楼没打上时间戳，日期制推进先停着。补上起止时间后会按新戳再判断要不要推进。</p>
            <button type="button" class="sp-btn sp-btn-primary sp-activity-stamp-fill">手动补时间戳</button>
        </div>
        <div id="sp-activity-advance" class="sp-activity-restyle" hidden>
            <p>时间戳已经换日，但这轮自动推进没补上。可以重试自动推进；若线还停在旧日，也可以只把它们推到今天。这和线页上「缺后天再一起演化」不是同一件事。</p>
            <div class="sp-activity-restyle-actions">
                <button type="button" class="sp-btn sp-btn-primary sp-activity-readvance">重试自动推进</button>
                <button type="button" class="sp-btn sp-activity-catchup">手动推进到今天</button>
            </div>
        </div>
        <div id="sp-activity-blocked" class="sp-activity-restyle" hidden>
            <p>这楼重 roll 后，这些项因为后来手改过没法自动撤回重跑：<span id="sp-activity-blocked-list"></span>。请在本页手改，或先撤回【改】里还能撤的卡片再重试。</p>
        </div>
        <div class="sp-activity-recent-head">
            <p class="sp-activity-section-kicker sp-activity-recent-kicker">最近</p>
            <button type="button" class="sp-activity-summary-copy"><i class="fa-regular fa-copy"></i> 复制本轮摘要</button>
        </div>
        <div class="sp-settings-body" id="sp-activity-body"></div>
    </div>`;
}

export function activityButtonHtml() {
    return `<button type="button" class="sp-side-tab sp-activity-btn" aria-label="后台与改动">
        <span class="sp-tab-glyph" aria-hidden="true">改</span>
        <span class="sp-activity-badge" hidden></span>
    </button>`;
}

function itemWho(item) {
    return [moduleLabel(item.module), item.title].filter(Boolean).join(' · ');
}

export function quoteTextForSpace(entry) {
    const lines = [];
    if (entry?.note) lines.push(entry.note);
    for (const item of entry?.items || []) {
        const who = itemWho(item);
        const act = actionLabel(item.action, item.module);
        lines.push(act ? `${who}（${act}）` : who);
    }
    return lines.filter(Boolean).join('\n');
}

export function authorChangeSummary(entries = [], { clockLabel = '', floorId = null } = {}) {
    const scopedFloor = floorId == null ? Number.NaN : Number(floorId);
    const list = (Array.isArray(entries) ? entries : []).filter(entry => (
        entry && !entry.undone && entry.outcome !== 'failed' && entry.outcome !== 'skipped'
        && (!Number.isInteger(scopedFloor) || Number(entry.floorId) === scopedFloor)
    ));
    const lines = ['构画 · 本轮变更摘要'];
    if (Number.isInteger(scopedFloor)) lines.push(`楼层 #${scopedFloor}`);
    if (clockLabel) lines.push(String(clockLabel));
    if (!list.length) {
        lines.push('', '本轮还没有已完成的账本改动。');
        return lines.join('\n');
    }
    for (const entry of list) {
        const title = [sourceLabel(entry.source), timeLabel(entry.ts)].filter(Boolean).join(' · ');
        lines.push('', `【${title}】${entry.note ? ` ${String(entry.note).trim()}` : ''}`);
        for (const item of entry.items || []) {
            lines.push(`- ${itemWho(item)}：${actionLabel(item.action, item.module)}`);
        }
        if (!(entry.items || []).length) lines.push(`- ${roundStatus(entry)}`);
    }
    return lines.join('\n');
}

function jumpButton(item) {
    if (!canJumpActivityItem(item)) return '';
    const ref = item.ref ? ` data-ref="${escape(item.ref)}"` : '';
    return `<button type="button" class="sp-activity-jump" data-module="${escape(item.module)}" data-title="${escape(item.title || '')}"${ref} title="去这条" aria-label="去这条"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></button>`;
}

function undoItemButton(entry, item, entries) {
    if (item.module !== 'point' && item.module !== 'lines') return '';
    if ((entry.undoneRefs || []).includes(undoItemKey(item))) return '<span class="sp-activity-item-undone">已撤</span>';
    if (entry.undone || !canUndoActivity(entry, entries)) return '';
    const ref = item.ref ? ` data-ref="${escape(item.ref)}"` : '';
    return `<button type="button" class="sp-activity-undo-item" data-id="${escape(entry.id)}" data-module="${escape(item.module)}" data-title="${escape(item.title || '')}" data-action="${escape(item.action || '')}"${ref} title="撤回这条" aria-label="撤回这条">撤</button>`;
}

function itemListHtml(entry, { undo = false, entries = [] } = {}) {
    const items = (entry.items || []).map(item => (
        `<li><span>${escape(itemWho(item))}</span><em>${escape(actionLabel(item.action, item.module))}</em>${jumpButton(item)}${undo ? undoItemButton(entry, item, entries) : ''}</li>`
    )).join('');
    if (items) return `<ul class="sp-activity-items">${items}</ul>`;
    if (entry.outcome === 'failed') return `<p class="sp-cfg-hint">${escape(entry.error || (isAdvanceEntry(entry) ? '推进失败' : '这次失败了'))}</p>${reasonHint(entry)}`;
    if (entry.outcome === 'skipped') return `<p class="sp-cfg-hint">${escape(entry.note || entry.error || '这次跳过了')}</p>${reasonHint(entry)}`;
    if (entry.outcome === 'unchanged') return `<p class="sp-cfg-hint">${escape(entry.note || '没有变化')}</p>`;
    return '<p class="sp-cfg-hint">没有条目变化</p>';
}

function reasonHint(entry) {
    return entry?.reasonCode ? `<p class="sp-cfg-hint sp-activity-reason">${escape(entry.reasonCode)}</p>` : '';
}

function cardButtons(entry, entries) {
    const button = (cls, label) => `<button type="button" class="sp-btn ${cls}" data-id="${escape(entry.id)}">${label}</button>`;
    const undo = entry.undone
        ? '<span class="sp-activity-undone">已撤回</span>'
        : canUndoActivity(entry, entries)
            ? button('sp-activity-undo', '撤回')
            : '';
    const retry = entry.outcome !== 'skipped' && (isAlignEntry(entry) || isAdvanceEntry(entry) || (isRetryableEntry(entry) && entry.outcome === 'failed'))
        ? button('sp-activity-retry', '重试') : '';
    const quote = (entry.note || (entry.items || []).length) ? button('sp-activity-quote', '拿到间里聊') : '';
    const shiftFix = entry.source === 'shift' && !entry.undone && entry.snapshot
        ? `${button('sp-activity-shift-align', '改成整体平移')}${button('sp-activity-shift-again', '再滚一次')}`
        : '';
    const actions = `${undo}${shiftFix}${retry}${quote}`;
    return actions ? `<div class="sp-activity-card-actions">${actions}</div>` : '';
}

function cardMeta(entry) {
    const extra = causeLabel(entry.cause);
    return extra ? `<span class="sp-activity-cause">${escape(extra)}</span>` : '';
}

function roundStatus(entry) {
    if (entry.undone) return '已撤回';
    if (entry.outcome === 'failed') return '失败';
    if (entry.outcome === 'skipped') return '跳过';
    if (entry.outcome === 'unchanged') return '没有变化';
    if (entry.stale) return '这楼重 roll 了';
    const count = (entry.items || []).length;
    const undone = (entry.undoneRefs || []).length;
    if (undone && count) return `改了 ${count} 条，已撤回 ${undone} 条`;
    return count ? `改了 ${count} 条` : '已对齐';
}

const PACE_EMPTY = {
    align: '还没有对齐记录。倒计时到了会跑，详情写在下面。',
    advance: '还没有推进记录。倒计时到了会跑，详情写在下面。',
    outline: '还没有面判定记录。倒计时到了会跑，详情写在下面。',
    dashed: '还没有冷知识改动。倒计时到了会跑，详情写在下面。',
    supplement: '还没有补录记录。每 10 条 AI 楼补一次；爱心加号仍可手补。',
    'ledger-capture': '还没有刻度标注记录。倒计时到了会跑。',
    'ledger-judge': '还没有刻度现状记录。倒计时到了会跑。',
};

export function renderPaceDetail(paceId, entries = []) {
    const entry = latestPaceEntry(entries, paceId);
    if (!entry) {
        return `<div class="sp-pace-detail-empty"><p>${PACE_EMPTY[paceId] || '这类还没有改动记录。'}</p></div>`;
    }
    const stale = entry.stale && !entry.undone ? '<p class="sp-activity-stale">这楼重 roll 了</p>' : '';
    return `<div class="sp-pace-latest"${entry.undone ? ' data-undone="true"' : ''}>
        <div class="sp-pace-latest-head">
            <b>${escape(sourceLabel(entry.source))}</b>
            ${cardMeta(entry)}
            <time>${escape(timeLabel(entry.ts))}</time>
            <span class="sp-align-round-status">${escape(roundStatus(entry))}</span>
        </div>
        ${stale}
        ${itemListHtml(entry, { undo: true, entries })}
        ${cardButtons(entry, entries)}
    </div>`;
}

export function renderAlignRounds(entries = []) {
    return renderPaceDetail('align', entries);
}

export function renderActivityList(entries = [], { expanded = false } = {}) {
    if (!entries.length) {
        return `<div class="sp-empty sp-activity-empty"><p>这轮聊天还没有后台改账。</p><p class="sp-cfg-hint">上面能看见这楼正在跑谁、后面排谁。自动对齐、推进、补录、刻度、面、冷知识跑完会记在下面；开局生成、补窗口和刷新账本失败也能在这里重试。</p></div>`;
    }
    const preview = Math.max(1, ACTIVITY_LIST_PREVIEW);
    const shown = expanded ? entries : entries.slice(0, preview);
    const more = !expanded && entries.length > preview
        ? `<button type="button" class="sp-btn sp-activity-more">查看更早（${entries.length - preview}）</button>`
        : '';
    return `<ol class="sp-activity-list">${shown.map(entry => {
        const stale = entry.stale && !entry.undone
            ? '<p class="sp-activity-stale">这楼重 roll 了</p>'
            : '';
        const note = entry.note ? `<p class="sp-activity-note">${escape(entry.note)}</p>` : '';
        const failed = entry.outcome === 'failed' && !entry.undone;
        return `<li class="sp-activity-card${entry.undone ? ' is-undone' : ''}${entry.stale && !entry.undone ? ' is-stale' : ''}${failed ? ' is-failed' : ''}${entry.outcome === 'unchanged' ? ' is-quiet' : ''}" data-id="${escape(entry.id)}">
            <div class="sp-activity-card-head">
                <div class="sp-activity-card-meta">
                    <b>${escape(sourceLabel(entry.source))}</b>
                    ${cardMeta(entry)}
                    <time>${escape(timeLabel(entry.ts))}</time>
                </div>
                ${cardButtons(entry, entries)}
            </div>
            ${stale}
            ${note}
            ${entry.reasonCode && (entry.outcome === 'failed' || entry.outcome === 'skipped') && (entry.items || []).length ? reasonHint(entry) : ''}
            ${itemListHtml(entry, { undo: true, entries })}
        </li>`;
    }).join('')}</ol>${more}`;
}
