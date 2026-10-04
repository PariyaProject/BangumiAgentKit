import { describe, expect, it } from 'vitest';
import { countExplicitSubjectStaffPairs } from '../../scripts/acceptance/subject-staff-answer-check.mjs';

const pairs = [
  { role: '导演', name: '人员甲' },
  { role: '原作', name: '人员乙' },
];

describe('subject-staff answer association checks', () => {
  it('counts explicit raw-role to returned-name associations', () => {
    expect(countExplicitSubjectStaffPairs('有限结果：导演为人员甲，原作：人员乙。', pairs)).toBe(2);
  });

  it('recognizes explicit name-first associations', () => {
    expect(countExplicitSubjectStaffPairs('有限结果：人员甲担任导演，人员乙是原作。', pairs)).toBe(
      2,
    );
  });

  it('treats raw role labels and names as literal strings', () => {
    expect(
      countExplicitSubjectStaffPairs('有限结果：作画+演出：名字.甲。', [
        { role: '作画+演出', name: '名字.甲' },
      ]),
    ).toBe(1);
    expect(
      countExplicitSubjectStaffPairs('有限结果：作画演出：名字X甲。', [
        { role: '作画+演出', name: '名字.甲' },
      ]),
    ).toBe(0);
  });

  it('rejects swapped role/name associations', () => {
    expect(countExplicitSubjectStaffPairs('有限结果：导演为人员乙，原作为人员甲。', pairs)).toBe(0);
  });

  it('requires whole role labels and identity tokens', () => {
    expect(
      countExplicitSubjectStaffPairs('有限结果：副导演：人员甲；原作协力：人员乙。', pairs),
    ).toBe(0);
    expect(
      countExplicitSubjectStaffPairs('有限结果：导演：人员甲乙；原作：人员乙甲。', pairs),
    ).toBe(0);
  });

  it('rejects roles and names mentioned in unrelated clauses', () => {
    expect(
      countExplicitSubjectStaffPairs(
        '有限结果中包含导演和原作标签，名单另有人员甲、人员乙。',
        pairs,
      ),
    ).toBe(0);
  });

  it('rejects negated role/name associations', () => {
    expect(
      countExplicitSubjectStaffPairs('有限结果：导演不是人员甲，原作并非人员乙。', pairs),
    ).toBe(0);
  });

  it('rejects negated name-first associations', () => {
    expect(
      countExplicitSubjectStaffPairs('有限结果：不由人员甲担任导演，人员乙并非原作。', pairs),
    ).toBe(0);
  });
});
