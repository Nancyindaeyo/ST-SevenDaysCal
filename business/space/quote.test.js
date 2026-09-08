import test from 'node:test';
import assert from 'node:assert/strict';
import { excerptToQuote, wrapQuotedSpaceMessage, parseQuotedSpaceMessage, quotedSpaceMessageForApi, quoteCardHtml } from './quote.js';
import { spaceMessagePlainText, stripWidgetsForApi } from './schema.js';
import { createCoordinateUI } from '../coordinate/ui.js';

test('wrap and parse keep quote plus typed follow-up', () => {
    const wrapped = wrapQuotedSpaceMessage({ charName: '春', floorIndex: 2, quote: '原文一句', note: '点评' }, '没有');
    const parsed = parseQuotedSpaceMessage(wrapped);
    assert.equal(parsed.who, '春');
    assert.equal(parsed.floor, 2);
    assert.equal(parsed.quote, '原文一句');
    assert.equal(parsed.note, '点评');
    assert.equal(parsed.typed, '没有');
    assert.match(quotedSpaceMessageForApi(wrapped), /「原文一句」/);
    assert.match(quotedSpaceMessageForApi(wrapped), /没有$/);
});

test('quote-only message still round-trips', () => {
    const wrapped = wrapQuotedSpaceMessage({ quote: '只引用' }, '  ');
    assert.equal(parseQuotedSpaceMessage(wrapped).typed, '');
    assert.equal(parseQuotedSpaceMessage('普通一句话'), null);
});

test('quoteCardHtml uses left-border card markup', () => {
    const html = quoteCardHtml(excerptToQuote({ who: '春', quote: '<hi>' }), value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
    assert.match(html, /sp-space-quote-card/);
    assert.match(html, /&lt;hi&gt;/);
});

test('space history copy and API strip unwrap quoted user messages', () => {
    const wrapped = wrapQuotedSpaceMessage({ charName: '春', quote: '原文' }, '没有');
    assert.equal(spaceMessagePlainText({ role: 'user', content: wrapped }).includes('原文'), true);
    const stripped = stripWidgetsForApi([{ role: 'user', content: wrapped }]);
    assert.equal(stripped[0].content.includes('<sp_quote>'), false);
    assert.match(stripped[0].content, /没有/);
});

test('backFrom returns to flattened character items instead of chat folders', () => {
    const ui = createCoordinateUI();
    ui.setRoute({ level: 'items', charName: '春', chatId: null, browse: 'char' });
    ui.captureFrom();
    ui.setRoute({ level: 'full', itemId: 'snap-1' });
    ui.backFrom();
    const state = ui.state();
    assert.equal(state.level, 'items');
    assert.equal(state.charName, '春');
    assert.equal(state.chatId, null);
    assert.equal(state.itemId, null);
});

test('backFrom from 看快照 returns to excerpt shelf', () => {
    const ui = createCoordinateUI();
    ui.setShelf('clips');
    ui.captureFrom();
    ui.setShelf('snaps');
    ui.setRoute({ level: 'full', itemId: 'snap-1' });
    ui.backFrom();
    const state = ui.state();
    assert.equal(state.shelf, 'clips');
    assert.equal(state.level, 'chars');
});
