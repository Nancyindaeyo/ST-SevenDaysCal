import test from 'node:test';
import assert from 'node:assert/strict';
import { clipText, matchExcerpt, normalizeExcerpt, normalizeExcerpts, formatExcerptForSpace, QUOTE_MAX } from './excerpt-schema.js';
import { createExcerptRepository } from './excerpt-repository.js';
import { groupItemsByTag, matchQuery, hayOf } from './browse.js';
import { filterSearchList } from './excerpt-ui.js';
import { snapshotSearchText } from './capture.js';

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
    item.tagNames = ['甜'];
    assert.equal(matchExcerpt(item, ''), true);
    assert.equal(matchExcerpt(item, '月光 冷'), true);
    assert.equal(matchExcerpt(item, '春 窗台'), true);
    assert.equal(matchExcerpt(item, '甜'), true);
    assert.equal(matchExcerpt(item, '没有的词'), false);
});

test('normalizeExcerpts keeps tags and drops empty quotes', () => {
    const next = normalizeExcerpts({ version: 1, items: [{ id: 'a', quote: '留着', tags: ['t1', 't1'] }, { id: 'b', quote: '   ' }, null] });
    assert.equal(next.items.length, 1);
    assert.equal(next.items[0].id, 'a');
    assert.deepEqual(next.items[0].tags, ['t1']);
});

test('formatExcerptForSpace quotes without sending instructions that auto-apply ledgers', () => {
    const text = formatExcerptForSpace({ quote: '原文一句', note: '我觉得好', charName: '春', floorIndex: 2 });
    assert.match(text, /【摘抄】/);
    assert.match(text, /春/);
    assert.match(text, /「原文一句」/);
    assert.match(text, /点评：我觉得好/);
    assert.equal(text.endsWith('\n'), true);
});

test('groupItemsByTag splits tagged and untagged', () => {
    const tags = [{ id: 'sweet', name: '甜' }, { id: 'hurt', name: '痛' }];
    const items = [
        { id: '1', tags: ['sweet'] },
        { id: '2', tags: ['sweet', 'hurt'] },
        { id: '3', tags: [] },
    ];
    const { groups, untagged } = groupItemsByTag(items, tags);
    assert.equal(groups[0].items.length, 2);
    assert.equal(groups[1].items.length, 1);
    assert.equal(untagged.length, 1);
    assert.equal(matchQuery(hayOf(['月光', '春']), '月光'), true);
    assert.equal(matchQuery('月光', '没有'), false);
});

test('filterSearchList hides unmatched cards without rebuilding', () => {
    const cards = [
        { hidden: false, getAttribute: () => '月光 春', querySelectorAll: () => [] },
        { hidden: false, getAttribute: () => '雨 冬', querySelectorAll: () => [{ value: '备注里有月光' }] },
    ];
    const empty = { hidden: true };
    const root = {
        querySelector: sel => {
            if (sel === '[data-filter-list]') return { querySelectorAll: () => cards };
            if (sel === '.sp-search-empty') return empty;
            return null;
        },
    };
    assert.equal(filterSearchList(root, '月光'), 2);
    assert.equal(cards[0].hidden, false);
    assert.equal(cards[1].hidden, false);
    assert.equal(filterSearchList(root, '冬'), 1);
    assert.equal(cards[0].hidden, true);
    assert.equal(cards[1].hidden, false);
});

test('snapshotSearchText keeps body text beyond the card preview', async () => {
    const { makePreview } = await import('./capture.js');
    const html = `<p>${'前'.repeat(160)}月光</p>`;
    assert.equal(makePreview(html).includes('月光'), false);
    assert.equal(snapshotSearchText(html).includes('月光'), true);
    assert.equal(snapshotSearchText('<p>春 <b>走在雨里</b></p>'), '春 走在雨里');
});

test('character cards index snapshot body, notes and tags for search', async () => {
    const { createCoordinateRenderer } = await import('./render.js');
    let html = '';
    const renderer = createCoordinateRenderer({
        repository: {
            listByChat: async () => [{
                charName: '春', chatName: '聊天', chatId: 'c1', latestTs: 1, count: 1,
                items: [{ id: '1', charName: '春', chatName: '聊天', textPreview: '预览开头', searchText: '预览开头 后面才出现的月光', note: '冷色备注', tags: ['sweet'], ts: 1, floorIndex: 3 }],
            }],
            getTags: async () => [{ id: 'sweet', name: '甜' }],
            countItems: async () => 1,
        },
        excerptRepo: { count: async () => 0 },
        setBody: next => { html = next; },
        getState: () => ({ level: 'chars', shelf: 'snaps', browse: 'char', snapSearch: '', filter: null }),
    });
    await renderer.chars();
    assert.match(html, /data-search="[^"]*月光/);
    assert.match(html, /data-search="[^"]*冷色备注/);
    assert.match(html, /data-search="[^"]*甜/);
    assert.match(html, /data-search="[^"]*春/);
});

test('search box is not a shelf tab', async () => {
    const { createCoordinateRenderer } = await import('./render.js');
    let html = '';
    const renderer = createCoordinateRenderer({
        repository: { listByChat: async () => [], getTags: async () => [], countItems: async () => 0 },
        excerptRepo: { count: async () => 0 },
        setBody: next => { html = next; },
        getState: () => ({ level: 'chars', shelf: 'snaps', browse: 'char', snapSearch: '', filter: null }),
    });
    await renderer.chars();
    assert.match(html, /class="sp-anchor-search[^"]*"[^>]*data-search-shelf="snaps"/);
    assert.equal(/<input[^>]*\sdata-shelf=/.test(html), false);
    assert.match(html, /class="sp-anchor-shelf-tab[^"]*"[^>]*data-shelf="snaps"/);
});

test('snapshot notes and search text stay in the index meta', async () => {
    const { normalizeMeta } = await import('./schema.js');
    const meta = normalizeMeta({ id: 'x', textPreview: '正文', note: '  这是备注  ', searchText: '  正文 后面还有月光  ' });
    assert.equal(meta.note, '这是备注');
    assert.equal(meta.searchText, '正文 后面还有月光');
    assert.equal(meta.kind, '');
    const theater = normalizeMeta({ id: 't', kind: 'theater', note: '番外' });
    assert.equal(theater.kind, 'theater');
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
    const saved = await repo.add({ quote: '选中的一句', note: '点评', charName: '春', snapshotId: 'snap-1', tags: ['sweet'] });
    assert.equal(saved.quote, '选中的一句');
    assert.deepEqual(saved.tags, ['sweet']);
    assert.equal(await repo.count(), 1);
    const listed = await repo.list();
    assert.equal(listed[0].snapshotId, 'snap-1');
    assert.equal(await repo.stripTag('sweet'), 1);
    assert.deepEqual((await repo.get(saved.id)).tags, []);
    await repo.remove(saved.id);
    assert.equal(await repo.count(), 0);
});
