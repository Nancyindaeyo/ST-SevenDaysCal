import { parseCalendar, serializeCalendar } from '../point/parse.js';
import { parseLines, serializeLines } from '../lines/schema.js';
import { activeLines } from '../lines/strategy.js';
import { parseOutline, editOutlineScene } from '../outline/schema.js';
import { detectLampConflicts, readLampBaiBai } from './detect.js';
import { parseLampIntent } from './intent.js';
import { enterLampSidebar } from './feature.js';
import { spaceMessagePlainText } from '../space/schema.js';
import { lampAgeOf } from './age.js';
import { dismissLampPair, filterDismissedConflicts, markLampAligned, readLampState } from './state.js';
import { checkLatestStory } from './story-check.js';
import { buildAlignStoryWindow, listAiStoryFloors } from './story-window.js';

function titleHit(name, title) {
    const text = String(name || '');
    const needle = String(title || '');
    return !!(text && needle && (text.includes(needle) || needle.includes(text)));
}

function openLamp(env, intent, options) {
    env.lamp?.()?.setIntent?.(intent, options);
    enterLampSidebar({
        resetModes: env.resetModes,
        show: env.showLamp,
        feature: env.lamp?.(),
    });
}

function commitOutline(env, raw) {
    const outline = env.outline?.();
    const target = outline?.repository?.capture?.();
    if (target == null) return false;
    const saved = outline.repository.readOutline?.(target);
    void outline.repository.commitOutlineConfirmed?.(target, { raw, ts: Date.now(), cursor: saved?.cursor ?? 1 });
    outline.refreshPanel?.();
    return true;
}

// 灯宿主：读六本账、打架 extras、手改、间↔灯。fight() 仍由 refresh controller 跑；这里不接引导 commit。
export function createLampHost(env = {}) {
    const lampState = () => readLampState(env.readLamp?.() || {});
    const persistLamp = next => env.writeLamp?.({ ...next, ts: Date.now() });
    const readStory = text => env.readFloorStory?.(text) || String(text || '');

    function collect() {
        const cal = env.calendar?.();
        let days = [];
        try {
            const saved = env.readPoint?.();
            if (saved?.raw) days = parseCalendar(saved.raw, cal)?.days || [];
        } catch { days = []; }
        const ledgerEntries = (env.listLedger?.() || []).map(entry => ({
            ...entry,
            due: env.dueInfo?.(entry),
        }));
        let storedLines = [];
        let lines = [];
        try {
            storedLines = parseLines(env.readLinesRaw?.() || '');
            lines = activeLines(env.readLinesRaw?.() || '');
        } catch { storedLines = []; lines = []; }
        let hasBaiBai = false;
        let bbb = null;
        try {
            if (env.settings?.()?.useBaiBaiBook) {
                hasBaiBai = true;
                bbb = readLampBaiBai(env.baiBaiSnapshot?.());
            }
        } catch {
            hasBaiBai = true;
        }
        const state = lampState();
        const latestFloor = env.latestFloor?.() ?? -1;
        return {
            hasBaiBai,
            conflicts: filterDismissedConflicts(
                detectLampConflicts({ days, ledger: ledgerEntries, lines, bbb }),
                state.dismissed,
            ),
            age: lampAgeOf({ latestFloor, lastAlignFloor: state.lastAlignFloor }),
            books: {
                days,
                lines,
                storedLines,
                ledger: ledgerEntries,
                outline: env.outline?.()?.readSnapshot?.()?.beats || [],
                almanac: env.loadAlmanac?.() || [],
                dashed: env.lines?.()?.dashed?.read?.() || [],
            },
        };
    }

    function checkStory() {
        const books = collect().books || {};
        return checkLatestStory({
            days: books.days,
            lines: books.lines,
            story: env.readLatestStory?.() || '',
        });
    }

    function alignWindow() {
        const floors = listAiStoryFloors(env.readChat?.() || [], readStory);
        return buildAlignStoryWindow(floors, { afterFloor: lampState().lastAlignFloor });
    }

    function dismiss(pairId) {
        const id = typeof pairId === 'object' && pairId ? pairId.pairId : pairId;
        persistLamp(dismissLampPair(lampState(), id));
        env.lamp?.()?.refresh?.();
        return { status: 'dismissed' };
    }

    function markAligned(floorId) {
        persistLamp(markLampAligned(lampState(), floorId));
        return lampState().lastAlignFloor;
    }

    function lastAlignFloor() {
        return lampState().lastAlignFloor;
    }

    function applyFightExtras(patches = []) {
        const applied = [];
        for (const patch of patches || []) {
            if (patch.target === 'ledger') {
                const entries = env.listLedger?.() || [];
                const hit = entries.find(entry => titleHit(entry.事由 || entry.title, patch.title));
                if (hit && patch.fields?.[1]) {
                    env.updateLedger?.(hit.id, { 现状: patch.fields[1] });
                    applied.push({ module: 'ledger', title: hit.事由 || hit.title, action: 'edit', ref: hit.id });
                }
                continue;
            }
            if (patch.target === 'almanac') {
                const items = env.loadAlmanac?.() || [];
                const hit = items.find(item => titleHit(item.name, patch.title));
                if (hit && patch.fields?.[1]) {
                    hit.note = patch.fields[1];
                    void env.saveAlmanac?.(items);
                    applied.push({ module: 'axis', title: hit.name, action: 'edit' });
                }
                continue;
            }
            if (patch.target === 'dashed') {
                const items = env.lines?.()?.dashed?.read?.() || [];
                const hit = items.find(item => {
                    const text = String(item.text || item.title || '');
                    return text && (text.includes(patch.title) || patch.title.includes(text.slice(0, 24)));
                });
                if (hit && patch.fields?.[1]) {
                    hit.text = patch.fields[1];
                    env.lines?.()?.dashed?.commit?.(items);
                    applied.push({ module: 'dashed', title: String(hit.text || '').slice(0, 40), action: 'edit', ref: hit.id });
                }
                continue;
            }
            if (patch.target === 'outline') {
                const raw = env.outline?.()?.readRaw?.() || '';
                const beats = parseOutline(raw);
                const index = beats.findIndex(beat => titleHit(beat.title, patch.title));
                if (index >= 0 && patch.fields?.[1]) {
                    const result = editOutlineScene(raw, index, patch.fields[1]);
                    if (result.ok && commitOutline(env, result.raw)) {
                        applied.push({ module: 'outline', title: beats[index].title, action: 'edit' });
                    }
                }
            }
        }
        return applied;
    }

    function applyHandEdit(payload = {}) {
        const fields = payload.fields || {};
        const title = String(fields.title || payload.title || '').trim();
        if (payload.module === 'point') {
            const key = env.pointKey?.();
            const saved = env.readPoint?.() || {};
            const cal = env.calendar?.();
            const parsed = parseCalendar(saved.raw, cal);
            const days = parsed.allDays || parsed.days || [];
            let hit = null;
            const visit = events => {
                for (const event of events || []) {
                    if ((payload.ref && event.id === payload.ref) || event.title === payload.title) {
                        hit = event;
                        return true;
                    }
                }
                return false;
            };
            for (const day of days) if (visit(day.events)) break;
            if (!hit) visit(parsed.future?.events);
            if (hit) {
                if (title) hit.title = title;
                if (fields.time) hit.time = fields.time;
                if (fields.location) hit.location = fields.location;
                if (fields.desc) hit.desc = fields.desc;
                void env.writePoint?.({ ...saved, raw: serializeCalendar(days, parsed.future, parsed.startDate, cal, parsed.startDateToken, parsed.pastDays), ts: Date.now() });
            }
        } else if (payload.module === 'lines') {
            const saved = env.readLines?.() || {};
            const model = parseLines(saved.raw);
            const line = model.find(item => (payload.ref && item.id === payload.ref) || item.name === payload.title);
            if (line) {
                if (title) line.name = title;
                if (fields.when) line.when = fields.when;
                if (fields.desc) line.desc = fields.desc;
                if (fields.next) line.next = fields.next;
                void env.writeLines?.({ ...saved, raw: serializeLines(model), ts: Date.now() });
            }
        } else if (payload.module === 'outline') {
            const raw = env.outline?.()?.readRaw?.() || '';
            const beats = parseOutline(raw);
            const index = beats.findIndex(beat => beat.title === payload.title);
            if (index >= 0 && fields.scene) {
                const result = editOutlineScene(raw, index, fields.scene);
                if (result.ok) commitOutline(env, result.raw);
            }
        } else if (payload.module === 'ledger') {
            const patch = {};
            if (title) patch.事由 = title;
            if (fields.现状) patch.现状 = fields.现状;
            if (payload.ref) env.updateLedger?.(payload.ref, patch);
        } else if (payload.module === 'almanac') {
            const items = env.loadAlmanac?.() || [];
            const hit = items.find(item => item.name === payload.title || item.name === title);
            if (hit) {
                if (title) hit.name = title;
                if (fields.note != null) hit.note = fields.note;
                void env.saveAlmanac?.(items);
            }
        } else if (payload.module === 'dashed') {
            const items = env.lines?.()?.dashed?.read?.() || [];
            const hit = items.find(item => item.id === payload.ref || String(item.text || '').startsWith(payload.title));
            if (hit) {
                if (fields.text) hit.text = fields.text;
                env.lines?.()?.dashed?.commit?.(items);
            }
        }
        env.lamp?.()?.refresh?.();
        return { status: 'updated' };
    }

    async function sendBasketToSpace({ items = [], ask = false } = {}) {
        const quote = items.map(item => `${item.title}${item.detail || item.snippet ? `：${item.detail || item.snippet}` : ''}`).filter(Boolean).join('\n');
        env.space?.()?.guide?.leave?.();
        env.space?.()?.ui?.setQuote?.({ quote: quote || '（待改篮是空的）', who: '对账灯' });
        env.activity?.()?.close?.();
        const ok = await env.openSpace?.();
        if (ask) env.fillSpaceInput?.('这段账可能打架了。帮我想清楚该怎么改，最后给灯一份改账意图。不确定跑法就写未写清。');
        env.space?.()?.ui?.setQuote?.({ quote: quote || '（待改篮是空的）', who: '对账灯' });
        return { status: ok ? 'quoted' : 'failed' };
    }

    function clarifyIntent(intent) {
        env.space?.()?.guide?.leave?.();
        env.space?.()?.ui?.setQuote?.({ quote: intent?.text || '', who: '对账灯' });
        void Promise.resolve(env.openSpace?.()).then(() => {
            env.fillSpaceInput?.('上一版意图没写清跑法或条目。请再出一版写清楚的改账意图：跑法、要动哪几本、点名条目怎么改、不要动什么。不要自己改账。');
        });
    }

    function handoffFromGuide(intent) {
        openLamp(env, intent, { from: 'guide', kind: intent?.kind || 'fight', hasConflict: true });
        env.toast?.('草案已交给灯，确认跑法后再改账');
    }

    function receiveSpaceMessage(message) {
        const text = spaceMessagePlainText(message) || String(message?.content || '');
        const parsed = parseLampIntent(text);
        openLamp(env, parsed.items.length ? parsed : { ...parsed, text, kind: parsed.kind || 'fight' }, { from: 'space', kind: parsed.kind || 'fight' });
    }

    return {
        collect,
        checkStory,
        alignWindow,
        dismiss,
        markAligned,
        lastAlignFloor,
        applyFightExtras,
        applyHandEdit,
        sendBasketToSpace,
        clarifyIntent,
        handoffFromGuide,
        receiveSpaceMessage,
    };
}
