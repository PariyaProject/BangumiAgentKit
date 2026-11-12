import { isDeepStrictEqual } from 'node:util';
import { RELATION_SAFETY_CALLS } from './native-relation-safety-contract.mjs';

const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const RELATION_MODEL_PROFILE_ID = 'native-relation-safety-model-v1';
export const RELATION_MODEL_SERVER_ID = 'bgk_native_relation_safety';
export const RELATION_MODEL_PROFILE = freeze({
  id: RELATION_MODEL_PROFILE_ID,
  frontierId: 'R01',
  epochId: 'run95-native-relation-safety-model-20261112',
  toolName: RELATION_SAFETY_CALLS[0].toolName,
  toolNames: RELATION_SAFETY_CALLS.map((call) => call.toolName),
  argumentProfile: 'native-conflicting-labels-media-exclusions-closed-source-v1',
  claimLabelName: 'harness-r95-native-relation-safety-v1-claimed',
  reportPath: 'docs/live-probes/native-relation-safety-model-run95-v1.json',
  selectionEvidencePath: 'docs/research/run95-native-relation-safety-model-contract-2026-11-12.md',
  evidenceKind: 'native_relation_safety_agent_mcp_v1',
  answerCheckMethod: 'native-raw-conflicting-relations-versus-safe-steps-v1',
  acceptanceScope: 'agent-mcp-native-relation-synthetic-only',
  networkMode: 'run95-native-relation-safety-synthetic-v1',
  model: 'gpt-6.1-sol',
  reasoningEffort: 'xhigh',
  maxAnswerBytes: 4096,
  calls: RELATION_SAFETY_CALLS,
});
export const isRelationModelProfile = (profile) =>
  isDeepStrictEqual(profile, RELATION_MODEL_PROFILE);
