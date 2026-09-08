export const GUIDE_QUESTIONS = Object.freeze([
    Object.freeze({
        id: 'who',
        prompt: '这轮更想把镜头放在哪？',
        options: Object.freeze(['主角日常', '两人关系', '配角或外部势力', '先把今天的点演完']),
    }),
    Object.freeze({
        id: 'pace',
        prompt: '节奏想怎样？',
        options: Object.freeze(['慢热纯日常', '推进一件具体事', '侧面埋一条线', '给面的当前节点铺路']),
    }),
    Object.freeze({
        id: 'land',
        prompt: '这一拍想落到什么结果？',
        options: Object.freeze(['今天的点收口', '让一条线露头', '换条路径、留下面节点', '先喘口气']),
    }),
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
