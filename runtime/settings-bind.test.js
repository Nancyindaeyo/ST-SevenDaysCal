import test from 'node:test';
import assert from 'node:assert/strict';
import { bindSettingsPanel, clampSettingCount, clampUiScale } from './settings-bind.js';

test('ui scale snaps to five-percent steps inside 0.8–1.3', () => {
    assert.equal(clampUiScale(1), 1);
    assert.equal(clampUiScale(0.72), 0.8);
    assert.equal(clampUiScale(1.39), 1.3);
    assert.equal(clampUiScale(1.12), 1.1);
});

test('setting counts floor and clamp', () => {
    assert.equal(clampSettingCount('3.9', { min: 1, max: 30, fallback: 5 }), 3);
    assert.equal(clampSettingCount('', { min: 1, max: 30, fallback: 5 }), 5);
    assert.equal(clampSettingCount(0, { min: 0, fallback: 0 }), 0);
    assert.equal(clampSettingCount(99, { min: 1, max: 30, fallback: 4 }), 30);
});

test('plugin toggle writes immediately and applies', () => {
    const handlers = new Map();
    const $in = sel => {
        const api = {
            on(ev, a, b) { handlers.set(`${sel}\0${ev}`, typeof a === 'function' ? a : b); return api; },
            off() { return api; },
            prop() { return api; },
            val() { return ''; },
            text() { return api; },
        };
        return api;
    };
    const settings = { pluginEnabled: true };
    let savedNow = 0;
    let applied = null;
    bindSettingsPanel({
        $in,
        settings: () => settings,
        save() {},
        saveNow() { savedNow += 1; },
        applyPluginEnabled(on) { applied = on; },
    });
    handlers.get('#sp-plugin-enabled\0change').call({ checked: false });
    assert.equal(settings.pluginEnabled, false);
    assert.equal(savedNow, 1);
    assert.equal(applied, false);
});
