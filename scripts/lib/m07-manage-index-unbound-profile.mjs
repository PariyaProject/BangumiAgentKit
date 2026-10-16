export const M07_MANAGE_INDEX_PROFILE_ID = 'm07-manage-index-unbound-agent-mcp-v1';
export const M07_MANAGE_INDEX_EPOCH_ID = 'run95-m07-manage-index-agent-mcp-unbound-denial-20261016';
export const M07_MANAGE_INDEX_NETWORK_MODE = 'run95-m07-manage-index-unbound-auth-required-v1';
export const M07_MANAGE_INDEX_ARGUMENT_PROFILE = 'fixed-m07-manage-index-create-unbound-no-http-v1';
export const M07_MANAGE_INDEX_TOOL = 'bangumi.manage_index';
export const M07_MANAGE_INDEX_CLAIM_LABEL = 'harness-r95-m07-manage-index-unbound-claimed';
export const M07_MANAGE_INDEX_REPORT_PATH =
  'docs/live-probes/m07-manage-index-agent-mcp-run95.json';

export const M07_MANAGE_INDEX_EXPECTED_ARGUMENTS = Object.freeze({
  action: 'create',
  title: 'Run95 no-account gate check',
});

export function assertM07ManageIndexUnboundProfile(profile) {
  if (
    profile?.id !== M07_MANAGE_INDEX_PROFILE_ID ||
    profile.frontierId !== 'M07' ||
    profile.epochId !== M07_MANAGE_INDEX_EPOCH_ID ||
    profile.toolName !== M07_MANAGE_INDEX_TOOL ||
    profile.argumentProfile !== M07_MANAGE_INDEX_ARGUMENT_PROFILE ||
    profile.claimLabelName !== M07_MANAGE_INDEX_CLAIM_LABEL ||
    profile.reportPath !== M07_MANAGE_INDEX_REPORT_PATH ||
    profile.evidenceKind !== 'codex_cli_m07_manage_index_unbound_auth_gate_agent_mcp' ||
    profile.answerCheckMethod !== 'm07-manage-index-unbound-auth-required-no-http-v1' ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.networkMode !== M07_MANAGE_INDEX_NETWORK_MODE ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.maxAnswerBytes !== 512 ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== M07_MANAGE_INDEX_TOOL ||
    !sameArguments(profile.calls[0]?.arguments, M07_MANAGE_INDEX_EXPECTED_ARGUMENTS)
  ) {
    throw new Error('M07 offline profile must match the exact manage_index no-account gate.');
  }
  return true;
}

export function sameArguments(actual, expected = M07_MANAGE_INDEX_EXPECTED_ARGUMENTS) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index] && actual[key] === expected[key])
  );
}
