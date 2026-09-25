import test from 'node:test';
import assert from 'node:assert/strict';
import { _cnToNumber, extractDayFromTime } from '../../utils/cn-date.js';
import { applyStoryClockToMessage, bindStoryClock, buildStoryClockCalendarContext, completeStoryClock, createStoryClockController, parseStoryClock, previousCompleteStoryClock, storyClockDate, storyClockNarrativeBody, storyWeekdayRef, STORY_CLOCK_CALENDAR_KEY, STORY_CLOCK_KEY } from './story-clock.js';

function monthDayFromKey(key) {
    const m = String(key || '').match(/^(\d+)-(\d+)-(\d+)$/);
    return m ? { year: +m[1], month: +m[2], day: +m[3] } : null;
}

function explicitWeekdayDate(text) {
    const m = /(?:(\d{4})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})\s*日?)\s*[\s·.,，、｜|/／~〜—\-]{0,3}(?:(?:星期|週|周|礼拜|禮拜)\s*([一二三四五六日天]))/i.exec(String(text || ''));
    if (!m) return null;
    return { year: +m[1], month: +m[2], day: +m[3], wd: { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }[m[4]] };
}

function dayOfYear(month, day) {
    const dim = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let n = day;
    for (let i = 0; i < month - 1; i++) n += dim[i];
    return n;
}

bindStoryClock({
    loadCalendar: () => ({ kind: 'gregorian' }),
    validMonthDay: ({ month, day }) => ({ month, day }),
    defaultCalendar: { kind: 'gregorian' },
    cnToNumber: _cnToNumber,
    extractDay: extractDayFromTime,
    monthDayFromKey,
    explicitWeekdayDate,
    dayOfYear,
});

test('applyStoryClockToMessage wraps body and parses a complete stamp', () => {
    const applied = applyStoryClockToMessage('晚饭后闲聊。', {
        date: '10月4日',
        weekday: '周二',
        startTime: '15:30',
        endTime: '16:00',
    });
    assert.equal(applied.ok, true);
    assert.equal(storyClockNarrativeBody(applied.text), '晚饭后闲聊。');
    assert.equal(completeStoryClock(applied.clock), true);
    assert.equal(applied.clock.endMeta.month, 10);
    assert.equal(applied.clock.endMeta.day, 4);
    assert.equal(applied.clock.startMeta.time, '15:30');
    assert.equal(applied.clock.endMeta.time, '16:00');
    const date = storyClockDate({ chat: [{ is_user: false, mes: applied.text }] }, () => null);
    assert.equal(date.month, 10);
    assert.equal(date.day, 4);
    assert.equal(date.time, '16:00');
});

test('applyStoryClockToMessage rejects incomplete weekday or time', () => {
    const applied = applyStoryClockToMessage('正文', { date: '10月4日', weekday: '节日', startTime: '15:30', endTime: '16:00' });
    assert.equal(applied.ok, false);
});

test('previousCompleteStoryClock walks back past user floors', () => {
    const prev = applyStoryClockToMessage('上楼', { date: '10月3日', weekday: '周一', startTime: '20:00', endTime: '21:00' }).text;
    const clock = previousCompleteStoryClock([
        { is_user: false, mes: prev },
        { is_user: true, mes: '玩家' },
        { is_user: false, mes: '这楼漏戳了' },
    ], 2);
    assert.equal(clock.endMeta.day, 3);
    assert.equal(parseStoryClock('这楼漏戳了').end, null);
});

test('storyWeekdayRef computes Saturday from opening YMD without a stamp', () => {
    const ref = storyWeekdayRef({
        chat: [{ is_user: false, mes: '2024年8月31日。今天是星期日。新学期开始。' }],
    });
    assert.equal(ref.refWd, 6);
    assert.equal(ref.weekdayText, '周六');
    assert.equal(ref.refDoy, dayOfYear(8, 31));
});

test('storyWeekdayRef keeps an adjacent weekday over the real calendar', () => {
    const ref = storyWeekdayRef({
        chat: [{ is_user: false, mes: '2024年8月31日星期日，开学。' }],
    });
    assert.equal(ref.refWd, 0);
    assert.equal(ref.weekdayText, '周日');
});

test('storyWeekdayRef reads YMD from a user opening when there is no AI floor', () => {
    const ref = storyWeekdayRef({
        chat: [{ is_user: true, mes: '时间：2024年8月31日。请开始。' }],
    });
    assert.equal(ref.refWd, 6);
});

test('storyWeekdayRef can use 柏宝书 time when chat has no date', () => {
    bindStoryClock({ storyTimeText: () => '2024/8/31 08:20' });
    const ref = storyWeekdayRef({ chat: [{ is_user: false, mes: '开学了，但没写日期。' }] });
    bindStoryClock({ storyTimeText: null });
    assert.equal(ref.refWd, 6);
});

test('custom calendar context lists month names and does not rewrite a custom stamp prompt', () => {
    const custom = {
        kind: 'custom',
        era: '霜月纪',
        months: [{ name: '霜月', days: 40 }, { name: '雪月', days: 28 }],
    };
    const gregorian = { kind: 'gregorian', id: 'default-gregorian', months: [{ name: '1月', days: 31 }] };
    const context = buildStoryClockCalendarContext(custom, { isGregorian: cal => cal.kind === 'gregorian' });
    assert.match(context, /霜月（40天）/);
    assert.match(context, /雪月（28天）/);
    assert.match(context, /不得改写那份提示词/);
    assert.equal(buildStoryClockCalendarContext(gregorian, { isGregorian: cal => cal.kind === 'gregorian' }), '');
    const prompts = {};
    const controller = createStoryClockController({
        context: () => ({
            setExtensionPrompt(key, text) { prompts[key] = text; },
            constants: { promptTypes: { IN_CHAT: 1 }, promptRoles: { SYSTEM: 0 } },
        }),
        pluginEnabled: () => true,
        enabled: () => true,
        settings: () => ({ storyClockPrompt: '用户自定义戳词，保留原文。' }),
        calendarContext: () => context,
    });
    const state = controller.refresh();
    assert.equal(state.status, 'custom');
    assert.equal(prompts[STORY_CLOCK_KEY], '用户自定义戳词，保留原文。');
    assert.match(prompts[STORY_CLOCK_CALENDAR_KEY], /霜月（40天）/);
    controller.clear();
    assert.equal(prompts[STORY_CLOCK_KEY], '');
    assert.equal(prompts[STORY_CLOCK_CALENDAR_KEY], '');
});

test('disabling story clock clears both stamp and calendar prompts', () => {
    const prompts = { [STORY_CLOCK_KEY]: 'keep', [STORY_CLOCK_CALENDAR_KEY]: 'keep' };
    const controller = createStoryClockController({
        context: () => ({ setExtensionPrompt(key, text) { prompts[key] = text; } }),
        pluginEnabled: () => true,
        enabled: () => false,
        settings: () => ({}),
        calendarContext: () => '不应注入',
    });
    assert.equal(controller.refresh().status, 'cleared');
    assert.equal(prompts[STORY_CLOCK_KEY], '');
    assert.equal(prompts[STORY_CLOCK_CALENDAR_KEY], '');
});
