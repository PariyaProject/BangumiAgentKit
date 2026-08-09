import { describe, expect, it } from 'vitest';
import {
  ProviderRegistry,
  DEFAULT_SOURCE_POLICY,
  sourceUnavailableResult,
  type CalendarProvider,
  type SubjectProvider,
} from '@bangumi-agent-kit/provider-core';

const subjectProvider: SubjectProvider = {
  async getSubject() {
    return { state: 'ok', data: undefined, retrievedAt: '2026-08-09T00:00:00Z' };
  },
  async getSubjectStats() {
    return { state: 'not_computable', retrievedAt: '2026-08-09T00:00:00Z' };
  },
};

const calendarProvider: CalendarProvider = {
  async getCalendar() {
    return {
      state: 'ok',
      data: [],
      coverage: { state: 'complete' },
      retrievedAt: '2026-08-09T00:00:00Z',
    };
  },
};

describe('PR-7B provider registry and safe diagnostics', () => {
  it('exposes only configured official capabilities and explicit disabled statuses', async () => {
    const registry = new ProviderRegistry({
      v0: subjectProvider,
      legacyCalendar: calendarProvider,
    });
    const status = registry.getStatus();

    expect(status.find((item) => item.id === 'official-v0')?.state).toBe('READY');
    expect(status.find((item) => item.id === 'official-legacy')?.state).toBe('READY');
    expect(status.find((item) => item.id === 'structured-web')?.state).toBe('DISABLED');
    expect(status.find((item) => item.id === 'website-html')?.state).toBe('DISABLED');
    expect(status.find((item) => item.id === 'snapshots')?.state).toBe('NOT_CONFIGURED');

    const result = await registry.getSubjectStats(123);
    expect(result.state).toBe('not_computable');
    expect(registry.getDiagnostics()[0]).toMatchObject({
      provider: 'official-v0',
      operation: 'getSubjectStats',
      outcome: 'not_computable',
      cache: 'unknown',
    });
    expect(JSON.stringify(registry.getDiagnostics())).not.toMatch(
      /token|header|principal|database/i,
    );
  });

  it('does not turn an absent provider into an empty success', async () => {
    const registry = new ProviderRegistry();
    const result = await registry.getCalendar();

    expect(result.state).toBe('unavailable');
    expect(result.data).toBeUndefined();
    expect(result.warnings?.[0]?.code).toBe('SOURCE_NOT_CONFIGURED');
  });

  it('keeps source-unavailable helper distinct from a valid empty data result', () => {
    const result = sourceUnavailableResult<unknown>({ class: 'website_html', provider: 'html' });
    expect(result.state).toBe('unsupported');
    expect(result.data).toBeUndefined();
  });

  it('SC10/SC13: future provider status follows policy instead of hardcoded readiness', () => {
    const registry = new ProviderRegistry({
      policy: {
        ...DEFAULT_SOURCE_POLICY,
        structured_web: 'enabled',
        website_html: 'not_configured',
        snapshot: 'disabled',
      },
    });
    const status = registry.getStatus();

    expect(status.find((item) => item.id === 'structured-web')?.state).toBe('NOT_CONFIGURED');
    expect(status.find((item) => item.id === 'website-html')?.state).toBe('NOT_CONFIGURED');
    expect(status.find((item) => item.id === 'snapshots')?.state).toBe('DISABLED');
  });
});
