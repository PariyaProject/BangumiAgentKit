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
  return `Run 95 ${profile.frontierId} profile ${profile.id}; permanent one-shot latch.`;
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
