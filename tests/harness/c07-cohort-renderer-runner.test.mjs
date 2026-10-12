import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  assertC07EpochIdentity,
  buildCodexExecArgs,
  buildReport,
  verifyObservation,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-c07-cohort-renderer-codex-agent-mcp.mjs';
import {
  C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE,
  C07_COHORT_RENDER_EXPECTED_ARGUMENTS,
} from '../../scripts/lib/c07-cohort-render-offline-fixture.mjs';
import { canonicalJson } from '../../scripts/lib/codex-one-tool-evidence.mjs';

const TARGET_TOOL = 'bangumi.render_subject_cohort_comparison';
const SERVER_ID = 'bgk_c07_cohort_renderer_one_tool';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function fixtureObservation() {
  const catalogBytes = readFileSync('docs/tool-catalog.json');
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((item) => item.name === TARGET_TOOL);
  const argumentsSha256 = sha256(canonicalJson(C07_COHORT_RENDER_EXPECTED_ARGUMENTS));
  const artifact = {
    returned: true,
    persisted: false,
    mimeType: 'image/png',
    width: 720,
    height: 1240,
    byteLength: 180_000,
    sha256: 'c'.repeat(64),
    pngSignatureValid: true,
    decoded: true,
    dimensionsMatch: true,
    nonblankPixelSignalVerified: true,
  };
  const serverSummary = {
    serverProfile: 'one-tool-anonymous-public-v1',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
    catalogSha256: sha256(catalogBytes),
    toolName: TARGET_TOOL,
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
    serverToolNames: [TARGET_TOOL],
    serverToolCount: 1,
    expectedArgumentsSha256: argumentsSha256,
    argumentMatch: true,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    offlineFixture: {
      profile: C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE,
      requestCount: 4,
      searchRequestCount: 2,
      detailRequestCount: 2,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
    },
    result: { resultState: 'artifact_returned', artifact },
    privacy: {
      authProfile: 'anonymous',
      oauthAttempted: false,
      accountDataRead: false,
      writesAttempted: false,
      qqPipelineTested: false,
      timClientTested: false,
      promptStored: false,
      answerStored: false,
      rawResultStored: false,
      artifactImageBytesStored: false,
      credentialsStored: false,
    },
  };
  const call = {
    tool: TARGET_TOOL,
    server: SERVER_ID,
    status: 'completed',
    arguments: C07_COHORT_RENDER_EXPECTED_ARGUMENTS,
    result: { content: [{ type: 'text', text: 'fixture artifact reference' }] },
  };
  const eventsSummary = {
    eventStreamComplete: true,
    codexErrorItemCount: 0,
    codexMcpToolEventCount: 1,
    mcpServerNames: [SERVER_ID],
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    toolCalls: [
      { name: TARGET_TOOL, arguments: C07_COHORT_RENDER_EXPECTED_ARGUMENTS, state: 'DONE' },
    ],
    completedMcpCalls: [call],
    answer: '合成对照图卡已生成。',
  };
  return {
    execution: { exitCode: 0, failed: false },
    parsed: { parsed: true },
    eventsSummary,
    serverSummary,
    sourceRevision: serverSummary.sourceRevision,
    bundleSha256: serverSummary.bundleSha256,
    candidateStable: true,
    gate: {
      runNumber: 95,
      epochId: 'run95-c07-cohort-comparison-renderer-luna-mcp',
      prNumber: 140,
      candidateSha: serverSummary.sourceRevision,
      baseSha: 'd'.repeat(40),
      reviewerId: 'gpt-6-luna-max-run95-c07-round1',
      ciCheckCount: 7,
    },
    artifact,
  };
}

test('C07 runner accepts only the already governed Run #95 invocation', () => {
  assert.equal(validateRunnerArgs(['--run', '95']), 'run');
  assert.equal(validateRunnerArgs(['--help']), 'help');
  assert.throws(() => validateRunnerArgs(['--run', '94']));
  assert.throws(() => validateRunnerArgs(['--run', '95', '--force']));
});

test('C07 gate binds the active Harness epoch identity and PR #140', () => {
  const valid = {
    run: { state: 'EPOCH_ACTIVE', active_epoch_pr: 140 },
    epoch: {
      epoch_id: 'run95-c07-cohort-comparison-renderer-luna-mcp',
      pr_number: 140,
    },
    epochNumber: 140,
  };
  assert.deepEqual(assertC07EpochIdentity(valid), {
    epochId: 'run95-c07-cohort-comparison-renderer-luna-mcp',
    prNumber: 140,
  });
  assert.throws(() =>
    assertC07EpochIdentity({ ...valid, epoch: { ...valid.epoch, epoch_id: 'other-epoch' } }),
  );
  assert.throws(() =>
    assertC07EpochIdentity({ ...valid, epoch: { ...valid.epoch, pr_number: 150 } }),
  );
  assert.throws(() => assertC07EpochIdentity({ ...valid, epochNumber: 150 }));
  assert.throws(() =>
    assertC07EpochIdentity({ ...valid, run: { ...valid.run, active_epoch_pr: 150 } }),
  );
});

test('C07 Codex config uses Luna Max and exposes only the fixed offline renderer', () => {
  const args = buildCodexExecArgs({
    root: '/repo',
    nodePath: '/node',
    serverScript: '/repo/apps/mcp/codex-one-tool-mcp-server.mjs',
    summaryPath: '/tmp/server-summary.json',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  assert.deepEqual(args.slice(0, 7), [
    'exec',
    '--ignore-user-config',
    '--strict-config',
    '--ephemeral',
    '--json',
    '--model',
    'gpt-6-luna',
  ]);
  assert.ok(args.includes('--sandbox'));
  assert.ok(args.includes('read-only'));
  assert.ok(args.includes('model_reasoning_effort="max"'));
  assert.ok(
    args.includes(
      `mcp_servers.bgk_c07_cohort_renderer_one_tool.enabled_tools=["bangumi.render_subject_cohort_comparison"]`,
    ),
  );
  assert.ok(
    args.includes(
      `mcp_servers.bgk_c07_cohort_renderer_one_tool.default_tools_approval_mode="auto"`,
    ),
  );
  const serverArgumentIndex = args.findIndex(
    (item, index) =>
      item === '--config' &&
      args[index + 1]?.includes('mcp_servers.bgk_c07_cohort_renderer_one_tool.args='),
  );
  assert.notEqual(serverArgumentIndex, -1);
  const encodedArgs = args[serverArgumentIndex + 1];
  assert.ok(encodedArgs.includes(C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE));
  assert.ok(encodedArgs.includes('run95 synthetic cohort a'));
  assert.ok(encodedArgs.includes('run95 synthetic cohort b'));
  assert.equal(
    args.some((item) => item === 'sol' || item.includes('gpt-6-sol')),
    false,
  );
});

test('C07 observation validator accepts only one exact offline fixture renderer call', () => {
  const observation = fixtureObservation();
  const accepted = verifyObservation(observation);
  assert.equal(accepted.passed, true);
  assert.ok(Object.values(accepted.checks).every(Boolean));

  const duplicate = structuredClone(observation);
  duplicate.eventsSummary.codexMcpToolEventCount = 2;
  duplicate.eventsSummary.toolCalls.push(duplicate.eventsSummary.toolCalls[0]);
  duplicate.eventsSummary.completedMcpCalls.push(duplicate.eventsSummary.completedMcpCalls[0]);
  assert.equal(verifyObservation(duplicate).checks.exactModelAndEvent, false);

  const unexpectedTool = structuredClone(observation);
  unexpectedTool.eventsSummary.toolCalls[0].name = 'bangumi.compare_subject_cohorts';
  assert.equal(verifyObservation(unexpectedTool).checks.exactModelAndEvent, false);

  const malformedStream = structuredClone(observation);
  malformedStream.parsed.parsed = false;
  assert.equal(verifyObservation(malformedStream).checks.completeCodexStream, false);

  const unsafeArtifact = structuredClone(observation);
  unsafeArtifact.serverSummary.result.artifact.byteLength = 6_000_000;
  assert.equal(verifyObservation(unsafeArtifact).checks.artifactReturned, false);

  const undecodableArtifact = structuredClone(observation);
  undecodableArtifact.serverSummary.result.artifact.decoded = false;
  assert.equal(verifyObservation(undecodableArtifact).checks.artifactReturned, false);

  const blankArtifact = structuredClone(observation);
  blankArtifact.serverSummary.result.artifact.nonblankPixelSignalVerified = false;
  assert.equal(verifyObservation(blankArtifact).checks.artifactReturned, false);

  const networkAttempt = structuredClone(observation);
  networkAttempt.serverSummary.offlineFixture.unexpectedRequestCount = 1;
  assert.equal(verifyObservation(networkAttempt).checks.offlineFixtureOnly, false);

  const credential = structuredClone(observation);
  credential.serverSummary.privacy.oauthAttempted = true;
  assert.equal(verifyObservation(credential).checks.privacy, false);
});

test('C07 sanitized report retains only artifact facts and evidence booleans', () => {
  const observation = fixtureObservation();
  const verified = verifyObservation(observation);
  const report = buildReport({
    sourceRevision: observation.sourceRevision,
    bundleSha256: observation.bundleSha256,
    codexCliVersion: '1.2.3',
    gate: observation.gate,
    serverSummary: observation.serverSummary,
    observation: verified,
  });
  const serialized = JSON.stringify(report);
  assert.equal(report.scenarios[0].passed, true);
  assert.equal(report.candidateGate.ciCheckCount, 7);
  assert.equal(serialized.includes('Synthetic Cohort'), false);
  assert.equal(serialized.includes('run95 synthetic cohort'), false);
  assert.equal(serialized.includes('fixture artifact reference'), false);
  assert.equal(serialized.includes('合成对照图卡已生成'), false);
  assert.equal(report.privacy.rawResultStored, false);
  assert.equal(report.privacy.artifactImageBytesStored, false);
  assert.equal(report.scenarios[0].result.artifact.persisted, false);
  assert.equal(report.epochId, 'run95-c07-cohort-comparison-renderer-luna-mcp');
  assert.equal(report.prNumber, 140);
  assert.throws(() =>
    buildReport({
      sourceRevision: observation.sourceRevision,
      bundleSha256: observation.bundleSha256,
      codexCliVersion: '1.2.3',
      gate: { ...observation.gate, epochId: 'another-epoch' },
      serverSummary: observation.serverSummary,
      observation: verified,
    }),
  );
  assert.throws(() =>
    buildReport({
      sourceRevision: observation.sourceRevision,
      bundleSha256: observation.bundleSha256,
      codexCliVersion: '1.2.3',
      gate: { ...observation.gate, prNumber: 150 },
      serverSummary: observation.serverSummary,
      observation: verified,
    }),
  );
});
