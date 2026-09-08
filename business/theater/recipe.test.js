import test from 'node:test';
import assert from 'node:assert/strict';
import { isTheaterHeaderEntry, stripTheaterRecipe, drawTheaterRecipes, drawTheaterRecipesAcrossBooks, normalizeTheaterCount } from './recipe.js';
import { parseTheaterPieces } from './pieces.js';
import { buildTheaterExportBook, likedTheaterPieces } from './export-book.js';
import { buildWriteMessages } from './prompts.js';
import { THEATER_WORLD_INFO_SCOPES } from './context.js';
import { createTheaterPool } from './pool.js';

test('header entries are the 必开/头/尾 rows, not lottery types', () => {
    assert.equal(isTheaterHeaderEntry('使用必开（头）'), true);
    assert.equal(isTheaterHeaderEntry('使用必开（尾）'), true);
    assert.equal(isTheaterHeaderEntry('回望（我喜欢这个）'), false);
    assert.equal(isTheaterHeaderEntry('完全随机'), false);
});

test('strip drops snow/html/js/word-count and keeps the playable premise', () => {
    const snow = stripTheaterRecipe('<snow小剧场要求>\n- 每次正文结束后生成**仅一个**小剧场。\n- 禁止使用 HTML / CSS；需适合手机阅读。\n- 所有内容需包裹在 <snow> 标签中。\n格式：\n<snow>\n<details><summary>回 · 标题</summary>\n</details>\n</snow>');
    assert.equal(snow.includes('<snow>'), false);
    assert.equal(/正文结束后/.test(snow), false);
    const aurora = stripTheaterRecipe('这是相性问答装置。\n全文使用 HTML 与 CSS 美化排版并适配移动端。\n<script>alert(1)</script>\n角色在装置里互相提问，禁止 OOC。');
    assert.match(aurora, /相性问答|互相提问|禁止 OOC/);
    assert.equal(/HTML|script/i.test(aurora), false);
    const rabbit = stripTheaterRecipe('日常的某天世界规则被改写成扇耳光决斗。\n要求：请完整描写这个故事，正文需达到6000字以上\n全文使用 HTML 与 CSS 美化排版并适配移动端。严禁低对比度配色。');
    assert.match(rabbit, /扇耳光/);
    assert.equal(/6000/.test(rabbit), false);
    assert.equal(/HTML/.test(rabbit), false);
});

test('group lottery draws distinct groups and skips empty shells', () => {
    const entries = [
        { uid: 0, comment: '使用必开（头）', content: '禁止和之前的小剧场内容相似或重复。\n禁止使用 HTML / CSS', group: '', constant: true },
        { uid: 1, comment: '回望', content: '[回望剧场]: 回顾正文。', group: '1', groupWeight: 100 },
        { uid: 2, comment: '一百问', content: '[一百问]: 互相提问。', group: '1', groupWeight: 100 },
        { uid: 3, comment: '空壳', content: '<style>.x{}</style>', group: '2' },
        { uid: 4, comment: '日记', content: '用日记体写今天。', group: '2' },
    ];
    const drawn = drawTheaterRecipes(entries, 2, { random: () => 0 });
    assert.equal(drawn.headers.length, 1);
    assert.ok(drawn.recipes.length >= 1);
    assert.ok(drawn.recipes.every(item => item.title !== '空壳'));
    assert.ok(drawn.recipes.every(item => item.title !== '使用必开（头）'));
});

test('count clamps to 1–3', () => {
    assert.equal(normalizeTheaterCount(0), 2);
    assert.equal(normalizeTheaterCount(4), 2);
    assert.equal(normalizeTheaterCount(3), 3);
    assert.equal(normalizeTheaterCount('2'), 2);
});

test('parseTheaterPieces reads tagged blocks and falls back to one blob', () => {
    const tagged = parseTheaterPieces('<theater_piece><title>回望</title><form_name>回望</form_name><body>第一段番外</body></theater_piece>\n<theater_piece><title>问答</title><body>第二段番外</body></theater_piece>', { makeId: (() => { let n = 0; return () => `id-${++n}`; }) });
    assert.equal(tagged.length, 2);
    assert.equal(tagged[0].title, '回望');
    assert.equal(tagged[1].raw, '第二段番外');
    const plain = parseTheaterPieces('没有标签的一整篇', { makeId: () => 'x' });
    assert.equal(plain.length, 1);
    assert.equal(plain[0].raw, '没有标签的一整篇');
});

test('export book splits liked pieces into 展现形式 and 主题', () => {
    const book = buildTheaterExportBook([
        { liked: true, formName: '相性100问', formSeed: '二十问，口吻直白。', themeName: '体检前夜', themeSeed: '亲密而紧张。', raw: '成品不要贴进去' },
        { liked: false, formName: '忽略', raw: 'x' },
    ]);
    const comments = Object.values(book.entries).map(entry => entry.comment);
    assert.deepEqual(comments, ['展现形式｜相性100问', '主题｜体检前夜']);
    assert.equal(Object.values(book.entries)[0].content.includes('成品不要贴进去'), false);
    assert.equal(likedTheaterPieces([[{ liked: true, raw: 'a' }, { liked: false, raw: 'b' }]]).length, 1);
});

test('cross-book lottery draws N entries and keeps unused books off the prompt', () => {
    const books = [
        { name: '小回', entries: [
            { uid: 0, comment: '使用必开（头）', content: '禁 HTML' },
            { uid: 1, comment: '回望', content: '回顾正文。', group: '1' },
            { uid: 11, comment: '一百问', content: '互相提问。', group: '1' },
            { uid: 12, comment: '日记', content: '写今天。', group: '2' },
        ] },
        { name: '极光', entries: [
            { uid: 2, comment: '使用必开（尾）', content: '禁重复' },
            { uid: 3, comment: '装置', content: '角色在装置里提问。', group: 'a' },
        ] },
        { name: '小兔', entries: [
            { uid: 4, comment: 'IF', content: '世界规则改写成决斗。' },
        ] },
    ];
    const three = drawTheaterRecipesAcrossBooks(books, 3, { random: () => 0 });
    assert.equal(three.recipes.length, 3);
    assert.deepEqual([...new Set(three.recipes.map(item => item.bookName))].sort(), ['小兔', '小回', '极光'].sort());
    assert.equal(three.recipes.some(item => /必开/.test(item.title)), false);
    const two = drawTheaterRecipesAcrossBooks(books, 2, { random: () => 0 });
    assert.equal(two.recipes.length, 2);
    assert.equal(new Set(two.recipes.map(item => item.bookName)).size, 2);
    const used = new Set(two.recipes.map(item => item.bookName));
    const prompt = buildWriteMessages('', { userName: '我', charName: '他', sysBlocks: ['【角色世界书】角色设定'] }, {}, two).map(m => m.content).join('\n');
    assert.match(prompt, /角色设定/);
    assert.equal(prompt.includes('世界规则改写成决斗'), used.has('小兔'));
    assert.equal(prompt.includes('角色在装置里提问'), used.has('极光'));
    const one = drawTheaterRecipesAcrossBooks(books, 1, { random: () => 0 });
    assert.equal(one.recipes.length, 1);
    assert.ok(one.headers.every(item => item.bookName === one.recipes[0].bookName));
    assert.equal(one.headers.some(item => item.bookName !== one.recipes[0].bookName), false);
    const onePrompt = buildWriteMessages('', { sysBlocks: [] }, {}, one)[0].content;
    assert.equal(onePrompt.includes('世界规则改写成决斗'), false);
    assert.equal(onePrompt.includes('角色在装置里提问'), false);
});

test('pool loads every selected book then draws N, not the first book only', async () => {
    const loaded = [];
    const pool = createTheaterPool({
        loadWorldInfo: async name => {
            loaded.push(name);
            return { entries: [{ uid: 1, comment: name, content: `${name}条目正文` }] };
        },
    });
    const drawn = await pool.draw({ books: ['小回', '极光', '小兔'], count: 3, random: () => 0 });
    assert.deepEqual(loaded, ['小回', '极光', '小兔']);
    assert.equal(drawn.recipes.length, 3);
    assert.deepEqual(drawn.recipes.map(item => item.bookName).sort(), ['小兔', '小回', '极光'].sort());
});

test('write prompt forbids HTML and asks for N theater_piece blocks', () => {
    const messages = buildWriteMessages('想看回望', { userName: '我', charName: '他', sysBlocks: [] }, {}, {
        count: 2,
        recipes: [
            { title: '回望', stripped: '回顾正文' },
            { title: '问卷', stripped: '问卷正文' },
        ],
    });
    assert.match(messages[0].content, /禁止输出 HTML/);
    assert.match(messages[0].content, /theater_piece/);
    assert.match(messages[0].content, /一次写出 2 条/);
    assert.match(messages[0].content, /第 1 个 theater_piece 必须按抽签 1 写/);
    assert.equal(messages[0].content.includes('自行想'), false);
});

test('theater background world info is character books only', () => {
    assert.deepEqual([...THEATER_WORLD_INFO_SCOPES], ['char']);
    assert.equal(THEATER_WORLD_INFO_SCOPES.includes('global'), false);
    assert.equal(THEATER_WORLD_INFO_SCOPES.includes('persona'), false);
});
