import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertP01PersonActivityDirectorOfflineCandidateGate,
  buildP01PersonActivityDirectorOfflineCodexExecArgs,
  p01ClaimMatchesCurrentCi,
  p01ObservedCiRunId,
  extractP01PersonActivityDirectorOfflineToolProjection,
  isP01PersonActivityDirectorOfflineCandidateBundleCurrent,
  replayP01AmbiguousTerminalLatch,
  reconcileP01AmbiguousProfileStatus,
  settleP01ReportAcknowledgement,
  validateP01PersonActivityDirectorOfflineRunnerArgs,
} from '../../scripts/acceptance/run-p01-person-activity-director-offline-matrix-v1.mjs';
import {
  agentMcpProfileTerminalLabelDescription,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';

const summary = {
  resultState: 'partial',
  windowMonths: 36,
  matchedDirectorRows: 1,
  excludedOtherRoleRows: 1,
  unknownRoleRows: 1,
  coverage: {
    relationRowsObserved: 3,
    relationRowsSelected: 1,
    relationRowsDroppedAtLimit: 0,
    subjectDetailsSucceeded: 1,
    subjectDetailsFailed: 0,
    rowsEligible: 1,
    rowsReturned: 1,
    outputTruncated: false,
    truncated: false,
  },
};

test('P01 director v1 Codex invocation constrains one tool, Luna Max, and JSON output schema', () => {
  const args = buildP01PersonActivityDirectorOfflineCodexExecArgs({
    root: '/repo',
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/server-summary.json',
    schemaPath: '/tmp/output-schema.json',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  const configs = args.flatMap((item, index) => (item === '--config' ? [args[index + 1]] : []));
  assert.equal(args.includes('--output-schema'), true);
  assert.equal(args[args.indexOf('--output-schema') + 1], '/tmp/output-schema.json');
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
  assert.equal(configs.includes('model_reasoning_effort="max"'), true);
  assert.equal(configs.includes('features.shell_tool=false'), true);
  assert.equal(configs.includes('features.multi_agent=false'), true);
  assert.equal(
    configs.includes(
      'mcp_servers.bgk_p01_person_activity_director_offline_v1.enabled_tools=["bangumi.get_person_activity"]',
    ),
    true,
  );
  assert.equal(args.at(-1).includes('personId'), true);
});

test('P01 director v1 runner accepts only its fixed one-shot invocation', () => {
  assert.equal(validateP01PersonActivityDirectorOfflineRunnerArgs(['--help']), 'help');
  assert.equal(validateP01PersonActivityDirectorOfflineRunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateP01PersonActivityDirectorOfflineRunnerArgs([]));
  assert.throws(() => validateP01PersonActivityDirectorOfflineRunnerArgs(['--run', '95', '--retry']));
});

test('P01 director v1 invocation gate rejects a Base change after the review PASS', () => {
  const candidate = 'a'.repeat(40);
  const base = 'b'.repeat(40);
  const ciRunId = '39200000001';
  const ciRunUrl = `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${ciRunId}`;
  const checks = [
    'harness-control',
    'sqlite-default',
    'host-integration',
    'standalone-release-smoke',
    'postgres-compat',
    'provider-foundation',
    'discovery-foundation',
  ].map((name, index) => ({
    name,
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    detailsUrl: `${ciRunUrl}/job/${index + 1}`,
  }));
  const status = {
    git: { status: '', head: candidate, branch: 'codex/epoch-run95-p01-person-activity-director-offline-agent-mcp-matrix-v1-20261023' },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: 42,
        pending_epoch: null,
      },
    },
    epoch: {
      number: 42,
      github_state: 'OPEN',
      state: {
        epoch_id: 'run95-p01-person-activity-director-offline-agent-mcp-matrix-v1-20261023',
        branch: 'codex/epoch-run95-p01-person-activity-director-offline-agent-mcp-matrix-v1-20261023',
        pr_number: 42,
        base_branch: 'master',
        base_sha: base,
        reviewed_base_sha: base,
        candidate_sha: candidate,
        review_pass_sha: candidate,
        ci: { sha: candidate, status: 'SUCCESS', url: ciRunUrl },
        state: 'REVIEW_PASSED',
        advances_frontier_ids: ['P01'],
        scope_closure: { related_work_remaining: false },
        adversarial_preflight: { completed: true },
        review_history: [
          {
            candidate_sha: candidate,
            reviewed_base_sha: base,
            verdict: 'PASS',
            reviewer_id: 'gpt-6-luna-max-run95-pr42-round1',
          },
        ],
      },
    },
  };
  const pr = {
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'master',
    headRefName: 'codex/epoch-run95-p01-person-activity-director-offline-agent-mcp-matrix-v1-20261023',
    headRefOid: candidate,
    statusCheckRollup: checks,
  };
  const currentGate = assertP01PersonActivityDirectorOfflineCandidateGate(status, pr, {
    sourceRevision: candidate,
    currentBaseSha: base,
    gitStatus: '',
    gitHead: candidate,
  });
  assert.deepEqual(currentGate, {
    candidateSha: candidate,
    baseSha: base,
    prNumber: 42,
    reviewerId: 'gpt-6-luna-max-run95-pr42-round1',
    ciRunId,
    ciChecks: checks.map(({ name, status, conclusion }) => ({ name, status, conclusion })),
  });
  const claim = {
    claimId: 'profile-run-95-pr-42-candidate-claim',
    ciRunId,
    ciChecks: currentGate.ciChecks,
  };
  const profileStatus = {
    state: 'CLAIMED',
    disposition: { ...claim },
  };
  assert.equal(p01ClaimMatchesCurrentCi(profileStatus, currentGate, claim), true);

  const rerunId = '39200000002';
  const rerunUrl = `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${rerunId}`;
  const rerunStatus = structuredClone(status);
  rerunStatus.epoch.state.ci.url = rerunUrl;
  const rerunPr = {
    ...pr,
    statusCheckRollup: checks.map((check, index) => ({
      ...check,
      detailsUrl: `${rerunUrl}/job/${index + 1}`,
    })),
  };
  const rerunGate = assertP01PersonActivityDirectorOfflineCandidateGate(rerunStatus, rerunPr, {
    sourceRevision: candidate,
    currentBaseSha: base,
    gitStatus: '',
    gitHead: candidate,
  });
  assert.equal(rerunGate.ciRunId, rerunId);
  assert.equal(p01ClaimMatchesCurrentCi(profileStatus, rerunGate, claim), false);
  assert.equal(p01ObservedCiRunId(rerunPr.statusCheckRollup), rerunId);

  assert.throws(() =>
    assertP01PersonActivityDirectorOfflineCandidateGate(status, pr, {
      sourceRevision: candidate,
      currentBaseSha: 'c'.repeat(40),
      gitStatus: '',
      gitHead: candidate,
    }),
  );
});

test('P01 director v1 post-write candidate check allows only its registered report', () => {
  const profile = getAgentMcpProfileById('p01-person-director-offline-matrix-v1-20261023');
  assert.ok(profile);
  const candidate = 'a'.repeat(40);
  const bundleSha256 = 'b'.repeat(64);
  const snapshot = {
    sourceRevision: candidate,
    bundleSha256,
    gitStatus: '',
    gitHead: candidate,
    currentBundleSha256: bundleSha256,
    attestedBundleSha256: bundleSha256,
  };

  assert.equal(isP01PersonActivityDirectorOfflineCandidateBundleCurrent(snapshot), true);
  assert.equal(
    isP01PersonActivityDirectorOfflineCandidateBundleCurrent({
      ...snapshot,
      gitStatus: `?? ${profile.reportPath}`,
    }),
    false,
  );
  assert.equal(
    isP01PersonActivityDirectorOfflineCandidateBundleCurrent({
      ...snapshot,
      gitStatus: `?? ${profile.reportPath}`,
      registeredReportExists: true,
      allowRegisteredReport: true,
    }),
    true,
  );
  assert.equal(
    isP01PersonActivityDirectorOfflineCandidateBundleCurrent({
      ...snapshot,
      gitStatus: `?? ${profile.reportPath}`,
      registeredReportExists: false,
      allowRegisteredReport: true,
    }),
    false,
  );

  for (const gitStatus of [
    '?? docs/live-probes/unrelated.json',
    `?? ${profile.reportPath}\n?? docs/live-probes/unrelated.json`,
    ' M src/changed-file.mjs',
  ]) {
    assert.equal(
      isP01PersonActivityDirectorOfflineCandidateBundleCurrent({
        ...snapshot,
        gitStatus,
        allowRegisteredReport: true,
      }),
      false,
    );
  }

  assert.equal(
    isP01PersonActivityDirectorOfflineCandidateBundleCurrent({
      ...snapshot,
      gitStatus: `?? ${profile.reportPath}`,
      gitHead: 'c'.repeat(40),
      allowRegisteredReport: true,
    }),
    false,
  );
  assert.equal(
    isP01PersonActivityDirectorOfflineCandidateBundleCurrent({
      ...snapshot,
      gitStatus: `?? ${profile.reportPath}`,
      currentBundleSha256: 'd'.repeat(64),
      allowRegisteredReport: true,
    }),
    false,
  );
  assert.equal(
    isP01PersonActivityDirectorOfflineCandidateBundleCurrent({
      ...snapshot,
      gitStatus: `?? ${profile.reportPath}`,
      attestedBundleSha256: 'e'.repeat(64),
      allowRegisteredReport: true,
    }),
    false,
  );
});

test('P01 director v1 runner reconciles an ambiguous permanent latch only as no-report INCONCLUSIVE', () => {
  const status = { state: 'AMBIGUOUS', claim_label_present: true, disposition: null };
  const commands = [];
  const reconciledStatus = {
    state: 'INCONCLUSIVE',
    retry_allowed: false,
    disposition: {
      reportWritten: false,
      claimIdentityRecovered: false,
      ambiguousLatchReconciled: true,
    },
  };
  const result = reconcileP01AmbiguousProfileStatus(240, status, {
    runHarnessCommand: (args) => {
      commands.push(args);
      return {
        exitCode: 0,
        output: { state: 'AGENT_MCP_PROFILE_AMBIGUOUS_LATCH_RECONCILED' },
      };
    },
    readProfileStatusCommand: (prNumber) => {
      assert.equal(prNumber, 240);
      return reconciledStatus;
    },
    reportExists: () => false,
  });
  assert.equal(result, reconciledStatus);
  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0], [
    'epoch:agent-mcp-profile-reconcile-ambiguous',
    '--run',
    '95',
    '--pr',
    '240',
    '--profile-id',
    'p01-person-director-offline-matrix-v1-20261023',
  ]);
});

test('P01 director v1 runner refuses ambiguous reconciliation if a report already exists', () => {
  let harnessCalled = false;
  assert.throws(
    () =>
      reconcileP01AmbiguousProfileStatus(
        240,
        { state: 'AMBIGUOUS', claim_label_present: true, disposition: null },
        {
          runHarnessCommand: () => {
            harnessCalled = true;
            return {
              exitCode: 0,
              output: { state: 'AGENT_MCP_PROFILE_AMBIGUOUS_LATCH_RECONCILED' },
            };
          },
          readProfileStatusCommand: () => ({ state: 'INCONCLUSIVE' }),
          reportExists: () => true,
        },
      ),
    /refusing no-report terminal reconciliation/u,
  );
  assert.equal(harnessCalled, false);
});

test('P01 director v1 replays a REPORT_WRITTEN terminal latch after a lost PR-body write', () => {
  const profile = getAgentMcpProfileById('p01-person-director-offline-matrix-v1-20261023');
  assert.ok(profile);
  const claim = { state: 'CLAIMED', claimId: 'p01-v2-claim-1', ciRunId: '39200000001' };
  const reportSha256 = 'd'.repeat(64);
  const status = {
    state: 'AMBIGUOUS_TERMINAL_LATCH',
    claim_label_present: true,
    terminal_label_present: true,
    terminal_label_description: agentMcpProfileTerminalLabelDescription(
      profile,
      'REPORT_WRITTEN',
      reportSha256,
    ),
    disposition: claim,
  };
  const recorded = [];
  const terminalStatus = {
    state: 'REPORT_WRITTEN',
    retry_allowed: false,
    disposition: { ...claim, reportSha256, reportWritten: true },
  };
  const result = replayP01AmbiguousTerminalLatch(240, status, {
    readProfileStatusCommand: (prNumber) => {
      assert.equal(prNumber, 240);
      return terminalStatus;
    },
    persistProfileResultCommand: (...args) => {
      recorded.push(args);
      return { exitCode: 0 };
    },
    reportExists: () => true,
    readReportSha256: () => reportSha256,
    validateReport: (durableClaim) => {
      assert.equal(durableClaim.claimId, claim.claimId);
      return { passed: true, reportSha256 };
    },
  });
  assert.equal(result, terminalStatus);
  assert.deepEqual(recorded, [[240, claim.claimId, 'REPORT_WRITTEN', reportSha256, null]]);
});

test('P01 director v1 replays a no-report INCONCLUSIVE terminal latch for a durable claim', () => {
  const profile = getAgentMcpProfileById('p01-person-director-offline-matrix-v1-20261023');
  assert.ok(profile);
  const claim = { state: 'CLAIMED', claimId: 'p01-v2-claim-3', ciRunId: '39200000003' };
  const status = {
    state: 'AMBIGUOUS_TERMINAL_LATCH',
    claim_label_present: true,
    terminal_label_present: true,
    terminal_label_description: agentMcpProfileTerminalLabelDescription(profile, 'INCONCLUSIVE'),
    disposition: claim,
  };
  const recorded = [];
  const terminalStatus = {
    state: 'INCONCLUSIVE',
    retry_allowed: false,
    disposition: {
      ...claim,
      reportWritten: false,
      unacceptedReportSha256: null,
    },
  };
  const result = replayP01AmbiguousTerminalLatch(240, status, {
    readProfileStatusCommand: () => terminalStatus,
    persistProfileResultCommand: (...args) => {
      recorded.push(args);
      return { exitCode: 0 };
    },
    reportExists: () => false,
  });
  assert.equal(result, terminalStatus);
  assert.deepEqual(recorded, [
    [
      240,
      claim.claimId,
      'INCONCLUSIVE',
      null,
      {
        schemaVersion: 1,
        reasonCode: 'P01_ACTIVITY_DIRECTOR_V1_TERMINAL_LATCH_REPLAYED',
        checks: { invocationStateUnknown: true },
        counters: {},
      },
    ],
  ]);
});

test('P01 director v1 terminalizes a report acknowledgement after CI reruns during invocation', () => {
  const oldRunId = '39200000001';
  const newRunId = '39200000002';
  const claim = { claimId: 'p01-v2-claim-2', ciRunId: oldRunId };
  const reportSha256 = 'e'.repeat(64);
  const checkNames = [
    'harness-control',
    'sqlite-default',
    'host-integration',
    'standalone-release-smoke',
    'postgres-compat',
    'provider-foundation',
    'discovery-foundation',
  ];
  const claimedStatus = {
    state: 'CLAIMED',
    disposition: { ...claim, state: 'CLAIMED' },
  };
  const terminalStatus = {
    state: 'INCONCLUSIVE',
    retry_allowed: false,
    disposition: {
      ...claim,
      state: 'INCONCLUSIVE',
      reportWritten: false,
      unacceptedReportSha256: reportSha256,
    },
  };
  const persisted = [];
  let reads = 0;
  const result = settleP01ReportAcknowledgement(240, claim, reportSha256, {
    readProfileStatusCommand: () => (reads++ === 0 ? claimedStatus : terminalStatus),
    readPullRequestCommand: (prNumber) => {
      assert.equal(prNumber, 240);
      return {
        statusCheckRollup: checkNames.map((name, index) => ({
          name,
          status: 'QUEUED',
          detailsUrl: `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${newRunId}/job/${index + 1}`,
        })),
      };
    },
    persistProfileResultCommand: (...args) => {
      persisted.push(args);
      return { exitCode: 0 };
    },
    reportExists: () => true,
    validateReport: () => ({ passed: true, reportSha256 }),
  });
  assert.equal(result, terminalStatus);
  assert.deepEqual(persisted, [
    [
      240,
      claim.claimId,
      'INCONCLUSIVE',
      reportSha256,
      {
        schemaVersion: 1,
        reasonCode: 'P01_ACTIVITY_DIRECTOR_V1_REPORT_ACK_STALE_CI',
        checks: { activeGateCurrent: false },
        counters: {},
      },
    ],
  ]);
});

test('P01 director v1 accepts exact structured or text-only readback and rejects disagreement', () => {
  const text = JSON.stringify(summary);
  const structuredAndText = extractP01PersonActivityDirectorOfflineToolProjection({
    isError: false,
    structuredContent: summary,
    content: [{ type: 'text', text }],
  });
  assert.equal(structuredAndText.valid, true);
  assert.equal(
    canonicalAgentMcpProfileJson(structuredAndText.projection),
    canonicalAgentMcpProfileJson(summary),
  );
  assert.equal(
    extractP01PersonActivityDirectorOfflineToolProjection({
      isError: false,
      content: [{ type: 'text', text }],
    }).valid,
    true,
  );
  assert.equal(
    extractP01PersonActivityDirectorOfflineToolProjection({
      isError: false,
      structuredContent: summary,
      content: [{ type: 'text', text: JSON.stringify({ ...summary, matchedDirectorRows: 0 }) }],
    }).valid,
    false,
  );
  assert.equal(
    extractP01PersonActivityDirectorOfflineToolProjection({
      isError: false,
      structuredContent: summary,
      content: [{ type: 'text', text: 'not JSON' }],
    }).valid,
    false,
  );
  assert.equal(
    extractP01PersonActivityDirectorOfflineToolProjection({
      isError: false,
      structuredContent: summary,
      content: [{ type: 'image', data: 'ignored' }],
    }).valid,
    false,
  );
  assert.equal(
    extractP01PersonActivityDirectorOfflineToolProjection({
      isError: true,
      content: [{ type: 'text', text }],
    }).valid,
    false,
  );
  assert.equal(
    extractP01PersonActivityDirectorOfflineToolProjection({
      isError: false,
      structuredContent: summary,
      content: [
        { type: 'text', text },
        { type: 'text', text: 'unexpected extra result' },
      ],
    }).valid,
    false,
  );
});
