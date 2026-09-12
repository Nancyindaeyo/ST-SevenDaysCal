const REASON = 'chat-boundary';

export async function runChatChanged(h) {
    const previousChatId = h.activeChatId?.() ?? null;
    const lastSeen = (h.chatLength?.() ?? 0) - 1;
    h.beginBoundary?.({ previousChatId, lastSeen });
    h.pointTasks?.invalidateAll?.(REASON);
    h.pointController?.reset?.(REASON);
    h.lines?.onChatChanged?.({ lastSeen });
    h.memory?.abortAll?.(REASON);
    h.clearTravelUi?.();
    h.customDialog?.cancelActive?.();
    h.removeDialogOverlays?.();
    h.timeTravel?.clear?.(REASON);
    h.clearAutomationClaims?.();
    h.dateCoordinator?.clear?.();
    h.dateDetection?.reset?.(REASON);
    h.outline?.onChatChanged?.({ lastSeen });
    h.space?.onChatChanged?.({ enabled: h.pluginEnabled?.() });
    h.activity?.onChatChanged?.();
    h.activity?.close?.();
    h.dashed?.abort?.(REASON);
    h.dashed?.resetAuto?.();
    h.refresh?.abort?.(REASON);
    h.floorQueue?.abort?.(REASON);
    h.floorQueue?.resetFailed?.();
    h.syncFabFailed?.();
    h.resetMemoryPauseNotice?.();
    h.theater?.onChatChanged?.();
    h.ledgerCapture?.reset?.(REASON);
    h.ledgerJudge?.reset?.(REASON);
    h.axisGeneration?.reset?.(REASON);
    h.abortAutoRegen?.(REASON);
    h.clearPointGenerating?.();
    h.linesRuntime?.reset?.();
    h.lines?.setSheet?.('events');
    h.dashed?.resetError?.();
    if (previousChatId != null) h.lines?.clearAllSwipe?.(previousChatId);
    h.lines?.clearAllSwipe?.(h.chatId?.());
    h.sameFloor?.clear?.();
    h.pace?.resetChat?.({ lastSeen });
    h.resetViewHome?.();
    h.coordinate?.onChatChanged?.({
        chatId: h.chatId?.() ?? null,
        chatMetadataRef: h.chatMetadata?.() ?? null,
        enabled: h.pluginEnabled?.(),
    });
    h.refresh?.resetCounter?.();
    h.beat?.onChatChanged?.();
    h.paintPaceSoon?.();

    const loadingChatId = String(h.chatId?.() || '');
    await h.loadExternalChat?.({ force: true });
    if (String(h.chatId?.() || '') !== loadingChatId) return { status: 'superseded' };
    const mig = h.migrateChat?.() || { status: 'none' };
    if (!h.pluginEnabled?.()) {
        h.coordinate?.close?.();
        return { status: 'disabled', mig };
    }
    h.hydratePace?.();
    h.activity?.onChatChanged?.();
    h.paintPaceSoon?.();
    h.coordinate?.close?.();
    h.reloadPanel?.();
    h.scheduleAfterLoad?.(mig);
    h.refreshOutlineInjection?.();
    h.refreshLinesInjection?.();
    h.refreshStoryClock?.();
    h.refreshLedgerInjection?.();
    return { status: 'ready', mig };
}
