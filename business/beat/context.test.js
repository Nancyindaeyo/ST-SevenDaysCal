import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collectBeatLedgerContext, createBeatContextCollector, formatBeatOutlineNode } from './context.js';

test('outline node follows the 1-based cursor and keeps empty beats blank', () => {
    assert.equal(formatBeatOutlineNode(null), '');
    assert.equal(formatBeatOutlineNode({ time: '傍晚', title: '入学', scene: '校门' }), '傍晚·《入学》\n校门');
    assert.equal(collectBeatLedgerContext({
        readOutlineSnapshot: () => ({
            beats: [
                { title: '旧节点' },
                { time: '午后', title: '体检', scene: '医务室' },
            ],
            cursor: 2,
        }),
    }).outlineNode, '午后·《体检》\n医务室');
    assert.equal(collectBeatLedgerContext({
        readOutlineSnapshot: () => ({ beats: [{ title: '入学' }], cursor: 0 }),
    }).outlineNode, '');
});

test('collect reads point/lines/space/story without merging stage or lamp', async () => {
    const history = Array.from({ length: 10 }, (_, index) => ({
        role: index % 2 ? 'assistant' : 'user',
        content: `第${index}条`,
    }));
    const collected = collectBeatLedgerContext({
        getContext: () => ({ name1: '甲', name2: '乙' }),
        readPointRaw: () => '点raw',
        readLinesRaw: () => '线raw',
        readOutlineRaw: () => '面raw',
        readSpaceHistory: () => history,
        spacePlainText: message => message.content,
        readLatestStory: () => '刚落地的正文',
    });
    assert.deepEqual({
        userName: collected.userName,
        charName: collected.charName,
        pointRaw: collected.pointRaw,
        linesRaw: collected.linesRaw,
        outlineRaw: collected.outlineRaw,
        latestStory: collected.latestStory,
    }, {
        userName: '甲',
        charName: '乙',
        pointRaw: '点raw',
        linesRaw: '线raw',
        outlineRaw: '面raw',
        latestStory: '刚落地的正文',
    });
    assert.match(collected.spaceRecent, /^作者：第2条\n顾问：第3条/);
    assert.match(collected.spaceRecent, /顾问：第9条$/);
    assert.equal(collected.spaceRecent.includes('第0条'), false);
    assert.equal(collected.spaceRecent.includes('第1条'), false);

    const host = createBeatContextCollector({
        getContext: () => ({}),
        readPointRaw: () => 'live',
    });
    assert.equal(host.collect().userName, '用户');
    assert.equal(host.collect().charName, '角色');
    assert.equal(host.collect().pointRaw, 'live');

    const source = await readFile(new URL('./context.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /stage\/host|lamp\/host|collectStageSnapshot/);
});
