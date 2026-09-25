import test from 'node:test';
import assert from 'node:assert/strict';
import { LINE_DIRECTION_VALUES, lineDirectionContract, lineDirectionForCharacter, normalizeLineDirection } from './direction.js';
import { buildLinesPrompt } from './prompt.js';
import { buildLinesInjection } from './strategy.js';
import { createLinesInjectionController } from './injection.js';
import { adultModeForCharacter } from './adult.js';

test('unknown direction falls back to natural and stays per character', () => {
    assert.deepEqual(LINE_DIRECTION_VALUES, ['natural', 'positive', 'conflict', 'tragic']);
    assert.equal(normalizeLineDirection(''), 'natural');
    assert.equal(normalizeLineDirection('chaos'), 'natural');
    assert.equal(lineDirectionForCharacter({}, 'a'), 'natural');
    assert.equal(lineDirectionForCharacter({ lineDirection: { a: 'tragic', b: 'positive' } }, 'a'), 'tragic');
    assert.equal(lineDirectionForCharacter({ lineDirection: { a: 'tragic', b: 'positive' } }, 'b'), 'positive');
    assert.equal(lineDirectionForCharacter({ lineDirection: { a: 'tragic' } }, 'c'), 'natural');
});

test('direction prompt is priority not a forced outcome and can sit with adult mode', () => {
    const natural = buildLinesPrompt('用户', '角色', 'user', '', 'auto', {}, 'off', 'natural');
    const tragic = buildLinesPrompt('用户', '角色', 'user', '', 'auto', {}, 'dominant', 'tragic');
    assert.match(natural, /自然发展/);
    assert.match(natural, /优先级而非强制结果/);
    assert.match(tragic, /悲剧倾向/);
    assert.match(tragic, /不得扭曲既有事实/);
    assert.match(tragic, /成人主导模式/);
    assert.doesNotMatch(tragic, /direction=/);
});

test('injection includes direction when enabled and clears when injection is off', () => {
    const raw = '<storylines_widget>\nLine: 旧线|延展|近日|world|false|false\nDesc: d\nNext: n\n</storylines_widget>';
    assert.match(buildLinesInjection([{ name: '旧线', stage: '延展', when: '近日', desc: 'd', next: 'n' }], { lineDirection: 'positive' }), /温暖向好/);
    const calls = [];
    let inject = true;
    let direction = 'conflict';
    const controller = createLinesInjectionController({
        context: { setExtensionPrompt: (...args) => calls.push(args) },
        enabled: () => true,
        settings: () => ({ linesEnabled: true, linesInject: inject }),
        readRaw: () => raw,
        lineDirection: () => direction,
    });
    controller.refresh();
    assert.match(calls.at(-1)[1], /冲突增强/);
    inject = false;
    controller.refresh();
    assert.equal(calls.at(-1)[1], '');
});

test('adult mode and direction stay independent settings', () => {
    const settings = { adultMode: { a: 'dominant' }, lineDirection: { a: 'positive' } };
    assert.equal(adultModeForCharacter(settings, 'a'), 'dominant');
    assert.equal(lineDirectionForCharacter(settings, 'a'), 'positive');
    assert.equal(lineDirectionContract('positive').includes('强制'), true);
});
