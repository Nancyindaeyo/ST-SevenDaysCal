export function selectUnsummarizedFloors({ floors = [], coveredMesIds = [], recentWindowFloors = [], groupSize = 5, excludeMesIds = [], maxChars = 2000 } = {}) {
    const covered = new Set((Array.isArray(coveredMesIds) ? coveredMesIds : []).map(value => String(value)));
    const excluded = new Set((Array.isArray(excludeMesIds) ? excludeMesIds : []).map(value => String(value)));
    const list = Array.isArray(floors) ? floors : [];
    let chosen;
    if (covered.size) {
        const coveredNumbers = [...covered].map(Number).filter(Number.isFinite);
        const latestCovered = coveredNumbers.length ? Math.max(...coveredNumbers) : null;
        const rawIds = new Set();
        for (const floor of Array.isArray(recentWindowFloors) ? recentWindowFloors : []) {
            const id = String(floor?.mesid);
            if (!covered.has(id)) rawIds.add(id);
        }
        if (latestCovered !== null) {
            for (const floor of list) {
                if (Number(floor?.mesid) > latestCovered && !covered.has(String(floor.mesid))) rawIds.add(String(floor.mesid));
            }
        }
        chosen = list.filter(floor => rawIds.has(String(floor?.mesid)));
    } else {
        const size = Math.max(1, Number(groupSize) || 5);
        chosen = list.slice(-size * 6);
    }
    const seen = new Set();
    const out = [];
    for (const floor of chosen) {
        const id = String(floor?.mesid);
        const text = String(floor?.text || '').trim().slice(0, maxChars);
        if (!text || excluded.has(id) || seen.has(id)) continue;
        seen.add(id);
        out.push({ mesid: id, text });
    }
    return out;
}
