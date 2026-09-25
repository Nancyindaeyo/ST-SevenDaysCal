export function groupOutlineVolumes(beats = []) {
    const groups = [];
    const indexOf = new Map();
    (Array.isArray(beats) ? beats : []).forEach((beat, index) => {
        const title = String(beat?.volume || '').trim() || '未分卷';
        let group = indexOf.get(title);
        if (!group) {
            group = { title, beats: [], indices: [] };
            indexOf.set(title, group);
            groups.push(group);
        }
        group.beats.push(beat);
        group.indices.push(index);
    });
    return groups;
}

export function cursorVolumeTitle(beats = [], cursor = 0) {
    const index = Math.max(0, Math.floor(Number(cursor) || 0) - 1);
    const beat = (Array.isArray(beats) ? beats : [])[index];
    return beat ? String(beat.volume || '').trim() || '未分卷' : '';
}
