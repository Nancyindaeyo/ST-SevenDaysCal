import test from 'node:test';
import assert from 'node:assert/strict';
import { clipText, matchExcerpt, normalizeExcerpt, normalizeExcerpts, formatExcerptForSpace, QUOTE_MAX } from './excerpt-schema.js';
import { createExcerptRepository } from './excerpt-repository.js';

test('clipText collapses space and caps length', () => {
    assert.equal(clipText('  a \n  b  ', 20), 'a b');
    assert.equal(clipText('a\n\n\nb', 20, { keepBreaks: true }), 'a\n\nb');
    const long = '字'.repeat(QUOTE_MAX + 8);
    const clipped = clipText(long, QUOTE_MAX);
    assert.equal(clipped.endsWith('…'), true);
    assert.equal(clipped.length <= QUOTE_MAX, true);
});

test('matchExcerpt searches quote and note with all tokens', () => {
    const item = normalizeExcerpt({ id: '1', quote: '月光落在窗台', note: '这一句很冷', charName: '春' });
    assert.equal(matchExcerpt(item, ''), true);
    assert.equal(matchExcerpt(item, '月光 冷'), true);
    assert.equal(matchExcerpt(item, '春 窗台'), true);
    assert.equal(matchExcerpt(item, '没有的词'), false);
});

test('normalizeExcerpts drops empty quotes', () => {
    const next = normalizeExcerpts({ version: 1, items: [{ id: 'a', quote: '留着' }, { id: 'b', quote: '   ' }, null] });
    assert.equal(next.items.length, 1);
    assert.equal(next.items[0].id, 'a');
});

test('formatExcerptForSpace asks 间 to review without touching ledgers', () => {
    const text = formatExcerptForSpace({ quote: '原文一句', note: '我觉得好', charName: '春', floorIndex: 2 });
    assert.match(text, /请评价这段摘抄/);
    assert.match(text, /不要改账本/);
    assert.match(text, /「原文一句」/);
    assert.match(text, /我觉得好/);
});

test('excerpt repository keeps snapshots untouched in its own file', async () => {
    const files = new Map();
    const ports = {
        fetch: async (url, opts = {}) => {
            const name = String(url).split('/').pop();
            if (opts.method === 'POST' && String(url).includes('/upload')) {
                const body = JSON.parse(opts.body);
                const json = JSON.parse(Buffer.from(body.data, 'base64').toString('utf8'));
                files.set(body.name, json);
                return { ok: true, json: async () => ({ path: body.name }) };
            }
            if (!opts.method || opts.method === 'GET') {
                if (!files.has(name)) return { ok: false, status: 404 };
                return { ok: true, status: 200, text: async () => JSON.stringify(files.get(name)) };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        },
        headers: () => ({ 'Content-Type': 'application/json' }),
        pathOf: name => `user/files/${name}`,
        encode: value => Buffer.from(String(value), 'utf8').toString('base64'),
    };
    const repo = createExcerptRepository({ ports });
    const saved = await repo.add({ quote: '选中的一句', note: '点评', charName: '春', snapshotId: 'snap-1' });
    assert.equal(saved.quote, '选中的一句');
    assert.equal(await repo.count(), 1);
    const listed = await repo.list();
    assert.equal(listed[0].snapshotId, 'snap-1');
    await repo.remove(saved.id);
    assert.equal(await repo.count(), 0);
});
