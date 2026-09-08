import { THEATER_COUNT_DEFAULT, THEATER_TARGET_CHARS } from './constants.js';
import { normalizeTheaterCount } from './recipe.js';

export function buildWriteMessages(userInput, story = null, settings = {}, extras = {}) {
    const context = story || { sysBlocks: [], userName: '用户', charName: '角色' };
    const recipes = Array.isArray(extras.recipes) ? extras.recipes : [];
    const headers = Array.isArray(extras.headers) ? extras.headers : [];
    const boxed = extras.boxed === true;
    const count = recipes.length || normalizeTheaterCount(extras.count ?? settings.theaterCount, THEATER_COUNT_DEFAULT);
    const recipeBlock = recipes.length
        ? recipes.map((recipe, i) => `【抽签 ${i + 1}｜${recipe.bookName || '未名书'}｜${recipe.title || '(无标题)'}】\n${recipe.stripped}`).join('\n\n')
        : '未抽到现成配方：按正文自行想不同体裁（问卷 / 回望 / 聊天记录 / IF 等），不要同构续写。';
    const bindBlock = recipes.length
        ? recipes.map((_, i) => `- 第 ${i + 1} 条按抽签 ${i + 1} 写，不要混用其他抽签，不要另起没抽到的体裁。`).join('\n')
        : '';
    const headerBlock = headers.length
        ? `【抽中书的纯文字规范（已剥除 HTML / 插入指令；不是整本世界书）】\n${headers.map(item => item.stripped).join('\n\n')}`
        : '';
    const request = boxed ? '' : String(userInput || '').trim();
    const sysParts = [
        `你是一位小说家，正在为 ${context.userName} 与 ${context.charName} 的故事创作独立纯文字番外（if 线 / 番外 / 可能性）。`,
        settings.theaterStylePrompt ? String(settings.theaterStylePrompt).trim() : '',
        ...(Array.isArray(context.sysBlocks) ? context.sysBlocks : []),
        headerBlock,
        `【硬性约束】`,
        `- 只写纯文字。禁止输出 HTML、CSS、JavaScript、<style>、<script>、<snow>、<toto>、<details>。`,
        `- 事先已经抽签。只写抽中的配方，不要读取或发明未抽中的条目。`,
        `- 一次写出 ${count} 条彼此不同的番外，不要同构续写，不要互相解释。`,
        `- 每条约 ${THEATER_TARGET_CHARS} 字，问卷按题量写完即可，不要为凑字注水。`,
        `- 具象的感官与动作，避免概括与套路化开头结尾。`,
        `- 用下面的松格式直接开写。不要前言后语，不要代码块包裹。标题可以省略。`,
        bindBlock,
        `【输出格式】`,
        `【番外】`,
        `标题：短标题`,
        `正文从此处写起。`,
        `要几条就重复几次【番外】。共 ${count} 条。`,
        `【抽到的配方】`,
        recipeBlock,
    ].filter(Boolean);
    const userParts = [
        request ? `【作者额外要求】\n${request}` : (boxed ? '框里的配方就是本条，不要另抽，只写这一条。' : '作者没有额外要求：只靠正文、角色世界书与抽签配方写。'),
        `请直接写出 ${count} 条番外。`,
    ];
    return [{ role: 'system', content: sysParts.join('\n\n') }, { role: 'user', content: userParts.join('\n\n') }];
}
