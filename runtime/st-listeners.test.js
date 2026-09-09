import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isLatestChatFloor,
    stripChatFileExt,
    bindNamedListeners,
    createChatFloorHandlers,
} from './st-listeners.js';

const MODULES = Object.freeze({
    LINES: 'lines',
    OUTLINE: 'outline',
    POINT: 'point',
    LEDGER_CAPTURE: 'ledger-capture',
    LEDGER_JUDGE: 'ledger-judge',
});

function track(calls, name) {
    return new Proxy({}, {
        get(_, prop) {
            if (prop === 'then') return undefined;
            return (...args) => {
                calls.push(`${name}.${String(prop)}`);
                return args;
            };
        },
    });
}

function floorHost(over = {}) {
    const calls = [];
    const consumed = [];
    const claimed = [];
    const tokens = new Map();
    const settings = { linesEnabled: true, almanacAutoDetect: true, ledgerCaptureEnabled: true, ledgerInject: true };
    const h = {
        calls,
        consumed,
        claimed,
        tokens,
        settings,
        pluginEnabled: () => true,
        getContext: () => ({ chatId: 'c1', chat: [{}, {}, {}], chatMetadata: { chat_id_hash: 'h1' } }),
        getSettings: () => settings,
        automationModules: MODULES,
        automationGate: { claim(spec) { claimed.push(spec); return { id: 'tok' }; } },
        timeTravelClaimTokens: tokens,
        timeTravel: {
            isInitialFloor: () => false,
            getState: () => ({ sessionId: 's1' }),
            handleRendered: async () => calls.push('travel.handle'),
        },
        lines: track(calls, 'lines'),
        get coordinate() { return track(calls, 'coordinate'); },
        scheduleForChatBoundary: (fn) => { calls.push('scheduleScan'); fn?.(); },
        syncLatestAlmanacBlock: () => calls.push('syncAlmanac'),
        syncLatestScheduleBlock: () => calls.push('syncSchedule'),
        refresh: { onAiFloor: async () => calls.push('refresh.onAiFloor') },
        beat: { onAiFloor: () => calls.push('beat.onAiFloor'), syncFloor: () => calls.push('beat.sync') },
        activity: { markFloorRestyle: () => calls.push('activity.restyle') },
        floorSig: () => 'sig',
        rememberPace: () => calls.push('remember'),
        isAutomationSuppressed: () => false,
        relandStoryClockAnchor: () => ({ status: 'no-date' }),
        buildDateRenderKey: () => ({ chatId: 'c1' }),
        consumeDateBootstrap: () => false,
        dateCoordinator: {
            recordResult: (...a) => calls.push(['date.record', a[1]?.source]),
            runOnce: () => calls.push('date.runOnce'),
        },
        pace: { consumeFloor: (...a) => { consumed.push(a); return true; } },
        getAlmanacJudgeInterval: () => 3,
        getLedgerCaptureInterval: () => 4,
        getLedgerJudgeInterval: () => 5,
        runJudgeDateStep: () => calls.push('judgeDate'),
        runLedgerCaptureStep: () => calls.push('ledgerCapture'),
        runLedgerJudgeStep: () => calls.push('ledgerJudge'),
        refreshLedgerInjection: () => calls.push('injLedger'),
        refreshInlineWindow: () => calls.push('injInline'),
        refreshStoryClockInjection: () => calls.push('injClock'),
        refreshDiagnosticRetention: () => calls.push('diag'),
        pruneExternalSnapshots: () => calls.push('prune'),
        isExternalMode: () => false,
        outline: { onCharacterMessage: () => calls.push('outline.judge') },
        ...over,
    };
    return h;
}

test('latest floor is the last index only', () => {
    assert.equal(isLatestChatFloor([{ }, { }], 1), true);
    assert.equal(isLatestChatFloor([{ }, { }], 0), false);
    assert.equal(isLatestChatFloor(null, 0), false);
});

test('chat rename strips the jsonl suffix ST emits', () => {
    assert.equal(stripChatFileExt('foo.jsonl'), 'foo');
    assert.equal(stripChatFileExt('foo.JSONL'), 'foo');
    assert.equal(stripChatFileExt('foo'), 'foo');
});

test('replace listener unregisters the previous handler first', () => {
    const removed = [];
    const added = [];
    const store = { char: () => {} };
    const source = {
        removeListener(type, fn) { removed.push([type, fn]); },
        on(type, fn) { added.push([type, fn]); },
    };
    const next = () => {};
    bindNamedListeners(source, store, [{ key: 'char', type: 'CMR', handler: next }]);
    assert.equal(removed.length, 1);
    assert.equal(added[0][1], next);
    assert.equal(store.char, next);
});

test('plugin off skips char path entirely', async () => {
    const h = floorHost({ pluginEnabled: () => false });
    await createChatFloorHandlers(h).char(2, 'new');
    assert.deepEqual(h.calls, []);
});

test('char with lines off still remembers pace after refresh', async () => {
    const h = floorHost();
    h.settings.linesEnabled = false;
    await createChatFloorHandlers(h).char(2, 'new');
    assert.ok(h.calls.includes('refresh.onAiFloor'));
    assert.ok(h.calls.includes('remember'));
    assert.ok(!h.calls.includes('lines.onCharacterRendered'));
});

test('time travel preflight claims only on the initial floor', () => {
    const h = floorHost();
    const handlers = createChatFloorHandlers(h);
    handlers.timeTravelPreflight(2);
    assert.equal(h.claimed.length, 0);
    h.timeTravel.isInitialFloor = () => true;
    handlers.timeTravelPreflight(2);
    assert.equal(h.claimed.length, 1);
    assert.ok(!h.claimed[0].modules.includes(MODULES.LINES));
    assert.equal(h.tokens.get('s1').id, 'tok');
});

test('almanac does not consumeFloor on a non-latest floor', async () => {
    const h = floorHost();
    await createChatFloorHandlers(h).almanacJudge(1);
    assert.equal(h.consumed.length, 0);
    assert.ok(!h.calls.includes('date.runOnce'));
});

test('almanac stamp hit records without consuming the interval gate', async () => {
    const h = floorHost({
        relandStoryClockAnchor: () => ({ status: 'ok' }),
    });
    await createChatFloorHandlers(h).almanacJudge(2);
    assert.equal(h.consumed.length, 0);
    assert.deepEqual(h.calls.filter(c => Array.isArray(c))[0], ['date.record', 'story-clock']);
});

test('almanac API fallback consumes the latest floor then remembers', async () => {
    const h = floorHost();
    await createChatFloorHandlers(h).almanacJudge(2);
    assert.equal(h.consumed[0][0], 'date');
    assert.ok(h.calls.includes('date.runOnce'));
    assert.ok(h.calls.includes('remember'));
});

test('ledger capture stays off unless enabled and latest', async () => {
    const h = floorHost();
    h.settings.ledgerCaptureEnabled = false;
    await createChatFloorHandlers(h).ledgerCapture(2);
    assert.equal(h.consumed.length, 0);
    h.settings.ledgerCaptureEnabled = true;
    await createChatFloorHandlers(h).ledgerCapture(1);
    assert.equal(h.consumed.length, 0);
    await createChatFloorHandlers(h).ledgerCapture(2);
    assert.equal(h.consumed[0][0], 'ledgerCapture');
    assert.ok(h.calls.includes('ledgerCapture'));
});

test('rename maps ST filenames onto chat ids', async () => {
    const renamed = [];
    const h = floorHost({
        get coordinate() {
            return {
                onChatRenamed: spec => renamed.push(['renamed', spec]),
                renameChatId: async (...a) => { renamed.push(['move', a]); return 1; },
                open: view => renamed.push(['open', view]),
            };
        },
    });
    await createChatFloorHandlers(h).rename({ oldFileName: 'old.jsonl', newFileName: 'new.jsonl' });
    assert.deepEqual(renamed[0], ['renamed', { oldId: 'old', newId: 'new' }]);
    assert.deepEqual(renamed[1], ['move', ['old', 'new', 'new', 'h1']]);
    assert.deepEqual(renamed[2], ['open', 'chars']);
});
