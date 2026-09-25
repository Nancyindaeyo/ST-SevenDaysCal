// 记忆分组纯函数：最新组延迟总结、清洗后为空判定。不碰宿主、不写账。

export function collectStableGroups(floors = [], groupSize = 5) {
    const N = Math.max(1, Number(groupSize) || 5);
    const list = Array.isArray(floors) ? floors : [];
    const groups = [];
    for (let i = 0; i + N <= list.length; i += N) {
        const slice = list.slice(i, i + N);
        groups.push({
            key: `${slice[0].mesid}-${slice[slice.length - 1].mesid}`,
            floors: slice,
        });
    }
    // 最新一组（含当前最新 AI 楼）故意不总结，等后面再来一楼，避免重 roll 白烧。
    if (groups.length && list.length && groups[groups.length - 1].floors.slice(-1)[0].mesid === list[list.length - 1].mesid) {
        groups.pop();
    }
    return groups;
}

export function isStrippedEmptyGroup(group) {
    const floors = group?.floors || [];
    if (!floors.length) return false;
    let rawTotal = 0;
    let netTotal = 0;
    for (const floor of floors) {
        rawTotal += Number(floor.rawLen) || 0;
        netTotal += String(floor.text || '').replace(/\s+/g, '').length;
    }
    return rawTotal >= floors.length * 40 && netTotal < 20;
}
