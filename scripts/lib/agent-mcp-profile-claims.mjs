import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REGISTRY_PATH = path.join(ROOT, 'scripts/acceptance/agent-mcp-profile-registry.json');
const REGISTRY_BYTES = readFileSync(REGISTRY_PATH);
const REGISTRY = JSON.parse(REGISTRY_BYTES.toString('utf8'));
const LEGACY_C03_REGISTRY_SHA256 =
  '7e3bfd3c5f7815faf5f279759739572e86f62308e81faff518d775aa1eaa9e92';
const PROFILE_DIAGNOSTIC_CHECKS = new Set([
  'eventStreamParsed',
  'turnCompleted',
  'exactCallSequence',
  'exactToolEvents',
  'mcpToolErrorResultCountZero',
  'structuredReadback',
  'resultProjectionValid',
  'serverSummaryValid',
  'answerValid',
  'candidateBundleCurrent',
  'activeGateCurrent',
  'claimReadbackValid',
  'reportBuildValid',
  'artifactValid',
  'runnerReceiptValid',
  'requestBudgetSatisfied',
  'privacyPreserved',
  'codexExecutionSucceeded',
  'invocationAttempted',
  'outputLimitExceeded',
  'processSpawned',
  'processTimedOut',
  'invocationStateUnknown',
  'codexErrorCountsMatch',
  'safeWebSearchErrorClassification',
]);
const PROFILE_DIAGNOSTIC_REASON_CODES = new Set([
  'A01_AGGREGATE_MATRIX_AGENT_MCP_ASSERTION_FAILED',
  'A01_AGGREGATE_MATRIX_AMBIGUOUS_CLAIM_TERMINALIZED',
  'A01_AGGREGATE_MATRIX_AMBIGUOUS_LATCH_RECONCILED',
  'A01_AGGREGATE_MATRIX_ANSWER_INVALID',
  'A01_AGGREGATE_MATRIX_CLAIM_READBACK_FAILED',
  'A01_AGGREGATE_MATRIX_CLI_EXITED_NONZERO',
  'A01_AGGREGATE_MATRIX_CLI_OUTPUT_LIMIT_EXCEEDED',
  'A01_AGGREGATE_MATRIX_CLI_SPAWN_FAILED',
  'A01_AGGREGATE_MATRIX_CLI_TIMED_OUT',
  'A01_AGGREGATE_MATRIX_EVENT_STREAM_INCOMPLETE',
  'A01_AGGREGATE_MATRIX_MCP_RESULT_INVALID',
  'A01_AGGREGATE_MATRIX_POSTRUN_GATE_CHANGED',
  'A01_AGGREGATE_MATRIX_PREINVOCATION_GATE_FAILED',
  'A01_AGGREGATE_MATRIX_REPORT_BUILD_FAILED',
  'A01_AGGREGATE_MATRIX_RUNNER_RECEIPT_INVALID',
  'C03_ACTIVE_GATE_CHANGED_DURING_QUERY',
  'C03_ACTIVITY_V2_AMBIGUOUS_LATCH_RECONCILED',
  'C03_ACTIVITY_V2_REPORT_ACK_STALE_CI',
  'C03_ACTIVITY_V2_TERMINAL_LATCH_REPLAYED',
  'C03_AGENT_MCP_ASSERTION_FAILED',
  'C03_ACTOR_COUNT_INVALID',
  'C03_ANSWER_CHECKS_INVALID',
  'C03_CLAIM_EXISTS_WITHOUT_REPORT',
  'C03_CLAIM_READBACK_MISMATCH',
  'C03_COMPARISON_FIELDS_INVALID',
  'C03_COMPARISON_INVALID',
  'C03_COMPARISON_MISMATCH',
  'C03_POSTRUN_GATE_OR_ACK_FAILED',
  'C03_PREINVOKE_GATE_MISMATCH',
  'C03_PRIVACY_FIELDS_INVALID',
  'C03_RECEIPT_FIELDS_INVALID',
  'C03_RECEIPT_SIGNATURE_INVALID',
  'C03_REPORT_ACK_UNAVAILABLE_OR_STALE',
  'C03_REPORT_ALREADY_EXISTS_OR_UNWRITABLE',
  'C03_REPORT_BUILD_FAILED',
  'C03_REPORT_BYTES_INVALID',
  'C03_REPORT_CLAIM_MISMATCH',
  'C03_REPORT_FIELDS_INVALID',
  'C03_REPORT_GATE_FIELDS_INVALID',
  'C03_REPORT_JSON_INVALID',
  'C03_REPORT_PATH_INVALID',
  'C03_REPORT_TOO_LARGE',
  'C03_REPORT_UNAVAILABLE',
  'C03_RUNNER_FAILED_AFTER_CLAIM',
  'C03_RUNNER_GATE_INVALID',
  'C03_RUNNER_KEY_MISMATCH',
  'C03_RUN_INCONCLUSIVE',
  'P03_ACTIVE_GATE_CHANGED_DURING_QUERY',
  'P03_ANSWER_CHECKS_FAILED',
  'P03_AGENT_MCP_ASSERTION_FAILED',
  'P03_CLAIM_EXISTS_WITHOUT_REPORT',
  'P03_CLAIM_READBACK_MISMATCH',
  'P03_PREINVOKE_GATE_MISMATCH',
  'P03_RECEIPT_FIELDS_INVALID',
  'P03_RECEIPT_SIGNATURE_INVALID',
  'P03_REPORT_ALREADY_EXISTS_OR_UNWRITABLE',
  'P03_REPORT_BUILD_FAILED',
  'P03_REPORT_BYTES_INVALID',
  'P03_REPORT_CLAIM_MISMATCH',
  'P03_REPORT_FIELDS_INVALID',
  'P03_REPORT_JSON_INVALID',
  'P03_REPORT_PATH_INVALID',
  'P03_REPORT_TOO_LARGE',
  'P03_REPORT_UNAVAILABLE',
  'P03_RUNNER_FAILED_AFTER_CLAIM',
  'P03_RUNNER_GATE_INVALID',
  'P03_RUNNER_KEY_MISMATCH',
  'P03_RUN_INCONCLUSIVE',
  'P03_SERVER_SUMMARY_MISMATCH',
  'P03_STRUCTURED_RESULT_INVALID',
  'P02_AMBIGUOUS_LATCH_RECONCILED',
  'P02_PROFILE_CLAIM_BINDING_MISMATCH_TERMINALIZED',
  'P02_REPORT_CANDIDATE_STALE',
  'P02_TERMINAL_LATCH_REPLAYED',
  'S05_ACTIVE_GATE_CHANGED_DURING_QUERY',
  'S05_AGENT_MCP_ASSERTION_FAILED',
  'S05_CLAIM_EXISTS_WITHOUT_REPORT',
  'S05_CLAIM_READBACK_MISMATCH',
  'S05_PREINVOKE_GATE_MISMATCH',
  'S05_ANSWER_CHECKS_FAILED',
  'S05_RECEIPT_FIELDS_INVALID',
  'S05_RECEIPT_SIGNATURE_INVALID',
  'S05_REPORT_ALREADY_EXISTS_OR_UNWRITABLE',
  'S05_REPORT_ANSWER_INVALID',
  'S05_REPORT_BYTES_INVALID',
  'S05_REPORT_CATALOG_BINDING_INVALID',
  'S05_REPORT_CLAIM_MISMATCH',
  'S05_REPORT_FIELDS_INVALID',
  'S05_REPORT_IDENTITY_INVALID',
  'S05_REPORT_JSON_INVALID',
  'S05_REPORT_PATH_INVALID',
  'S05_REPORT_PROFILE_BINDING_INVALID',
  'S05_REPORT_PRIVACY_INVALID',
  'S05_REPORT_RESULT_SUMMARY_INVALID',
  'S05_REPORT_RUNTIME_INVALID',
  'S05_REPORT_SINGLE_TOOL_INVALID',
  'S05_REPORT_TOO_LARGE',
  'S05_REPORT_UNAVAILABLE',
  'S05_REPORT_BUILD_FAILED',
  'S05_RUNNER_GATE_INVALID',
  'S05_RUNNER_KEY_MISMATCH',
  'S05_RUNNER_FAILED_AFTER_CLAIM',
  'S05_SERVER_SUMMARY_MISMATCH',
  'S05_RUN_INCONCLUSIVE',
  'S01_ACTIVE_GATE_CHANGED_DURING_QUERY',
  'S01_AGENT_MCP_ASSERTION_FAILED',
  'S01_ANSWER_CHECKS_FAILED',
  'S01_CLAIM_EXISTS_WITHOUT_REPORT',
  'S01_CLAIM_READBACK_MISMATCH',
  'S01_PREINVOKE_GATE_MISMATCH',
  'S01_RECEIPT_FIELDS_INVALID',
  'S01_RECEIPT_SIGNATURE_INVALID',
  'S01_REPORT_ALREADY_EXISTS_OR_UNWRITABLE',
  'S01_REPORT_ANSWER_INVALID',
  'S01_REPORT_BYTES_INVALID',
  'S01_REPORT_CATALOG_BINDING_INVALID',
  'S01_REPORT_CLAIM_MISMATCH',
  'S01_REPORT_FIELDS_INVALID',
  'S01_REPORT_IDENTITY_INVALID',
  'S01_REPORT_JSON_INVALID',
  'S01_REPORT_PATH_INVALID',
  'S01_REPORT_PROFILE_BINDING_INVALID',
  'S01_REPORT_PUBLIC_REQUEST_SCOPE_INVALID',
  'S01_REPORT_PRIVACY_INVALID',
  'S01_REPORT_RESULT_SUMMARY_INVALID',
  'S01_REPORT_RUNTIME_INVALID',
  'S01_REPORT_SINGLE_TOOL_INVALID',
  'S01_REPORT_TOO_LARGE',
  'S01_REPORT_UNAVAILABLE',
  'S01_REPORT_BUILD_FAILED',
  'S01_RUNNER_GATE_INVALID',
  'S01_RUNNER_KEY_MISMATCH',
  'S01_RUNNER_FAILED_AFTER_CLAIM',
  'S01_SERVER_SUMMARY_MISMATCH',
  'S01_RUN_INCONCLUSIVE',
  'TITLE_QUERY_RENDER_ACTIVE_GATE_CHANGED_DURING_QUERY',
  'TITLE_QUERY_RENDER_AGENT_MCP_ASSERTION_FAILED',
  'TITLE_QUERY_RENDER_CLAIM_READBACK_MISMATCH',
  'TITLE_QUERY_RENDER_CLAIM_WITHOUT_REPORT',
  'TITLE_QUERY_RENDER_ORPHAN_REPORT',
  'TITLE_QUERY_RENDER_PREINVOKE_GATE_MISMATCH',
  'TITLE_QUERY_RENDER_REPORT_ALREADY_EXISTS',
  'TITLE_QUERY_RENDER_REPORT_BUILD_FAILED',
  'TITLE_QUERY_RENDER_REPORT_READBACK_INVALID',
  'TITLE_QUERY_RENDER_RUNNER_FAILED_AFTER_CLAIM',
  'TITLE_QUERY_RENDER_STALE_REPORT_RECOVERY',
  'G01_QUERY_SUBJECTS_ACTIVE_GATE_CHANGED_DURING_QUERY',
  'G01_QUERY_SUBJECTS_AGENT_MCP_ASSERTION_FAILED',
  'G01_QUERY_SUBJECTS_CLAIM_READBACK_MISMATCH',
  'G01_QUERY_SUBJECTS_PREINVOKE_GATE_MISMATCH',
  'G01_QUERY_SUBJECTS_REPORT_BUILD_FAILED',
  'G01_QUERY_SUBJECTS_REPORT_READBACK_INVALID',
  'G01_QUERY_SUBJECTS_RUNNER_FAILED_AFTER_CLAIM',
  'G01_RENDER_QUERY_ACTIVE_GATE_CHANGED_DURING_QUERY',
  'G01_RENDER_QUERY_AGENT_MCP_ASSERTION_FAILED',
  'G01_RENDER_QUERY_CLAIM_READBACK_MISMATCH',
  'G01_RENDER_QUERY_PREINVOKE_GATE_MISMATCH',
  'G01_RENDER_QUERY_REPORT_BUILD_FAILED',
  'G01_RENDER_QUERY_RUNNER_FAILED_AFTER_CLAIM',
  'C07_RENDER_COMPARISON_AGENT_MCP_ASSERTION_FAILED',
  'C07_RENDER_COMPARISON_REPORT_BUILD_FAILED',
]);
const PROFILE_DIAGNOSTIC_COUNTERS = new Set([
  'codexMcpToolEvents',
  'codexErrorItems',
  'blockedDisabledWebSearchErrors',
  'unexpectedCodexErrors',
  'mcpToolErrorResults',
  'nonMcpToolEvents',
  'shellCalls',
  'allowedToolCalls',
  'deniedToolCalls',
  'httpRequests',
  'artifactBytes',
  'artifactWidth',
  'artifactHeight',
  'answerUtf8Bytes',
  'processExitCode',
  'codexStdoutBytes',
  'codexStderrBytes',
]);
const PROFILE_DIAGNOSTICS_MAX_JSON_CHARS = 4096;
const PROFILE_DIAGNOSTIC_COUNTER_MAX = 10_000_000;

export class AgentMcpProfileClaimError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgentMcpProfileClaimError';
    this.code = code;
  }
}

export function canonicalAgentMcpProfileJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalAgentMcpProfileJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalAgentMcpProfileJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Keep terminal Agent/MCP failure diagnostics useful without retaining raw Codex events,
 * answers, tool arguments, source rows, or artifacts in the durable GitHub control plane.
 */
export function normalizeAgentMcpProfileDiagnostics(value) {
  const invalid = () =>
    new AgentMcpProfileClaimError(
      'PROFILE_DIAGNOSTICS_INVALID',
      'Profile diagnostics must contain only bounded allowlisted checks and counters.',
    );
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 4 ||
    Object.keys(value).some(
      (key) => !['schemaVersion', 'reasonCode', 'checks', 'counters'].includes(key),
    ) ||
    value.schemaVersion !== 1 ||
    typeof value.reasonCode !== 'string' ||
    !PROFILE_DIAGNOSTIC_REASON_CODES.has(value.reasonCode)
  ) {
    throw invalid();
  }
  const normalizeFields = (input, allowed, predicate, minimum) => {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).length < minimum ||
      Object.keys(input).length > allowed.size ||
      Object.keys(input).some((key) => !allowed.has(key)) ||
      !Object.values(input).every(predicate)
    ) {
      throw invalid();
    }
    return Object.fromEntries(
      Object.entries(input).sort(([left], [right]) => left.localeCompare(right)),
    );
  };
  const checks = normalizeFields(
    value.checks,
    PROFILE_DIAGNOSTIC_CHECKS,
    (field) => typeof field === 'boolean',
    1,
  );
  const counters = normalizeFields(
    value.counters,
    PROFILE_DIAGNOSTIC_COUNTERS,
    (field) =>
      field === null ||
      (Number.isSafeInteger(field) && field >= 0 && field <= PROFILE_DIAGNOSTIC_COUNTER_MAX),
    0,
  );
  const normalized = { schemaVersion: 1, reasonCode: value.reasonCode, checks, counters };
  if (JSON.stringify(normalized).length > PROFILE_DIAGNOSTICS_MAX_JSON_CHARS) throw invalid();
  return normalized;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertRegistry(registry) {
  if (!registry || registry.schemaVersion !== 1 || !Array.isArray(registry.profiles)) {
    throw new Error('Agent/MCP profile registry schema is invalid.');
  }
  const keys = new Set();
  const ids = new Set();
  for (const profile of registry.profiles) {
    const toolNames = profile?.toolNames ?? [profile?.toolName];
    const callToolNames = Array.isArray(profile?.calls)
      ? [...new Set(profile.calls.map((call) => call?.toolName))]
      : [];
    const validToolNames =
      Array.isArray(toolNames) &&
      toolNames.length >= 1 &&
      toolNames[0] === profile?.toolName &&
      toolNames.every(
        (toolName) => typeof toolName === 'string' && /^bangumi\.[a-z][a-z0-9_]*$/u.test(toolName),
      ) &&
      new Set(toolNames).size === toolNames.length &&
      canonicalAgentMcpProfileJson(callToolNames) === canonicalAgentMcpProfileJson(toolNames) &&
      (profile?.toolNames === undefined || toolNames.length > 1);
    if (
      typeof profile?.id !== 'string' ||
      !/^[a-z0-9-]{3,80}$/u.test(profile.id) ||
      ids.has(profile.id) ||
      !/^bangumi\.[a-z][a-z0-9_]*$/u.test(profile?.toolName ?? '') ||
      !validToolNames ||
      typeof profile?.argumentProfile !== 'string' ||
      !/^harness-r95-[a-z0-9-]{1,44}$/u.test(profile?.claimLabelName ?? '') ||
      !Array.isArray(profile?.calls) ||
      profile.calls.length < 1 ||
      profile.calls.length > 8 ||
      profile.calls.some(
        (call) =>
          !toolNames.includes(call?.toolName) ||
          !call.arguments ||
          typeof call.arguments !== 'object' ||
          Array.isArray(call.arguments),
      ) ||
      toolNames.some((toolName) => keys.has(`${toolName}\0${profile?.argumentProfile}`))
    ) {
      throw new Error('Agent/MCP profile registry contains a duplicate or invalid profile.');
    }
    for (const toolName of toolNames) keys.add(`${toolName}\0${profile.argumentProfile}`);
    ids.add(profile.id);
  }
}

assertRegistry(REGISTRY);
deepFreeze(REGISTRY);

const PROFILES_BY_KEY = new Map(
  REGISTRY.profiles.flatMap((profile) =>
    (profile.toolNames ?? [profile.toolName]).map((toolName) => [
      `${toolName}\0${profile.argumentProfile}`,
      profile,
    ]),
  ),
);
const PROFILES_BY_ID = new Map(REGISTRY.profiles.map((profile) => [profile.id, profile]));

export function getAgentMcpProfile(toolName, argumentProfile) {
  return PROFILES_BY_KEY.get(`${toolName}\0${argumentProfile}`) ?? null;
}

export function getAgentMcpProfileById(profileId) {
  return PROFILES_BY_ID.get(profileId) ?? null;
}

export function listAgentMcpProfiles() {
  return [...REGISTRY.profiles];
}

/**
 * Bind each profile to its immutable registry definition. C03 already persisted the original
 * C03-only registry snapshot hash, so preserve that exact legacy value for its terminal claim.
 */
export function agentMcpProfileRegistrySha256(profileId = 'c03-voice-actor-comparison-v1') {
  if (profileId === 'c03-voice-actor-comparison-v1') return LEGACY_C03_REGISTRY_SHA256;
  const profile = getAgentMcpProfileById(profileId);
  if (!profile)
    throw new AgentMcpProfileClaimError('PROFILE_NOT_REGISTERED', 'Unknown profile id.');
  return createHash('sha256').update(canonicalAgentMcpProfileJson(profile)).digest('hex');
}

export function agentMcpProfileArgumentsSha256(profile) {
  const registered = profile && getAgentMcpProfile(profile.toolName, profile.argumentProfile);
  if (!registered || registered.id !== profile.id) {
    throw new AgentMcpProfileClaimError(
      'PROFILE_NOT_REGISTERED',
      'Only an exact registered tool/profile pair can be hashed for a one-shot claim.',
    );
  }
  return createHash('sha256')
    .update(canonicalAgentMcpProfileJson(registered.calls.map((call) => call.arguments)))
    .digest('hex');
}

export function classifyAgentMcpProfileInconclusiveReport({ reportValid, claimCurrent }) {
  if (typeof reportValid !== 'boolean' || typeof claimCurrent !== 'boolean') {
    throw new TypeError(
      'C03 report disposition requires explicit validity and Candidate freshness.',
    );
  }
  return reportValid && claimCurrent ? 'REPORT_WRITTEN_REQUIRED' : 'INCONCLUSIVE_ALLOWED';
}

export function agentMcpProfileClaimLabelDescription(profile) {
  if (
    !profile ||
    getAgentMcpProfile(profile.toolName, profile.argumentProfile)?.id !== profile.id
  ) {
    throw new AgentMcpProfileClaimError('PROFILE_NOT_REGISTERED', 'Unknown one-shot profile.');
  }
  const description = `Run 95 ${profile.frontierId} profile ${profile.id}; permanent one-shot latch.`;
  const compactDescription = `Run 95 ${profile.frontierId} ${profile.id}; permanent one-shot latch.`;
  const boundedDescription = description.length <= 100 ? description : compactDescription;
  if (boundedDescription.length > 100) {
    throw new AgentMcpProfileClaimError(
      'PROFILE_LATCH_INVALID',
      'Profile claim label description exceeds the GitHub 100-character limit.',
    );
  }
  return boundedDescription;
}

export function agentMcpProfileTerminalLabelName(profile) {
  if (
    !profile ||
    getAgentMcpProfile(profile.toolName, profile.argumentProfile)?.id !== profile.id
  ) {
    throw new AgentMcpProfileClaimError('PROFILE_NOT_REGISTERED', 'Unknown one-shot profile.');
  }
  return profile.claimLabelName.replace(/-claimed$/u, '-terminal');
}

export function agentMcpProfileTerminalLabelDescription(profile, state, reportSha256 = null) {
  if (
    !['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(state) ||
    (state === 'REPORT_WRITTEN' && !/^[0-9a-f]{64}$/u.test(reportSha256 ?? '')) ||
    (state === 'INCONCLUSIVE' && reportSha256 !== null && !/^[0-9a-f]{64}$/u.test(reportSha256))
  ) {
    throw new AgentMcpProfileClaimError(
      'PROFILE_TERMINAL_INVALID',
      'Invalid terminal profile disposition.',
    );
  }
  const suffix = reportSha256 ? ` sha256=${reportSha256}` : ' no-report';
  const description = `Run95 ${profile.frontierId} ${state}${suffix}`;
  if (description.length > 100) {
    throw new AgentMcpProfileClaimError(
      'PROFILE_TERMINAL_INVALID',
      'Terminal profile label description is too long.',
    );
  }
  return description;
}

export function acquireAgentMcpProfileGitHubLatch(gh, profile) {
  if (typeof gh !== 'function') {
    throw new AgentMcpProfileClaimError(
      'PROFILE_LATCH_INVALID',
      'A GitHub API adapter is required.',
    );
  }
  const registered = profile && getAgentMcpProfile(profile.toolName, profile.argumentProfile);
  if (!registered || registered.id !== profile.id) {
    throw new AgentMcpProfileClaimError('PROFILE_NOT_REGISTERED', 'Unknown one-shot profile.');
  }
  const name = registered.claimLabelName;
  const description = agentMcpProfileClaimLabelDescription(registered);
  let created;
  try {
    created = JSON.parse(
      gh('api', 'repos/{owner}/{repo}/labels', '--method', 'POST', '--input', '-', {
        input: JSON.stringify({ name, color: 'b60205', description }),
      }),
    );
  } catch {
    let existing;
    try {
      existing = JSON.parse(gh(`api`, `repos/{owner}/{repo}/labels/${encodeURIComponent(name)}`));
    } catch {
      throw new AgentMcpProfileClaimError(
        'PROFILE_LATCH_UNCERTAIN',
        'Unable to determine whether the global one-shot profile latch was acquired; fail closed.',
      );
    }
    if (existing?.name === name && existing?.description === description) {
      throw new AgentMcpProfileClaimError(
        'PROFILE_ALREADY_CLAIMED',
        'The repository-scoped one-shot profile latch already exists; refusing another claim.',
      );
    }
    throw new AgentMcpProfileClaimError(
      'PROFILE_LATCH_CONFLICT',
      'The profile latch exists with unexpected metadata; fail closed.',
    );
  }
  if (created?.name !== name || created?.description !== description) {
    throw new AgentMcpProfileClaimError(
      'PROFILE_LATCH_UNCERTAIN',
      'GitHub did not confirm the expected profile latch; fail closed.',
    );
  }
  return true;
}

export function acquireAgentMcpProfileTerminalGitHubLatch(gh, profile, state, reportSha256 = null) {
  if (typeof gh !== 'function') {
    throw new AgentMcpProfileClaimError(
      'PROFILE_LATCH_INVALID',
      'A GitHub API adapter is required.',
    );
  }
  const name = agentMcpProfileTerminalLabelName(profile);
  const description = agentMcpProfileTerminalLabelDescription(profile, state, reportSha256);
  try {
    const created = JSON.parse(
      gh('api', 'repos/{owner}/{repo}/labels', '--method', 'POST', '--input', '-', {
        input: JSON.stringify({ name, color: '0e8a16', description }),
      }),
    );
    if (created?.name !== name || created?.description !== description) {
      throw new AgentMcpProfileClaimError(
        'PROFILE_TERMINAL_LATCH_UNCERTAIN',
        'GitHub did not confirm the exact terminal profile latch; fail closed.',
      );
    }
    return { created: true, name, description };
  } catch (error) {
    if (error instanceof AgentMcpProfileClaimError) throw error;
    let existing;
    try {
      existing = JSON.parse(gh('api', `repos/{owner}/{repo}/labels/${encodeURIComponent(name)}`));
    } catch {
      throw new AgentMcpProfileClaimError(
        'PROFILE_TERMINAL_LATCH_UNCERTAIN',
        'Unable to determine whether the terminal profile latch was acquired; fail closed.',
      );
    }
    if (existing?.name === name && existing?.description === description) {
      return { created: false, name, description };
    }
    throw new AgentMcpProfileClaimError(
      'PROFILE_TERMINAL_LATCH_CONFLICT',
      'A different terminal profile disposition is already permanent.',
    );
  }
}

export function claimAgentMcpProfileAtomically({
  claim,
  assertReady,
  acquireGlobalLatch,
  persistClaim,
  readClaim,
  verifyClaim,
}) {
  if (
    !claim ||
    typeof assertReady !== 'function' ||
    typeof acquireGlobalLatch !== 'function' ||
    typeof persistClaim !== 'function' ||
    typeof readClaim !== 'function' ||
    typeof verifyClaim !== 'function'
  ) {
    throw new AgentMcpProfileClaimError(
      'PROFILE_CLAIM_INVALID',
      'Profile claim requires readiness, atomic latch, persistence, readback, and verification adapters.',
    );
  }
  assertReady();
  if (acquireGlobalLatch(claim) !== true) {
    throw new AgentMcpProfileClaimError(
      'PROFILE_ALREADY_CLAIMED',
      'A concurrent profile invocation already owns the permanent one-shot latch.',
    );
  }
  assertReady();
  persistClaim(claim);
  const observed = readClaim();
  if (!verifyClaim(observed, claim)) {
    throw new AgentMcpProfileClaimError(
      'PROFILE_CLAIM_READBACK_MISMATCH',
      'Durable profile claim readback did not match the latched claim.',
    );
  }
  return observed;
}
