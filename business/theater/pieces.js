import { theaterId } from './schema.js';
import { THEATER_TARGET_CHARS } from './constants.js';

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
        .replace(/<\/?(?:html|head|body|snow|toto)[^>]*>/gi, '')
        .trim();
}

function unwrapFences(text) {
    let source = String(text || '').trim();
    const whole = /^```(?:xml|html|text|markdown|json)?\s*\n?([\s\S]*?)\n?```$/i.exec(source);
    if (whole) return whole[1].trim();
    return source.replace(/```(?:xml|html|text|markdown)?\s*\n?([\s\S]*?)\n?```/gi, '$1').trim();
}

function headingBody(block) {
    const titleMatch = /^(?:标题|title)\s*[：:]\s*(.+)\s*$/im.exec(block);
    const title = titleMatch ? String(titleMatch[1] || '').trim() : '';
    let body = titleMatch ? String(block).replace(titleMatch[0], '') : String(block || '');
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

function xmlBody(inner) {
    return stripPieceMarkup(innerTag(inner, 'body') || inner.replace(/<(?:title|form_name|form_seed|theme_name|theme_seed)\b[^>]*>[\s\S]*?<\/(?:title|form_name|form_seed|theme_name|theme_seed)>/gi, '').trim());
}

function collectXmlPieces(source, extras) {
    const pieces = [];
    for (const match of source.matchAll(PIECE_BLOCK)) {
        const piece = toPiece({
            title: innerTag(match[2] || '', 'title') || attr(match[1], 'title'),
            body: xmlBody(match[2] || ''),
            extras,
            index: pieces.length,
        });
        if (piece) pieces.push(piece);
    }
    if (pieces.length) return pieces;
    const open = OPEN_PIECE.exec(source);
    if (!open) return [];
    const piece = toPiece({
        title: innerTag(open[2] || '', 'title') || attr(open[1], 'title'),
        body: xmlBody(open[2] || ''),
        extras,
        index: 0,
    });
    return piece ? [piece] : [];
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
    const pieces = collectXmlPieces(source, extras);
    if (pieces.length) return pieces;
    const marked = collectMarkedPieces(source, extras);
    if (marked.length) return marked;
    if (!source) return [];
    const body = stripPieceMarkup(source.replace(/<\/?theater_piece\b[^>]*>/gi, '').trim());
    const piece = toPiece({ title: '', body, extras, index: 0 });
    return piece ? [piece] : [];
}

export function theaterTargetHint(count) {
    const n = Math.max(1, Math.min(3, Math.floor(Number(count) || 2)));
    return `共 ${n} 条，每条约 ${THEATER_TARGET_CHARS} 字`;
}
