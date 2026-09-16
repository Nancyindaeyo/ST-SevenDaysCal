import { spaceMessagePlainText } from '../space/schema.js';

export function formatBeatOutlineNode(current) {
    if (!current) return '';
    return `${current.time ? current.time + '·' : ''}《${current.title || ''}》${current.scene ? `\n${current.scene}` : ''}`;
}

export function formatBeatSpaceRecent(history, plainText = spaceMessagePlainText) {
    return (Array.isArray(history) ? history : []).slice(-8)
        .map(message => `${message.role === 'assistant' ? '顾问' : '作者'}：${plainText(message)}`)
        .join('\n');
}

// 本轮拍取数：面游标、间近文、点/线 raw。和日台 collect 同类，不要合成一个万能读账宿主。
export function collectBeatLedgerContext(env = {}) {
    const ctx = env.getContext?.() || {};
    const snap = env.readOutlineSnapshot?.() || { beats: [], cursor: 0 };
    const current = snap.beats?.[Number(snap.cursor) - 1];
    return {
        userName: ctx.name1 || '用户',
        charName: ctx.name2 || '角色',
        pointRaw: env.readPointRaw?.() || '',
        linesRaw: env.readLinesRaw?.() || '',
        outlineRaw: env.readOutlineRaw?.() || '',
        outlineNode: formatBeatOutlineNode(current),
        spaceRecent: formatBeatSpaceRecent(env.readSpaceHistory?.(), env.spacePlainText),
        latestStory: env.readLatestStory?.() || '',
    };
}

export function createBeatContextCollector(env = {}) {
    return { collect: () => collectBeatLedgerContext(env) };
}
