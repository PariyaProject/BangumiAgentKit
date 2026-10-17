import {
  agentMcpProfileArgumentsSha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';

export const R03_RELATIONS_OFFLINE_PROFILE_ID = 'r03-two-hop-relations-offline-agent-mcp-v1';
export const R03_RELATIONS_OFFLINE_EPOCH_ID =
  'run95-r03-two-hop-relations-offline-agent-mcp-20261017';
export const R03_RELATIONS_OFFLINE_NETWORK_MODE = 'run95-r03-two-hop-relations-offline-v1';
export const R03_RELATIONS_OFFLINE_ARGUMENT_PROFILE =
  'fixed-r03-synthetic-two-hop-relations-990910-990911-v1';
export const R03_RELATIONS_OFFLINE_ACKNOWLEDGEMENT = 'R03_SYNTHETIC_TWO_HOP_RELATIONS_READ';
export const R03_RELATIONS_OFFLINE_EXPECTED_CALLS = Object.freeze([
  Object.freeze({
    toolName: 'bangumi.get_subject_relations',
    arguments: Object.freeze({ subjectId: 990910, includeEvidence: true }),
  }),
  Object.freeze({
    toolName: 'bangumi.get_subject_relations',
    arguments: Object.freeze({ subjectId: 990911, includeEvidence: true }),
  }),
]);
export const R03_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS = Object.freeze(
  R03_RELATIONS_OFFLINE_EXPECTED_CALLS.map((call) => call.arguments),
);

const EXPECTED_RELATION_LABELS = Object.freeze([
  Object.freeze(['续篇']),
  Object.freeze(['前传', '外传']),
]);
const EXPECTED_TARGET_IDS = Object.freeze([
  Object.freeze([990911]),
  Object.freeze([990912, 990913]),
]);
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
  Object.freeze({
    state: 'observed',
    sourceDirection: 'source_subject_to_returned_target',
    responseRowsObserved: 2,
    rowsReturned: 2,
    schemaDriftRows: 0,
    truncated: false,
    paginationAvailable: false,
    totalCountAvailable: false,
    completeness: 'not_provided_by_source',
    relationLabels: Object.freeze(['前传', '外传']),
  }),
]);

export function summarizeR03RelationsOfflineToolResult(result, expectedArguments) {
  const sequenceIndex = R03_RELATIONS_OFFLINE_EXPECTED_CALLS.findIndex(
    (call) =>
      canonicalAgentMcpProfileJson(call.arguments) ===
      canonicalAgentMcpProfileJson(expectedArguments),
  );
  const expectedCall = R03_RELATIONS_OFFLINE_EXPECTED_CALLS[sequenceIndex];
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
  if (profile?.id !== R03_RELATIONS_OFFLINE_PROFILE_ID) return false;
  const registered = getAgentMcpProfileById(R03_RELATIONS_OFFLINE_PROFILE_ID);
  if (!registered) {
    throw new Error('R03 offline relations mode requires its registered profile.');
  }
  if (
    profile.networkMode !== R03_RELATIONS_OFFLINE_NETWORK_MODE ||
    profile.frontierId !== 'R03' ||
    profile.epochId !== R03_RELATIONS_OFFLINE_EPOCH_ID ||
    profile.toolName !== 'bangumi.get_subject_relations' ||
    profile.argumentProfile !== R03_RELATIONS_OFFLINE_ARGUMENT_PROFILE ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.reportPath !== 'docs/live-probes/r03-two-hop-relations-agent-mcp-run95.json' ||
    profile.selectionEvidencePath !==
      'docs/research/run95-r03-relations-agent-mcp-offline-matrix-2026-10-17.md' ||
    profile.evidenceKind !== 'codex_cli_r03_relations_offline_agent_mcp_matrix' ||
    profile.answerCheckMethod !== 'r03-synthetic-two-hop-relations-execution-only-v1' ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.calls?.length !== R03_RELATIONS_OFFLINE_EXPECTED_CALLS.length ||
    profile.calls.some(
      (call, index) =>
        call?.toolName !== R03_RELATIONS_OFFLINE_EXPECTED_CALLS[index].toolName ||
        canonicalAgentMcpProfileJson(call?.arguments) !==
          canonicalAgentMcpProfileJson(R03_RELATIONS_OFFLINE_EXPECTED_CALLS[index].arguments),
    ) ||
    agentMcpProfileArgumentsSha256(profile) !== agentMcpProfileArgumentsSha256(registered)
  ) {
    throw new Error('R03 offline relations mode does not match its immutable profile.');
  }
  return true;
}
