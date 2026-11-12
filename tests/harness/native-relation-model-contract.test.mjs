import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RELATION_MODEL_PROFILE as P,
  isRelationModelProfile,
} from '../../scripts/lib/native-relation-model-profile.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { profileExecutionModelMatches } from '../../scripts/lib/agent-mcp-execution-model.mjs';
import { profileRequiresExactCiRunEvidence } from '../../scripts/lib/agent-mcp-profile-ci-evidence.mjs';
import {
  buildRelationModelCodexArgs,
  RELATION_MODEL_ANSWER_SCHEMA,
} from '../../scripts/lib/native-relation-model-cli.mjs';
import { relationModelWireResult } from '../../scripts/lib/native-relation-model-answer.mjs';
import { observeAgentMcpFailure } from '../../scripts/lib/agent-mcp-failure-observation.mjs';

test('new exact profile preserves both fixed native calls and immutable registered metadata', () => {
  assert(isRelationModelProfile(getAgentMcpProfileById(P.id)));
  assert.equal(P.model, 'gpt-6.1-sol');
  assert.equal(P.reasoningEffort, 'xhigh');
  assert.equal(P.calls.length, 2);
  assert(profileExecutionModelMatches(P));
  assert(profileRequiresExactCiRunEvidence(P.id));
  assert.equal(profileExecutionModelMatches({ ...P, reasoningEffort: 'max' }), false);
  assert.equal(P.calls[0].arguments.subjectId, P.calls[1].arguments.subjectId);
  assert.equal(P.calls[1].arguments.media, 'all');
  const bad = structuredClone(P);
  bad.calls[1].arguments.depth = 2;
  assert.equal(isRelationModelProfile(bad), false);
  assert.throws(() => {
    P.calls[0].arguments.subjectId = 1;
  }, TypeError);
});

test('CLI plan isolates the finite workload and schema without supplying hidden expected answers', () => {
  const argv = buildRelationModelCodexArgs('/tmp/relation-model-cli-test/gate.json');
  for (const flag of [
    '--ignore-user-config',
    '--strict-config',
    '--ephemeral',
    '--json',
    '--skip-git-repo-check',
    '--output-schema',
  ])
    assert(argv.includes(flag));
  assert.equal(argv[argv.indexOf('--cd') + 1], '/tmp/relation-model-cli-test');
  assert.equal(argv[argv.indexOf('--model') + 1], P.model);
  assert.equal(argv[argv.indexOf('--sandbox') + 1], 'read-only');
  assert(argv.includes('project_doc_max_bytes=0'));
  assert(argv.includes('features.skip_host_skill_discovery=true'));
  assert(argv.includes('features.goals=false'));
  assert(argv.includes('features.shell_tool=false'));
  assert(
    argv.includes('mcp_servers.bgk_native_relation_safety.default_tools_approval_mode="approve"'),
  );
  assert(
    argv.includes(
      'mcp_servers.bgk_native_relation_safety.enabled_tools=' + JSON.stringify(P.toolNames),
    ),
  );
  for (const hidden of ['9632002', '9632003', '9632004', '9632005'])
    assert.equal(argv.at(-1).includes(hidden), false);
  assert.equal(RELATION_MODEL_ANSWER_SCHEMA.additionalProperties, false);
  assert.deepEqual(RELATION_MODEL_ANSWER_SCHEMA.required, [
    'sourceSubjectId',
    'directRows',
    'steps',
    'exclusions',
    'coverage',
    'scope',
  ]);
  assert.throws(
    () => buildRelationModelCodexArgs('relative/gate.json'),
    /RELATION_MODEL_CLI_PATH_INVALID/u,
  );
});

test('strict wire aliases preserve normal semantics and reject malformed error flags', () => {
  const good = {
    content: [{ type: 'text', text: '{}' }],
    structured_content: { safe: true },
    is_error: false,
  };
  assert.deepEqual(relationModelWireResult(good).structuredContent, { safe: true });
  assert.throws(
    () => relationModelWireResult({ ...good, structuredContent: { conflict: true } }),
    /RELATION_MODEL_WIRE_RESULT_INVALID/u,
  );
  assert.throws(
    () => relationModelWireResult({ ...good, is_error: 1 }),
    /RELATION_MODEL_WIRE_RESULT_INVALID/u,
  );
});

test('native summary is reported, bounded and redacted without verification or retry authority', () => {
  const secret = 'untrusted-private-canary';
  const make = (observation) =>
    observeAgentMcpFailure({
      expected: { server: 'bgk_native_relation_safety', calls: P.calls },
      serverSummary: JSON.stringify({
        schema: 'native-relation-safety-server-summary/v1',
        sourceMode: 'native-synthetic-relation-safety',
        observation,
        closed: true,
        lifecycleStage: 'startup',
        failureCode: 'RELATION_MODEL_SERVER_START_FAILED',
        message: secret,
      }),
    });
  const missing = make(null);
  assert.equal(missing.native.fixtureReads, null);
  assert.equal(missing.native.reportedFailureCode, 'RELATION_MODEL_SERVER_START_FAILED');
  const observed = make({
    contract: 'native-relation-safety-v1',
    phase: 'DIRECT_VERIFIED',
    fixtureReads: 1,
    completedCalls: 1,
    denied: 0,
    failure: { code: secret, stage: secret },
  });
  assert.equal(observed.native.reportedPhase, 'DIRECT_VERIFIED');
  assert.equal(observed.native.reportedFailureCode, null);
  assert.equal(observed.native.reportedNativeStage, null);
  assert.equal(JSON.stringify(observed).includes(secret), false);
  assert.equal(
    make({ contract: 'native-relation-safety-v1', fixtureReads: 6 }).native.fixtureReads,
    null,
  );
  assert.equal(make({ contract: 'unrecognized' }).native.status, 'invalid');
  assert.deepEqual(observed.verified, {
    model: false,
    source: false,
    artifact: false,
    cleanup: false,
  });
  assert.equal(observed.acceptanceCredit, false);
  assert.equal(observed.retryAllowed, false);
});
