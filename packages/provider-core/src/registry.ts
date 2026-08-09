import {
  type CapabilityResult,
  type CapabilityState,
  type ProviderErrorCode,
  type SourceClass,
  type SourceDescriptor,
} from './contracts.js';
import {
  DEFAULT_SOURCE_POLICY,
  sourceUnavailableResult,
  sourceAvailability,
  type SourceAvailability,
  type SourcePolicy,
} from './source-policy.js';
import type {
  CalendarDayData,
  CalendarProvider,
  ProviderRequestContext,
  ProviderSubjectData,
  SubjectDiscoveryBrowseRequest,
  SubjectDiscoveryPage,
  SubjectDiscoverySearchRequest,
  SubjectDiscoveryProvider,
  SubjectProvider,
  SubjectStatsData,
} from './providers.js';

export type ProviderId =
  'official-v0' | 'official-legacy' | 'structured-web' | 'website-html' | 'snapshots';
export type ProviderStatusState = 'READY' | 'DISABLED' | 'NOT_CONFIGURED';

export interface ProviderStatus {
  id: ProviderId;
  sourceClass: SourceClass;
  state: ProviderStatusState;
  capabilities: string[];
}

export interface ProviderDiagnostic {
  provider: ProviderId;
  sourceClass: SourceClass;
  operation: string;
  durationMs: number;
  outcome: CapabilityState;
  cache: 'unknown';
  errorCode?: ProviderErrorCode;
}

export interface ProviderRegistryOptions {
  v0?: SubjectProvider &
    Partial<Pick<SubjectDiscoveryProvider, 'searchSubjects' | 'browseSubjects'>>;
  legacyCalendar?: CalendarProvider;
  policy?: SourcePolicy;
  now?: () => number;
}

function statusState(availability: SourceAvailability, configured: boolean): ProviderStatusState {
  if (availability === 'disabled') return 'DISABLED';
  if (availability === 'not_configured' || !configured) return 'NOT_CONFIGURED';
  return 'READY';
}

function statusFor(
  id: ProviderId,
  sourceClass: SourceClass,
  capabilities: string[],
  policy: SourcePolicy,
  configured: boolean,
): ProviderStatus {
  return {
    id,
    sourceClass,
    state: statusState(sourceAvailability(sourceClass, policy), configured),
    capabilities,
  };
}

export class ProviderRegistry {
  private readonly policy: SourcePolicy;
  private readonly v0?: SubjectProvider &
    Partial<Pick<SubjectDiscoveryProvider, 'searchSubjects' | 'browseSubjects'>>;
  private readonly legacyCalendar?: CalendarProvider;
  private readonly now: () => number;
  private readonly diagnosticLog: ProviderDiagnostic[] = [];

  constructor(options: ProviderRegistryOptions = {}) {
    this.policy = options.policy ?? DEFAULT_SOURCE_POLICY;
    this.v0 = options.v0;
    this.legacyCalendar = options.legacyCalendar;
    this.now = options.now ?? Date.now;
  }

  async getSubject(
    subjectId: number,
    context: ProviderRequestContext = {},
  ): Promise<CapabilityResult<ProviderSubjectData>> {
    const source: SourceDescriptor = {
      class: 'official_v0',
      provider: 'bangumi',
      operation: 'getSubjectById',
    };
    if (sourceAvailability('official_v0', this.policy) !== 'enabled' || !this.v0) {
      return this.recordUnavailable(
        'official-v0',
        source,
        'getSubjectById',
        sourceUnavailableResult(source, this.policy),
      );
    }
    return this.invoke('official-v0', source, 'getSubjectById', () =>
      this.v0!.getSubject(subjectId, context),
    );
  }

  async getSubjectStats(
    subjectId: number,
    context: ProviderRequestContext = {},
  ): Promise<CapabilityResult<SubjectStatsData>> {
    const source: SourceDescriptor = {
      class: 'official_v0',
      provider: 'bangumi',
      operation: 'getSubjectStats',
    };
    if (sourceAvailability('official_v0', this.policy) !== 'enabled' || !this.v0) {
      return this.recordUnavailable(
        'official-v0',
        source,
        'getSubjectStats',
        sourceUnavailableResult(source, this.policy),
      );
    }
    return this.invoke('official-v0', source, 'getSubjectStats', () =>
      this.v0!.getSubjectStats(subjectId, context),
    );
  }

  async searchSubjects(
    request: SubjectDiscoverySearchRequest,
    context: ProviderRequestContext = {},
  ): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    const source: SourceDescriptor = {
      class: 'official_v0',
      provider: 'bangumi',
      operation: 'searchSubjects',
      experimental: true,
    };
    if (
      sourceAvailability('official_v0', this.policy) !== 'enabled' ||
      !this.v0?.searchSubjects
    ) {
      return this.recordUnavailable(
        'official-v0',
        source,
        'searchSubjects',
        sourceUnavailableResult(source, this.policy),
      );
    }
    return this.invoke('official-v0', source, 'searchSubjects', () =>
      this.v0!.searchSubjects!(request, context),
    );
  }

  async browseSubjects(
    request: SubjectDiscoveryBrowseRequest,
    context: ProviderRequestContext = {},
  ): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    const source: SourceDescriptor = {
      class: 'official_v0',
      provider: 'bangumi',
      operation: 'browseSubjects',
    };
    if (
      sourceAvailability('official_v0', this.policy) !== 'enabled' ||
      !this.v0?.browseSubjects
    ) {
      return this.recordUnavailable(
        'official-v0',
        source,
        'browseSubjects',
        sourceUnavailableResult(source, this.policy),
      );
    }
    return this.invoke('official-v0', source, 'browseSubjects', () =>
      this.v0!.browseSubjects!(request, context),
    );
  }

  async getCalendar(
    context: ProviderRequestContext = {},
  ): Promise<CapabilityResult<CalendarDayData[]>> {
    const source: SourceDescriptor = {
      class: 'official_legacy',
      provider: 'bangumi',
      operation: 'getCalendar',
    };
    if (sourceAvailability('official_legacy', this.policy) !== 'enabled' || !this.legacyCalendar) {
      return this.recordUnavailable(
        'official-legacy',
        source,
        'getCalendar',
        sourceUnavailableResult(source, this.policy),
      );
    }
    return this.invoke('official-legacy', source, 'getCalendar', () =>
      this.legacyCalendar!.getCalendar(context),
    );
  }

  getStatus(): ProviderStatus[] {
    return [
      statusFor(
        'official-v0',
        'official_v0',
        ['subject', 'subject_stats'],
        this.policy,
        Boolean(this.v0),
      ),
      statusFor(
        'official-legacy',
        'official_legacy',
        ['calendar'],
        this.policy,
        Boolean(this.legacyCalendar),
      ),
      statusFor('structured-web', 'structured_web', [], this.policy, false),
      statusFor('website-html', 'website_html', [], this.policy, false),
      statusFor('snapshots', 'snapshot', [], this.policy, false),
    ];
  }

  getDiagnostics(): ProviderDiagnostic[] {
    return this.diagnosticLog.map((item) => ({ ...item }));
  }

  private async invoke<T>(
    provider: ProviderId,
    source: SourceDescriptor,
    operation: string,
    action: () => Promise<CapabilityResult<T>>,
  ): Promise<CapabilityResult<T>> {
    const startedAt = this.now();
    const result = await action();
    this.diagnosticLog.push({
      provider,
      sourceClass: source.class,
      operation,
      durationMs: Math.max(0, this.now() - startedAt),
      outcome: result.state,
      cache: 'unknown',
      errorCode: result.error?.code,
    });
    return result;
  }

  private recordUnavailable<T>(
    provider: ProviderId,
    source: SourceDescriptor,
    operation: string,
    result: CapabilityResult<T>,
  ): CapabilityResult<T> {
    this.diagnosticLog.push({
      provider,
      sourceClass: source.class,
      operation,
      durationMs: 0,
      outcome: result.state,
      cache: 'unknown',
      errorCode: result.error?.code,
    });
    return result;
  }
}
