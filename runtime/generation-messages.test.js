import test from 'node:test';
import assert from 'node:assert/strict';
import {
    almanacLibraryBlock,
    assembleGenerationMessages,
    calendarLibraryBlock,
    ledgerSourceHistory,
    mapVisibleHistoryMessage,
    memoryLibraryBlock,
    observerSystemPrompt,
    readCardExtras,
} from './generation-messages.js';

test('memory library block tags the point view only when asked', () => {
    assert.equal(memoryLibraryBlock(''), '');
    assert.match(memoryLibraryBlock('摘要', { pointView: 'char', charName: 'Alice' }), /Alice/);
    assert.match(memoryLibraryBlock('摘要', { pointView: 'user', userName: 'Bob' }), /Bob/);
    assert.match(memoryLibraryBlock('摘要'), /不继承点的 TA 视角/);
});

test('observer system prompt drops empty extras and keeps author note', () => {
    const sys = observerSystemPrompt({
        userName: '我',
        charName: '她',
        personaDesc: '人设',
        character: { description: '背景', personality: '温', scenario: '城' },
        authorNote: '注释',
        extraBlocks: ['【世界书】x', ''],
    });
    assert.match(sys, /旁观者和叙事分析助手/);
    assert.match(sys, /我 的人物设定/);
    assert.match(sys, /作者注释/);
    assert.match(sys, /【世界书】x/);
    assert.equal(almanacLibraryBlock(''), '');
    assert.match(almanacLibraryBlock('春节'), /近期将至/);
    assert.match(calendarLibraryBlock('三月纪'), /不要默认套用公历/);
});

test('history mapping and ledger floors keep generation roles', () => {
    assert.deepEqual(mapVisibleHistoryMessage({ is_user: true, mes: '{{user}}好' }, {
        substituteParams: text => text.replace('{{user}}', '我'),
        sanitize: text => text.trim(),
    }), { role: 'user', content: '我好' });
    const ledger = ledgerSourceHistory([{ floor: 3, content: '正文', sources: [{ token: 'SDC', stamp: '1-1' }] }]);
    assert.match(ledger[0].content, /楼层 3/);
    assert.equal(assembleGenerationMessages({ system: 's', history: [{ role: 'assistant', content: 'h' }], prompt: 'p' })[2].content, 'p');
    assert.deepEqual(readCardExtras({
        substituteParams: s => `x:${s}`,
        powerUserSettings: { persona_description: 'p' },
        chatMetadata: { note_prompt: 'n' },
    }), { personaDesc: 'x:p', authorNote: 'x:n' });
});
