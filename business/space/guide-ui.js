import { GUIDE_MODULES } from './guide-schema.js';

const MODULE_LABEL = { point: '点（日程）', lines: '线（平行事件）', outline: '面（长线大纲）' };

function optionButtons(options, prefix) {
    return (options || []).map((label, index) => `<button type="button" class="sp-btn ${prefix}" data-idx="${index}">${label}</button>`).join('');
}

export function renderSpaceGuide(state = {}, escape = value => String(value ?? '')) {
    if (!state || state.phase === 'idle') return '';
    const nav = `<div class="sp-guide-nav">
        <button type="button" class="sp-btn" data-guide="back">上一步</button>
        <button type="button" class="sp-btn" data-guide="reset">重置</button>
        <button type="button" class="sp-btn" data-guide="stop">不用问了</button>
    </div>`;
    const busy = state.busy ? '<div class="sp-empty sp-fold-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>顾问想一下…</p></div>' : '';
    const err = state.error ? `<p class="sp-cfg-hint">${escape(state.error)}</p>` : '';

    if (state.phase === 'entry') {
        return `<div class="sp-guide">
            <p class="sp-intro-lede">先收束点 / 线 / 面。不问番外，不填棱。确认前不会改正式账本。</p>
            <div class="sp-guide-actions">
                <button type="button" class="sp-btn sp-btn-primary" data-guide="inspire">给我灵感</button>
                <button type="button" class="sp-btn" data-guide="describe">我来描述</button>
            </div>
            ${busy}${err}
        </div>`;
    }

    if (state.phase === 'inspire') {
        const cards = (state.inspirations || []).map((card, index) => `<button type="button" class="sp-guide-card" data-guide="pick" data-idx="${index}"><b>${escape(card.title)}</b><span>${escape(card.body)}</span></button>`).join('');
        return `<div class="sp-guide">
            <p class="sp-intro-lede">选一条当种子，或换一批。</p>
            <div class="sp-guide-cards">${cards}</div>
            <div class="sp-guide-actions">
                <button type="button" class="sp-btn" data-guide="inspire" ${state.busy ? 'disabled' : ''}>换一批</button>
            </div>
            ${nav}${busy}${err}
        </div>`;
    }

    if (state.phase === 'describe') {
        return `<div class="sp-guide">
            <p class="sp-intro-lede">用几句话写你想要的方向。下面输入框发送即可。</p>
            ${nav}${busy}${err}
        </div>`;
    }

    if (state.phase === 'ask') {
        const question = state.question || {};
        return `<div class="sp-guide">
            <p class="sp-intro-lede">${escape(question.prompt || '')}</p>
            <div class="sp-guide-actions">${optionButtons(question.options, 'sp-guide-opt')}</div>
            <p class="sp-cfg-hint">也可以在输入框写自定义，或跳过。</p>
            <div class="sp-guide-actions">
                <button type="button" class="sp-btn" data-guide="skip">跳过</button>
                <button type="button" class="sp-btn sp-btn-primary" data-guide="next">下一步</button>
            </div>
            ${nav}${busy}${err}
        </div>`;
    }

    if (state.phase === 'draft') {
        const blocks = GUIDE_MODULES.map(name => {
            const draft = state.drafts?.[name] || '';
            const decision = state.decisions?.[name] || 'pending';
            const comment = escape(state.comments?.[name] || '');
            return `<section class="sp-guide-draft" data-mod="${name}">
                <div class="sp-guide-draft-head"><b>${MODULE_LABEL[name]}</b><span class="sp-fold-hint">${decision === 'pending' ? '未选' : decision === 'apply' ? '将按草案改' : decision === 'keep' ? '保持现状' : '不用你想'}</span></div>
                <pre class="sp-guide-pre">${escape(draft || '（没有草案）')}</pre>
                <div class="sp-guide-actions">
                    <button type="button" class="sp-btn${decision === 'keep' ? ' sp-btn-primary' : ''}" data-guide="keep">保持</button>
                    <button type="button" class="sp-btn${decision === 'apply' ? ' sp-btn-primary' : ''}" data-guide="apply">按草案改</button>
                    <button type="button" class="sp-btn${decision === 'skip' ? ' sp-btn-primary' : ''}" data-guide="skip-mod">不用你想</button>
                </div>
                <label class="sp-refresh-field"><span>我写意见</span><textarea class="sp-input sp-guide-comment" rows="2" placeholder="只改这一块">${comment}</textarea></label>
                <button type="button" class="sp-btn" data-guide="redo">按意见重做这块</button>
            </section>`;
        }).join('');
        return `<div class="sp-guide">
            <p class="sp-intro-lede">${escape(state.understand || '先看草案，确认后才写入账本。')}</p>
            ${blocks}
            <label class="sp-mode-opt"><input type="checkbox" id="sp-guide-want-beat"${state.wantBeat ? ' checked' : ''}><span>顺手出本轮拍</span></label>
            <div class="sp-guide-actions">
                <button type="button" class="sp-btn sp-btn-primary" data-guide="commit">确认写入</button>
            </div>
            ${nav}${busy}${err}
        </div>`;
    }

    return '';
}

export function spaceGuideEmptyHtml() {
    return `<div class="sp-guide-empty">
        <i class="fa-solid fa-comments"></i>
        <p>间是局外顾问。可以直接聊天，或让它带你收束点 / 线 / 面。</p>
        <button type="button" class="sp-btn sp-btn-primary" id="sp-space-guide-start">引导设计</button>
        <p class="sp-cfg-hint">不问番外，不填棱。确认前不会改账本。</p>
    </div>`;
}
