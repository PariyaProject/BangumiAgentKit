import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import {
  P03_V2_PROFILE_ID,
  P03_V3_PROFILE_ID,
  P03_V4_PROFILE_ID,
} from '../../scripts/lib/p03-person-name-cn-evidence.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/p03-mcp-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];
const SERVER_SOURCE = readFileSync(
  new URL('../../apps/mcp/codex-one-tool-mcp-server.mjs', import.meta.url),
  'utf8',
);

test('P03 v2 profile binds the registered exact person-profile call', () => {
  const config = parseCodexOneToolMcpArguments(['--profile-id', P03_V2_PROFILE_ID, ...REQUIRED]);
  assert.equal(config.toolName, 'bangumi.get_person_profile');
  assert.equal(config.profile.id, P03_V2_PROFILE_ID);
  assert.deepEqual(config.expectedArgumentSequence, [config.profile.calls[0].arguments]);
  assert.deepEqual(config.expectedArgumentSequence[0], {
    personId: 19306,
    includeCredits: true,
    maxSubjects: 500,
    maxCharacters: 1,
    includeChronology: false,
  });
});

test('P03 v3 profile binds a distinct five-row person-profile call', () => {
  const config = parseCodexOneToolMcpArguments(['--profile-id', P03_V3_PROFILE_ID, ...REQUIRED]);
  assert.equal(config.profile.id, P03_V3_PROFILE_ID);
  assert.deepEqual(config.expectedArgumentSequence[0], {
    personId: 58609,
    includeCredits: true,
    maxSubjects: 5,
    maxCharacters: 1,
    includeChronology: false,
  });
});

test('P03 v4 profile binds a distinct five-row person-profile call', () => {
  const config = parseCodexOneToolMcpArguments(['--profile-id', P03_V4_PROFILE_ID, ...REQUIRED]);
  assert.equal(config.profile.id, P03_V4_PROFILE_ID);
  assert.deepEqual(config.expectedArgumentSequence[0], {
    personId: 54025,
    includeCredits: true,
    maxSubjects: 5,
    maxCharacters: 1,
    includeChronology: false,
  });
});

test('P03 fresh public profiles return only their exact summary-derived text projection', () => {
  assert.match(SERVER_SOURCE, /createP03McpTextProjection,/u);
  assert.match(SERVER_SOURCE, /P03_FRESH_PUBLIC_PROFILE_IDS,/u);
  const projectionBranch = SERVER_SOURCE.match(
    /if\s*\(P03_FRESH_PUBLIC_PROFILE_IDS\.includes\(config\.profile\?\.id\)\)\s*\{([\s\S]*?)\n\s*\}/u,
  );
  assert.ok(projectionBranch);
  assert.match(projectionBranch[1], /summary\.results\[sequenceIndex\]\?\.resultSummary/u);
  assert.match(
    projectionBranch[1],
    /createP03McpTextProjection\(resultSummary, config\.profile\.id\)/u,
  );
  assert.match(projectionBranch[1], /content:\s*\[\{\s*type:\s*'text'/u);
  assert.doesNotMatch(projectionBranch[1], /structuredContent/u);
  assert.doesNotMatch(projectionBranch[1], /presentMcpToolResult/u);
});
