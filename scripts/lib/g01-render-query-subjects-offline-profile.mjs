import {
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';

export const G01_RENDER_QUERY_OFFLINE_PROFILE_ID = 'g01-render-query-subjects-offline-agent-mcp-v1';
export const G01_RENDER_QUERY_OFFLINE_EPOCH_ID =
  'run95-g01-render-query-subjects-offline-matrix-20261017';
export const G01_RENDER_QUERY_OFFLINE_NETWORK_MODE =
  'run95-g01-render-query-subjects-synthetic-offline-v1';
export const G01_RENDER_QUERY_OFFLINE_ARGUMENT_PROFILE =
  'fixed-g01-synthetic-render-query-990920-one-result-v1';
export const G01_RENDER_QUERY_OFFLINE_REPORT_PATH =
  'docs/live-probes/g01-render-query-subjects-offline-agent-mcp-run95.json';
export const G01_RENDER_QUERY_OFFLINE_SELECTION_EVIDENCE_PATH =
  'docs/research/run95-g01-render-query-subjects-offline-matrix-contract-2026-10-17.md';
export const G01_RENDER_QUERY_OFFLINE_CLAIM_LABEL_NAME =
  'harness-r95-g01-render-query-offline-claimed';
export const G01_RENDER_QUERY_OFFLINE_EVIDENCE_KIND =
  'codex_cli_g01_render_query_subjects_offline_agent_mcp';
export const G01_RENDER_QUERY_OFFLINE_ANSWER_CHECK_METHOD =
  'g01-exact-synthetic-render-query-execution-only-v1';
export const G01_RENDER_QUERY_OFFLINE_ACKNOWLEDGEMENT = 'G01_RENDER_QUERY_SYNTHETIC_OFFLINE_OK';
export const G01_RENDER_QUERY_OFFLINE_SYNTHETIC_KEYWORD =
  'run95 g01 synthetic render query offline 20261017';
export const G01_RENDER_QUERY_OFFLINE_SYNTHETIC_SUBJECT_ID = 990920;

export const G01_RENDER_QUERY_OFFLINE_EXPECTED_ARGUMENTS = Object.freeze({
  keyword: G01_RENDER_QUERY_OFFLINE_SYNTHETIC_KEYWORD,
  media: 'anime',
  reportedEpisodeCount: { min: 1, max: 1 },
  resultMode: 'top',
  limit: 1,
  sort: 'relevance',
  explain: 'none',
  nsfw: 'include',
});

export function assertG01RenderQueryOfflineProfile(profile) {
  if (profile?.id !== G01_RENDER_QUERY_OFFLINE_PROFILE_ID) return false;
  const registered = getAgentMcpProfileById(G01_RENDER_QUERY_OFFLINE_PROFILE_ID);
  if (
    !registered ||
    canonicalAgentMcpProfileJson(profile) !== canonicalAgentMcpProfileJson(registered)
  ) {
    throw new Error('G01 render-query offline mode requires its exact registered profile.');
  }
  if (
    profile.frontierId !== 'G01' ||
    profile.epochId !== G01_RENDER_QUERY_OFFLINE_EPOCH_ID ||
    profile.toolName !== 'bangumi.render_query_subjects' ||
    profile.argumentProfile !== G01_RENDER_QUERY_OFFLINE_ARGUMENT_PROFILE ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.networkMode !== G01_RENDER_QUERY_OFFLINE_NETWORK_MODE ||
    profile.reportPath !== G01_RENDER_QUERY_OFFLINE_REPORT_PATH ||
    profile.selectionEvidencePath !== G01_RENDER_QUERY_OFFLINE_SELECTION_EVIDENCE_PATH ||
    profile.claimLabelName !== G01_RENDER_QUERY_OFFLINE_CLAIM_LABEL_NAME ||
    profile.evidenceKind !== G01_RENDER_QUERY_OFFLINE_EVIDENCE_KIND ||
    profile.answerCheckMethod !== G01_RENDER_QUERY_OFFLINE_ANSWER_CHECK_METHOD ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== profile.toolName ||
    canonicalAgentMcpProfileJson(profile.calls[0]?.arguments) !==
      canonicalAgentMcpProfileJson(G01_RENDER_QUERY_OFFLINE_EXPECTED_ARGUMENTS)
  ) {
    throw new Error('G01 render-query offline profile does not match its fixed contract.');
  }
  return true;
}

export function summarizeG01RenderQueryOfflineToolResult(result, artifactSummary) {
  const artifact = artifactSummary && typeof artifactSummary === 'object' ? artifactSummary : {};
  return {
    resultState: result?.artifact?.id ? 'artifact_returned' : 'artifact_missing',
    artifact: {
      returned: artifact.returned === true,
      persisted: artifact.persisted === true,
      mimeType: typeof artifact.mimeType === 'string' ? artifact.mimeType : null,
      width: Number.isInteger(artifact.width) ? artifact.width : null,
      height: Number.isInteger(artifact.height) ? artifact.height : null,
      byteLength: Number.isInteger(artifact.byteLength) ? artifact.byteLength : null,
      sha256: typeof artifact.sha256 === 'string' ? artifact.sha256 : null,
      pngSignatureValid: artifact.pngSignatureValid === true,
    },
  };
}
