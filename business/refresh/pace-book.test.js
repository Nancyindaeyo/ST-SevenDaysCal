import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaceBook } from './pace-book.js';

function fakeBook() {
    let saved = null;
    let paints = 0;
    const refresh = {
        last: { counter: 1, lastFloor: 4, lastReconcileFloor: 4 },
        stagger: { pendingDashed: false, hasPendingAdvance: () => true },
        state() { return this.last; },
        hydrate(next) { this.last = { ...this.last, ...next }; },
    };
    const outline = {
        last: { lastFloor: 4, counter: 2 },
        state() { return this.last; },
        hydrate(next) { this.last = { lastFloor: next.lastFloor, counter: next.counter }; },
    };
    const dashed = {
        last: { lastFloor: 4, counter: 0, autoFloor: 4, autoCount: 0 },
        state() { return this.last; },
        hydrate(next) { this.last = { lastFloor: next.lastFloor, counter: next.counter, autoFloor: next.lastFloor, autoCount: next.counter }; },
    };
    const linesLifecycle = { counter: 1, lastSeenMaxMesId: 4 };
    const book = createPaceBook({
        read: () => saved,
        write: value => { saved = value; },
        chatId: () => 'chat-1',
        latestFloor: () => 4,
        refresh,
        outline,
        dashed,
        linesLifecycle,
        paintSoon: () => { paints += 1; },
    });
    return { book, refresh, outline, dashed, linesLifecycle, getSaved: () => saved, paints: () => paints };
}

test('pace book persist/hydrate round-trips date and ledger gates', () => {
    const first = fakeBook();
    first.book.date.hydrate({ lastFloor: 4, counter: 2 });
    first.book.ledgerCapture.hydrate({ lastFloor: 4, counter: 1, lastDueFloor: 4 });
    first.book.ledgerJudge.hydrate({ lastFloor: 3, counter: 3 });
    first.book.persist();
    const saved = first.getSaved();
    assert.equal(saved.date.counter, 2);
    assert.equal(saved.ledgerCapture.counter, 1);
    assert.equal(saved.ledgerCapture.lastDueFloor, 4);
    assert.equal(saved.advance.lastFloor, 4);

    const second = fakeBook();
    second.getSaved = () => saved;
    const restored = createPaceBook({
        read: () => saved,
        write: value => { saved.ts = value.ts; },
        chatId: () => 'chat-1',
        latestFloor: () => 4,
        refresh: second.refresh,
        outline: second.outline,
        dashed: second.dashed,
        linesLifecycle: second.linesLifecycle,
        paintSoon: () => {},
    });
    restored.hydrate();
    assert.equal(restored.date.state().counter, 2);
    assert.equal(restored.ledgerCapture.state().lastFloor, 4);
    assert.equal(restored.ledgerCapture.state().lastDueFloor, 4);
    assert.equal(second.refresh.last.pendingAdvance, true);
    assert.equal(second.linesLifecycle.counter, 1);
});

test('consumeFloor persists unfinished intervals, not blocked or seen floors', () => {
    const { book, paints } = fakeBook();
    assert.equal(book.consumeFloor('date', 5, { interval: 3 }), false);
    assert.equal(book.date.state().counter, 1);
    assert.equal(paints(), 1);

    assert.equal(book.consumeFloor('date', 5, { interval: 3 }), false);
    assert.equal(paints(), 1);

    assert.equal(book.consumeFloor('date', 6, { interval: 3, blocked: true }), false);
    assert.equal(book.date.state().lastFloor, 6);
    assert.equal(book.date.state().counter, 1);
    assert.equal(paints(), 1);

    assert.equal(book.consumeFloor('date', 7, { interval: 3 }), false);
    assert.equal(book.date.state().counter, 2);
    assert.equal(paints(), 2);

    assert.equal(book.consumeFloor('date', 8, { interval: 3 }), true);
    assert.equal(book.date.state().counter, 0);
    assert.equal(paints(), 2);
});

test('consumeFloor treats a same-floor reroll as seen and heals lastFloor', () => {
    let pending = true;
    const book = createPaceBook({
        latestFloor: () => 4,
        sameFloor: () => pending,
    });
    book.date.hydrate({ lastFloor: 2, counter: 1 });
    assert.equal(book.consumeFloor('date', 5, { interval: 3 }), false);
    assert.deepEqual(book.date.state(), { lastFloor: 5, counter: 1, lastDueFloor: -1 });
    pending = false;
    assert.equal(book.consumeFloor('date', 6, { interval: 3 }), false);
    assert.equal(book.date.state().counter, 2);
});
