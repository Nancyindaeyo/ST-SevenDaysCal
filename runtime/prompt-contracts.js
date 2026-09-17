export const PROMPT_CONTRACTS = Object.freeze({
    align: Object.freeze({
        version: 1,
        summary: '锁定保护、纠偏补丁与 reconcile_patch 输出合同',
        maxChars: 60000,
        required: Object.freeze(['纠偏补丁，不是整表洗牌', '<reconcile_patch>', '</reconcile_patch>', '锁定条目']),
    }),
    fight: Object.freeze({
        version: 1,
        summary: '点名修改范围与 fight_patch 输出合同',
        maxChars: 60000,
        required: Object.freeze(['打架补丁', '<fight_patch>', '</fight_patch>', '只改下面点名']),
    }),
    regenerate: Object.freeze({
        version: 1,
        summary: '勾选模块重做、反馈与锁定保护追加合同',
        maxChars: 12000,
        required: Object.freeze(['按用户要求重做勾选模块', '锁定标题仍须保留', '为什么刷新']),
    }),
    'outline-judge': Object.freeze({
        version: 1,
        summary: '面游标二值判定合同',
        maxChars: 24000,
        required: Object.freeze(['只回答一个词：推进 或 未推进', '不要解释']),
    }),
    'lines-advance': Object.freeze({
        version: 1,
        summary: '旧线完整返回、临时 Ticket 与 storylines_widget 合同',
        maxChars: 90000,
        required: Object.freeze(['<storylines_widget>', '</storylines_widget>', '旧线保持原名并完整输出', 'Ticket 不得缺失']),
    }),
    'ledger-capture': Object.freeze({
        version: 1,
        summary: '刻度新增去重、字段格式与空结果合同',
        maxChars: 90000,
        required: Object.freeze(['需要按时间追踪', '若没有任何新事件可登记，只回一个字：无', '不要输出表头']),
    }),
    'ledger-judge': Object.freeze({
        version: 1,
        summary: '刻度状态变化、动作枚举与空结果合同',
        maxChars: 60000,
        required: Object.freeze(['只输出状态**有变化**的条目', '维持 / 了结 / 滚周期', '不要输出没变化的条目']),
    }),
});

export function promptContractVersions() {
    return Object.fromEntries(Object.entries(PROMPT_CONTRACTS).map(([id, contract]) => [id, contract.version]));
}

export function promptContractCatalog() {
    return Object.fromEntries(Object.entries(PROMPT_CONTRACTS).map(([id, contract]) => [id, {
        version: contract.version,
        summary: contract.summary,
        maxChars: contract.maxChars,
    }]));
}

export function validatePromptContract(id, prompt) {
    const contract = PROMPT_CONTRACTS[id];
    if (!contract) return { ok: false, id, version: null, missing: ['unknown-contract'], charCount: 0, estimatedTokens: 0, overBudget: false };
    const text = String(prompt || '');
    const missing = contract.required.filter(marker => !text.includes(marker));
    const charCount = text.length;
    const overBudget = charCount > contract.maxChars;
    return {
        ok: missing.length === 0 && !overBudget,
        id,
        version: contract.version,
        missing,
        charCount,
        estimatedTokens: Math.ceil(charCount / 2),
        overBudget,
    };
}

const USER_PROMPT_CONFLICTS = Object.freeze([
    Object.freeze({ code: 'ignore-contract', label: '要求忽略机器合同或固定格式', pattern: /忽略.{0,16}(合同|格式|结构|锁定|系统指令)/i }),
    Object.freeze({ code: 'rewrite-all', label: '要求重写整表或覆盖全部旧条目', pattern: /(重写|覆盖|推倒).{0,12}(整表|整张|全部|所有旧)/i }),
    Object.freeze({ code: 'extra-output', label: '要求输出 HTML、Markdown 或代码块', pattern: /(输出|使用|包裹).{0,12}(html|markdown|代码块)/i }),
]);

export function detectPromptContractConflicts(prompt) {
    const text = String(prompt || '');
    return USER_PROMPT_CONFLICTS
        .filter(item => item.pattern.test(text))
        .map(item => ({ code: item.code, label: item.label }));
}
