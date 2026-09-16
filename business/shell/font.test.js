import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createUiFontController,
    parseFontFamilyFromCss,
    quoteCssFontFamily,
    SP_FONT_DEFAULT_FAMILY,
    SP_FONT_DEFAULT_URL,
    SP_FONT_LINK_ID,
} from './font.js';

test('parseFontFamilyFromCss only reads the first valid @font-face family', () => {
    assert.equal(parseFontFamilyFromCss(null), '');
    assert.equal(parseFontFamilyFromCss('body { font-family: Arial; }'), '');
    assert.equal(parseFontFamilyFromCss('@font-face { font-family: Arial, sans-serif; }'), '');
    assert.equal(parseFontFamilyFromCss('/* @font-face { font-family: Hidden; } */ @font-face { font-family: Visible; }'), 'Visible');
    assert.equal(parseFontFamilyFromCss('@font-face { font-family: "Nowar Rounded TW Wc"; }'), 'Nowar Rounded TW Wc');
    assert.equal(parseFontFamilyFromCss('@font-face { font-family: Roboto; } @font-face { font-family: Other; }'), 'Roboto');
    assert.equal(parseFontFamilyFromCss('@font-face { font-family: "broken; }'), '');
});

test('quoteCssFontFamily quotes names with spaces and apply mounts one link', () => {
    assert.equal(quoteCssFontFamily('Roboto'), 'Roboto');
    assert.equal(quoteCssFontFamily('Nowar Rounded TW Wc'), '"Nowar Rounded TW Wc"');
    assert.equal(quoteCssFontFamily('"Already"'), '"Already"');

    const styles = {};
    const nodes = [];
    const doc = {
        documentElement: { style: { setProperty(name, value) { styles[name] = value; } } },
        head: { appendChild(node) { nodes.push(node); } },
        getElementById(id) { return nodes.find(node => node.id === id) || null; },
        createElement() {
            const node = {
                id: '',
                rel: '',
                href: '',
                getAttribute(name) { return name === 'href' ? this.href || null : this[name] || null; },
                setAttribute(name, value) { this[name] = value; },
                remove() {
                    const index = nodes.indexOf(node);
                    if (index >= 0) nodes.splice(index, 1);
                },
            };
            return node;
        },
    };
    let settings = { uiFontUrl: 'https://example.test/font.css', uiFontFamily: 'Nowar Rounded TW Wc' };
    const font = createUiFontController({ settings: () => settings, document: doc });
    font.apply();
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].id, SP_FONT_LINK_ID);
    assert.equal(nodes[0].rel, 'stylesheet');
    assert.equal(nodes[0].href, 'https://example.test/font.css');
    assert.equal(styles['--sp-font-user'], '"Nowar Rounded TW Wc"');

    font.apply();
    assert.equal(nodes.length, 1);

    settings = { uiFontUrl: '', uiFontFamily: '' };
    font.apply();
    assert.equal(nodes.length, 0);
    assert.equal(styles['--sp-font-user'], `"${SP_FONT_DEFAULT_FAMILY}"`);
    assert.equal(font.defaultUrl, SP_FONT_DEFAULT_URL);
});
