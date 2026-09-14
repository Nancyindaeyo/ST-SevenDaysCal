import test from 'node:test';
import assert from 'node:assert/strict';
import { selectVisibleChatHistory } from './history.js';

test('skips hidden, system, empty and user floors, then keeps the last N AI replies', () => {
    const messages = [
        { is_user: true, mes: '玩家' },
        { mes: '一' },
        { is_system: true, mes: '系统' },
        { is_hidden: true, mes: '隐藏' },
        { extra: { is_hidden: true }, mes: '也隐藏' },
        { mes: '   ' },
        { mes: '二' },
        { mes: '三' },
        { role: 'system', mes: '角色系统' },
        { mes: '四' },
    ];
    assert.deepEqual(selectVisibleChatHistory(messages, 2).map(m => m.mes), ['三', '四']);
    assert.deepEqual(selectVisibleChatHistory(messages, 6).map(m => m.mes), ['一', '二', '三', '四']);
});

test('Infinity still returns only visible AI floors', () => {
    const messages = [{ is_hidden: true, mes: '藏' }, { mes: '可见' }];
    assert.deepEqual(selectVisibleChatHistory(messages, Infinity).map(m => m.mes), ['可见']);
});
