import assert from 'node:assert/strict';
import test from 'node:test';
import { observeAgentMcpFailure } from '../../scripts/lib/agent-mcp-failure-observation.mjs';
import { normalizeAgentMcpProfileDiagnostics } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { terminalMcpObservation } from '../../scripts/lib/agent-mcp-terminal-observation.mjs';
import {
  RELATION_MODEL_PROFILE,
  RELATION_MODEL_SERVER_ID,
} from '../../scripts/lib/native-relation-model-profile.mjs';

const observe = (processResult) =>
  observeAgentMcpFailure({
    expected: { server: RELATION_MODEL_SERVER_ID, calls: RELATION_MODEL_PROFILE.calls },
    processResult,
  });

const complete =
  ['thread.started', 'turn.started', 'turn.completed']
    .map((type) => JSON.stringify({ type }))
    .join('\n') + '\n';

test('observation failures round-trip through the canonical Harness terminal schema', () => {
  for (const [process, published, reason] of [
    [{ exitCode: 1, stdoutBytes: 0, stderrBytes: 158 }, true, 'AGENT_MCP_PROCESS_EXIT_NONZERO'],
    [{ exitCode: 0, stdout: '{broken' }, true, 'AGENT_MCP_EVENT_STREAM_INVALID'],
    [
      { exitCode: null, reason: 'AGENT_MCP_PROCESS_CANCELLED' },
      false,
      'AGENT_MCP_PROCESS_CANCELLED',
    ],
    [
      { exitCode: null, reason: 'AGENT_MCP_PROCESS_TIMED_OUT' },
      true,
      'AGENT_MCP_PROCESS_TIMED_OUT',
    ],
    [
      { exitCode: null, reason: 'AGENT_MCP_PROCESS_OUTPUT_LIMIT' },
      true,
      'AGENT_MCP_PROCESS_OUTPUT_LIMIT',
    ],
    [
      { exitCode: null, reason: 'AGENT_MCP_PROCESS_SPAWN_FAILED' },
      true,
      'AGENT_MCP_PROCESS_SPAWN_FAILED',
    ],
    [{ exitCode: 0, stdout: complete }, false, 'AGENT_MCP_DIAGNOSTIC_PUBLICATION_FAILED'],
  ]) {
    const observation = observe(process);
    const terminal = terminalMcpObservation(observation, { diagnosticPublished: published });
    assert.deepEqual(normalizeAgentMcpProfileDiagnostics(terminal), terminal);
    assert.equal(terminal.reasonCode, reason);
    assert.equal(terminal.checks.diagnosticPublished, published);
    assert.equal(terminal.counters.shellCalls, null);
    assert.equal(terminal.counters.codexMcpToolEvents, null);
    assert(!Object.hasOwn(terminal.counters, 'shellToolCalls'));
  }
});

test('observer projection refuses unbranded input and leaves semantic success to the workload', () => {
  const observation = observe({ exitCode: 0, stdout: complete });
  assert.equal(terminalMcpObservation(observation, { diagnosticPublished: true }), null);
  assert.throws(() =>
    terminalMcpObservation(structuredClone(observation), { diagnosticPublished: true }),
  );
});
