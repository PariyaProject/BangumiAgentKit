import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateD02SanitizedReportFile } from '../../scripts/acceptance/write-d02-agent-mcp-report.mjs';
import { D02_EXPECTED_QUERY_ARGUMENTS } from '../../scripts/acceptance/d02-public-search-answer-check.mjs';

const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
const sha = (value) => createHash('sha256').update(value).digest('hex');
const claim = {
  schemaVersion: 1,
  claimId: 'd02-run-95-test-claim',
  runNumber: 95,
  frontierId: 'D02',
  epochId: 'run95-d02-public-search-candidate-boundary',
  toolName: 'bangumi.search_subjects',
  argumentProfile: 'fixed-d02-apocalypse-travel-keyword-anime-top8-v1',
  expectedArgumentsSha256: sha(canonicalJson(D02_EXPECTED_QUERY_ARGUMENTS)),
  state: 'CLAIMED',
  candidateSha: 'b'.repeat(40),
  baseSha: 'c'.repeat(40),
  ciSha: 'b'.repeat(40),
  ciStatus: 'SUCCESS',
  bundleSha256: 'd'.repeat(64),
  prNumber: 152,
  reviewerId: 'gpt-6-luna-max-run95-pr152-round1',
  model: 'gpt-6-luna',
  reasoningEffort: 'max',
  reportWritten: false,
  retryAllowed: false,
  claimedAt: '2026-10-13T00:00:00.000Z',
};

function report() {
  return {
    schemaVersion: 1,
    evidenceKind: 'codex_cli_d02_search_subjects_agent_mcp',
    runNumber: 95,
    frontierId: 'D02',
    scenarioId: 'D02',
    epochId: claim.epochId,
    claimId: claim.claimId,
    prNumber: claim.prNumber,
    toolName: claim.toolName,
    argumentProfile: claim.argumentProfile,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    candidateSha: claim.candidateSha,
    sourceRevision: claim.candidateSha,
    baseSha: claim.baseSha,
    bundleSha256: claim.bundleSha256,
    ciSha: claim.candidateSha,
    ciStatus: 'SUCCESS',
    reviewerId: claim.reviewerId,
    catalogSha256: '1'.repeat(64),
    toolDescriptionSha256: '2'.repeat(64),
    inputSchemaSha256: '3'.repeat(64),
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    codexCliVersion: '1.2.3',
    processExitCode: 0,
    eventStreamParsed: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    mcpServerNames: ['bgk_d02_one_tool'],
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    authMode: 'anonymous-optional-read; credential environment cleared; MemoryStorage empty',
    serverId: 'bgk_d02_one_tool',
    resultReadbackMode: 'structuredContent',
    resultReadbackTextUtf8Bytes: null,
    serverProfile: 'one-tool-anonymous-optional-read-v1',
    sourceRequestCount: 1,
    authorizationHeaderSeen: false,
    sourceRequestValidated: true,
    bearerTokenInjected: false,
    serverToolNames: ['bangumi.search_subjects'],
    serverResultStatus: 'SUCCESS',
    sourceResultSha256: 'e'.repeat(64),
    sourceResultByteLength: 512,
    source: {
      api: 'Bangumi official public v0 (experimental)',
      operation: 'POST /v0/search/subjects',
      resultStatus: 'disambiguation',
      responseRows: 1,
      returnedCandidates: 1,
      reportedTotal: 5,
      completeResultReadback: true,
      rawAnswerPersisted: false,
      rawToolResultPersisted: false,
    },
    answerChecks: {
      accepted: true,
      argumentsMatch: true,
      sourceResultValid: true,
      answerRows: 1,
      matchedRows: 1,
      missingRows: 0,
      unsupportedClaims: false,
      scopeLineVerified: true,
    },
    answerUtf8Bytes: 256,
    answerSha256: '4'.repeat(64),
    observedAt: '2026-10-13T00:00:00.000Z',
    privacy: {
      authProfile: 'anonymous',
      oauthAttempted: false,
      accountDataRead: false,
      writesAttempted: false,
      communityRead: false,
      qqPipelineTested: false,
      timClientTested: false,
      promptStored: false,
      answerStored: false,
      rawResultStored: false,
      artifactImageBytesStored: false,
      credentialsStored: false,
    },
    acceptanceCredit: { agentMcpTools: 1, frontierD02: 'PARTIAL' },
    limitations: [
      '仅为固定关键词的实验性公开搜索候选，不代表官方相似度或用户偏好匹配。',
      '来源没有低刺激指标；未判断候选是否适合此偏好。',
      '单次分页结果不完整；未返回不表示不存在。',
      '不包含社区、账号、OAuth、QQ 或 TIM 证据。',
    ],
    candidate_refresh_reason:
      'Attach the accepted sanitized D02 search report to the same Epoch and re-establish the exact Candidate.',
  };
}

function writeReport(root, value) {
  const target = path.join(root, 'docs/live-probes/pariya-agent-codex-luna-e2e-D02-search-subjects.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
}

test('D02 accepts a sanitized report bound to its claim and exact source result digest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd02-report-'));
  try {
    const target = writeReport(root, report());
    const checked = validateD02SanitizedReportFile(claim, target, root);
    assert.equal(checked.passed, true);
    assert.equal(checked.reportSha256, sha(fs.readFileSync(target)));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('D02 report validation rejects raw answer fields and claim mismatches', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd02-report-'));
  try {
    const value = report();
    value.rawAnswer = 'private or untrusted model output';
    const target = writeReport(root, value);
    assert.equal(validateD02SanitizedReportFile(claim, target, root).passed, false);
    const cleanTarget = writeReport(root, report());
    assert.equal(
      validateD02SanitizedReportFile({ ...claim, candidateSha: 'f'.repeat(40) }, cleanTarget, root).passed,
      false,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
