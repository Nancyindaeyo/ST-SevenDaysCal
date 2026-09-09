import { TIME_TRAVEL_DIRECTION_OPTIONS, collectTravelAnniversaries, sameMonthDay } from '../../time-travel.js';

export function travelDirectionValue(result, options = TIME_TRAVEL_DIRECTION_OPTIONS) {
    if (!result) return '';
    if (result.value === 'custom') return String(result.customValue || '').trim();
    return options.find(option => option.value === result.value)?.prompt || '';
}

export function timeTravelAbortReason(reason) {
    if (reason === 'plugin-disabled') return 'plugin-disabled';
    if (reason === 'chat-boundary') return 'chat-boundary';
    return 'time-travel-cancel';
}

export function isTimeTravelSelectionCurrent(run, env = {}) {
    if (!run || env.active !== run) return false;
    if (!env.pluginEnabled || env.chatId !== run.chatId || env.travelState) return false;
    const validTarget = env.validTarget;
    return !!validTarget && sameMonthDay(validTarget, run.targetDate);
}

export function travelAnniversaryCoverage(item, targetDate, calendar, helpers = {}) {
    const targetDoy = helpers.dayOfYear?.(targetDate?.month, targetDate?.day, calendar);
    if (!Number.isFinite(targetDoy) || !helpers.itemCoversDoy?.(item, targetDoy, calendar)) return null;
    const total = helpers.yearLength?.(calendar);
    const startDoy = helpers.dayOfYear?.(item.month, item.day, calendar);
    const days = helpers.clampInt?.(item.days, 1, total, 1);
    const dayIndex = ((targetDoy - startDoy) % total + total) % total + 1;
    return {
        startDate: { month: item.month, day: item.day },
        endDate: helpers.endMonthDay?.(item, calendar),
        days,
        dayIndex,
    };
}

export function collectTimeTravelContext(sourceDate, targetDate, env = {}) {
    const calendar = env.calendar;
    const weekday = env.weekdayFor?.(targetDate.month, targetDate.day, env.weekdayRef?.(calendar), calendar);
    const targetWeekday = Number.isInteger(weekday) ? (env.weekdays?.[weekday] || '') : '';
    const outlineSnapshot = env.readOutlineSnapshot?.() || { beats: [], cursor: 0 };
    const lines = (env.readLines?.() || []).filter(line => !env.terminalStages?.has?.(line.stage));
    const injectionOn = !!env.injectionOn;
    const settings = env.settings || {};
    return {
        sourceDate,
        targetDate,
        calendar,
        anniversaries: collectTravelAnniversaries(
            env.almanacItems || [],
            targetDate,
            calendar,
            (item, date, cal) => env.coverage?.(item, date, cal),
            type => env.typeLabel?.(type),
        ),
        targetWeekday,
        outline: outlineSnapshot.beats,
        outlineCursor: outlineSnapshot.cursor,
        lines,
        injectionState: {
            linesInjected: injectionOn && settings.linesEnabled !== false && settings.linesInject === true && lines.length > 0,
            outlineInjected: injectionOn && settings.outlineInject === true && outlineSnapshot.beats.length > 0 && outlineSnapshot.cursor >= 1,
            ledgerInjected: injectionOn && settings.ledgerInject === true && (env.ledgerEchoLength || 0) > 0,
        },
    };
}

export function travelAlignReason(destinationDate, calendar, formatDate) {
    const when = typeof formatDate === 'function' ? String(formatDate(destinationDate, calendar) || '').trim() : '';
    return when
        ? `时光旅行已落到${when}。请按目标日和本楼正文对齐未锁的点和线，不要按出发日或楼数推进。`
        : '时光旅行已落到目标日。请按目标日和本楼正文对齐未锁的点和线，不要按出发日或楼数推进。';
}

export function appendTravelPromptContext(prompt, travelContext = null) {
    if (!travelContext) return prompt;
    if (travelContext.feedback === 'time-travel') {
        const target = travelContext.targetDate;
        const targetText = target && Number.isInteger(Number(target.month)) && Number.isInteger(Number(target.day))
            ? `目标日期：${target.month}月${target.day}日`
            : '';
        return [prompt, travelContext.promptAddon, targetText].filter(Boolean).join('\n\n');
    }
    if (travelContext.promptAddon) return [prompt, travelContext.promptAddon].filter(Boolean).join('\n\n');
    return prompt;
}

export async function runTimeTravelDirectionFlow(env = {}) {
    const run = env.run;
    let selectedValue = 'none';
    let customValue = '';
    let excluded = [];
    let exclusionPreference = null;
    while (env.isCurrent?.(run)) {
        const context = env.collectContext?.(run.sourceDate, run.targetDate);
        const selection = await env.selectDirection?.({
            title: env.jumpTitle?.(run.targetDate, context.calendar),
            initialValue: selectedValue,
            customValue,
        });
        if (!env.isCurrent?.(run) || !selection) return false;
        selectedValue = selection.value;
        customValue = selection.customValue;
        const preference = travelDirectionValue(selection);
        if (selection.action === 'direct') {
            const prompt = env.buildStoryPrompt?.({
                ...env.collectContext?.(run.sourceDate, run.targetDate),
                direction: preference,
            });
            if (!env.inject?.(prompt)) return false;
            if (!env.isCurrent?.(run)) return false;
            return env.begin?.({ chatId: run.chatId, sourceDate: run.sourceDate, selectedTargetDate: run.targetDate, direction: preference });
        }
        if (selection.action !== 'ai') continue;
        if (exclusionPreference !== preference) {
            excluded = [];
            exclusionPreference = preference;
        }
        const picked = await env.selectAiDirection?.({
            excluded,
            preference,
            run,
            onDirections: directions => { excluded.push(...directions); },
        });
        if (!env.isCurrent?.(run) || picked == null) return false;
        if (picked === env.backValue) continue;
        const prompt = env.buildStoryPrompt?.({
            ...env.collectContext?.(run.sourceDate, run.targetDate),
            direction: picked,
        });
        if (!env.inject?.(prompt)) return false;
        if (!env.isCurrent?.(run)) return false;
        return env.begin?.({ chatId: run.chatId, sourceDate: run.sourceDate, selectedTargetDate: run.targetDate, direction: picked });
    }
    return false;
}
