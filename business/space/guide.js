import { createGenerationDiagnosticScope, diagnosticMessage, makeDiagnosticError } from '../../api/diagnostics.js';
import { GUIDE_DECISIONS, GUIDE_MODULES, GUIDE_QUESTIONS, parseGuideDrafts, parseGuideInspirations } from './guide-schema.js';
import { buildGuideDraftPrompt, buildGuideInspirePrompt } from './guide-prompt.js';

const emptyDecisions = () => Object.fromEntries(GUIDE_MODULES.map(name => [name, 'pending']));

export function createSpaceGuide(env = {}) {
    let state = idleState();
    let abortController = null;

    function idleState() {
        return {
            phase: 'idle',
            busy: false,
            inspirations: [],
            picked: null,
            description: '',
            step: 0,
            answers: [],
            understand: '',
            drafts: { point: '', lines: '', outline: '' },
            decisions: emptyDecisions(),
            comments: { point: '', lines: '', outline: '' },
            wantBeat: false,
            error: '',
        };
    }

    const emit = () => env.onChange?.(snapshot());
    const snapshot = () => ({ ...state, question: GUIDE_QUESTIONS[state.step] || null, questions: GUIDE_QUESTIONS });
    const seedText = () => [state.picked ? `${state.picked.title}：${state.picked.body}` : '', state.description].filter(Boolean).join('\n');

    const abort = (reason = 'manual-abort') => {
        abortController?.abort(reason);
        state.busy = false;
    };

    const reset = () => {
        abort('guide-reset');
        state = { ...idleState(), phase: 'entry' };
        emit();
    };

    const start = () => {
        abort('guide-start');
        state = { ...idleState(), phase: 'entry' };
        emit();
    };

    const leave = () => {
        abort('guide-leave');
        state = idleState();
        emit();
    };

    async function runApi(kind, prompt) {
        const cfg = env.loadConfig?.() || {};
        if (!cfg.url || !cfg.key) {
            env.openSettings?.();
            throw makeDiagnosticError('config-missing');
        }
        const controller = new AbortController();
        abortController = controller;
        state.busy = true;
        state.error = '';
        emit();
        const diagnostic = createGenerationDiagnosticScope(`space-guide-${kind}`);
        try {
            const ctx = env.context?.() || {};
            const raw = await env.postCompletion?.({
                config: cfg,
                messages: [
                    { role: 'system', content: '你是局外创作顾问。不问番外，不填棱，不扮演，不代发主楼。' },
                    { role: 'user', content: prompt },
                ],
                maxTokens: 30000,
                temperature: env.temperature,
                signal: controller.signal,
                promptMode: 'creative',
                diagnosticModule: `space-guide-${kind}`,
                diagnosticSink: diagnostic.sink,
            });
            if (abortController !== controller || controller.signal.aborted) return { status: 'cancelled' };
            diagnostic.accepted({ phase: 'response' });
            return { status: 'ok', raw: String(raw || '') };
        } catch (error) {
            if (error?.name === 'AbortError') return { status: 'cancelled' };
            diagnostic.rejected(error, { phase: 'request' });
            state.error = diagnosticMessage(error);
            env.toast?.(state.error, true);
            return { status: 'failed', error };
        } finally {
            if (abortController === controller) abortController = null;
            state.busy = false;
            emit();
        }
    }

    const inspire = async () => {
        const result = await runApi('inspire', buildGuideInspirePrompt({
            ...env.collectContext?.(),
            avoid: state.inspirations.map(card => card.title).join('、'),
        }));
        if (result.status !== 'ok') return result;
        const cards = parseGuideInspirations(result.raw);
        if (!cards.length) {
            state.error = '这次没有解析出灵感，再换一批试试';
            emit();
            return { status: 'failed' };
        }
        state.phase = 'inspire';
        state.inspirations = cards;
        emit();
        return { status: 'updated' };
    };

    const describe = () => {
        state.phase = 'describe';
        emit();
    };

    const pickInspiration = index => {
        state.picked = state.inspirations[Number(index)] || null;
        state.phase = 'ask';
        state.step = 0;
        emit();
    };

    const submitDescription = text => {
        state.description = String(text || '').trim();
        state.phase = 'ask';
        state.step = 0;
        emit();
    };

    const answerCurrent = value => {
        const question = GUIDE_QUESTIONS[state.step];
        if (!question) return;
        const next = {
            id: question.id,
            prompt: question.prompt,
            value: String(value || '').trim() || '跳过',
        };
        const answers = state.answers.filter(item => item.id !== question.id);
        answers.push(next);
        state.answers = answers;
        if (state.step < GUIDE_QUESTIONS.length - 1) state.step += 1;
        emit();
    };

    const skipCurrent = () => answerCurrent('跳过');

    const back = () => {
        if (state.phase === 'ask' && state.step > 0) {
            state.step -= 1;
            emit();
            return;
        }
        if (state.phase === 'ask') {
            state.phase = state.picked ? 'inspire' : (state.description ? 'describe' : 'entry');
            emit();
            return;
        }
        if (state.phase === 'inspire' || state.phase === 'describe' || state.phase === 'draft') {
            state.phase = 'entry';
            emit();
        }
    };

    const finishAsking = async (comment = null) => {
        const context = {
            ...env.collectContext?.(),
            seed: seedText(),
            answers: state.answers,
            comment,
        };
        const result = await runApi('draft', buildGuideDraftPrompt(context));
        if (result.status !== 'ok') return result;
        const parsed = parseGuideDrafts(result.raw);
        if (comment?.module) {
            state.drafts = { ...state.drafts, [comment.module]: parsed[comment.module] || state.drafts[comment.module] };
            if (parsed.understand) state.understand = parsed.understand;
        } else {
            state.understand = parsed.understand;
            state.drafts = { point: parsed.point, lines: parsed.lines, outline: parsed.outline };
            state.decisions = emptyDecisions();
        }
        state.phase = 'draft';
        emit();
        return { status: 'updated' };
    };

    const decide = (module, decision) => {
        if (!GUIDE_MODULES.includes(module) || !GUIDE_DECISIONS.includes(decision)) return;
        state.decisions = { ...state.decisions, [module]: decision };
        emit();
    };

    const setComment = (module, text) => {
        if (!GUIDE_MODULES.includes(module)) return;
        state.comments = { ...state.comments, [module]: String(text || '') };
        emit();
    };

    const redoModule = async module => {
        const text = String(state.comments[module] || '').trim();
        if (!text) {
            env.toast?.('先写意见再重做这块', true);
            return { status: 'invalid' };
        }
        return finishAsking({ module, text });
    };

    const setWantBeat = value => {
        state.wantBeat = value === true;
        emit();
    };

    const commit = async () => {
        const applied = [];
        for (const name of GUIDE_MODULES) {
            if (state.decisions[name] !== 'apply') continue;
            const draft = state.drafts[name];
            if (!draft) continue;
            const ok = await env.applyDraft?.(name, draft);
            if (ok) applied.push(name);
        }
        if (!applied.length && GUIDE_MODULES.every(name => state.decisions[name] === 'pending')) {
            env.toast?.('先给点/线/面各选一项：保持、按草案改、或不用你想', true);
            return { status: 'invalid' };
        }
        env.toast?.(applied.length ? `已写入：${applied.map(name => ({ point: '点', lines: '线', outline: '面' }[name])).join('、')}` : '没有改账本');
        const wantBeat = state.wantBeat;
        leave();
        if (wantBeat) env.generateBeat?.();
        return { status: 'updated', applied };
    };

    return {
        start,
        reset,
        leave,
        inspire,
        describe,
        pickInspiration,
        submitDescription,
        answerCurrent,
        skipCurrent,
        back,
        finishAsking,
        decide,
        setComment,
        redoModule,
        setWantBeat,
        commit,
        abort,
        snapshot,
        isActive: () => state.phase !== 'idle',
        get busy() { return state.busy; },
    };
}
