import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDateAnchorPolicy, effectiveDateAnchor, effectiveStoryCalibration } from './date-anchor-policy.js';

const cal = {};
const monthCount = () => 12;
const monthDays = () => 30;

test('pending and unresolved are not effective anchors', () => {
    assert.equal(effectiveDateAnchor({ status: 'pending', month: 3, day: 2 }, { charKey: 'card.png', calendar: cal, monthCount, monthDays }), null);
    assert.equal(effectiveDateAnchor({ status: 'unresolved', month: 3, day: 2 }, { charKey: 'card.png', calendar: cal, monthCount, monthDays }), null);
    assert.equal(effectiveDateAnchor({ month: 3, day: 2 }, { charKey: null, calendar: cal, monthCount, monthDays }), null);
    assert.deepEqual(effectiveDateAnchor({ month: 3, day: 2, year: 2024, eraLabel: '夏', time: '15:00' }, {
        charKey: 'card.png', calendar: cal, monthCount, monthDays,
    }), { month: 3, day: 2, year: 2024, eraLabel: '夏', time: '15:00' });
});

test('incomplete story clock does not retire calibration; complete clock on another floor does', () => {
    const local = { month: 5, day: 4, calibration: { weekday: 1, floor: 2 } };
    assert.deepEqual(effectiveDateAnchor(local, {
        charKey: 'card.png',
        calendar: cal,
        monthCount,
        monthDays,
        storyClock: { floor: 9 },
        completeStoryClock: () => false,
    }), { month: 5, day: 4 });
    assert.equal(effectiveDateAnchor(local, {
        charKey: 'card.png',
        calendar: cal,
        monthCount,
        monthDays,
        storyClock: { floor: 9 },
        completeStoryClock: () => true,
    }), null);
    assert.deepEqual(effectiveDateAnchor(local, {
        charKey: 'card.png',
        calendar: cal,
        monthCount,
        monthDays,
        storyClock: { floor: 2 },
        completeStoryClock: () => true,
    }), { month: 5, day: 4 });
    assert.equal(effectiveDateAnchor({ month: 5, day: 4, calibration: { weekday: 'x', floor: 2 } }, {
        charKey: 'card.png', calendar: cal, monthCount, monthDays, completeStoryClock: () => false,
    }), null);
});

test('story calibration keeps weekday and floor, rejects a bad weekday', () => {
    assert.equal(effectiveStoryCalibration({ month: 5, day: 4 }, { charKey: 'card.png', calendar: cal, monthCount, monthDays }), null);
    assert.equal(effectiveStoryCalibration({
        month: 5, day: 4, calibration: { weekday: 8, floor: 2 },
    }, { charKey: 'card.png', calendar: cal, monthCount, monthDays }), null);
    assert.deepEqual(effectiveStoryCalibration({
        month: 5, day: 4, calibration: { weekday: 3, floor: 2, sourceFloor: 1, swipe: '0', refMonth: 4, refDay: 30 },
    }, { charKey: 'card.png', calendar: cal, monthCount, monthDays }), {
        month: 5, day: 4, refMonth: 4, refDay: 30, weekday: 3, floor: 2, sourceFloor: 1, swipe: '0',
    });
});

test('policy reads the repository and forwards saveAnchor; charStableKey stays out', async () => {
    const writes = [];
    let local = { month: 1, day: 1 };
    const policy = createDateAnchorPolicy({
        repository: { get: () => local },
        calendar: () => cal,
        storyClock: () => ({ floor: 0 }),
        completeStoryClock: () => false,
        monthCount,
        monthDays,
        saveAnchor: (...args) => { writes.push(args); return { ok: true }; },
    });
    assert.deepEqual(policy.getDateAnchor('card.png'), { month: 1, day: 1 });
    local = { status: 'pending', month: 2, day: 2 };
    assert.equal(policy.getDateAnchor('card.png'), null);
    local = { month: 3, day: 3, calibration: { weekday: 0, floor: 1, swipe: '1' } };
    assert.equal(policy.getStoryCalibration('card.png').weekday, 0);
    assert.deepEqual(policy.setDateAnchor('card.png', 6, 7, 'detected', { year: 2024 }), { ok: true });
    assert.deepEqual(writes[0], ['card.png', 6, 7, 'detected', { year: 2024 }]);
    const source = await readFile(new URL('./date-anchor-policy.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /import[\s\S]*charStableKey|function charStableKey|env\.charStableKey/);
});
