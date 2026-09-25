import test from 'node:test';
import assert from 'node:assert/strict';
import { openSettingsTarget, settingsHereLabel, settingsNavHtml, TAG_SETTINGS_TARGET } from './settings-nav.js';

test('settings nav lists layers and the tag jump target', () => {
    const html = settingsNavHtml(value => String(value));
    assert.match(html, /data-settings-target="sp-settings-general"/);
    assert.match(html, /提示词与标签/);
    assert.match(html, /返回顶部/);
    assert.equal(TAG_SETTINGS_TARGET.focusSel, '#sp-mem-keeptags');
});

test('openSettingsTarget opens nested details and focuses the tag field', () => {
    const keep = { focusCalls: 0, focus() { this.focusCalls += 1; }, scrollIntoView() { this.scrolled = true; } };
    const tags = { open: false, matches: sel => sel === 'details', parentElement: null, querySelector: () => null };
    const prompts = {
        open: false,
        matches: sel => sel === 'details',
        parentElement: { open: false, matches: sel => sel === 'details', parentElement: null },
        querySelector: () => null,
    };
    const root = {
        querySelector(sel) {
            if (sel === '#sp-prompts-section') return prompts;
            if (sel === '.sp-prompt-tags') return tags;
            if (sel === '#sp-mem-keeptags') return keep;
            return null;
        },
    };
    const result = openSettingsTarget(root, TAG_SETTINGS_TARGET);
    assert.equal(result.ok, true);
    assert.equal(result.focused, true);
    assert.equal(prompts.open, true);
    assert.equal(prompts.parentElement.open, true);
    assert.equal(tags.open, true);
    assert.equal(keep.focusCalls, 1);
    assert.equal(keep.scrolled, true);
});

test('settingsHereLabel prefers the visible layer title', () => {
    const layer = {
        getBoundingClientRect: () => ({ top: 20, bottom: 200 }),
        querySelector: () => ({ textContent: ' 跟剧情走 ' }),
    };
    const container = {
        getBoundingClientRect: () => ({ top: 0 }),
        querySelectorAll: () => [layer],
    };
    assert.equal(settingsHereLabel(container), '跟剧情走');
});
