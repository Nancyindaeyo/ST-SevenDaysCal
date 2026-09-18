export const ALIGN_WINDOW_MAX = 12;
export const ALIGN_WINDOW_DEFAULT = 5;

export function listAiStoryFloors(chat = [], readStory = text => String(text || '')) {
    const out = [];
    const list = Array.isArray(chat) ? chat : [];
    for (let i = 0; i < list.length; i++) {
        const message = list[i];
        if (!message || message.is_user || message.is_system || message.is_hidden || message?.extra?.is_hidden) continue;
        const text = String(readStory(message.mes || message.mes_html || '') || '').trim();
        if (!text) continue;
        out.push(Object.freeze({ index: i, text }));
    }
    return Object.freeze(out);
}

export function buildAlignStoryWindow(floors = [], {
    afterFloor = -1,
    max = ALIGN_WINDOW_MAX,
    fallback = ALIGN_WINDOW_DEFAULT,
} = {}) {
    const list = Array.isArray(floors) ? floors : [];
    if (!list.length) return Object.freeze({ text: '', from: -1, to: -1, count: 0 });
    const after = Number.isInteger(Number(afterFloor)) ? Number(afterFloor) : -1;
    let picked = after >= 0 ? list.filter(floor => floor.index > after) : list.slice(-Math.max(1, fallback));
    if (!picked.length) picked = list.slice(-1);
    const cap = Math.max(1, Math.floor(Number(max) || ALIGN_WINDOW_MAX));
    if (picked.length > cap) picked = picked.slice(-cap);
    const text = picked.map(floor => `——第 ${floor.index} 楼——\n${floor.text}`).join('\n\n');
    return Object.freeze({
        text,
        from: picked[0].index,
        to: picked[picked.length - 1].index,
        count: picked.length,
    });
}
