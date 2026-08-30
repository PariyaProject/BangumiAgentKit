import {
  BangumiError,
  HttpClient,
  isBangumiError,
  toPublicError,
} from '@bangumi-agent-kit/bangumi-transport';
import type {
  SubjectIndexMembership,
  SubjectIndexMembershipCoverage,
  SubjectIndexMembershipEvidence,
  SubjectIndexMembershipIndexResult,
  SubjectIndexMembershipMatch,
  SubjectIndexMembershipResult,
  SubjectIndexMembershipState,
} from '../models/subject-index-membership.js';

export const SUBJECT_INDEX_MEMBERSHIP_MAX_INDEX_IDS = 8;
export const SUBJECT_INDEX_MEMBERSHIP_MAX_INDEX_ID = 10_000_000;
export const SUBJECT_INDEX_MEMBERSHIP_MAX_SUBJECT_ID = 10_000_000;
export const SUBJECT_INDEX_MEMBERSHIP_DEFAULT_PAGE_SIZE = 50;
export const SUBJECT_INDEX_MEMBERSHIP_MAX_PAGE_SIZE = 50;
export const SUBJECT_INDEX_MEMBERSHIP_DEFAULT_MAX_PAGES = 8;
export const SUBJECT_INDEX_MEMBERSHIP_MAX_PAGES = 8;
export const SUBJECT_INDEX_MEMBERSHIP_DEFAULT_MAX_ROWS = 400;
export const SUBJECT_INDEX_MEMBERSHIP_MAX_ROWS = 400;
export const SUBJECT_INDEX_MEMBERSHIP_DEFAULT_RESPONSE_BYTES = 1_048_576;
export const SUBJECT_INDEX_MEMBERSHIP_MAX_RESPONSE_BYTES = 4_194_304;

const INDEX_SUBJECTS_OPERATION = 'GET /v0/indices/{index_id}/subjects' as const;

interface IndexSubjectsResponse {
  data?: unknown;
  total?: unknown;
}

interface IndexSubjectRow {
  id?: unknown;
  order?: unknown;
}

export interface SubjectIndexMembershipOptions {
  pageSize?: number;
  maxPages?: number;
  maxRows?: number;
  maxResponseBytes?: number;
}

function assertId(value: number, label: string, maximum: number): void {
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new BangumiError(
      'VALIDATION_ERROR',
      `${label} must be a positive integer no greater than ${maximum}.`,
      false,
      400,
    );
  }
}

function boundedOption(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new BangumiError(
      'VALIDATION_ERROR',
      `Membership scan option must be an integer between 1 and ${maximum}.`,
      false,
      400,
    );
  }
  return value;
}

function parseNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function parseRow(value: unknown): IndexSubjectRow | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as IndexSubjectRow;
}

function classifyError(error: unknown, pagesSucceeded: number): SubjectIndexMembershipState {
  if (pagesSucceeded > 0) return 'partial';
  if (isBangumiError(error) && error.code === 'NOT_FOUND') return 'not_found';
  return 'unavailable';
}

function errorReason(
  error: unknown,
  pagesSucceeded: number,
): SubjectIndexMembershipCoverage['completionReason'] {
  if (pagesSucceeded === 0 && isBangumiError(error) && error.code === 'NOT_FOUND') {
    return 'not_found';
  }
  if (isBangumiError(error) && error.code === 'PARSER_ERROR') return 'invalid_response';
  return 'upstream_error';
}

function stateWarning(
  state: SubjectIndexMembershipState,
  error: unknown,
): SubjectIndexMembershipIndexResult['warnings'][number] {
  const publicError = toPublicError(error);
  return {
    code: 'INDEX_MEMBERSHIP_SCAN_INCOMPLETE',
    state,
    message: publicError.message,
  };
}

function membershipFor(
  state: SubjectIndexMembershipState,
  matches: SubjectIndexMembershipMatch[],
): SubjectIndexMembership {
  if (matches.length > 0) return 'matched';
  return state === 'complete' ? 'not_matched_in_observed_scope' : 'unknown';
}

export class SubjectIndexMembershipService {
  constructor(private readonly client: HttpClient) {}

  async getSubjectIndexMembership(
    subjectId: number,
    indexIds: number[],
    options: SubjectIndexMembershipOptions = {},
  ): Promise<SubjectIndexMembershipResult> {
    assertId(subjectId, 'subjectId', SUBJECT_INDEX_MEMBERSHIP_MAX_SUBJECT_ID);
    if (
      !Array.isArray(indexIds) ||
      indexIds.length < 1 ||
      indexIds.length > SUBJECT_INDEX_MEMBERSHIP_MAX_INDEX_IDS
    ) {
      throw new BangumiError(
        'VALIDATION_ERROR',
        `indexIds must contain 1-${SUBJECT_INDEX_MEMBERSHIP_MAX_INDEX_IDS} IDs.`,
        false,
        400,
      );
    }
    if (new Set(indexIds).size !== indexIds.length) {
      throw new BangumiError(
        'VALIDATION_ERROR',
        'indexIds must not contain duplicates.',
        false,
        400,
      );
    }
    for (const indexId of indexIds) {
      assertId(indexId, 'indexId', SUBJECT_INDEX_MEMBERSHIP_MAX_INDEX_ID);
    }

    const pageSize = boundedOption(
      options.pageSize,
      SUBJECT_INDEX_MEMBERSHIP_DEFAULT_PAGE_SIZE,
      SUBJECT_INDEX_MEMBERSHIP_MAX_PAGE_SIZE,
    );
    const maxPages = boundedOption(
      options.maxPages,
      SUBJECT_INDEX_MEMBERSHIP_DEFAULT_MAX_PAGES,
      SUBJECT_INDEX_MEMBERSHIP_MAX_PAGES,
    );
    const maxRows = boundedOption(
      options.maxRows,
      SUBJECT_INDEX_MEMBERSHIP_DEFAULT_MAX_ROWS,
      SUBJECT_INDEX_MEMBERSHIP_MAX_ROWS,
    );
    const maxResponseBytes = boundedOption(
      options.maxResponseBytes,
      SUBJECT_INDEX_MEMBERSHIP_DEFAULT_RESPONSE_BYTES,
      SUBJECT_INDEX_MEMBERSHIP_MAX_RESPONSE_BYTES,
    );
    const attemptedAt = new Date().toISOString();

    const indexes: SubjectIndexMembershipIndexResult[] = [];
    for (const indexId of indexIds) {
      indexes.push(
        await this.scanIndex(indexId, subjectId, {
          pageSize,
          maxPages,
          maxRows,
          maxResponseBytes,
        }),
      );
    }

    const matched = indexes.filter((index) => index.membership === 'matched');
    const notMatchedInObservedScope = indexes.filter(
      (index) => index.membership === 'not_matched_in_observed_scope',
    );
    const unknown = indexes.filter((index) => index.membership === 'unknown');
    const complete = indexes.filter((index) => index.state === 'complete');
    const partial = indexes.filter((index) => index.state === 'partial');
    const unavailable = indexes.filter(
      (index) => index.state === 'unavailable' || index.state === 'not_found',
    );
    const allNotFound = indexes.every((index) => index.state === 'not_found');
    const state: SubjectIndexMembershipState =
      allNotFound && indexes.length > 0
        ? 'not_found'
        : complete.length === indexes.length
          ? 'complete'
          : partial.length > 0 || complete.length > 0
            ? 'partial'
            : 'unavailable';

    const warnings = indexes.flatMap((index) => index.warnings);
    const evidence = indexes.flatMap((index) => index.evidence);
    const retrievedAt = indexes
      .map((index) => index.source.retrievedAt)
      .filter((value): value is string => value !== undefined)
      .at(-1);
    const requestsSucceeded = indexes.reduce(
      (sum, index) => sum + index.coverage.pagesSucceeded,
      0,
    );
    const requestsAttempted = indexes.reduce(
      (sum, index) => sum + index.coverage.pagesAttempted,
      0,
    );
    const limitations = [
      '只扫描调用方提供的 indexIds；本结果不发现其他目录，也不等同“所有推荐目录”。',
      '未匹配仅表示在本次完整扫描的 supplied index observed scope 内未发现该 subjectId；partial、unavailable 或 not_found 结果保持 unknown。',
      '只使用官方 v0 目录条目列表的精确数值 ID；不读取 HTML、Structured Web、评论、目录描述或其他社区文本。',
    ];
    for (const index of indexes) {
      if (index.coverage.completionReason === 'page_cap') {
        limitations.push(
          `目录 ${index.indexId} 达到页数上限；未匹配不可解释为该目录不存在此条目。`,
        );
      } else if (index.coverage.completionReason === 'row_cap') {
        limitations.push(
          `目录 ${index.indexId} 达到行数上限；未匹配不可解释为该目录不存在此条目。`,
        );
      } else if (index.coverage.completionReason === 'invalid_response') {
        limitations.push(
          `目录 ${index.indexId} 的响应证据不一致；未匹配不可解释为该目录不存在此条目。`,
        );
      } else if (index.coverage.completionReason === 'upstream_error') {
        limitations.push(
          `目录 ${index.indexId} 在完整扫描前发生上游错误；未匹配不可解释为该目录不存在此条目。`,
        );
      }
    }

    return {
      subjectId,
      state,
      indexes,
      summary: {
        requested: indexes.length,
        matched: matched.length,
        notMatchedInObservedScope: notMatchedInObservedScope.length,
        unknown: unknown.length,
      },
      coverage: {
        indexesRequested: indexes.length,
        indexesComplete: complete.length,
        indexesPartial: partial.length,
        indexesUnavailable: unavailable.length,
        requestsAttempted,
        requestsSucceeded,
        pagesAttempted: requestsAttempted,
        pagesSucceeded: requestsSucceeded,
        pageSize,
        maxPages,
        maxRows,
        responseLimitBytes: maxResponseBytes,
        attemptedAt,
        ...(retrievedAt ? { retrievedAt } : {}),
      },
      source: {
        class: 'official-v0',
        provider: 'bangumi',
        operations: [INDEX_SUBJECTS_OPERATION],
        responseLimitBytes: maxResponseBytes,
        attemptedAt,
        ...(retrievedAt ? { retrievedAt } : {}),
      },
      evidence,
      warnings,
      limitations: [...new Set(limitations)],
      attemptedAt,
      ...(retrievedAt ? { retrievedAt } : {}),
    };
  }

  private async scanIndex(
    indexId: number,
    subjectId: number,
    options: {
      pageSize: number;
      maxPages: number;
      maxRows: number;
      maxResponseBytes: number;
    },
  ): Promise<SubjectIndexMembershipIndexResult> {
    const attemptedAt = new Date().toISOString();
    let offset = 0;
    let pagesAttempted = 0;
    let pagesSucceeded = 0;
    let rowsObserved = 0;
    let rowsReturned = 0;
    let validRows = 0;
    let malformedRows = 0;
    let duplicateRows = 0;
    let total: number | undefined;
    let retrievedAt: string | undefined;
    let upstreamExhausted = false;
    let truncated = false;
    const integrityIssues: string[] = [];
    let totalIntegrityInvalid = false;
    let completionReason: SubjectIndexMembershipCoverage['completionReason'] = 'page_cap';
    const seenSubjectIds = new Set<number>();
    const matches: SubjectIndexMembershipMatch[] = [];
    let state: SubjectIndexMembershipState = 'partial';
    let error: SubjectIndexMembershipIndexResult['error'];
    const warnings: SubjectIndexMembershipIndexResult['warnings'] = [];

    const markIntegrityIssue = (reason: string, affectsTotal = false): void => {
      if (!integrityIssues.includes(reason)) integrityIssues.push(reason);
      if (affectsTotal) totalIntegrityInvalid = true;
    };

    while (pagesAttempted < options.maxPages && rowsObserved < options.maxRows) {
      const requestLimit = Math.min(options.pageSize, options.maxRows - rowsObserved);
      pagesAttempted += 1;
      try {
        const response = await this.client.request<IndexSubjectsResponse>({
          method: 'GET',
          path: `/v0/indices/${encodeURIComponent(String(indexId))}/subjects`,
          query: { limit: requestLimit, offset },
          maxResponseBytes: options.maxResponseBytes,
          retryOptions: { maxRetries: 0 },
        });
        if (!response || typeof response !== 'object' || !Array.isArray(response.data)) {
          throw new BangumiError(
            'PARSER_ERROR',
            'Index subjects response data must be an array.',
            false,
          );
        }
        pagesSucceeded += 1;
        retrievedAt = new Date().toISOString();
        const data = response.data;
        const rows = data.slice(0, requestLimit);
        rowsObserved += rows.length;
        rowsReturned += rows.length;
        const responseTotal = parseNonNegativeInteger(response.total);
        if (response.total !== undefined && responseTotal === undefined) {
          markIntegrityIssue('invalid_total', true);
        } else if (responseTotal !== undefined) {
          if (total !== undefined && responseTotal !== total) {
            markIntegrityIssue('changing_total', true);
          } else if (total === undefined) {
            total = responseTotal;
          }
        }

        for (const rawRow of rows) {
          const row = parseRow(rawRow);
          const rowId = row?.id;
          if (typeof rowId !== 'number' || !Number.isInteger(rowId) || rowId <= 0) {
            malformedRows += 1;
            markIntegrityIssue('malformed_row');
            continue;
          }
          validRows += 1;
          if (seenSubjectIds.has(rowId)) {
            duplicateRows += 1;
            markIntegrityIssue('duplicate_row');
          }
          seenSubjectIds.add(rowId);
          if (rowId === subjectId && !matches.some((match) => match.subjectId === rowId)) {
            const order = row?.order;
            matches.push({
              subjectId: rowId,
              ...(typeof order === 'number' && Number.isInteger(order) ? { order } : {}),
            });
          }
        }

        const responseOverReturned = data.length > rows.length;
        const responseEndOffset = offset + data.length;
        if (total !== undefined && (offset > total || responseEndOffset > total)) {
          markIntegrityIssue('contradictory_total', true);
        }
        if (data.length === 0 && total !== undefined && offset < total) {
          markIntegrityIssue('empty_page_before_total', true);
        } else if (data.length < requestLimit && total !== undefined && responseEndOffset < total) {
          markIntegrityIssue('short_page_before_total', true);
        }
        if (integrityIssues.length > 0) {
          truncated = true;
          completionReason = 'invalid_response';
          state = 'partial';
          warnings.push({
            code: 'INDEX_MEMBERSHIP_INVALID_RESPONSE',
            state,
            message: `Official index response was inconsistent (${integrityIssues.join(', ')}).`,
          });
          break;
        }
        const reachedTotal =
          !responseOverReturned && total !== undefined && offset + data.length >= total;
        const shortPage = !responseOverReturned && data.length < requestLimit;
        if (responseOverReturned) {
          truncated = true;
          completionReason = 'row_cap';
          state = 'partial';
          break;
        }
        if (reachedTotal || shortPage) {
          upstreamExhausted = true;
          completionReason = 'upstream_exhausted';
          state = 'complete';
          break;
        }
        if (rowsObserved >= options.maxRows) {
          truncated = true;
          completionReason = 'row_cap';
          state = 'partial';
          break;
        }
        offset += data.length;
      } catch (caught: unknown) {
        state = classifyError(caught, pagesSucceeded);
        completionReason = errorReason(caught, pagesSucceeded);
        error = toPublicError(caught);
        if (pagesSucceeded > 0) truncated = true;
        warnings.push(stateWarning(state, caught));
        break;
      }
    }

    if (!upstreamExhausted && !error && !truncated) {
      truncated = true;
      completionReason = rowsObserved >= options.maxRows ? 'row_cap' : 'page_cap';
      state = 'partial';
    }

    const membership = membershipFor(state, matches);
    const evidence: SubjectIndexMembershipEvidence[] =
      pagesSucceeded > 0 && retrievedAt
        ? [
            {
              source: 'official-v0',
              provider: 'bangumi',
              operation: INDEX_SUBJECTS_OPERATION,
              version: 'v0',
              indexId,
              subjectId,
              fieldPath: 'data[].id',
              observation: membership,
              observationScope: state === 'complete' ? 'complete_scan' : 'successful_pages',
              retrievedAt,
            },
          ]
        : [];
    const totalCoverage =
      total === undefined || totalIntegrityInvalid
        ? { totalKind: 'unknown' as const }
        : { total, totalKind: 'exact' as const };
    const coverage: SubjectIndexMembershipCoverage = {
      pageSize: options.pageSize,
      maxPages: options.maxPages,
      maxRows: options.maxRows,
      responseLimitBytes: options.maxResponseBytes,
      attemptedAt,
      ...(retrievedAt ? { retrievedAt } : {}),
      pagesAttempted,
      pagesSucceeded,
      rowsObserved,
      rowsReturned,
      validRows,
      malformedRows,
      duplicateRows,
      ...totalCoverage,
      upstreamExhausted,
      truncated,
      integrity: integrityIssues.length > 0 ? 'inconsistent' : 'consistent',
      completionReason,
    };

    return {
      indexId,
      state,
      membership,
      matches,
      coverage,
      source: {
        class: 'official-v0',
        provider: 'bangumi',
        operation: INDEX_SUBJECTS_OPERATION,
        responseLimitBytes: options.maxResponseBytes,
        attemptedAt,
        ...(retrievedAt ? { retrievedAt } : {}),
      },
      evidence,
      warnings,
      ...(error ? { error } : {}),
    };
  }
}
