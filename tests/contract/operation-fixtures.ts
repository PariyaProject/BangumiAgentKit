import type {
  OperationBody,
  OperationQuery,
} from '../../packages/bangumi-openapi/src/generated/index.js';

export interface ContractFixture {
  pathArgs: (string | number)[];
  queryFixture?: Record<string, unknown>;
  bodyFixture?: unknown;
}

export const OPERATION_FIXTURES: Record<string, ContractFixture> = {
  searchSubjects: {
    pathArgs: [],
    queryFixture: { limit: 5, offset: 0 },
    bodyFixture: { keyword: 'test' } satisfies OperationBody<'searchSubjects'>,
  },
  searchCharacters: {
    pathArgs: [],
    queryFixture: { limit: 5, offset: 0 },
    bodyFixture: { keyword: 'test' } satisfies OperationBody<'searchCharacters'>,
  },
  searchPersons: {
    pathArgs: [],
    queryFixture: { limit: 5, offset: 0 },
    bodyFixture: { keyword: 'test' } satisfies OperationBody<'searchPersons'>,
  },
  getSubjects: {
    pathArgs: [],
    queryFixture: { type: 2, limit: 10 } satisfies OperationQuery<'getSubjects'>,
  },
  getSubjectById: {
    pathArgs: [123],
  },
  getSubjectImageById: {
    pathArgs: [123],
    queryFixture: { type: 'large' } satisfies OperationQuery<'getSubjectImageById'>,
  },
  getRelatedPersonsBySubjectId: {
    pathArgs: [123],
  },
  getRelatedCharactersBySubjectId: {
    pathArgs: [123],
  },
  getRelatedSubjectsBySubjectId: {
    pathArgs: [123],
  },
  getEpisodes: {
    pathArgs: [],
    queryFixture: { subject_id: 123, limit: 10 } satisfies OperationQuery<'getEpisodes'>,
  },
  getEpisodeById: {
    pathArgs: [456],
  },
  getCharacterById: {
    pathArgs: [789],
  },
  getCharacterImageById: {
    pathArgs: [789],
    queryFixture: { type: 'large' } satisfies OperationQuery<'getCharacterImageById'>,
  },
  getRelatedSubjectsByCharacterId: {
    pathArgs: [789],
  },
  getRelatedPersonsByCharacterId: {
    pathArgs: [789],
  },
  collectCharacterByCharacterIdAndUserId: {
    pathArgs: [789],
  },
  uncollectCharacterByCharacterIdAndUserId: {
    pathArgs: [789],
  },
  getPersonById: {
    pathArgs: [101],
  },
  getPersonImageById: {
    pathArgs: [101],
    queryFixture: { type: 'large' } satisfies OperationQuery<'getPersonImageById'>,
  },
  getRelatedSubjectsByPersonId: {
    pathArgs: [101],
  },
  getRelatedCharactersByPersonId: {
    pathArgs: [101],
  },
  collectPersonByPersonIdAndUserId: {
    pathArgs: [101],
  },
  uncollectPersonByPersonIdAndUserId: {
    pathArgs: [101],
  },
  getUserByName: {
    pathArgs: ['alice'],
  },
  getUserAvatarByName: {
    pathArgs: ['alice'],
    queryFixture: { type: 'large' } satisfies OperationQuery<'getUserAvatarByName'>,
  },
  getMyself: {
    pathArgs: [],
  },
  getUserCollectionsByUsername: {
    pathArgs: ['alice'],
    queryFixture: {
      subject_type: 2,
      limit: 10,
    } satisfies OperationQuery<'getUserCollectionsByUsername'>,
  },
  getUserCollection: {
    pathArgs: ['alice', 123],
  },
  postUserCollection: {
    pathArgs: [123],
    bodyFixture: { type: 2 } satisfies OperationBody<'postUserCollection'>,
  },
  patchUserCollection: {
    pathArgs: [123],
    bodyFixture: { type: 2 } satisfies OperationBody<'patchUserCollection'>,
  },
  getUserSubjectEpisodeCollection: {
    pathArgs: [123],
    queryFixture: { limit: 10 } satisfies OperationQuery<'getUserSubjectEpisodeCollection'>,
  },
  patchUserSubjectEpisodeCollection: {
    pathArgs: [123],
    bodyFixture: {
      episode_id: [456],
      type: 2,
    } satisfies OperationBody<'patchUserSubjectEpisodeCollection'>,
  },
  getUserEpisodeCollection: {
    pathArgs: [456],
  },
  putUserEpisodeCollection: {
    pathArgs: [456],
    bodyFixture: { type: 2 } satisfies OperationBody<'putUserEpisodeCollection'>,
  },
  getUserCharacterCollections: {
    pathArgs: ['alice'],
  },
  getUserCharacterCollection: {
    pathArgs: ['alice', 789],
  },
  getUserPersonCollections: {
    pathArgs: ['alice'],
  },
  getUserPersonCollection: {
    pathArgs: ['alice', 101],
  },
  getPersonRevisions: {
    pathArgs: [],
    queryFixture: { person_id: 101, limit: 5 } satisfies OperationQuery<'getPersonRevisions'>,
  },
  getPersonRevisionByRevisionId: {
    pathArgs: [303],
  },
  getCharacterRevisions: {
    pathArgs: [],
    queryFixture: { character_id: 789, limit: 5 } satisfies OperationQuery<'getCharacterRevisions'>,
  },
  getCharacterRevisionByRevisionId: {
    pathArgs: [303],
  },
  getSubjectRevisions: {
    pathArgs: [],
    queryFixture: { subject_id: 123, limit: 5 } satisfies OperationQuery<'getSubjectRevisions'>,
  },
  getSubjectRevisionByRevisionId: {
    pathArgs: [303],
  },
  getEpisodeRevisions: {
    pathArgs: [],
    queryFixture: { episode_id: 456, limit: 5 } satisfies OperationQuery<'getEpisodeRevisions'>,
  },
  getEpisodeRevisionByRevisionId: {
    pathArgs: [303],
  },
  newIndex: {
    pathArgs: [],
  },
  getIndexById: {
    pathArgs: [202],
  },
  editIndexById: {
    pathArgs: [202],
    bodyFixture: { title: 'Updated Title' } satisfies OperationBody<'editIndexById'>,
  },
  getIndexSubjectsByIndexId: {
    pathArgs: [202],
    queryFixture: { type: 2, limit: 10 } satisfies OperationQuery<'getIndexSubjectsByIndexId'>,
  },
  addSubjectToIndexByIndexId: {
    pathArgs: [202],
    bodyFixture: {
      subject_id: 123,
      sort: 1,
      comment: 'note',
    } satisfies OperationBody<'addSubjectToIndexByIndexId'>,
  },
  editIndexSubjectsByIndexIdAndSubjectID: {
    pathArgs: [202, 123],
    bodyFixture: {
      sort: 1,
      comment: 'updated',
    } satisfies OperationBody<'editIndexSubjectsByIndexIdAndSubjectID'>,
  },
  delelteSubjectFromIndexByIndexIdAndSubjectID: {
    pathArgs: [202, 123],
  },
  collectIndexByIndexIdAndUserId: {
    pathArgs: [202],
  },
  uncollectIndexByIndexIdAndUserId: {
    pathArgs: [202],
  },
  getCalendar: {
    pathArgs: [],
  },
};
