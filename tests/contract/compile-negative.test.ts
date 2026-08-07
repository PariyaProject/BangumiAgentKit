import { describe, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '../../packages/bangumi-openapi/src/index.js';

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
  });
});
