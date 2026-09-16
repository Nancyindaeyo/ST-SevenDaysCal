import { buildDateJudgePrompt, createDateDetectionController } from './date-detection.js';

// 日期检测宿主：把装配根端口接到 controller。
// 不引进时旅 / 锚点善后模块，善后只走回调，避免循环依赖。
export function createDateDetectionHost(env = {}) {
    const createController = env.createController || createDateDetectionController;
    const contextOf = () => env.captureGenerationContext?.() || env.context?.() || {};
    const controller = createController({
        context: contextOf,
        charKey: ctx => env.charStableKey?.(ctx),
        config: env.config,
        storyEnabled: env.storyEnabled,
        storyDate: env.storyDate,
        storyClock: env.storyClock,
        completeStoryClock: env.completeStoryClock,
        identity: env.identity,
        getCalibration: () => env.getCalibration?.(env.charStableKey?.(env.getContext?.())),
        prompt: () => (env.buildPrompt || buildDateJudgePrompt)(env.calendarInjectText?.() || ''),
        callApi: env.callApi,
        parse: env.parse,
        bridge: env.bridge,
        getAnchor: env.getAnchor,
        setAnchor: env.setAnchor,
        setAnchorConfirmed: (_charKey, month, day, source, anchorOptions, persistenceOptions) =>
            env.setAnchorConfirmed?.(month, day, source, anchorOptions, persistenceOptions),
        settings: env.settings,
        monthName: month => env.monthName?.(env.loadCalendar?.(), month),
        toast: env.toast,
        logDiagnostic: env.logDiagnostic || (diagnostic => console.warn('[SP axis failure]', diagnostic)),
        aftermath: info => env.aftermath?.('story', info),
        captureParticipantIdentity: env.captureParticipantIdentity,
        sameParticipantIdentity: env.sameParticipantIdentity,
    });

    return {
        controller,
        applyDetectedDate(charKey, md, { notify = true } = {}) {
            return controller.apply(charKey, md, notify);
        },
        reland(options) { return controller.reland(options); },
        run(options) { return controller.run(options); },
        abort(reason) { return controller.abort(reason); },
        reset(reason) { return controller.reset(reason); },
        get isBusy() { return controller.isBusy; },
        get abortController() { return controller.abortController; },
    };
}
