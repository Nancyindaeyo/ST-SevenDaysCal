import test from 'node:test';
import assert from 'node:assert/strict';
import {
    almanacLibraryBlock,
    assembleGenerationMessages,
    baiBaiBookGarnishBlock,
    calendarLibraryBlock,
    createGenerationMessagesHost,
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
    assert.equal(baiBaiBookGarnishBlock(''), '');
    assert.match(baiBaiBookGarnishBlock('【眼下】合宿基地'), /柏宝书当前账/);
    assert.match(baiBaiBookGarnishBlock('【眼下】合宿基地'), /合宿基地/);
    assert.deepEqual(readCardExtras({
        substituteParams: s => `x:${s}`,
        powerUserSettings: { persona_description: 'p' },
        chatMetadata: { note_prompt: 'n' },
    }), { personaDesc: 'x:p', authorNote: 'x:n' });
});

function makeHost(overrides = {}) {
    const calls = [];
    const host = createGenerationMessagesHost({
        settings: () => ({ keepTags: false, extraTags: '' }),
        buildWorldInfoContext: async () => '【世界书】wi',
        getMemText: async opts => { calls.push(['mem', opts.full, opts.query]); return '记忆摘要'; },
        getAlmanacInjectText: () => '春节',
        getCalDescInjectText: () => '三月纪',
        garnish: () => '',
        substituteParams: text => text,
        stripTags: text => text,
        selectVisibleHistory: (messages, limit, { mapMessage }) => {
            calls.push(['history', limit, messages.length]);
            return messages.filter(m => !m.is_user).slice(-limit).map(mapMessage);
        },
        getContext: () => ({ name1: '我', name2: '她' }),
        readOutline: target => { calls.push(['outline', target]); return '大纲原文'; },
        buildRecentChatContext: async () => '【最近对话】近文',
        buildCreativeChatSystemPrompt: args => `creative|${args.userName}|${args.charName}|${args.outlineRaw}|${args.almanacText}|${args.garnish || 'nog'}`,
        ...overrides,
    });
    return { host, calls };
}

const ctx = {
    characters: { 0: { description: '背景' } },
    characterId: 0,
    chat: [
        { is_user: true, mes: '问' },
        { is_user: false, mes: '答' },
    ],
};

test('buildMessages 拼 observer system，近景在 prompt 前，pointView 进记忆块', async () => {
    const { host, calls } = makeHost();
    const messages = await host.buildMessages(ctx, '请排点', '用户', '爱丽丝', 3, { pointView: 'char' });
    assert.equal(messages[0].role, 'system');
    assert.match(messages[0].content, /旁观者和叙事分析助手/);
    assert.match(messages[0].content, /爱丽丝/);
    assert.match(messages[0].content, /春节/);
    assert.match(messages[0].content, /三月纪/);
    assert.match(messages[0].content, /【世界书】wi/);
    assert.equal(messages.at(-1).content, '请排点');
    assert.equal(messages[messages.length - 2].content, '答');
    assert.deepEqual(calls[0], ['mem', undefined, '请排点']);
});

test('historyLimit 0 不喂近景；ledger 楼覆盖近景；noAlmanac 去掉历', async () => {
    const { host, calls } = makeHost();
    const none = await host.buildMessages(ctx, 'p', '用户', '角色', 0);
    assert.equal(none.length, 2);
    assert.equal(none[1].content, 'p');
    assert.ok(!calls.some(c => c[0] === 'history'));

    const ledger = await host.buildMessages(ctx, 'p', '用户', '角色', 3, {
        ledgerSourceFloors: [{ floor: 2, content: '刻度正文', sources: [] }],
    });
    assert.match(ledger[1].content, /楼层 2/);
    assert.equal(ledger[2].content, 'p');

    const noAlm = await host.buildMessages(ctx, 'p', '用户', '角色', 0, { noAlmanac: true });
    assert.doesNotMatch(noAlm[0].content, /春节/);
});

test('reroll 先剥旧 widget；柏宝书 garnish 进 system', async () => {
    const { host } = makeHost({
        getMemText: async () => '前<calendar_widget>旧点</calendar_widget>后',
        garnish: () => '【柏宝书当前账】合宿',
    });
    const messages = await host.buildMessages(ctx, 'p', '用户', '角色', 0, { reroll: true });
    assert.doesNotMatch(messages[0].content, /calendar_widget/);
    assert.match(messages[0].content, /前\s*后/);
    assert.match(messages[0].content, /合宿/);
});

test('composeCreativeChat 不去重快照里的 user turn，再追加本轮 userMsg', async () => {
    const { host, calls } = makeHost({
        garnish: () => '配料',
    });
    const snapshot = [{ role: 'user', content: '上一句' }, { role: 'assistant', content: '回' }];
    const messages = await host.composeCreativeChat({ target: 'latest', userMsg: '再改一节', historySnapshot: snapshot });
    assert.equal(messages[0].content, 'creative|我|她|大纲原文|春节|配料');
    assert.deepEqual(messages.slice(1), [...snapshot, { role: 'user', content: '再改一节' }]);
    assert.deepEqual(calls[0], ['outline', 'latest']);
});
