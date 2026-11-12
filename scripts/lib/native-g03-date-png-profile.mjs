import { isDeepStrictEqual } from 'node:util';
import { G03_NATIVE_CALLS } from './g03-native-discovery-verification.mjs';

export const G03_MODEL_PROFILE_ID = 'native-g03-date-png-model-v1';
export const G03_MODEL_SERVER_ID = 'bgk_g03_native_discovery';
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const G03_MODEL_PROFILE = freeze({
  id: G03_MODEL_PROFILE_ID,
  frontierId: 'G03',
  epochId: 'run95-native-g03-date-png-model-20261112',
  toolName: G03_NATIVE_CALLS[0].toolName,
  toolNames: G03_NATIVE_CALLS.map((call) => call.toolName),
  argumentProfile: 'native-g03-explicit-date-hydration-six-case-png-v1',
  claimLabelName: 'harness-r95-native-g03-dates-v1-claimed',
  reportPath: 'docs/live-probes/native-g03-date-png-model-run95-v1.json',
  selectionEvidencePath: 'docs/research/run95-native-g03-date-png-model-contract-2026-11-12.md',
  evidenceKind: 'native_g03_date_png_agent_mcp_v1',
  answerCheckMethod: 'native-g03-ordered-dates-unknown-bounds-artifact-v1',
  acceptanceScope: 'agent-mcp-native-discovery-synthetic-only',
  networkMode: 'run95-native-g03-synthetic-date-png-v1',
  model: 'gpt-6.1-sol',
  reasoningEffort: 'xhigh',
  maxAnswerBytes: 4096,
  calls: G03_NATIVE_CALLS,
});
export const isG03ModelProfile = (profile) => isDeepStrictEqual(profile, G03_MODEL_PROFILE);
