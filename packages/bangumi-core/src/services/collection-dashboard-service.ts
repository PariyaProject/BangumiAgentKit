import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient, PublicErrorInfo, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import {
  CollectionBacklogResult,
  CollectionBacklogService,
  CollectionBacklogStatus,
  COLLECTION_BACKLOG_MAX_COLLECTION_PAGES,
  COLLECTION_BACKLOG_MAX_CONCURRENCY,
  COLLECTION_BACKLOG_MAX_EPISODE_PAGES,
  COLLECTION_BACKLOG_DEFAULT_MAX_EPISODES_PER_SUBJECT,
  COLLECTION_BACKLOG_DEFAULT_MAX_SUBJECTS,
} from './collection-backlog-service.js';
import {
  CollectionIntelligenceResult,
  CollectionIntelligenceService,
  COLLECTION_INTELLIGENCE_MAX_PAGES,
} from './collection-intelligence-service.js';
import {
  CollectionScheduleResult,
  CollectionScheduleService,
  CollectionScheduleStatus,
  COLLECTION_SCHEDULE_MAX_COLLECTION_PAGES,
  COLLECTION_SCHEDULE_DEFAULT_MAX_ROWS,
  COLLECTION_SCHEDULE_MAX_CALENDAR_ROWS,
} from './collection-schedule-service.js';

export const COLLECTION_DASHBOARD_FORMULA_VERSION = 'collection-dashboard-v1';
export const COLLECTION_DASHBOARD_DEFAULT_MAX_COLLECTION_ITEMS = 100;
export const COLLECTION_DASHBOARD_MAX_COLLECTION_ITEMS = 100;
export const COLLECTION_DASHBOARD_DEFAULT_MAX_SUBJECTS = COLLECTION_BACKLOG_DEFAULT_MAX_SUBJECTS;
export const COLLECTION_DASHBOARD_MAX_SUBJECTS = 30;
export const COLLECTION_DASHBOARD_DEFAULT_MAX_EPISODES_PER_SUBJECT =
  COLLECTION_BACKLOG_DEFAULT_MAX_EPISODES_PER_SUBJECT;
export const COLLECTION_DASHBOARD_MAX_EPISODES_PER_SUBJECT = 1000;
export const COLLECTION_DASHBOARD_DEFAULT_MAX_ROWS = COLLECTION_SCHEDULE_DEFAULT_MAX_ROWS;
export const COLLECTION_DASHBOARD_MAX_ROWS = 100;
export const COLLECTION_DASHBOARD_DEFAULT_MAX_DURATION_MS = 60_000;
export const COLLECTION_DASHBOARD_MAX_DURATION_MS = 120_000;
export const COLLECTION_DASHBOARD_MAX_CONCURRENT_SECTIONS = 1;
export const COLLECTION_DASHBOARD_MAX_CONCURRENT_REQUESTS = COLLECTION_BACKLOG_MAX_CONCURRENCY;
export const COLLECTION_DASHBOARD_MAX_RETRIES = 2;

export type CollectionDashboardState =
  | 'complete'
  | 'partial'
  | 'unavailable'
  | 'auth_required'
  | 'permission_denied'
  | 'rate_limited'
  | 'upstream_error'
  | 'not_computable'
  | 'conflict';

export type CollectionDashboardSectionName = 'intelligence' | 'backlog' | 'schedule';

export interface CollectionDashboardOptions {
  maxCollectionItems?: number;
  maxSubjects?: number;
  maxEpisodesPerSubject?: number;
  maxRows?: number;
  maxDurationMs?: number;
  statuses?: CollectionDashboardStatus[];
}

export type CollectionDashboardStatus = CollectionBacklogStatus & CollectionScheduleStatus;

export interface CollectionDashboardSection<T> {
  state: CollectionDashboardState;
  result?: T;
  error?: PublicErrorInfo;
  warnings: Array<{
    code: string;
    state: CollectionDashboardState;
    message: string;
  }>;
}

export interface CollectionDashboardAggregateCoverage {
  state: CollectionDashboardState;
  sectionsRequested: number;
  sectionsAttempted: number;
  sectionsInvoked: number;
  sectionsSucceeded: number;
  deadlineSkippedSections: number;
  maxConcurrentSections: number;
  maxConcurrentRequests: number;
  upstreamRequestsBound: number;
  upstreamAttemptsBound: number;
  deadlineMs: number;
  timedOutSections: number;
  collectionRowsRequested: number;
  collectionRowsObserved: number;
  collectionRowsBound: number;
  backlogSubjectsRequested: number;
  backlogSubjectsAttempted: number;
  backlogSubjectsSucceeded: number;
  episodeRowsRequested: number;
  episodeRowsObserved: number;
  calendarRowsRequested: number;
  calendarRowsObserved: number;
  outputRowsRequested: number;
  retrievedAt?: string;
}

export interface CollectionDashboardResult {
  state: CollectionDashboardState;
  data: {
    sections: {
      intelligence: CollectionDashboardSection<CollectionIntelligenceResult>;
      backlog: CollectionDashboardSection<CollectionBacklogResult>;
      schedule: CollectionDashboardSection<CollectionScheduleResult>;
    };
  };
  coverage: CollectionDashboardAggregateCoverage;
  source: {
    class: 'composite';
    operations: string[];
    authScope: 'account';
    attemptedAt: string;
    retrievedAt?: string;
  };
  evidence: Array<{
    section: 'dashboard' | CollectionDashboardSectionName;
    source: 'official_v0' | 'official-legacy' | 'derived';
    operation?: string;
    operations?: string[];
    formulaVersion?: string;
    authScope?: 'account';
    attemptedAt?: string;
    retrievedAt?: string;
  }>;
  limitations: string[];
  warnings: Array<{
    section?: CollectionDashboardSectionName;
    code: string;
    state: CollectionDashboardState;
    message: string;
  }>;
}

interface SectionExecution<T> {
  result?: T;
  error?: PublicErrorInfo;
  invoked?: boolean;
  skipped?: boolean;
  timedOut?: boolean;
}

function bounded(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(value as number)));
}

function stateForError(error: PublicErrorInfo): CollectionDashboardState {
  if (error.code === 'AUTH_REQUIRED' || error.code === 'AUTH_EXPIRED') return 'auth_required';
  if (error.code === 'PERMISSION_DENIED' || error.code === 'FORBIDDEN') {
    return 'permission_denied';
  }
  if (error.code === 'RATE_LIMITED' || error.code === 'TOO_MANY_REQUESTS') {
    return 'rate_limited';
  }
  if (
    error.code === 'UPSTREAM_TIMEOUT' ||
    error.code === 'NETWORK_ERROR' ||
    error.code === 'UPSTREAM_UNAVAILABLE'
  ) {
    return 'upstream_error';
  }
  return 'upstream_error';
}

function stateForResult(result: {
  state: string;
  error?: PublicErrorInfo;
}): CollectionDashboardState {
  if ((result.state === 'unavailable' || result.state === 'upstream_error') && result.error) {
    return stateForError(result.error);
  }
  if (
    result.state === 'complete' ||
    result.state === 'partial' ||
    result.state === 'unavailable' ||
    result.state === 'auth_required' ||
    result.state === 'permission_denied' ||
    result.state === 'rate_limited' ||
    result.state === 'upstream_error' ||
    result.state === 'not_computable' ||
    result.state === 'conflict'
  ) {
    return result.state;
  }
  return 'upstream_error';
}

async function executeSection<T>(task: () => Promise<T>): Promise<SectionExecution<T>> {
  try {
    return { result: await task() };
  } catch (error: unknown) {
    return { error: toPublicError(error) };
  }
}

function timeoutError(deadlineMs: number): PublicErrorInfo {
  return {
    code: 'UPSTREAM_TIMEOUT',
    message: `收藏 Dashboard 在 ${deadlineMs}ms 有界时限内未完成；未用空结果替代未观察到的数据。`,
    retryable: true,
    nextAction: '降低 max-items/max-subjects/max-episodes 或稍后重试',
  };
}

async function executeSectionUntil<T>(
  task: () => Promise<T>,
  deadlineAt: number,
  deadlineMs: number,
  signal?: AbortSignal,
  onTimeout?: () => void,
): Promise<SectionExecution<T>> {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0 || signal?.aborted) {
    return { error: timeoutError(deadlineMs), skipped: true };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        onTimeout?.();
        reject(new Error('__COLLECTION_DASHBOARD_TIMEOUT__'));
      }, remainingMs);
    });
    const execution = await Promise.race([executeSection(task), timeout]);
    if (signal?.aborted) {
      return { error: timeoutError(deadlineMs), invoked: true, timedOut: true };
    }
    return { ...execution, invoked: true };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === '__COLLECTION_DASHBOARD_TIMEOUT__') {
      return { error: timeoutError(deadlineMs), invoked: true, timedOut: true };
    }
    return { error: toPublicError(error), invoked: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function skippedSection(deadlineMs: number): SectionExecution<never> {
  return { error: timeoutError(deadlineMs), skipped: true };
}

function sectionState<T extends { state: string }>(
  execution: SectionExecution<T>,
): CollectionDashboardState {
  return execution.result
    ? stateForResult(execution.result)
    : stateForError(execution.error || timeoutError(0));
}

function sectionWarning(
  section: CollectionDashboardSectionName,
  execution: SectionExecution<unknown>,
): CollectionDashboardResult['warnings'][number] | undefined {
  if (!execution.error) return undefined;
  return {
    section,
    code: execution.error.code,
    state: stateForError(execution.error),
    message: `${section} 区段暂时不可用；未用空结果替代未观察到的数据。`,
  };
}

function deriveOverallState(states: CollectionDashboardState[]): CollectionDashboardState {
  const successful = states.filter((state) => state === 'complete' || state === 'partial');
  if (successful.length === states.length && states.every((state) => state === 'complete')) {
    return 'complete';
  }
  if (successful.length > 0) return 'partial';
  if (states.every((state) => state === 'auth_required')) return 'auth_required';
  if (states.every((state) => state === 'permission_denied')) return 'permission_denied';
  if (states.every((state) => state === 'rate_limited')) return 'rate_limited';
  if (states.every((state) => state === 'not_computable')) return 'not_computable';
  if (states.every((state) => state === 'conflict')) return 'conflict';
  if (states.every((state) => state === 'upstream_error' || state === 'unavailable')) {
    return 'unavailable';
  }
  return 'unavailable';
}

function resultWarnings(
  section: CollectionDashboardSectionName,
  result: {
    warnings: Array<{ code: string; state: string; message: string }>;
  },
): CollectionDashboardResult['warnings'] {
  return result.warnings.map((warning) => ({
    section,
    code: warning.code,
    state: stateForResult({
      state: warning.state,
      error: { code: warning.code, message: warning.message },
    }),
    message: warning.message,
  }));
}

function upstreamRequestBound(maxSubjects: number): number {
  // A short, non-empty page does not prove exhaustion. The underlying services
  // may therefore continue until their hard page caps even when the requested
  // item limit would fit in one page.
  return (
    COLLECTION_INTELLIGENCE_MAX_PAGES +
    COLLECTION_BACKLOG_MAX_COLLECTION_PAGES +
    maxSubjects * COLLECTION_BACKLOG_MAX_EPISODE_PAGES +
    1 +
    COLLECTION_SCHEDULE_MAX_COLLECTION_PAGES
  );
}

function latestRetrievedAt(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => value !== undefined && Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(left) - Date.parse(right))
    .at(-1);
}

function sectionCollectionRows(result: unknown): number {
  const candidate = result as {
    coverage?: { observedRows?: number; collection?: { observedRows?: number } };
  };
  return candidate.coverage?.observedRows ?? candidate.coverage?.collection?.observedRows ?? 0;
}

function buildLimitations(): string[] {
  return [
    '这是三个当前账号私有只读区段的组合快照；三个区段可能在不同时间完成，不能当作同一瞬间的事务性快照。',
    '收藏行最多按三个区段各自的有界上限读取；observed、sourceTotal 和 truncation 必须结合各区段覆盖理解，未观察记录没有被猜测补全。',
    'backlog 的剩余集数、完结状态和 schedule 的进度只继承各自已声明的官方 source evidence；本工具不重新推导 episode 完成或播出时刻。',
    '结果不读取评论，不计算历史趋势、推荐或口味，不执行收藏/章节写入，也不接受任意用户名。',
    '该私有结果不得进入跨账号共享缓存或公共 ArtifactStore。',
  ];
}

export class CollectionDashboardService {
  private readonly client: GeneratedBangumiOpenApiClient;
  private readonly publicHttpClient?: HttpClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient, publicHttpClient?: HttpClient) {
    this.client =
      client instanceof GeneratedBangumiOpenApiClient
        ? client
        : new GeneratedBangumiOpenApiClient(client);
    this.publicHttpClient = publicHttpClient;
  }

  async getCollectionDashboard(
    username: string,
    options: CollectionDashboardOptions = {},
  ): Promise<CollectionDashboardResult> {
    const maxCollectionItems = bounded(
      options.maxCollectionItems,
      COLLECTION_DASHBOARD_DEFAULT_MAX_COLLECTION_ITEMS,
      COLLECTION_DASHBOARD_MAX_COLLECTION_ITEMS,
    );
    const maxSubjects = bounded(
      options.maxSubjects,
      COLLECTION_DASHBOARD_DEFAULT_MAX_SUBJECTS,
      COLLECTION_DASHBOARD_MAX_SUBJECTS,
    );
    const maxEpisodesPerSubject = bounded(
      options.maxEpisodesPerSubject,
      COLLECTION_DASHBOARD_DEFAULT_MAX_EPISODES_PER_SUBJECT,
      COLLECTION_DASHBOARD_MAX_EPISODES_PER_SUBJECT,
    );
    const maxRows = bounded(
      options.maxRows,
      COLLECTION_DASHBOARD_DEFAULT_MAX_ROWS,
      COLLECTION_DASHBOARD_MAX_ROWS,
    );
    const maxDurationMs = bounded(
      options.maxDurationMs,
      COLLECTION_DASHBOARD_DEFAULT_MAX_DURATION_MS,
      COLLECTION_DASHBOARD_MAX_DURATION_MS,
    );
    const attemptedAt = new Date().toISOString();
    const deadlineAt = Date.now() + maxDurationMs;
    const deadlineController = new AbortController();
    const deadlineTimer = setTimeout(() => deadlineController.abort(), maxDurationMs);

    try {
      const intelligenceExecution = await executeSectionUntil(
        () =>
          new CollectionIntelligenceService(this.client).getCollectionIntelligence(username, {
            maxItems: maxCollectionItems,
            signal: deadlineController.signal,
          }),
        deadlineAt,
        maxDurationMs,
        deadlineController.signal,
        () => deadlineController.abort(),
      );
      const backlogExecution =
        intelligenceExecution.timedOut || intelligenceExecution.skipped
          ? skippedSection(maxDurationMs)
          : await executeSectionUntil(
              () =>
                new CollectionBacklogService(
                  this.client,
                  this.publicHttpClient,
                ).getCollectionBacklog(username, {
                  maxItems: maxCollectionItems,
                  maxSubjects,
                  maxEpisodesPerSubject,
                  statuses: options.statuses,
                  includeSchedule: false,
                  signal: deadlineController.signal,
                }),
              deadlineAt,
              maxDurationMs,
              deadlineController.signal,
              () => deadlineController.abort(),
            );
      const scheduleExecution =
        backlogExecution.timedOut || backlogExecution.skipped
          ? skippedSection(maxDurationMs)
          : await executeSectionUntil(
              () =>
                new CollectionScheduleService(
                  this.client,
                  this.publicHttpClient,
                ).getCollectionSchedule(username, {
                  maxCollectionItems,
                  maxRows,
                  statuses: options.statuses,
                  signal: deadlineController.signal,
                }),
              deadlineAt,
              maxDurationMs,
              deadlineController.signal,
              () => deadlineController.abort(),
            );

      const executions = {
        intelligence: intelligenceExecution,
        backlog: backlogExecution,
        schedule: scheduleExecution,
      } as const;
      const sections = {
        intelligence: {
          state: sectionState(intelligenceExecution),
          result: intelligenceExecution.result,
          error: intelligenceExecution.error,
          warnings: intelligenceExecution.result
            ? intelligenceExecution.result.warnings.map((warning) => ({
                code: warning.code,
                state: stateForResult({
                  state: warning.state,
                  error: { code: warning.code, message: warning.message },
                }),
                message: warning.message,
              }))
            : [],
        },
        backlog: {
          state: sectionState(backlogExecution),
          result: backlogExecution.result,
          error: backlogExecution.error,
          warnings: backlogExecution.result
            ? backlogExecution.result.warnings.map((warning) => ({
                code: warning.code,
                state: stateForResult({
                  state: warning.state,
                  error: { code: warning.code, message: warning.message },
                }),
                message: warning.message,
              }))
            : [],
        },
        schedule: {
          state: sectionState(scheduleExecution),
          result: scheduleExecution.result,
          error: scheduleExecution.error,
          warnings: scheduleExecution.result
            ? scheduleExecution.result.warnings.map((warning) => ({
                code: warning.code,
                state: stateForResult({
                  state: warning.state,
                  error: { code: warning.code, message: warning.message },
                }),
                message: warning.message,
              }))
            : [],
        },
      } satisfies CollectionDashboardResult['data']['sections'];

      const states = [sections.intelligence.state, sections.backlog.state, sections.schedule.state];
      const state = deriveOverallState(states);
      const sectionExecutions = [
        intelligenceExecution,
        backlogExecution,
        scheduleExecution,
      ] as const;
      const successfulResults = sectionExecutions.filter(
        (execution) =>
          execution.result &&
          (execution.result.state === 'complete' || execution.result.state === 'partial'),
      );
      const successfulResultValues = successfulResults.flatMap((execution) =>
        execution.result ? [execution.result] : [],
      );
      const sectionsInvoked = sectionExecutions.filter((execution) => execution.invoked).length;
      const timedOutSections = sectionExecutions.filter(
        (execution) => execution.invoked && execution.timedOut,
      ).length;
      const deadlineSkippedSections = sectionExecutions.filter(
        (execution) => execution.skipped,
      ).length;
      const retrievedAt = latestRetrievedAt([
        intelligenceExecution.result?.source.retrievedAt,
        backlogExecution.result?.source.retrievedAt,
        scheduleExecution.result?.source.collection.retrievedAt,
        scheduleExecution.result?.source.calendar.retrievedAt,
      ]);
      const collectionRowsObserved = successfulResults.reduce(
        (total, execution) => total + sectionCollectionRows(execution.result),
        0,
      );
      const backlogCoverage = backlogExecution.result?.coverage;
      const scheduleCoverage = scheduleExecution.result?.coverage;
      const warnings = [
        sectionWarning('intelligence', intelligenceExecution),
        sectionWarning('backlog', backlogExecution),
        sectionWarning('schedule', scheduleExecution),
        ...(intelligenceExecution.result
          ? resultWarnings('intelligence', intelligenceExecution.result)
          : []),
        ...(backlogExecution.result ? resultWarnings('backlog', backlogExecution.result) : []),
        ...(scheduleExecution.result ? resultWarnings('schedule', scheduleExecution.result) : []),
      ].filter((warning): warning is CollectionDashboardResult['warnings'][number] =>
        Boolean(warning),
      );

      const evidence: CollectionDashboardResult['evidence'] = [
        {
          section: 'dashboard',
          source: 'derived',
          operations: [
            'CollectionIntelligenceService.getCollectionIntelligence',
            'CollectionBacklogService.getCollectionBacklog',
            'CollectionScheduleService.getCollectionSchedule',
          ],
          formulaVersion: COLLECTION_DASHBOARD_FORMULA_VERSION,
          authScope: 'account',
          attemptedAt,
          retrievedAt,
        },
      ];
      for (const [sectionName, execution] of Object.entries(executions) as Array<
        [CollectionDashboardSectionName, SectionExecution<any>]
      >) {
        for (const item of execution.result?.evidence || []) {
          evidence.push({ section: sectionName, ...item });
        }
      }

      return {
        state,
        data: { sections },
        coverage: {
          state,
          sectionsRequested: 3,
          sectionsAttempted: sectionsInvoked,
          sectionsInvoked,
          sectionsSucceeded: successfulResultValues.length,
          deadlineSkippedSections,
          maxConcurrentSections: COLLECTION_DASHBOARD_MAX_CONCURRENT_SECTIONS,
          maxConcurrentRequests: COLLECTION_DASHBOARD_MAX_CONCURRENT_REQUESTS,
          upstreamRequestsBound: upstreamRequestBound(maxSubjects),
          upstreamAttemptsBound:
            upstreamRequestBound(maxSubjects) * (COLLECTION_DASHBOARD_MAX_RETRIES + 1),
          deadlineMs: maxDurationMs,
          timedOutSections,
          collectionRowsRequested: maxCollectionItems * 3,
          collectionRowsObserved,
          collectionRowsBound: maxCollectionItems * 3,
          backlogSubjectsRequested: maxSubjects,
          backlogSubjectsAttempted: backlogCoverage?.hydration.attemptedSubjects ?? 0,
          backlogSubjectsSucceeded: backlogCoverage?.hydration.succeededSubjects ?? 0,
          episodeRowsRequested: maxSubjects * maxEpisodesPerSubject,
          episodeRowsObserved: backlogCoverage?.episodeProgress.observedRows ?? 0,
          calendarRowsRequested: COLLECTION_SCHEDULE_MAX_CALENDAR_ROWS,
          calendarRowsObserved: scheduleCoverage?.calendar.observedRows ?? 0,
          outputRowsRequested: maxRows + maxSubjects + 12,
          retrievedAt,
        },
        source: {
          class: 'composite',
          operations: [
            'GET /v0/users/{username}/collections',
            'GET /v0/users/-/collections/{subject_id}/episodes',
            'GET /calendar',
          ],
          authScope: 'account',
          attemptedAt,
          retrievedAt,
        },
        evidence,
        limitations: buildLimitations(),
        warnings,
      };
    } finally {
      clearTimeout(deadlineTimer);
      deadlineController.abort();
    }
  }
}
