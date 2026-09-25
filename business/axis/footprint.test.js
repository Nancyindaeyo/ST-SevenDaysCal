import test from 'node:test';
import assert from 'node:assert/strict';
import { appendTimeTravelFootprint, planJumpBackAnchor } from './footprint.js';

test('footprint only keeps start date, target date and landing floor', () => {
    const added = appendTimeTravelFootprint([], {
        sourceDate: { month: 3, day: 1 },
        targetDate: { month: 3, day: 8 },
        landingFloor: 12,
        direction: 'forward',
        patch: { shouldNotPersist: true },
    });
    assert.equal(added.ok, true);
    assert.equal(added.list[0].sourceDate.month, 3);
    assert.equal(added.list[0].targetDate.day, 8);
    assert.equal(added.list[0].landingFloor, 12);
    assert.equal(Object.hasOwn(added.list[0], 'direction'), false);
    assert.equal(appendTimeTravelFootprint([], { sourceDate: { month: 3, day: 1 } }).ok, false);
});

test('jump-back plan restores the anchor only after confirm and never rewrites story', () => {
    const plan = planJumpBackAnchor({
        sourceDate: { month: 3, day: 1 },
        targetDate: { month: 5, day: 4 },
        landingFloor: 9,
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.needsConfirm, true);
    assert.equal(plan.action, 'restore-anchor');
    assert.deepEqual(plan.date, { year: null, month: 5, day: 4 });
    assert.equal(plan.rewriteStory, false);
    assert.equal(plan.undoActivity, false);
    assert.equal(planJumpBackAnchor(null).ok, false);
});
