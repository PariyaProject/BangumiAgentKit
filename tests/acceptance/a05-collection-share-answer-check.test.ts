import { describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { presentMcpToolResult } from '../../apps/mcp/src/result-presenter.js';
import { COLLECTION_COMPLETION_UNRESOLVED_CAVEAT } from '@bangumi-agent-kit/discovery';
import {
  A05_EXPECTED_CAVEATS,
  A05_EXPECTED_QUERY_ARGUMENTS,
  A05_EXPECTED_UNRESOLVED_CAVEAT,
  verifyA05CollectionShareAnswer,
} from '../../scripts/acceptance/a05-collection-share-answer-check.mjs';
import { buildA05AgentMcpReport } from '../../scripts/acceptance/write-a05-agent-mcp-report.mjs';
import {
  assertA05CandidateReviewGate,
  buildA05CodexExecArgs,
  sanitizeA05CodexEnvironment,
  validateA05RunnerArgs,
} from '../../scripts/acceptance/run-a05-codex-agent-mcp.mjs';
import { summarizeA05Result } from '../../apps/mcp/a05-one-tool-mcp-server.mjs';

function makeResult() {
  const item = (id: number, title: string, score: number, rate: number, sourcePath: string) => ({
    id,
    name: title,
    displayName: title,
    media: 'anime',
    score,
    collectionCompletionRate: rate,
    tags: [],
    metaTags: [],
    evidence: {
      collectionCompletionRate: [
        { formula: 'bangumi.subject.completion.v1', fieldPath: 'collectionCompletionRate' },
        {
          source: { class: 'official_v0', operation: 'searchSubjects' },
          fieldPath: sourcePath,
        },
      ],
    },
  });
  return {
    state: 'partial',
    items: [
      item(501, 'Public title one', 8.5, 0.2, 'items[0].collection'),
      item(502, 'Public title two', 8, 0.4, 'items[1].collection'),
    ],
    plan: {
      source: 'official_v0',
      operation: 'searchSubjects',
      totalKind: 'estimated',
      quality: 'bounded_exact',
      resultMode: 'top',
      budget: {
        maxPages: 10,
        maxCandidates: 500,
        maxHydrations: 120,
        concurrency: 6,
        maxReturnedItems: 100,
      },
      steps: [
        {
          kind: 'search',
          request: {
            limit: 50,
            filter: { type: [2], rating: ['>=8'] },
          },
        },
      ],
      pushdown: [{ field: 'rating', classification: 'PUSHDOWN', value: { min: 8 } }],
      postFilters: [],
      derivedFilters: [
        {
          field: 'collectionCompletionRate',
          classification: 'DERIVED_FILTER',
          operator: 'range',
          value: { max: 0.4 },
        },
      ],
      limitations: [
        'collectionCompletionRate = collect / (wish + collect + doing + on_hold + dropped); this sample-verified ratio is not an official API formula, episode completion, personal progress, or preference. Official subject search is experimental and totals are estimated, so results describe only the bounded observed sample.',
        COLLECTION_COMPLETION_UNRESOLVED_CAVEAT,
      ],
    },
    coverage: {
      state: 'partial',
      requested: 8,
      scanned: 20,
      matched: 2,
      returned: 2,
      pagesScanned: 1,
      totalKind: 'estimated',
      upstreamExhausted: false,
      budgetExceeded: true,
      hydrationsAttempted: 2,
      hydrationsSucceeded: 1,
      hydrationsFailed: 1,
      hydrationsUnresolved: 1,
      unresolvedCandidates: 1,
      hydrationBudgetExceeded: false,
      reason: 'Some candidates remain unresolved.',
    },
    warnings: [{ code: 'EXPERIMENTAL_SOURCE', message: 'Search is experimental.' }],
    evidence: [],
  };
}

function answerFor(result: ReturnType<typeof makeResult>) {
  return JSON.stringify({
    formula: 'collect / (wish + collect + doing + on_hold + dropped)',
    thresholds: { ratingMin: 8, collectionCompletionRateMax: 0.4 },
    items: result.items.map((item) => ({
      title: item.displayName,
      score: item.score,
      collectionCompletionRate: item.collectionCompletionRate,
    })),
    coverage: {
      state: result.coverage.state,
      scanned: result.coverage.scanned,
      matched: result.coverage.matched,
      returned: result.coverage.returned,
      totalKind: result.coverage.totalKind,
      unresolvedCandidates: result.coverage.unresolvedCandidates,
    },
    caveats: A05_EXPECTED_CAVEATS,
  });
}

function verify(
  result: ReturnType<typeof makeResult>,
  answer = answerFor(result),
  changes: {
    queryArguments?: Record<string, unknown>;
    toolOutput?: unknown;
    toolCalls?: unknown[];
    toolTextUtf8Bytes?: number;
  } = {},
) {
  const presentation = presentMcpToolResult('bangumi.query_subjects', result);
  const toolOutput = {
    ...presentation,
    content: [{ type: 'text', text: presentation.text }],
  };
  return verifyA05CollectionShareAnswer(
    answer,
    { ...A05_EXPECTED_QUERY_ARGUMENTS, ...(changes.queryArguments ?? {}) },
    changes.toolOutput ?? toolOutput,
    changes.toolCalls ?? [
      {
        name: 'bangumi.query_subjects',
        state: 'DONE',
        arguments: A05_EXPECTED_QUERY_ARGUMENTS,
      },
    ],
    changes.toolTextUtf8Bytes ?? Buffer.byteLength(presentation.text, 'utf8'),
  );
}

describe('A05 sanitized Agent/MCP answer checker', () => {
  it('loads the one-shot runner from a clean checkout before package dist exists', () => {
    const sourceRoot = process.cwd();
    const temporaryRoot = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'a05-clean-runner-')));
    const sourcePaths = [
      'scripts/acceptance/run-a05-codex-agent-mcp.mjs',
      'scripts/acceptance/a05-collection-share-answer-check.mjs',
      'scripts/acceptance/write-a05-agent-mcp-report.mjs',
      'scripts/acceptance/run-g26-codex-agent-mcp.mjs',
      'scripts/lib/g26-mcp-bundle.mjs',
      'packages/discovery/src/collection-completion-contract.json',
    ];

    try {
      for (const relativePath of sourcePaths) {
        const destination = path.join(temporaryRoot, relativePath);
        mkdirSync(path.dirname(destination), { recursive: true });
        copyFileSync(path.join(sourceRoot, relativePath), destination);
      }

      expect(existsSync(path.join(temporaryRoot, 'packages/discovery/dist/index.js'))).toBe(false);
      expect(existsSync(path.join(temporaryRoot, 'node_modules'))).toBe(false);
      const result = spawnSync(
        process.execPath,
        [path.join(temporaryRoot, 'scripts/acceptance/run-a05-codex-agent-mcp.mjs'), '--help'],
        { cwd: temporaryRoot, encoding: 'utf8', timeout: 10_000 },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Usage: node scripts/acceptance/run-a05-codex-agent-mcp.mjs --run 95');
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('shares one dependency-free caveat source between discovery and the Node acceptance checker', () => {
    expect(A05_EXPECTED_UNRESOLVED_CAVEAT).toBe(COLLECTION_COMPLETION_UNRESOLVED_CAVEAT);
  });

  it('accepts one exact query and returns only aggregate counters and checks', () => {
    const result = makeResult();
    const verified = verify(result);

    expect(Object.entries(verified.checks).filter(([, passed]) => passed !== true)).toEqual([]);
    expect(verified.passed).toBe(true);
    expect(Object.values(verified.checks).every(Boolean)).toBe(true);
    expect(verified.counters).toMatchObject({
      scanned: 20,
      matched: 2,
      returned: 2,
      unresolvedCandidates: 1,
      formulaEvidenceRows: 2,
      sourceEvidenceRows: 2,
    });
    const serialized = JSON.stringify(verified);
    expect(serialized).not.toContain('Public title one');
    expect(serialized).not.toContain('Public title two');
    expect(serialized).not.toContain('501');
    expect(serialized).not.toContain('502');
  });

  it('rejects changed thresholds, duplicate MCP calls, and mismatched result readback', () => {
    const result = makeResult();
    const answer = answerFor(result);
    const duplicate = verify(result, answer, {
      toolCalls: [
        { name: 'bangumi.query_subjects', state: 'DONE', arguments: A05_EXPECTED_QUERY_ARGUMENTS },
        { name: 'bangumi.query_subjects', state: 'DONE', arguments: A05_EXPECTED_QUERY_ARGUMENTS },
      ],
    });
    const wrongAnswer = JSON.parse(answer);
    wrongAnswer.thresholds.collectionCompletionRateMax = 0.5;
    const changedThreshold = verify(result, JSON.stringify(wrongAnswer));
    const wrongTitle = JSON.parse(answer);
    wrongTitle.items[0].title = 'A different title';
    const changedReadback = verify(result, JSON.stringify(wrongTitle));

    expect(duplicate.passed).toBe(false);
    expect(duplicate.checks.exactlyOneTargetToolCall).toBe(false);
    expect(changedThreshold.checks.answerThresholdsMatch).toBe(false);
    expect(changedReadback.checks.answerRowsMatchResult).toBe(false);
  });

  it('rejects extra answer fields that could carry IDs or unsupported claims', () => {
    const result = makeResult();
    const answer = JSON.parse(answerFor(result));
    answer.items[0].subjectId = 501;
    answer.completenessClaim = 'This is the complete list.';

    const checked = verify(result, JSON.stringify(answer));

    expect(checked.passed).toBe(false);
    expect(checked.checks.answerUsesExactSanitizedShape).toBe(false);
  });

  it('rejects contradictory, paraphrased, or incomplete caveats', () => {
    const result = makeResult();
    const answer = JSON.parse(answerFor(result));
    answer.caveats = [
      ...A05_EXPECTED_CAVEATS,
      'This is the full list and reflects personal progress and preference.',
    ];

    const checked = verify(result, JSON.stringify(answer));

    expect(checked.passed).toBe(false);
    expect(checked.checks.answerCaveatsMatchApprovedSet).toBe(false);

    answer.caveats = A05_EXPECTED_CAVEATS.slice(0, 2);
    const incomplete = verify(result, JSON.stringify(answer));
    expect(incomplete.checks.answerCaveatsMatchApprovedSet).toBe(false);
  });

  it('requires anime result rows and an official anime type pushdown', () => {
    const nonAnimeRow = makeResult();
    nonAnimeRow.items[0]!.media = 'book';
    const nonAnimeCheck = verify(nonAnimeRow);

    const wrongSearchType = makeResult();
    wrongSearchType.plan.steps[0]!.request.filter.type = [1];
    const wrongSearchCheck = verify(wrongSearchType);

    expect(nonAnimeCheck.checks.allReturnedRowsAreAnime).toBe(false);
    expect(wrongSearchCheck.checks.animeMediaIsSearchPushdown).toBe(false);
  });

  it('requires consistent partial coverage for unresolved candidates and output caps', () => {
    const unresolvedMarkedComplete = makeResult();
    unresolvedMarkedComplete.state = 'ok';
    unresolvedMarkedComplete.coverage.state = 'complete';
    const badUnresolvedCoverage = verify(unresolvedMarkedComplete);

    const cappedMarkedComplete = makeResult();
    cappedMarkedComplete.state = 'ok';
    cappedMarkedComplete.coverage.state = 'complete';
    cappedMarkedComplete.coverage.unresolvedCandidates = 0;
    cappedMarkedComplete.coverage.hydrationsUnresolved = 0;
    cappedMarkedComplete.coverage.hydrationsFailed = 0;
    cappedMarkedComplete.coverage.budgetExceeded = false;
    cappedMarkedComplete.coverage.hydrationBudgetExceeded = false;
    Object.assign(cappedMarkedComplete.coverage, { outputCap: 2 });
    const badCappedCoverage = verify(cappedMarkedComplete);

    const invalidCoverage = makeResult();
    invalidCoverage.coverage.state = 'unbounded';
    const badCoverageEnum = verify(invalidCoverage);

    const inconsistentHydrationCount = makeResult();
    inconsistentHydrationCount.coverage.hydrationsUnresolved = 0;
    const badHydrationCount = verify(inconsistentHydrationCount);

    expect(badUnresolvedCoverage.checks.coverageIsBoundedAndConsistent).toBe(false);
    expect(badCappedCoverage.checks.coverageIsBoundedAndConsistent).toBe(false);
    expect(badCoverageEnum.checks.coverageIsBoundedAndConsistent).toBe(false);
    expect(badHydrationCount.checks.coverageIsBoundedAndConsistent).toBe(false);
  });

  it('rejects missing formula/source evidence, omitted MCP rows, and unsupported completeness claims', () => {
    const missingFormula = makeResult();
    missingFormula.items[0]!.evidence.collectionCompletionRate = [];
    const missingUnresolvedCaveat = makeResult();
    missingUnresolvedCaveat.plan.limitations[1] =
      'Missing or invalid collection buckets and a zero denominator remain unresolved/not-computable rather than proven non-matches.';
    const omittedRow = makeResult();
    const originalPresentation = presentMcpToolResult('bangumi.query_subjects', omittedRow);
    const projectedText = JSON.parse(originalPresentation.text);
    projectedText.textProjection = {
      rowsIncluded: projectedText.items.length,
      rowsOmitted: 1,
      displayNamesClipped: 0,
    };
    const omittedPresentation = {
      ...originalPresentation,
      content: [{ type: 'text', text: JSON.stringify(projectedText) }],
    };
    const falseCompleteness = makeResult();
    const answer = JSON.parse(answerFor(falseCompleteness));
    answer.caveats = ['This is the complete list of matching subjects.'];

    expect(verify(missingFormula).checks.everyRowHasFormulaEvidence).toBe(false);
    expect(verify(missingUnresolvedCaveat).checks.planDisclosesUnresolvedCoverage).toBe(false);
    expect(
      verify(omittedRow, answerFor(omittedRow), { toolOutput: omittedPresentation }).checks
        .textReadbackHasAllUnclippedRows,
    ).toBe(false);
    expect(verify(falseCompleteness, JSON.stringify(answer)).checks.answerAvoidsCompletenessClaim).toBe(
      false,
    );
  });

  it('builds a report with only source hashes, aggregate counters, and booleans', () => {
    const result = makeResult();
    result.warnings = [
      { code: 'EXPERIMENTAL_SOURCE', message: 'Expected public source warning.' },
      { code: 'PRIVATE_WARNING_INJECTION_subject_777', message: 'Private payload must not persist.' },
    ];
    const presentation = presentMcpToolResult('bangumi.query_subjects', result);
    const sourceRevision = 'a'.repeat(40);
    const bundleSha256 = 'b'.repeat(64);
    const scriptHashes = {
      oneToolServer: 'd'.repeat(64),
      runner: 'e'.repeat(64),
      answerChecker: 'f'.repeat(64),
      reportWriter: '9'.repeat(64),
      sharedContract: '8'.repeat(64),
    };
    const input = {
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      codexCliVersion: '1.2.3',
      processExitCode: 0,
      eventStreamParsed: true,
      resultStatus: 'SUCCESS',
      serverToolNames: ['bangumi.query_subjects'],
      mcpServerNames: ['bgk_a05_one_tool'],
      codexMcpToolEventCount: 1,
      nonMcpToolEventCount: 0,
      shellToolCallCount: 0,
      allowedCallCount: 1,
      deniedCallCount: 0,
      queryArguments: A05_EXPECTED_QUERY_ARGUMENTS,
      answer: answerFor(result),
      toolOutput: {
        ...presentation,
        content: [{ type: 'text', text: presentation.text }],
      },
      toolCalls: [
        {
          name: 'bangumi.query_subjects',
          state: 'DONE',
          arguments: A05_EXPECTED_QUERY_ARGUMENTS,
        },
      ],
      toolTextUtf8Bytes: Buffer.byteLength(presentation.text, 'utf8'),
      sourceRevision,
      bundleSha256,
      scriptHashes,
      prNumber: 123,
      baseSha: 'c'.repeat(40),
      privacy: {
        authProfile: 'anonymous',
        oauthAttempted: false,
        accountDataRead: false,
        communityRead: false,
        writesAttempted: false,
        qqPipelineTested: false,
        timClientTested: false,
        promptStored: false,
        answerStored: false,
        rawResultStored: false,
        subjectNamesStored: false,
        subjectIdsStored: false,
        credentialsStored: false,
      },
    };
    const built = buildA05AgentMcpReport(input, {
      sourceRevision,
      bundleSha256,
      scriptHashes,
      observedAt: '2026-10-09T00:00:00.000Z',
      catalogBytes: Buffer.from('[]'),
      sourceReportSha256: '2'.repeat(64),
      formulaSourceSha256: '3'.repeat(64),
      catalog: [
        {
          name: 'bangumi.query_subjects',
          auth: 'none',
          risk: 'read',
          description: 'Bounded public discovery.',
          inputSchema: { type: 'object' },
        },
      ],
    });

    expect(built.passed).toBe(true);
    const reportText = JSON.stringify(built.report);
    expect(reportText).not.toContain('Public title one');
    expect(reportText).not.toContain('Public title two');
    expect(reportText).not.toContain('501');
    expect(reportText).not.toContain('502');
    expect(reportText).not.toContain('PRIVATE_WARNING_INJECTION_subject_777');
    expect(reportText).not.toContain('Private payload must not persist.');
    expect(reportText).not.toContain('Expected public source warning.');
    expect(reportText).not.toContain('EXPERIMENTAL_SOURCE');
    expect(reportText).toContain('rawAnswerPersisted');
    expect(reportText).toContain('subjectIdsPersisted');
  });

  it('keeps the MCP server event summary free of row identifiers and titles', () => {
    const summary = summarizeA05Result(makeResult());
    expect(summary).toMatchObject({
      state: 'partial',
      totalKind: 'estimated',
      scanned: 20,
      matched: 2,
      returned: 2,
      formulaEvidenceRows: 2,
      sourceEvidenceRows: 2,
    });
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('Public title one');
    expect(serialized).not.toContain('Public title two');
    expect(serialized).not.toContain('501');
    expect(serialized).not.toContain('502');
  });

  it('persists warning totals and a fixed warning boolean without copying upstream codes or text', () => {
    const result = makeResult();
    result.warnings = [
      { code: 'EXPERIMENTAL_SOURCE', message: 'Expected public source warning.' },
      { code: 'PRIVATE_WARNING_INJECTION_subject_777', message: 'Private payload must not persist.' },
    ];
    const checked = verify(result);
    const serialized = JSON.stringify(checked);

    expect(checked.counters).toMatchObject({
      warningCount: 2,
      experimentalSourceWarningPresent: true,
    });
    expect(serialized).not.toContain('PRIVATE_WARNING_INJECTION_subject_777');
    expect(serialized).not.toContain('Private payload must not persist.');
    expect(serialized).not.toContain('Expected public source warning.');
    expect(serialized).not.toContain('EXPERIMENTAL_SOURCE');
  });

  it('locks the runner to Luna Max, a single MCP tool, and the passed exact Candidate gate', () => {
    const env = sanitizeA05CodexEnvironment({
      PATH: '/usr/bin',
      BANGUMI_ACCESS_TOKEN: 'secret',
      OPENAI_API_KEY: 'secret',
      CODEX_MODEL: 'gpt-6-sol',
    });
    expect(env).toMatchObject({ PATH: '/usr/bin' });
    expect(env).not.toHaveProperty('BANGUMI_ACCESS_TOKEN');
    expect(env).not.toHaveProperty('OPENAI_API_KEY');
    expect(env).not.toHaveProperty('CODEX_MODEL');
    expect(validateA05RunnerArgs(['--run', '95'])).toBe('run');
    expect(() => validateA05RunnerArgs(['--run', '94'])).toThrow();

    const args = buildA05CodexExecArgs({
      root: '/tmp/project',
      nodePath: '/usr/bin/node',
      summaryPath: '/tmp/a05-summary.json',
      candidateSha: 'a'.repeat(40),
      bundleSha256: 'b'.repeat(64),
    });
    expect(args).toContain('gpt-6-luna');
    expect(args).toContain('features.shell_tool=false');
    expect(args.join(' ')).toContain('model_reasoning_effort="max"');
    expect(args.join(' ')).toContain('enabled_tools=["bangumi.query_subjects"]');

    const candidateSha = 'a'.repeat(40);
    const ciChecks = [
      'harness-control',
      'sqlite-default',
      'host-integration',
      'standalone-release-smoke',
      'postgres-compat',
      'provider-foundation',
      'discovery-foundation',
    ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));
    const status = {
      git: { status: '', head: candidateSha, branch: 'codex/epoch-run95-a05-collection-completion-filter' },
      run: { state: { state: 'EPOCH_ACTIVE', profile: 'AUTONOMOUS_EVOLUTION', active_epoch_pr: 123 } },
      epoch: {
        number: 123,
        github_state: 'OPEN',
        state: {
          state: 'REVIEW_PASSED',
          pr_number: 123,
          branch: 'codex/epoch-run95-a05-collection-completion-filter',
          epoch_id: 'run95-a05-collection-completion-filter',
          base_branch: 'master',
          base_sha: 'c'.repeat(40),
          reviewed_base_sha: 'c'.repeat(40),
          candidate_sha: candidateSha,
          ci: { sha: candidateSha, status: 'SUCCESS' },
          review_pass_sha: candidateSha,
          review_history: [
            {
              candidate_sha: candidateSha,
              verdict: 'PASS',
              reviewer_id: 'run95-a05-review-gpt-6-luna-max',
            },
          ],
          scope_closure: {
            related_work_remaining: false,
            why_not_review_earlier: 'Exact candidate tests and gates are complete.',
            why_not_extend_further: 'Other media and account surfaces are separate work.',
          },
          adversarial_preflight: { completed: true, summary: 'Threshold and coverage falsification checks passed.' },
        },
      },
    };
    const pr = {
      state: 'OPEN',
      isDraft: false,
      headRefOid: candidateSha,
      headRefName: 'codex/epoch-run95-a05-collection-completion-filter',
      baseRefName: 'master',
      statusCheckRollup: ciChecks,
    };

    expect(
      assertA05CandidateReviewGate(status, pr, {
        candidateSha,
        currentBaseSha: 'c'.repeat(40),
      }),
    ).toMatchObject({ prNumber: 123, candidateSha, baseSha: 'c'.repeat(40) });
    expect(() =>
      assertA05CandidateReviewGate(status, pr, {
        candidateSha: 'd'.repeat(40),
        currentBaseSha: 'c'.repeat(40),
      }),
    ).toThrow(/exact-Candidate/u);
  });
});
