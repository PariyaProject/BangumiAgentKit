import { describe, expect, it } from 'vitest';
import { FRESH_RENDER_PERSON_PROFILE_PUBLIC_SCOPE } from '../../scripts/lib/fresh-render-person-profile-public-scope.js';

describe('fresh render-person-profile public scope', () => {
  it('uses the distinct fixed input and four-request ceiling', () => {
    expect(FRESH_RENDER_PERSON_PROFILE_PUBLIC_SCOPE).toEqual({
      id: 'run95-fresh-render-person-profile-13684-origin-guard-v2',
      tool: 'bangumi.render_person_profile',
      input: {
        personId: 13684,
        maxSubjects: 1,
        maxCharacters: 1,
        maxCredits: 1,
        includeChronology: false,
      },
      maxHttpRequests: 4,
    });
  });
});
