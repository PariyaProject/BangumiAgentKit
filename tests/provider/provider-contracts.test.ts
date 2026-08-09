import { describe, expect, it } from 'vitest';
import {
  SOURCE_CLASSES,
  SOURCE_DERIVED,
  SOURCE_LEGACY,
  SOURCE_V0,
  assertSafeEvidence,
  createEvidenceRef,
  type CapabilityResult,
  type EvidenceRef,
  warning,
} from '@bangumi-agent-kit/provider-core';

const retrievedAt = '2026-08-09T00:00:00.000Z';

describe('PR-7B provider core contracts', () => {
  it('PF01-PF04: exposes the controlled source classes and separates v0 from legacy', () => {
    expect(SOURCE_CLASSES).toEqual([
      'official_v0',
      'official_legacy',
      'structured_web',
      'website_embedded',
      'website_html',
      'snapshot',
      'derived',
    ]);
    expect(SOURCE_V0.class).toBe('official_v0');
    expect(SOURCE_LEGACY.class).toBe('official_legacy');
    expect(SOURCE_V0.class).not.toBe('official_legacy');
    expect(SOURCE_LEGACY.class).not.toBe('official_v0');
  });

  it('PF05-PF08: evidence records retrieval/auth scope without credential material', () => {
    const evidence = createEvidenceRef({
      source: { ...SOURCE_V0, operation: 'getSubjectById' },
      retrievedAt,
      entity: { type: 'subject', id: 123 },
      fieldPath: 'name_cn',
      freshness: { state: 'fresh', sourceAgeMs: 0 },
      authScope: 'public',
      confidence: 'high',
    });

    expect(evidence.retrievedAt).toBe(retrievedAt);
    expect(evidence.authScope).toBe('public');
    expect(JSON.stringify(evidence)).not.toMatch(/token|authorization|header/i);

    const accountEvidence: EvidenceRef = {
      source: { ...SOURCE_LEGACY, operation: 'getCalendar' },
      retrievedAt,
      authScope: 'account',
    };
    expect(accountEvidence.authScope).toBe('account');
    expect(() => assertSafeEvidence({ ...accountEvidence, accessToken: 'secret' } as never)).toThrow(
      /Unsafe provider evidence field/,
    );
  });

  it('PF09-PF10: coverage distinguishes complete from partial scans', () => {
    const complete: CapabilityResult<string[]> = {
      state: 'ok',
      data: ['a', 'b'],
      coverage: { state: 'complete', requested: 2, scanned: 2, matched: 2, returned: 2 },
    };
    const partial: CapabilityResult<string[]> = {
      state: 'partial',
      data: ['a'],
      coverage: {
        state: 'partial',
        requested: 2,
        scanned: 1,
        matched: 1,
        returned: 1,
        missing: 1,
        reason: 'page budget exhausted',
      },
    };

    expect(complete.coverage?.state).toBe('complete');
    expect(partial.coverage?.state).toBe('partial');
    expect(partial.state).toBe('partial');
  });

  it('PF11-PF12: unavailable and not_computable are distinct states', () => {
    const unavailable: CapabilityResult<never> = {
      state: 'unavailable',
      warnings: [warning('UPSTREAM_TIMEOUT', 'official provider timed out')],
    };
    const notComputable: CapabilityResult<null> = {
      state: 'not_computable',
      data: null,
      warnings: [warning('MISSING_FIELD', 'required denominator is zero')],
    };

    expect(unavailable.state).not.toBe(notComputable.state);
    expect(unavailable.data).toBeUndefined();
    expect(notComputable.data).toBeNull();
  });

  it('PF13: conflict preserves both typed candidates and their provenance', () => {
    const result: CapabilityResult<number> = {
      state: 'conflict',
      conflicts: [
        {
          state: 'conflict',
          reason: 'sources disagree on score',
          resolution: 'retain canonical v0 value',
          candidates: [
            { source: SOURCE_V0, value: 8.2 },
            { source: SOURCE_LEGACY, value: 8.1 },
          ],
        },
      ],
    };

    expect(result.conflicts?.[0]?.candidates.map((candidate) => candidate.value)).toEqual([8.2, 8.1]);
    expect(result.conflicts?.[0]?.candidates[0]?.source.class).toBe('official_v0');
  });

  it('PF14: warnings use a typed code rather than an unstructured string', () => {
    const item = warning('FORMULA_EMPIRICALLY_VERIFIED', 'matched five live samples');
    expect(item.code).toBe('FORMULA_EMPIRICALLY_VERIFIED');
    expect(item.message).toBe('matched five live samples');
  });

  it('PF15: unsafe credential fields cannot enter evidence', () => {
    expect(() =>
      createEvidenceRef({
        source: SOURCE_DERIVED,
        retrievedAt,
        formula: 'safe',
        ...( { ciphertext: 'not-safe' } as never),
      }),
    ).toThrow(/Unsafe provider evidence field/);
  });
});
