import { createTheaterController } from './controller.js';
import { createTheaterUi } from './ui.js';

export function createTheaterFeature(env = {}) {
    const controller = createTheaterController(env);
    const feature = {
        controller,
        generate: (...args) => controller.run(...args),
        abort: reason => controller.abort(reason),
        clearSaved: target => env.repository?.clearSaved?.(target),
        captureTarget(chatId) { return env.captureTarget?.(chatId); },
        init() { return this; },
        open() { this.ui?.render?.(); return this; },
        bindUi(root) { this.ui?.bind?.(root); return this; },
        bindSettings(root) { this.ui?.bindSettings?.(root); return this; },
        refreshTemplates() { return this.ui?.refreshTemplates?.(); },
        refreshPoolList() { return this.ui?.refreshPoolList?.(); },
        refreshUi() { return Promise.all([this.ui?.refreshTemplates?.(), this.ui?.refreshPoolList?.()]); },
        resetAfterStorageClear() { this.ui?.resetForChat?.(); this.ui?.render?.(); return this; },
        leave() { this.ui?.closeVisual?.(); return this; },
        onChatChanged() { this.abort('chat-boundary'); this.ui?.resetForChat?.(); },
        onPluginDisabled() { this.abort('plugin-disabled'); this.ui?.closeVisual?.(); this.ui?.clearRetry?.(); this.ui?.clearTransient?.(); },
        onPanelClosed() { this.ui?.closeVisual?.(); this.ui?.clearRetry?.(); },
        destroy() { this.abort('destroyed'); this.ui?.destroy?.(); },
        get busy() { return controller.busy; },
    };
    if (env.ui) feature.ui = createTheaterUi({ repository: env.repository, templates: env.templates, resolveRegen: env.resolveRegen, draftCap: env.draftCap, exporter: env.exporter, ...env.ui, feature });
    return feature;
}
