import test from 'node:test';
import assert from 'node:assert/strict';
import { runChatChanged } from './chat-changed.js';

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

function host(overrides = {}) {
    const calls = [];
    let chatId = 'now';
    const h = {
        calls,
        activeChatId: () => 'old',
        chatLength: () => 4,
        chatId: () => chatId,
        chatMetadata: () => ({ id: chatId }),
        pluginEnabled: () => true,
        beginBoundary: () => calls.push('begin'),
        pointTasks: track(calls, 'pointTasks'),
        pointController: track(calls, 'pointController'),
        lines: track(calls, 'lines'),
        memory: track(calls, 'memory'),
        customDialog: track(calls, 'dialog'),
        timeTravel: track(calls, 'travel'),
        dateCoordinator: track(calls, 'date'),
        dateDetection: track(calls, 'dateDetection'),
        outline: track(calls, 'outline'),
        space: track(calls, 'space'),
        activity: track(calls, 'activity'),
        dashed: track(calls, 'dashed'),
        theater: track(calls, 'theater'),
        ledgerCapture: track(calls, 'ledgerCapture'),
        ledgerJudge: track(calls, 'ledgerJudge'),
        axisGeneration: track(calls, 'axisGen'),
        linesRuntime: track(calls, 'linesRuntime'),
        pace: track(calls, 'pace'),
        coordinate: track(calls, 'coordinate'),
        refresh: track(calls, 'refresh'),
        beat: track(calls, 'beat'),
        clearTravelUi: () => calls.push('clearTravelUi'),
        removeDialogOverlays: () => calls.push('removeOverlays'),
        clearAutomationClaims: () => calls.push('clearClaims'),
        abortAutoRegen: () => calls.push('abortRegen'),
        clearPointGenerating: () => calls.push('clearPoint'),
        resetViewHome: () => calls.push('resetView'),
        paintPaceSoon: () => calls.push('paceSoon'),
        loadExternalChat: async () => calls.push('load'),
        migrateChat: () => { calls.push('migrate'); return { status: 'ok' }; },
        hydratePace: () => calls.push('hydrate'),
        reloadPanel: () => calls.push('reloadPanel'),
        scheduleAfterLoad: () => calls.push('afterLoad'),
        refreshOutlineInjection: () => calls.push('injOutline'),
        refreshLinesInjection: () => calls.push('injLines'),
        refreshStoryClock: () => calls.push('injClock'),
        refreshLedgerInjection: () => calls.push('injLedger'),
        setChatId(next) { chatId = next; },
        ...overrides,
    };
    return h;
}

test('chat change aborts before migrate and rebinds after reload', async () => {
    const h = host();
    const result = await runChatChanged(h);
    assert.equal(result.status, 'ready');
    const names = h.calls;
    assert.ok(names.indexOf('begin') < names.indexOf('load'));
    assert.ok(names.indexOf('memory.abortAll') < names.indexOf('migrate'));
    assert.ok(names.includes('refresh.abort'));
    assert.ok(names.indexOf('migrate') < names.indexOf('hydrate'));
    assert.ok(names.indexOf('reloadPanel') < names.indexOf('injLines'));
    assert.equal(names.filter(name => name === 'activity.onChatChanged').length, 2);
});

test('a second chat change during load does not migrate the first chat', async () => {
    const h = host({
        async loadExternalChat() {
            h.setChatId('other');
            h.calls.push('load');
        },
    });
    const result = await runChatChanged(h);
    assert.equal(result.status, 'superseded');
    assert.ok(!h.calls.includes('migrate'));
    assert.ok(!h.calls.includes('hydrate'));
});

test('plugin off still clears, but skips reload', async () => {
    const h = host({ pluginEnabled: () => false });
    const result = await runChatChanged(h);
    assert.equal(result.status, 'disabled');
    assert.ok(h.calls.includes('coordinate.close'));
    assert.ok(!h.calls.includes('hydrate'));
    assert.ok(!h.calls.includes('reloadPanel'));
});
