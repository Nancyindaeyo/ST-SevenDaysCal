import { theaterId } from './schema.js';
import { THEATER_TARGET_CHARS } from './constants.js';

const PIECE_BLOCK = /<theater_piece\b([^>]*)>([\s\S]*?)<\/theater_piece>/gi;

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
        .replace(/```(?:html|css|js|javascript)?\s*[\s\S]*?```/gi, '')
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[\s\S]*?<\/style>/gi, '')
        .replace(/<\/?(?:html|head|body|snow|toto)[^>]*>/gi, '')
        .trim();
}

export function parseTheaterPieces(raw, { makeId = theaterId, request = '', templateSource, recipes = [], batchId = '', ts = Date.now() } = {}) {
    const source = String(raw || '').trim();
    const pieces = [];
    if (source) {
        for (const match of source.matchAll(PIECE_BLOCK)) {
            const attrs = match[1] || '';
            const inner = match[2] || '';
            const body = stripPieceMarkup(innerTag(inner, 'body') || inner.replace(/<(?:title|form_name|form_seed|theme_name|theme_seed)\b[^>]*>[\s\S]*?<\/(?:title|form_name|form_seed|theme_name|theme_seed)>/gi, '').trim());
            if (!body) continue;
            const recipe = recipes[pieces.length] || null;
            pieces.push({
                id: makeId(),
                title: innerTag(inner, 'title') || attr(attrs, 'title') || recipe?.title || '',
                raw: body,
                html: '',
                request: String(request || '').trim(),
                ts,
                liked: false,
                batchId: String(batchId || ''),
                formName: innerTag(inner, 'form_name') || attr(attrs, 'form') || recipe?.title || '',
                formSeed: innerTag(inner, 'form_seed'),
                themeName: innerTag(inner, 'theme_name') || attr(attrs, 'theme') || '',
                themeSeed: innerTag(inner, 'theme_seed'),
                templateSource: templateSource?.input ? { ...templateSource, input: String(templateSource.input) } : (recipe ? { uid: String(recipe.uid ?? ''), title: recipe.title, input: recipe.stripped, bookName: recipe.bookName } : undefined),
            });
        }
    }
    if (!pieces.length && source) {
        const body = stripPieceMarkup(source.replace(/<\/?theater_piece\b[^>]*>/gi, '').trim());
        if (body) {
            const recipe = recipes[0] || null;
            pieces.push({
                id: makeId(),
                title: recipe?.title || '',
                raw: body,
                html: '',
                request: String(request || '').trim(),
                ts,
                liked: false,
                batchId: String(batchId || ''),
                formName: recipe?.title || '',
                formSeed: '',
                themeName: '',
                themeSeed: '',
                templateSource: templateSource?.input ? { ...templateSource, input: String(templateSource.input) } : (recipe ? { uid: String(recipe.uid ?? ''), title: recipe.title, input: recipe.stripped, bookName: recipe.bookName } : undefined),
            });
        }
    }
    return pieces;
}

export function theaterTargetHint(count) {
    const n = Math.max(1, Math.min(3, Math.floor(Number(count) || 2)));
    return `共 ${n} 条，每条约 ${THEATER_TARGET_CHARS} 字`;
}
