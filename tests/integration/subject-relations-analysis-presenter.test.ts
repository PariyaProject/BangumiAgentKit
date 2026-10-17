import { describe, expect, it } from 'vitest';
import type { SubjectRelationsAnalysisResult } from '@bangumi-agent-kit/bangumi-core';
import {
  MCP_TOOL_TEXT_MAX_UTF8_BYTES,
  presentMcpToolResult,
} from '../../apps/mcp/src/result-presenter.js';

function makeAnalysisResult(): SubjectRelationsAnalysisResult {
  const veryLongText = '作品与关系标签'.repeat(2_000);
  return {
    state: 'partial',
    subjectId: 500,
    source: {
      api: 'Bangumi official v0',
      direction: 'outgoing_source_to_target',
      scope: 'highest_observed_rating_in_bounded_two_hop_sample',
      retrievedAt: '2026-10-17T00:00:00.000Z',
      operations: Array.from({ length: 11 }, (_, index) => ({
        operation:
          index === 0 ? 'GET /v0/subjects/{subject_id}/subjects' : 'GET /v0/subjects/{subject_id}',
        path: `/v0/subjects/${500 + index}`,
        subjectId: 500 + index,
        depth: index === 0 ? 0 : 1,
        status: index === 9 ? 'failed' : 'succeeded',
        ...(index === 9 ? { failureCode: 'SOURCE_REQUEST_FAILED' } : {}),
      })),
    },
    ratingAnalysis: {
      mode: 'observed_two_hop_rating',
      maxDepth: 2,
      topScore: 8.8,
      topCandidateCount: 4,
      topCandidatesOmitted: 0,
      topCandidates: Array.from({ length: 4 }, (_, candidateIndex) => ({
        id: 700 + candidateIndex,
        type: 'anime',
        name: veryLongText,
        nameCn: veryLongText,
        score: 8.8,
        ratingTotal: 1_000,
        paths: Array.from({ length: 4 }, (_, pathIndex) => ({
          sourceId: 500,
          targetId: 700 + candidateIndex,
          subjectIds: [500, 600 + pathIndex, 700 + candidateIndex],
          relationLabels: [veryLongText, veryLongText],
          depth: 2 as const,
        })),
      })),
      scoredCandidateCount: 12,
      tiePolicy: 'exact_numeric_score_ties_are_preserved',
    },
    coverage: {
      rootRelationRowsObserved: 24,
      rootRelationRowsSelected: 24,
      rootRelationRowsOmitted: 0,
      rootRelationSchemaDriftRows: 0,
      intermediateSubjectsObserved: 8,
      intermediateSubjectsSelected: 2,
      intermediateSubjectsOmitted: 6,
      intermediateRelationRowsObserved: 16,
      intermediateRelationRowsSelected: 16,
      intermediateRelationRowsOmitted: 0,
      intermediateRelationSchemaDriftRows: 0,
      depth1CandidatesObserved: 8,
      depth1CandidatesSelected: 4,
      depth1CandidatesOmitted: 4,
      depth2CandidatesObserved: 12,
      depth2CandidatesSelected: 4,
      depth2CandidatesOmitted: 8,
      detailRequestsAttempted: 8,
      detailRequestsSucceeded: 7,
      detailRequestsFailed: 1,
      usableRatings: 7,
      missingRatings: 1,
      duplicateRelationRows: 1,
      cycleEdgesSkipped: 2,
      pathEvidenceOmitted: 0,
      truncated: true,
      partialReasons: ['depth1_candidate_cap', 'candidate_detail_request_failed'],
      requestBudget: {
        maxResponseBytesPerRequest: 1024 * 1024,
        maxLogicalRequests: 11,
        logicalRequestsAttempted: 11,
        maxAttemptsPerLogicalRequest: 3,
        maximumPossibleWireAttempts: 33,
      },
    },
    warnings: ['Candidate detail request failed (SOURCE_REQUEST_FAILED).'],
    limitations: ['最高分仅指本次有界样本；官方关系响应没有分页、总数或图完整性承诺。'],
  };
}

describe('MCP presentation for bounded subject-relations rating analysis', () => {
  it('keeps bounded text honest and compact while retaining full structured evidence', () => {
    const original = makeAnalysisResult();
    const presentation = presentMcpToolResult(
      'bangumi.get_subject_relations',
      original as unknown as Record<string, unknown>,
    );
    const parsed = JSON.parse(presentation.text);

    expect(Buffer.byteLength(presentation.text, 'utf8')).toBeLessThanOrEqual(
      MCP_TOOL_TEXT_MAX_UTF8_BYTES,
    );
    expect(presentation.structuredContent).toBe(original);
    expect(parsed.summary).toContain('本次有界样本最高观察分 8.8');
    expect(parsed.scope).toContain('不代表完整关系图或全局最高分');
    expect(parsed.ratingAnalysis.candidates).toHaveLength(4);
    expect(parsed.ratingAnalysis.candidates[0].paths).toHaveLength(1);
    expect(parsed.ratingAnalysis.candidates[0].pathsOmittedFromText).toBe(3);
    expect(parsed.coverage.requestBudget.maximumPossibleWireAttempts).toBe(33);
    expect(parsed.operations).toContainEqual(
      expect.objectContaining({ status: 'failed', failureCode: 'SOURCE_REQUEST_FAILED' }),
    );
    expect(parsed.fullStructuredContentAvailable).toBe(true);
  });
});
