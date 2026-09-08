export function buildRefreshAddon({ reason = '', feedback = '', align = false } = {}) {
    const parts = [];
    if (align) {
        parts.push('【本次是纠偏补丁，不是整表洗牌】只改与最新正文冲突的未锁条目：已发生则从今天拿掉；推迟则挪走或暂缓；换路径则改描述留标题。证据不够就不要新建。没偏则原样保留。锁定标题默认不动，除非用户反馈点名。');
    } else {
        parts.push('【本次按用户要求重做勾选模块】未锁条目可以推倒重来；锁定标题仍须保留。');
    }
    const why = String(reason || '').trim();
    const wrong = String(feedback || '').trim();
    if (why) parts.push(`【为什么刷新】\n${why}`);
    if (wrong) parts.push(`【上次哪些设定可能写错了，新结果必须避开或改掉，不要沿用】\n${wrong}`);
    return parts.join('\n\n');
}

export function buildReconcilePrompt({ userName, charName, latestStory, pointRaw, linesRaw, reason = '', feedback = '' } = {}) {
    return `请暂停角色扮演，作为账本校对助手，根据【最新 AI 楼正文】给点（日程）和线（平行事件）打纠偏补丁。
不要重写整张表。锁定条目（pin=true / 锁定）默认不动，除非用户反馈点名。

【人物】${userName} / ${charName}

【最新 AI 楼正文】
${String(latestStory || '').trim() || '（没有正文）'}

【当前点】
${String(pointRaw || '').trim() || '（空）'}

【当前线】
${String(linesRaw || '').trim() || '（空）'}

${buildRefreshAddon({ reason, feedback, align: true })}

只输出：
<reconcile_patch>
note: 一句中文说明改了什么；若没偏写「与正文一致」
point: complete|标题
point: postpone|标题|Day 3|新时间
point: edit|标题|新描述
point: stall|标题
point: add|Day 1|main|标题|描述|时间|地点|线头动态
line: complete|名称
line: stall|名称
line: edit|名称|新描述|新下一步
</reconcile_patch>
没有改动时仍输出 note，不要空回复。不要输出 HTML。`;
}
