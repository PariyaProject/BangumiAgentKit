import { canonicalAgentMcpProfileJson } from './agent-mcp-profile-claims.mjs';

const V1_PROFILE_ID = 'c07-render-comparison-offline-agent-mcp-matrix-v1';
const V2_PROFILE_ID = 'c07-render-comparison-offline-agent-mcp-matrix-v2';
const V3_PROFILE_ID = 'c07-render-comparison-offline-agent-mcp-matrix-v3';

function createConfig({
  id,
  epochId,
  networkMode,
  argumentProfile,
  profile,
  reportPath,
  selectionEvidencePath,
  claimLabelName,
  evidenceKind,
  answerCheckMethod,
  keyword,
  subjectId,
  cohortLabel,
  subjectName,
  subjectNameCn,
}) {
  const expectedArguments = Object.freeze({
    cohorts: [
      {
        label: cohortLabel,
        query: {
          keyword,
          media: 'anime',
          resultMode: 'all',
          limit: 1,
        },
      },
    ],
    maxSubjects: 1,
  });
  return Object.freeze({
    id,
    epochId,
    networkMode,
    argumentProfile,
    profile,
    reportPath,
    selectionEvidencePath,
    claimLabelName,
    evidenceKind,
    answerCheckMethod,
    keyword,
    subjectId,
    cohortLabel,
    expectedArguments,
    subjectName: subjectName ?? `Synthetic Cohort ${cohortLabel.at(-1)} Work ${subjectId}`,
    subjectNameCn: subjectNameCn ?? `${cohortLabel} 作品 ${subjectId}`,
    receiptKind: `c07-render-comparison-offline-runner-receipt-${id.endsWith('-v3') ? 'v3' : id.endsWith('-v2') ? 'v2' : 'v1'}`,
    acknowledgement: 'C07_SYNTHETIC_COHORT_RENDERED',
  });
}

const CONFIGS = new Map([
  [
    V1_PROFILE_ID,
    createConfig({
      id: V1_PROFILE_ID,
      epochId: 'run95-c07-render-cohort-comparison-offline-agent-mcp-20261017',
      networkMode: 'run95-c07-render-comparison-synthetic-offline-v1',
      argumentProfile: 'fixed-c07-synthetic-single-cohort-render-comparison-v1',
      profile: 'run95-c07-render-comparison-offline-fixture-v1',
      reportPath: 'docs/live-probes/c07-render-comparison-offline-agent-mcp-run95.json',
      selectionEvidencePath:
        'docs/research/run95-c07-render-comparison-offline-agent-mcp-matrix-contract-2026-10-17.md',
      claimLabelName: 'harness-r95-c07-cohort-render-offline-claimed',
      evidenceKind: 'codex_cli_c07_render_comparison_offline_agent_mcp_matrix',
      answerCheckMethod: 'c07-exact-synthetic-render-comparison-execution-only-v1',
      keyword: 'run95 c07 synthetic cohort c offline 20261017',
      subjectId: 990301,
      cohortLabel: '合成样本 C',
    }),
  ],
  [
    V2_PROFILE_ID,
    createConfig({
      id: V2_PROFILE_ID,
      epochId: 'run95-c07-render-comparison-offline-agent-mcp-matrix-v2-20261018',
      networkMode: 'run95-c07-render-comparison-synthetic-offline-matrix-v2',
      argumentProfile: 'fixed-c07-synthetic-cohort-d-render-comparison-matrix-v2',
      profile: 'run95-c07-render-comparison-offline-fixture-matrix-v2',
      reportPath: 'docs/live-probes/c07-render-comparison-offline-agent-mcp-matrix-v2-run95.json',
      selectionEvidencePath:
        'docs/research/run95-c07-render-comparison-offline-agent-mcp-matrix-v2-contract-2026-10-18.md',
      claimLabelName: 'harness-r95-c07-render-v2-claimed',
      evidenceKind: 'codex_cli_c07_render_comparison_offline_agent_mcp_matrix_v2',
      answerCheckMethod: 'c07-exact-synthetic-render-comparison-execution-only-v2',
      keyword: 'run95 c07 synthetic cohort d offline matrix 20261018',
      subjectId: 991224,
      cohortLabel: '合成样本 D',
    }),
  ],
  [
    V3_PROFILE_ID,
    createConfig({
      id: V3_PROFILE_ID,
      epochId: 'run95-c07-render-comparison-offline-agent-mcp-matrix-v3-20261018',
      networkMode: 'run95-c07-render-comparison-synthetic-offline-matrix-v3',
      argumentProfile: 'fixed-c07-synthetic-cohort-e-render-comparison-matrix-v3',
      profile: 'run95-c07-render-comparison-offline-fixture-matrix-v3',
      reportPath: 'docs/live-probes/c07-render-comparison-offline-agent-mcp-matrix-v3-run95.json',
      selectionEvidencePath:
        'docs/research/run95-c07-render-comparison-offline-agent-mcp-matrix-v3-contract-2026-10-18.md',
      claimLabelName: 'harness-r95-c07-render-v3-claimed',
      evidenceKind: 'codex_cli_c07_render_comparison_offline_agent_mcp_matrix_v3',
      answerCheckMethod: 'c07-exact-synthetic-render-comparison-execution-only-v3',
      keyword: 'run95 c07 synthetic cohort e offline matrix 20261018',
      subjectId: 991226,
      cohortLabel: '合成样本 E',
      subjectName: 'Synthetic Work — Long English Title for Narrow-Width Wrapping Review',
      subjectNameCn: '合成作品 E：日本語タイトル / 中文混排与 Latin wrapping 检查',
    }),
  ],
]);

export const C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID = V1_PROFILE_ID;
export const C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID = V2_PROFILE_ID;
export const C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID = V3_PROFILE_ID;
export const C07_RENDER_COMPARISON_OFFLINE_EPOCH_ID = CONFIGS.get(V1_PROFILE_ID).epochId;
export const C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE = CONFIGS.get(V1_PROFILE_ID).networkMode;
export const C07_RENDER_COMPARISON_OFFLINE_V2_NETWORK_MODE = CONFIGS.get(V2_PROFILE_ID).networkMode;
export const C07_RENDER_COMPARISON_OFFLINE_V3_NETWORK_MODE = CONFIGS.get(V3_PROFILE_ID).networkMode;
export const C07_RENDER_COMPARISON_OFFLINE_ARGUMENT_PROFILE =
  CONFIGS.get(V1_PROFILE_ID).argumentProfile;
export const C07_RENDER_COMPARISON_OFFLINE_PROFILE = CONFIGS.get(V1_PROFILE_ID).profile;
export const C07_RENDER_COMPARISON_OFFLINE_REPORT_PATH = CONFIGS.get(V1_PROFILE_ID).reportPath;
export const C07_RENDER_COMPARISON_OFFLINE_SELECTION_EVIDENCE_PATH =
  CONFIGS.get(V1_PROFILE_ID).selectionEvidencePath;
export const C07_RENDER_COMPARISON_OFFLINE_CLAIM_LABEL_NAME =
  CONFIGS.get(V1_PROFILE_ID).claimLabelName;
export const C07_RENDER_COMPARISON_OFFLINE_EVIDENCE_KIND = CONFIGS.get(V1_PROFILE_ID).evidenceKind;
export const C07_RENDER_COMPARISON_OFFLINE_ANSWER_CHECK_METHOD =
  CONFIGS.get(V1_PROFILE_ID).answerCheckMethod;
export const C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_KEYWORD = CONFIGS.get(V1_PROFILE_ID).keyword;
export const C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_SUBJECT_ID =
  CONFIGS.get(V1_PROFILE_ID).subjectId;
export const C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS =
  CONFIGS.get(V1_PROFILE_ID).expectedArguments;

export function getC07RenderComparisonOfflineConfig(profileId = V1_PROFILE_ID) {
  return CONFIGS.get(profileId) ?? null;
}

export function getC07RenderComparisonOfflineConfigForNetworkMode(networkMode) {
  return [...CONFIGS.values()].find((config) => config.networkMode === networkMode) ?? null;
}

export function isC07RenderComparisonOfflineProfileId(profileId) {
  return CONFIGS.has(profileId);
}

export function isC07RenderComparisonOfflineNetworkMode(networkMode) {
  return getC07RenderComparisonOfflineConfigForNetworkMode(networkMode) !== null;
}

export function assertC07RenderComparisonOfflineProfile(profile) {
  const config = getC07RenderComparisonOfflineConfig(profile?.id);
  if (!config) return false;
  if (
    profile.frontierId !== 'C07' ||
    profile.epochId !== config.epochId ||
    profile.toolName !== 'bangumi.render_subject_cohort_comparison' ||
    profile.argumentProfile !== config.argumentProfile ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.networkMode !== config.networkMode ||
    profile.reportPath !== config.reportPath ||
    profile.selectionEvidencePath !== config.selectionEvidencePath ||
    profile.evidenceKind !== config.evidenceKind ||
    profile.answerCheckMethod !== config.answerCheckMethod ||
    profile.claimLabelName !== config.claimLabelName ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== profile.toolName ||
    canonicalAgentMcpProfileJson(profile.calls[0]?.arguments) !==
      canonicalAgentMcpProfileJson(config.expectedArguments)
  ) {
    throw new Error(
      'C07 render-comparison offline mode requires its exact registered matrix profile.',
    );
  }
  return true;
}
