export const LAMP_KINDS = Object.freeze(['align', 'fight', 'regen']);
export const LAMP_MODULES = Object.freeze(['point', 'lines', 'ledger', 'almanac', 'dashed', 'outline']);

const MODULE_LABEL = Object.freeze({
    point: '点',
    lines: '线',
    ledger: '刻度',
    almanac: '轴',
    dashed: '冷知识',
    outline: '面',
});

function text(value) {
    return String(value || '').trim();
}

export function normalizeLampKind(value, fallback = '') {
    const kind = String(value || '').trim();
    return LAMP_KINDS.includes(kind) ? kind : fallback;
}

export function formatLampIntent(intent = {}) {
    const kind = normalizeLampKind(intent.kind);
    const modules = (Array.isArray(intent.modules) ? intent.modules : []).filter(name => LAMP_MODULES.includes(name));
    const items = (Array.isArray(intent.items) ? intent.items : []).map(item => ({
        module: LAMP_MODULES.includes(item.module) ? item.module : '',
        title: text(item.title),
        change: text(item.change),
        ref: text(item.ref),
    })).filter(item => item.module && item.title);
    const lines = [
        '跑法: ' + (kind || '（未写清，请回间再出一版，或在灯上选）'),
        '要动: ' + (modules.map(name => MODULE_LABEL[name] || name).join(', ') || '（未点名）'),
    ];
    if (items.length) {
        lines.push('条目:');
        for (const item of items) {
            const change = item.change ? `：${item.change}` : '';
            lines.push(`- ${MODULE_LABEL[item.module] || item.module}「${item.title}」${change}`);
        }
    }
    const avoid = text(intent.avoid);
    if (avoid) lines.push('不要动: ' + avoid);
    const reason = text(intent.reason);
    if (reason) lines.push('依据: ' + reason);
    return lines.join('\n');
}

export function parseLampIntent(source = '') {
    const raw = String(source || '');
    const kindLine = /跑法\s*[:：]\s*(\S+)/.exec(raw);
    const kindToken = String(kindLine?.[1] || '');
    const kind = /fight|打架/.test(kindToken) ? 'fight'
        : /align|对齐/.test(kindToken) ? 'align'
            : /regen|重做|重新生成/.test(kindToken) ? 'regen'
                : '';
    const modules = [];
    const moduleLine = /要动\s*[:：]\s*(.+)/.exec(raw);
    if (moduleLine) {
        for (const [name, label] of Object.entries(MODULE_LABEL)) {
            if (moduleLine[1].includes(label) || moduleLine[1].includes(name)) modules.push(name);
        }
    }
    const items = [];
    for (const line of raw.split('\n')) {
        const match = /^-\s*(点|线|刻度|轴|冷知识|面)「([^」]+)」(?:：(.+))?$/.exec(line.trim());
        if (!match) continue;
        const module = Object.keys(MODULE_LABEL).find(name => MODULE_LABEL[name] === match[1]);
        items.push({ module, title: match[2], change: text(match[3]), ref: '' });
        if (module && !modules.includes(module)) modules.push(module);
    }
    return Object.freeze({
        kind: normalizeLampKind(kind),
        modules: Object.freeze(modules),
        items: Object.freeze(items),
        avoid: text(/不要动\s*[:：]\s*(.+)/.exec(raw)?.[1]),
        reason: text(/依据\s*[:：]\s*(.+)/.exec(raw)?.[1]),
        text: formatLampIntent({ kind, modules, items, avoid: text(/不要动\s*[:：]\s*(.+)/.exec(raw)?.[1]), reason: text(/依据\s*[:：]\s*(.+)/.exec(raw)?.[1]) }),
    });
}

export function intentFromGuide(state = {}, { kind = 'fight' } = {}) {
    const decisions = state.decisions || {};
    const drafts = state.drafts || {};
    const modules = ['point', 'lines', 'outline'].filter(name => decisions[name] === 'apply' && drafts[name]);
    const items = modules.map(name => ({
        module: name,
        title: MODULE_LABEL[name],
        change: '按间草案改这一本',
        ref: '',
    }));
    return Object.freeze({
        kind: normalizeLampKind(kind, 'fight'),
        modules: Object.freeze(modules),
        items: Object.freeze(items),
        reason: text(state.understand),
        avoid: '面整份替换；轴整年重铺；柏宝书',
        drafts: Object.freeze({ ...drafts }),
        source: 'guide',
        text: formatLampIntent({ kind: normalizeLampKind(kind, 'fight'), modules, items, reason: text(state.understand), avoid: '面整份替换；轴整年重铺；柏宝书' }),
    });
}

export function intentFromBasket(items = [], { kind = 'fight', reason = '' } = {}) {
    const list = (Array.isArray(items) ? items : []).map(item => ({
        module: item.module,
        title: text(item.title),
        change: text(item.detail || item.change),
        ref: text(item.ref),
    })).filter(item => item.module && item.title);
    const modules = [...new Set(list.map(item => item.module).filter(name => LAMP_MODULES.includes(name)))];
    return Object.freeze({
        kind: normalizeLampKind(kind, 'fight'),
        modules: Object.freeze(modules),
        items: Object.freeze(list),
        reason: text(reason),
        avoid: '一天行程里的多个地点；未点名的条目；柏宝书',
        source: 'basket',
        text: formatLampIntent({ kind: normalizeLampKind(kind, 'fight'), modules, items: list, reason, avoid: '一天行程里的多个地点；未点名的条目；柏宝书' }),
    });
}

export function defaultKindForHandoff({ from = '', hasConflict = false } = {}) {
    if (from === 'fight' || from === 'conflict' || hasConflict) return 'fight';
    return '';
}
