import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGuideAnswers, parseGuideDrafts, parseGuideInspirations, SPACE_CHAT_STARTERS } from './guide-schema.js';
import { clipGuideLinesRaw, clipGuidePointRaw } from './guide-clip.js';
import { buildGuideDraftPrompt, buildGuideInspirePrompt } from './guide-prompt.js';

test('parse inspirations and drafts', () => {
    const cards = parseGuideInspirations(`<guide_inspire>
Card: 晚饭收口|把体检收成闲聊
Card: 柳路过|调查只露一句
</guide_inspire>`);
    assert.equal(cards.length, 2);
    assert.equal(cards[0].title, '晚饭收口');
    const drafts = parseGuideDrafts(`understand: 你想先把今天的点演完。
<calendar_widget>
Future:
Event: main|晚饭|闲聊|晚|家|
</calendar_widget>
<storylines_widget>
Line: 柳的调查|延展|近日|world|false|false
Desc: 侧写
Next: 路过
</storylines_widget>
<outline_widget>
Beat: 今晚|晚饭|日常|关系|确认请假
Scene: 晚饭
Subtext: 未说出口
Think: 下一拍请假
</outline_widget>`);
    assert.match(drafts.understand, /今天的点/);
    assert.match(drafts.point, /calendar_widget/);
    assert.match(drafts.lines, /柳的调查/);
    assert.match(drafts.outline, /Beat:/);
});

test('guide prompts never ask for theater', () => {
    const inspire = buildGuideInspirePrompt({ pointRaw: '点', latestStory: '晚饭后闲聊' });
    const draft = buildGuideDraftPrompt({ answers: [{ prompt: '节奏', value: '日常' }] });
    assert.match(inspire, /不填棱/);
    assert.match(inspire, /刚落地的正文/);
    assert.match(inspire, /晚饭后闲聊/);
    assert.match(draft, /不问番外/);
    assert.match(draft, /没要求动的模块/);
    assert.equal(formatGuideAnswers([{ prompt: '现在最卡住的是？', value: '下一楼不知道写什么' }]).includes('下一楼'), true);
    assert.equal(SPACE_CHAT_STARTERS.some(item => item.label === '出改账草案'), true);
});

test('guide draft seed and outline pass through unclipped', () => {
    const seed = 'x'.repeat(1800);
    const outline = `Beat: ${'面'.repeat(900)}`;
    const draft = buildGuideDraftPrompt({ seed, outlineRaw: outline, answers: [] });
    const start = draft.indexOf('【作者描述与灵感】');
    const end = draft.indexOf('【问答】');
    assert.ok(start >= 0 && end > start);
    const body = draft.slice(start, end);
    assert.equal(body.includes(seed), true);
    assert.equal(body.includes('\n…'), false);
    assert.equal(draft.includes(outline), true);
});

test('guide point keeps window days and future, drops past days', () => {
    const raw = `<calendar_widget>
StartDate: 2024-05-01
PastDay: 2024-04-30|阴|12℃
Event: main|旧事|已经过了|晚|家||false
Day: 1|5月1日|晴|20℃
Event: main|体检|去医院|上午|医院||false
Day: 2|5月2日
Event: main|回访|再去一趟|下午|医院||false
Day: 3|5月3日
Event: main|休息|在家躺着|全天|家||false
Day: 4|5月4日
Event: main|窗外|不该进窗口|早|街||false
Future:
Event: main|周年|带月日|5月10日 晚|店||false
</calendar_widget>`;
    const clipped = clipGuidePointRaw(raw);
    assert.match(clipped, /StartDate: 2024-05-01/);
    assert.match(clipped, /体检/);
    assert.match(clipped, /回访/);
    assert.match(clipped, /休息/);
    assert.match(clipped, /周年/);
    assert.equal(clipped.includes('旧事'), false);
    assert.equal(clipped.includes('窗外'), false);
    assert.equal(clipped.includes('PastDay'), false);
    assert.equal(clipped.includes('Day: 4'), false);
});

test('guide lines keep complete records instead of cutting by characters', () => {
    const desc = '描'.repeat(1700);
    const raw = `<storylines_widget>
Line: 柳的调查|延展|近日|world|false|false
Desc: ${desc}
Next: 路过
Id: LINE-keep-out
</storylines_widget>`;
    const clipped = clipGuideLinesRaw(raw);
    assert.match(clipped, /柳的调查/);
    assert.equal(clipped.includes(desc), true);
    assert.equal(clipped.includes('LINE-keep-out'), false);
    const draft = buildGuideDraftPrompt({ linesRaw: raw, answers: [] });
    const start = draft.indexOf('【现有线】');
    const end = draft.indexOf('【现有面】');
    assert.ok(start >= 0 && end > start);
    assert.equal(draft.slice(start, end).includes(desc), true);
});
