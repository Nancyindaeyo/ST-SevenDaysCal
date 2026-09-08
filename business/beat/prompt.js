import { BEAT_ANGLES } from './schema.js';

const ANGLE_HINT = {
    today: '演完今天的点，落到一个可写进下一楼的具体结果',
    line: '让一条现有平行事件从侧面进来，不要整段爆发',
    date: '用外部日期、节日或期限施加压力，不要另起无关主线',
    daily: '纯日常、不推进大事件，但仍要落到一个小结果',
    space: '顺着间里刚说的方向；若间没有方向，则换路径、仍留面当前节点的结果',
};

function clip(text, limit = 1800) {
    const value = String(text || '').trim();
    return value.length > limit ? `${value.slice(0, limit)}\n…` : value;
}

export function buildBeatPrompt(context = {}) {
    const userName = context.userName || '用户';
    const charName = context.charName || '角色';
    const hasSpace = String(context.spaceRecent || '').trim();
    const angles = BEAT_ANGLES.map(angle => {
        const hint = angle === 'space' && !hasSpace
            ? ANGLE_HINT.space.replace('顺着间里刚说的方向；若间没有方向，则', '')
            : ANGLE_HINT[angle];
        return `- ${angle}：${hint}`;
    }).join('\n');
    return [
        `请暂停角色扮演。你在给 ${userName} 与 ${charName} 的下一楼写导演短大纲，不是写正文，也不要填棱/番外。`,
        '一次输出 4～5 条。每条只写：这一拍发生什么、落到什么结果。可改、可复制、可填输入框，所以短、具体、彼此拉开差。',
        '四条必须覆盖这些角度（第 5 条可重复最有用的角度或补一条更偏的）：',
        angles,
        '不要代发用户楼，不要输出 HTML，不要解释。',
        '',
        '【点·近几天日程】',
        clip(context.pointRaw) || '（无）',
        '',
        '【线·平行事件】',
        clip(context.linesRaw) || '（无）',
        '',
        '【面·当前节点】',
        clip(context.outlineNode) || '（无）',
        '',
        '【间·近期发言】',
        clip(context.spaceRecent, 1200) || '（无）',
        '',
        '只输出：',
        '<beat_shots>',
        'Shot: 1|today|短标题',
        '发生什么，落到什么结果。',
        'Shot: 2|line|短标题',
        '…',
        '</beat_shots>',
        `angle 只能是 ${BEAT_ANGLES.join(' / ')}。标题不超过 16 字。正文 40～90 字。`,
    ].join('\n');
}
