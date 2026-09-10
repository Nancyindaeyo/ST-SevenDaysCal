import { theaterId } from './schema.js';

const FACE_BLOCK = /<theater\b([^>]*)>([\s\S]*?)<\/theater>/gi;
const OPEN_FACE = /<theater\b([^>]*)>([\s\S]+)$/i;
const PIECE_BLOCK = /<theater_piece\b([^>]*)>([\s\S]*?)<\/theater_piece>/gi;
const OPEN_PIECE = /<theater_piece\b([^>]*)>([\s\S]+)$/i;
const MARK = /(?:^|\n)\s*(?:【\s*番外[^\n】]*】|#{1,3}\s*番外[^\n]*)\s*(?:\n|$)/g;

function innerTag(block, name) {
    const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i').exec(block);
    return match ? String(match[1] || '').trim() : '';
}

function attr(attrs, name) {
    const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs || '');
    return String(match?.[1] ?? match?.[2] ?? '').trim();
}

function stripPieceMarkup(text) {
    return String(text || '')
        .replace(/```(?:html|css|js|javascript|xml)?\s*[\s\S]*?```/gi, '')
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[\s\S]*?<\/style>/gi, '')
        .replace(/<\/?(?:html|head|body|snow|toto|theater|theater_piece)[^>]*>/gi, '')
        .trim();
}

function unwrapFences(text) {
    const source = String(text || '').trim();
    const whole = /^```(?:xml|html|text|markdown|json)?\s*\n?([\s\S]*?)\n?```$/i.exec(source);
    if (whole) return whole[1].trim();
    return source.replace(/```(?:xml|html|text|markdown)?\s*\n?([\s\S]*?)\n?```/gi, '$1').trim();
}

function headingBody(block) {
    const text = String(block || '').trim();
    const bracket = /^【([^】]{1,40})】\s*/.exec(text);
    if (bracket) return { title: bracket[1].trim(), body: stripPieceMarkup(text.slice(bracket[0].length)) };
    const titleMatch = /^(?:标题|title)\s*[：:]\s*(.+)\s*$/im.exec(text);
    const title = titleMatch ? String(titleMatch[1] || '').trim() : innerTag(text, 'title');
    let body = titleMatch ? text.replace(titleMatch[0], '') : text;
    if (!titleMatch && title) {
        body = text.replace(/<(?:title|form_name|form_seed|theme_name|theme_seed)\b[^>]*>[\s\S]*?<\/(?:title|form_name|form_seed|theme_name|theme_seed)>/gi, '');
        body = innerTag(text, 'body') || body;
    }
    body = body.replace(/^(?:正文|body)\s*[：:]\s*/im, '').trim();
    return { title, body: stripPieceMarkup(body) };
}

function toPiece({ title, body, extras, index }) {
    if (!body) return null;
    const recipe = extras.recipes?.[index] || null;
    const templateSource = extras.templateSource;
    return {
        id: extras.makeId(),
        title: title || recipe?.title || '',
        raw: body,
        html: '',
        request: String(extras.request || '').trim(),
        ts: extras.ts,
        liked: false,
        batchId: String(extras.batchId || ''),
        formName: recipe?.title || '',
        formSeed: '',
        themeName: '',
        themeSeed: '',
        templateSource: templateSource?.input
            ? { ...templateSource, input: String(templateSource.input) }
            : (recipe ? { uid: String(recipe.uid ?? ''), title: recipe.title, input: recipe.stripped, bookName: recipe.bookName } : undefined),
    };
}

function collectNamedBlocks(source, closedRe, openRe, extras) {
    const found = [];
    closedRe.lastIndex = 0;
    for (const match of source.matchAll(closedRe)) {
        const face = Number(attr(match[1], 'data-face') || attr(match[1], 'face') || found.length + 1);
        const { title, body } = headingBody(match[2] || '');
        const index = Number.isInteger(face) && face >= 1 ? face - 1 : found.length;
        const piece = toPiece({ title: title || attr(match[1], 'title'), body, extras, index });
        if (piece) found.push({ index, piece });
    }
    if (!found.length) {
        openRe.lastIndex = 0;
        const open = openRe.exec(source);
        if (open) {
            const face = Number(attr(open[1], 'data-face') || attr(open[1], 'face') || 1);
            const { title, body } = headingBody(open[2] || '');
            const index = Number.isInteger(face) && face >= 1 ? face - 1 : 0;
            const piece = toPiece({ title: title || attr(open[1], 'title'), body, extras, index });
            if (piece) found.push({ index, piece });
        }
    }
    found.sort((a, b) => a.index - b.index);
    return found.map(item => item.piece);
}

function collectMarkedPieces(source, extras) {
    const marks = [...source.matchAll(MARK)];
    if (!marks.length) return [];
    const pieces = [];
    for (let i = 0; i < marks.length; i++) {
        const start = marks[i].index + marks[i][0].length;
        const end = i + 1 < marks.length ? marks[i + 1].index : source.length;
        const { title, body } = headingBody(source.slice(start, end));
        const piece = toPiece({ title, body, extras, index: pieces.length });
        if (piece) pieces.push(piece);
    }
    return pieces;
}

export function parseTheaterPieces(raw, { makeId = theaterId, request = '', templateSource, recipes = [], batchId = '', ts = Date.now() } = {}) {
    const extras = { makeId, request, templateSource, recipes, batchId, ts };
    const source = unwrapFences(raw);
    const faces = collectNamedBlocks(source, FACE_BLOCK, OPEN_FACE, extras);
    if (faces.length) return faces;
    const xml = collectNamedBlocks(source, PIECE_BLOCK, OPEN_PIECE, extras);
    if (xml.length) return xml;
    const marked = collectMarkedPieces(source, extras);
    if (marked.length) return marked;
    if (!source) return [];
    const body = stripPieceMarkup(source);
    const piece = toPiece({ title: '', body, extras, index: 0 });
    return piece ? [piece] : [];
}

export function theaterTargetHint(count) {
    const n = Math.max(1, Math.min(3, Math.floor(Number(count) || 2)));
    return `共 ${n} 条，篇幅跟模板走`;
}
