import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R04_RENDER_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS,
  R04_RENDER_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
  R04_RENDER_SERIES_WATCH_ORDER_V2_PROFILE_ID,
} from '../../scripts/lib/r04-render-series-watch-order-offline-v2-fixture.mjs';
import {
  buildR04RenderV2CodexExecArgs,
  exactR04RenderV2TextReadback,
  validateR04RenderV2RunnerArgs,
  validateR04RenderV2ServerSummary,
} from '../../scripts/acceptance/run-r04-render-series-watch-order-offline-agent-mcp-v2.mjs';
import { agentMcpProfileArgumentsSha256 } from '../../scripts/lib/agent-mcp-profile-claims.mjs';

const PROFILE = getAgentMcpProfileById(R04_RENDER_SERIES_WATCH_ORDER_V2_PROFILE_ID);
const SOURCE_SHA = 'a'.repeat(40);
const BUNDLE_SHA = 'b'.repeat(64);
const SERVER_ID = 'bgk_r04_render_watch_order_v2';

function resultSummary() {
  return {
    resultState: 'artifact_returned',
    artifact: {
      returned: true,
      persisted: true,
      mimeType: 'image/png',
      width: 360,
      height: 272,
      byteLength: 4096,
      sha256: 'c'.repeat(64),
      pngSignatureValid: true,
      decoded: true,
      dimensionsMatch: true,
    },
  };
}

function serverSummary() {
  return {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: R04_RENDER_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    catalogSha256: 'd'.repeat(64),
    toolName: PROFILE.toolName,
    toolDescriptionSha256: 'e'.repeat(64),
    inputSchemaSha256: 'f'.repeat(64),
    serverToolNames: [PROFILE.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary: resultSummary() }],
    offlineFixture: {
      profile: R04_RENDER_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
      requestCount: 2,
      subjectRequestCount: 1,
      relationsRequestCount: 1,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
    },
    rendererAssetBoundary: { requestCount: 0 },
  };
}

test('R04 render Codex config approves only exact enabled tools without deprecated feature keys', () => {
  assert.equal(validateR04RenderV2RunnerArgs(['--help']), 'help');
  assert.equal(validateR04RenderV2RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateR04RenderV2RunnerArgs(['--run', '94']));
  const args = buildR04RenderV2CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/r04-render-summary.json',
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
  });
  for (const flag of ['--ignore-user-config', '--strict-config', '--ephemeral', '--json']) {
    assert.ok(args.includes(flag), `missing ${flag}`);
  }
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(args.includes('--approve-for-me'), false);
  assert.equal(args.includes('--dangerously-bypass-approvals-and-sandbox'), false);
  assert.equal(
    args.some((arg) => /features\.web_search(?:_cached|_request)?=/u.test(arg)),
    false,
  );
  assert.ok(args.includes('features.shell_tool=false'));
  assert.ok(args.includes('features.browser_use=false'));
  assert.ok(
    args.includes(
      'mcp_servers.bgk_r04_render_watch_order_v2.default_tools_approval_mode="approve"',
    ),
  );
  assert.ok(args.includes(`mcp_servers.${SERVER_ID}.enabled_tools=["${PROFILE.toolName}"]`));
  assert.equal(
    args.some((setting) => setting.includes(`mcp_servers.${SERVER_ID}.tools.`)),
    false,
  );
  assert.ok(
    args.at(-1).includes(JSON.stringify(R04_RENDER_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS)),
  );
});

test('R04 renderer result can be read back from sanitized JSON text alone', () => {
  const expected = resultSummary();
  const textOnly = { content: [{ type: 'text', text: JSON.stringify(expected) }] };
  assert.equal(exactR04RenderV2TextReadback(textOnly, expected), true);
  assert.equal(
    exactR04RenderV2TextReadback({ ...textOnly, structuredContent: expected }, expected),
    true,
  );
  assert.equal(
    exactR04RenderV2TextReadback({ ...textOnly, structuredContent: {} }, expected),
    false,
  );
  assert.equal(
    exactR04RenderV2TextReadback({ content: [{ type: 'text', text: 'not json' }] }, expected),
    false,
  );
  assert.equal(exactR04RenderV2TextReadback({ ...textOnly, isError: true }, expected), false);
  assert.equal(
    exactR04RenderV2TextReadback({ content: [...textOnly.content, ...textOnly.content] }, expected),
    false,
  );
});

test('R04 render server summary requires two local requests and a verified artifact', () => {
  const summary = serverSummary();
  assert.equal(validateR04RenderV2ServerSummary(summary, SOURCE_SHA, BUNDLE_SHA), true);
  assert.equal(
    validateR04RenderV2ServerSummary(
      {
        ...summary,
        offlineFixture: { ...summary.offlineFixture, requestCount: 3 },
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  assert.equal(
    validateR04RenderV2ServerSummary(
      {
        ...summary,
        rendererAssetBoundary: { requestCount: 1 },
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  assert.equal(
    validateR04RenderV2ServerSummary(
      {
        ...summary,
        results: [
          {
            ...summary.results[0],
            resultSummary: {
              ...resultSummary(),
              artifact: { ...resultSummary().artifact, pngSignatureValid: false },
            },
          },
        ],
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
});
