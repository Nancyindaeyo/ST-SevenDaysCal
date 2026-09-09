import { makePreview, snapshotSearchText } from '../coordinate/capture.js';
import { SNAP_NOTE_MAX } from '../coordinate/schema.js';
import { renderTheaterPieceHtml } from './render.js';
import { theaterId } from './schema.js';

export function buildTheaterSnapshot(piece, ctx = {}, options = {}) {
    const html = renderTheaterPieceHtml(piece, options.htmlOptions || {});
    const title = String(ctx.title || piece?.title || piece?.formName || '').trim();
    const preview = makePreview(html) || title || '(小剧场)';
    return {
        id: options.id || piece?.id || theaterId(),
        chatId: ctx.chatId ?? null,
        chatIdHash: ctx.chatIdHash ?? null,
        chatName: String(ctx.chatName || ''),
        charName: String(ctx.charName || '角色'),
        messageId: null,
        floorIndex: null,
        kind: 'theater',
        batchId: String(piece?.batchId || ''),
        formName: String(piece?.formName || piece?.templateSource?.title || ''),
        note: title.slice(0, SNAP_NOTE_MAX),
        html,
        textPreview: preview,
        searchText: snapshotSearchText(html),
        ts: Number(piece?.ts) || Date.now(),
        tags: [],
    };
}
