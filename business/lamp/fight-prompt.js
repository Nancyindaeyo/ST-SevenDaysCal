export function buildFightAddon(intent = {}) {
    const items = Array.isArray(intent.items) ? intent.items : [];
    const rows = items.map(item => {
        const change = String(item.change || '').trim();
        return `- ${item.module}「${item.title}」${change ? ` → ${change}` : ''}`;
    }).filter(Boolean);
    const parts = [
        '【本次是打架补丁，不是按正文整表对齐，也不是整本重做】',
        '只改下面点名的未锁条目。没点名的一律保留。锁定条目默认不动。',
        '一天行程里出现多个地点不是打架，不要收成同一个地点。',
        '面最多改当前节点，禁止全部替换。轴只改点名的节日/纪念日文案或日期，禁止重铺一年。',
        '柏宝书只是对照原文，不要改对方，也不要编造柏宝书没有的现状。',
    ];
    if (rows.length) parts.push('【要改的条目】\n' + rows.join('\n'));
    const avoid = String(intent.avoid || '').trim();
    if (avoid) parts.push('【不要动】\n' + avoid);
    const reason = String(intent.reason || intent.text || '').trim();
    if (reason) parts.push('【间或作者的依据】\n' + reason);
    return parts.join('\n\n');
}

export function buildFightPrompt({
    userName = '用户',
    charName = '角色',
    latestStory = '',
    pointRaw = '',
    linesRaw = '',
    ledgerText = '',
    almanacText = '',
    dashedText = '',
    outlineRaw = '',
    intent = {},
} = {}) {
    return `请暂停角色扮演，作为账本对账助手，只修正【要改的条目】里点名的打架项。
不要重写整张表。不要用「跟最新正文对齐」那套去改没点名的日程或平行事件。

【人物】${userName} / ${charName}

【最新 AI 楼正文】
${String(latestStory || '').trim() || '（没有正文）'}

【当前点】
${String(pointRaw || '').trim() || '（空）'}

【当前线】
${String(linesRaw || '').trim() || '（空）'}

【当前刻度】
${String(ledgerText || '').trim() || '（空）'}

【当前轴】
${String(almanacText || '').trim() || '（空）'}

【当前冷知识】
${String(dashedText || '').trim() || '（空）'}

【当前面】
${String(outlineRaw || '').trim() || '（空）'}

${buildFightAddon(intent)}

只输出：
<fight_patch>
note: 一句中文说明改了什么；若点名项已经一致写「没有打架」
point: complete|标题
point: postpone|标题|Day 3|新时间
point: edit|标题|新描述
point: meta|标题|时间|地点
point: add|Day 1|main|标题|描述|时间|地点|线头动态
line: complete|名称
line: add|名称|起线|今天|world|描述|下一步
line: stall|名称
line: edit|名称|新描述|新下一步
ledger: edit|事由|新现状
almanac: edit|名称|新说明
dashed: edit|开头或标题|新正文
outline: edit|节点标题|新场景
</fight_patch>
没有改动时仍输出 note，不要空回复。不要输出 HTML。不要输出 <reconcile_patch>。`;
}
