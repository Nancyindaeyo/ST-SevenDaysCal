// 装配根可见预算。接线可以涨；新业务算法不得进 index.js。
// 超预算时先把行为迁走，或改预算并写明原因。

export const INDEX_LINE_BUDGET = 4550;
export const INDEX_TOPLEVEL_FN_BUDGET = 220;

const FN_DECL = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/;
const FN_ARROW = /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/;

export function inspectIndexSource(source) {
    const text = String(source || '').replace(/\r\n/g, '\n');
    const lines = text.split('\n');
    const topLevel = [];
    for (const line of lines) {
        const declared = line.match(FN_DECL);
        if (declared) {
            topLevel.push(declared[1]);
            continue;
        }
        const arrow = line.match(FN_ARROW);
        if (arrow) topLevel.push(arrow[1]);
    }
    return {
        physicalLines: lines.length,
        topLevelCount: topLevel.length,
        topLevel,
    };
}
