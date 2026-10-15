import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  R05_COVERAGE_NOTE,
  R05_PROFILE_ID,
  buildR05McpTextProjection,
  summarizeR05SubjectOverlapToolResult,
  validateR05SelectionEvidence,
  validateR05McpTextProjection,
  verifyR05Answer,
} from '../../scripts/lib/r05-shared-person-overlap-evidence.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';

const profile = getAgentMcpProfileById(R05_PROFILE_ID);
const arguments_ = profile.calls[0].arguments;

function toolResult() {
  const subject = (subjectId, name, nameCn, rowCount, actorCount) => ({
    subjectId,
    state: 'partial',
    subject: { id: subjectId, name, nameCn, type: 'anime' },
    sections: { cast: 'partial', staff: 'complete' },
    coverage: {
      sourceRequestsAttempted: 2,
      sourceRequestsSucceeded: 2,
      cast: { observed: rowCount, returned: rowCount, truncated: false },
      staff: { observed: 0, returned: 0, truncated: false },
    },
    _syntheticPrivateFixtureField: 'must-not-be-retained',
    _actorCount: actorCount,
  });
  return {
    subjectIds: [1424, 3774],
    state: 'partial',
    kind: 'cast',
    castRole: 'all',
    subjects: [
      subject(1424, 'けいおん！', '轻音少女', 37, 38),
      subject(3774, 'けいおん！！', '轻音少女 第二季', 64, 42),
    ],
    pairs: [
      {
        pairId: '1424:3774',
        leftSubjectId: 1424,
        rightSubjectId: 3774,
        rank: 1,
        rankScore: 20,
        rankBasis: 'cast_matched_ids',
        cast: {
          state: 'partial',
          items: [
            {
              personId: 3847,
              name: 'name not persisted',
              career: ['seiyuu'],
              matchBasis: 'all_cast_credits',
              credits: [
                {
                  subjectId: 1424,
                  characters: [
                    {
                      characterId: 1,
                      name: 'character not persisted A',
                      relation: '主角',
                      roleFamily: 'main',
                    },
                  ],
                },
                {
                  subjectId: 3774,
                  characters: [
                    {
                      characterId: 2,
                      name: 'character not persisted B',
                      relation: '主角',
                      roleFamily: 'main',
                    },
                  ],
                },
              ],
            },
          ],
          coverage: {
            state: 'partial',
            left: {
              subjectId: 1424,
              state: 'partial',
              rowsObserved: 37,
              rowsReturned: 37,
              uniqueIdsReturned: 38,
              missingIdRows: 0,
              unknownRoleRows: 0,
              truncated: false,
            },
            right: {
              subjectId: 3774,
              state: 'partial',
              rowsObserved: 64,
              rowsReturned: 64,
              uniqueIdsReturned: 42,
              missingIdRows: 0,
              unknownRoleRows: 0,
              truncated: false,
            },
            candidateIds: 60,
            matchedIds: 20,
            unionIds: 60,
            returned: 1,
            omitted: 19,
            truncated: true,
          },
        },
      },
    ],
    formulaVersion: 'subject-overlap-v1',
    coverage: {
      requestedSubjects: 2,
      returnedSubjects: 2,
      requestedPairs: 1,
      returnedPairs: 1,
      omittedPairs: 0,
      limits: { maxSubjects: 8, maxCast: 80, maxStaff: 48, maxPairs: 1, maxPeople: 8 },
      truncated: true,
    },
    source: {
      official: {
        class: 'official-v0',
        operations: ['GET /v0/subjects/{subject_id}/characters'],
        attemptedAt: '2026-10-15T07:39:00.000Z',
        retrievedAt: '2026-10-15T07:39:01.000Z',
      },
      derived: {
        class: 'derived-s7',
        operations: ['subject-overlap-composition'],
        attemptedAt: '2026-10-15T07:39:00.000Z',
        retrievedAt: '2026-10-15T07:39:01.000Z',
      },
    },
    warnings: [
      {
        code: 'SUBJECT_COVERAGE_DEGRADED',
        state: 'partial',
        subjectId: 1424,
        message: 'do not persist',
      },
    ],
    evidence: [{ rawPayload: 'do not persist' }],
    operationEvidence: [{ rawPayload: 'do not persist' }],
  };
}

test('R05 projection retains exact shared stable ID and both subject bindings only', () => {
  const summary = summarizeR05SubjectOverlapToolResult(toolResult(), arguments_);
  assert.deepEqual(summary.pair.cast.sharedPeople, [
    { personId: 3847, creditSubjectIds: [1424, 3774] },
  ]);
  const serialized = JSON.stringify(summary);
  for (const omitted of [
    'name not persisted',
    'character not persisted',
    'must-not-be-retained',
    'rawPayload',
    'message',
  ]) {
    assert.equal(serialized.includes(omitted), false);
  }
  assert.equal(summary.pair.cast.coverage.truncated, true);
  assert.equal(summary.coverage.limits.maxPeople, 8);
});

test('R05 positive preflight file is exact, anonymous, and bounded', () => {
  const evidence = JSON.parse(
    readFileSync(
      'docs/research/run95-r05-k-on-season-shared-person-preflight-2026-10-15.json',
      'utf8',
    ),
  );
  assert.equal(validateR05SelectionEvidence(evidence), true);
  assert.equal(validateR05SelectionEvidence({ ...evidence, oauthAttempted: true }), false);
  assert.equal(
    validateR05SelectionEvidence({
      ...evidence,
      subjectSearch: { ...evidence.subjectSearch, returnedCount: 2 },
    }),
    false,
  );
});

test('R05 answer accepts only the exact positive person ID, both subjects, and bounded note', () => {
  const summary = summarizeR05SubjectOverlapToolResult(toolResult(), arguments_);
  const answer = JSON.stringify({
    subjectIds: [1424, 3774],
    sharedPerson: { personId: 3847, creditSubjectIds: [1424, 3774] },
    castState: 'partial',
    coverageNote: R05_COVERAGE_NOTE,
  });
  assert.deepEqual(verifyR05Answer(answer, summary), {
    passed: true,
    reason: null,
    answerChecks: {
      validJsonShape: true,
      exactSubjectIds: true,
      exactSharedPersonId: true,
      creditEvidenceForBothSubjects: true,
      castStateCopied: true,
      boundedCoverageDisclosure: true,
      positiveOnlyOutput: true,
    },
  });

  for (const altered of [
    { subjectIds: [1424, 876] },
    { sharedPerson: { personId: 9999, creditSubjectIds: [1424, 3774] } },
    { sharedPerson: { personId: 3847, creditSubjectIds: [1424] } },
    { coverageNote: 'the full relation graph proves these are connected' },
    { extra: 'unsupported claim' },
  ]) {
    const parsed = JSON.parse(answer);
    Object.assign(parsed, altered);
    assert.equal(verifyR05Answer(JSON.stringify(parsed), summary).passed, false);
  }
});

test('R05 rejects mismatched credits, unknown arguments, and a text projection that omits scope', () => {
  const mismatch = toolResult();
  mismatch.pairs[0].cast.items[0].credits[1].subjectId = 876;
  const noPositiveSummary = summarizeR05SubjectOverlapToolResult(mismatch, arguments_);
  assert.deepEqual(noPositiveSummary.pair.cast.sharedPeople, []);
  assert.equal(
    verifyR05Answer(
      JSON.stringify({
        subjectIds: [1424, 3774],
        sharedPerson: { personId: 3847, creditSubjectIds: [1424, 3774] },
        castState: 'partial',
        coverageNote: R05_COVERAGE_NOTE,
      }),
      noPositiveSummary,
    ).passed,
    false,
  );
  assert.throws(
    () => summarizeR05SubjectOverlapToolResult(toolResult(), { ...arguments_, maxCast: 79 }),
    /exact registered K-On/u,
  );

  const summary = summarizeR05SubjectOverlapToolResult(toolResult(), arguments_);
  const projection = buildR05McpTextProjection(summary);
  assert.equal(validateR05McpTextProjection(JSON.stringify(projection), summary).passed, true);
  assert.equal(
    validateR05McpTextProjection(
      JSON.stringify({ ...projection, scopeNote: 'complete graph' }),
      summary,
    ).passed,
    false,
  );
});
