import { THEATER_COUNT_DEFAULT } from './constants.js';
import { normalizeTheaterCount } from './recipe.js';

function faceOrder(count) {
    return Array.from({ length: count }, (_, i) => String(i + 1)).join(' → ');
}

function openingTags(count) {
    return Array.from({ length: count }, (_, i) => `<theater data-face="${i + 1}">`).join('、');
}

function facePlan(recipes) {
    if (!recipes.length) {
        return '未抽到现成配方：按正文自行想不同体裁（问卷 / 回望 / 聊天记录 / IF 等），不要同构续写。';
    }
    return recipes.map((recipe, i) => [
        `【第 ${i + 1} 面｜输出 data-face="${i + 1}"】`,
        `来源：${recipe.bookName || '未名书'}｜${recipe.title || '(无标题)'}`,
        `配方：`,
        recipe.stripped,
        `局部硬要求：只执行本面配方。不要借用其他面的体裁、题目或结局，不要复制另一面正文后换皮。`,
    ].join('\n')).join('\n\n');
}

function outputProtocol(count) {
    return [
        `棱多面输出【每轮必需】:`,
        `- 直接连续输出 ${count} 个互相平级、各自完整闭合的 <theater>，data-face 顺序固定为 ${faceOrder(count)}。`,
        `- 各面的实际开标签依次为：${openingTags(count)}。每个开标签后先写一行【短标题】，再写纯文字正文，然后 </theater>。`,
        `- ${count} 个标题必须互不相同；据本面实际内容命名，不用母本名或分类名代替。`,
        `- 禁止把多面塞进同一个 <theater>；每面只执行同编号计划，不得交换编号、合并或复制另一面。`,
        `- 只写纯文字。禁止 HTML、CSS、JavaScript、<style>、<script>、<snow>、<toto>、<details>、代码块和解释。`,
        `- 篇幅跟本面配方走：配方写了字数就按配方写够；没写就写到这一面完整收束即可。不要为了凑字注水，也不要因为紧张提前收束。问卷按题量写完。仍须输出恰好 ${count} 面并全部闭合。`,
        `- 只有第 ${count} 面的 </theater> 完整闭合后才结束；中间各面闭合后立即继续下一面，不得追加面外说明。`,
    ].join('\n');
}

function executionLock(recipes, count, boxed) {
    const faceLocks = recipes.length
        ? recipes.map((recipe, i) => `第 ${i + 1} 面：${recipe.bookName || '未名书'}｜${recipe.title || '(无标题)'}。只写这一面的配方。`)
        : [`第 1 面至第 ${count} 面：按正文自行想不同体裁，不得同构。`];
    return [
        `<棱近输出短锁>`,
        boxed
            ? `本轮只输出 1 个完整闭合的 <theater data-face="1">；框里的配方就是这一面，不要另抽。`
            : `本轮必须按 data-face="1" 至 "${count}" 顺序输出 ${count} 个平级、各自闭合的 <theater>；禁止单个 <theater> 内嵌多面。`,
        ...faceLocks,
        `具象的感官与动作，避免概括与套路化开头结尾。`,
        `只有第 ${count} 面闭合后才结束，不得少面、合并、追加面外文字。`,
        `</棱近输出短锁>`,
    ].join('\n');
}

export function buildContinueMessages(userInput, story = null, settings = {}, extras = {}) {
    const context = story || { sysBlocks: [], userName: '用户', charName: '角色' };
    const source = extras.continueFrom || {};
    const direction = String(userInput || '').trim();
    const recipe = source.templateSource?.input
        ? `【原配方（只锁体裁与口吻，不要重写前文）】\n${String(source.templateSource.input)}`
        : '';
    const sysParts = [
        `你是一位小说家，正在为 ${context.userName} 与 ${context.charName} 的故事续写一篇已有的纯文字番外。这不是新开一篇，也不是重写前文。`,
        settings.theaterStylePrompt ? String(settings.theaterStylePrompt).trim() : '',
        ...(Array.isArray(context.sysBlocks) ? context.sysBlocks : []),
        recipe,
        [
            '棱续写输出【本轮必需】:',
            '- 只输出 1 个完整闭合的 <theater data-face="1">。开标签后先写一行【短标题】，再写纯文字正文，然后 </theater>。',
            '- 标题据续写内容命名，可在原标题上加续，不要原样照抄。',
            '- 只写纯文字。禁止 HTML、CSS、JavaScript、<style>、<script>、<snow>、<toto>、<details>、代码块和解释。',
            '- 从前文结束处接着写。不要复述、改写或摘要已经写过的段落。',
            '- 保持体裁、人称、口吻和人物关系。',
            '- 篇幅跟原配方走；配方没写篇幅就写到这一段完整收束即可。插件不限字数。',
            '- 只有 </theater> 完整闭合后才结束，不得追加面外说明。',
        ].join('\n'),
    ].filter(Boolean);
    const userParts = [
        `【已完成的前文】\n标题：${source.title || '(未命名)'}\n\n${String(source.raw || '').trim()}`,
        direction ? `【作者希望接下来看到】\n${direction}` : '作者没有额外方向：顺着前文自然往下写。',
        [
            '<棱近输出短锁>',
            '本轮只输出 1 个完整闭合的 <theater data-face="1">；这是续写，不是新开一篇。',
            '不要复述前文，不要另抽配方。',
            '具象的感官与动作，避免概括与套路化开头结尾。',
            '</棱近输出短锁>',
        ].join('\n'),
        '现在直接输出完整 <theater data-face="1">...</theater>。不要解释。',
    ];
    return [{ role: 'system', content: sysParts.join('\n\n') }, { role: 'user', content: userParts.join('\n\n') }];
}

export function buildWriteMessages(userInput, story = null, settings = {}, extras = {}) {
    if (extras.continueFrom) return buildContinueMessages(userInput, story, settings, extras);
    const context = story || { sysBlocks: [], userName: '用户', charName: '角色' };
    const recipes = Array.isArray(extras.recipes) ? extras.recipes : [];
    const headers = Array.isArray(extras.headers) ? extras.headers : [];
    const boxed = extras.boxed === true;
    const count = recipes.length || normalizeTheaterCount(extras.count ?? settings.theaterCount, THEATER_COUNT_DEFAULT);
    const headerBlock = headers.length
        ? `【抽中书的纯文字规范（已剥除 HTML / 插入指令；不是整本世界书）】\n${headers.map(item => item.stripped).join('\n\n')}`
        : '';
    const request = boxed ? '' : String(userInput || '').trim();
    const sysParts = [
        `你是一位小说家，正在为 ${context.userName} 与 ${context.charName} 的故事创作独立纯文字番外（if 线 / 番外 / 可能性）。`,
        settings.theaterStylePrompt ? String(settings.theaterStylePrompt).trim() : '',
        ...(Array.isArray(context.sysBlocks) ? context.sysBlocks : []),
        headerBlock,
        `事先已经抽签。只写抽中的配方，不要读取或发明未抽中的条目。一次请求写完 ${count} 面，不要同构续写，不要互相解释。`,
        `逐面冻结计划【各面平级；不得互相借用】:\n${facePlan(recipes)}`,
        outputProtocol(count),
    ].filter(Boolean);
    const userParts = [
        request ? `【作者额外要求】\n${request}` : (boxed ? '框里的配方就是本面，不要另抽。' : '作者没有额外要求：只靠正文、角色世界书与逐面计划写。'),
        executionLock(recipes, count, boxed),
        count > 1
            ? `现在依据逐面抽取计划，依次完成 ${count} 个独立成品，每个单独闭合 <theater>；不解释、不复述规则、不合并。`
            : `现在依据近输出短锁完成唯一成品。不要解释，直接输出完整 <theater data-face="1">...</theater>。`,
    ];
    return [{ role: 'system', content: sysParts.join('\n\n') }, { role: 'user', content: userParts.join('\n\n') }];
}
