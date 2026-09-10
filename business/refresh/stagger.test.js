import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaggerGate, shouldDeferAdvance } from './stagger.js';
import { readRefreshBar, refreshBarHtml } from './bar.js';

test('same floor runs align first and defers advance', () => {
    const gate = createStaggerGate();
    const first = gate.plan({ reconcileDue: true, advanceDue: true, dashedDue: true });
    assert.equal(first.run, 'reconcile');
    assert.equal(first.pendingAdvance, true);
    assert.equal(first.pendingDashed, true);
    const second = gate.plan({ reconcileDue: false, advanceDue: false, dashedDue: false });
    assert.equal(second.run, 'advance');
    assert.equal(second.pendingDashed, true);
    const third = gate.plan({});
    assert.equal(third.run, 'dashed');
});

test('time travel runs nothing and keeps the debt', () => {
    const gate = createStaggerGate();
    gate.plan({ reconcileDue: true, advanceDue: true });
    const paused = gate.plan({ reconcileDue: true, advanceDue: true, timeTravel: true });
    assert.equal(paused.run, null);
    assert.equal(paused.pendingAdvance, true);
});

test('shouldDeferAdvance keeps an owed advance', () => {
    assert.deepEqual(shouldDeferAdvance({ reconcileRan: true, wouldAdvance: true }), { advance: false, pending: true });
    assert.deepEqual(shouldDeferAdvance({ reconcileRan: false, pending: true }), { advance: true, pending: false });
    assert.deepEqual(shouldDeferAdvance({ reconcileRan: false, wouldAdvance: true }), { advance: true, pending: false });
});

test('dashed defer is consumed on the next empty floor', () => {
    const gate = createStaggerGate();
    gate.deferDashed();
    assert.equal(gate.hasPendingDashed(), true);
    assert.equal(gate.consumeDashed(), true);
    assert.equal(gate.consumeDashed(), false);
});

test('refresh bar reads outline mode defaulting to current', () => {
    assert.match(refreshBarHtml(), /value="current" checked/);
    const fake = {
        length: 1,
        find(sel) {
            if (sel === '.sp-refresh-mod:checked') {
                return { each(fn) { fn.call({ getAttribute: () => 'outline' }); } };
            }
            if (sel === '#sp-refresh-reason') return { val: () => '改当前节点' };
            if (sel === '#sp-refresh-feedback') return { val: () => '' };
            if (sel === 'input[name="sp-refresh-outline-mode"]:checked') return { val: () => 'continue' };
            return { val: () => '' };
        },
    };
    const form = readRefreshBar(fake);
    assert.deepEqual(form.selected, ['outline']);
    assert.equal(form.outlineMode, 'continue');
});
