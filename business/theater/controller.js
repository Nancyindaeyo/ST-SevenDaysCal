import { createGenerationDiagnosticScope, makeDiagnosticError } from '../../api/diagnostics.js';
import { stripTheaterRecipe } from './recipe.js';

export function createTheaterController({ owners, repository, generate, drawPool, current, chatId, chatRevision, names, settings, storyContext, stage, commit, error, reset } = {}) {
    let active = null;
    const valid = owner => owners.isValid(owner, { chatId: chatId(), chatRevision: chatRevision() }) && !owner.controller.signal.aborted;
    const cancellationReason = owner => owner?.cancelReason === 'user-abort' ? 'aborted' : (owner?.cancelReason || 'stale');
    async function run(input, options = {}) {
        if (active) return { status: 'skipped' };
        const frozenNames = names?.() || {};
        const owner = owners.create('theater', { chatId: chatId(), chatRevision: chatRevision(), userName: frozenNames.userName || '用户', charName: frozenNames.charName || '角色', input: String(input || ''), templateSource: options.templateSource || null });
        owner.input = String(input || '');
        owner.userName = frozenNames.userName || '用户';
        owner.charName = frozenNames.charName || '角色';
        owner.templateSource = options.templateSource || null;
        owner.settings = settings?.() || {};
        const diagnostic = createGenerationDiagnosticScope('theater-generation');
        active = owner;
        try {
            owner.storyContext = await storyContext?.(owner);
            if (!valid(owner)) return { status: 'cancelled', reason: cancellationReason(owner) };
            const boxed = String(owner.input || '').trim();
            const drawn = options.recipes || options.headers
                ? { recipes: options.recipes || [], headers: options.headers || [] }
                : boxed
                    ? {
                        recipes: [{
                            uid: owner.templateSource?.uid,
                            bookName: owner.templateSource?.bookName || '',
                            title: owner.templateSource?.title || '(手选)',
                            stripped: stripTheaterRecipe(boxed) || boxed,
                        }],
                        headers: [],
                    }
                    : (await drawPool?.(owner.settings, owner) || { recipes: [], headers: [] });
            if (!valid(owner)) return { status: 'cancelled', reason: cancellationReason(owner) };
            owner.recipes = Array.isArray(drawn?.recipes) ? drawn.recipes : [];
            owner.headers = Array.isArray(drawn?.headers) ? drawn.headers : [];
            const result = await generate(owner.input, { ...options, boxed: Boolean(boxed), signal: owner.controller.signal, userName: owner.userName, charName: owner.charName, storyContext: owner.storyContext, settings: owner.settings, recipes: owner.recipes, headers: owner.headers, count: boxed ? 1 : owner.settings.theaterCount, diagnosticScope: diagnostic, isCurrent: () => valid(owner), onStage: text => { if (valid(owner)) stage?.(text, owner); } });
            if (!valid(owner)) return { status: 'cancelled', reason: cancellationReason(owner) };
            const pieces = Array.isArray(result?.pieces) && result.pieces.length ? result.pieces : (result ? [result] : []);
            if (!pieces.length) { const emptyError = diagnostic.rejected(makeDiagnosticError('empty-output', { phase: 'parse' }), { phase: 'parse', reasonCode: 'theater-empty-draft' }); error?.(emptyError, owner); return { status: 'failed', reason: 'empty', error: emptyError }; }
            const saved = repository.pushDrafts ? await repository.pushDrafts(owner.chatId, pieces) : await repository.pushDraft(owner.chatId, pieces[0]);
            if (!saved?.ok && !pieces.length) { const saveError = diagnostic.rejected(makeDiagnosticError('save', { phase: 'save' }), { phase: 'save', reasonCode: 'theater-draft-save-failed' }); error?.(saveError, owner); return { status: 'failed', reason: 'draft-save', error: saveError }; }
            diagnostic.committed({ reasonCode: saved?.persistFailed ? 'theater-draft-memory-only' : 'theater-draft-saved' });
            commit?.(pieces[0], owner); current?.(pieces[0], owner);
            return { status: 'updated', piece: pieces[0], pieces, persistFailed: saved?.persistFailed === true };
        } catch (err) {
            if (!valid(owner)) return { status: 'cancelled', reason: cancellationReason(owner) };
            if (err?.name === 'AbortError') return { status: 'cancelled', reason: 'aborted' };
            error?.(err, owner);
            return { status: 'failed', error: err };
        }
        finally { if (active === owner) active = null; owners.finish(owner); }
    }
    return { run, abort: (reason = 'user-abort') => { if (!active) return false; const owner = active; owner.cancelReason = reason === 'aborted' ? 'user-abort' : reason; owners.invalidate('theater', owner.cancelReason); reset?.(owner, owner.cancelReason); active = null; return true; }, get owner() { return active; }, get busy() { return !!active; } };
}
