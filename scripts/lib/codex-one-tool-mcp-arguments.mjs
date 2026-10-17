import { createHash } from 'node:crypto';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';
import { assertC07CohortRenderOfflineProfile } from './c07-cohort-render-offline-fixture.mjs';
import { canonicalJson } from './codex-one-tool-evidence.mjs';
import { assertP06RenderPersonProfileOfflineProfile } from './p06-render-person-profile-offline-fixture.mjs';
import { assertP02PersonProfileOfflineProfile } from './p02-person-profile-offline-fixture.mjs';
import { assertR04SeriesWatchOrderOfflineProfile } from './r04-series-watch-order-offline-fixture.mjs';
import { assertR01RelationsOfflineProfile } from './r01-relations-offline-profile.mjs';
import {
  assertC04CohortComparisonPublicProfile,
  C04_COHORT_COMPARISON_PROFILE_ID,
} from './c04-cohort-comparison-public-profile.mjs';
import { assertR02PositiveDirectRelationsProfile } from './r02-positive-direct-relations-profile.mjs';
import { assertA01RenderCohortAggregationOfflineProfile } from './a01-render-cohort-aggregation-offline-fixture.mjs';
import { assertR04RenderSeriesWatchOrderOfflineProfile } from './r04-render-series-watch-order-offline-fixture.mjs';
import { assertTitleQueryRenderPublicProfile } from './title-query-render-agent-mcp-profile.mjs';
import { assertA01RatingDispersionProfile } from './a01-rating-dispersion-profile.mjs';

export function parseCodexOneToolMcpArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (
      ![
        '--tool',
        '--arguments-json',
        '--profile-id',
        '--summary-file',
        '--candidate-sha',
        '--bundle-sha256',
        '--network-mode',
        '--profile-call-index',
      ].includes(key)
    ) {
      throw new Error(`Unknown argument: ${key}`);
    }
    if (values.has(key) || index + 1 >= argv.length) throw new Error(`Invalid ${key} argument.`);
    values.set(key, argv[index + 1]);
    index += 1;
  }
  const toolName = values.get('--tool');
  const encodedArguments = values.get('--arguments-json');
  const profileId = values.get('--profile-id');
  const summaryPath = values.get('--summary-file');
  const candidateSha = values.get('--candidate-sha');
  const bundleSha256 = values.get('--bundle-sha256');
  const networkMode = values.get('--network-mode');
  const profileCallIndexValue = values.get('--profile-call-index');
  if (!summaryPath || !candidateSha || !bundleSha256) {
    throw new Error('--summary-file, --candidate-sha, and --bundle-sha256 are required.');
  }
  if (!/^[0-9a-f]{40}$/u.test(candidateSha) || !/^[0-9a-f]{64}$/u.test(bundleSha256)) {
    throw new Error('Exact Candidate and built MCP bundle hashes are required.');
  }
  if (profileId) {
    if (toolName || encodedArguments || networkMode) {
      throw new Error(
        'A registered profile cannot be combined with arbitrary tool, arguments, or network mode.',
      );
    }
    const profile = getAgentMcpProfileById(profileId);
    if (!profile) throw new Error('Unknown closed Agent/MCP profile id.');
    if (profile.id === C04_COHORT_COMPARISON_PROFILE_ID) {
      if (!/^(0|1)$/u.test(profileCallIndexValue ?? '')) {
        throw new Error('C04 requires a profile-call-index of 0 or 1 for a separate one-tool run.');
      }
      const profileCallIndex = Number(profileCallIndexValue);
      const call = profile.calls[profileCallIndex];
      if (!call) throw new Error('C04 profile-call-index is outside the registered calls.');
      let registeredNetworkMode;
      if (!assertC04CohortComparisonPublicProfile(profile)) {
        throw new Error('Registered C04 profile does not match its fixed public contract.');
      }
      registeredNetworkMode = profile.networkMode;
      return {
        profile,
        profileCallIndex,
        toolName: call.toolName,
        toolNames: [call.toolName],
        expectedToolSequence: [call.toolName],
        expectedArgumentSequence: [call.arguments],
        expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
        summaryPath,
        candidateSha,
        bundleSha256,
        networkMode: registeredNetworkMode,
      };
    }
    if (profileCallIndexValue !== undefined) {
      throw new Error('--profile-call-index is reserved for the registered C04 profile.');
    }
    let registeredNetworkMode;
    if (profile.networkMode !== undefined) {
      const approved =
        assertC04CohortComparisonPublicProfile(profile) ||
        assertTitleQueryRenderPublicProfile(profile) ||
        assertP06RenderPersonProfileOfflineProfile(profile) ||
        assertP02PersonProfileOfflineProfile(profile) ||
        assertR04SeriesWatchOrderOfflineProfile(profile) ||
        assertR01RelationsOfflineProfile(profile) ||
        assertR02PositiveDirectRelationsProfile(profile) ||
        assertA01RatingDispersionProfile(profile) ||
        assertA01RenderCohortAggregationOfflineProfile(profile) ||
        assertR04RenderSeriesWatchOrderOfflineProfile(profile);
      if (!approved) {
        throw new Error('Registered profile network mode is not supported.');
      }
      registeredNetworkMode = profile.networkMode;
    }
    return {
      profile,
      toolName: profile.toolName,
      toolNames: profile.toolNames ?? [profile.toolName],
      expectedToolSequence: profile.calls.map((call) => call.toolName),
      expectedArgumentSequence: profile.calls.map((call) => call.arguments),
      expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
      summaryPath,
      candidateSha,
      bundleSha256,
      networkMode: registeredNetworkMode,
    };
  }

  if (profileCallIndexValue !== undefined) {
    throw new Error('--profile-call-index is reserved for the registered C04 profile.');
  }
  if (!toolName || !/^bangumi\.[a-z][a-z0-9_]*$/u.test(toolName)) {
    throw new Error('A single exact Bangumi tool name is required.');
  }
  if (!encodedArguments) {
    throw new Error('--arguments-json is required for the fixed single-query profile.');
  }
  const expectedArguments = JSON.parse(encodedArguments);
  if (
    !expectedArguments ||
    typeof expectedArguments !== 'object' ||
    Array.isArray(expectedArguments)
  ) {
    throw new Error('Fixed arguments must be a JSON object.');
  }
  assertC07CohortRenderOfflineProfile({ networkMode, toolName, expectedArguments });
  return {
    profile: null,
    toolName,
    expectedArguments,
    toolNames: [toolName],
    expectedToolSequence: [toolName],
    expectedArgumentSequence: null,
    expectedArgumentsSha256: createHash('sha256')
      .update(canonicalJson(expectedArguments), 'utf8')
      .digest('hex'),
    summaryPath,
    candidateSha,
    bundleSha256,
    networkMode,
  };
}
