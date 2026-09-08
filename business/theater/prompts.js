import { THEATER_COUNT_DEFAULT, THEATER_TARGET_CHARS } from './constants.js';
import { normalizeTheaterCount } from './recipe.js';

export function buildWriteMessages(userInput, story = null, settings = {}, extras = {}) {
    const context = story || { sysBlocks: [], userName: '用户', charName: '角色' };
    const count = normalizeTheaterCount(extras.count ?? settings.theaterCount, THEATER_COUNT_DEFAULT);
    const recipes = Array.isArray(extras.recipes) ? extras.recipes : [];
    const headers = Array.isArray(extras.headers) ? extras.headers : [];
    const recipeBlock = recipes.length
        ? recipes.map((recipe, i) => `【抽签 ${i + 1} · ${recipe.title || '(无标题)'}】\n${recipe.stripped}`).join('\n\n')
        : '未抽到现成配方：按正文自行想 1～3 种不同体裁（问卷 / 回望 / 聊天记录 / IF 等），不要同构续写。';
    const headerBlock = headers.length
        ? `【书内纯文字规范（已剥除 HTML / 插入指令）】\n${headers.map(item => item.stripped).join('\n\n')}`
        : '';
    const request = String(userInput || '').trim();
    const sysParts = [
        `你是一位小说家，正在为 ${context.userName} 与 ${context.charName} 的故事创作独立纯文字番外（if 线 / 番外 / 可能性）。`,
        settings.theaterStylePrompt ? String(settings.theaterStylePrompt).trim() : '',
        ...(Array.isArray(context.sysBlocks) ? context.sysBlocks : []),
        headerBlock,
        `【硬性约束】`,
        `- 只写纯文字。禁止输出 HTML、CSS、JavaScript、<style>、<script>、<snow>、<toto>、<details>。`,
        `- 一次写出 ${count} 条彼此不同的番外，不要同构续写，不要互相解释。`,
        `- 每条约 ${THEATER_TARGET_CHARS} 字（问卷、一百问、IF 都按这个收，不要拉到几千字）。`,
        `- 具象的感官与动作，避免概括与套路化开头结尾。`,
        `- 必须按下面的 XML 输出，不要前言后语，不要代码块包裹。`,
        `【输出格式】`,
        `<theater_piece>`,
        `<title>短标题</title>`,
        `<form_name>体裁名，如相性100问</form_name>`,
        `<form_seed>以后怎么再出这种体：结构、题量、口吻、禁忌。不要贴本轮答完的题。</form_seed>`,
        `<theme_name>本季气味的两三个词</theme_name>`,
        `<theme_seed>这一季气味与关系，短，不剧透全文</theme_seed>`,
        `<body>纯文字正文</body>`,
        `</theater_piece>`,
        `共 ${count} 个 theater_piece。`,
        `【抽到的配方】`,
        recipeBlock,
    ].filter(Boolean);
    const userParts = [
        request ? `【作者额外要求】\n${request}` : '作者没有额外要求：只靠正文与抽签配方写。',
        `请直接输出 ${count} 个 <theater_piece>。`,
    ];
    return [{ role: 'system', content: sysParts.join('\n\n') }, { role: 'user', content: userParts.join('\n\n') }];
}
