import { NEAR_WHEN_RX, pickDueLedger, pickNearLines, pickTodayPoint } from '../stage/snapshot.js';

export const STAY_RX = /在家|养伤|卧床|静养|闭门|不出门|休养|养病/;
export const OUT_RX = /赴约|出门|出城|上街|赴宴|夜会|潜入|远行|出游|夜奔/;
export const INJURY_RX = /伤|病|创|残|中毒|发烧|卧床|养伤/;

export function compactText(value) {
    return String(value || '').replace(/\s+/g, '').replace(/[的了着過过，。,.、；;：:]/g, '');
}

export function textsRelated(a, b) {
    const x = compactText(a);
    const y = compactText(b);
    if (!x || !y) return false;
    return x.includes(y) || y.includes(x);
}

export function uniqueUnrelated(values = []) {
    const out = [];
    for (const value of values) {
        const text = String(value || '').trim();
        if (!text) continue;
        if (out.some(existing => textsRelated(existing, text))) continue;
        out.push(text);
    }
    return out;
}

function eventBlob(event = {}) {
    return [event.title, event.location, event.desc].filter(Boolean).join(' ');
}

function lineBlob(line = {}) {
    return [line.name, line.when, line.desc, line.next].filter(Boolean).join(' ');
}

function ledgerBlob(entry = {}) {
    return [entry.事由 || entry.title, entry.现状, ...(entry.标签 || [])].filter(Boolean).join(' ');
}

function stayEvents(events = []) {
    return events.filter(event => STAY_RX.test(eventBlob(event)));
}

function outingLines(lines = []) {
    return pickNearLines(lines).filter(line => OUT_RX.test(lineBlob(line)));
}

function outingPlans(plans = []) {
    return (Array.isArray(plans) ? plans : []).filter(plan => {
        const blob = [plan.content, plan.targetTime].filter(Boolean).join(' ');
        return OUT_RX.test(blob) || NEAR_WHEN_RX.test(blob);
    });
}

function injuryLedger(entries = []) {
    return (Array.isArray(entries) ? entries : []).filter(entry => entry?.类型 === '持续状态' && INJURY_RX.test(ledgerBlob(entry)));
}

function dueAppointments(entries = []) {
    return pickDueLedger(entries).filter(entry => entry?.类型 === '约定待办' || entry?.type === '约定待办');
}

function pairId(kind, left = {}, right = {}) {
    return [kind, left.module || '', left.title || '', right.module || '', right.title || ''].join('|');
}

function conflict({ id, title, detail, quote = '', module, ref = '', against = null }) {
    const againstTitle = String(against?.title || '').trim();
    const againstModule = against?.module || '';
    return Object.freeze({
        id,
        pairId: pairId(id, { module, title }, { module: againstModule, title: againstTitle }),
        title: String(title || '').trim(),
        detail: String(detail || '').trim(),
        quote: String(quote || '').trim(),
        module,
        ref: String(ref || '').trim(),
        againstModule,
        againstTitle,
        againstRef: String(against?.ref || '').trim(),
    });
}

export function detectLampConflicts({ days = [], ledger = [], lines = [], bbb = null } = {}) {
    const today = pickTodayPoint(days);
    const events = today?.events || [];
    const found = [];

    const stays = stayEvents(events);
    const outs = outingLines(lines);
    const dues = dueAppointments(ledger);
    if (stays.length && outs.length) {
        found.push(conflict({
            id: 'stay-outing',
            title: outs[0].name,
            detail: `点「${stays[0].title}」还在写留在家里，线「${outs[0].name}」却是近日要出门`,
            module: 'lines',
            ref: outs[0].id,
            against: { module: 'point', title: stays[0].title, ref: stays[0].id },
        }));
    }
    if (dues.length && outs.length) {
        const dueTitle = dues[0].事由 || dues[0].title;
        found.push(conflict({
            id: 'due-outing',
            title: dueTitle,
            detail: `刻度「${dueTitle}」已到期或过期，线「${outs[0].name}」还写近日`,
            module: 'ledger',
            ref: dues[0].id,
            against: { module: 'lines', title: outs[0].name, ref: outs[0].id },
        }));
    }

    const locations = uniqueUnrelated(events.map(event => event.location));

    const bbbLocation = String(bbb?.location || '').trim();
    if (bbbLocation && locations.length && locations.every(place => !textsRelated(place, bbbLocation))) {
        found.push(conflict({
            id: 'bbb-place',
            title: locations[0],
            detail: `点还在「${locations[0]}」，柏宝书地点已经是「${bbbLocation}」`,
            quote: bbbLocation,
            module: 'point',
            against: { module: 'point', title: bbbLocation },
        }));
    }

    const injuries = injuryLedger(ledger);
    const condition = String(bbb?.condition || '').trim();
    if (injuries.length && condition && injuries.every(entry => !textsRelated(ledgerBlob(entry), condition))) {
        const injuryTitle = injuries[0].事由 || injuries[0].title;
        found.push(conflict({
            id: 'bbb-condition',
            title: injuryTitle,
            detail: `刻度还写着「${injuryTitle}」，柏宝书现状是「${condition}」`,
            quote: condition,
            module: 'ledger',
            ref: injuries[0].id,
            against: { module: 'ledger', title: condition },
        }));
    }

    const plans = outingPlans(bbb?.plans);
    if (stays.length && plans.length) {
        found.push(conflict({
            id: 'bbb-plan',
            title: stays[0].title,
            detail: `点还在写「${stays[0].title}」，柏宝书仍有未核销的出门计划`,
            quote: plans[0].content,
            module: 'point',
            against: { module: 'point', title: plans[0].content },
        }));
    }

    const seen = new Set();
    return Object.freeze(found.filter(item => {
        const key = item.pairId || item.id;
        if (!item.title || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 12));
}

export function readLampBaiBai(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const npcs = Array.isArray(snapshot.npcs) ? snapshot.npcs : [];
    const lead = npcs.find(npc => /主角|本人|主人公/.test(String(npc?.relation || npc?.title || '')));
    const plans = (Array.isArray(snapshot.plans) ? snapshot.plans : [])
        .filter(plan => plan && plan.status !== 'resolved')
        .map(plan => Object.freeze({
            content: String(plan.content || '').trim(),
            targetTime: String(plan.targetTime || '').trim(),
        }))
        .filter(plan => plan.content);
    const location = String(snapshot.state?.location || '').trim();
    const condition = String(snapshot.protagonist?.condition || snapshot.state?.condition || lead?.condition || '').trim();
    if (!location && !condition && !plans.length) return null;
    return Object.freeze({ location, condition, plans: Object.freeze(plans) });
}
