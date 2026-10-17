import {
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';

const V1_ID = 'g01-render-query-subjects-offline-agent-mcp-v1';
const V2_ID = 'g01-render-query-subjects-offline-agent-mcp-v2';

function expectedArguments(keyword) {
  return Object.freeze({
    keyword,
    media: 'anime',
    reportedEpisodeCount: Object.freeze({ min: 1, max: 1 }),
    resultMode: 'top',
    limit: 1,
    sort: 'relevance',
    explain: 'none',
    nsfw: 'include',
  });
}

const SPECS = new Map([
  [
    V1_ID,
    Object.freeze({
      id: V1_ID,
      epochId: 'run95-g01-render-query-subjects-offline-matrix-20261017',
      argumentProfile: 'fixed-g01-synthetic-render-query-990920-one-result-v1',
      claimLabelName: 'harness-r95-g01-render-query-offline-claimed',
      reportPath: 'docs/live-probes/g01-render-query-subjects-offline-agent-mcp-run95.json',
      selectionEvidencePath:
        'docs/research/run95-g01-render-query-subjects-offline-matrix-contract-2026-10-17.md',
      evidenceKind: 'codex_cli_g01_render_query_subjects_offline_agent_mcp',
      answerCheckMethod: 'g01-exact-synthetic-render-query-execution-only-v1',
      networkMode: 'run95-g01-render-query-subjects-synthetic-offline-v1',
      syntheticKeyword: 'run95 g01 synthetic render query offline 20261017',
      syntheticSubjectId: 990920,
      acknowledgement: 'G01_RENDER_QUERY_SYNTHETIC_OFFLINE_OK',
    }),
  ],
  [
    V2_ID,
    Object.freeze({
      id: V2_ID,
      epochId: 'run95-g01-render-query-offline-matrix-v2-20261018',
      argumentProfile: 'fixed-g01-synthetic-render-query-991111-one-result-v2',
      claimLabelName: 'harness-r95-g01-render-query-offline-v2-claimed',
      reportPath: 'docs/live-probes/g01-render-query-subjects-offline-agent-mcp-v2-run95.json',
      selectionEvidencePath:
        'docs/research/run95-g01-render-query-subjects-offline-matrix-v2-contract-2026-10-18.md',
      evidenceKind: 'codex_cli_g01_render_query_subjects_offline_agent_mcp_v2',
      answerCheckMethod: 'g01-exact-synthetic-render-query-execution-only-v2',
      networkMode: 'run95-g01-render-query-subjects-synthetic-offline-v2',
      syntheticKeyword: 'run95 g01 fresh synthetic render query offline 20261018',
      syntheticSubjectId: 991111,
      acknowledgement: 'G01_RENDER_QUERY_SYNTHETIC_OFFLINE_V2_OK',
    }),
  ],
]);

const EXPECTED_ARGUMENTS_BY_ID = new Map(
  [...SPECS.entries()].map(([id, spec]) => [id, expectedArguments(spec.syntheticKeyword)]),
);

export const G01_RENDER_QUERY_OFFLINE_PROFILE_ID = V1_ID;
export const G01_RENDER_QUERY_OFFLINE_V2_PROFILE_ID = V2_ID;
export const G01_RENDER_QUERY_OFFLINE_EPOCH_ID = SPECS.get(V1_ID).epochId;
export const G01_RENDER_QUERY_OFFLINE_V2_EPOCH_ID = SPECS.get(V2_ID).epochId;
export const G01_RENDER_QUERY_OFFLINE_NETWORK_MODE = SPECS.get(V1_ID).networkMode;
export const G01_RENDER_QUERY_OFFLINE_V2_NETWORK_MODE = SPECS.get(V2_ID).networkMode;
export const G01_RENDER_QUERY_OFFLINE_ARGUMENT_PROFILE = SPECS.get(V1_ID).argumentProfile;
export const G01_RENDER_QUERY_OFFLINE_V2_ARGUMENT_PROFILE = SPECS.get(V2_ID).argumentProfile;
export const G01_RENDER_QUERY_OFFLINE_REPORT_PATH = SPECS.get(V1_ID).reportPath;
export const G01_RENDER_QUERY_OFFLINE_V2_REPORT_PATH = SPECS.get(V2_ID).reportPath;
export const G01_RENDER_QUERY_OFFLINE_SELECTION_EVIDENCE_PATH =
  SPECS.get(V1_ID).selectionEvidencePath;
export const G01_RENDER_QUERY_OFFLINE_V2_SELECTION_EVIDENCE_PATH =
  SPECS.get(V2_ID).selectionEvidencePath;
export const G01_RENDER_QUERY_OFFLINE_CLAIM_LABEL_NAME = SPECS.get(V1_ID).claimLabelName;
export const G01_RENDER_QUERY_OFFLINE_V2_CLAIM_LABEL_NAME = SPECS.get(V2_ID).claimLabelName;
export const G01_RENDER_QUERY_OFFLINE_EVIDENCE_KIND = SPECS.get(V1_ID).evidenceKind;
export const G01_RENDER_QUERY_OFFLINE_V2_EVIDENCE_KIND = SPECS.get(V2_ID).evidenceKind;
export const G01_RENDER_QUERY_OFFLINE_ANSWER_CHECK_METHOD = SPECS.get(V1_ID).answerCheckMethod;
export const G01_RENDER_QUERY_OFFLINE_V2_ANSWER_CHECK_METHOD = SPECS.get(V2_ID).answerCheckMethod;
export const G01_RENDER_QUERY_OFFLINE_ACKNOWLEDGEMENT = SPECS.get(V1_ID).acknowledgement;
export const G01_RENDER_QUERY_OFFLINE_V2_ACKNOWLEDGEMENT = SPECS.get(V2_ID).acknowledgement;
export const G01_RENDER_QUERY_OFFLINE_SYNTHETIC_KEYWORD = SPECS.get(V1_ID).syntheticKeyword;
export const G01_RENDER_QUERY_OFFLINE_V2_SYNTHETIC_KEYWORD = SPECS.get(V2_ID).syntheticKeyword;
export const G01_RENDER_QUERY_OFFLINE_SYNTHETIC_SUBJECT_ID = SPECS.get(V1_ID).syntheticSubjectId;
export const G01_RENDER_QUERY_OFFLINE_V2_SYNTHETIC_SUBJECT_ID = SPECS.get(V2_ID).syntheticSubjectId;
export const G01_RENDER_QUERY_OFFLINE_EXPECTED_ARGUMENTS = EXPECTED_ARGUMENTS_BY_ID.get(V1_ID);
export const G01_RENDER_QUERY_OFFLINE_V2_EXPECTED_ARGUMENTS = EXPECTED_ARGUMENTS_BY_ID.get(V2_ID);

export function getG01RenderQueryOfflineProfileSpec(profileOrId) {
  const profileId = typeof profileOrId === 'string' ? profileOrId : profileOrId?.id;
  const spec = SPECS.get(profileId);
  return spec ? { ...spec, expectedArguments: EXPECTED_ARGUMENTS_BY_ID.get(profileId) } : null;
}

export function isG01RenderQueryOfflineProfileId(profileId) {
  return SPECS.has(profileId);
}

export function assertG01RenderQueryOfflineProfile(profile) {
  const spec = getG01RenderQueryOfflineProfileSpec(profile);
  if (!spec) return false;
  const registered = getAgentMcpProfileById(spec.id);
  if (
    !registered ||
    canonicalAgentMcpProfileJson(profile) !== canonicalAgentMcpProfileJson(registered)
  ) {
    throw new Error('G01 render-query offline mode requires its exact registered profile.');
  }
  if (
    profile.frontierId !== 'G01' ||
    profile.epochId !== spec.epochId ||
    profile.toolName !== 'bangumi.render_query_subjects' ||
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
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== profile.toolName ||
    canonicalAgentMcpProfileJson(profile.calls[0]?.arguments) !==
      canonicalAgentMcpProfileJson(spec.expectedArguments)
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
