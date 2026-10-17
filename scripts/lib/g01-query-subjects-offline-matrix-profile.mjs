import {
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';

export const G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID =
  'g01-query-subjects-offline-agent-mcp-matrix-v1';
export const G01_QUERY_SUBJECTS_OFFLINE_EPOCH_ID =
  'run95-g01-query-subjects-offline-agent-mcp-matrix-20261017';
export const G01_QUERY_SUBJECTS_OFFLINE_ARGUMENT_PROFILE =
  'fixed-g01-synthetic-query-subjects-one-result-v1';
export const G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE =
  'run95-g01-query-subjects-synthetic-offline-v1';
export const G01_QUERY_SUBJECTS_OFFLINE_REPORT_PATH =
  'docs/live-probes/g01-query-subjects-offline-agent-mcp-run95.json';
export const G01_QUERY_SUBJECTS_OFFLINE_SELECTION_EVIDENCE_PATH =
  'docs/research/run95-g01-query-subjects-offline-agent-mcp-contract-2026-10-17.md';
export const G01_QUERY_SUBJECTS_OFFLINE_CLAIM_LABEL_NAME =
  'harness-r95-g01-query-subjects-offline-claimed';
export const G01_QUERY_SUBJECTS_OFFLINE_EVIDENCE_KIND =
  'codex_cli_g01_query_subjects_offline_agent_mcp';
export const G01_QUERY_SUBJECTS_OFFLINE_ANSWER_CHECK_METHOD =
  'g01-exact-synthetic-query-subjects-execution-only-v1';
export const G01_QUERY_SUBJECTS_OFFLINE_ACKNOWLEDGEMENT = 'G01_QUERY_SUBJECTS_SYNTHETIC_OFFLINE_OK';
export const G01_QUERY_SUBJECTS_OFFLINE_SERVER_ID = 'bgk_g01_query_subjects_offline';
export const G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_KEYWORD =
  'run95 synthetic query subjects matrix offline 20261017';
export const G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_SUBJECT_ID = 990930;

export const G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS = Object.freeze({
  keyword: G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_KEYWORD,
  media: 'anime',
  resultMode: 'top',
  limit: 1,
  sort: 'relevance',
  explain: 'none',
  nsfw: false,
});

export function assertG01QuerySubjectsOfflineProfile(profile) {
  if (profile?.id !== G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID) return false;
  const registered = getAgentMcpProfileById(G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID);
  if (
    !registered ||
    canonicalAgentMcpProfileJson(profile) !== canonicalAgentMcpProfileJson(registered)
  ) {
    throw new Error('G01 query-subjects offline mode requires its exact registered profile.');
  }
  if (
    profile.frontierId !== 'G01' ||
    profile.epochId !== G01_QUERY_SUBJECTS_OFFLINE_EPOCH_ID ||
    profile.toolName !== 'bangumi.query_subjects' ||
    profile.argumentProfile !== G01_QUERY_SUBJECTS_OFFLINE_ARGUMENT_PROFILE ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.networkMode !== G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE ||
    profile.reportPath !== G01_QUERY_SUBJECTS_OFFLINE_REPORT_PATH ||
    profile.selectionEvidencePath !== G01_QUERY_SUBJECTS_OFFLINE_SELECTION_EVIDENCE_PATH ||
    profile.claimLabelName !== G01_QUERY_SUBJECTS_OFFLINE_CLAIM_LABEL_NAME ||
    profile.evidenceKind !== G01_QUERY_SUBJECTS_OFFLINE_EVIDENCE_KIND ||
    profile.answerCheckMethod !== G01_QUERY_SUBJECTS_OFFLINE_ANSWER_CHECK_METHOD ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.maxAnswerBytes !== 256 ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== profile.toolName ||
    canonicalAgentMcpProfileJson(profile.calls[0]?.arguments) !==
      canonicalAgentMcpProfileJson(G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS)
  ) {
    throw new Error('G01 query-subjects offline profile does not match its fixed contract.');
  }
  return true;
}

export function summarizeG01QuerySubjectsOfflineToolResult(result) {
  const items = Array.isArray(result?.items) ? result.items : [];
  const coverage = result?.coverage;
  const count = (value) =>
    Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;
  return {
    resultState: result?.state === 'ok' ? 'ok' : 'unexpected',
    returnedItems: Math.min(items.length, 2),
    coverageState: ['complete', 'partial', 'unavailable', 'not_computable', 'unknown'].includes(
      coverage?.state,
    )
      ? coverage.state
      : 'unknown',
    requested: count(coverage?.requested),
    returned: count(coverage?.returned),
    pagesScanned: count(coverage?.pagesScanned),
    totalKind: ['exact', 'estimated', 'unknown', 'unavailable'].includes(coverage?.totalKind)
      ? coverage.totalKind
      : 'unknown',
    warningCount: Array.isArray(result?.warnings) ? Math.min(result.warnings.length, 8) : null,
  };
}
