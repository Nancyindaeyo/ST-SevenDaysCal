import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTheaterExportBook } from './export-book.js';

test('liked form seed keeps 1600 characters of the template', () => {
    const source = '甲'.repeat(1800);
    const book = buildTheaterExportBook([{
        liked: true,
        raw: '正文',
        formName: '体裁',
        templateSource: { title: '体裁', input: source },
    }]);
    const content = book.entries['0'].content;
    assert.equal((content.match(/甲/g) || []).length, 1600);
    assert.equal(content.includes('甲'.repeat(1601)), false);
});
