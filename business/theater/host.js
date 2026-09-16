import { createTheaterRuntime } from './runtime.js';
import { createTheaterHostPorts } from '../../runtime/theater-host-ports.js';

export function theaterParticipantNames(ctx) {
    return {
        userName: ctx?.name1 || '用户',
        charName: ctx?.name2 || '角色',
    };
}

export function theaterSettingsSlice(settings) {
    const s = settings || {};
    return {
        theaterStylePrompt: typeof s.theaterStylePrompt === 'string' ? s.theaterStylePrompt : '',
        theaterCount: s.theaterCount,
        theaterPoolBooks: Array.isArray(s.theaterPoolBooks) ? s.theaterPoolBooks : [],
    };
}

export function readTheaterSnapshotContext(ctx, documentRef = globalThis.document) {
    const el = documentRef?.querySelector?.('#selected_chat_pole, #chat_name_pole, .current_chat_name');
    return {
        chatId: ctx?.chatId ?? null,
        chatIdHash: ctx?.chatMetadata?.chat_id_hash ?? null,
        chatName: el?.value || el?.textContent?.trim() || ctx?.chatId || '当前聊天',
        charName: ctx?.name2 || '角色',
    };
}

// 坐标宿主由装配根注入；这里只检查端口，不 import 坐标 runtime / 世界书。
export function saveTheaterSnapshotToCoordinate(item, getRuntime) {
    const coordinate = getRuntime?.();
    if (!coordinate?.feature?.saveFromTheater) throw new Error('坐标还没就绪');
    return coordinate.feature.saveFromTheater(item);
}

export function createTheaterHost(env = {}) {
    const createRuntime = env.createRuntime || createTheaterRuntime;
    const createPorts = env.createPorts || createTheaterHostPorts;
    let runtime;
    runtime = createRuntime({
        storage: env.storage,
        coreModule: env.coreModule,
        getContext: env.getContext,
        callTheaterApi: env.callTheaterApi,
        buildWorldInfoContext: env.buildWorldInfoContext,
        readCardExtras: env.readCardExtras,
        getMemText: env.getMemText,
        names: env.names,
        settings: env.settings,
        onDiagnostic: env.onDiagnostic,
        stage: env.stage,
        renderAiMessageHtml: env.renderAiMessageHtml,
        downloadJson: env.downloadJson,
        ports: createPorts({
            ...env.ports,
            captureTarget: chatId => runtime?.captureTarget?.(chatId),
            listWorldNames: env.listWorldNames,
            syncSettingsPoolList: env.syncSettingsPoolList,
            snapshotContext: env.snapshotContext,
            saveSnapshot: env.saveSnapshot,
        }),
    });
    return runtime.feature;
}
