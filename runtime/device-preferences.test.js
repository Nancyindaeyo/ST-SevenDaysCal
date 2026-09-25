import test from 'node:test';
import assert from 'node:assert/strict';
import {
    classifyStorageError,
    createDevicePreferences,
    finiteNumber,
    normalizeHeight,
    normalizePoint,
    normalizeSize,
} from './device-preferences.js';

test('finite numbers reject NaN Infinity and strings', () => {
    assert.equal(finiteNumber(12), 12);
    assert.equal(finiteNumber('8'), null);
    assert.equal(finiteNumber(Number.NaN), null);
    assert.equal(finiteNumber(Number.POSITIVE_INFINITY), null);
    assert.equal(finiteNumber('nope'), null);
    assert.equal(normalizePoint({ left: '12', top: 8 }), null);
    assert.equal(normalizePoint({ left: Number.NaN, top: 8 }), null);
    assert.equal(normalizePoint({ left: 12, top: Number.POSITIVE_INFINITY }), null);
    assert.deepEqual(normalizePoint({ left: 12, top: 8 }), { left: 12, top: 8 });
});

test('restore values clamp to the current viewport', () => {
    assert.deepEqual(normalizePoint({ left: 9000, top: -40 }, { vw: 200, vh: 100, width: 48, height: 48 }), { left: 152, top: 0 });
    assert.deepEqual(normalizeSize({ width: 20, height: 9000 }, { vw: 400, vh: 600, mobile: false }), { width: 280, height: 590 });
    assert.equal(normalizeHeight(Number.NaN), 210);
    assert.equal(normalizeHeight(9000), 420);
    assert.equal(normalizeHeight(40), 80);
});

test('storage errors become ephemeral and do not throw to the caller', () => {
    const quota = createDevicePreferences({
        storage: {
            getItem() { return '{"left":12,"top":8}'; },
            setItem() {
                const error = new Error('quota');
                error.name = 'QuotaExceededError';
                throw error;
            },
        },
        viewport: () => ({ vw: 800, vh: 600 }),
    });
    assert.deepEqual(quota.readFabPos().value, { left: 12, top: 8 });
    const written = quota.writeFabPos({ left: 20, top: 30 });
    assert.equal(written.ok, false);
    assert.equal(written.ephemeral, true);
    assert.equal(written.error, 'QuotaExceededError');
    assert.equal(quota.isEphemeral(), true);

    const locked = createDevicePreferences({
        storage: () => {
            const error = new Error('the operation is insecure');
            error.name = 'SecurityError';
            throw error;
        },
    });
    const read = locked.readPanelPos();
    assert.equal(read.ok, false);
    assert.equal(read.ephemeral, true);
    assert.equal(classifyStorageError({ name: 'SecurityError' }), 'SecurityError');

    const missing = createDevicePreferences({ storage: null });
    const size = missing.writePanelSize({ width: 320, height: 400 });
    assert.equal(size.ok, false);
    assert.equal(size.ephemeral, true);
});
