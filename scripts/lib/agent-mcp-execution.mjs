import { normalizeAgentMcpProfileDiagnostics } from './agent-mcp-profile-claims.mjs';

const MAX_COUNTER = 10_000_000;
const count = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? Math.min(value, MAX_COUNTER) : null;

/** Discard stderr and exception text at the process boundary, keeping bounded facts. */
export function summarizeAgentMcpProcess(result) {
  const stdout = typeof result?.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result?.stderr === 'string' ? result.stderr : '';
  const errorCode = result?.error?.code;
  const spawned =
    (Number.isSafeInteger(result?.pid) && result.pid > 0) ||
    Number.isInteger(result?.status) ||
    Boolean(result?.signal)
      ? true
      : ['ENOENT', 'EACCES', 'ENOMEM'].includes(errorCode)
        ? false
        : null;
  const timedOut = errorCode === 'ETIMEDOUT';
  const outputLimitExceeded = errorCode === 'ENOBUFS';
  const exitCode = Number.isInteger(result?.status) ? result.status : null;
  return {
    exitCode,
    stdout,
    failed: Boolean(result?.error) || exitCode !== 0,
    processFacts: {
      spawned,
      timedOut,
      outputLimitExceeded,
      stdoutBytes: count(Buffer.byteLength(stdout)),
      stderrBytes: count(Buffer.byteLength(stderr)),
      countsClamped:
        Buffer.byteLength(stdout) > MAX_COUNTER || Buffer.byteLength(stderr) > MAX_COUNTER,
    },
  };
}

/** The shared four-field terminal envelope never contains output, paths or messages. */
export function agentMcpExecutionDiagnostics(
  reasonCode,
  { execution, parsed, events, checks, summary },
) {
  const process = execution?.processFacts;
  const counterInputs = {
    processExitCode: execution?.exitCode,
    codexStdoutBytes:
      process?.stdoutBytes ??
      Buffer.byteLength(typeof execution?.stdout === 'string' ? execution.stdout : ''),
    codexStderrBytes: process?.stderrBytes,
    codexMcpToolEvents: events?.codexMcpToolEventCount,
    codexErrorItems: events?.codexErrorItemCount,
    mcpToolErrorResults: events?.mcpToolErrorResultCount,
    nonMcpToolEvents: events?.nonMcpToolEventCount,
    shellCalls: events?.shellToolCallCount,
    allowedToolCalls: summary?.allowedCallCount,
    deniedToolCalls: summary?.deniedCallCount,
    httpRequests: summary?.offlineFixture?.requestCount,
  };
  const counters = Object.fromEntries(
    Object.entries(counterInputs).map(([key, value]) => [key, count(value)]),
  );
  return normalizeAgentMcpProfileDiagnostics({
    schemaVersion: 1,
    reasonCode,
    checks: {
      codexExecutionSucceeded: execution?.failed === false && execution?.exitCode === 0,
      diagnosticCountersClamped:
        process?.countsClamped === true ||
        Object.values(counterInputs).some(
          (value) => typeof value === 'number' && value > MAX_COUNTER,
        ),
      eventStreamSyntaxValid: parsed?.parsed === true,
      eventStreamComplete: events?.eventStreamComplete === true,
      eventStreamParsed: parsed?.parsed === true && events?.eventStreamComplete === true,
      turnCompleted: events?.turnCompleted === true,
      ...(process
        ? {
            ...(typeof process.spawned === 'boolean' ? { processSpawned: process.spawned } : {}),
            invocationStateUnknown: process.spawned === null,
            processTimedOut: process.timedOut === true,
            outputLimitExceeded: process.outputLimitExceeded === true,
          }
        : {}),
      ...checks,
    },
    counters,
  });
}

/** Preserve the earliest failed stage; artifact/report work starts only after this succeeds. */
export function firstAgentMcpExecutionFailure(context) {
  const { execution, parsed, events, checks } = context;
  let reasonCode;
  if (execution?.failed !== false || execution?.exitCode !== 0) {
    reasonCode = execution?.processFacts?.timedOut
      ? 'AGENT_MCP_PROCESS_TIMED_OUT'
      : execution?.processFacts?.outputLimitExceeded
        ? 'AGENT_MCP_PROCESS_OUTPUT_LIMIT'
        : execution?.processFacts?.spawned === false
          ? 'AGENT_MCP_PROCESS_SPAWN_FAILED'
          : Number.isInteger(execution?.exitCode)
            ? 'AGENT_MCP_PROCESS_EXIT_NONZERO'
            : 'AGENT_MCP_PROCESS_OBSERVATION_FAILED';
  } else if (parsed?.parsed !== true || events?.eventStreamComplete !== true) {
    reasonCode = 'AGENT_MCP_EVENT_STREAM_INVALID';
  } else if (
    checks.exactCallSequence !== true ||
    checks.exactToolEvents !== true ||
    checks.mcpToolErrorResultCountZero !== true ||
    (Object.hasOwn(checks, 'codexErrorCountsMatch') && checks.codexErrorCountsMatch !== true) ||
    checks.safeWebSearchErrorClassification !== true
  ) {
    reasonCode = 'AGENT_MCP_TOOL_RESULT_INVALID';
  } else if (checks.serverSummaryPresent !== true) {
    reasonCode = 'AGENT_MCP_SUMMARY_MISSING';
  } else if (checks.serverSummaryValid !== true) {
    reasonCode = 'AGENT_MCP_SUMMARY_INVALID';
  } else if (checks.answerValid !== true) {
    reasonCode = 'AGENT_MCP_ANSWER_INVALID';
  } else if (checks.candidateBundleCurrent !== true) {
    reasonCode = 'AGENT_MCP_CANDIDATE_BUNDLE_INVALID';
  }
  return reasonCode ? agentMcpExecutionDiagnostics(reasonCode, context) : null;
}
