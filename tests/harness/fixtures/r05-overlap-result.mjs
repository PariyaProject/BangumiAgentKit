export function makeR05OverlapToolResult() {
  const subject = (subjectId, name, nameCn, rowCount) => ({
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
  });
  return {
    subjectIds: [1424, 3774],
    state: 'partial',
    kind: 'cast',
    castRole: 'all',
    subjects: [
      subject(1424, 'けいおん！', '轻音少女', 37),
      subject(3774, 'けいおん！！', '轻音少女 第二季', 64),
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
        message: 'This fixture message is omitted from evidence.',
      },
    ],
    evidence: [{ rawPayload: 'never persist' }],
    operationEvidence: [{ rawPayload: 'never persist' }],
    limitations: ['This fixture limitation is not copied.'],
  };
}
