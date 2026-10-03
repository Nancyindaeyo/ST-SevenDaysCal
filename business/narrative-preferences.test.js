import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt as buildPointPrompt } from './point/prompt.js';
import { buildLinesPrompt } from './lines/prompt.js';
import { buildLinesInjection } from './lines/strategy.js';
import { createLinesInjectionController } from './lines/injection.js';
import { buildOutlineCreationContract, buildOutlineInjectionText, buildOutlineJudgePrompt, buildOutlinePrompt } from './outline/prompts.js';
import { createOutlineInjection } from './outline/injection.js';
import { buildSpaceChatSystemPrompt } from './space/prompts.js';
import { buildCreativeChatSystemPrompt } from '../state.js';

const scales = ['auto', 'macro', 'meso', 'micro'];
const preferences = scale => ({ scale, direction: 'tragic' });

test('every narrative scale reaches point, line, outline, outline chat, and outline injection prompts', () => {
    for (const scale of scales) {
        const prefs = preferences(scale);
        const point = buildPointPrompt('用户', '角色', 'user', null, null, null, prefs);
        const line = buildLinesPrompt('用户', '角色', 'user', '', scale, {}, 'off', 'tragic');
        const outline = buildOutlinePrompt('用户', '角色', 'user', prefs);
        const chat = buildCreativeChatSystemPrompt({ userName: '用户', charName: '角色', preferences: prefs });
        const injection = buildOutlineInjectionText([{ title: '当前', scene: '现状' }, { title: '后续', scene: '方向' }], 1, undefined, prefs);
        for (const prompt of [point, line, outline, chat, injection]) {
            assert.match(prompt, new RegExp(`叙事尺度·观察焦点】.*${scale === 'auto' ? '自动' : scale === 'macro' ? '宏观' : scale === 'meso' ? '中观' : '微观'}`));
            assert.match(prompt, /悲剧倾向/);
            assert.match(prompt, /不得扭曲既有事实/);
            assert.match(prompt, /不决定冲突强度或故事时间速度/);
        }
    }
});

test('meso names organization and group level, while outline remains stage based', () => {
    const meso = buildOutlineCreationContract(preferences('meso'));
    assert.match(meso, /中观：观察已有组织、家族、职场、学派或群体/);
    assert.match(meso, /长线阶段大纲/);
    assert.match(meso, /不是凭空增加冲突、阴谋或灾难的理由/);
    assert.doesNotMatch(meso, /数周至数月/);
});

test('space adds preferences only to point and line creation, not calendar or ordinary discussion', () => {
    const base = { userName: '用户', charName: '角色', preferences: preferences('meso') };
    const point = buildSpaceChatSystemPrompt({ ...base, intent: { action: 'write', kind: 'schedule_widget' } });
    const line = buildSpaceChatSystemPrompt({ ...base, intent: { action: 'write', kind: 'line_widget' } });
    const almanac = buildSpaceChatSystemPrompt({ ...base, intent: { action: 'write', kind: 'almanac_widget' } });
    const discussion = buildSpaceChatSystemPrompt({ ...base, intent: { action: 'discuss', kind: null } });
    assert.match(point, /叙事尺度·观察焦点/);
    assert.match(line, /叙事尺度·观察焦点/);
    assert.doesNotMatch(almanac, /叙事尺度·观察焦点|剧情倾向·优先级/);
    assert.doesNotMatch(discussion, /叙事尺度·观察焦点|剧情倾向·优先级/);
});

test('outline mechanical judge remains independent of narrative preferences', () => {
    const prompt = buildOutlineJudgePrompt('当前阶段', '下一阶段', '', '');
    assert.doesNotMatch(prompt, /叙事尺度|剧情倾向/);
});

test('semantic-route keeps preferences inside card contracts and tells discussion not to adopt them', () => {
    const routed = buildSpaceChatSystemPrompt({
        userName: '用户',
        charName: '角色',
        preferences: preferences('meso'),
        intent: { action: 'semantic-route' },
    });
    assert.match(routed, /若你选择普通讨论或解释/);
    assert.match(routed, /不要把偏好当作回答立场/);
    assert.match(routed, /历／历法卡片与刻度内容不套用这些偏好/);
    assert.match(routed, /中观：观察已有组织/);
});

test('outline hidden injection refreshes preferences only while injection stays enabled', () => {
    let enabled = true;
    let prefs = preferences('meso');
    const injected = [];
    const ctx = { setExtensionPrompt: (_key, text) => injected.push(text) };
    const target = {};
    const repository = {
        capture: () => target,
        isCurrent: candidate => candidate === target,
        readOutline: () => ({ raw: '<outline_widget>Beat: 当下|当前|阶段|主线|继续\nScene: 组织内部协作\nSubtext: 题记\nThink: 阶段缘由</outline_widget>' }),
        cursor: () => 1,
    };
    const injection = createOutlineInjection({
        repository,
        context: () => ctx,
        settings: () => ({ outlineInject: enabled }),
        injectEnabled: () => true,
        preferences: () => prefs,
    });
    injection.refresh();
    assert.match(injected.at(-1), /中观：观察已有组织/);
    prefs = preferences('micro');
    injection.refresh();
    assert.match(injected.at(-1), /微观：观察人物当下的行动/);
    enabled = false;
    injection.refresh();
    assert.equal(injected.at(-1), '');
});

test('line hidden injection carries scale with direction and respects its switch', () => {
    let prefs = preferences('macro');
    let enabled = true;
    const injected = [];
    const ctx = { setExtensionPrompt: (_key, text) => injected.push(text) };
    const controller = createLinesInjectionController({
        context: () => ctx,
        settings: () => ({ linesEnabled: true, linesInject: enabled }),
        enabled: () => true,
        readRaw: () => '<storylines_widget>\nLine: 当前线|延展|近日|world|false|false\nDesc: 既有背景\nNext: 下一步\n</storylines_widget>',
        lineDirection: () => prefs.direction,
        scale: () => prefs.scale,
    });
    controller.refresh();
    assert.match(injected.at(-1), /宏观：观察已有势力/);
    assert.match(injected.at(-1), /悲剧倾向/);
    prefs = preferences('meso');
    controller.refresh();
    assert.match(injected.at(-1), /中观：观察已有组织/);
    enabled = false;
    controller.refresh();
    assert.equal(injected.at(-1), '');
    assert.match(buildLinesInjection([{ name: '旧线', stage: '延展', when: '近日', desc: 'd', next: 'n' }], { lineDirection: 'positive', scale: 'micro' }), /温暖向好/);
    assert.match(buildLinesInjection([{ name: '旧线', stage: '延展', when: '近日', desc: 'd', next: 'n' }], { lineDirection: 'positive', scale: 'micro' }), /微观：观察人物当下的行动/);
});
