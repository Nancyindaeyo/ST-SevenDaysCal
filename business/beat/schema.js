export const BEAT_ANGLES = Object.freeze(['today', 'line', 'date', 'daily', 'space']);

const ANGLE_SET = new Set(BEAT_ANGLES);

export function normalizeBeatAngle(value) {
    const text = String(value || '').trim().toLowerCase();
    if (ANGLE_SET.has(text)) return text;
    if (/点|今天|日程/.test(text)) return 'today';
    if (/线|伏笔|平行/.test(text)) return 'line';
    if (/日期|节日|压力/.test(text)) return 'date';
    if (/日常/.test(text)) return 'daily';
    if (/间|顾问|换路/.test(text)) return 'space';
    return 'daily';
}

export function parseBeatShots(raw) {
    const source = String(raw || '');
    const wrapped = /<beat_shots[^>]*>([\s\S]*?)<\/beat_shots>/i.exec(source);
    const content = wrapped ? wrapped[1] : source;
    const chunks = content.split(/^\s*Shot\s*[:：]\s*/im).map(chunk => chunk.trim()).filter(Boolean);
    const shots = [];
    for (const chunk of chunks) {
        const [head, ...rest] = chunk.split(/\n/);
        const fields = String(head || '').split(/[|｜]/).map(part => part.trim());
        const title = fields.length >= 3 ? fields[2] : (fields[1] || fields[0] || '');
        const angle = normalizeBeatAngle(fields.length >= 2 ? fields[1] : fields[0]);
        const body = rest.join('\n').trim();
        if (!title && !body) continue;
        shots.push(Object.freeze({
            id: shots.length + 1,
            angle,
            title: title || `拍 ${shots.length + 1}`,
            body,
        }));
    }
    return shots.slice(0, 5);
}

export function serializeBeatShots(shots = []) {
    const lines = (Array.isArray(shots) ? shots : []).slice(0, 5).map((shot, index) => {
        const angle = normalizeBeatAngle(shot?.angle);
        const title = String(shot?.title || `拍 ${index + 1}`).trim();
        const body = String(shot?.body || '').trim();
        return `Shot: ${index + 1}|${angle}|${title}\n${body}`.trim();
    });
    return `<beat_shots>\n${lines.join('\n')}\n</beat_shots>`;
}

export function formatBeatForInput(shot) {
    const title = String(shot?.title || '').trim();
    const body = String(shot?.body || '').trim();
    return title ? `【${title}】\n${body}`.trim() : body;
}

export function clampBeatShots(shots = []) {
    return (Array.isArray(shots) ? shots : []).filter(shot => String(shot?.title || '').trim() || String(shot?.body || '').trim()).slice(0, 5);
}
