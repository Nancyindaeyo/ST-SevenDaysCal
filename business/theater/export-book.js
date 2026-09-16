import { THEATER_EXPORT_BOOK } from './constants.js';

function keysFromTitle(kind, name) {
    const text = String(name || '').trim();
    const extras = kind === 'form' ? ['展现形式', '问答', '体裁'] : ['主题'];
    const words = text.split(/[\s/｜|,，、]+/).map(part => part.trim()).filter(Boolean).slice(0, 3);
    return [...new Set([...extras, ...words])];
}

function worldInfoEntry(uid, comment, keys, content) {
    return {
        uid,
        displayIndex: uid,
        comment,
        disable: true,
        constant: false,
        selective: true,
        key: keys,
        selectiveLogic: 0,
        keysecondary: [],
        scanDepth: null,
        vectorized: false,
        position: 0,
        role: 0,
        depth: 4,
        order: 100,
        content,
        useProbability: true,
        probability: 100,
        excludeRecursion: false,
        preventRecursion: false,
        delayUntilRecursion: false,
        sticky: 0,
        cooldown: 0,
        delay: 0,
        addMemo: true,
        group: '',
        groupOverride: false,
        groupWeight: 100,
    };
}

function formSeedOf(piece) {
    const named = String(piece?.formSeed || '').trim();
    if (named) return named;
    const source = String(piece?.templateSource?.input || '').trim();
    if (source) return `体裁：${piece.formName || piece.templateSource?.title || '纯文字番外'}。\n结构与口吻参考：\n${source.slice(0, 1600)}\n\n以后再写这种体：不要贴本轮已经答完的题或问卷全文；保持禁忌与不 OOC。`;
    return `以后用「${piece?.formName || '纯文字番外'}」这种体再写：保留结构、题量感、口吻和禁忌，不要复述某一轮成品全文。`;
}

function themeSeedOf(piece) {
    const named = String(piece?.themeSeed || '').trim();
    if (named) return named;
    const title = String(piece?.themeName || piece?.title || '').trim();
    if (title) return `${title}。只写这一季的气味、关系与场合，短，不剧透全文。`;
    return String(piece?.raw || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function likedTheaterPieces(lists = []) {
    return lists.flatMap(list => Array.isArray(list) ? list : []).filter(piece => piece && piece.liked === true && String(piece.raw || '').trim());
}

export function buildTheaterExportBook(pieces, { bookName = THEATER_EXPORT_BOOK } = {}) {
    const entries = {};
    let uid = 0;
    for (const piece of likedTheaterPieces([pieces])) {
        const formName = String(piece.formName || piece.templateSource?.title || '纯文字番外').trim() || '纯文字番外';
        entries[String(uid)] = worldInfoEntry(uid, `展现形式｜${formName}`, keysFromTitle('form', formName), formSeedOf(piece));
        uid += 1;
    }
    return { name: bookName, entries };
}

export function theaterExportJson(book) {
    return `${JSON.stringify(book, null, 2)}\n`;
}

export function createTheaterExporter({ context, download, bookName = THEATER_EXPORT_BOOK, templates } = {}) {
    return {
        async export(pieces) {
            const book = buildTheaterExportBook(pieces, { bookName });
            const count = Object.keys(book.entries || {}).length;
            if (!count) return { ok: false, reason: 'empty', count: 0, bookName };
            const forms = Object.values(book.entries || {}).map(entry => ({ title: entry.comment, text: entry.content }));
            try {
                if (forms.length && templates?.addBatch) await templates.addBatch(forms);
            } catch { /* 模板堆写入失败仍继续导出母本 */ }
            try {
                const ctx = typeof context === 'function' ? context() : context;
                if (typeof ctx?.saveWorldInfo === 'function') {
                    await ctx.saveWorldInfo(bookName, { entries: book.entries }, true);
                    await ctx.updateWorldInfoList?.();
                }
            } catch { /* 写入酒馆失败时仍提供下载 */ }
            try { download?.(`${bookName}.json`, theaterExportJson(book)); } catch { /* 下载失败不阻断已写入的书 */ }
            return { ok: true, count, bookName, templateCount: forms.length };
        },
    };
}
