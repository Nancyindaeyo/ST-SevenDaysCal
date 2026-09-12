import test from 'node:test';
import assert from 'node:assert/strict';
import { extractStoryText, stripTags } from './story-text.js';

test('有 content 包裹时只读标签内全文，丢掉外面的状态栏', () => {
    const raw = [
        '<status>HP 12/12 体力条很长很长很长</status>',
        '面板说明不要当正文',
        '<content>',
        '<p>第一段很长的叙事。</p>',
        '<p>第二段继续往下写，不能被截断。</p>',
        '</content>',
    ].join('\n');
    const story = extractStoryText(raw);
    assert.match(story, /第一段很长的叙事/);
    assert.match(story, /第二段继续往下写，不能被截断/);
    assert.doesNotMatch(story, /HP 12\/12/);
    assert.doesNotMatch(story, /面板说明/);
});

test('正文包裹里的段落标签解开而不是整段删掉', () => {
    const long = '甲'.repeat(1800);
    const story = extractStoryText(`<content><p>${long}</p><em>尾声</em></content>`);
    assert.equal(story.includes(long), true);
    assert.match(story, /尾声/);
    assert.doesNotMatch(story, /<p>/);
});

test('正文里的思维链删掉，其它 HTML 只剥标签', () => {
    const story = extractStoryText('<content>可见<think>秘密推理</think>结局</content>');
    assert.equal(story, '可见结局');
});

test('正文包裹名可改；留空仍默认找 content', () => {
    const raw = '<story>只读这篇</story><content>旧默认</content>';
    assert.equal(extractStoryText(raw, { keepTags: 'story' }), '只读这篇');
    assert.equal(extractStoryText(raw, { keepTags: '' }), '旧默认');
});

test('没有正文包裹时退回 stripTags，不把 widget 当叙事', () => {
    const raw = '门口遇见她。<calendar_widget>点</calendar_widget>';
    assert.equal(extractStoryText(raw), stripTags(raw));
    assert.equal(extractStoryText(raw), '门口遇见她。');
});
