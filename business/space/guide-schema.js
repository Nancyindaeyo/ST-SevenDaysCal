export const GUIDE_QUESTIONS = Object.freeze([
    Object.freeze({
        id: 'stuck',
        prompt: '现在最卡住的是？',
        options: Object.freeze(['下一楼不知道写什么', '关系想升温或降温', '有条线不知道该不该露', '今天的点跟正文对不上']),
    }),
    Object.freeze({
        id: 'feel',
        prompt: '这轮想要什么感觉？',
        options: Object.freeze(['把刚才那拍收干净', '推进一件具体事', '先喘口气、铺日常', '把大纲当前节点往前带一点']),
    }),
    Object.freeze({
        id: 'help',
        prompt: '间这轮主要帮你动哪本账？',
        options: Object.freeze(['先想下一楼发生什么', '改近几天日程', '改平行事件', '改长线大纲']),
    }),
]);

export const SPACE_CHAT_STARTERS = Object.freeze([
    Object.freeze({ id: 'next', label: '下一楼怎么写', text: '刚这楼之后，下一楼比较顺的走向是什么？别代写正文，说事件和落到什么结果。' }),
    Object.freeze({ id: 'line', label: '线该不该露头', text: '有哪条线现在适合露一点头，哪条该再压着？说理由，不要改账本。' }),
    Object.freeze({ id: 'point', label: '今天的点还合适吗', text: '今天的点还贴正文吗？有没有该收口或该改时间的，先聊清楚。' }),
]);

export const GUIDE_MODULES = Object.freeze(['point', 'lines', 'outline']);
export const GUIDE_DECISIONS = Object.freeze(['pending', 'keep', 'apply', 'skip']);

export function parseGuideInspirations(raw) {
    const source = String(raw || '');
    const wrapped = /<guide_inspire[^>]*>([\s\S]*?)<\/guide_inspire>/i.exec(source);
    const content = wrapped ? wrapped[1] : source;
    const cards = [];
    for (const line of content.split('\n')) {
        const match = /^\s*Card\s*[:：]\s*(.+)$/i.exec(line);
        if (!match) continue;
        const [title, ...rest] = match[1].split(/[|｜]/).map(part => part.trim());
        const body = rest.join('｜').trim();
        if (!title && !body) continue;
        cards.push(Object.freeze({ title: title || `灵感 ${cards.length + 1}`, body }));
        if (cards.length >= 4) break;
    }
    return cards;
}

function extractWidget(source, tag) {
    const match = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'i').exec(String(source || ''));
    return match ? match[0].trim() : '';
}

export function parseGuideDrafts(raw) {
    const source = String(raw || '');
    const understandMatch = /understand\s*[:：]\s*([\s\S]*?)(?=\n\s*<calendar_widget|\n\s*<storylines_widget|\n\s*<outline_widget|$)/i.exec(source);
    return Object.freeze({
        understand: String(understandMatch?.[1] || '').trim(),
        point: extractWidget(source, 'calendar_widget'),
        lines: extractWidget(source, 'storylines_widget'),
        outline: extractWidget(source, 'outline_widget'),
    });
}

export function formatGuideAnswers(answers = []) {
    if (!Array.isArray(answers) || !answers.length) return '（用户还没作答，按现有账本和近文收束）';
    return answers.map(item => `- ${item.prompt || item.id}：${item.value || '跳过'}`).join('\n');
}

export function clipGuideText(value, limit = 1600) {
    const text = String(value || '').trim();
    return text.length > limit ? `${text.slice(0, limit)}\n…` : text;
}
