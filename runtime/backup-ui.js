import {
    backupExportWarnings,
    chatIdentityFromContext,
    formatRestorePreview,
    parseBackupText,
    previewRestore,
} from './backup.js';

export function createBackupUiActions(env = {}) {
    return {
        async exportPack() {
            const confirmed = await env.confirm?.({
                title: '导出构画迁移包',
                body: '会打包设置（可能含 API Key）、能读到的聊天账本、本机草稿、坐标收藏、构画自己的世界书。不含聊天正文、也不含别的插件数据。',
                note: '卸本体再装自己这份时，把这份 JSON 再导入即可。请自行保管，不要发给别人。',
                confirmText: '导出', cancelText: '取消',
            });
            if (!confirmed) return { status: 'cancelled' };
            const overlay = env.mountOverlay?.('正在导出构画迁移包');
            try {
                const controller = env.createController?.(info => overlay?.progress?.(info));
                const pack = await controller.exportPack();
                controller.download(pack);
                overlay?.close?.();
                const warnings = backupExportWarnings(pack);
                if (warnings.length) env.toast?.(`迁移包已导出，但不完整：${warnings.join('；')}。请勿把它当作完整备份。`, null, true);
                else env.toast?.('构画迁移包已完整导出');
                return { status: warnings.length ? 'partial' : 'exported', pack };
            } catch (error) {
                overlay?.close?.();
                env.toast?.(`导出失败：${error?.message || '未知错误'}`, null, true);
                return { status: 'failed', error };
            }
        },

        async importPack(file, { rehearse = false } = {}) {
            let pack;
            try { pack = parseBackupText(await file.text()); }
            catch (error) { env.toast?.(`无法读取迁移包：${error?.message || '未知错误'}`, null, true); return { status: 'invalid', error }; }
            const preview = previewRestore(pack, chatIdentityFromContext(env.getContext?.()));
            const body = formatRestorePreview(preview);
            if (rehearse) {
                await env.confirm?.({
                    title: '迁移包演练（不落盘）',
                    body,
                    note: '只核对格式、版本、聊天身份和将覆盖的根，没有写入任何数据。',
                    confirmText: '知道了', cancelText: '关闭',
                });
                return { status: 'rehearsed', preview };
            }
            const confirmed = await env.confirm?.({
                title: '导入构画迁移包',
                body,
                note: '只会写入构画自己的数据。同名设置、账本、草稿、坐标和构画世界书会被包里的内容覆盖。导入后会刷新页面。',
                confirmText: '导入并刷新', cancelText: '取消',
            });
            if (!confirmed) return { status: 'cancelled', preview };
            const overlay = env.mountOverlay?.('正在导入构画迁移包');
            try {
                const controller = env.createController?.(info => overlay?.progress?.(info));
                const result = await controller.importPack(pack);
                overlay?.close?.();
                if (result.stopped === 'unknown') {
                    env.toast?.('导入已停止：当前聊天写入结果未确认，请刷新后核实，未继续覆盖其它聊天。', null, true);
                    return { status: 'unknown', result };
                }
                if (result.verified === false) {
                    env.toast?.(`导入后回读不一致：${(result.mismatches || []).join('、') || '账本'}。请不要当作完整恢复。`, null, true);
                    return { status: 'unverified', result };
                }
                const skipped = (result.chatsSkipped || 0) + (result.chatsExternal || 0);
                env.toast?.(skipped ? `已导入。有 ${skipped} 份聊天未能写入（可能已迁出或聊天不在本机）` : '构画数据已导入，即将刷新');
                env.reload?.();
                return { status: 'imported', result };
            } catch (error) {
                overlay?.close?.();
                env.toast?.(`导入失败：${error?.message || '未知错误'}`, null, true);
                return { status: 'failed', error };
            }
        },
    };
}
