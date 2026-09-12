import { formatCalendarDate } from '../axis/date-format.js';
import {
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
    if (!running && !queuedJobs.length && !failedJobs.length) {
        return `<div class="sp-activity-queue-live is-idle"><span class="sp-activity-queue-idle">这楼后台空闲</span></div>`;
    }
    const runningHtml = running
        ? `<span class="sp-activity-queue-running">正在${escape(running.label)}</span>`
        : '';
    const queuedHtml = queuedJobs.length
        ? `<span class="sp-activity-queue-wait">接着 ${escape(queuedJobs.map(job => job.label).join(' · '))}</span>`
        : '';
    const failedHtml = failedJobs.map(job => (
        `<button type="button" class="sp-activity-queue-fail" data-queue-retry="${escape(job.id)}" title="重试${escape(job.label)}">${escape(job.label)}失败 · 重试</button>`
    )).join('');
    return `<div class="sp-activity-queue-live${failedJobs.length ? ' has-failed' : ''}">${runningHtml}${queuedHtml}${failedHtml}</div>`;
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
            <p>这楼重 roll 了。推进会按新时间戳自己处理。对齐楼会按新正文自动再对齐；没补上或失败时，点下面这颗，或卡片上的重试。</p>
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
        <p class="sp-activity-section-kicker sp-activity-recent-kicker">最近</p>
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
    if (entry.outcome === 'failed') return `<p class="sp-cfg-hint">${escape(entry.error || (isAdvanceEntry(entry) ? '推进失败' : '对齐失败'))}</p>`;
    if (entry.outcome === 'unchanged') return '<p class="sp-cfg-hint">API 跑过了，点和线都不用改</p>';
    return '<p class="sp-cfg-hint">没有条目变化</p>';
}

function cardButtons(entry, entries) {
    const button = (cls, label) => `<button type="button" class="sp-btn ${cls}" data-id="${escape(entry.id)}">${label}</button>`;
    const undo = entry.undone
        ? '<span class="sp-activity-undone">已撤回</span>'
        : canUndoActivity(entry, entries)
            ? button('sp-activity-undo', '撤回')
            : '';
    const retry = isAlignEntry(entry) || isAdvanceEntry(entry) || (isRetryableEntry(entry) && entry.outcome === 'failed')
        ? button('sp-activity-retry', '重试') : '';
    const quote = (entry.note || (entry.items || []).length) ? button('sp-activity-quote', '拿到间里聊') : '';
    const actions = `${undo}${retry}${quote}`;
    return actions ? `<div class="sp-activity-card-actions">${actions}</div>` : '';
}

function cardMeta(entry) {
    const extra = causeLabel(entry.cause);
    return extra ? `<span class="sp-activity-cause">${escape(extra)}</span>` : '';
}

function roundStatus(entry) {
    if (entry.undone) return '已撤回';
    if (entry.outcome === 'failed') return '失败';
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
    supplement: '还没有补录记录。故事换日且历里已有条目时会穿插纪念日。',
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
        ${itemListHtml(entry)}
    </div>`;
}

export function renderAlignRounds(entries = []) {
    return renderPaceDetail('align', entries);
}

export function renderActivityList(entries = []) {
    if (!entries.length) {
        return `<div class="sp-empty sp-activity-empty"><p>这轮聊天还没有后台改账。</p><p class="sp-cfg-hint">上面能看见这楼正在跑谁、后面排谁。自动对齐、推进、补录、刻度、面、冷知识跑完会记在下面，失败可重试。</p></div>`;
    }
    return `<ol class="sp-activity-list">${entries.slice(0, 3).map(entry => {
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
            ${itemListHtml(entry, { undo: true, entries })}
        </li>`;
    }).join('')}</ol>`;
}
