import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';
import {
  buildC03CodexExecArgs,
  classifyC03ProfileAttempt,
  validateC03RunnerArgs,
  validateC03ServerSummary,
} from '../../scripts/acceptance/run-c03-profile-codex-agent-mcp.mjs';
import {
  agentMcpProfileArgumentsSha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';

const profile = getAgentMcpProfileById('c03-voice-actor-comparison-v1');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('C03 runner accepts only the fixed Run 95 invocation', () => {
  assert.equal(validateC03RunnerArgs(['--help']), 'help');
  assert.equal(validateC03RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateC03RunnerArgs([]));
  assert.throws(() => validateC03RunnerArgs(['--run', '94']));
  assert.throws(() => validateC03RunnerArgs(['--run', '95', '--retry']));
});

test('C03 attempt recovery never starts another call from a durable claim', () => {
  const disposition = { claimId: 'claim-1', state: 'CLAIMED' };
  assert.equal(
    classifyC03ProfileAttempt({ state: 'UNCLAIMED', disposition: null }, false),
    'START',
  );
  assert.equal(
    classifyC03ProfileAttempt({ state: 'UNCLAIMED', disposition: null }, true),
    'REJECT_ORPHAN_REPORT',
  );
  assert.equal(
    classifyC03ProfileAttempt({ state: 'CLAIMED', disposition }, true),
    'RECOVER_EXISTING_REPORT',
  );
  assert.equal(
    classifyC03ProfileAttempt({ state: 'CLAIMED', disposition }, false),
    'FINALIZE_WITHOUT_REPORT',
  );
  assert.equal(
    classifyC03ProfileAttempt({ state: 'REPORT_WRITTEN', disposition }, true),
    'TERMINAL',
  );
  assert.equal(
    classifyC03ProfileAttempt({ state: 'INCONCLUSIVE', disposition }, false),
    'TERMINAL',
  );
  assert.equal(
    classifyC03ProfileAttempt({ state: 'AMBIGUOUS', disposition: null }, false),
    'REJECT',
  );
  assert.equal(classifyC03ProfileAttempt({ state: 'UNCLAIMED' }, false), 'REJECT');
});

test('C03 Codex invocation exposes only the registered MCP tool and disables other routes', () => {
  const args = buildC03CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/c03-summary.json',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  assert.equal(args[0], 'exec');
  assert.ok(args.includes('--strict-config'));
  assert.ok(args.includes('--ephemeral'));
  assert.ok(
    args.includes('mcp_servers.bgk_c03_profile.enabled_tools=["bangumi.get_person_activity"]'),
  );
  for (const forbidden of [
    'features.shell_tool=false',
    'features.browser_use=false',
    'features.computer_use=false',
    'features.multi_agent=false',
    'features.web_search=false',
  ])
    assert.ok(args.includes(forbidden), `missing ${forbidden}`);
  assert.equal(args.at(-1).includes('exactly twice'), true);
  assert.equal(
    args
      .at(-1)
      .includes('Do not request the second call until the first tool result has returned.'),
    true,
  );
  assert.equal(args.at(-1).includes('Do not call any other tool'), true);
});

test('C03 server summary must preserve all coverage fields for both ordered calls', () => {
  const catalogBytes = readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((entry) => entry.name === profile.toolName);
  const summary = {
    serverProfile: 'closed-profile-sequence-anonymous-public-v1',
    profileId: profile.id,
    argumentProfile: profile.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
    toolName: profile.toolName,
    serverToolCount: 1,
    serverToolNames: [profile.toolName],
    expectedCallCount: profile.calls.length,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: profile.calls.length,
    deniedCallCount: 0,
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    results: profile.calls.map((call, sequenceIndex) => ({
      sequenceIndex,
      status: 'SUCCESS',
      resultSummary: {
        personId: call.arguments.personId,
        state: 'complete',
        window: {
          months: call.arguments.windowMonths,
          start: '2023-11-01',
          end: '2026-10-14',
          asOfSemantics: 'calendar_months_ending_on_as_of_date',
        },
        summary: { uniqueSubjects: 0, byRole: [] },
        coverage: {
          relationRowsObserved: 0,
          relationRowsSelected: 0,
          relationRowsDroppedAtLimit: 0,
          subjectDetailsSucceeded: 0,
          subjectDetailsFailed: 0,
          rowsEligible: 0,
          rowsReturned: 0,
          outputTruncated: false,
          staffRoleUnknownRows: 0,
          truncated: false,
        },
        observedRows: [],
      },
    })),
  };
  assert.equal(
    validateC03ServerSummary(summary, summary.sourceRevision, summary.bundleSha256),
    true,
  );

  const omittedCoverage = structuredClone(summary);
  delete omittedCoverage.results[0].resultSummary.coverage.staffRoleUnknownRows;
  assert.equal(
    validateC03ServerSummary(omittedCoverage, summary.sourceRevision, summary.bundleSha256),
    false,
  );

  const unknownCoverage = structuredClone(summary);
  unknownCoverage.results[0].resultSummary.coverage.relationRowsSelected = null;
  assert.equal(
    validateC03ServerSummary(unknownCoverage, summary.sourceRevision, summary.bundleSha256),
    true,
  );

  const invalidCoverage = structuredClone(summary);
  invalidCoverage.results[1].resultSummary.coverage.staffRoleUnknownRows = -1;
  assert.equal(
    validateC03ServerSummary(invalidCoverage, summary.sourceRevision, summary.bundleSha256),
    false,
  );
});

test('C03 MCP server preserves missing truncation counters as unknown', () => {
  const result = summarizeProfileToolResult(
    {
      state: 'complete',
      window: {
        months: 36,
        start: '2023-11-01',
        end: '2026-10-14',
        asOfSemantics: 'calendar_months_ending_on_as_of_date',
      },
      summary: { uniqueSubjects: 0, byRole: [] },
      coverage: {},
      rows: [],
    },
    profile.calls[0].arguments,
  );
  assert.equal(result.coverage.outputTruncated, null);
  assert.equal(result.coverage.truncated, null);
  for (const field of [
    'relationRowsObserved',
    'relationRowsSelected',
    'relationRowsDroppedAtLimit',
    'subjectDetailsSucceeded',
    'subjectDetailsFailed',
    'rowsEligible',
    'rowsReturned',
    'staffRoleUnknownRows',
  ])
    assert.equal(result.coverage[field], null, field);
});
