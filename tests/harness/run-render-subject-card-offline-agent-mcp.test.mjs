import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCandidateReviewGate,
  buildCodexExecArgs,
  hasDurableReviewerId,
  validateRenderSubjectCardOfflineRunnerArgs,
  validateServerSummary,
} from '../../scripts/acceptance/run-render-subject-card-offline-agent-mcp.mjs';
import {
  agentMcpProfileArgumentsSha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V4_ARGUMENTS,
  RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V4_NETWORK_MODE,
  RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V4_PROFILE_ID,
  RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V5_ARGUMENTS,
  RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V5_NETWORK_MODE,
  RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V5_PROFILE_ID,
} from '../../scripts/lib/render-subject-card-offline-profile.mjs';

const PROFILE = getAgentMcpProfileById(RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V4_PROFILE_ID);
const V5_PROFILE = getAgentMcpProfileById(RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V5_PROFILE_ID);

test('runner accepts only the Run 95 invocation and fails closed before an ineligible review', () => {
  assert.equal(validateRenderSubjectCardOfflineRunnerArgs(['--run', '95']), 'run');
  assert.equal(
    validateRenderSubjectCardOfflineRunnerArgs([
      '--run',
      '95',
      '--profile-id',
      RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V5_PROFILE_ID,
    ]),
    'run',
  );
  assert.equal(validateRenderSubjectCardOfflineRunnerArgs(['--help']), 'help');
  assert.throws(() => validateRenderSubjectCardOfflineRunnerArgs(['--run', '94']));
  assert.throws(() =>
    validateRenderSubjectCardOfflineRunnerArgs(['--run', '95', '--profile-id', PROFILE.id]),
  );
  assert.throws(() =>
    assertCandidateReviewGate(
      {},
      {},
      {
        sourceRevision: '0'.repeat(40),
        currentBaseSha: '1'.repeat(40),
        readGit: () => '',
      },
    ),
  );
});

test('profile review gate treats reviewer IDs as opaque stable identities', () => {
  assert.equal(hasDurableReviewerId('/root/pr254_luna_max_review'), true);
  assert.equal(hasDurableReviewerId('gpt-6-luna-max-run95-pr254-round1'), true);
  assert.equal(hasDurableReviewerId(''), false);
  assert.equal(hasDurableReviewerId('  '), false);
  assert.equal(hasDurableReviewerId(null), false);
});

test('Codex invocation is read-only and exposes only the fixed render_subject_card MCP tool', () => {
  const args = buildCodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/bgk-render-summary.json',
    sourceRevision: '0'.repeat(40),
    bundleSha256: '1'.repeat(64),
  });
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
  assert.deepEqual(args.slice(args.indexOf('--sandbox'), args.indexOf('--sandbox') + 2), [
    '--sandbox',
    'read-only',
  ]);
  assert.ok(args.includes('features.shell_tool=false'));
  assert.ok(
    args.includes(
      `mcp_servers.bgk_render_subject_card_offline.enabled_tools=["${PROFILE.toolName}"]`,
    ),
  );
  const serverArgsConfig = args.find((arg) =>
    arg.startsWith('mcp_servers.bgk_render_subject_card_offline.args='),
  );
  assert.ok(serverArgsConfig);
  const serverArgs = JSON.parse(
    serverArgsConfig.slice('mcp_servers.bgk_render_subject_card_offline.args='.length),
  );
  assert.ok(serverArgs.includes(PROFILE.id));
  assert.ok(serverArgs.includes('--summary-file'));
  assert.ok(serverArgs.includes('0'.repeat(40)));
  assert.ok(serverArgs.includes('1'.repeat(64)));
  assert.equal(args.includes('--dangerously-bypass-approvals-and-sandbox'), false);
});

test('v5 Codex invocation selects only the new registered profile and its exact arguments', () => {
  const args = buildCodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/bgk-render-summary-v5.json',
    sourceRevision: '0'.repeat(40),
    bundleSha256: '1'.repeat(64),
    profile: V5_PROFILE,
  });
  const serverArgsConfig = args.find((arg) =>
    arg.startsWith('mcp_servers.bgk_render_subject_card_offline.args='),
  );
  const serverArgs = JSON.parse(
    serverArgsConfig.slice('mcp_servers.bgk_render_subject_card_offline.args='.length),
  );

  assert.ok(serverArgs.includes(RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V5_PROFILE_ID));
  assert.ok(
    args.includes(
      'mcp_servers.bgk_render_subject_card_offline.enabled_tools=["bangumi.render_subject_card"]',
    ),
  );
  assert.ok(
    args.at(-1).includes(JSON.stringify(RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V5_ARGUMENTS)),
  );
  assert.ok(args.at(-1).includes('RENDER_SUBJECT_CARD_SYNTHETIC_ARTIFACT_READY'));
});

test('server summary accepts only one local synthetic PNG with zero assets and no collection request', () => {
  const summary = {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V4_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: '0'.repeat(40),
    bundleSha256: '1'.repeat(64),
    toolName: PROFILE.toolName,
    serverToolCount: 1,
    serverToolNames: [PROFILE.toolName],
    expectedCallCount: 1,
    argumentMatch: true,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [
      {
        sequenceIndex: 0,
        status: 'SUCCESS',
        resultSummary: {
          resultState: 'artifact_returned',
          artifact: {
            returned: true,
            persisted: false,
            mimeType: 'image/png',
            width: 720,
            height: 1576,
            byteLength: 257734,
            sha256: '2'.repeat(64),
            pngSignatureValid: true,
            decoded: true,
            dimensionsMatch: true,
          },
        },
      },
    ],
    offlineFixture: {
      profile: RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V4_NETWORK_MODE,
      expectedOperation: 'GET /v0/subjects/991904',
      requestCount: 1,
      expectedRequestCount: 1,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      collectionRequestCount: 0,
      expectedOperationComplete: true,
      rawFixturePayloadStored: false,
    },
    offlineAssetBoundary: {
      assetResolutionCallCount: 0,
      nonEmptyAssetUrlCount: 0,
      blockedAssetRequestCount: 0,
      localFallbackUsed: true,
    },
  };
  assert.equal(validateServerSummary(summary, '0'.repeat(40), '1'.repeat(64)), true);
  const withCollectionRead = structuredClone(summary);
  withCollectionRead.offlineFixture.collectionRequestCount = 1;
  assert.equal(validateServerSummary(withCollectionRead, '0'.repeat(40), '1'.repeat(64)), false);
  const extraTool = structuredClone(summary);
  extraTool.serverToolNames.push('bangumi.get_user');
  assert.equal(validateServerSummary(extraTool, '0'.repeat(40), '1'.repeat(64)), false);
  const wrongArguments = structuredClone(summary);
  wrongArguments.expectedArgumentsSha256 = canonicalAgentMcpProfileJson([
    RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V4_ARGUMENTS,
  ]);
  assert.equal(validateServerSummary(wrongArguments, '0'.repeat(40), '1'.repeat(64)), false);
});

test('v5 server summary is bound to its own profile, input, and single anonymous request', () => {
  const summary = {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: V5_PROFILE.id,
    argumentProfile: V5_PROFILE.argumentProfile,
    networkMode: RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V5_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(V5_PROFILE),
    sourceRevision: '0'.repeat(40),
    bundleSha256: '1'.repeat(64),
    toolName: V5_PROFILE.toolName,
    serverToolCount: 1,
    serverToolNames: [V5_PROFILE.toolName],
    expectedCallCount: 1,
    argumentMatch: true,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [
      {
        sequenceIndex: 0,
        status: 'SUCCESS',
        resultSummary: {
          resultState: 'artifact_returned',
          artifact: {
            returned: true,
            persisted: false,
            mimeType: 'image/png',
            width: 720,
            height: 1640,
            byteLength: 265000,
            sha256: '2'.repeat(64),
            pngSignatureValid: true,
            decoded: true,
            dimensionsMatch: true,
          },
        },
      },
    ],
    offlineFixture: {
      profile: RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V5_NETWORK_MODE,
      expectedOperation: 'GET /v0/subjects/991905',
      requestCount: 1,
      expectedRequestCount: 1,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      collectionRequestCount: 0,
      expectedOperationComplete: true,
      rawFixturePayloadStored: false,
    },
    offlineAssetBoundary: {
      assetResolutionCallCount: 0,
      nonEmptyAssetUrlCount: 0,
      blockedAssetRequestCount: 0,
      localFallbackUsed: true,
    },
  };

  assert.equal(validateServerSummary(summary, '0'.repeat(40), '1'.repeat(64), V5_PROFILE), true);
  const wrongFixture = structuredClone(summary);
  wrongFixture.offlineFixture.expectedOperation = 'GET /v0/subjects/991904';
  assert.equal(
    validateServerSummary(wrongFixture, '0'.repeat(40), '1'.repeat(64), V5_PROFILE),
    false,
  );
});
