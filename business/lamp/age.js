export function lampAgeOf({ latestFloor = -1, lastAlignFloor = -1 } = {}) {
    const latest = Number.isInteger(Number(latestFloor)) ? Number(latestFloor) : -1;
    const aligned = Number.isInteger(Number(lastAlignFloor)) ? Number(lastAlignFloor) : -1;
    const since = latest >= 0 && aligned >= 0 ? Math.max(0, latest - aligned) : null;
    const latestLabel = latest >= 0 ? `#${latest}` : '还没有';
    const alignedLabel = aligned >= 0 ? `#${aligned}` : '还没有对齐过';
    const sinceLabel = since == null ? '' : (since === 0 ? '就在这一楼。' : `已经过了 ${since} 楼。`);
    return Object.freeze({
        latestFloor: latest,
        lastAlignFloor: aligned,
        floorsSinceAlign: since,
        copy: `冲突只比对账本，不读这几楼正文。最新楼 ${latestLabel}。上次对齐 ${alignedLabel}${sinceLabel ? `，${sinceLabel}` : '。'}`,
    });
}
