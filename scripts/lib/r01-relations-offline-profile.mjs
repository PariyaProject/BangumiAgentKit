import {
  agentMcpProfileArgumentsSha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';

export const R01_RELATIONS_OFFLINE_PROFILE_ID = 'r01-subject-relations-offline-agent-mcp-v1';
export const R01_RELATIONS_OFFLINE_NETWORK_MODE = 'run95-r01-relations-offline-v1';
export const R01_RELATIONS_OFFLINE_ARGUMENT_PROFILE =
  'fixed-r01-offline-relations-990902-one-row-v1';
export const R01_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS = Object.freeze({
  subjectId: 990902,
  includeEvidence: true,
});
export const R01_RELATIONS_OFFLINE_SYNTHETIC_ID =
  R01_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS.subjectId;
export const R01_RELATIONS_OFFLINE_ACKNOWLEDGEMENT = 'R01_SYNTHETIC_SUBJECT_RELATIONS_READ';

export function summarizeR01RelationsOfflineToolResult(result, expectedArguments) {
  if (
    canonicalAgentMcpProfileJson(expectedArguments) !==
      canonicalAgentMcpProfileJson(R01_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS) ||
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    result.subjectId !== R01_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS.subjectId ||
    result.state !== 'observed' ||
    result.source?.direction !== 'source_subject_to_returned_target' ||
    result.coverage?.completeness !== 'not_provided_by_source' ||
    result.coverage?.paginationAvailable !== false ||
    result.coverage?.totalCountAvailable !== false ||
    result.coverage?.truncated !== false ||
    !Array.isArray(result.items) ||
    result.items.length !== 1 ||
    result.coverage.responseRowsObserved !== 1 ||
    result.coverage.rowsReturned !== 1 ||
    result.coverage.schemaDriftRows !== 0
  ) {
    return null;
  }
  const relation = result.items[0]?.relation;
  if (typeof relation !== 'string' || relation !== '改编') return null;
  return {
    state: 'observed',
    sourceDirection: 'source_subject_to_returned_target',
    responseRowsObserved: 1,
    rowsReturned: 1,
    schemaDriftRows: 0,
    truncated: false,
    paginationAvailable: false,
    totalCountAvailable: false,
    completeness: 'not_provided_by_source',
    relationLabels: ['改编'],
  };
}

export function assertR01RelationsOfflineProfile(profile) {
  if (profile?.id !== R01_RELATIONS_OFFLINE_PROFILE_ID) return false;
  const registered = getAgentMcpProfileById(R01_RELATIONS_OFFLINE_PROFILE_ID);
  if (!registered) {
    throw new Error('R01 offline relation mode requires its registered profile.');
  }
  if (
    profile.networkMode !== R01_RELATIONS_OFFLINE_NETWORK_MODE ||
    profile.frontierId !== 'R01' ||
    profile.epochId !== 'run95-r01-subject-relations-matrix-offline-20261016' ||
    profile.toolName !== 'bangumi.get_subject_relations' ||
    profile.argumentProfile !== R01_RELATIONS_OFFLINE_ARGUMENT_PROFILE ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== profile.toolName ||
    canonicalAgentMcpProfileJson(profile.calls[0]?.arguments) !==
      canonicalAgentMcpProfileJson(R01_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS) ||
    agentMcpProfileArgumentsSha256(profile) !== agentMcpProfileArgumentsSha256(registered)
  ) {
    throw new Error('R01 offline relation mode does not match its immutable profile.');
  }
  return true;
}
