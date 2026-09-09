import test from 'node:test';
import assert from 'node:assert/strict';
import { CALENDAR_SPACE_PREFILL, resolveAlmanacToolbarAction } from './bind.js';

function button({ classes = [], action } = {}) {
    return {
        hasClass(name) { return classes.includes(name); },
        attr(key) { return key === 'data-action' ? action : undefined; },
    };
}

test('toolbar prefers data-action then class fallback', () => {
    assert.deepEqual(resolveAlmanacToolbarAction(button({ classes: ['sp-action-menu-toggle'] })), { type: 'menu' });
    assert.deepEqual(resolveAlmanacToolbarAction(button({ action: 'generate-almanac' })), { type: 'action', action: 'generate-almanac' });
    assert.deepEqual(resolveAlmanacToolbarAction(button({ classes: ['sp-alm-add'] })), { type: 'action', action: 'add-almanac' });
    assert.deepEqual(resolveAlmanacToolbarAction(button({ classes: ['sp-alm-gen'] })), { type: 'action', action: 'generate-almanac' });
    assert.deepEqual(resolveAlmanacToolbarAction(button({ classes: ['sp-alm-supplement'] })), { type: 'action', action: 'supplement-anniversary' });
    assert.deepEqual(resolveAlmanacToolbarAction(button({ classes: ['sp-alm-manage'] })), { type: 'action', action: 'manage-calendar' });
});

test('calendar manager still pre-fills 间 with the same design prompt', () => {
    assert.match(CALENDAR_SPACE_PREFILL, /自定义历法/);
    assert.match(CALENDAR_SPACE_PREFILL, /纪年名/);
});
