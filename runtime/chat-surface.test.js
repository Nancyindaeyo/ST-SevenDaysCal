import test from 'node:test';
import assert from 'node:assert/strict';
import { chatSurfaceConflictReason, PARTICIPANT_ID, recordChatSurfaceConflict, registerChatSurfaceParticipant } from './chat-surface.js';

test('register records owner conflicts and does not throw', () => {
    const conflicts = [];
    const previous = globalThis.__TAURITAVERN__;
    globalThis.__TAURITAVERN__ = {
        abiVersion: 1,
        api: {
            chatSurface: {
                protocolVersion: 1,
                isManagedOwnershipRequired: () => true,
                getParticipant: () => ({ id: PARTICIPANT_ID }),
                registerParticipant() { throw new Error('should not register again'); },
            },
        },
    };
    try {
        const existing = registerChatSurfaceParticipant({}, { onConflict: conflict => conflicts.push(conflict) });
        assert.equal(existing.id, PARTICIPANT_ID);
        assert.deepEqual(conflicts, [{ owner: PARTICIPANT_ID, reason: 'already-registered' }]);
        globalThis.__TAURITAVERN__.api.chatSurface.getParticipant = undefined;
        globalThis.__TAURITAVERN__.api.chatSurface.registerParticipant = () => { throw new Error('owner already claimed'); };
        const skipped = registerChatSurfaceParticipant({}, { onConflict: conflict => conflicts.push(conflict) });
        assert.equal(skipped, null);
        assert.equal(conflicts.at(-1).reason, 'owner-conflict');
        assert.equal(chatSurfaceConflictReason(new Error('duplicate participant')), 'owner-conflict');
        assert.deepEqual(recordChatSurfaceConflict({ reason: 'register-failed' }), {
            owner: PARTICIPANT_ID,
            reason: 'register-failed',
        });
    } finally {
        globalThis.__TAURITAVERN__ = previous;
    }
});
