import {
  agentMcpProfileArgumentsSha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';

export const R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID =
  'r01-subject-relations-text-projection-agent-mcp-v2';
export const R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EPOCH_ID =
  'run95-r01-relations-text-projection-offline-matrix-v2-20261023';
export const R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE =
  'run95-r01-relations-text-projection-offline-v2';
export const R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ARGUMENT_PROFILE =
  'fixed-r01-synthetic-relations-991408-30-row-mcp-text-projection-v2';
export const R01_RELATIONS_TEXT_PROJECTION_OFFLINE_SUBJECT_ID = 991408;
export const R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT = 30;
export const R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ACKNOWLEDGEMENT =
  'R01_SYNTHETIC_RELATION_TEXT_PROJECTION_READ';
export const R01_RELATIONS_TEXT_PROJECTION_TOOL_NAME = 'bangumi.get_subject_relations';

export const R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS = Object.freeze({
  subjectId: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_SUBJECT_ID,
  includeEvidence: true,
});

export function r01RelationsTextProjectionSyntheticRows() {
  return Array.from({ length: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT }, (_, index) => {
    const ordinal = String(index + 1).padStart(2, '0');
    return {
      id: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_SUBJECT_ID + index + 1,
      type: 2,
      name: `Synthetic R01 relation target ${ordinal}`,
      name_cn: `合成关系目标${ordinal}`,
      relation: index === 0 ? '改编' : '相关作品',
    };
  });
}

export function summarizeR01RelationsTextProjectionToolResult(result, expectedArguments) {
  const expectedRows = r01RelationsTextProjectionSyntheticRows().map(
    ({ id, name, name_cn, relation }) => ({
      id,
      type: 'anime',
      name,
      nameCn: name_cn,
      relation,
    }),
  );
  if (
    canonicalAgentMcpProfileJson(expectedArguments) !==
      canonicalAgentMcpProfileJson(R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS) ||
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    result.subjectId !== R01_RELATIONS_TEXT_PROJECTION_OFFLINE_SUBJECT_ID ||
    result.state !== 'observed' ||
    result.source?.operation !== 'GET /v0/subjects/{subject_id}/subjects' ||
    result.source?.direction !== 'source_subject_to_returned_target' ||
    result.source?.scope !== 'visible_direct_rows_returned_for_source_subject' ||
    result.coverage?.completeness !== 'not_provided_by_source' ||
    result.coverage?.paginationAvailable !== false ||
    result.coverage?.totalCountAvailable !== false ||
    result.coverage?.truncated !== false ||
    result.coverage?.responseRowsObserved !== R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT ||
    result.coverage?.rowsReturned !== R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT ||
    result.coverage?.schemaDriftRows !== 0 ||
    !Array.isArray(result.items) ||
    canonicalAgentMcpProfileJson(result.items) !== canonicalAgentMcpProfileJson(expectedRows)
  ) {
    return null;
  }

  return {
    state: 'observed',
    sourceRowsObserved: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT,
    sourceRowsReturned: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT,
    sourceSchemaDriftRows: 0,
    sourceTruncated: false,
    paginationAvailable: false,
    totalCountAvailable: false,
    completeness: 'not_provided_by_source',
  };
}

export function assertR01RelationsTextProjectionOfflineProfile(profile) {
  if (profile?.id !== R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID) return false;
  const registered = getAgentMcpProfileById(R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID);
  if (!registered) {
    throw new Error('R01 text projection mode requires its registered v2 profile.');
  }
  if (
    profile.frontierId !== 'R01' ||
    profile.epochId !== R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EPOCH_ID ||
    profile.toolName !== R01_RELATIONS_TEXT_PROJECTION_TOOL_NAME ||
    profile.argumentProfile !== R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ARGUMENT_PROFILE ||
    profile.claimLabelName !== 'harness-r95-r01-relations-text-v2-claimed' ||
    profile.reportPath !==
      'docs/live-probes/r01-relations-text-projection-offline-agent-mcp-v2-run95.json' ||
    profile.selectionEvidencePath !==
      'docs/research/run95-r01-relations-text-projection-offline-matrix-v2-contract-2026-10-23.md' ||
    profile.evidenceKind !==
      'codex_cli_r01_relations_text_projection_offline_agent_mcp_matrix_v2' ||
    profile.answerCheckMethod !== 'r01-mcp-text-projection-omission-boundary-v2' ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.networkMode !== R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.maxAnswerBytes !== 1536 ||
    !Array.isArray(profile.calls) ||
    profile.calls.length !== 1 ||
    profile.calls[0]?.toolName !== R01_RELATIONS_TEXT_PROJECTION_TOOL_NAME ||
    canonicalAgentMcpProfileJson(profile.calls[0]?.arguments) !==
      canonicalAgentMcpProfileJson(R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS) ||
    agentMcpProfileArgumentsSha256(profile) !== agentMcpProfileArgumentsSha256(registered)
  ) {
    throw new Error('R01 text projection mode does not match its immutable profile.');
  }
  return true;
}
