import { formatGuideAnswers, clipGuideText } from './guide-schema.js';

export function buildGuideInspirePrompt(context = {}) {
    return [
        '请暂停角色扮演。你是局外创作顾问，给作者 3 条互不相同的下一拍灵感。',
        '不问番外，不填棱，不写正文。每条：短标题 + 一句会发生什么、落到什么结果。',
        '',
        '【点】',
        clipGuideText(context.pointRaw) || '（无）',
        '【线】',
        clipGuideText(context.linesRaw) || '（无）',
        '【面当前节点】',
        clipGuideText(context.outlineNode) || '（无）',
        '【刚落地的正文】',
        clipGuideText(context.latestStory, 50000) || '（无）',
        context.avoid ? `【避开】不要再出：${context.avoid}` : '',
        '',
        '只输出：',
        '<guide_inspire>',
        'Card: 短标题|一句具体方向',
        'Card: …',
        '</guide_inspire>',
    ].filter(Boolean).join('\n');
}

export function buildGuideDraftPrompt(context = {}) {
    return [
        '请暂停角色扮演。你是局外创作顾问。先用一段话说明你理解了作者要什么，再给出点/线/面草案。',
        '只收束点（近几天日程）、线（平行事件）、面（长线大纲）。不问番外，不填棱，不代发主楼。',
        '点用完整 <calendar_widget>；线用完整 <storylines_widget>；面用完整 <outline_widget>，每个 Beat 含 Scene / Subtext / Think。',
        '按作者卡住的地方收束：没要求动的模块尽量贴近现有账本，不要无故重写整份面。',
        '没有足够依据的模块可以给很短的草案，但标签还是要有。',
        '',
        '【作者描述与灵感】',
        clipGuideText(context.seed, 800) || '（无）',
        '',
        '【问答】',
        formatGuideAnswers(context.answers),
        context.comment ? `\n【只要重做这一块】模块=${context.comment.module}；意见：${context.comment.text}` : '',
        '',
        '【现有点】',
        clipGuideText(context.pointRaw) || '（无）',
        '【现有线】',
        clipGuideText(context.linesRaw) || '（无）',
        '【现有面】',
        clipGuideText(context.outlineRaw, 2000) || '（无）',
        '【刚落地的正文】',
        clipGuideText(context.latestStory, 50000) || '（无）',
        '',
        '只输出：',
        'understand: 一段理解（不要卡片）',
        '<calendar_widget>…</calendar_widget>',
        '<storylines_widget>…</storylines_widget>',
        '<outline_widget>…</outline_widget>',
    ].filter(Boolean).join('\n');
}
