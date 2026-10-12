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
const TEST_EPOCH_ID = 'run95-c07-renderer-dynamic-active-pr';
const TEST_PR_NUMBER = 144;
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
    threadStarted: true,
    turnStarted: true,
    turnCompleted: true,
    turnFailed: false,
    unexpectedEventTypes: 0,
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
    finalMessage: '合成对照图卡已生成。',
    sourceRevision: serverSummary.sourceRevision,
    bundleSha256: serverSummary.bundleSha256,
    candidateStable: true,
    gate: {
      runNumber: 95,
      epochId: TEST_EPOCH_ID,
      prNumber: TEST_PR_NUMBER,
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

test('C07 gate derives and validates the currently active renderer-only Epoch and PR', () => {
  const valid = {
    run: { state: 'EPOCH_ACTIVE', active_epoch_pr: TEST_PR_NUMBER },
    epoch: {
      epoch_id: TEST_EPOCH_ID,
      pr_number: TEST_PR_NUMBER,
      advances_frontier_ids: ['C07'],
      objective: `Recover one renderer-only observation for ${TARGET_TOOL} using only the fixed local synthetic fixture.`,
      work_packages: [
        'Preserve the fixed local fixture profile, synthetic responses, no external data, no account, and no write path.',
      ],
      non_scope: [
        {
          description:
            'Bangumi public HTTP/API requests, OAuth/consent, private user data, community, QQ, TIM, or any write.',
          mapping: {
            reason:
              'This Epoch is limited to an isolated local synthetic fixture with external and account/channel paths excluded.',
          },
        },
      ],
      acceptance_criteria: [
        'The MCP synthetic fixture rejects authorization headers and every unexpected request.',
      ],
    },
    epochNumber: TEST_PR_NUMBER,
  };
  assert.deepEqual(assertC07EpochIdentity(valid), {
    epochId: TEST_EPOCH_ID,
    prNumber: TEST_PR_NUMBER,
  });
  assert.throws(() =>
    assertC07EpochIdentity({
      ...valid,
      epoch: { ...valid.epoch, advances_frontier_ids: ['A01'] },
    }),
  );
  assert.throws(() =>
    assertC07EpochIdentity({
      ...valid,
      epoch: { ...valid.epoch, objective: 'Assess the C07 user-facing comparison answer.' },
    }),
  );
  assert.throws(() =>
    assertC07EpochIdentity({
      ...valid,
      epoch: { ...valid.epoch, work_packages: ['Use the live Bangumi API.'] },
    }),
  );
  assert.throws(() =>
    assertC07EpochIdentity({
      ...valid,
      epoch: {
        ...valid.epoch,
        non_scope: valid.epoch.non_scope.map((entry) => ({
          ...entry,
          description: 'Improve the renderer card with public metadata.',
          mapping: { reason: 'No explicit OAuth, account, community, client, or write exclusion.' },
        })),
      },
    }),
  );
  assert.throws(() => assertC07EpochIdentity({ ...valid, epochNumber: 150 }));
  assert.throws(() =>
    assertC07EpochIdentity({
      ...valid,
      run: { ...valid.run, active_epoch_pr: 150 },
    }),
  );
});

test('C07 Codex config uses Luna Max and exposes only the fixed offline renderer', () => {
  const args = buildCodexExecArgs({
    root: '/repo',
    nodePath: '/node',
    serverScript: '/repo/apps/mcp/codex-one-tool-mcp-server.mjs',
    summaryPath: '/tmp/server-summary.json',
    lastMessagePath: '/tmp/final-message.txt',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  assert.deepEqual(args.slice(0, 9), [
    'exec',
    '--ignore-user-config',
    '--strict-config',
    '--ephemeral',
    '--json',
    '--output-last-message',
    '/tmp/final-message.txt',
    '--model',
    'gpt-6-luna',
  ]);
  assert.ok(args.includes('--sandbox'));
  assert.ok(args.includes('read-only'));
  assert.ok(args.includes('model_reasoning_effort="max"'));
  assert.ok(args.includes('--output-last-message'));
  assert.ok(args.includes('/tmp/final-message.txt'));
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
  assert.ok(
    args
      .at(-1)
      .includes(
        'respond only with this exact plain-text sentence and no quotes or markdown: 合成对照图卡已生成。',
      ),
  );
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
  assert.equal(verifyObservation(malformedStream).checks.codexExecutionCompleted, false);

  const outputFileCompletion = structuredClone(observation);
  outputFileCompletion.eventsSummary.eventStreamComplete = false;
  outputFileCompletion.eventsSummary.turnCompleted = false;
  outputFileCompletion.eventsSummary.answer = null;
  const attested = verifyObservation(outputFileCompletion);
  assert.equal(attested.checks.codexExecutionCompleted, true);
  assert.equal(attested.checks.cliFinalMessageVerified, true);
  assert.equal(attested.eventStreamComplete, false);

  const disqualifiedFallbacks = [
    ['unparsed JSONL', (candidate) => (candidate.parsed.parsed = false)],
    ['Codex error item', (candidate) => (candidate.eventsSummary.codexErrorItemCount = 1)],
    ['failed turn', (candidate) => (candidate.eventsSummary.turnFailed = true)],
    ['unexpected event', (candidate) => (candidate.eventsSummary.unexpectedEventTypes = 1)],
  ];
  for (const [reason, disqualify] of disqualifiedFallbacks) {
    const candidate = structuredClone(outputFileCompletion);
    disqualify(candidate);
    const rejected = verifyObservation(candidate);
    assert.equal(rejected.checks.codexExecutionCompleted, false, reason);
    assert.equal(rejected.passed, false, reason);
    const rejectedReport = buildReport({
      sourceRevision: candidate.sourceRevision,
      bundleSha256: candidate.bundleSha256,
      codexCliVersion: '1.2.3',
      gate: candidate.gate,
      serverSummary: candidate.serverSummary,
      observation: rejected,
    });
    assert.equal(rejectedReport.scenarios[0].passed, false, reason);
    assert.equal(rejectedReport.scenarios[0].answerCheckPassed, false, reason);
  }

  const missingFinalMessage = structuredClone(outputFileCompletion);
  missingFinalMessage.finalMessage = null;
  assert.equal(verifyObservation(missingFinalMessage).checks.codexExecutionCompleted, false);
  assert.equal(verifyObservation(missingFinalMessage).checks.cliFinalMessageVerified, false);

  const mismatchedFinalMessage = structuredClone(outputFileCompletion);
  mismatchedFinalMessage.finalMessage = 'The card contains synthetic cohort names.';
  assert.equal(verifyObservation(mismatchedFinalMessage).checks.cliFinalMessageVerified, false);

  const mismatchedEventAnswer = structuredClone(outputFileCompletion);
  mismatchedEventAnswer.eventsSummary.answer = 'The card contains synthetic cohort names.';
  assert.equal(verifyObservation(mismatchedEventAnswer).checks.cliFinalMessageVerified, false);

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
  assert.equal(report.eventStreamComplete, true);
  assert.equal(report.scenarios[0].answerChecks.cliFinalMessageVerified, true);
  assert.equal(report.candidateGate.ciCheckCount, 7);
  assert.equal(serialized.includes('Synthetic Cohort'), false);
  assert.equal(serialized.includes('run95 synthetic cohort'), false);
  assert.equal(serialized.includes('fixture artifact reference'), false);
  assert.equal(serialized.includes('合成对照图卡已生成'), false);
  assert.equal(report.privacy.rawResultStored, false);
  assert.equal(report.privacy.artifactImageBytesStored, false);
  assert.equal(report.scenarios[0].result.artifact.persisted, false);
  assert.equal(report.epochId, TEST_EPOCH_ID);
  assert.equal(report.prNumber, TEST_PR_NUMBER);
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
  const laterEpochReport = buildReport({
    sourceRevision: observation.sourceRevision,
    bundleSha256: observation.bundleSha256,
    codexCliVersion: '1.2.3',
    gate: { ...observation.gate, epochId: 'run95-c07-renderer-followup', prNumber: 150 },
    serverSummary: observation.serverSummary,
    observation: verified,
  });
  assert.equal(laterEpochReport.epochId, 'run95-c07-renderer-followup');
  assert.equal(laterEpochReport.prNumber, 150);
});
