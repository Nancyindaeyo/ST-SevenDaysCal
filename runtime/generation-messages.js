import { resolveAlmanacContextText } from './generation-context.js';

export function memoryLibraryBlock(memText, { userName, charName, pointView } = {}) {
    if (!memText) return '';
    const memPerspective = pointView === 'char' ? charName : pointView === 'user' ? userName : null;
    return `【故事记忆库】以下由本插件在对话过程中自动生成的客观摘要，反映从最早到近期的关键事件与伏笔。请**优先信任记忆库描述**，即使它与角色卡/世界书中较早的描述冲突（因为记忆库记录了事件后的最新状态）。${memPerspective ? `点视角优先关注对${memPerspective}有意义的信息。` : '请按当前聊天主角色上下文理解，不继承点的 TA 视角。'}\n\n${memText}`;
}

export function baiBaiBookGarnishBlock(text) {
    if (!text) return '';
    return `【柏宝书当前账】以下是柏宝书此刻的结构化记录，只作配料。生成点/线时对齐这些计划与人物，不要另起一套；点仍然是从今天起的日程格，不是把计划整本搬过去。\n${text}`;
}

export function almanacLibraryBlock(almanacText) {
    if (!almanacText) return '';
    return `【本世界观·重要日期（历）】以下是这个世界的既定节日、生日、纪念日等重要日子，已按「当前剧情日期」标注倒计时；每条冒号后的「说明」是该日子的既定设定（由来、涉及人物阵营、习俗活动、持续天数等），是背景事实。\n${almanacText}\n\n★ 推演点/线/大纲时：凡列在【近期将至】里的日子（未来数日内或进行中），应**主动**把它纳入近期剧情——依据其「说明」里的设定生成与之相关的铺垫、筹备、事件或人物动向，让故事顺着该世界的历法自然推进；【全年其他重要日子】作为背景，时间线接近时再纳入考量。\n★ 务必尊重每条「说明」里的既定设定，据此展开合理、可延续的剧情；说明里没写到的细节可以合理补完，但**不得编造与既定设定冲突的内容**。`;
}

export function calendarLibraryBlock(calDescText) {
    if (!calDescText) return '';
    return `【本世界观·现行历法（纪年）】${calDescText}\n推演点/线/大纲涉及日期时，一律以此历法为准（月份数、每月天数、纪年名），不要默认套用公历的 12 月 / 31 日。`;
}

export function readCardExtras(ctx) {
    const sub = typeof ctx?.substituteParams === 'function' ? ctx.substituteParams : (s => s);
    return {
        personaDesc: String(sub(ctx?.powerUserSettings?.persona_description || '')).trim(),
        authorNote: String(sub(ctx?.chatMetadata?.note_prompt || '')).trim(),
    };
}

export function observerSystemPrompt({
    userName,
    charName,
    personaDesc = '',
    character = {},
    authorNote = '',
    extraBlocks = [],
} = {}) {
    return [
        `你是一位旁观者和叙事分析助手，负责以第三人称视角分析 ${userName} 与 ${charName} 的故事。`,
        `不要扮演任何角色，不要使用第一人称。所有输出必须以第三人称叙述。`,
        personaDesc ? `【${userName} 的人物设定】\n${personaDesc}` : '',
        character.description ? `【${charName} 的背景资料】\n${character.description}` : '',
        character.personality ? `【性格】${character.personality}` : '',
        character.scenario ? `【场景】${character.scenario}` : '',
        authorNote ? `【作者注释（当前聊天）】\n${authorNote}` : '',
        ...extraBlocks,
    ].filter(Boolean).join('\n\n');
}

export function mapVisibleHistoryMessage(message, { substituteParams, sanitize } = {}) {
    const content = sanitize?.(message?.mes ?? '') ?? String(message?.mes ?? '');
    return {
        role: message?.is_user ? 'user' : 'assistant',
        content: typeof substituteParams === 'function' ? substituteParams(content) : content,
    };
}

export function ledgerSourceHistory(floors = []) {
    return floors.map(source => ({
        role: 'assistant',
        content: `【刻度可信来源｜楼层 ${source.floor}｜${source.sources?.length ? source.sources.map(x => `${x.token}=${x.stamp}`).join('、') : '无合法 SDC 令牌，仅供识别正文'}】\n${source.content || ''}`,
    }));
}

export function assembleGenerationMessages({ system, history = [], prompt }) {
    return [{ role: 'system', content: system }, ...history, { role: 'user', content: prompt }];
}

export function almanacBlockForOptions(options, readAlmanac) {
    return almanacLibraryBlock(resolveAlmanacContextText(options, readAlmanac));
}
