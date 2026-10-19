import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  getAgentMcpProfileById,
  listAgentMcpProfiles,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { canonicalJson } from '../../scripts/lib/codex-one-tool-evidence.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';
import { P06_REQUIRED_CI_CHECKS } from '../../scripts/lib/p06-ci-run-evidence.mjs';
import {
  assertQuerySubjectsFreshPublicCandidateReviewGate,
  buildQuerySubjectsFreshPublicRunnerReport,
  classifyQuerySubjectsFreshPublicAssertionFailure,
  querySubjectsFreshPublicCodexCliVersionIsSupported,
  validateQuerySubjectsFreshPublicRunnerArgs,
} from '../../scripts/acceptance/run-query-subjects-fresh-public-agent-mcp-v2.mjs';
import {
  buildQuerySubjectsFreshPublicProfileReport,
  validateQuerySubjectsFreshPublicProfileReport,
  validateQuerySubjectsFreshPublicServerSummary,
  validateQuerySubjectsFreshPublicSanitizedReportFile,
  writeQuerySubjectsFreshPublicProfileReport,
} from '../../scripts/acceptance/write-query-subjects-fresh-public-agent-mcp-v2-report.mjs';
import {
  assertQuerySubjectsFreshPublicV2Profile,
  createQuerySubjectsFreshPublicV2Fetch,
  QUERY_SUBJECTS_FRESH_PUBLIC_V2_EXPECTED_ARGUMENTS,
  QUERY_SUBJECTS_FRESH_PUBLIC_V2_ACKNOWLEDGEMENT,
  QUERY_SUBJECTS_FRESH_PUBLIC_V2_EPOCH_ID,
  QUERY_SUBJECTS_FRESH_PUBLIC_V2_MAX_REQUESTS,
  QUERY_SUBJECTS_FRESH_PUBLIC_V2_NETWORK_MODE,
  QUERY_SUBJECTS_FRESH_PUBLIC_V2_PROFILE_ID,
  QUERY_SUBJECTS_FRESH_PUBLIC_V2_SERVER_ID,
} from '../../scripts/lib/query-subjects-fresh-public-matrix-v2-profile.mjs';

const PROFILE = getAgentMcpProfileById(QUERY_SUBJECTS_FRESH_PUBLIC_V2_PROFILE_ID);
const FIXED_QUERY_SUBJECTS_INPUT = Object.freeze({
  keyword: '天空之城',
  media: 'anime',
  resultMode: 'top',
  limit: 1,
  sort: 'relevance',
  explain: 'compact',
  nsfw: false,
});
const BASE_ARGS = [
  '--profile-id',
  QUERY_SUBJECTS_FRESH_PUBLIC_V2_PROFILE_ID,
  '--summary-file',
  '/tmp/query-subjects-fresh-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];
const REQUEST_URL = 'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0';
const REQUEST_BODY = {
  keyword: QUERY_SUBJECTS_FRESH_PUBLIC_V2_EXPECTED_ARGUMENTS.keyword,
  sort: 'match',
  filter: { type: [2], nsfw: false },
};
const PUBLIC_REQUEST_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)',
};
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('profile uses a unique fixed query_subjects input and one anonymous read-only tool', () => {
  assert.equal(assertQuerySubjectsFreshPublicV2Profile(PROFILE), true);
  assert.deepEqual(QUERY_SUBJECTS_FRESH_PUBLIC_V2_EXPECTED_ARGUMENTS, FIXED_QUERY_SUBJECTS_INPUT);
  assert.ok(PROFILE.claimLabelName.length <= 50);
  assert.equal(PROFILE.calls.length, 1);
  assert.deepEqual(PROFILE.calls[0], {
    toolName: 'bangumi.query_subjects',
    arguments: FIXED_QUERY_SUBJECTS_INPUT,
  });
  const priorQueryInputs = listAgentMcpProfiles()
    .filter((item) => item.id !== PROFILE.id)
    .flatMap((item) =>
      item.calls
        .filter((call) => call.toolName === 'bangumi.query_subjects')
        .map((call) => call.arguments),
    );
  assert.equal(
    priorQueryInputs.some(
      (input) =>
        JSON.stringify(input) === JSON.stringify(QUERY_SUBJECTS_FRESH_PUBLIC_V2_EXPECTED_ARGUMENTS),
    ),
    false,
  );
  assert.throws(() =>
    assertQuerySubjectsFreshPublicV2Profile({
      ...PROFILE,
      calls: [
        {
          ...PROFILE.calls[0],
          arguments: { ...PROFILE.calls[0].arguments, keyword: '葬送的芙莉莲' },
        },
      ],
    }),
  );
});

test('G14 records terminal query_subjects claims without inviting a retry or matrix credit', () => {
  const frontier = JSON.parse(
    readFileSync(path.join(ROOT, 'docs/product/frontier-ledger.json'), 'utf8'),
  );
  const g14 = frontier.records.find((record) => record.id === 'G14');

  assert.ok(g14);
  assert.equal(g14.status, 'PARTIAL');
  assert.match(g14.next_action, /PR #232.*PR #233/u);
  assert.match(g14.next_action, /INCONCLUSIVE.*no-report.*retry_allowed=false/u);
  assert.match(g14.next_action, /no Agent\/MCP matrix credit/u);
  assert.match(g14.next_action, /never invoke.*again/u);
  assert.doesNotMatch(g14.next_action, /may add only the query_subjects Agent\/MCP cell/u);
  assert.match(
    g14.next_action,
    /run95-g14-query-subjects-v2-terminal-disposition-2026-10-19\.md/u,
  );
});

test('closed Codex MCP configuration exposes exactly the registered query_subjects tool', () => {
  const parsed = parseCodexOneToolMcpArguments(BASE_ARGS);
  assert.equal(parsed.networkMode, QUERY_SUBJECTS_FRESH_PUBLIC_V2_NETWORK_MODE);
  assert.deepEqual(parsed.toolNames, ['bangumi.query_subjects']);
  assert.deepEqual(parsed.expectedToolSequence, ['bangumi.query_subjects']);
  assert.deepEqual(parsed.expectedArgumentSequence, [
    QUERY_SUBJECTS_FRESH_PUBLIC_V2_EXPECTED_ARGUMENTS,
  ]);
  assert.equal(
    QUERY_SUBJECTS_FRESH_PUBLIC_V2_SERVER_ID,
    'bgk_query_subjects_fresh_public_matrix_v2',
  );
});

test('public fetch permits only bounded anonymous official v0 subject search requests', async () => {
  const calls = [];
  const guarded = createQuerySubjectsFreshPublicV2Fetch({
    maxRequests: 1,
    fetchImpl: async (input, init) => {
      calls.push({
        url: String(input),
        method: init.method,
        credentials: init.credentials,
        redirect: init.redirect,
      });
      return new Response(JSON.stringify({ total: 1, limit: 20, offset: 0, data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  const response = await guarded.fetchFn(REQUEST_URL, {
    method: 'POST',
    headers: PUBLIC_REQUEST_HEADERS,
    body: JSON.stringify(REQUEST_BODY),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      url: REQUEST_URL,
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
    },
  ]);
  assert.deepEqual(guarded.snapshot(), {
    requestCount: 1,
    allowedRequestCount: 1,
    deniedRequestCount: 0,
    credentialAttemptCount: 0,
    unexpectedRouteCount: 0,
    budgetExceeded: false,
    maxRequests: 1,
    anonymousOnly: true,
    officialV0Only: true,
    redirectPolicy: 'error',
  });
});

test('public fetch denies altered routes, arguments, credentials and over-budget calls', async () => {
  const cases = [
    {
      url: 'https://example.com/v0/search/subjects?limit=20&offset=0',
      init: { method: 'POST', body: JSON.stringify(REQUEST_BODY) },
    },
    {
      url: 'https://api.bgm.tv/v0/search/subjects?limit=020&offset=0',
      init: { method: 'POST', body: JSON.stringify(REQUEST_BODY) },
    },
    {
      url: 'https://api.bgm.tv/v0/search/subjects?limit=20&offset=00',
      init: { method: 'POST', body: JSON.stringify(REQUEST_BODY) },
    },
    { url: 'https://api.bgm.tv/v0/subjects/1', init: { method: 'GET' } },
    {
      url: REQUEST_URL,
      init: { method: 'POST', body: JSON.stringify({ ...REQUEST_BODY, keyword: '葬送的芙莉莲' }) },
    },
    {
      url: REQUEST_URL,
      init: {
        method: 'POST',
        body: JSON.stringify({
          ...REQUEST_BODY,
          filter: { ...REQUEST_BODY.filter, type: { length: 1, 0: 2 } },
        }),
      },
    },
    {
      url: REQUEST_URL,
      init: {
        method: 'POST',
        headers: { authorization: 'Bearer synthetic' },
        body: JSON.stringify(REQUEST_BODY),
      },
    },
    {
      url: REQUEST_URL,
      init: {
        method: 'POST',
        headers: { ...PUBLIC_REQUEST_HEADERS, 'X-Auth': 'synthetic-session' },
        body: JSON.stringify(REQUEST_BODY),
      },
    },
  ];
  for (const item of cases) {
    const guarded = createQuerySubjectsFreshPublicV2Fetch({
      fetchImpl: async () => new Response('{}'),
    });
    await assert.rejects(() => guarded.fetchFn(item.url, item.init));
    assert.equal(guarded.snapshot().allowedRequestCount, 0);
    assert.equal(guarded.snapshot().deniedRequestCount, 1);
  }

  const guarded = createQuerySubjectsFreshPublicV2Fetch({
    maxRequests: 1,
    fetchImpl: async () => new Response('{}'),
  });
  await guarded.fetchFn(REQUEST_URL, { method: 'POST', body: JSON.stringify(REQUEST_BODY) });
  await assert.rejects(() =>
    guarded.fetchFn(REQUEST_URL, { method: 'POST', body: JSON.stringify(REQUEST_BODY) }),
  );
  assert.equal(guarded.snapshot().requestCount, 1);
  assert.equal(guarded.snapshot().budgetExceeded, true);
});

test('server result summary retains counts and coverage without any returned title or id', () => {
  const summary = summarizeProfileToolResult(
    {
      state: 'ok',
      items: [{ id: 123, name: 'Synthetic title must not be retained' }],
      coverage: { state: 'partial', pagesRequested: 1, pagesScanned: 1, totalKind: 'estimated' },
      warnings: [{ code: 'EXPERIMENTAL_SOURCE', message: 'private text must not be retained' }],
    },
    QUERY_SUBJECTS_FRESH_PUBLIC_V2_EXPECTED_ARGUMENTS,
    PROFILE.id,
    null,
    'bangumi.query_subjects',
  );
  assert.deepEqual(summary, {
    resultState: 'ok',
    returnedItems: 1,
    coverageState: 'partial',
    pagesRequested: 1,
    pagesScanned: 1,
    totalKind: 'estimated',
    warningCount: 1,
  });
  assert.equal(JSON.stringify(summary).includes('Synthetic title'), false);
  assert.equal(JSON.stringify(summary).includes('private text'), false);
  assert.equal(QUERY_SUBJECTS_FRESH_PUBLIC_V2_MAX_REQUESTS, 8);
});

test('runner accepts only Run 95 and enforces the exact Luna Max CLI floor', () => {
  assert.equal(validateQuerySubjectsFreshPublicRunnerArgs(['--help']), 'help');
  assert.equal(validateQuerySubjectsFreshPublicRunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateQuerySubjectsFreshPublicRunnerArgs(['--run', '96']));
  assert.equal(querySubjectsFreshPublicCodexCliVersionIsSupported('0.163.0'), true);
  assert.equal(querySubjectsFreshPublicCodexCliVersionIsSupported('0.162.9'), false);
  assert.equal(querySubjectsFreshPublicCodexCliVersionIsSupported('0.163.0-beta.1'), false);
});

test('candidate gate binds one fresh Epoch to current Base, exact seven-check CI, and Luna Max PASS', () => {
  const candidateSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  const branch = 'codex/epoch-run95-query-subjects-fresh-public-matrix-v2-20261019';
  const ciRunId = '39167322946';
  const ciUrl = `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${ciRunId}`;
  const ciChecks = P06_REQUIRED_CI_CHECKS.map((name) => ({
    name,
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
  }));
  const statusCheckRollup = ciChecks.map((check) => ({
    ...check,
    detailsUrl: `${ciUrl}/job/39167322947`,
  }));
  const reviewerId = 'gpt-6-luna-max-run95-pr241-round1';
  const status = {
    git: { status: '', head: candidateSha, branch },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: 241,
        pending_epoch: null,
      },
    },
    epoch: {
      number: 241,
      github_state: 'OPEN',
      state: {
        epoch_id: QUERY_SUBJECTS_FRESH_PUBLIC_V2_EPOCH_ID,
        pr_number: 241,
        branch,
        base_branch: 'master',
        base_sha: baseSha,
        reviewed_base_sha: baseSha,
        candidate_sha: candidateSha,
        review_pass_sha: candidateSha,
        state: 'REVIEW_PASSED',
        ci: { url: ciUrl, sha: candidateSha, status: 'SUCCESS' },
        advances_frontier_ids: ['G14'],
        scope_closure: { related_work_remaining: false },
        adversarial_preflight: { completed: true },
        review_history: [
          {
            reviewer_id: reviewerId,
            candidate_sha: candidateSha,
            reviewed_base_sha: baseSha,
            verdict: 'PASS',
          },
        ],
      },
    },
  };
  const pr = {
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'master',
    headRefName: branch,
    headRefOid: candidateSha,
    statusCheckRollup,
  };
  const readGit = (...args) =>
    args[0] === 'status' ? '' : args[0] === 'rev-parse' ? candidateSha : '';
  assert.deepEqual(
    assertQuerySubjectsFreshPublicCandidateReviewGate(status, pr, {
      sourceRevision: candidateSha,
      currentBaseSha: baseSha,
      readGit,
    }),
    {
      candidateSha,
      baseSha,
      prNumber: 241,
      reviewerId,
      ciRunId,
      ciChecks,
    },
  );
});

function createSignedReportInput() {
  const keyPair = generateKeyPairSync('ed25519');
  const publicKeyBase64 = keyPair.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  const publicKeyBytes = Buffer.from(publicKeyBase64, 'base64');
  const ciChecks = P06_REQUIRED_CI_CHECKS.map((name) => ({
    name,
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
  }));
  const claim = {
    claimId: 'synthetic-query-subjects-claim',
    profileId: PROFILE.id,
    frontierId: 'G14',
    epochId: QUERY_SUBJECTS_FRESH_PUBLIC_V2_EPOCH_ID,
    runNumber: 95,
    prNumber: 241,
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArguments: PROFILE.calls.map((call) => call.arguments),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    sourceCandidateSha: 'a'.repeat(40),
    baseSha: 'b'.repeat(40),
    ciSha: 'a'.repeat(40),
    ciStatus: 'SUCCESS',
    ciRunId: '39167322946',
    ciChecks,
    reviewerId: 'gpt-6-luna-max-run95-pr241-round1',
    bundleSha256: 'c'.repeat(64),
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(publicKeyBytes),
  };
  const catalogBytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((item) => item.name === PROFILE.toolName);
  const resultSummary = {
    resultState: 'partial',
    returnedItems: 1,
    coverageState: 'partial',
    pagesRequested: 1,
    pagesScanned: 1,
    totalKind: 'estimated',
    warningCount: 0,
  };
  const serverSummary = {
    serverProfile: 'closed-profile-sequence-anonymous-public-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: QUERY_SUBJECTS_FRESH_PUBLIC_V2_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: claim.sourceCandidateSha,
    bundleSha256: claim.bundleSha256,
    toolName: PROFILE.toolName,
    serverToolCount: 1,
    serverToolNames: [PROFILE.toolName],
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    argumentMatch: true,
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary }],
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
    publicRequestScope: {
      requestCount: 1,
      allowedRequestCount: 1,
      deniedRequestCount: 0,
      credentialAttemptCount: 0,
      unexpectedRouteCount: 0,
      budgetExceeded: false,
      maxRequests: QUERY_SUBJECTS_FRESH_PUBLIC_V2_MAX_REQUESTS,
      anonymousOnly: true,
      officialV0Only: true,
      redirectPolicy: 'error',
    },
  };
  const gate = {
    candidateSha: claim.sourceCandidateSha,
    baseSha: claim.baseSha,
    prNumber: claim.prNumber,
    reviewerId: claim.reviewerId,
    ciRunId: claim.ciRunId,
    ciChecks,
  };
  const events = {
    processExitCode: 0,
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    blockedWebSearchErrorItemCount: 0,
    unexpectedCodexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    mcpServerNames: [QUERY_SUBJECTS_FRESH_PUBLIC_V2_SERVER_ID],
    allowedCallCount: 1,
    deniedCallCount: 0,
  };
  return {
    claim,
    gate,
    serverSummary,
    events,
    answer: QUERY_SUBJECTS_FRESH_PUBLIC_V2_ACKNOWLEDGEMENT,
    codexCliVersion: '0.163.0',
    eventStreamSha256: 'd'.repeat(64),
    serverSummarySha256: 'e'.repeat(64),
    keys: keyPair,
    publicKeyBase64,
  };
}

test('sanitized report is claim-bound, signed, and rejects altered summary values', () => {
  const input = createSignedReportInput();
  assert.equal(
    validateQuerySubjectsFreshPublicServerSummary(
      input.serverSummary,
      input.gate.candidateSha,
      input.claim.bundleSha256,
    ),
    true,
  );
  const built = buildQuerySubjectsFreshPublicProfileReport(input, {
    privateKey: input.keys.privateKey,
    publicKeyBase64: input.publicKeyBase64,
  });
  assert.equal(built.passed, true);
  assert.equal(
    validateQuerySubjectsFreshPublicProfileReport(built.report, input.claim, built.reportBytes),
    true,
  );
  assert.equal(JSON.stringify(built.report).includes('天空之城'), false);
  assert.equal(built.report.privacy.subjectIdsPersisted, false);
  assert.equal(built.report.privacy.subjectNamesPersisted, false);
  const altered = structuredClone(built.report);
  altered.resultSummary.returnedItems += 1;
  assert.equal(validateQuerySubjectsFreshPublicProfileReport(altered, input.claim), false);
});

test('v2 report accepts at most three expected disabled-search errors and rejects unexpected errors', () => {
  const input = createSignedReportInput();
  input.events.codexErrorItemCount = 3;
  input.events.blockedWebSearchErrorItemCount = 3;
  const accepted = buildQuerySubjectsFreshPublicProfileReport(input, {
    privateKey: input.keys.privateKey,
    publicKeyBase64: input.publicKeyBase64,
  });
  assert.equal(accepted.passed, true);
  assert.equal(accepted.report.unexpectedCodexErrorItemCount, 0);

  input.events.unexpectedCodexErrorItemCount = 1;
  const rejected = buildQuerySubjectsFreshPublicProfileReport(input, {
    privateKey: input.keys.privateKey,
    publicKeyBase64: input.publicKeyBase64,
  });
  assert.equal(rejected.passed, false);
  input.events.unexpectedCodexErrorItemCount = 0;
  input.events.codexErrorItemCount = 4;
  input.events.blockedWebSearchErrorItemCount = 4;
  const overLimit = buildQuerySubjectsFreshPublicProfileReport(input, {
    privateKey: input.keys.privateKey,
    publicKeyBase64: input.publicKeyBase64,
  });
  assert.equal(overLimit.passed, false);
});

test('runner classifies only bounded expected errors before checking the exact MCP call', () => {
  const events = {
    eventStreamComplete: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 3,
    blockedWebSearchErrorItemCount: 3,
    unexpectedCodexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    mcpServerNames: [QUERY_SUBJECTS_FRESH_PUBLIC_V2_SERVER_ID],
    completedMcpCalls: [{}],
    answer: QUERY_SUBJECTS_FRESH_PUBLIC_V2_ACKNOWLEDGEMENT,
  };
  const base = {
    execution: { failed: false, spawnErrorCode: null },
    parsed: { parsed: true },
    events,
    exactCalls: false,
    exactToolEvents: true,
    serverSummaryValid: true,
    candidateBundleCurrent: true,
  };
  assert.equal(
    classifyQuerySubjectsFreshPublicAssertionFailure(base),
    'MCP_CALL_ARGUMENT_MISMATCH',
  );
  assert.equal(
    classifyQuerySubjectsFreshPublicAssertionFailure({
      ...base,
      events: { ...events, codexErrorItemCount: 4, blockedWebSearchErrorItemCount: 4 },
    }),
    'UNEXPECTED_CODEX_ERROR_EVENT',
  );
  assert.equal(
    classifyQuerySubjectsFreshPublicAssertionFailure({
      ...base,
      events: { ...events, unexpectedCodexErrorItemCount: 1 },
    }),
    'UNEXPECTED_CODEX_ERROR_EVENT',
  );
});

test('runner report path binds the post-call Candidate gate and writes a validated artifact once', () => {
  const input = createSignedReportInput();
  const { gate, ...runnerInput } = input;
  const built = buildQuerySubjectsFreshPublicRunnerReport(
    { ...runnerInput, postGate: gate },
    { privateKey: input.keys.privateKey, publicKeyBase64: input.publicKeyBase64 },
  );
  assert.equal(built.passed, true);
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'query-subjects-report-test-'));
  try {
    mkdirSync(path.join(tempRoot, 'docs', 'research'), { recursive: true });
    mkdirSync(path.join(tempRoot, 'docs', 'live-probes'), { recursive: true });
    copyFileSync(
      path.join(ROOT, 'docs/tool-catalog.json'),
      path.join(tempRoot, 'docs/tool-catalog.json'),
    );
    copyFileSync(
      path.join(ROOT, PROFILE.selectionEvidencePath),
      path.join(tempRoot, PROFILE.selectionEvidencePath),
    );
    const reportSha256 = writeQuerySubjectsFreshPublicProfileReport(built.reportBytes, tempRoot);
    assert.equal(reportSha256, built.reportSha256);
    assert.throws(() => writeQuerySubjectsFreshPublicProfileReport(built.reportBytes, tempRoot));
    const validation = validateQuerySubjectsFreshPublicSanitizedReportFile(input.claim, tempRoot);
    assert.equal(validation.passed, true);
    assert.equal(validation.reportSha256, built.reportSha256);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
