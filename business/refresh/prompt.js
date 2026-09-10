export function buildRefreshAddon({ reason = '', feedback = '', align = false, todayGap = 0 } = {}) {
    const parts = [];
    if (align) {
        const fill = Number(todayGap) > 0
            ? `今天（Day 1）还空 ${Number(todayGap)} 个名额。只要最新正文看得出当天还有未记账的安排、余波或下一段，就必须用 point: add|Day 1|... 补上；不得把已经不在账上的旧标题再加回来。正文确实没有当天下一段时，note 写「今天已空，正文没有下一段」，不要硬编。后面两天不要为凑数补。`
            : '今天名额已满或没有当天格子。证据不够就不要新建。没偏则原样保留。';
        parts.push(`【本次是纠偏补丁，不是整表洗牌】只改与最新正文冲突的未锁条目：已发生则从今天拿掉；推迟则挪走或暂缓；换路径则改描述留标题。${fill}线的 complete 是收束，不是当场删除；每收束一条未锁线，必须同时 line: add 一条非终态新线顶上，有正文依据，不得把旧标题加回来。锁定标题默认不动，除非用户反馈点名。`);
    } else {
        parts.push('【本次按用户要求重做勾选模块】未锁条目可以推倒重来；锁定标题仍须保留。');
    }
    const why = String(reason || '').trim();
    const wrong = String(feedback || '').trim();
    if (why) parts.push(`【为什么刷新】\n${why}`);
    if (wrong) parts.push(`【上次哪些设定可能写错了，新结果必须避开或改掉，不要沿用】\n${wrong}`);
    return parts.join('\n\n');
}

export function buildReconcilePrompt({ userName, charName, latestStory, pointRaw, linesRaw, reason = '', feedback = '', promptAddon = '', todayGap = 0 } = {}) {
    const extra = String(promptAddon || '').trim();
    return `请暂停角色扮演，作为账本校对助手，根据【最新 AI 楼正文】给点（日程）和线（平行事件）打纠偏补丁。
不要重写整张表。锁定条目（pin=true / 锁定）默认不动，除非用户反馈点名。

【人物】${userName} / ${charName}

【最新 AI 楼正文】
${String(latestStory || '').trim() || '（没有正文）'}

【当前点】
${String(pointRaw || '').trim() || '（空）'}

【当前线】
${String(linesRaw || '').trim() || '（空）'}

${buildRefreshAddon({ reason, feedback, align: true, todayGap })}${extra ? `\n\n${extra}` : ''}

只输出：
<reconcile_patch>
note: 一句中文说明改了什么；若没偏写「与正文一致」
point: complete|标题
point: postpone|标题|Day 3|新时间
point: edit|标题|新描述
point: stall|标题
point: add|Day 1|main|标题|描述|时间|地点|线头动态
line: complete|名称
line: add|名称|起线|今天|world|描述|下一步
line: stall|名称
line: edit|名称|新描述|新下一步
</reconcile_patch>
没有改动时仍输出 note，不要空回复。不要输出 HTML。`;
}
