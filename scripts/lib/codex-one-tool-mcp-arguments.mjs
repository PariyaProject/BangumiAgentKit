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
    let registeredNetworkMode;
    if (profile.networkMode !== undefined) {
      const approved =
        assertP06RenderPersonProfileOfflineProfile(profile) ||
        assertP02PersonProfileOfflineProfile(profile) ||
        assertR04SeriesWatchOrderOfflineProfile(profile);
      if (!approved) {
        throw new Error('Registered profile network mode is not supported.');
      }
      registeredNetworkMode = profile.networkMode;
    }
    return {
      profile,
      toolName: profile.toolName,
      expectedArgumentSequence: profile.calls.map((call) => call.arguments),
      expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
      summaryPath,
      candidateSha,
      bundleSha256,
      networkMode: registeredNetworkMode,
    };
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
