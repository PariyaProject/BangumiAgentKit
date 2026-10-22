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
export const G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID =
  'g01-query-subjects-offline-agent-mcp-matrix-v2';
export const G01_QUERY_SUBJECTS_OFFLINE_V2_EPOCH_ID =
  'run95-g01-query-subjects-offline-agent-mcp-matrix-v2-20261022';
export const G01_QUERY_SUBJECTS_OFFLINE_V2_ARGUMENT_PROFILE =
  'fixed-g01-synthetic-query-subjects-one-result-v2';
export const G01_QUERY_SUBJECTS_OFFLINE_V2_NETWORK_MODE =
  'run95-g01-query-subjects-synthetic-offline-v2';
export const G01_QUERY_SUBJECTS_OFFLINE_V2_REPORT_PATH =
  'docs/live-probes/g01-query-subjects-offline-agent-mcp-v2-run95.json';
export const G01_QUERY_SUBJECTS_OFFLINE_V2_SELECTION_EVIDENCE_PATH =
  'docs/research/run95-g01-query-subjects-offline-matrix-v2-contract-2026-10-22.md';
export const G01_QUERY_SUBJECTS_OFFLINE_V2_CLAIM_LABEL_NAME =
  'harness-r95-g01-qsub-offline-v2-claimed';
export const G01_QUERY_SUBJECTS_OFFLINE_V2_EVIDENCE_KIND =
  'codex_cli_g01_query_subjects_offline_agent_mcp_v2';
export const G01_QUERY_SUBJECTS_OFFLINE_V2_ANSWER_CHECK_METHOD =
  'g01-exact-synthetic-query-subjects-execution-only-v2';
export const G01_QUERY_SUBJECTS_OFFLINE_V2_ACKNOWLEDGEMENT =
  'G01_QUERY_SUBJECTS_SYNTHETIC_OFFLINE_V2_OK';
export const G01_QUERY_SUBJECTS_OFFLINE_V2_SERVER_ID = 'bgk_g01_query_subjects_offline_v2';
export const G01_QUERY_SUBJECTS_OFFLINE_V2_SYNTHETIC_KEYWORD =
  'run95 synthetic query subjects matrix offline 20261022 v2';
export const G01_QUERY_SUBJECTS_OFFLINE_V2_SYNTHETIC_SUBJECT_ID = 990931;

export const G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS = Object.freeze({
  keyword: G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_KEYWORD,
  media: 'anime',
  resultMode: 'top',
  limit: 1,
  sort: 'relevance',
  explain: 'none',
  nsfw: false,
});

export const G01_QUERY_SUBJECTS_OFFLINE_V2_EXPECTED_ARGUMENTS = Object.freeze({
  keyword: G01_QUERY_SUBJECTS_OFFLINE_V2_SYNTHETIC_KEYWORD,
  media: 'anime',
  resultMode: 'top',
  limit: 1,
  sort: 'relevance',
  explain: 'none',
  nsfw: false,
});

function assertProfile(profile, spec) {
  if (profile?.id !== spec.profileId) return false;
  const registered = getAgentMcpProfileById(spec.profileId);
  if (
    !registered ||
    canonicalAgentMcpProfileJson(profile) !== canonicalAgentMcpProfileJson(registered)
  ) {
    throw new Error('G01 query-subjects offline mode requires its exact registered profile.');
  }
  if (
    profile.frontierId !== 'G01' ||
    profile.epochId !== spec.epochId ||
    profile.toolName !== 'bangumi.query_subjects' ||
    profile.argumentProfile !== spec.argumentProfile ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.networkMode !== spec.networkMode ||
    profile.reportPath !== spec.reportPath ||
    profile.selectionEvidencePath !== spec.selectionEvidencePath ||
    profile.claimLabelName !== spec.claimLabelName ||
    profile.evidenceKind !== spec.evidenceKind ||
    profile.answerCheckMethod !== spec.answerCheckMethod ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.maxAnswerBytes !== 256 ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== profile.toolName ||
    canonicalAgentMcpProfileJson(profile.calls[0]?.arguments) !==
      canonicalAgentMcpProfileJson(spec.expectedArguments)
  ) {
    throw new Error('G01 query-subjects offline profile does not match its fixed contract.');
  }
  return true;
}

const V1_PROFILE_SPEC = Object.freeze({
  profileId: G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID,
  epochId: G01_QUERY_SUBJECTS_OFFLINE_EPOCH_ID,
  argumentProfile: G01_QUERY_SUBJECTS_OFFLINE_ARGUMENT_PROFILE,
  networkMode: G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
  reportPath: G01_QUERY_SUBJECTS_OFFLINE_REPORT_PATH,
  selectionEvidencePath: G01_QUERY_SUBJECTS_OFFLINE_SELECTION_EVIDENCE_PATH,
  claimLabelName: G01_QUERY_SUBJECTS_OFFLINE_CLAIM_LABEL_NAME,
  evidenceKind: G01_QUERY_SUBJECTS_OFFLINE_EVIDENCE_KIND,
  answerCheckMethod: G01_QUERY_SUBJECTS_OFFLINE_ANSWER_CHECK_METHOD,
  acknowledgement: G01_QUERY_SUBJECTS_OFFLINE_ACKNOWLEDGEMENT,
  serverId: G01_QUERY_SUBJECTS_OFFLINE_SERVER_ID,
  syntheticKeyword: G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_KEYWORD,
  syntheticSubjectId: G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_SUBJECT_ID,
  expectedArguments: G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS,
});

export const G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_SPEC = Object.freeze({
  profileId: G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID,
  epochId: G01_QUERY_SUBJECTS_OFFLINE_V2_EPOCH_ID,
  argumentProfile: G01_QUERY_SUBJECTS_OFFLINE_V2_ARGUMENT_PROFILE,
  networkMode: G01_QUERY_SUBJECTS_OFFLINE_V2_NETWORK_MODE,
  reportPath: G01_QUERY_SUBJECTS_OFFLINE_V2_REPORT_PATH,
  selectionEvidencePath: G01_QUERY_SUBJECTS_OFFLINE_V2_SELECTION_EVIDENCE_PATH,
  claimLabelName: G01_QUERY_SUBJECTS_OFFLINE_V2_CLAIM_LABEL_NAME,
  evidenceKind: G01_QUERY_SUBJECTS_OFFLINE_V2_EVIDENCE_KIND,
  answerCheckMethod: G01_QUERY_SUBJECTS_OFFLINE_V2_ANSWER_CHECK_METHOD,
  acknowledgement: G01_QUERY_SUBJECTS_OFFLINE_V2_ACKNOWLEDGEMENT,
  serverId: G01_QUERY_SUBJECTS_OFFLINE_V2_SERVER_ID,
  syntheticKeyword: G01_QUERY_SUBJECTS_OFFLINE_V2_SYNTHETIC_KEYWORD,
  syntheticSubjectId: G01_QUERY_SUBJECTS_OFFLINE_V2_SYNTHETIC_SUBJECT_ID,
  expectedArguments: G01_QUERY_SUBJECTS_OFFLINE_V2_EXPECTED_ARGUMENTS,
});

export function getG01QuerySubjectsOfflineProfileSpec(profileId) {
  if (profileId === G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID) return V1_PROFILE_SPEC;
  if (profileId === G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID) {
    return G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_SPEC;
  }
  return null;
}

export function assertG01QuerySubjectsOfflineProfile(profile) {
  return assertProfile(profile, V1_PROFILE_SPEC);
}

export function assertG01QuerySubjectsOfflineV2Profile(profile) {
  return assertProfile(profile, G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_SPEC);
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
