import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runNativePageProcess as runOwnedProcess } from './run-native-entity-page-model.mjs';
import {
  projectRelationModelAnswer,
  relationModelAnswerMatches,
} from '../lib/native-relation-model-answer.mjs';
import {
  buildRelationModelCodexArgs,
  assertRelationModelCliSupport,
  RELATION_MODEL_ANSWER_SCHEMA,
} from '../lib/native-relation-model-cli.mjs';
import { observeAgentMcpFailure } from '../lib/agent-mcp-failure-observation.mjs';
import { publishAgentMcpFailure } from '../lib/agent-mcp-failure-publication.mjs';
import { generateKeyPairSync } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  RELATION_MODEL_PROFILE as P,
  RELATION_MODEL_SERVER_ID as SERVER,
} from '../lib/native-relation-model-profile.mjs';
import {
  canonicalAgentMcpProfileJson as canonical,
  normalizeAgentMcpProfileDiagnostics,
  agentMcpProfileTerminalLabelDescription,
} from '../lib/agent-mcp-profile-claims.mjs';
import {
  relationModelEnvironment,
  relationModelHarness,
  readRelationModelStatus,
  assertRelationModelReviewGate,
  assertRelationModelClaimReadback,
} from '../lib/native-relation-model-gates.mjs';
import { computeMcpBundleSha256, gitRepositoryText } from '../lib/g26-mcp-bundle.mjs';
import {
  parseCodexJsonl,
  summarizeCodexEvents,
  hasExactCompletedCodexToolCalls,
} from './run-g26-codex-agent-mcp.mjs';
import {
  RELATION_MODEL_ROOT as ROOT,
  relationModelSha,
  validRelationModelSnapshot,
  readRelationModelSourceContext,
  buildRelationModelReport,
  writeRelationModelReport,
  validateRelationModelReportFile,
  relationModelResultSha,
} from './native-relation-model-report.mjs';

const MODEL_TIMEOUT_MS = 360000;
const MAX_STDOUT = 8 * 1024 * 1024;

export function readRelationModelSummary(directory) {
  const file = path.join(directory, 'summary.json');
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(descriptor);
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid() ||
      stat.nlink !== 1 ||
      (stat.mode & 0o777) !== 0o600 ||
      stat.size > 65536
    )
      throw new Error();
    return fs.readFileSync(descriptor, 'utf8');
  } finally {
    fs.closeSync(descriptor);
  }
}

export function retainRelationDiagnostic(input, directory, executionDirectory) {
  const observation = observeAgentMcpFailure({
    ...input,
    expected: { server: SERVER, calls: P.calls },
  });
  publishAgentMcpFailure(observation, { directory, executionDirectory });
  const file = path.join(directory, 'agent-mcp-failure-observation.json');
  return { published: true, path: file, sha256: relationModelSha(fs.readFileSync(file)) };
}

export function preflightRelationDiagnosticStorage() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-relation-diagnostic-probe-'));
  const executionDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bgk-relation-execution-probe-'),
  );
  try {
    fs.chmodSync(directory, 0o700);
    fs.chmodSync(executionDirectory, 0o700);
    retainRelationDiagnostic({ stage: 'preflight' }, directory, executionDirectory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
    fs.rmSync(executionDirectory, { recursive: true, force: true });
  }
}
/** The prior bounded process helper is frozen; use the new contract's explicit environment and caps. */
export const runRelationModelProcess = runOwnedProcess;

export function inspectRelationModelResult(processResult, summary, claim) {
  const parsed = parseCodexJsonl(processResult.stdout);
  const events = summarizeCodexEvents(parsed.events);
  const exactCalls =
    isDeepStrictEqual(
      events.toolCalls.map((x) => ({ toolName: x.name, arguments: x.arguments })),
      P.calls,
    ) && hasExactCompletedCodexToolCalls(events.toolCalls, P.toolNames);
  const allowedEvents = new Set([
    'thread.started',
    'turn.started',
    'turn.completed',
    'turn.failed',
    'error',
    'item.started',
    'item.updated',
    'item.completed',
  ]);
  const itemKinds = new Set(['agent_message', 'reasoning', 'mcp_tool_call']);
  const closedEvents =
    parsed.events.every(
      (e) => allowedEvents.has(e.type) && (!e.item || itemKinds.has(e.item.type)),
    ) &&
    ['thread.started', 'turn.started', 'turn.completed'].every(
      (type) => parsed.events.filter((e) => e.type === type).length === 1,
    ) &&
    !parsed.events.some((e) => ['turn.failed', 'error'].includes(e.type));
  const observation = summary?.observation;
  const summaryValid =
    summary?.schema === 'native-relation-safety-server-summary/v1' &&
    summary.sourceMode === 'native-synthetic-relation-safety' &&
    summary.sourceRevision === claim.sourceCandidateSha &&
    summary.bundleSha256 === claim.bundleSha256 &&
    summary.claimSha256 === relationModelSha(canonical(claim)) &&
    /^[0-9a-f-]{36}$/u.test(summary.serverInstanceId ?? '') &&
    isDeepStrictEqual(summary.toolNames, P.toolNames) &&
    validRelationModelSnapshot(observation) &&
    summary.closed === true &&
    summary.captureFailed === false &&
    summary.protocolDenied === 0 &&
    summary.failureCode === null &&
    ['tool', 'cleanup'].includes(summary.lifecycleStage) &&
    Array.isArray(summary.resultSha256) &&
    summary.resultSha256.length === 2;
  let results = null,
    expected = null,
    structured = false;
  try {
    results = events.completedMcpCalls.map((call) => call.result);
    structured =
      summaryValid &&
      results.length === 2 &&
      results.every(
        (result, index) => relationModelResultSha(result) === summary.resultSha256[index],
      );
    if (structured) expected = projectRelationModelAnswer(results);
  } catch {
    structured = false;
  }
  const checks = {
    codexExecutionSucceeded: processResult.exitCode === 0 && processResult.reason === null,
    eventStreamParsed: parsed.parsed && events.eventStreamComplete && closedEvents,
    exactCallSequence: exactCalls,
    exactToolEvents:
      events.codexMcpToolEventCount === 2 &&
      events.codexErrorItemCount === 0 &&
      events.mcpToolErrorResultCount === 0 &&
      events.nonMcpToolEventCount === 0 &&
      events.shellToolCallCount === 0 &&
      isDeepStrictEqual(events.mcpServerNames, [SERVER, SERVER]),
    serverSummaryValid: summaryValid,
    structuredReadback: structured,
    answerValid: structured && relationModelAnswerMatches(events.answer, expected),
  };
  const counters = {
    codexMcpToolEvents: events.codexMcpToolEventCount,
    codexErrorItems: events.codexErrorItemCount,
    mcpToolErrorResults: events.mcpToolErrorResultCount,
    nonMcpToolEvents: events.nonMcpToolEventCount,
    shellToolCalls: events.shellToolCallCount,
    codexStdoutBytes: processResult.stdoutBytes,
    codexStderrBytes: processResult.stderrBytes,
  };
  const passed = Object.values(checks).every((x) => x === true);
  const reason =
    processResult.reason ??
    (!checks.codexExecutionSucceeded
      ? 'AGENT_MCP_PROCESS_EXIT_NONZERO'
      : !checks.eventStreamParsed
        ? 'AGENT_MCP_EVENT_STREAM_INVALID'
        : !summary
          ? 'AGENT_MCP_SUMMARY_MISSING'
          : !summaryValid
            ? 'AGENT_MCP_SUMMARY_INVALID'
            : !checks.exactCallSequence || !checks.exactToolEvents || !structured
              ? 'AGENT_MCP_TOOL_RESULT_INVALID'
              : !checks.answerValid
                ? 'AGENT_MCP_ANSWER_INVALID'
                : null);
  return {
    passed,
    reason,
    checks,
    counters,
    observation,
    results,
    answer: events.answer,
    execution: {
      sourceMode: 'native-synthetic-relation-safety',
      model: P.model,
      reasoningEffort: P.reasoningEffort,
      modelJobs: 1,
      processExitCode: processResult.exitCode,
      eventStreamParsed: checks.eventStreamParsed,
      turnCompleted: events.eventStreamComplete,
      codexMcpToolEventCount: events.codexMcpToolEventCount,
      codexErrorItemCount: events.codexErrorItemCount,
      mcpToolErrorResultCount: events.mcpToolErrorResultCount,
      nonMcpToolEventCount: events.nonMcpToolEventCount,
      shellToolCallCount: events.shellToolCallCount,
      mcpServerNames: events.mcpServerNames,
      eventStreamSha256: relationModelSha(processResult.stdout),
      serverSummarySha256: relationModelSha(canonical(summary ?? null)),
      exactStructuredResults: structured,
      fixtureResponses: observation?.fixtureReads ?? null,
      liveHttpRequests: observation?.liveRequests ?? null,
      cleanupComplete: summaryValid && observation.closed === true,
      protocolDeniedCalls: summary?.protocolDenied ?? null,
      providerInternalHttpCount: null,
      invoiceHardCap: null,
    },
  };
}

function recordResult(claim, state, reportSha256, diagnostics) {
  const args = [
    'epoch:agent-mcp-profile-result',
    '--run',
    '95',
    '--pr',
    String(claim.prNumber),
    '--profile-id',
    P.id,
    '--claim-id',
    claim.claimId,
    '--state',
    state,
  ];
  if (reportSha256) args.push('--report-sha256', reportSha256);
  if (diagnostics) args.push('--diagnostics-json', JSON.stringify(diagnostics));
  const result = relationModelHarness(args);
  if (
    !['AGENT_MCP_PROFILE_RESULT_RECORDED', 'AGENT_MCP_PROFILE_RESULT_ALREADY_RECORDED'].includes(
      result.state,
    ) ||
    result.claimId !== claim.claimId ||
    result.profileId !== P.id ||
    result.resultState !== state ||
    (state === 'REPORT_WRITTEN' && result.reportSha256 !== reportSha256)
  )
    throw new Error('RELATION_MODEL_TERMINAL_ACK_INVALID');
  return { state, profileId: P.id, reportSha256: result.reportSha256 ?? null, retryAllowed: false };
}

/** No execution path: reconcile only the existing immutable claim/artifact. */
export function reconcileRelationModelResult(status, validation, sha, persist) {
  const claim = status?.disposition;
  if (status?.profile_id !== P.id || claim?.profileId !== P.id || claim.retryAllowed !== false)
    throw new Error('RELATION_MODEL_EXISTING_CLAIM_REQUIRED');
  if (status.state === 'REPORT_WRITTEN') {
    if (!validation.passed || sha !== claim.reportSha256)
      throw new Error('RELATION_MODEL_TERMINAL_REPORT_MISMATCH');
    return { state: 'REPORT_WRITTEN', profileId: P.id, reportSha256: sha, retryAllowed: false };
  }
  if (status.state === 'INCONCLUSIVE')
    return { state: 'INCONCLUSIVE', profileId: P.id, retryAllowed: false };
  if (!['CLAIMED', 'AMBIGUOUS_TERMINAL_LATCH'].includes(status.state) || claim.state !== 'CLAIMED')
    throw new Error('RELATION_MODEL_EXISTING_CLAIM_REQUIRED');
  let state = validation.passed ? 'REPORT_WRITTEN' : 'INCONCLUSIVE';
  if (status.terminal_label_present) {
    state = ['REPORT_WRITTEN', 'INCONCLUSIVE'].find((candidate) => {
      try {
        return (
          status.terminal_label_description ===
          agentMcpProfileTerminalLabelDescription(P, candidate, sha)
        );
      } catch {
        return false;
      }
    });
    if (!state) throw new Error('RELATION_MODEL_TERMINAL_LATCH_CONFLICT');
    if (state === 'REPORT_WRITTEN' && !validation.passed)
      throw new Error('RELATION_MODEL_TERMINAL_REPORT_MISMATCH');
  }
  try {
    return persist(claim, state, sha, null);
  } catch (error) {
    if (
      state === 'REPORT_WRITTEN' &&
      error?.controlCode === 'AGENT_MCP_PROFILE_CLAIM_STALE' &&
      !status.terminal_label_present
    ) {
      try {
        return persist(claim, 'INCONCLUSIVE', sha, null);
      } catch {
        /* Preserve the same claim/artifact. */
      }
    }
    return {
      state: state === 'REPORT_WRITTEN' ? 'REPORT_ACK_PENDING' : 'INCONCLUSIVE_ACK_PENDING',
      profileId: P.id,
      reportSha256: sha,
      retryAllowed: false,
    };
  }
}

export async function main(argv = process.argv.slice(2)) {
  if (
    !isDeepStrictEqual(argv, ['--run', '95']) &&
    !isDeepStrictEqual(argv, ['--run', '95', '--reconcile'])
  )
    throw new Error('RELATION_MODEL_RUNNER_ARGS_INVALID');
  const status = relationModelHarness(['status', '--run', '95']);
  const prNumber = status.run?.state?.active_epoch_pr;
  if (!Number.isSafeInteger(prNumber)) throw new Error('RELATION_MODEL_ACTIVE_EPOCH_REQUIRED');
  const profile = readRelationModelStatus(prNumber);
  if (argv.includes('--reconcile')) {
    if (['AMBIGUOUS', 'AMBIGUOUS_TERMINAL_LATCH'].includes(profile.state) && !profile.disposition)
      return relationModelHarness([
        'epoch:agent-mcp-profile-reconcile-ambiguous',
        '--run',
        '95',
        '--pr',
        String(prNumber),
        '--profile-id',
        P.id,
      ]);
    if (!profile.disposition) throw new Error('RELATION_MODEL_EXISTING_CLAIM_REQUIRED');
    const existing = validateRelationModelReportFile(profile.disposition);
    const report = path.join(ROOT, P.reportPath);
    const sha = fs.existsSync(report) ? relationModelSha(fs.readFileSync(report)) : null;
    return reconcileRelationModelResult(profile, existing, sha, recordResult);
  }
  if (
    profile.state !== 'UNCLAIMED' ||
    profile.review_gate?.eligible !== true ||
    fs.existsSync(path.join(ROOT, P.reportPath))
  )
    throw new Error('RELATION_MODEL_UNSPENT_REVIEWED_PROFILE_REQUIRED');
  // Prove the MCP child's sanitized environment can read control state before
  // consuming the global latch; this preflight invokes no model or source API.
  if (readRelationModelStatus(prNumber, { control: false }).state !== 'UNCLAIMED')
    throw new Error('RELATION_MODEL_CHILD_CONTROL_ACCESS_FAILED');
  const sourceRevision = gitRepositoryText(ROOT, ['rev-parse', 'HEAD']);
  const bundleSha256 = computeMcpBundleSha256(ROOT);
  const epoch = relationModelHarness(['status', '--run', '95', '--pr', String(prNumber)]);
  const gate = assertRelationModelReviewGate(epoch, { sourceRevision, bundleSha256 });
  readRelationModelSourceContext(ROOT, sourceRevision);
  const { version } = assertRelationModelCliSupport();
  preflightRelationDiagnosticStorage();
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyBase64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const created = relationModelHarness([
    'epoch:agent-mcp-profile-claim',
    '--run',
    '95',
    '--pr',
    String(prNumber),
    '--profile-id',
    P.id,
    '--bundle-sha256',
    bundleSha256,
    '--reviewer-id',
    gate.reviewerId,
    '--runner-public-key',
    publicKeyBase64,
  ]);
  if (
    created.state !== 'AGENT_MCP_PROFILE_CLAIMED' ||
    created.profileId !== P.id ||
    created.candidateSha !== sourceRevision ||
    created.bundleSha256 !== bundleSha256
  )
    throw new Error('RELATION_MODEL_CLAIM_CREATE_UNCERTAIN');
  // An uncertain claim response never grants authority. No model is launched
  // until this exact key/source and permanent-latch disposition reads back.
  const claimed = readRelationModelStatus(prNumber),
    claim = claimed.disposition;
  if (
    claim?.claimId !== created.claimId ||
    claim?.runnerReceiptPublicKey !== publicKeyBase64 ||
    claim?.sourceCandidateSha !== sourceRevision
  )
    throw new Error('RELATION_MODEL_CLAIM_OWNER_UNCERTAIN');
  assertRelationModelClaimReadback(claimed, claim);
  let directory,
    diagnosticDirectory,
    processResult = null,
    summaryText = null,
    diagnostic = null,
    diagnosticAttempted = false,
    outcome = null,
    inspected,
    stage = 'AGENT_MCP_POSTRUN_GATE_FAILED',
    reportSha256 = null;
  const complete = (value) =>
    (outcome = {
      ...value,
      diagnostic: diagnostic ?? {
        published: false,
        directory: diagnosticDirectory ?? null,
        path: null,
        sha256: null,
      },
      modelObservationReason: inspected?.reason ?? null,
      executionCleanupComplete: !!directory && !fs.existsSync(directory),
    });
  try {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-relation-model-'));
    fs.chmodSync(directory, 0o700);
    diagnosticDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-relation-diagnostic-'));
    fs.chmodSync(diagnosticDirectory, 0o700);
    fs.writeFileSync(
      path.join(directory, 'answer-schema.json'),
      JSON.stringify(RELATION_MODEL_ANSWER_SCHEMA),
      { flag: 'wx', mode: 0o600 },
    );
    const gateFile = path.join(directory, 'gate.json');
    fs.writeFileSync(gateFile, JSON.stringify({ claim }), { flag: 'wx', mode: 0o600 });
    assertRelationModelClaimReadback(readRelationModelStatus(prNumber), claim);
    assertRelationModelReviewGate(
      relationModelHarness(['status', '--run', '95', '--pr', String(prNumber)]),
      {
        sourceRevision,
        bundleSha256,
        expectedClaim: claim,
      },
    );
    stage = 'AGENT_MCP_PROCESS_OBSERVATION_FAILED';
    processResult = await runRelationModelProcess('codex', buildRelationModelCodexArgs(gateFile), {
      timeoutMs: MODEL_TIMEOUT_MS,
      maxStdout: MAX_STDOUT,
      env: relationModelEnvironment(),
    });
    let summary = null;
    try {
      summaryText = readRelationModelSummary(directory);
      summary = JSON.parse(summaryText);
    } catch {
      // An unreadable/missing file and retained malformed JSON are different observations.
      summary = summaryText === null ? null : {};
    }
    inspected = inspectRelationModelResult(processResult, summary, claim);
    stage = 'AGENT_MCP_DIAGNOSTIC_PUBLICATION_FAILED';
    diagnosticAttempted = true;
    diagnostic = retainRelationDiagnostic(
      { processResult, serverSummary: summaryText, stage: 'inspection' },
      diagnosticDirectory,
      directory,
    );
    if (!inspected.passed) {
      stage = inspected.reason;
      throw new Error('RELATION_MODEL_MODEL_OBSERVATION_FAILED');
    }
    stage = 'AGENT_MCP_POSTRUN_GATE_FAILED';
    assertRelationModelClaimReadback(readRelationModelStatus(prNumber), claim);
    assertRelationModelReviewGate(
      relationModelHarness(['status', '--run', '95', '--pr', String(prNumber)]),
      {
        sourceRevision,
        bundleSha256,
        expectedClaim: claim,
      },
    );
    stage = 'AGENT_MCP_POSTRUN_GATE_FAILED';
    fs.rmSync(directory, { recursive: true });
    if (fs.existsSync(directory)) throw new Error('RELATION_MODEL_EXECUTION_CLEANUP_FAILED');
    stage = 'AGENT_MCP_REPORT_BUILD_FAILED';
    const report = buildRelationModelReport(
      {
        claim,
        observation: inspected.observation,
        execution: {
          ...inspected.execution,
          codexCliVersion: version,
          diagnosticPublished: true,
          diagnosticSha256: diagnostic.sha256,
        },
        answer: inspected.answer,
        results: inspected.results,
      },
      privateKey,
    );
    writeRelationModelReport(report);
    reportSha256 = relationModelSha(fs.readFileSync(path.join(ROOT, P.reportPath)));
    stage = 'AGENT_MCP_TERMINAL_ACK_FAILED';
    return complete(recordResult(claim, 'REPORT_WRITTEN', reportSha256, null));
  } catch {
    if (!diagnosticAttempted && diagnosticDirectory && directory && fs.existsSync(directory)) {
      try {
        diagnosticAttempted = true;
        diagnostic = retainRelationDiagnostic(
          { processResult: processResult ?? {}, serverSummary: summaryText, stage: 'cleanup' },
          diagnosticDirectory,
          directory,
        );
      } catch {
        /* Explicit below, never invent retention. */
      }
    }
    if (reportSha256 !== null)
      return complete({
        state: 'REPORT_ACK_PENDING',
        profileId: P.id,
        reportSha256,
        retryAllowed: false,
      });
    const checks = {
      ...(inspected?.checks ?? {
        invocationStateUnknown: stage === 'AGENT_MCP_PROCESS_OBSERVATION_FAILED',
      }),
      diagnosticPublished: !!diagnostic,
    };
    const counters = Object.fromEntries(
      Object.entries(inspected?.counters ?? {}).map(([key, n]) => [
        key,
        n === null ? null : Math.min(n, 10000000),
      ]),
    );
    const diagnostics = normalizeAgentMcpProfileDiagnostics({
      schemaVersion: 1,
      reasonCode: stage,
      checks,
      counters,
    });
    try {
      return complete(recordResult(claim, 'INCONCLUSIVE', null, diagnostics));
    } catch {
      return complete({
        state: 'INCONCLUSIVE_ACK_PENDING',
        profileId: P.id,
        reasonCode: stage,
        diagnostics,
        retryAllowed: false,
      });
    }
  } finally {
    try {
      if (directory && fs.existsSync(directory)) fs.rmSync(directory, { recursive: true });
      if (outcome) outcome.executionCleanupComplete = true;
    } catch {
      if (outcome) outcome.executionCleanupComplete = false;
      // Never replace an already observed terminal result with an invented no-invocation result.
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
    .then((result) => {
      process.stdout.write(JSON.stringify(result) + '\n');
      if (result.state !== 'REPORT_WRITTEN') process.exitCode = 2;
    })
    .catch((error) => {
      const reasonCode = /^RELATION_MODEL_[A-Z_]{1,80}$/u.test(error?.message ?? '')
        ? error.message
        : 'RELATION_MODEL_RUNNER_FAILED';
      process.stdout.write(
        JSON.stringify({
          state: 'NO_QUERY_AUTHORITY',
          reasonCode,
          profileId: P.id,
          retryAllowed: false,
        }) + '\n',
      );
      process.exitCode = 2;
    });
}
