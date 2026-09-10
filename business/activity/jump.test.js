import test from 'node:test';
import assert from 'node:assert/strict';
import {
    activateContainingPointDay,
    canJumpActivityItem,
    entryMatchesPace,
    findJumpElement,
    jumpViewOf,
    latestPaceEntry,
    revealActivityTarget,
} from './jump.js';

function attrNode(attrs) {
    return { getAttribute: name => (attrs[name] == null ? '' : String(attrs[name])) };
}

test('pace matching picks the latest align / advance / outline / dashed entry', () => {
    const entries = [
        { source: 'advance', items: [{ module: 'lines', title: '新' }] },
        { source: 'align-auto', items: [{ module: 'point', title: '近' }] },
        { source: 'align', items: [{ module: 'point', title: '远' }] },
        { source: 'dashed', items: [{ module: 'dashed', title: '冷' }] },
    ];
    assert.equal(entryMatchesPace(entries[1], 'align'), true);
    assert.equal(latestPaceEntry(entries, 'align').items[0].title, '近');
    assert.equal(latestPaceEntry(entries, 'advance').source, 'advance');
    assert.equal(latestPaceEntry(entries, 'outline'), null);
    assert.equal(latestPaceEntry(entries, 'dashed').source, 'dashed');
});

test('jump view maps modules onto the right page and sheet', () => {
    assert.deepEqual(jumpViewOf('point'), { view: 'schedule', sheet: null });
    assert.deepEqual(jumpViewOf('lines'), { view: 'lines', sheet: 'events' });
    assert.deepEqual(jumpViewOf('dashed'), { view: 'lines', sheet: 'dashed' });
    assert.deepEqual(jumpViewOf('outline'), { view: 'outline', sheet: null });
    assert.equal(canJumpActivityItem({ module: 'point', title: '体检' }), true);
    assert.equal(canJumpActivityItem({ module: 'dashed', ref: 'd1' }), true);
    assert.equal(canJumpActivityItem({ module: 'point' }), false);
});

test('findJumpElement prefers ref then title', () => {
    const dashed = attrNode({ 'data-jump-mod': 'dashed', 'data-jump-ref': 'd1', 'data-id': 'd1', 'data-jump-key': '冷' });
    const point = attrNode({ 'data-jump-mod': 'point', 'data-jump-key': '体检' });
    const root = {
        querySelectorAll: sel => {
            if (sel.includes('dashed')) return [dashed];
            if (sel.includes('point')) return [point];
            return [];
        },
    };
    assert.equal(findJumpElement(root, { module: 'dashed', ref: 'd1', title: '冷' }), dashed);
    assert.equal(findJumpElement(root, { module: 'point', title: '体检' }), point);
    assert.equal(findJumpElement(root, { module: 'point', title: '已经删了' }), null);
});

test('activateContainingPointDay clicks the tab for the event day panel', () => {
    const clicked = [];
    const tab0 = { classList: { contains: () => true }, click: () => clicked.push('0') };
    const tab1 = { classList: { contains: () => false }, click: () => clicked.push('1') };
    const panel0 = {};
    const panel1 = {};
    const track = { children: [panel0, panel1] };
    panel1.parentElement = track;
    const eventEl = { closest: sel => sel === '.sp-day-panel' ? panel1 : null };
    assert.equal(activateContainingPointDay(eventEl, { querySelectorAll: () => [tab0, tab1] }), true);
    assert.deepEqual(clicked, ['1']);
});

test('reveal flashes a found target and returns false when missing', () => {
    const classes = new Set();
    const point = {
        getAttribute: name => ({ 'data-jump-mod': 'point', 'data-jump-key': '体检' }[name] || ''),
        classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
        offsetWidth: 1,
        scrollIntoView() {},
        closest: () => null,
    };
    const root = { querySelectorAll: sel => sel.includes('point') ? [point] : [] };
    assert.equal(revealActivityTarget(root, { module: 'point', title: '体检' }), true);
    assert.equal(classes.has('sp-activity-jump-flash'), true);
    assert.equal(revealActivityTarget(root, { module: 'point', title: '已经删了' }), false);
});
