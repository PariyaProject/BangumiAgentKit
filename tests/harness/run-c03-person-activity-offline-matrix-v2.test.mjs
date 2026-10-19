import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertC03PersonActivityOfflineV2CandidateGate,
  buildC03PersonActivityOfflineV2CodexExecArgs,
  c03ClaimMatchesCurrentCi,
  c03ObservedCiRunId,
  extractC03PersonActivityOfflineV2ToolProjection,
  isC03PersonActivityOfflineV2CandidateBundleCurrent,
  replayC03AmbiguousTerminalLatch,
  reconcileC03AmbiguousProfileStatus,
  settleC03ReportAcknowledgement,
  validateC03PersonActivityOfflineV2RunnerArgs,
} from '../../scripts/acceptance/run-c03-person-activity-offline-matrix-v2.mjs';
import {
  agentMcpProfileTerminalLabelDescription,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';

const summary = {
  resultState: 'partial',
  windowMonths: 12,
  uniqueSubjects: 1,
  roleCounts: { main: 1, support: 0, unknown: 0 },
  coverage: {
    relationRowsObserved: 1,
    relationRowsSelected: 1,
    relationRowsDroppedAtLimit: 0,
    subjectDetailsSucceeded: 1,
    subjectDetailsFailed: 0,
    rowsEligible: 1,
    rowsReturned: 1,
    unknownRoleRows: 0,
    outputTruncated: false,
    truncated: false,
  },
};

test('C03 v2 Codex invocation constrains one tool, Luna Max, and JSON output schema', () => {
  const args = buildC03PersonActivityOfflineV2CodexExecArgs({
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
      'mcp_servers.bgk_c03_person_activity_offline_v2.enabled_tools=["bangumi.get_person_activity"]',
    ),
    true,
  );
  assert.equal(args.at(-1).includes('personId'), true);
});

test('C03 v2 runner accepts only its fixed one-shot invocation', () => {
  assert.equal(validateC03PersonActivityOfflineV2RunnerArgs(['--help']), 'help');
  assert.equal(validateC03PersonActivityOfflineV2RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateC03PersonActivityOfflineV2RunnerArgs([]));
  assert.throws(() => validateC03PersonActivityOfflineV2RunnerArgs(['--run', '95', '--retry']));
});

test('C03 v2 invocation gate rejects a Base change after the review PASS', () => {
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
    git: { status: '', head: candidate, branch: 'codex/c03-v2' },
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
        epoch_id: 'run95-c03-person-activity-offline-agent-mcp-matrix-v2-20261019',
        branch: 'codex/c03-v2',
        pr_number: 42,
        base_branch: 'master',
        base_sha: base,
        reviewed_base_sha: base,
        candidate_sha: candidate,
        review_pass_sha: candidate,
        ci: { sha: candidate, status: 'SUCCESS', url: ciRunUrl },
        state: 'REVIEW_PASSED',
        advances_frontier_ids: ['C03'],
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
    headRefName: 'codex/c03-v2',
    headRefOid: candidate,
    statusCheckRollup: checks,
  };
  const currentGate = assertC03PersonActivityOfflineV2CandidateGate(status, pr, {
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
  assert.equal(c03ClaimMatchesCurrentCi(profileStatus, currentGate, claim), true);

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
  const rerunGate = assertC03PersonActivityOfflineV2CandidateGate(rerunStatus, rerunPr, {
    sourceRevision: candidate,
    currentBaseSha: base,
    gitStatus: '',
    gitHead: candidate,
  });
  assert.equal(rerunGate.ciRunId, rerunId);
  assert.equal(c03ClaimMatchesCurrentCi(profileStatus, rerunGate, claim), false);
  assert.equal(c03ObservedCiRunId(rerunPr.statusCheckRollup), rerunId);

  assert.throws(() =>
    assertC03PersonActivityOfflineV2CandidateGate(status, pr, {
      sourceRevision: candidate,
      currentBaseSha: 'c'.repeat(40),
      gitStatus: '',
      gitHead: candidate,
    }),
  );
});

test('C03 v2 post-write candidate check allows only its registered report', () => {
  const profile = getAgentMcpProfileById('c03-person-activity-offline-agent-mcp-matrix-v2');
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

  assert.equal(isC03PersonActivityOfflineV2CandidateBundleCurrent(snapshot), true);
  assert.equal(
    isC03PersonActivityOfflineV2CandidateBundleCurrent({
      ...snapshot,
      gitStatus: `?? ${profile.reportPath}`,
    }),
    false,
  );
  assert.equal(
    isC03PersonActivityOfflineV2CandidateBundleCurrent({
      ...snapshot,
      gitStatus: `?? ${profile.reportPath}`,
      registeredReportExists: true,
      allowRegisteredReport: true,
    }),
    true,
  );
  assert.equal(
    isC03PersonActivityOfflineV2CandidateBundleCurrent({
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
      isC03PersonActivityOfflineV2CandidateBundleCurrent({
        ...snapshot,
        gitStatus,
        allowRegisteredReport: true,
      }),
      false,
    );
  }

  assert.equal(
    isC03PersonActivityOfflineV2CandidateBundleCurrent({
      ...snapshot,
      gitStatus: `?? ${profile.reportPath}`,
      gitHead: 'c'.repeat(40),
      allowRegisteredReport: true,
    }),
    false,
  );
  assert.equal(
    isC03PersonActivityOfflineV2CandidateBundleCurrent({
      ...snapshot,
      gitStatus: `?? ${profile.reportPath}`,
      currentBundleSha256: 'd'.repeat(64),
      allowRegisteredReport: true,
    }),
    false,
  );
  assert.equal(
    isC03PersonActivityOfflineV2CandidateBundleCurrent({
      ...snapshot,
      gitStatus: `?? ${profile.reportPath}`,
      attestedBundleSha256: 'e'.repeat(64),
      allowRegisteredReport: true,
    }),
    false,
  );
});

test('C03 v2 runner reconciles an ambiguous permanent latch only as no-report INCONCLUSIVE', () => {
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
  const result = reconcileC03AmbiguousProfileStatus(240, status, {
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
    'c03-person-activity-offline-agent-mcp-matrix-v2',
  ]);
});

test('C03 v2 runner refuses ambiguous reconciliation if a report already exists', () => {
  let harnessCalled = false;
  assert.throws(
    () =>
      reconcileC03AmbiguousProfileStatus(
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

test('C03 v2 replays a REPORT_WRITTEN terminal latch after a lost PR-body write', () => {
  const profile = getAgentMcpProfileById('c03-person-activity-offline-agent-mcp-matrix-v2');
  assert.ok(profile);
  const claim = { state: 'CLAIMED', claimId: 'c03-v2-claim-1', ciRunId: '39200000001' };
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
  const result = replayC03AmbiguousTerminalLatch(240, status, {
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

test('C03 v2 replays a no-report INCONCLUSIVE terminal latch for a durable claim', () => {
  const profile = getAgentMcpProfileById('c03-person-activity-offline-agent-mcp-matrix-v2');
  assert.ok(profile);
  const claim = { state: 'CLAIMED', claimId: 'c03-v2-claim-3', ciRunId: '39200000003' };
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
  const result = replayC03AmbiguousTerminalLatch(240, status, {
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
        reasonCode: 'C03_ACTIVITY_V2_TERMINAL_LATCH_REPLAYED',
        checks: { invocationStateUnknown: true },
        counters: {},
      },
    ],
  ]);
});

test('C03 v2 terminalizes a report acknowledgement after CI reruns during invocation', () => {
  const oldRunId = '39200000001';
  const newRunId = '39200000002';
  const claim = { claimId: 'c03-v2-claim-2', ciRunId: oldRunId };
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
  const result = settleC03ReportAcknowledgement(240, claim, reportSha256, {
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
        reasonCode: 'C03_ACTIVITY_V2_REPORT_ACK_STALE_CI',
        checks: { activeGateCurrent: false },
        counters: {},
      },
    ],
  ]);
});

test('C03 v2 accepts exact structured or text-only readback and rejects disagreement', () => {
  const text = JSON.stringify(summary);
  const structuredAndText = extractC03PersonActivityOfflineV2ToolProjection({
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
    extractC03PersonActivityOfflineV2ToolProjection({
      isError: false,
      content: [{ type: 'text', text }],
    }).valid,
    true,
  );
  assert.equal(
    extractC03PersonActivityOfflineV2ToolProjection({
      isError: false,
      structuredContent: summary,
      content: [{ type: 'text', text: JSON.stringify({ ...summary, uniqueSubjects: 0 }) }],
    }).valid,
    false,
  );
  assert.equal(
    extractC03PersonActivityOfflineV2ToolProjection({
      isError: false,
      structuredContent: summary,
      content: [{ type: 'text', text: 'not JSON' }],
    }).valid,
    false,
  );
  assert.equal(
    extractC03PersonActivityOfflineV2ToolProjection({
      isError: false,
      structuredContent: summary,
      content: [{ type: 'image', data: 'ignored' }],
    }).valid,
    false,
  );
  assert.equal(
    extractC03PersonActivityOfflineV2ToolProjection({
      isError: true,
      content: [{ type: 'text', text }],
    }).valid,
    false,
  );
  assert.equal(
    extractC03PersonActivityOfflineV2ToolProjection({
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
