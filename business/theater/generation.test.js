import test from 'node:test';
import assert from 'node:assert/strict';
import { createTheaterGeneration } from './generation.js';
import { buildWriteMessages } from './prompts.js';

test('continue generation stamps parent id and does not redraw a multi-face batch', async () => {
    const stages = [];
    const generate = createTheaterGeneration({
        write: async messages => {
            const text = messages.map(m => m.content).join('\n');
            assert.match(text, /他们站在门口/);
            assert.match(text, /他们出门/);
            assert.equal(/data-face="2"/.test(text), false);
            return '<theater data-face="1">【续】下一段</theater>';
        },
        buildWriteMessages,
        makeId: (() => { let n = 0; return () => `id-${++n}`; })(),
    });
    const result = await generate('他们出门', {
        continueFrom: { id: 'p1', title: '回望', raw: '他们站在门口。' },
        onStage: text => stages.push(text),
        settings: { theaterCount: 3 },
    });
    assert.deepEqual(stages, ['续写']);
    assert.equal(result.pieces.length, 1);
    assert.equal(result.pieces[0].continuedFrom, 'p1');
    assert.equal(result.pieces[0].continueSource.raw, '他们站在门口。');
    assert.match(result.pieces[0].raw, /下一段/);
});
