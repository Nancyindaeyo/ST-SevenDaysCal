import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDiagnosticRecord } from './diagnostic-trace.js';

test('diagnostic detail keeps short lifecycle errors but redacts urls and keys', () => {
    const record = sanitizeDiagnosticRecord({
        event: 'lifecycle-effect-failed',
        module: 'lifecycle',
        status: 'failed',
        detail: 'POST https://example.test/private failed with sk-secret123456789',
    }, () => 1);
    assert.match(record.detail, /<redacted-url>/);
    assert.match(record.detail, /<redacted-key>/);
    assert.doesNotMatch(record.detail, /example\.test|secret123456789/);
});
