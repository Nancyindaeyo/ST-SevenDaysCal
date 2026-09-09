import test from 'node:test';
import assert from 'node:assert/strict';
import {
    checkboxTriState,
    excludeCountText,
    groupShouldOpen,
    groupWorldInfoEntries,
    matchesExcludeSearch,
    readDatasetValue,
    snapshotWiGroupOpenState,
    worldInfoPanelIdentity,
} from './world-info-panel.js';

test('world-info panel groups scopes and preserves first-open books', () => {
    const grouped = groupWorldInfoEntries([
        { scope: 'global', source: 'G', key: 'g::1' },
        { scope: 'char', source: 'A', key: 'a::1' },
        { scope: 'char', source: 'A', key: 'a::2' },
        { scope: 'unknown', source: 'U', key: 'u::1' },
    ]);
    assert.equal(grouped.get('char').get('A').length, 2);
    assert.equal(grouped.get('global').get('G').length, 1);
    assert.equal(grouped.get('char').get('U').length, 1);
    const snap = snapshotWiGroupOpenState([
        { source: 'A', open: true },
        { source: 'B', open: false },
    ]);
    assert.equal(groupShouldOpen('A', snap), true);
    assert.equal(groupShouldOpen('B', snap), false);
    assert.equal(groupShouldOpen('C', snap), true);
    assert.equal(groupShouldOpen('A', { hadGroups: false }), true);
});

test('checkbox tri-state and exclude copy stay aligned with the old panel', () => {
    assert.deepEqual(checkboxTriState(3, 3), { checked: true, indeterminate: false });
    assert.deepEqual(checkboxTriState(1, 3), { checked: false, indeterminate: true });
    assert.deepEqual(checkboxTriState(0, 3), { checked: false, indeterminate: false });
    assert.equal(excludeCountText(0, 12), '共 12');
    assert.equal(excludeCountText(2, 12), '已排除 2 / 共 12');
    assert.equal(matchesExcludeSearch('角色卡', ''), true);
    assert.equal(matchesExcludeSearch('角色卡', '角色'), true);
    assert.equal(matchesExcludeSearch('角色卡', '全局'), false);
    assert.equal(
        worldInfoPanelIdentity({ chatId: 'c', characterId: 1 }, 'dog.png'),
        worldInfoPanelIdentity({ chatId: 'c', characterId: 1 }, 'dog.png'),
    );
    assert.notEqual(
        worldInfoPanelIdentity({ chatId: 'c', characterId: 1 }, 'dog.png'),
        worldInfoPanelIdentity({ chatId: 'd', characterId: 1 }, 'dog.png'),
    );
    assert.equal(readDatasetValue({ attr: name => name === 'data-name' ? '0123' : undefined }, 'name'), '0123');
});
