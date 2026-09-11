import test from 'node:test';
import assert from 'node:assert/strict';
import {
    clickInsideActionMenu,
    dispatchManualAction,
    outlineMenuIndex,
    parseManualActionItem,
    pointMenuDay,
} from './action-menu.js';
import { isAdultRevealKey } from './adult-reveal.js';

test('point menu future stays a token, otherwise a number', () => {
    assert.equal(pointMenuDay('future'), 'future');
    assert.equal(pointMenuDay('past:2'), 'past:2');
    assert.equal(pointMenuDay('2'), 2);
});

test('outline edit/delete are 1-based, current stays as-is', () => {
    assert.equal(outlineMenuIndex('outline-edit', 3), 2);
    assert.equal(outlineMenuIndex('outline-delete', 1), 0);
    assert.equal(outlineMenuIndex('outline-current', 3), 3);
});

test('manual action item reads line idx then fallback idx', () => {
    const item = {
        attr(name) { return name === 'data-action' ? 'line-edit' : undefined; },
        closest() {
            return {
                attr(name) {
                    if (name === 'data-line-idx') return '4';
                    if (name === 'data-idx') return '9';
                    if (name === 'data-day') return 'future';
                    if (name === 'data-ev') return '1';
                    if (name === 'data-iid') return 'i1';
                    if (name === 'data-cid') return 'c1';
                    return undefined;
                },
            };
        },
    };
    assert.deepEqual(parseManualActionItem(item), {
        action: 'line-edit', idx: 4, day: 'future', ev: 1, iid: 'i1', cid: 'c1',
    });
});

test('manual dispatch routes point/line/outline without mixing indexes', () => {
    const calls = [];
    const env = {
        pointView: () => ({ view: 'char', charName: '阿宁' }),
        pointEdit: (...args) => calls.push(['pointEdit', ...args]),
        lineDelete: (...args) => calls.push(['lineDelete', ...args]),
        outlineEdit: (...args) => calls.push(['outlineEdit', ...args]),
        outlineCurrent: (...args) => calls.push(['outlineCurrent', ...args]),
        inject: (...args) => calls.push(['inject', ...args]),
    };
    dispatchManualAction({ action: 'point-edit', day: 'future', ev: 2 }, env);
    dispatchManualAction({ action: 'line-delete', idx: 5 }, env);
    dispatchManualAction({ action: 'outline-edit', idx: 3 }, env);
    dispatchManualAction({ action: 'outline-current', idx: 3 }, env);
    dispatchManualAction({ action: 'line-inject', iid: 'x' }, env);
    assert.deepEqual(calls, [
        ['pointEdit', 'future', 2, { view: 'char', charName: '阿宁' }],
        ['lineDelete', 5],
        ['outlineEdit', 2],
        ['outlineCurrent', 3],
        ['inject', 'x'],
    ]);
});

test('action menu dismiss ignores clicks inside the menu', () => {
    const inside = { matches: sel => sel.includes('.sp-action-menu') };
    const outside = { matches: () => false };
    assert.equal(clickInsideActionMenu([outside, inside]), true);
    assert.equal(clickInsideActionMenu([outside]), false);
    assert.equal(clickInsideActionMenu([null]), false);
});

test('adult reveal keys are enter and space', () => {
    assert.equal(isAdultRevealKey('Enter'), true);
    assert.equal(isAdultRevealKey(' '), true);
    assert.equal(isAdultRevealKey('Escape'), false);
});
