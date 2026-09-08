import { theaterId } from './schema.js';
import { parseTheaterPieces } from './pieces.js';
import { THEATER_COUNT_DEFAULT } from './constants.js';
import { normalizeTheaterCount } from './recipe.js';

import { createGenerationDiagnosticScope, makeDiagnosticError } from '../../api/diagnostics.js';

export function createTheaterGeneration({ write, buildWriteMessages, onDiagnostic, makeId = () => theaterId() } = {}) {
    return async function generateTheater(input, { signal, onStage, templateSource, userName, charName, storyContext, settings = {}, recipes = [], headers = [], count, isCurrent = () => true, diagnosticScope = null } = {}) {
        const diagnostic = diagnosticScope || createGenerationDiagnosticScope('theater-generation');
        const frozenStoryContext = { ...(storyContext || {}), userName, charName };
        const pieceCount = normalizeTheaterCount(count ?? settings.theaterCount, THEATER_COUNT_DEFAULT);
        onStage?.('折射');
        const raw = await write(buildWriteMessages(input, { userName, charName, storyContext: frozenStoryContext }, settings, { recipes, headers, count: pieceCount }), { maxTokens: 30000, signal, userName, charName, promptMode: 'creative', diagnosticModule: 'theater-generation', diagnosticSink: diagnostic.sink });
        if (!String(raw || '').trim()) throw diagnostic.rejected(makeDiagnosticError('empty-output', { phase: 'empty-output' }), { phase: 'parse', reasonCode: 'theater-empty-draft' });
        if (!isCurrent()) throw Object.assign(new Error('theater-owner-stale'), { name: 'AbortError' });
        const batchId = makeId();
        const pieces = parseTheaterPieces(raw, { makeId, request: String(input || '').trim(), templateSource, recipes, batchId, ts: Date.now() });
        if (!pieces.length) throw diagnostic.rejected(makeDiagnosticError('empty-output', { phase: 'parse' }), { phase: 'parse', reasonCode: 'theater-empty-draft' });
        diagnostic.accepted({ phase: 'validation', reasonCode: 'theater-draft-valid' });
        if (!isCurrent()) throw Object.assign(new Error('theater-owner-stale'), { name: 'AbortError' });
        return { id: pieces[0].id, title: pieces[0].title, raw: pieces[0].raw, request: pieces[0].request, html: '', ts: pieces[0].ts, templateSource: pieces[0].templateSource, batchId, pieces };
    };
}
