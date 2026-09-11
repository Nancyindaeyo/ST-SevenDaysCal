import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('axis item actions remain discoverable to assistive technology', () => {
    return readFile(new URL('./item-ui.js', import.meta.url), 'utf8').then(source => {
        assert.match(source, /aria-label="\$\{it\.pin \? '解锁此历项' : '锁定此历项'\}"/);
        assert.match(source, /aria-label="编辑此历项"/);
        assert.match(source, /aria-label="删除此历项"/);
        assert.match(source, /aria-hidden="true"/);
    });
});

test('coarse pointers always expose axis actions with larger touch targets', async () => {
    const css = await readFile(new URL('../../style.css', import.meta.url), 'utf8');
    assert.match(css, /@media \(hover: none\), \(pointer: coarse\)/);
    assert.match(css, /\.sp-alm-acts \.sp-icon-btn\s*\{[\s\S]*?width:\s*40px;[\s\S]*?height:\s*40px;[\s\S]*?opacity:\s*1;/);
});
