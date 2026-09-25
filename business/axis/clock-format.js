import { isGregorian } from '../calendar/date.js';
import { formatCalendarDate } from './date-format.js';

// 纯显示格式化：轴面板只展示人类可读值，不把 date=/time= 等机器字段泄漏给用户。
// 无法确认结构化值时：公历回退已转义 raw；自定义历显示「日期待确认」，不把越界 raw 当成已确认。
export function formatStoryClockMeta(meta, escape = value => String(value ?? ''), calendar = null, monthName = (_cal, month) => `${month}月`) {
    const m = meta && typeof meta === 'object' ? meta : null;
    if (!m?.valid) {
        if (calendar && !isGregorian(calendar)) {
            const human = ['日期待确认', m?.weekdayText || '', m?.time || ''].filter(Boolean).join(' ');
            return escape(human);
        }
        return escape(m?.raw || '');
    }
    const date = m.month != null && m.day != null ? formatCalendarDate(m, calendar, monthName) : '';
    const weekday = m.weekdayText || '';
    const time = m.time || '';
    const human = [date, weekday, time].filter(Boolean).join(' ');
    return escape(human || m.raw || '');
}

// 楼内小时间条的纯组装 seam：只统一最终月名显示，不发明新日期。
export function formatStoryClockHeadParts({ anchor, anchorWeekday, clockMeta = null, stampDate = null, rawStamp = '', calendar = null, monthName = (_cal, month) => `${month}月`, escapeHtml = value => String(value ?? ''), tip = '' } = {}) {
    const today = (dateText, weekday = '', title = '') => `<span class="sp-dash-sum-today"${title ? ` title="${escapeHtml(title)}"` : ''}>${escapeHtml(dateText)}${weekday ? ` ${escapeHtml(weekday)}` : ''}</span>`;
    const dateText = value => formatCalendarDate(value, calendar, monthName);
    const fallbackWeekday = anchorWeekday || '星期未记录';
    const fallback = { todayHtml: today(dateText(anchor), fallbackWeekday), timeHtml: anchor?.time ? `<span class="sp-dash-sum-time">${escapeHtml(anchor.time)}</span>` : '' };
    if (clockMeta?.valid && clockMeta.month != null && clockMeta.day != null) {
        const weekday = clockMeta.weekdayText || fallbackWeekday;
        const timeHtml = clockMeta.time ? `<span class="sp-dash-sum-time">${escapeHtml(clockMeta.time)}</span>` : '';
        return { todayHtml: today(dateText(clockMeta), weekday, tip), timeHtml };
    }
    // 自定义历越界时回退已确认锚点：不抬 raw，也不按公历数字冒充今天。
    if (calendar && !isGregorian(calendar)) return fallback;
    if (stampDate?.month != null && stampDate?.day != null) {
        const timeHtml = stampDate.time ? `<span class="sp-dash-sum-time">${escapeHtml(stampDate.time)}</span>` : '';
        return { todayHtml: today(dateText(stampDate), '星期未记录', tip), timeHtml };
    }
    if (rawStamp) return { todayHtml: today(String(rawStamp), '', tip), timeHtml: '' };
    return fallback;
}
