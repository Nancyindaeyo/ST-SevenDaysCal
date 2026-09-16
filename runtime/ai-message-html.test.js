import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    AI_BUBBLE_REGEX_GUARD,
    formatAiMessageHtml,
    runWithRegexExtensionDisabled,
} from './ai-message-html.js';

test('regex guard pushes only when missing and always restores', () => {
    const list = ['other'];
    assert.equal(runWithRegexExtensionDisabled(list, () => {
        assert.deepEqual(list, ['other', 'regex']);
        return 'ok';
    }), 'ok');
    assert.deepEqual(list, ['other']);

    const already = ['regex'];
    runWithRegexExtensionDisabled(already, () => {
        assert.deepEqual(already, ['regex']);
    });
    assert.deepEqual(already, ['regex']);

    const boom = [];
    assert.throws(() => runWithRegexExtensionDisabled(boom, () => { throw new Error('fmt'); }), /fmt/);
    assert.deepEqual(boom, []);
    runWithRegexExtensionDisabled(null, () => 'skip');
});

test('formatAiMessageHtml disables regex during messageFormatting and falls back to escaped br', () => {
    const disabled = [];
    const calls = [];
    const html = formatAiMessageHtml('hi\nthere', {
        getContext: () => ({
            messageFormatting: (text, name, isSystem, isUser, messageId, extra, skipReason) => {
                calls.push([text, name, isSystem, isUser, messageId, extra, skipReason, [...disabled]]);
                return `<p>${text}</p>`;
            },
        }),
        disabledExtensions: () => disabled,
        escapeHtml: value => `E(${value})`,
    });
    assert.equal(html, '<p>hi\nthere</p>');
    assert.deepEqual(calls, [['hi\nthere', '', false, false, null, {}, false, ['regex']]]);
    assert.deepEqual(disabled, []);

    const logged = [];
    assert.equal(formatAiMessageHtml('a\nb', {
        getContext: () => ({
            messageFormatting: () => { throw new Error('fmt'); },
        }),
        disabledExtensions: () => [],
        escapeHtml: value => value.replace(/</g, '&lt;'),
        logWarn: err => logged.push(err.message),
    }), 'a<br>b');
    assert.deepEqual(logged, ['fmt']);

    assert.equal(formatAiMessageHtml('<x>\ny', {
        getContext: () => ({}),
        escapeHtml: value => value.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    }), '&lt;x&gt;<br>y');
});

test('ai bubble html keeps the regex isolation contract in source', async () => {
    assert.equal(AI_BUBBLE_REGEX_GUARD, 'regex');
    const source = await readFile(new URL('./ai-message-html.js', import.meta.url), 'utf8');
    assert.match(source, /disabledExtensions/);
    assert.match(source, /messageId 只能传 null/);
    assert.doesNotMatch(source, /extensions\.js|script\.js/);
});
