import {
  agentMcpProfileArgumentsSha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';

export const R03_RELATIONS_OFFLINE_PROFILE_ID = 'r03-direct-relations-offline-agent-mcp-matrix-v2';
export const R03_RELATIONS_OFFLINE_EPOCH_ID =
  'run95-r03-direct-relations-offline-agent-mcp-matrix-v2-20261017';
export const R03_RELATIONS_OFFLINE_NETWORK_MODE = 'run95-r03-direct-relations-offline-matrix-v2';
export const R03_RELATIONS_OFFLINE_ARGUMENT_PROFILE =
  'fixed-r03-synthetic-direct-relations-991020-v2';
export const R03_RELATIONS_OFFLINE_ACKNOWLEDGEMENT = 'R03_SYNTHETIC_DIRECT_RELATION_MATRIX_READ';
export const R03_RELATIONS_OFFLINE_EXPECTED_CALLS = Object.freeze([
  Object.freeze({
    toolName: 'bangumi.get_subject_relations',
    arguments: Object.freeze({ subjectId: 991020, includeEvidence: true }),
  }),
]);
export const R03_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS = Object.freeze(
  R03_RELATIONS_OFFLINE_EXPECTED_CALLS.map((call) => call.arguments),
);

const EXPECTED_RELATION_LABELS = Object.freeze([Object.freeze(['续篇'])]);
const EXPECTED_TARGET_IDS = Object.freeze([Object.freeze([991021])]);
export const R03_RELATIONS_OFFLINE_EXPECTED_RESULT_SUMMARIES = Object.freeze([
  Object.freeze({
    state: 'observed',
    sourceDirection: 'source_subject_to_returned_target',
    responseRowsObserved: 1,
    rowsReturned: 1,
    schemaDriftRows: 0,
    truncated: false,
    paginationAvailable: false,
    totalCountAvailable: false,
    completeness: 'not_provided_by_source',
    relationLabels: Object.freeze(['续篇']),
  }),
]);

export const R03_TWO_HOP_RATING_OFFLINE_PROFILE_ID =
  'r03-two-hop-rating-analysis-offline-agent-mcp-v1';
export const R03_TWO_HOP_RATING_OFFLINE_EPOCH_ID =
  'run95-r03-two-hop-rating-agent-mcp-offline-20261023';
export const R03_TWO_HOP_RATING_OFFLINE_NETWORK_MODE =
  'run95-r03-two-hop-rating-analysis-offline-matrix-v1';
export const R03_TWO_HOP_RATING_OFFLINE_ARGUMENT_PROFILE =
  'fixed-r03-two-hop-rating-analysis-993811-v1';
export const R03_TWO_HOP_RATING_OFFLINE_ACKNOWLEDGEMENT =
  'R03_SYNTHETIC_TWO_HOP_RATING_ANALYSIS_READ';
export const R03_TWO_HOP_RATING_OFFLINE_SERVER_ID = 'bgk_r03_two_hop_rating_v1';
export const R03_TWO_HOP_RATING_OFFLINE_EXPECTED_CALLS = Object.freeze([
  Object.freeze({
    toolName: 'bangumi.get_subject_relations',
    arguments: Object.freeze({ subjectId: 993811, analysisMode: 'observed_two_hop_rating' }),
  }),
]);
export const R03_TWO_HOP_RATING_OFFLINE_EXPECTED_RESULT_SUMMARIES = Object.freeze([
  Object.freeze({
    state: 'observed',
    subjectId: 993811,
    sourceDirection: 'outgoing_source_to_target',
    sourceScope: 'highest_observed_rating_in_bounded_two_hop_sample',
    operationCount: 4,
    warningCount: 0,
    analysisMode: 'observed_two_hop_rating',
    maxDepth: 2,
    topScore: 9.2,
    topCandidateCount: 1,
    topCandidatesOmitted: 0,
    scoredCandidateCount: 2,
    tiePolicy: 'exact_numeric_score_ties_are_preserved',
    topCandidates: Object.freeze([
      Object.freeze({
        id: 993813,
        score: 9.2,
        ratingTotal: 37,
        paths: Object.freeze([
          Object.freeze({
            subjectIds: Object.freeze([993811, 993812, 993813]),
            depth: 2,
            relationLabels: Object.freeze(['续集', '续集']),
          }),
        ]),
      }),
    ]),
    coverage: Object.freeze({
      rootRelationRowsObserved: 1,
      rootRelationRowsSelected: 1,
      rootRelationRowsOmitted: 0,
      rootRelationSchemaDriftRows: 0,
      intermediateSubjectsObserved: 1,
      intermediateSubjectsSelected: 1,
      intermediateSubjectsOmitted: 0,
      intermediateRelationRowsObserved: 1,
      intermediateRelationRowsSelected: 1,
      intermediateRelationRowsOmitted: 0,
      intermediateRelationSchemaDriftRows: 0,
      depth1CandidatesObserved: 1,
      depth1CandidatesSelected: 1,
      depth1CandidatesOmitted: 0,
      depth2CandidatesObserved: 1,
      depth2CandidatesSelected: 1,
      depth2CandidatesOmitted: 0,
      detailRequestsAttempted: 2,
      detailRequestsSucceeded: 2,
      detailRequestsFailed: 0,
      usableRatings: 2,
      missingRatings: 0,
      duplicateRelationRows: 0,
      cycleEdgesSkipped: 0,
      pathEvidenceOmitted: 0,
      truncated: false,
      partialReasons: Object.freeze([]),
      requestBudget: Object.freeze({
        maxResponseBytesPerRequest: 1_048_576,
        logicalRequestsAttempted: 4,
        maxLogicalRequests: 11,
        maxAttemptsPerLogicalRequest: 3,
        maximumPossibleWireAttempts: 33,
      }),
    }),
  }),
]);

const PROFILE_SPECS = new Map([
  [
    R03_RELATIONS_OFFLINE_PROFILE_ID,
    Object.freeze({
      id: R03_RELATIONS_OFFLINE_PROFILE_ID,
      epochId: R03_RELATIONS_OFFLINE_EPOCH_ID,
      networkMode: R03_RELATIONS_OFFLINE_NETWORK_MODE,
      argumentProfile: R03_RELATIONS_OFFLINE_ARGUMENT_PROFILE,
      expectedCalls: R03_RELATIONS_OFFLINE_EXPECTED_CALLS,
      expectedResultSummaries: R03_RELATIONS_OFFLINE_EXPECTED_RESULT_SUMMARIES,
      acknowledgement: R03_RELATIONS_OFFLINE_ACKNOWLEDGEMENT,
      serverId: 'bgk_r03_relations_v2',
      reportPath: 'docs/live-probes/r03-direct-relations-agent-mcp-matrix-v2-run95.json',
      selectionEvidencePath:
        'docs/research/run95-r03-direct-relations-offline-agent-mcp-matrix-v2-2026-10-17.md',
      evidenceKind: 'codex_cli_r03_direct_relations_offline_agent_mcp_matrix_v2',
      answerCheckMethod: 'r03-synthetic-direct-relations-execution-only-v2',
    }),
  ],
  [
    R03_TWO_HOP_RATING_OFFLINE_PROFILE_ID,
    Object.freeze({
      id: R03_TWO_HOP_RATING_OFFLINE_PROFILE_ID,
      epochId: R03_TWO_HOP_RATING_OFFLINE_EPOCH_ID,
      networkMode: R03_TWO_HOP_RATING_OFFLINE_NETWORK_MODE,
      argumentProfile: R03_TWO_HOP_RATING_OFFLINE_ARGUMENT_PROFILE,
      expectedCalls: R03_TWO_HOP_RATING_OFFLINE_EXPECTED_CALLS,
      expectedResultSummaries: R03_TWO_HOP_RATING_OFFLINE_EXPECTED_RESULT_SUMMARIES,
      acknowledgement: R03_TWO_HOP_RATING_OFFLINE_ACKNOWLEDGEMENT,
      serverId: R03_TWO_HOP_RATING_OFFLINE_SERVER_ID,
      reportPath: 'docs/live-probes/r03-two-hop-rating-analysis-agent-mcp-matrix-v1-run95.json',
      selectionEvidencePath:
        'docs/research/run95-r03-two-hop-rating-agent-mcp-offline-matrix-v1-2026-10-23.md',
      evidenceKind: 'codex_cli_r03_two_hop_rating_analysis_offline_agent_mcp_matrix_v1',
      answerCheckMethod: 'r03-synthetic-two-hop-rating-analysis-execution-only-v1',
    }),
  ],
]);

export const R03_RELATIONS_OFFLINE_PROFILE_IDS = Object.freeze([...PROFILE_SPECS.keys()]);

export function getR03RelationsOfflineProfileSpec(profileOrId) {
  const profileId = typeof profileOrId === 'string' ? profileOrId : profileOrId?.id;
  return PROFILE_SPECS.get(profileId) ?? null;
}

export function isR03RelationsOfflineNetworkMode(networkMode) {
  return [...PROFILE_SPECS.values()].some((spec) => spec.networkMode === networkMode);
}

export function summarizeR03RelationsOfflineToolResult(
  result,
  expectedArguments,
  profileId = R03_RELATIONS_OFFLINE_PROFILE_ID,
) {
  const spec = getR03RelationsOfflineProfileSpec(profileId);
  if (!spec) return null;
  const sequenceIndex = spec.expectedCalls.findIndex(
    (call) =>
      canonicalAgentMcpProfileJson(call.arguments) ===
      canonicalAgentMcpProfileJson(expectedArguments),
  );
  const expectedCall = spec.expectedCalls[sequenceIndex];
  if (profileId === R03_TWO_HOP_RATING_OFFLINE_PROFILE_ID) {
    const expected = spec.expectedResultSummaries[sequenceIndex];
    const candidate = result?.ratingAnalysis?.topCandidates?.[0];
    const path = candidate?.paths?.[0];
    const coverage = result?.coverage;
    const requestBudget = coverage?.requestBudget;
    const expectedOperations = [
      {
        operation: 'GET /v0/subjects/{subject_id}/subjects',
        path: '/v0/subjects/993811/subjects',
        subjectId: 993811,
        depth: 0,
        status: 'succeeded',
        responseRowsObserved: 1,
        rowsReturned: 1,
        schemaDriftRows: 0,
      },
      {
        operation: 'GET /v0/subjects/{subject_id}/subjects',
        path: '/v0/subjects/993812/subjects',
        subjectId: 993812,
        depth: 1,
        status: 'succeeded',
        responseRowsObserved: 1,
        rowsReturned: 1,
        schemaDriftRows: 0,
      },
      {
        operation: 'GET /v0/subjects/{subject_id}',
        path: '/v0/subjects/993812',
        subjectId: 993812,
        depth: 1,
        status: 'succeeded',
      },
      {
        operation: 'GET /v0/subjects/{subject_id}',
        path: '/v0/subjects/993813',
        subjectId: 993813,
        depth: 2,
        status: 'succeeded',
      },
    ];
    if (
      !expectedCall ||
      canonicalAgentMcpProfileJson(expectedCall.arguments) !==
        canonicalAgentMcpProfileJson(expectedArguments) ||
      result?.state !== expected.state ||
      result?.subjectId !== expected.subjectId ||
      result?.source?.api !== 'Bangumi official v0' ||
      result?.source?.direction !== expected.sourceDirection ||
      result?.source?.scope !== expected.sourceScope ||
      !Array.isArray(result?.source?.operations) ||
      result.source.operations.length !== expectedOperations.length ||
      result.source.operations.some((operation, index) =>
        Object.entries(expectedOperations[index]).some(([key, value]) => operation?.[key] !== value),
      ) ||
      !Array.isArray(result?.warnings) ||
      result.warnings.length !== expected.warningCount ||
      result?.ratingAnalysis?.mode !== expected.analysisMode ||
      result?.ratingAnalysis?.maxDepth !== expected.maxDepth ||
      result?.ratingAnalysis?.topScore !== expected.topScore ||
      result?.ratingAnalysis?.topCandidateCount !== expected.topCandidateCount ||
      result?.ratingAnalysis?.topCandidatesOmitted !== expected.topCandidatesOmitted ||
      result?.ratingAnalysis?.scoredCandidateCount !== expected.scoredCandidateCount ||
      result?.ratingAnalysis?.tiePolicy !== expected.tiePolicy ||
      result?.ratingAnalysis?.topCandidates?.length !== expected.topCandidates.length ||
      candidate?.id !== expected.topCandidates[0].id ||
      candidate?.score !== expected.topCandidates[0].score ||
      candidate?.ratingTotal !== expected.topCandidates[0].ratingTotal ||
      path?.sourceId !== 993811 ||
      path?.targetId !== 993813 ||
      path?.depth !== expected.topCandidates[0].paths[0].depth ||
      canonicalAgentMcpProfileJson(path?.subjectIds) !==
        canonicalAgentMcpProfileJson(expected.topCandidates[0].paths[0].subjectIds) ||
      canonicalAgentMcpProfileJson(path?.relationLabels) !==
        canonicalAgentMcpProfileJson(expected.topCandidates[0].paths[0].relationLabels) ||
      coverage?.rootRelationRowsObserved !== 1 ||
      coverage?.rootRelationRowsSelected !== 1 ||
      coverage?.rootRelationRowsOmitted !== 0 ||
      coverage?.rootRelationSchemaDriftRows !== 0 ||
      coverage?.intermediateSubjectsObserved !== 1 ||
      coverage?.intermediateSubjectsSelected !== 1 ||
      coverage?.intermediateSubjectsOmitted !== 0 ||
      coverage?.intermediateRelationRowsObserved !== 1 ||
      coverage?.intermediateRelationRowsSelected !== 1 ||
      coverage?.intermediateRelationRowsOmitted !== 0 ||
      coverage?.intermediateRelationSchemaDriftRows !== 0 ||
      coverage?.depth1CandidatesObserved !== 1 ||
      coverage?.depth1CandidatesSelected !== 1 ||
      coverage?.depth1CandidatesOmitted !== 0 ||
      coverage?.depth2CandidatesObserved !== 1 ||
      coverage?.depth2CandidatesSelected !== 1 ||
      coverage?.depth2CandidatesOmitted !== 0 ||
      coverage?.detailRequestsAttempted !== 2 ||
      coverage?.detailRequestsSucceeded !== 2 ||
      coverage?.detailRequestsFailed !== 0 ||
      coverage?.usableRatings !== 2 ||
      coverage?.missingRatings !== 0 ||
      coverage?.duplicateRelationRows !== 0 ||
      coverage?.cycleEdgesSkipped !== 0 ||
      coverage?.pathEvidenceOmitted !== 0 ||
      coverage?.truncated !== false ||
      canonicalAgentMcpProfileJson(coverage?.partialReasons) !== '[]' ||
      requestBudget?.logicalRequestsAttempted !== 4 ||
      requestBudget?.maxResponseBytesPerRequest !== 1_048_576 ||
      requestBudget?.maxLogicalRequests !== 11 ||
      requestBudget?.maxAttemptsPerLogicalRequest !== 3 ||
      requestBudget?.maximumPossibleWireAttempts !== 33
    ) {
      return null;
    }
    return expected;
  }
  const expectedLabels = EXPECTED_RELATION_LABELS[sequenceIndex];
  const expectedTargetIds = EXPECTED_TARGET_IDS[sequenceIndex];
  if (
    !expectedCall ||
    canonicalAgentMcpProfileJson(expectedArguments) !==
      canonicalAgentMcpProfileJson(expectedCall.arguments) ||
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    result.subjectId !== expectedCall.arguments.subjectId ||
    result.state !== 'observed' ||
    result.source?.direction !== 'source_subject_to_returned_target' ||
    result.coverage?.completeness !== 'not_provided_by_source' ||
    result.coverage?.paginationAvailable !== false ||
    result.coverage?.totalCountAvailable !== false ||
    result.coverage?.truncated !== false ||
    !Array.isArray(result.items) ||
    result.items.length !== expectedLabels.length ||
    canonicalAgentMcpProfileJson(result.items.map((item) => item?.id)) !==
      canonicalAgentMcpProfileJson(expectedTargetIds) ||
    result.coverage.responseRowsObserved !== expectedLabels.length ||
    result.coverage.rowsReturned !== expectedLabels.length ||
    result.coverage.schemaDriftRows !== 0
  ) {
    return null;
  }
  const relationLabels = result.items.map((item) => item?.relation);
  if (
    relationLabels.some((label) => typeof label !== 'string') ||
    canonicalAgentMcpProfileJson(relationLabels) !== canonicalAgentMcpProfileJson(expectedLabels)
  ) {
    return null;
  }
  return {
    state: 'observed',
    sourceDirection: 'source_subject_to_returned_target',
    responseRowsObserved: expectedLabels.length,
    rowsReturned: expectedLabels.length,
    schemaDriftRows: 0,
    truncated: false,
    paginationAvailable: false,
    totalCountAvailable: false,
    completeness: 'not_provided_by_source',
    relationLabels,
  };
}

export function assertR03RelationsOfflineProfile(profile) {
  const spec = getR03RelationsOfflineProfileSpec(profile);
  if (!spec) return false;
  const registered = getAgentMcpProfileById(spec.id);
  if (!registered) {
    throw new Error('R03 offline relations mode requires its exact registered profile.');
  }
  if (
    profile.networkMode !== spec.networkMode ||
    profile.frontierId !== 'R03' ||
    profile.epochId !== spec.epochId ||
    profile.toolName !== 'bangumi.get_subject_relations' ||
    profile.argumentProfile !== spec.argumentProfile ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.reportPath !== spec.reportPath ||
    profile.selectionEvidencePath !== spec.selectionEvidencePath ||
    profile.evidenceKind !== spec.evidenceKind ||
    profile.answerCheckMethod !== spec.answerCheckMethod ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.calls?.length !== spec.expectedCalls.length ||
    profile.calls.some(
      (call, index) =>
        call?.toolName !== spec.expectedCalls[index].toolName ||
        canonicalAgentMcpProfileJson(call?.arguments) !==
          canonicalAgentMcpProfileJson(spec.expectedCalls[index].arguments),
    ) ||
    agentMcpProfileArgumentsSha256(profile) !== agentMcpProfileArgumentsSha256(registered)
  ) {
    throw new Error('R03 offline relations mode does not match its immutable v2 profile.');
  }
  return true;
}
