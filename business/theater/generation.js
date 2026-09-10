import { theaterId } from './schema.js';
import { parseTheaterPieces } from './pieces.js';
import { THEATER_COUNT_DEFAULT } from './constants.js';
import { normalizeTheaterCount } from './recipe.js';

import { createGenerationDiagnosticScope, makeDiagnosticError } from '../../api/diagnostics.js';

export function createTheaterGeneration({ write, buildWriteMessages, onDiagnostic, makeId = () => theaterId() } = {}) {
    return async function generateTheater(input, { signal, onStage, templateSource, userName, charName, storyContext, settings = {}, recipes = [], headers = [], count, boxed = false, continueFrom = null, isCurrent = () => true, diagnosticScope = null } = {}) {
        const diagnostic = diagnosticScope || createGenerationDiagnosticScope('theater-generation');
        const frozenStoryContext = { ...(storyContext || {}), userName, charName };
        const continuing = Boolean(continueFrom);
        const pieceCount = continuing || boxed ? 1 : normalizeTheaterCount(count ?? settings.theaterCount, THEATER_COUNT_DEFAULT);
        onStage?.(continuing ? '续写' : '折射');
        const sourceTemplate = continueFrom?.templateSource || templateSource;
        const raw = await write(buildWriteMessages(input, { userName, charName, storyContext: frozenStoryContext }, settings, { recipes, headers, count: pieceCount, boxed: continuing ? false : boxed, continueFrom }), { maxTokens: 30000, signal, userName, charName, promptMode: 'creative', diagnosticModule: 'theater-generation', diagnosticSink: diagnostic.sink });
        if (!String(raw || '').trim()) throw diagnostic.rejected(makeDiagnosticError('empty-output', { phase: 'empty-output' }), { phase: 'parse', reasonCode: 'theater-empty-draft' });
        if (!isCurrent()) throw Object.assign(new Error('theater-owner-stale'), { name: 'AbortError' });
        const batchId = makeId();
        const pieces = parseTheaterPieces(raw, { makeId, request: String(input || '').trim(), templateSource: sourceTemplate, recipes, batchId, ts: Date.now() });
        if (!pieces.length) throw diagnostic.rejected(makeDiagnosticError('empty-output', { phase: 'parse' }), { phase: 'parse', reasonCode: 'theater-empty-draft' });
        if (continuing) {
            const parentId = String(continueFrom.id || '');
            const continueSource = {
                title: String(continueFrom.title || ''),
                raw: String(continueFrom.raw || ''),
                templateSource: continueFrom.templateSource || undefined,
            };
            for (const piece of pieces) {
                if (parentId) piece.continuedFrom = parentId;
                piece.continueSource = continueSource;
                if (!piece.templateSource && continueFrom.templateSource) piece.templateSource = continueFrom.templateSource;
            }
        }
        diagnostic.accepted({ phase: 'validation', reasonCode: 'theater-draft-valid' });
        if (!isCurrent()) throw Object.assign(new Error('theater-owner-stale'), { name: 'AbortError' });
        return { id: pieces[0].id, title: pieces[0].title, raw: pieces[0].raw, request: pieces[0].request, html: '', ts: pieces[0].ts, templateSource: pieces[0].templateSource, batchId, pieces };
    };
}
