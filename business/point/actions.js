import { composeEventWhen, dayKeyForMonthDay, eventTabDate, splitEventWhen } from './event-when.js';
import { alignPointStartDate } from './date-align.js';
import { daysInMonth } from '../calendar/date.js';
import { shiftPointCalendar } from './shift.js';

// 点行内操作：只编排宿主注入的存储、确认、重绘与提示，不改变 raw/schema。
export function createPointActions(env) {
    let editing = false;
    let editToken = null;
    const eventIdentity = event => JSON.stringify(['type', 'title', 'desc', 'time', 'location', 'npcAction', 'pin', 'adult'].map(key => event?.[key] ?? null));
    const participantCurrent = participant => !participant || env.sameParticipantIdentity?.(participant, env.captureParticipantIdentity?.()) !== false;
    const saveConfirmed = async (key, value, ownerGuard) => {
        try {
            if (typeof env.writeStoreConfirmed === 'function') {
                const saved = await env.writeStoreConfirmed(key, value, { ownerGuard });
                return saved === true || (saved?.ok === true && saved?.commitState === 'confirmed' && saved?.stale !== true);
            }
            return env.writeStore?.(key, value) === true;
        } catch (error) {
            env.logError?.('[SP point save failed]', error);
            return false;
        }
    };
    const saveFailed = () => {
        env.showToast('保存失败，数据未修改；请检查存储状态后重试', null, true);
        return false;
    };
    const restoreActiveDay = dayKey => {
        const tabs = env.inShadow?.('#sp-body .sp-tab'); if (!tabs?.length) return;
        const tabKey = String(dayKey).startsWith('past:') ? 'past' : String(dayKey);
        let found = false;
        tabs.each((_, el) => { const tab = env.$(el); const match = String(tab.attr('data-day')) === tabKey; tab.toggleClass('sp-tab-active', match); if (match) { tab.trigger('click'); found = true; } });
        if (!found) tabs.eq(0).trigger('click');
    };
    const eventsAt = (parsed, dayKey) => {
        if (dayKey === 'future') return parsed.future?.events;
        const past = /^past:(\d+)$/.exec(String(dayKey));
        return past ? parsed.pastDays?.[Number(past[1])]?.events : parsed.days?.[Number(dayKey)]?.events;
    };
    const rerender = (raw, saved, view) => { const html = env.renderSchedule(raw, saved.userName || '用户', view, env.loadCalendar()); env.setCached(html); env.setBody(html); return html; };
    async function togglePin(dayKey, eventIndex) {
        const chatId = env.chatId?.(); const participant = env.captureParticipantIdentity?.() || null;
        const key = env.getCacheKey(env.currentView(), env.currentChar()); const saved = env.readStore(key); const raw = saved?.raw || '';
        if (!raw) { env.showToast('待办已失效，请刷新面板', null, true); return; }
        const result = env.togglePointPinRaw(raw, dayKey, eventIndex, env.loadCalendar());
        if (!result.ok) { env.showToast('这个点已不存在，请刷新面板', null, true); return; }
        const ownerGuard = () => (!env.chatId || env.chatId() === chatId) && participantCurrent(participant);
        if (!await saveConfirmed(key, { raw: result.raw, userName: saved.userName || '用户', ts: Date.now() }, ownerGuard)) return saveFailed();
        rerender(result.raw, saved, env.currentView()); restoreActiveDay(dayKey); env.syncLatestScheduleBlock();
        env.showToast(result.pinned ? '已锁定这个点' : '已解锁这个点');
        return true;
    }
    async function alignStartDate() {
        if (editing || env.editing?.() || env.isBusy?.()) return env.showToast('点正在生成或编辑中，稍候再对齐日期', null, true);
        const chatId = env.chatId?.(); const participant = env.captureParticipantIdentity?.() || null;
        const view = env.currentView();
        const charName = view === 'char' ? String(env.currentChar() || '').trim() : '';
        const key = env.getCacheKey(view, charName);
        const saved = env.readStore(key);
        const raw = saved?.raw || '';
        if (!raw) return env.showToast('还没有点，无法对齐日期', null, true);
        const today = env.today?.();
        const calendar = env.loadCalendar();
        const result = (env.alignStartDate || alignPointStartDate)(raw, today, calendar);
        if (!result.changed) return env.showToast('点上的日期已经是剧情今天');
        const ownerGuard = () => (!env.chatId || env.chatId() === chatId) && participantCurrent(participant);
        if (!await saveConfirmed(key, { ...saved, raw: result.raw, ts: Date.now() }, ownerGuard)) return saveFailed();
        rerender(result.raw, saved, view);
        env.syncLatestScheduleBlock();
        env.onActivity?.({
            source: 'date-align',
            snapshot: { point: raw },
            after: { point: result.raw },
            items: [{ module: 'point', title: `${result.fromLabel} → ${result.toLabel}`, action: 'edit' }],
            note: `点日期整体平移到 ${result.toLabel}，事项保持原槽位`,
        });
        env.showToast(`点的全部日期已整体平移到 ${result.toLabel}`);
        return { status: 'updated', ...result };
    }
    async function rollToToday() {
        if (editing || env.editing?.() || env.isBusy?.()) return env.showToast('点正在生成或编辑中，稍候再滚动', null, true);
        const chatId = env.chatId?.(); const participant = env.captureParticipantIdentity?.() || null;
        const view = env.currentView(); const charName = view === 'char' ? String(env.currentChar() || '').trim() : '';
        const key = env.getCacheKey(view, charName); const saved = env.readStore(key); const raw = saved?.raw || '';
        if (!raw) return env.showToast('还没有点，无法滚动至今日', null, true);
        const result = (env.rollToToday || shiftPointCalendar)(raw, env.today?.(), env.loadCalendar());
        if (!result.changed) return env.showToast('点窗口已经从剧情今天开始');
        const ownerGuard = () => (!env.chatId || env.chatId() === chatId) && participantCurrent(participant);
        if (!await saveConfirmed(key, { ...saved, raw: result.raw, ts: Date.now() }, ownerGuard)) return saveFailed();
        rerender(result.raw, saved, view); env.syncLatestScheduleBlock();
        const fill = await env.fillAfterRoll?.();
        const finalRaw = env.readStore(key)?.raw || result.raw;
        env.onActivity?.({
            source: 'shift',
            snapshot: { point: raw },
            after: { point: finalRaw },
            items: (result.archived || []).map(event => ({ module: 'point', title: event.title, action: 'archive', ref: event.id })),
            note: `窗口滚动 ${result.delta} 天，过期事项已保留在「过去」`,
        });
        if (fill?.status === 'failed') {
            env.showToast('已滚动至剧情今天，但补齐后续日期失败；可稍后刷新点', null, true);
            return { status: 'updated', ...result, fill };
        }
        env.showToast(`已滚动至剧情今天，保留 ${result.archived?.length || 0} 条过去事项`);
        return { status: 'updated', ...result, fill };
    }
    function parseWhenFields(fields, calendar) {
        const yearText = String(fields?.year || '').trim();
        const monthText = String(fields?.month || '').trim();
        const dayText = String(fields?.day || '').trim();
        if (!monthText && !dayText && !yearText) return { ok: true, year: '', month: '', day: '' };
        const month = Number(monthText);
        const day = Number(dayText);
        if (!Number.isInteger(month) || !Number.isInteger(day)) return { ok: false, reason: '请填写完整的月和日，或都留空' };
        const year = yearText ? Number(yearText) : null;
        if (yearText && (!Number.isInteger(year) || year < 1)) return { ok: false, reason: '年要填正整数，或留空' };
        const max = daysInMonth(calendar, month, year);
        if (!max || day < 1 || day > max) return { ok: false, reason: `${month} 月没有 ${day} 日` };
        return { ok: true, year: yearText, month, day };
    }
    async function editDescription(dayKey, eventIndex, target = {}) {
        if (editing || env.editing?.() || env.isBusy?.()) return false;
        const chatId = env.chatId?.(); const participant = env.captureParticipantIdentity?.() || null;
        const view = target.view === 'char' ? 'char' : 'user'; const charName = view === 'char' ? String(target.charName || '').trim() : '';
        const key = env.getCacheKey(view, charName); const saved = env.readStore(key); const raw = saved?.raw || ''; const calendar = env.loadCalendar(); const parsed = env.parseCalendar(raw, calendar);
        const events = eventsAt(parsed, dayKey); const event = events?.[Number(eventIndex)];
        if (!event) return env.showToast('这个点已不存在，请刷新面板', null, true);
        const stamp = splitEventWhen(event.time || '');
        const tabDate = eventTabDate(parsed, dayKey, calendar);
        const token = Symbol('point-edit'); editToken = token; editing = true; env.setEditing?.(true); let value;
        try {
            value = env.promptFields ? await env.promptFields({
                title: `编辑「${event.title || '未命名'}」`,
                fields: [
                    { name: 'year', label: '年（可空）', type: 'input', value: stamp.year, placeholder: '如 2026', maxLength: 4 },
                    { name: 'month', label: '月', type: 'input', value: stamp.month || (tabDate?.month != null ? String(tabDate.month) : ''), placeholder: '5', maxLength: 2 },
                    { name: 'day', label: '日', type: 'input', value: stamp.day || (tabDate?.day != null ? String(tabDate.day) : ''), placeholder: '1', maxLength: 2 },
                    { name: 'time', label: '时间', type: 'input', value: stamp.clock || event.time || '', placeholder: '如 13:00-13:30 或 上午', maxLength: 40 },
                    { name: 'desc', label: '描述', value: event.desc || '', rows: 3 },
                    { name: 'npcAction', label: '线头动态', value: event.npcAction || '', rows: 2 },
                ],
                validate: fields => {
                    if (Object.values(fields).some(text => String(text).includes('|'))) return '点字段不能包含半角竖线「|」';
                    const when = parseWhenFields(fields, calendar);
                    return when.ok ? '' : when.reason;
                },
            }) : await env.promptTextarea?.({ title: `编辑「${event.title || '未命名'}」`, initialValue: event.desc || '' });
        }
        finally { if (editToken === token) { editToken = null; editing = false; env.setEditing?.(false); } }
        if (value === null || value === undefined) return;
        const latest = env.readStore(key); if (latest?.raw !== raw || latest?.ts !== saved?.ts) return env.showToast('点已变化，请重新打开编辑', null, true);
        const when = typeof value === 'object' ? parseWhenFields(value, calendar) : { ok: true };
        if (!when.ok) return env.showToast(when.reason, null, true);
        const nextKey = typeof value === 'object' && when.month ? dayKeyForMonthDay(parsed, when.month, when.day, calendar) : dayKey;
        const time = typeof value === 'object'
            ? composeEventWhen({ year: when.year, month: when.month, day: when.day, clock: value.time }, { withDate: nextKey === 'future' })
            : undefined;
        const result = env.editPointFields(raw, dayKey, Number(eventIndex), typeof value === 'object' ? { desc: value.desc, npcAction: value.npcAction, time } : { desc: value });
        if (!result.ok) return env.showToast(result.reason === 'pipe' ? '点字段不能包含半角竖线「|」' : '编辑失败，请刷新后重试', null, true);
        let nextRaw = result.raw;
        let savedDay = dayKey;
        if (nextKey != null && String(nextKey) !== String(dayKey) && env.movePointEvent) {
            const moved = env.movePointEvent(nextRaw, dayKey, Number(eventIndex), nextKey, calendar);
            if (!moved.ok) return env.showToast('挪到那一天失败，请刷新后重试', null, true);
            nextRaw = moved.raw;
            savedDay = moved.dayKey;
        }
        const ownerGuard = () => (!env.chatId || env.chatId() === chatId) && participantCurrent(participant);
        if (!await saveConfirmed(key, { ...saved, raw: nextRaw, ts: Date.now() }, ownerGuard)) return saveFailed();
        rerender(nextRaw, saved, view);
        restoreActiveDay(savedDay);
        env.syncLatestScheduleBlock();
        env.showToast('已保存这个点');
    }
    async function deleteEvent(dayKey, eventIndex, target = {}) {
        const chatId = env.chatId?.(); const participant = env.captureParticipantIdentity?.() || null;
        const view = target.view === 'char' ? 'char' : 'user'; const charName = view === 'char' ? String(target.charName || '').trim() : '';
        const key = env.getCacheKey(view, charName); const saved = env.readStore(key); const raw = saved?.raw || '';
        if (!raw) { env.showToast('待办已失效，请刷新面板', null, true); return; }
        const calendar = env.loadCalendar(); const parsed = env.parseCalendar(raw, calendar); const sourceDay = dayKey === 'future' || String(dayKey).startsWith('past:') ? null : parsed.days?.[Number(dayKey)]; const events = eventsAt(parsed, dayKey); const event = events?.[eventIndex];
        if (!event) { env.showToast('这个点已不存在，请刷新面板', null, true); return; }
        const targetIdentity = eventIdentity(event); const sourceDayNumber = sourceDay?.dayNumber;
        if (!await env.confirm({ title: '删除这个点', body: `将删除「${event.title || '未命名'}」这一条，其它安排保留。此操作不可撤销。`, confirmText: '删除', cancelText: '取消' })) return;
        if ((env.chatId && env.chatId() !== chatId) || !participantCurrent(participant)) return false;
        const latest = env.readStore(key); const latestRaw = latest?.raw || ''; if (!latestRaw) return false;
        const latestCalendar = env.loadCalendar(); const latestParsed = env.parseCalendar(latestRaw, latestCalendar);
        const latestDayIndex = dayKey === 'future' || String(dayKey).startsWith('past:')
            ? dayKey
            : latestParsed.days?.findIndex(day => day.dayNumber === sourceDayNumber);
        const latestEvents = eventsAt(latestParsed, latestDayIndex);
        let latestEventIndex = Number(eventIndex);
        if (latestRaw !== raw) {
            const matches = (latestEvents || []).map((candidate, index) => eventIdentity(candidate) === targetIdentity ? index : -1).filter(index => index >= 0);
            if (matches.length !== 1) return false;
            latestEventIndex = matches[0];
        }
        if (!latestEvents?.[latestEventIndex] || eventIdentity(latestEvents[latestEventIndex]) !== targetIdentity) return false;
        if ((env.chatId && env.chatId() !== chatId) || !participantCurrent(participant)) return false;
        const result = env.deletePointEventRaw(latestRaw, latestDayIndex, latestEventIndex, latestCalendar); if (!result.ok) return false;
        const ownerGuard = () => (!env.chatId || env.chatId() === chatId) && participantCurrent(participant);
        if (!await saveConfirmed(key, { ...latest, raw: result.raw, userName: latest.userName || saved.userName || '用户', ts: Date.now() }, ownerGuard)) return saveFailed();
        if (env.currentView() === view && (view !== 'char' || env.currentChar() === charName)) { rerender(result.raw, latest, view); restoreActiveDay(latestDayIndex); }
        env.syncLatestScheduleBlock(); env.showToast('已删除这个点');
        return true;
    }
    return { togglePin, deleteEvent, editDescription, alignStartDate, rollToToday, isEditing: () => editing };
}
