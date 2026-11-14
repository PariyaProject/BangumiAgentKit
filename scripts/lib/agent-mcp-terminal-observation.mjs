import { agentMcpExecutionDiagnostics } from './agent-mcp-execution.mjs';
import { isProducedFailureObservation } from './agent-mcp-failure-observation.mjs';

const PROCESS_FAILURES = new Map([
  ['timeout', 'AGENT_MCP_PROCESS_TIMED_OUT'],
  ['output_limit', 'AGENT_MCP_PROCESS_OUTPUT_LIMIT'],
  ['spawn_failed', 'AGENT_MCP_PROCESS_SPAWN_FAILED'],
  ['cancelled', 'AGENT_MCP_PROCESS_CANCELLED'],
]);

/** Project a locally produced observation into the canonical Harness envelope. */
export function terminalMcpObservation(observation, { diagnosticPublished }) {
  if (!isProducedFailureObservation(observation) || typeof diagnosticPublished !== 'boolean')
    throw new TypeError('TERMINAL_MCP_OBSERVATION_INVALID');

  const { process, stream } = observation;
  const reason =
    PROCESS_FAILURES.get(process.reason) ??
    (process.reason === 'unrecognized' || process.exitCode === null
      ? 'AGENT_MCP_PROCESS_OBSERVATION_FAILED'
      : process.exitCode !== 0
        ? 'AGENT_MCP_PROCESS_EXIT_NONZERO'
        : stream.status !== 'complete'
          ? 'AGENT_MCP_EVENT_STREAM_INVALID'
          : !diagnosticPublished
            ? 'AGENT_MCP_DIAGNOSTIC_PUBLICATION_FAILED'
            : null);
  // Complete successful streams need their own semantic/source/answer verdict.
  if (reason === null) return null;
  return agentMcpExecutionDiagnostics(reason, {
    execution: {
      exitCode: process.exitCode,
      failed: process.reason !== null || process.exitCode !== 0,
      processFacts: {
        spawned:
          process.reason === 'spawn_failed' ? false : process.exitCode === null ? null : true,
        timedOut: process.reason === 'timeout',
        outputLimitExceeded: process.reason === 'output_limit',
        stdoutBytes: process.reportedStdoutBytes,
        stderrBytes: process.reportedStderrBytes,
      },
    },
    parsed: { parsed: stream.status === 'complete' },
    events: {
      eventStreamComplete: stream.status === 'complete',
      turnCompleted: stream.status === 'complete',
      // Calls are deduplicated and bounded by the observer; their length is not an event count.
      codexMcpToolEventCount: null,
      codexErrorItemCount: stream.status === 'complete' ? stream.errorItems : null,
      nonMcpToolEventCount: stream.status === 'complete' ? stream.nonMcpItems : null,
      mcpToolErrorResultCount: null,
      shellToolCallCount: null,
    },
    checks: { diagnosticPublished },
  });
}
