import { isDeepStrictEqual } from 'node:util';
import { NATIVE_PAGE_CALLS } from './native-entity-page-verification.mjs';

export const NATIVE_PAGE_PROFILE_ID = 'native-entity-page-public-model-v1';
export const NATIVE_PAGE_SERVER_ID = 'bgk_native_entity_pages';
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export const NATIVE_PAGE_PROFILE = freeze({
  id: NATIVE_PAGE_PROFILE_ID,
  frontierId: 'OP-009',
  epochId: 'run95-native-entity-page-verification-20261106',
  toolName: NATIVE_PAGE_CALLS[0].toolName,
  toolNames: NATIVE_PAGE_CALLS.map((call) => call.toolName),
  argumentProfile: 'native-person-character-public-limit1-offset0-v1',
  claimLabelName: 'harness-r95-native-pages-v1-claimed',
  reportPath: 'docs/live-probes/native-entity-page-public-model-run95-v1.json',
  selectionEvidencePath: 'docs/research/run95-native-entity-page-verification-contract-2026-11-06.md',
  evidenceKind: 'native_entity_page_public_agent_mcp_v1',
  answerCheckMethod: 'native-page-counts-window-unknown-no-snapshot-v1',
  acceptanceScope: 'public-api-and-agent-mcp-native-pages-only',
  networkMode: 'run95-native-entity-pages-public-v1',
  model: 'gpt-6.1-sol',
  reasoningEffort: 'xhigh',
  maxAnswerBytes: 4096,
  calls: NATIVE_PAGE_CALLS,
});

export const isNativeEntityPageProfile = (profile) => isDeepStrictEqual(profile, NATIVE_PAGE_PROFILE);

/** One new closed workload; all historical profile execution pins stay exact. */
export function profileExecutionModelMatches(profile) {
  return profile?.id === NATIVE_PAGE_PROFILE_ID
    ? isNativeEntityPageProfile(profile)
    : profile?.model === 'gpt-6-luna' && profile?.reasoningEffort === 'max';
}
