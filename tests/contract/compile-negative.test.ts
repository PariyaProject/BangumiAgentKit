import { describe, it, expect } from 'vitest';
import { GeneratedBangumiOpenApiClient, OperationResponse } from '../../packages/bangumi-openapi/src/index.js';

type IsAny<T> = 0 extends (1 & T) ? true : false;
type ExpectFalse<T extends false> = T;

// Type assertions: Ensure OperationResponse is not any
export type GetSubjectByIdMustNotBeAny = ExpectFalse<IsAny<OperationResponse<'getSubjectById'>>>;
export type GetIndexSubjectsMustNotBeAny = ExpectFalse<IsAny<OperationResponse<'getIndexSubjectsByIndexId'>>>;
export type AddSubjectToIndexMustNotBeAny = ExpectFalse<IsAny<OperationResponse<'addSubjectToIndexByIndexId'>>>;
export type CollectIndexMustNotBeAny = ExpectFalse<IsAny<OperationResponse<'collectIndexByIndexIdAndUserId'>>>;
export type PostUserCollectionMustNotBeAny = ExpectFalse<IsAny<OperationResponse<'postUserCollection'>>>;
export type GetSubjectImageByIdMustNotBeAny = ExpectFalse<IsAny<OperationResponse<'getSubjectImageById'>>>;

describe('Phase 1: Compile-Time Negative Contract Tests', () => {
  it('enforces required parameters at compile-time', () => {
    const client = new GeneratedBangumiOpenApiClient();

    // 1. getSubjects requires query parameter { type: SubjectType }
    // @ts-expect-error getSubjects requires query parameter with 'type' property
    client.getSubjects();

    // @ts-expect-error 'type' is missing in empty query object {}
    client.getSubjects({});

    // 2. getSubjectImageById requires query parameter { type: ImageType }
    // @ts-expect-error getSubjectImageById requires 2nd argument (query object)
    client.getSubjectImageById(123);

    // 3. searchSubjects requires request body with 'keyword'
    // @ts-expect-error searchSubjects body parameter requires 'keyword' property
    client.searchSubjects(undefined, {});

    // 4. Path Parameter strict typing
    // @ts-expect-error subject_id is integer
    client.getSubjectById("abc");

    // @ts-expect-error episode_id is integer
    client.getEpisodeById("1");

    // @ts-expect-error username is string
    client.getUserByName(123);

    // @ts-expect-error index_id is integer
    client.getIndexById("1");
  });

  it('validates compile-time type assertions', () => {
    const testVar: GetSubjectByIdMustNotBeAny = false;
    expect(testVar).toBe(false);
  });
});
