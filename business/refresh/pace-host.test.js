import test from 'node:test';
import assert from 'node:assert/strict';
import {
    almanacJudgeIntervalOf,
    almanacSupplementIntervalOf,
    createPaceHost,
    ledgerCaptureIntervalOf,
    ledgerJudgeIntervalOf,
    readInterval,
} from './pace-host.js';

test('pace intervals clamp to ≥1 with the known fallbacks', () => {
    assert.equal(readInterval('2.9', 3), 2);
    assert.equal(readInterval(0, 3), 3);
    assert.equal(readInterval(-1, 3), 3);
    assert.equal(almanacJudgeIntervalOf({}), 3);
    assert.equal(almanacSupplementIntervalOf({}), 10);
    assert.equal(almanacSupplementIntervalOf({ almanacSupplementInterval: 7 }), 7);
    assert.equal(ledgerCaptureIntervalOf({}), 5);
    assert.equal(ledgerJudgeIntervalOf({ ledgerJudgeInterval: '4' }), 4);
});

function fakeQuery(state) {
    const api = sel => {
        const self = {
            get length() { return state.present.has(sel) ? 1 : 0; },
            html(value) { state.html[sel] = value; return self; },
            text(value) { state.text[sel] = value; return self; },
            toggleClass(name, on) { state.toggle.push([sel, name, on]); return self; },
            removeClass(names) { state.cleared = names; return self; },
        };
        return self;
    };
    return api;
}

function makeHost(overrides = {}) {
    const scheduled = [];
    const state = { html: {}, text: {}, toggle: [], cleared: '', present: new Set(['#sp-pace-fold', '#sp-pace-settings', '[data-pace-remain="supplement"]']) };
    const host = createPaceHost({
        $in: fakeQuery(state),
        settings: () => ({
            ledgerReconcileEnabled: true,
            linesEnabled: true,
            outlineJudgeEnabled: true,
            almanacAutoDetect: true,
            dashedEnabled: true,
            ledgerCaptureEnabled: true,
            almanacJudgeInterval: 3,
            almanacSupplementInterval: 10,
            dashedAutoInterval: 6,
            ledgerCaptureInterval: 5,
            ledgerJudgeInterval: 4,
        }),
        pluginEnabled: () => true,
        paceBook: {
            liveGates: () => ({
                align: { counter: 2 },
                advance: { counter: 0 },
                outline: { counter: 1 },
                date: { counter: 0 },
                supplement: { counter: 9 },
                dashed: { counter: 1 },
                ledgerCapture: { counter: 0 },
                ledgerJudge: { counter: 0 },
                pendingAdvance: false,
                pendingDashed: false,
            }),
            persist: () => { state.persist = true; },
            remember: () => { state.remember = true; },
            hydrate: () => { state.hydrate = true; },
        },
        queueSnapshot: () => null,
        alignInterval: () => 3,
        linesMode: () => 'turns',
        advanceInterval: () => 2,
        outlineInterval: () => 3,
        missingLatestStamp: () => false,
        latestAlignFailed: () => false,
        latestAdvanceFailed: () => false,
        schedule: fn => scheduled.push(fn),
        ...overrides,
    });
    return { host, state, scheduled };
}

test('snapshot keeps supplement on and uses the 10-floor default', () => {
    const { host } = makeHost();
    const snap = host.readSnapshot();
    assert.equal(snap.supplementOn, true);
    assert.equal(snap.supplementUsed, 9);
    assert.equal(snap.supplementInterval, 10);
    assert.equal(snap.alignOn, true);
    assert.equal(snap.alignUsed, 2);
    assert.equal(snap.dateOn, true);
});

test('paint writes fold/settings html and remain classes; plugin off clears remain', () => {
    const { host, state } = makeHost();
    const rows = host.paint();
    assert.equal(rows.find(row => row.id === 'supplement').text, '下一楼');
    assert.match(state.html['#sp-pace-fold'], /补录/);
    assert.match(state.html['#sp-pace-settings'], /id="sp-pace-settings-strip"/);
    assert.equal(state.text['[data-pace-remain="supplement"]'], '下一楼');
    assert.ok(state.toggle.some(item => item[0] === '[data-pace-remain="supplement"]' && item[1] === 'is-due' && item[2] === true));

    const off = makeHost({ pluginEnabled: () => false });
    assert.deepEqual(off.host.paint(), []);
    assert.match(off.state.html['#sp-pace-fold'], /插件关着/);
    assert.equal(off.state.text['[data-pace-remain]'], '');
    assert.equal(off.state.cleared, 'is-due is-off is-running is-queued is-failed');
});

test('paintSoon coalesces until the scheduled kick, persist/remember/hydrate go to the book', () => {
    const { host, state, scheduled } = makeHost();
    assert.equal(host.paintSoon(), true);
    assert.equal(host.paintSoon(), false);
    assert.equal(scheduled.length, 1);
    scheduled[0]();
    assert.match(state.html['#sp-pace-fold'], /对齐/);
    host.persist();
    host.remember();
    host.hydrate();
    assert.equal(state.persist, true);
    assert.equal(state.remember, true);
    assert.equal(state.hydrate, true);
});
