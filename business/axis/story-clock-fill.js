import { applyStoryClockToMessage, parseStoryClock, previousCompleteStoryClock } from './story-clock.js';

export function draftStoryClockFillFields({
    current,
    previous,
    today,
    calendar,
    formatDate,
    monthName,
    weekdayFor,
    weekdayRef,
} = {}) {
    const meta = current?.endMeta?.valid ? current.endMeta
        : (current?.startMeta?.valid ? current.startMeta : (previous?.endMeta || previous?.startMeta || {}));
    const date = (meta.date ? formatDate?.(meta.date, calendar, monthName) : '')
        || (today ? formatDate?.(today, calendar, monthName) : '')
        || '';
    const weekday = String(meta.weekdayText || (today ? weekdayFor?.(today.month, today.day, weekdayRef?.()) : '') || '周一');
    const startTime = String(current?.startMeta?.time || previous?.endMeta?.time || '12:00');
    const endTime = String(current?.endMeta?.time || startTime);
    return { date, weekday, startTime, endTime };
}

// 补这楼时间戳：只写隐藏注释。写回走 saveChat / MESSAGE_EDITED 端口，不直接碰酒馆内部。
export function createStoryClockFillHost(env = {}) {
    const parseClock = env.parseClock || parseStoryClock;
    const previousClock = env.previousComplete || previousCompleteStoryClock;
    const apply = env.applyToMessage || applyStoryClockToMessage;

    async function fill() {
        const chat = env.getContext?.()?.chat || [];
        const latest = env.latestAiFloor?.(chat);
        if (!latest) {
            env.toast?.('没有可补的 AI 楼', null, true);
            return { status: 'failed' };
        }
        const current = parseClock(latest.text);
        const previous = previousClock(chat, latest.index);
        let today = null;
        try { today = env.todayAnchor?.(); } catch { today = null; }
        const drafted = draftStoryClockFillFields({
            current,
            previous,
            today,
            calendar: env.calendar?.(),
            formatDate: env.formatDate,
            monthName: env.monthName,
            weekdayFor: env.weekdayFor,
            weekdayRef: env.weekdayRef,
        });
        const fields = await env.promptFields?.({
            title: '补这楼时间戳',
            body: '只写进本楼隐藏注释，不改正文。日期写法跟故事里一致即可。',
            confirmText: '写入',
            fields: [
                { name: 'date', label: '日期', type: 'input', value: drafted.date, placeholder: '如 10月4日', maxLength: 40 },
                { name: 'weekday', label: '星期', type: 'input', value: drafted.weekday, placeholder: '周一至周日', maxLength: 8 },
                { name: 'startTime', label: '开始时刻', type: 'input', value: drafted.startTime, placeholder: '15:30', maxLength: 12 },
                { name: 'endTime', label: '结束时刻', type: 'input', value: drafted.endTime, placeholder: '16:00', maxLength: 12 },
            ],
            validate: result => apply('正文', result).ok ? '' : '日期、星期（周一至周日）和时刻都要能解析',
        });
        if (!fields) return { status: 'cancelled' };
        const applied = apply(chat[latest.index].mes || '', {
            date: fields.date,
            weekday: fields.weekday,
            startTime: fields.startTime,
            endTime: fields.endTime,
        });
        if (!applied.ok) {
            env.toast?.('时间戳写不进去，请检查日期和时刻', null, true);
            return { status: 'failed' };
        }
        chat[latest.index].mes = applied.text;
        env.saveChat?.();
        env.emitEdited?.(latest.index);
        env.holdConfirmedFloor?.({ chatId: env.getContext?.()?.chatId, messageId: latest.index });
        env.aftermath?.('story');
        env.toast?.('已补上这楼时间戳');
        env.paintActivity?.();
        return { status: 'updated' };
    }

    return { fill };
}
