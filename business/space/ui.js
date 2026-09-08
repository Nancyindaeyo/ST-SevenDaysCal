import { spaceMessagePlainText } from './schema.js';
import { renderSpaceGuide, spaceGuideEmptyHtml } from './guide-ui.js';

export function createSpaceUi(host = {}) {
    const query = host.query || (() => null);
    const element = host.element || (() => null);
    const escape = value => host.escapeHtml?.(String(value ?? '')) ?? String(value ?? '');
    const isMobileViewport = () => {
        const injected = host.isMobile?.();
        if (typeof injected === 'boolean') return injected;
        const width = Number(globalThis.window?.innerWidth ?? globalThis.innerWidth);
        return Number.isFinite(width) && width <= 640;
    };
    const widgets = new Map();
    let widgetSeq = 0;
    let controllers = null;
    let guide = null;
    let bound = false;

    const registerWidget = widget => {
        const wid = String(++widgetSeq);
        widgets.set(wid, { kind: widget.kind, body: widget.body, editIdx: widget.editIdx });
        return wid;
    };
    const appendMessage = (role, content, historyIndex = null) => {
        const parts = controllers.renderer.message(role, content, historyIndex, registerWidget);
        const $wrap = host.$?.('<div>').addClass(`sp-chat-msg-wrap ${parts.wrapClass}`);
        if (!$wrap) return;
        if (parts.canAct) $wrap.attr('data-idx', historyIndex);
        if (parts.contentHtml) {
            const $message = host.$('<div>').addClass(`sp-chat-msg ${parts.cls}`);
            $message.html(`<div class="sp-chat-msg-content">${parts.contentHtml}</div>`);
            $wrap.append($message);
        }
        if (parts.widgetCards) $wrap.append(parts.widgetCards);
        if (parts.actions) $wrap.append(parts.actions);
        $wrap.appendTo(query('#sp-space-msgs'));
        const messages = element('#sp-space-msgs');
        if (messages) messages.scrollTop = messages.scrollHeight;
    };
    const renderHistory = history => {
        if (guide?.isActive?.()) {
            renderGuide(guide.snapshot());
            return;
        }
        query('#sp-space-msgs')?.empty?.();
        if (!history?.length) {
            query('#sp-space-msgs')?.html?.(spaceGuideEmptyHtml());
            return;
        }
        history.forEach((message, index) => appendMessage(message.role === 'assistant' ? 'ai' : message.role, message.content, index));
    };
    const renderGuide = snapshot => {
        const $msgs = query('#sp-space-msgs');
        if (!$msgs?.length) return;
        $msgs.html(renderSpaceGuide(snapshot, escape));
        const messages = element('#sp-space-msgs');
        if (messages) messages.scrollTop = messages.scrollHeight;
        const phase = snapshot?.phase;
        if (phase === 'describe') query('#sp-space-input')?.attr?.('placeholder', '描述你想要的方向，发送即可');
        else if (phase === 'ask') query('#sp-space-input')?.attr?.('placeholder', '自定义回答，发送即下一步；可留空点跳过');
        else query('#sp-space-input')?.attr?.('placeholder', '局外聊聊：剧情、设定、关系、知识…');
    };
    const emptyMessages = () => query('#sp-space-msgs')?.empty?.();
    const beginThinking = () => {
        const $dots = host.$?.('<div>')
            .addClass('sp-chat-msg sp-chat-msg-ai sp-chat-thinking')
            .html('<span class="sp-typing"><i></i><i></i><i></i></span>')
            .appendTo(query('#sp-space-msgs'));
        const messages = element('#sp-space-msgs');
        if (messages) messages.scrollTop = messages.scrollHeight;
        return $dots;
    };
    const endThinking = thinking => thinking?.remove?.();

    const startEdit = ($message, index) => {
        const original = controllers.chat.history()[index]?.content ?? '';
        $message.find('.sp-chat-msg-content').replaceWith(`<textarea class="sp-chat-msg-editor">${escape(original)}</textarea>`);
        $message.find('.sp-chat-msg-actions').replaceWith(
            '<div class="sp-chat-msg-actions sp-chat-msg-editing">' +
            '<button class="sp-chat-msg-edit-save">保存并重发</button>' +
            '<button class="sp-chat-msg-edit-cancel">取消</button></div>',
        );
        const $textarea = $message.find('.sp-chat-msg-editor');
        $textarea.trigger('focus');
        const value = $textarea.val();
        $textarea[0]?.setSelectionRange?.(value.length, value.length);
        $message.find('.sp-chat-msg-edit-cancel').on('click', () => renderHistory(controllers.chat.history()));
        $message.find('.sp-chat-msg-edit-save').on('click', () => {
            if (controllers.chat.busy) return;
            const next = String($textarea.val() || '').trim();
            if (next) void controllers.chat.resendFrom(index, next);
        });
        $textarea.on('keydown', event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                $message.find('.sp-chat-msg-edit-save').trigger('click');
            } else if (event.key === 'Escape') {
                event.preventDefault();
                renderHistory(controllers.chat.history());
            }
        });
    };

    const bind = () => {
        if (bound) return;
        const $root = query('#sp-space-wrap');
        if (!$root?.length) return;
        bound = true;
        $root.off('.spSpaceFeature');
        const sendInput = () => {
            const $input = query('#sp-space-input');
            const message = String($input?.val?.() || '').trim();
            if (guide?.isActive?.()) {
                if (guide.busy) return;
                $input.val('');
                host.autoGrow?.($input[0]);
                const phase = guide.snapshot?.().phase;
                if (phase === 'describe') {
                    if (!message) { host.toast?.('先写几句方向', true); return; }
                    guide.submitDescription(message);
                    return;
                }
                if (phase === 'ask') {
                    if (message) guide.answerCurrent(message);
                    else guide.skipCurrent();
                    return;
                }
                return;
            }
            if (!message || controllers.chat.busy) return;
            $input.val('');
            host.autoGrow?.($input[0]);
            void controllers.chat.send(message);
        };
        $root.on('click.spSpaceFeature', '#sp-space-send', sendInput);
        if (!isMobileViewport()) {
            $root.on('keydown.spSpaceFeature', '#sp-space-input', event => {
                const nativeEvent = event.originalEvent;
                if (event.key !== 'Enter' || event.shiftKey || event.isComposing || nativeEvent?.isComposing || event.repeat || nativeEvent?.repeat) return;
                event.preventDefault();
                sendInput();
            });
        }
        $root.on('input.spSpaceFeature', '#sp-space-input', function () { host.autoGrow?.(this); });
        $root.on('click.spSpaceFeature', '.sp-chat-msg-delete', function () {
            if (controllers.chat.busy) return;
            const index = Number(host.$(this).closest('.sp-chat-msg-wrap').attr('data-idx'));
            controllers.chat.remove(index);
        });
        $root.on('click.spSpaceFeature', '.sp-chat-msg-copy', async function () {
            const index = Number(host.$(this).closest('.sp-chat-msg-wrap').attr('data-idx'));
            if (!Number.isInteger(index) || index < 0 || index >= controllers.chat.history().length) return;
            const $button = host.$(this);
            const oldTimer = $button.data('sp-copy-reset');
            if (oldTimer) clearTimeout(oldTimer);
            const copied = await host.copyText?.(spaceMessagePlainText(controllers.chat.history()[index]));
            $button.html(copied ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>')
                .attr('title', copied ? '已复制' : '复制失败');
            const timer = setTimeout(() => {
                $button.html('<i class="fa-solid fa-copy"></i>').attr('title', '复制').removeData('sp-copy-reset');
            }, 1200);
            $button.data('sp-copy-reset', timer);
        });
        $root.on('click.spSpaceFeature', '.sp-chat-msg-edit', function () {
            if (controllers.chat.busy) return;
            const $message = host.$(this).closest('.sp-chat-msg-wrap');
            const index = Number($message.attr('data-idx'));
            if (Number.isInteger(index) && index >= 0 && index < controllers.chat.history().length) startEdit($message, index);
        });
        $root.on('click.spSpaceFeature', '.sp-space-widget-apply', function () {
            const $button = host.$(this);
            if ($button.prop('disabled')) return;
            const stored = widgets.get($button.attr('data-wid'));
            if (!stored) {
                host.toast?.('这张卡片已过期，请再让 AI 生成一次', true);
                return;
            }
            const actions = host.widgetActions?.() || {};
            if (stored.kind === 'schedule_widget') actions.point?.(stored.body, $button, stored.editIdx);
            else if (stored.kind === 'line_widget') actions.lines?.(stored.body, stored.editIdx, $button);
            else if (stored.kind === 'almanac_widget') actions.almanac?.(stored.body, $button, $button.attr('data-idx'));
            else if (stored.kind === 'era_widget') actions.era?.(stored.body, $button);
        });
        $root.on('click.spSpaceFeature', '#sp-space-clear', async () => {
            if (guide?.isActive?.()) {
                guide.leave();
                return;
            }
            if (controllers.chat.busy || !controllers.chat.history().length) return;
            const confirmed = await host.confirm?.({
                title: '清空对话',
                body: '将清空"间"的局外聊天记录。',
                confirmText: '清空',
                cancelText: '取消',
            });
            if (confirmed) controllers.chat.clear();
        });
        $root.on('click.spSpaceFeature', '#sp-space-guide, #sp-space-guide-start', () => {
            if (controllers.chat.busy || guide?.busy) return;
            guide?.start?.();
        });
        $root.on('click.spSpaceFeature', '[data-guide]', function (event) {
            event.preventDefault();
            if (!guide || guide.busy) return;
            const action = String(this.getAttribute('data-guide') || '');
            const $section = host.$(this).closest('.sp-guide-draft');
            const module = $section.attr('data-mod');
            if (action === 'inspire') void guide.inspire();
            else if (action === 'describe') guide.describe();
            else if (action === 'pick') guide.pickInspiration(Number(this.getAttribute('data-idx')));
            else if (action === 'skip') guide.skipCurrent();
            else if (action === 'next') {
                const message = String(query('#sp-space-input')?.val?.() || '').trim();
                query('#sp-space-input')?.val?.('');
                if (message) guide.answerCurrent(message);
                else if (guide.snapshot().step >= 2) void guide.finishAsking();
                else guide.skipCurrent();
            }
            else if (action === 'back') guide.back();
            else if (action === 'reset') guide.reset();
            else if (action === 'stop') void guide.finishAsking();
            else if (action === 'keep') guide.decide(module, 'keep');
            else if (action === 'apply') guide.decide(module, 'apply');
            else if (action === 'skip-mod') guide.decide(module, 'skip');
            else if (action === 'redo') void guide.redoModule(module);
            else if (action === 'commit') void guide.commit();
        });
        $root.on('click.spSpaceFeature', '.sp-guide-opt', function () {
            if (!guide || guide.busy) return;
            guide.answerCurrent(String(this.textContent || '').trim());
        });
        $root.on('input.spSpaceFeature', '.sp-guide-comment', function () {
            const module = host.$(this).closest('.sp-guide-draft').attr('data-mod');
            guide?.setComment?.(module, this.value);
        });
        $root.on('change.spSpaceFeature', '#sp-guide-want-beat', function () {
            guide?.setWantBeat?.(this.checked);
        });
    };
    return Object.freeze({
        bindControllers: value => { controllers = value; },
        bindGuide: value => { guide = value; },
        bind,
        renderHistory,
        renderGuide,
        appendMessage,
        emptyMessages,
        beginThinking,
        endThinking,
        setPlaceholder: value => query('#sp-space-input')?.attr?.('placeholder', value),
        clearWidgets: () => widgets.clear(),
        widgetEntries: () => [...widgets.values()],
        widgetRecords: () => [...widgets.entries()],
    });
}
