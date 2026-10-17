import { canonicalAgentMcpProfileJson } from './agent-mcp-profile-claims.mjs';

export const C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID =
  'c07-render-comparison-offline-agent-mcp-matrix-v1';
export const C07_RENDER_COMPARISON_OFFLINE_EPOCH_ID =
  'run95-c07-render-cohort-comparison-offline-agent-mcp-20261017';
export const C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE =
  'run95-c07-render-comparison-synthetic-offline-v1';
export const C07_RENDER_COMPARISON_OFFLINE_ARGUMENT_PROFILE =
  'fixed-c07-synthetic-single-cohort-render-comparison-v1';
export const C07_RENDER_COMPARISON_OFFLINE_PROFILE =
  'run95-c07-render-comparison-offline-fixture-v1';
export const C07_RENDER_COMPARISON_OFFLINE_REPORT_PATH =
  'docs/live-probes/c07-render-comparison-offline-agent-mcp-run95.json';
export const C07_RENDER_COMPARISON_OFFLINE_SELECTION_EVIDENCE_PATH =
  'docs/research/run95-c07-render-comparison-offline-agent-mcp-matrix-contract-2026-10-17.md';
export const C07_RENDER_COMPARISON_OFFLINE_CLAIM_LABEL_NAME =
  'harness-r95-c07-cohort-render-offline-claimed';
export const C07_RENDER_COMPARISON_OFFLINE_EVIDENCE_KIND =
  'codex_cli_c07_render_comparison_offline_agent_mcp_matrix';
export const C07_RENDER_COMPARISON_OFFLINE_ANSWER_CHECK_METHOD =
  'c07-exact-synthetic-render-comparison-execution-only-v1';
export const C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_KEYWORD =
  'run95 c07 synthetic cohort c offline 20261017';
export const C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_SUBJECT_ID = 990301;
export const C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS = Object.freeze({
  cohorts: [
    {
      label: '合成样本 C',
      query: {
        keyword: C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_KEYWORD,
        media: 'anime',
        resultMode: 'all',
        limit: 1,
      },
    },
  ],
  maxSubjects: 1,
});

export function assertC07RenderComparisonOfflineProfile(profile) {
  if (profile?.id !== C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID) return false;
  if (
    profile.frontierId !== 'C07' ||
    profile.epochId !== C07_RENDER_COMPARISON_OFFLINE_EPOCH_ID ||
    profile.toolName !== 'bangumi.render_subject_cohort_comparison' ||
    profile.argumentProfile !== C07_RENDER_COMPARISON_OFFLINE_ARGUMENT_PROFILE ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.networkMode !== C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE ||
    profile.reportPath !== C07_RENDER_COMPARISON_OFFLINE_REPORT_PATH ||
    profile.selectionEvidencePath !== C07_RENDER_COMPARISON_OFFLINE_SELECTION_EVIDENCE_PATH ||
    profile.evidenceKind !== C07_RENDER_COMPARISON_OFFLINE_EVIDENCE_KIND ||
    profile.answerCheckMethod !== C07_RENDER_COMPARISON_OFFLINE_ANSWER_CHECK_METHOD ||
    profile.claimLabelName !== C07_RENDER_COMPARISON_OFFLINE_CLAIM_LABEL_NAME ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== profile.toolName ||
    canonicalAgentMcpProfileJson(profile.calls[0]?.arguments) !==
      canonicalAgentMcpProfileJson(C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS)
  ) {
    throw new Error(
      'C07 render-comparison offline mode requires its exact registered matrix profile.',
    );
  }
  return true;
}
