import test from 'node:test';
import assert from 'node:assert/strict';
import {
    appendTravelPromptContext,
    collectTimeTravelContext,
    isTimeTravelSelectionCurrent,
    runTimeTravelDirectionFlow,
    timeTravelAbortReason,
    travelAnniversaryCoverage,
    travelDirectionValue,
} from './time-travel-session.js';

test('travel direction value keeps custom text and known prompts', () => {
    assert.equal(travelDirectionValue({ value: 'sweet' }), '甜向');
    assert.equal(travelDirectionValue({ value: 'custom', customValue: ' 雨停 ' }), '雨停');
    assert.equal(travelDirectionValue({ value: 'none' }), '');
});

test('time-travel selection dies when chat, plugin, or travel state moves', () => {
    const run = { chatId: 'a', targetDate: { month: 1, day: 2 } };
    assert.equal(isTimeTravelSelectionCurrent(run, {
        active: run,
        pluginEnabled: true,
        chatId: 'a',
        travelState: null,
        validTarget: { month: 1, day: 2 },
    }), true);
    assert.equal(isTimeTravelSelectionCurrent(run, {
        active: run,
        pluginEnabled: true,
        chatId: 'b',
        travelState: null,
        validTarget: { month: 1, day: 2 },
    }), false);
    assert.equal(timeTravelAbortReason('plugin-disabled'), 'plugin-disabled');
    assert.equal(timeTravelAbortReason('replaced'), 'time-travel-cancel');
});

test('travel prompt addon only stamps a date during time-travel feedback', () => {
    assert.equal(appendTravelPromptContext('基线'), '基线');
    assert.equal(appendTravelPromptContext('基线', { promptAddon: '加' }), '基线\n\n加');
    assert.match(appendTravelPromptContext('基线', {
        feedback: 'time-travel',
        promptAddon: '加',
        targetDate: { month: 3, day: 4 },
    }), /目标日期：3月4日/);
});

test('direct travel adopts the chosen direction without AI', async () => {
    const calls = [];
    const run = { chatId: 'c', sourceDate: { month: 1, day: 1 }, targetDate: { month: 2, day: 2 } };
    const ok = await runTimeTravelDirectionFlow({
        run,
        isCurrent: () => true,
        collectContext: () => ({ sourceDate: run.sourceDate, targetDate: run.targetDate }),
        selectDirection: async () => ({ value: 'daily', action: 'direct' }),
        buildStoryPrompt: ctx => { calls.push(['prompt', ctx.direction]); return 'P'; },
        inject: prompt => { calls.push(['inject', prompt]); return true; },
        begin: payload => { calls.push(['begin', payload.direction]); return true; },
    });
    assert.equal(ok, true);
    assert.deepEqual(calls, [['prompt', '日常'], ['inject', 'P'], ['begin', '日常']]);
});

test('anniversary coverage uses calendar helpers and injection flags', () => {
    const coverage = travelAnniversaryCoverage(
        { month: 1, day: 1, days: 3 },
        { month: 1, day: 2 },
        { months: [{ days: 30 }] },
        {
            dayOfYear: (m, d) => d,
            itemCoversDoy: () => true,
            yearLength: () => 30,
            clampInt: (v, min, max, fallback) => Number(v) || fallback,
            endMonthDay: () => ({ month: 1, day: 3 }),
        },
    );
    assert.equal(coverage.dayIndex, 2);
    const ctx = collectTimeTravelContext({ month: 1, day: 1 }, { month: 1, day: 2 }, {
        calendar: {},
        weekdayFor: () => 1,
        weekdayRef: () => 0,
        weekdays: ['日', '一'],
        readOutlineSnapshot: () => ({ beats: [{ title: '节' }], cursor: 1 }),
        readLines: () => [{ stage: '延展' }, { stage: '收束' }],
        terminalStages: new Set(['收束']),
        injectionOn: true,
        settings: { linesEnabled: true, linesInject: true, outlineInject: true, ledgerInject: true },
        ledgerEchoLength: 2,
        almanacItems: [],
        coverage: () => null,
        typeLabel: () => '',
    });
    assert.equal(ctx.targetWeekday, '一');
    assert.equal(ctx.lines.length, 1);
    assert.equal(ctx.injectionState.outlineInjected, true);
    assert.equal(ctx.injectionState.ledgerInjected, true);
});
