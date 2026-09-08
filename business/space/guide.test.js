import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGuideAnswers, parseGuideDrafts, parseGuideInspirations } from './guide-schema.js';
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
    const inspire = buildGuideInspirePrompt({ pointRaw: '点' });
    const draft = buildGuideDraftPrompt({ answers: [{ prompt: '节奏', value: '日常' }] });
    assert.match(inspire, /不填棱/);
    assert.match(draft, /不问番外/);
    assert.equal(formatGuideAnswers([{ prompt: '节奏', value: '日常' }]).includes('日常'), true);
});
