import { createBeatController } from './controller.js';
import { createBeatUi } from './ui.js';

export function createBeatFeature(env = {}) {
    const ui = env.uiHost ? createBeatUi(env.uiHost) : null;
    const controller = createBeatController({
        ...env,
        onChange: () => ui?.render?.(),
        onBusy: () => ui?.render?.(),
    });
    ui?.bindController?.(controller);
    return Object.freeze({
        controller,
        ui,
        generate: () => controller.generate(),
        abort: reason => controller.abort(reason),
        reset: () => { controller.abort('chat-boundary'); controller.reset(); },
        bindUi: () => { ui?.bind?.(); ui?.render?.(); },
        reveal: () => ui?.reveal?.(),
        get shots() { return controller.shots; },
        get busy() { return controller.busy; },
    });
}
