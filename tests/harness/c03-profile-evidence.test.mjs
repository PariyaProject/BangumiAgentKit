import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildC03ObservedComparison,
  summarizeC03ActorResult,
  verifyC03Answer,
} from '../../scripts/lib/c03-profile-evidence.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';

const profile = getAgentMcpProfileById('c03-voice-actor-comparison-v1');
const makeActor = (personId, subjectIds, main, state = 'partial') => ({
  personId,
  state,
  window: {
    months: 36,
    start: '2023-11-01',
    end: '2026-10-31',
    asOfSemantics: 'calendar_months_ending_on_as_of_date',
  },
  uniqueSubjects: 4,
  roleCounts: { main, support: 2, unknown: 1 },
  observedRows: subjectIds.map((subjectId, index) => ({
    subjectId,
    roleFamily: index === 0 ? 'main' : 'support',
  })),
  coverage: {
    relationRowsObserved: 12,
    relationRowsSelected: 8,
    relationRowsDroppedAtLimit: 4,
    subjectDetailsSucceeded: 8,
    subjectDetailsFailed: 0,
    rowsEligible: 4,
    rowsReturned: subjectIds.length,
    outputTruncated: false,
    unknownRoleRows: 1,
    truncated: true,
  },
});

test('C03 actor projection retains only bounded public ids and coverage, not names', () => {
  const expected = profile.calls[0].arguments;
  const projected = summarizeC03ActorResult(
    {
      state: 'partial',
      window: {
        months: 36,
        start: '2023-11-01',
        end: '2026-10-31',
        asOfSemantics: 'calendar_months_ending_on_as_of_date',
      },
      summary: {
        uniqueSubjects: 4,
        byRole: [
          { key: 'main', creditRows: 1, uniqueSubjects: 1 },
          { key: 'support', creditRows: 2, uniqueSubjects: 2 },
          { key: 'unknown', creditRows: 1, uniqueSubjects: 1 },
        ],
      },
      coverage: {
        relationRowsObserved: 12,
        relationRowsSelected: 8,
        rowsReturned: 2,
        staffRoleUnknownRows: 3,
      },
      rows: [
        { subjectId: 100, subjectName: 'private-ish public title', roleFamily: 'main' },
        { subjectId: 101, subjectNameCn: 'another title', roleFamily: 'support' },
      ],
    },
    expected,
  );
  assert.deepEqual(projected.observedRows, [
    { subjectId: 100, roleFamily: 'main' },
    { subjectId: 101, roleFamily: 'support' },
  ]);
  assert.equal(JSON.stringify(projected).includes('title'), false);
  assert.equal(projected.coverage.relationRowsDroppedAtLimit, null);
  assert.equal(projected.coverage.unknownRoleRows, 3);
  assert.throws(
    () =>
      summarizeC03ActorResult(
        {
          state: 'partial',
          window: {
            months: 36,
            start: '2023-11-01',
            end: '2026-10-31',
            asOfSemantics: 'calendar_months_ending_on_as_of_date',
          },
          summary: {
            uniqueSubjects: 1,
            byRole: [{ key: 'staff', creditRows: 1, uniqueSubjects: 1 }],
          },
          coverage: {},
          rows: [],
        },
        expected,
      ),
    /non-voice role bucket/u,
  );
});

test('C03 comparison reports observed overlap only and computes role shares', () => {
  const firstPersonId = profile.calls[0].arguments.personId;
  const secondPersonId = profile.calls[1].arguments.personId;
  const actors = [
    makeActor(firstPersonId, [10, 20, 30], 2),
    makeActor(secondPersonId, [20, 30, 40], 1),
  ];
  const comparison = buildC03ObservedComparison(actors);
  assert.deepEqual(comparison.observedSubjectIds, [
    [10, 20, 30],
    [20, 30, 40],
  ]);
  assert.deepEqual(comparison.sharedSubjectIds, [20, 30]);
  assert.equal(comparison.observedCommonCount, 2);
  assert.equal(comparison.observedMainRoleShares[0].ratio, 0.5);
  assert.equal(comparison.observedMainRoleShares[1].ratio, 0.25);
  assert.equal(comparison.coveragePartial, true);
  assert.throws(() => buildC03ObservedComparison([actors[0]]), /exact registered actor pair/u);
});

test('C03 comparison marks missing unknown-role coverage as partial', () => {
  const actors = profile.calls.map((call) =>
    makeActor(call.arguments.personId, [10, 20], 1, 'complete'),
  );
  for (const actor of actors) {
    actor.coverage.relationRowsDroppedAtLimit = 0;
    actor.coverage.subjectDetailsFailed = 0;
    actor.coverage.unknownRoleRows = 0;
    actor.coverage.truncated = false;
  }
  actors[0].coverage.unknownRoleRows = null;
  assert.equal(buildC03ObservedComparison(actors).coveragePartial, true);
});

test('C03 comparison requires identical observed calendar windows', () => {
  const actors = profile.calls.map((call) => makeActor(call.arguments.personId, [10, 20], 1));
  actors[1].window.end = '2026-11-01';
  assert.throws(() => buildC03ObservedComparison(actors), /same observed calendar window/u);
});

test('C03 answer checker rejects invented overlap, shares, or complete-coverage wording', () => {
  const firstPersonId = profile.calls[0].arguments.personId;
  const secondPersonId = profile.calls[1].arguments.personId;
  const actors = [
    makeActor(firstPersonId, [10, 20, 30], 2),
    makeActor(secondPersonId, [20, 30, 40], 1),
  ];
  const valid = {
    schemaVersion: 1,
    sharedSubjectIds: [20, 30],
    observedCommonCount: 2,
    observedMainRoleShares: [
      { personId: firstPersonId, numerator: 2, denominator: 4, ratio: 0.5, state: 'partial' },
      { personId: secondPersonId, numerator: 1, denominator: 4, ratio: 0.25, state: 'partial' },
    ],
    coverageNote:
      'Bounded 有限 current response; unreturned 未返回 works are not complete and do not prove absence.',
  };
  assert.equal(verifyC03Answer(JSON.stringify(valid), actors).passed, true);
  const reorderedShare = structuredClone(valid);
  reorderedShare.observedMainRoleShares[0] = {
    state: 'partial',
    ratio: 0.5,
    denominator: 4,
    numerator: 2,
    personId: firstPersonId,
  };
  assert.equal(verifyC03Answer(JSON.stringify(reorderedShare), actors).passed, true);
  assert.equal(
    verifyC03Answer(JSON.stringify({ ...valid, sharedSubjectIds: [30, 20] }), actors).passed,
    false,
  );
  assert.equal(
    verifyC03Answer(JSON.stringify({ ...valid, sharedSubjectIds: [] }), actors).passed,
    false,
  );
  assert.equal(
    verifyC03Answer(JSON.stringify({ ...valid, observedMainRoleShares: [] }), actors).passed,
    false,
  );
  assert.equal(
    verifyC03Answer(
      JSON.stringify({ ...valid, coverageNote: 'All career works are complete.' }),
      actors,
    ).passed,
    false,
  );
  assert.equal(verifyC03Answer('not json', actors).passed, false);
});
