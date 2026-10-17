import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { SubjectRelationItem } from '../models/subject.js';
import { SubjectService } from './subject-service.js';

export const SUBJECT_RELATIONS_ANALYSIS_MODE = 'observed_two_hop_rating' as const;

export const SUBJECT_RELATIONS_ANALYSIS_LIMITS = Object.freeze({
  maxResponseBytesPerRequest: 1024 * 1024,
  maxRootRelationRows: 24,
  maxIntermediateSubjects: 2,
  maxIntermediateRelationRows: 8,
  maxCandidatesPerDepth: 4,
  maxPathsPerCandidate: 4,
  maxTopCandidates: 4,
  maxLogicalRequests: 11,
  maxAttemptsPerLogicalRequest: 3,
});

type OperationStatus = 'succeeded' | 'failed';
type RelationDepth = 1 | 2;

export interface SubjectRelationsAnalysisPath {
  sourceId: number;
  targetId: number;
  subjectIds: number[];
  relationLabels: string[];
  depth: RelationDepth;
}

export interface SubjectRelationsAnalysisTopCandidate {
  id: number;
  type: string;
  name: string;
  nameCn: string;
  score: number;
  ratingTotal: number;
  paths: SubjectRelationsAnalysisPath[];
}

export interface SubjectRelationsAnalysisOperation {
  operation: 'GET /v0/subjects/{subject_id}/subjects' | 'GET /v0/subjects/{subject_id}';
  path: string;
  subjectId: number;
  depth: 0 | 1 | 2;
  status: OperationStatus;
  failureCode?: string;
  responseRowsObserved?: number;
  rowsReturned?: number;
  schemaDriftRows?: number;
}

export interface SubjectRelationsAnalysisResult {
  state: 'observed' | 'partial' | 'not_computable' | 'unavailable' | 'not_found';
  subjectId: number;
  source: {
    api: 'Bangumi official v0';
    direction: 'outgoing_source_to_target';
    scope: 'highest_observed_rating_in_bounded_two_hop_sample';
    operations: SubjectRelationsAnalysisOperation[];
    retrievedAt: string;
  };
  ratingAnalysis: {
    mode: typeof SUBJECT_RELATIONS_ANALYSIS_MODE;
    maxDepth: 2;
    topScore: number | null;
    topCandidateCount: number;
    topCandidatesOmitted: number;
    topCandidates: SubjectRelationsAnalysisTopCandidate[];
    scoredCandidateCount: number;
    tiePolicy: 'exact_numeric_score_ties_are_preserved';
  };
  coverage: {
    rootRelationRowsObserved: number | null;
    rootRelationRowsSelected: number;
    rootRelationRowsOmitted: number | null;
    rootRelationSchemaDriftRows: number;
    intermediateSubjectsObserved: number;
    intermediateSubjectsSelected: number;
    intermediateSubjectsOmitted: number;
    intermediateRelationRowsObserved: number;
    intermediateRelationRowsSelected: number;
    intermediateRelationRowsOmitted: number;
    intermediateRelationSchemaDriftRows: number;
    depth1CandidatesObserved: number;
    depth1CandidatesSelected: number;
    depth1CandidatesOmitted: number;
    depth2CandidatesObserved: number;
    depth2CandidatesSelected: number;
    depth2CandidatesOmitted: number;
    detailRequestsAttempted: number;
    detailRequestsSucceeded: number;
    detailRequestsFailed: number;
    usableRatings: number;
    missingRatings: number;
    duplicateRelationRows: number;
    cycleEdgesSkipped: number;
    pathEvidenceOmitted: number;
    truncated: boolean;
    partialReasons: string[];
    requestBudget: {
      maxResponseBytesPerRequest: number;
      maxLogicalRequests: number;
      logicalRequestsAttempted: number;
      maxAttemptsPerLogicalRequest: number;
      maximumPossibleWireAttempts: number;
    };
  };
  warnings: string[];
  limitations: string[];
}

interface CandidateObservation {
  relation: SubjectRelationItem;
  paths: SubjectRelationsAnalysisPath[];
  pathKeys: Set<string>;
  subject?: Awaited<ReturnType<SubjectService['getSubjectById']>>;
}

function sourceFailureCode(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z0-9_]{1,64}$/u.test(error.code)
  ) {
    return error.code;
  }
  return 'SOURCE_REQUEST_FAILED';
}

function addPartialReason(reasons: Set<string>, reason: string): void {
  reasons.add(reason);
}

function relationPathKey(path: SubjectRelationsAnalysisPath): string {
  return JSON.stringify([path.subjectIds, path.relationLabels]);
}

function relationEdgeKey(row: SubjectRelationItem): string {
  return JSON.stringify([row.id, row.relation]);
}

export class SubjectRelationsAnalysisService {
  private readonly subjectService: SubjectService;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    this.subjectService = new SubjectService(client);
  }

  async getObservedTwoHopRating(subjectId: number): Promise<SubjectRelationsAnalysisResult> {
    const retrievedAt = new Date().toISOString();
    const operations: SubjectRelationsAnalysisOperation[] = [];
    const partialReasons = new Set<string>();
    const truncationReasons = new Set<string>();
    const warnings: string[] = [];
    const limits = SUBJECT_RELATIONS_ANALYSIS_LIMITS;
    const requestBudget: SubjectRelationsAnalysisResult['coverage']['requestBudget'] = {
      maxResponseBytesPerRequest: limits.maxResponseBytesPerRequest,
      maxLogicalRequests: limits.maxLogicalRequests,
      logicalRequestsAttempted: 0,
      maxAttemptsPerLogicalRequest: limits.maxAttemptsPerLogicalRequest,
      maximumPossibleWireAttempts: limits.maxLogicalRequests * limits.maxAttemptsPerLogicalRequest,
    };

    const recordOperation = (
      operation: SubjectRelationsAnalysisOperation['operation'],
      requestedSubjectId: number,
      depth: 0 | 1 | 2,
    ): SubjectRelationsAnalysisOperation => {
      const sourceOperation: SubjectRelationsAnalysisOperation = {
        operation,
        path:
          depth === 0 || operation.endsWith('/subjects')
            ? `/v0/subjects/${requestedSubjectId}/subjects`
            : `/v0/subjects/${requestedSubjectId}`,
        subjectId: requestedSubjectId,
        depth,
        status: 'failed',
      };
      operations.push(sourceOperation);
      requestBudget.logicalRequestsAttempted += 1;
      return sourceOperation;
    };

    const rootOperation = recordOperation('GET /v0/subjects/{subject_id}/subjects', subjectId, 0);
    let rootResult: Awaited<ReturnType<SubjectService['getSubjectRelationsWithCoverage']>>;
    try {
      rootResult = await this.subjectService.getSubjectRelationsWithCoverage(subjectId, {
        limit: limits.maxRootRelationRows,
        maxResponseBytes: limits.maxResponseBytesPerRequest,
        strict: true,
      });
      rootOperation.status = 'succeeded';
      rootOperation.responseRowsObserved = rootResult.coverage.observed;
      rootOperation.rowsReturned = rootResult.coverage.returned;
      rootOperation.schemaDriftRows = rootResult.coverage.schemaDriftRows;
    } catch (error) {
      const failureCode = sourceFailureCode(error);
      rootOperation.failureCode = failureCode;
      const notFound = failureCode === 'NOT_FOUND';
      warnings.push(
        notFound
          ? 'The root subject relation response was not found.'
          : `The root relation request failed (${failureCode}); no ranking was produced.`,
      );
      const state = notFound ? 'not_found' : 'unavailable';
      return this.emptyResult({
        subjectId,
        state,
        retrievedAt,
        operations,
        warnings,
        partialReasons: [notFound ? 'root_not_found' : 'root_relation_request_failed'],
        requestBudget,
      });
    }

    const rootRows = rootResult.items;
    const rootIdsInSourceOrder: number[] = [];
    const rootIdSet = new Set<number>();
    const rootRelationEdgeKeys = new Set<string>();
    let duplicateRelationRows = 0;
    let cycleEdgesSkipped = 0;
    for (const row of rootRows) {
      const edgeKey = relationEdgeKey(row);
      if (rootRelationEdgeKeys.has(edgeKey)) duplicateRelationRows += 1;
      else rootRelationEdgeKeys.add(edgeKey);
      if (row.id === subjectId) {
        cycleEdgesSkipped += 1;
        continue;
      }
      if (!rootIdSet.has(row.id)) {
        rootIdSet.add(row.id);
        rootIdsInSourceOrder.push(row.id);
      }
    }
    if (rootIdsInSourceOrder.length === 0) {
      addPartialReason(partialReasons, 'no_outgoing_candidates_observed');
      warnings.push(
        'No eligible outgoing relation candidates were observed; this does not prove that no relations exist.',
      );
    }

    const depth1Ids = rootIdsInSourceOrder.slice(0, limits.maxCandidatesPerDepth);
    if (rootIdsInSourceOrder.length > depth1Ids.length) {
      addPartialReason(partialReasons, 'depth1_candidate_cap');
      truncationReasons.add('depth1_candidate_cap');
    }
    const intermediateIds = rootIdsInSourceOrder.slice(0, limits.maxIntermediateSubjects);
    if (rootIdsInSourceOrder.length > intermediateIds.length) {
      addPartialReason(partialReasons, 'intermediate_subject_cap');
      truncationReasons.add('intermediate_subject_cap');
    }
    if (rootResult.coverage.truncated) {
      addPartialReason(partialReasons, 'root_relation_response_truncated');
      truncationReasons.add('root_relation_response_truncated');
    }

    const candidateObservations = new Map<number, CandidateObservation>();
    let pathEvidenceOmitted = 0;
    const addPath = (row: SubjectRelationItem, path: SubjectRelationsAnalysisPath): void => {
      let candidate = candidateObservations.get(row.id);
      if (!candidate) {
        candidate = { relation: row, paths: [], pathKeys: new Set() };
        candidateObservations.set(row.id, candidate);
      }
      const key = relationPathKey(path);
      if (candidate.pathKeys.has(key)) {
        return;
      }
      if (candidate.paths.length >= limits.maxPathsPerCandidate) {
        pathEvidenceOmitted += 1;
        addPartialReason(partialReasons, 'path_evidence_cap');
        truncationReasons.add('path_evidence_cap');
        return;
      }
      candidate.pathKeys.add(key);
      candidate.paths.push(path);
    };

    const depth1IdSet = new Set(depth1Ids);
    for (const row of rootRows) {
      if (row.id === subjectId || !depth1IdSet.has(row.id)) continue;
      addPath(row, {
        sourceId: subjectId,
        targetId: row.id,
        subjectIds: [subjectId, row.id],
        relationLabels: [row.relation],
        depth: 1,
      });
    }

    let intermediateRelationRowsObserved = 0;
    let intermediateRelationRowsSelected = 0;
    let intermediateRelationSchemaDriftRows = 0;
    let stopAfterRateLimit = false;
    const depth2RowsInSourceOrder: SubjectRelationItem[] = [];
    const depth2IdSet = new Set<number>();
    const intermediateSourceRows = new Map<number, SubjectRelationItem[]>();

    for (const intermediateId of intermediateIds) {
      const operation = recordOperation(
        'GET /v0/subjects/{subject_id}/subjects',
        intermediateId,
        1,
      );
      try {
        const result = await this.subjectService.getSubjectRelationsWithCoverage(intermediateId, {
          limit: limits.maxIntermediateRelationRows,
          maxResponseBytes: limits.maxResponseBytesPerRequest,
          strict: true,
        });
        operation.status = 'succeeded';
        operation.responseRowsObserved = result.coverage.observed;
        operation.rowsReturned = result.coverage.returned;
        operation.schemaDriftRows = result.coverage.schemaDriftRows;
        intermediateRelationRowsObserved += result.coverage.observed;
        intermediateRelationRowsSelected += result.coverage.returned;
        intermediateRelationSchemaDriftRows += result.coverage.schemaDriftRows;
        if (result.coverage.truncated) {
          addPartialReason(partialReasons, 'intermediate_relation_response_truncated');
          truncationReasons.add('intermediate_relation_response_truncated');
        }

        const parent = rootRows.filter((row) => row.id === intermediateId);
        const parentPath = parent[0];
        if (!parentPath) continue;
        intermediateSourceRows.set(intermediateId, result.items);
        const relationEdgeKeys = new Set<string>();
        for (const row of result.items) {
          const edgeKey = relationEdgeKey(row);
          if (relationEdgeKeys.has(edgeKey)) duplicateRelationRows += 1;
          else relationEdgeKeys.add(edgeKey);
          if (row.id === subjectId || row.id === intermediateId) {
            cycleEdgesSkipped += 1;
            continue;
          }
          if (!depth2IdSet.has(row.id)) {
            depth2IdSet.add(row.id);
            depth2RowsInSourceOrder.push(row);
          }
        }
      } catch (error) {
        const failureCode = sourceFailureCode(error);
        operation.failureCode = failureCode;
        warnings.push(`Intermediate relation request failed (${failureCode}).`);
        addPartialReason(partialReasons, 'intermediate_relation_request_failed');
        if (failureCode === 'RATE_LIMITED') {
          stopAfterRateLimit = true;
          warnings.push('Stopped remaining traversal requests after a rate-limit response.');
          addPartialReason(partialReasons, 'upstream_rate_limited');
          break;
        }
      }
    }

    const depth2Ids = depth2RowsInSourceOrder
      .slice(0, limits.maxCandidatesPerDepth)
      .map((row) => row.id);
    const depth2SelectedIds = new Set(depth2Ids);
    if (depth2IdSet.size > depth2SelectedIds.size) {
      addPartialReason(partialReasons, 'depth2_candidate_cap');
      truncationReasons.add('depth2_candidate_cap');
    }
    const depth2RowById = new Map<number, SubjectRelationItem>();
    for (const [intermediateId, rows] of intermediateSourceRows) {
      for (const row of rows) {
        if (
          row.id !== subjectId &&
          row.id !== intermediateId &&
          depth2SelectedIds.has(row.id) &&
          !depth2RowById.has(row.id)
        ) {
          depth2RowById.set(row.id, row);
        }
      }
    }
    for (const intermediateId of intermediateIds) {
      const parentPaths = rootRows.filter((row) => row.id === intermediateId);
      if (parentPaths.length === 0) continue;
      const childRows = intermediateSourceRows.get(intermediateId) ?? [];
      for (const row of childRows) {
        if (row.id === subjectId || row.id === intermediateId || !depth2SelectedIds.has(row.id)) {
          continue;
        }
        for (const parentPath of parentPaths) {
          addPath(depth2RowById.get(row.id) ?? row, {
            sourceId: subjectId,
            targetId: row.id,
            subjectIds: [subjectId, intermediateId, row.id],
            relationLabels: [parentPath.relation, row.relation],
            depth: 2,
          });
        }
      }
    }

    const candidates = new Map<number, CandidateObservation>();
    for (const id of depth1Ids) {
      const candidate = candidateObservations.get(id);
      if (candidate) candidates.set(id, candidate);
    }
    for (const id of depth2Ids) {
      const candidate = candidateObservations.get(id);
      if (candidate) candidates.set(id, candidate);
    }

    let detailRequestsSucceeded = 0;
    let detailRequestsFailed = 0;
    let detailRequestsAttempted = 0;
    let usableRatings = 0;
    let missingRatings = 0;
    for (const [candidateId, candidate] of candidates) {
      if (stopAfterRateLimit) break;
      const operation = recordOperation(
        'GET /v0/subjects/{subject_id}',
        candidateId,
        candidate.paths.reduce<0 | 1 | 2>(
          (depth, path) => Math.max(depth, path.depth) as 0 | 1 | 2,
          0,
        ),
      );
      detailRequestsAttempted += 1;
      try {
        const subject = await this.subjectService.getSubjectById(candidateId, {
          maxResponseBytes: limits.maxResponseBytesPerRequest,
          strict: true,
        });
        operation.status = 'succeeded';
        detailRequestsSucceeded += 1;
        candidate.subject = subject;
        if (
          Number.isFinite(subject.score) &&
          (subject.score ?? 0) > 0 &&
          Number.isFinite(subject.ratingTotal) &&
          (subject.ratingTotal ?? 0) > 0
        ) {
          usableRatings += 1;
        } else {
          missingRatings += 1;
          addPartialReason(partialReasons, 'candidate_rating_unavailable');
        }
      } catch (error) {
        const failureCode = sourceFailureCode(error);
        operation.failureCode = failureCode;
        detailRequestsFailed += 1;
        missingRatings += 1;
        warnings.push(`Candidate detail request failed (${failureCode}).`);
        addPartialReason(partialReasons, 'candidate_detail_request_failed');
        if (failureCode === 'RATE_LIMITED') {
          stopAfterRateLimit = true;
          warnings.push('Stopped remaining traversal requests after a rate-limit response.');
          addPartialReason(partialReasons, 'upstream_rate_limited');
          break;
        }
      }
    }

    if (rootResult.coverage.schemaDriftRows > 0 || intermediateRelationSchemaDriftRows > 0) {
      addPartialReason(partialReasons, 'source_schema_drift');
      truncationReasons.add('source_schema_drift');
    }
    const ratedCandidates = [...candidates.values()].filter(
      (candidate) =>
        Number.isFinite(candidate.subject?.score) &&
        (candidate.subject?.score ?? 0) > 0 &&
        Number.isFinite(candidate.subject?.ratingTotal) &&
        (candidate.subject?.ratingTotal ?? 0) > 0,
    );
    const topScore = ratedCandidates.reduce<number | null>(
      (highest, candidate) =>
        highest === null || (candidate.subject?.score ?? 0) > highest
          ? (candidate.subject?.score ?? null)
          : highest,
      null,
    );
    const tiedCandidates = ratedCandidates
      .filter((candidate) => candidate.subject?.score === topScore)
      .sort((left, right) => left.relation.id - right.relation.id);
    const topCandidates = tiedCandidates.slice(0, limits.maxTopCandidates).map((candidate) => ({
      id: candidate.relation.id,
      type: candidate.subject?.type ?? candidate.relation.type,
      name: candidate.subject?.name || candidate.relation.name,
      nameCn: candidate.subject?.nameCn || candidate.relation.nameCn,
      score: candidate.subject?.score ?? 0,
      ratingTotal: candidate.subject?.ratingTotal ?? 0,
      paths: candidate.paths,
    }));
    const topCandidatesOmitted = Math.max(0, tiedCandidates.length - topCandidates.length);
    if (topCandidatesOmitted > 0) {
      addPartialReason(partialReasons, 'top_tie_output_cap');
      truncationReasons.add('top_tie_output_cap');
    }

    const rootRelationRowsOmitted = Math.max(
      0,
      rootResult.coverage.observed - rootResult.coverage.returned,
    );
    const intermediateRelationRowsOmitted = Math.max(
      0,
      intermediateRelationRowsObserved - intermediateRelationRowsSelected,
    );
    const truncated = truncationReasons.size > 0;
    const state: SubjectRelationsAnalysisResult['state'] =
      topCandidates.length > 0
        ? partialReasons.size > 0
          ? 'partial'
          : 'observed'
        : 'not_computable';

    return {
      state,
      subjectId,
      source: {
        api: 'Bangumi official v0',
        direction: 'outgoing_source_to_target',
        scope: 'highest_observed_rating_in_bounded_two_hop_sample',
        operations,
        retrievedAt: new Date().toISOString(),
      },
      ratingAnalysis: {
        mode: SUBJECT_RELATIONS_ANALYSIS_MODE,
        maxDepth: 2,
        topScore,
        topCandidateCount: tiedCandidates.length,
        topCandidatesOmitted,
        topCandidates,
        scoredCandidateCount: usableRatings,
        tiePolicy: 'exact_numeric_score_ties_are_preserved',
      },
      coverage: {
        rootRelationRowsObserved: rootResult.coverage.observed,
        rootRelationRowsSelected: rootResult.coverage.returned,
        rootRelationRowsOmitted,
        rootRelationSchemaDriftRows: rootResult.coverage.schemaDriftRows,
        intermediateSubjectsObserved: rootIdsInSourceOrder.length,
        intermediateSubjectsSelected: intermediateIds.length,
        intermediateSubjectsOmitted: Math.max(
          0,
          rootIdsInSourceOrder.length - intermediateIds.length,
        ),
        intermediateRelationRowsObserved,
        intermediateRelationRowsSelected,
        intermediateRelationRowsOmitted,
        intermediateRelationSchemaDriftRows,
        depth1CandidatesObserved: rootIdsInSourceOrder.length,
        depth1CandidatesSelected: depth1Ids.length,
        depth1CandidatesOmitted: Math.max(0, rootIdsInSourceOrder.length - depth1Ids.length),
        depth2CandidatesObserved: depth2IdSet.size,
        depth2CandidatesSelected: depth2Ids.length,
        depth2CandidatesOmitted: Math.max(0, depth2IdSet.size - depth2Ids.length),
        detailRequestsAttempted,
        detailRequestsSucceeded,
        detailRequestsFailed,
        usableRatings,
        missingRatings,
        duplicateRelationRows,
        cycleEdgesSkipped,
        pathEvidenceOmitted,
        truncated,
        partialReasons: [...partialReasons],
        requestBudget,
      },
      warnings,
      limitations: [
        '仅表示本次请求实际读取到的出向关系和成功取得评分的条目；官方关系响应无分页、总数或图完整性承诺。',
        '“最高”只指本次有界且成功评分的观察样本；未观察到的反向/隐藏/截断路径可能改变结果。',
        '关系行按来源响应顺序应用本地上限；该顺序不具有官方排序语义。',
        '重复关系行计数按单个响应统计，只覆盖应用本地行上限后返回的行；不包含被上限裁剪的行或跨响应重复项。',
        '并列项仅表示观察到的数值同分；为稳定展示按条目 ID 排列，不代表官方优先级。',
        '评分来自 subject detail 响应，受官方缓存影响，不构成同步实时快照。',
      ],
    };
  }

  private emptyResult(input: {
    subjectId: number;
    state: 'unavailable' | 'not_found';
    retrievedAt: string;
    operations: SubjectRelationsAnalysisOperation[];
    warnings: string[];
    partialReasons: string[];
    requestBudget: SubjectRelationsAnalysisResult['coverage']['requestBudget'];
  }): SubjectRelationsAnalysisResult {
    return {
      state: input.state,
      subjectId: input.subjectId,
      source: {
        api: 'Bangumi official v0',
        direction: 'outgoing_source_to_target',
        scope: 'highest_observed_rating_in_bounded_two_hop_sample',
        operations: input.operations,
        retrievedAt: new Date().toISOString(),
      },
      ratingAnalysis: {
        mode: SUBJECT_RELATIONS_ANALYSIS_MODE,
        maxDepth: 2,
        topScore: null,
        topCandidateCount: 0,
        topCandidatesOmitted: 0,
        topCandidates: [],
        scoredCandidateCount: 0,
        tiePolicy: 'exact_numeric_score_ties_are_preserved',
      },
      coverage: {
        rootRelationRowsObserved: null,
        rootRelationRowsSelected: 0,
        rootRelationRowsOmitted: null,
        rootRelationSchemaDriftRows: 0,
        intermediateSubjectsObserved: 0,
        intermediateSubjectsSelected: 0,
        intermediateSubjectsOmitted: 0,
        intermediateRelationRowsObserved: 0,
        intermediateRelationRowsSelected: 0,
        intermediateRelationRowsOmitted: 0,
        intermediateRelationSchemaDriftRows: 0,
        depth1CandidatesObserved: 0,
        depth1CandidatesSelected: 0,
        depth1CandidatesOmitted: 0,
        depth2CandidatesObserved: 0,
        depth2CandidatesSelected: 0,
        depth2CandidatesOmitted: 0,
        detailRequestsAttempted: 0,
        detailRequestsSucceeded: 0,
        detailRequestsFailed: 0,
        usableRatings: 0,
        missingRatings: 0,
        duplicateRelationRows: 0,
        cycleEdgesSkipped: 0,
        pathEvidenceOmitted: 0,
        truncated: false,
        partialReasons: input.partialReasons,
        requestBudget: input.requestBudget,
      },
      warnings: input.warnings,
      limitations: [
        '未获得 root 关系响应，因此不能判断其是否存在关联条目，也不能计算观察样本排名。',
        '该接口不提供反向关系、分页、总数或图完整性保证。',
      ],
    };
  }
}
