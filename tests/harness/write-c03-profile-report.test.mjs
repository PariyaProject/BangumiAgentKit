import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { buildC03ObservedComparison } from '../../scripts/lib/c03-profile-evidence.mjs';
import {
  buildC03RunnerReceiptPayload,
  createC03RunnerReceipt,
  projectC03ProfileActors,
  validateC03ProfileReport,
} from '../../scripts/acceptance/write-c03-profile-report.mjs';

const profile = getAgentMcpProfileById('c03-voice-actor-comparison-v1');
const hash = (value) => createHash('sha256').update(value).digest('hex');

function fixture() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const candidate = 'a'.repeat(40);
  const base = 'b'.repeat(40);
  const bundle = 'c'.repeat(64);
  const claim = {
    claimId: `profile-run-95-pr-161-${candidate.slice(0, 12)}-1700000000000`,
    profileId: profile.id,
    frontierId: profile.frontierId,
    epochId: profile.epochId,
    runNumber: 95,
    prNumber: 161,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    registrySha256: agentMcpProfileRegistrySha256(),
    sourceCandidateSha: candidate,
    baseSha: base,
    ciSha: candidate,
    ciStatus: 'SUCCESS',
    reviewerId: 'gpt-6-luna-max-run95-pr161-round1',
    bundleSha256: bundle,
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: hash(Buffer.from(publicKeyBase64, 'base64')),
    retryAllowed: false,
  };
  const actors = [
    {
      personId: profile.calls[0].arguments.personId,
      state: 'partial',
      window: {
        months: 36,
        start: '2023-11-01',
        end: '2026-10-14',
        asOfSemantics: 'calendar_months_ending_on_as_of_date',
      },
      uniqueSubjects: 4,
      roleCounts: { main: 2, support: 1, unknown: 1 },
      observedRows: [
        { subjectId: 10, roleFamily: 'main' },
        { subjectId: 20, roleFamily: 'support' },
      ],
      coverage: {
        relationRowsObserved: 12,
        relationRowsSelected: 8,
        relationRowsDroppedAtLimit: 4,
        subjectDetailsSucceeded: 8,
        subjectDetailsFailed: 0,
        rowsEligible: 4,
        rowsReturned: 2,
        outputTruncated: false,
        unknownRoleRows: 1,
        truncated: true,
      },
    },
    {
      personId: profile.calls[1].arguments.personId,
      state: 'partial',
      window: {
        months: 36,
        start: '2023-11-01',
        end: '2026-10-14',
        asOfSemantics: 'calendar_months_ending_on_as_of_date',
      },
      uniqueSubjects: 4,
      roleCounts: { main: 1, support: 2, unknown: 1 },
      observedRows: [
        { subjectId: 20, roleFamily: 'main' },
        { subjectId: 30, roleFamily: 'unknown' },
      ],
      coverage: {
        relationRowsObserved: 10,
        relationRowsSelected: 8,
        relationRowsDroppedAtLimit: 2,
        subjectDetailsSucceeded: 8,
        subjectDetailsFailed: 0,
        rowsEligible: 4,
        rowsReturned: 2,
        outputTruncated: false,
        unknownRoleRows: 1,
        truncated: true,
      },
    },
  ];
  const report = {
    schemaVersion: 1,
    evidenceKind: profile.evidenceKind,
    runNumber: 95,
    frontierId: profile.frontierId,
    scenarioId: 'C03',
    epochId: profile.epochId,
    profileId: profile.id,
    profile: 'codex-luna-max-agent-mcp-profile-v1',
    model: profile.model,
    reasoningEffort: profile.reasoningEffort,
    reviewerId: claim.reviewerId,
    codexCliVersion: '1.2.14',
    sourceRevision: candidate,
    baseSha: base,
    ciSha: candidate,
    ciStatus: 'SUCCESS',
    prNumber: 161,
    claimId: claim.claimId,
    mcpBundleSha256: bundle,
    registrySha256: agentMcpProfileRegistrySha256(),
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    catalogSha256: 'd'.repeat(64),
    toolDescriptionSha256: 'e'.repeat(64),
    inputSchemaSha256: 'f'.repeat(64),
    serverToolNames: [profile.toolName],
    serverToolCount: 1,
    mcpServerNames: ['bgk_c03_profile'],
    processExitCode: 0,
    resultStatus: 'SUCCESS',
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 2,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    allowedCallCount: 2,
    deniedCallCount: 0,
    answerCheckMethod: profile.answerCheckMethod,
    answerSha256: '1'.repeat(64),
    answerUtf8Bytes: 512,
    answerChecks: {
      exactBoundedSubjectOverlap: true,
      exactObservedMainRoleShares: true,
      partialCoverageDisclosed: true,
      omittedWorksNotClaimedAbsent: true,
      noCareerCompletenessClaim: true,
    },
    actors,
    comparison: buildC03ObservedComparison(actors),
    privacy: {
      authProfile: false,
      oauthAttempted: false,
      accountDataRead: false,
      writesAttempted: false,
      communityRead: false,
      qqPipelineTested: false,
      timClientTested: false,
      promptStored: false,
      answerStored: false,
      rawResultStored: false,
      credentialsStored: false,
    },
    runnerReceipt: null,
  };
  const payload = buildC03RunnerReceiptPayload(report, {
    eventStreamSha256: '2'.repeat(64),
    serverSummarySha256: '3'.repeat(64),
  });
  report.runnerReceipt = createC03RunnerReceipt(payload, { publicKeyBase64, privateKey });
  return { claim, report };
}

test('C03 report projection carries missing counters through as partial coverage', () => {
  const results = profile.calls.map((call, index) => ({
    resultSummary: {
      personId: call.arguments.personId,
      state: 'complete',
      window: {
        months: 36,
        start: '2023-11-01',
        end: '2026-10-14',
        asOfSemantics: 'calendar_months_ending_on_as_of_date',
      },
      summary: {
        uniqueSubjects: 1,
        byRole: [{ key: 'main', creditRows: 1, uniqueSubjects: 1 }],
      },
      coverage: {
        relationRowsObserved: 1,
        relationRowsSelected: index === 0 ? null : 1,
        relationRowsDroppedAtLimit: 0,
        subjectDetailsSucceeded: 1,
        subjectDetailsFailed: 0,
        rowsEligible: 1,
        rowsReturned: 1,
        outputTruncated: index === 0 ? null : false,
        staffRoleUnknownRows: 0,
        truncated: false,
      },
      observedRows: [{ subjectId: 10 + index, roleFamily: 'main' }],
    },
  }));
  const actors = projectC03ProfileActors({ results });
  assert.equal(actors[0].coverage.relationRowsSelected, null);
  assert.equal(actors[0].coverage.outputTruncated, null);
  assert.equal(buildC03ObservedComparison(actors).coveragePartial, true);
});

test('C03 report requires exact claim, bounded actors, role math, privacy, and signed receipt', () => {
  const { claim, report } = fixture();
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  const checked = validateC03ProfileReport(report, claim, bytes);
  assert.equal(checked.passed, true, checked.reason);
  assert.equal(checked.reportSha256, hash(bytes));

  const titleLeak = structuredClone(report);
  titleLeak.actors[0].subjectName = 'must not persist';
  assert.equal(
    validateC03ProfileReport(titleLeak, claim, Buffer.from(JSON.stringify(titleLeak))).passed,
    false,
  );

  const inventedOverlap = structuredClone(report);
  inventedOverlap.comparison.sharedSubjectIds = [];
  assert.equal(
    validateC03ProfileReport(inventedOverlap, claim, Buffer.from(JSON.stringify(inventedOverlap)))
      .passed,
    false,
  );

  const badSignature = structuredClone(report);
  badSignature.runnerReceipt.signature = Buffer.from('bad signature').toString('base64');
  assert.equal(
    validateC03ProfileReport(badSignature, claim, Buffer.from(JSON.stringify(badSignature))).passed,
    false,
  );

  const untrustedWindow = structuredClone(report);
  untrustedWindow.actors[0].window.asOfSemantics = 'untrusted source text';
  assert.equal(
    validateC03ProfileReport(untrustedWindow, claim, Buffer.from(JSON.stringify(untrustedWindow)))
      .passed,
    false,
  );

  const impossibleWindow = structuredClone(report);
  impossibleWindow.actors[0].window.end = '2026-02-30';
  assert.equal(
    validateC03ProfileReport(impossibleWindow, claim, Buffer.from(JSON.stringify(impossibleWindow)))
      .passed,
    false,
  );

  const incorrectWindowLength = structuredClone(report);
  incorrectWindowLength.actors[0].window.start = '2023-12-01';
  incorrectWindowLength.actors[1].window.start = '2023-12-01';
  assert.equal(
    validateC03ProfileReport(
      incorrectWindowLength,
      claim,
      Buffer.from(JSON.stringify(incorrectWindowLength)),
    ).passed,
    false,
  );

  const wrongClaim = { ...claim, sourceCandidateSha: '9'.repeat(40) };
  assert.equal(validateC03ProfileReport(report, wrongClaim, bytes).passed, false);
});
