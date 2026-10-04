import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateSubjectCastAnswer } from '../../scripts/acceptance/subject-cast-answer-check.mjs';

const castRows = [
  {
    character: { id: 1, name: '角色甲' },
    relation: '主角',
    actors: [
      { id: 11, name: '声优甲' },
      { id: 12, name: '声优乙' },
    ],
    actorCount: 2,
    actorsOmittedFromText: 0,
  },
  {
    character: { id: 2, name: '角色乙' },
    relation: '配角',
    actors: [{ id: 13, name: '声优丙' }],
    actorCount: 1,
    actorsOmittedFromText: 0,
  },
];

const boundedDisclosure = '范围：仅代表本次有限返回；未显示不代表不存在。';

describe('subject-cast answer checks', () => {
  it('verifies exact positive character/actor pairs and raw relations in separate rows', () => {
    const check = validateSubjectCastAnswer(
      `主角｜角色甲｜声优甲、声优乙\n配角｜角色乙｜声优丙\n${boundedDisclosure}`,
      castRows,
    );

    expect(check).toMatchObject({
      visibleCastRowsCount: 2,
      castRowsMatchedCount: 2,
      characterActorPairsMatchedCount: 3,
      rawRelationLabelsMatchedCount: 2,
      unmatchedAnswerRowsCount: 0,
      mismatchedCastRowsCount: 0,
      boundedCoverageDisclosurePresent: true,
      omissionNotAbsencePresent: true,
      unsupportedCompletenessClaim: false,
      unsupportedAbsenceClaim: false,
      markdownFormattingDetected: false,
      passed: true,
    });
  });

  it('rejects swapped actors even when every character and actor name is present', () => {
    const check = validateSubjectCastAnswer(
      `主角｜角色甲｜声优丙\n配角｜角色乙｜声优甲、声优乙\n${boundedDisclosure}`,
      castRows,
    );

    expect(check.passed).toBe(false);
    expect(check.castRowsMatchedCount).toBe(0);
    expect(check.mismatchedCastRowsCount).toBe(2);
    expect(check.characterActorPairsMatchedCount).toBe(0);
  });

  it('requires the exact returned relation and rejects unrelated answer rows', () => {
    const check = validateSubjectCastAnswer(
      `配角｜角色甲｜声优甲、声优乙\n主角｜角色乙｜声优丙\n导演｜其他条目｜声优丁\n${boundedDisclosure}`,
      castRows,
    );

    expect(check.passed).toBe(false);
    expect(check.castRowsMatchedCount).toBe(0);
    expect(check.unmatchedAnswerRowsCount).toBe(3);
  });

  it('does not require model guesses for clipped names and counts those rows as unavailable', () => {
    const check = validateSubjectCastAnswer(`配角｜角色乙｜声优丙\n${boundedDisclosure}`, [
      {
        ...castRows[0]!,
        character: { ...castRows[0]!.character, displayNameTextTruncated: true },
      },
      castRows[1]!,
    ]);

    expect(check).toMatchObject({
      visibleCastRowsCount: 1,
      castRowsMatchedCount: 1,
      clippedCastRowsUnavailableCount: 1,
      passed: true,
    });
  });

  it('does not count ambiguous duplicate source rows as verified associations', () => {
    const check = validateSubjectCastAnswer(`配角｜角色乙｜声优丙\n${boundedDisclosure}`, [
      castRows[0]!,
      castRows[0]!,
      castRows[0]!,
      castRows[1]!,
    ]);

    expect(check).toMatchObject({
      visibleCastRowsCount: 1,
      clippedCastRowsUnavailableCount: 2,
      castRowsMatchedCount: 1,
      characterActorPairsMatchedCount: 1,
      passed: true,
    });
  });

  it('rejects unsupported completeness and role-absence claims', () => {
    const complete = validateSubjectCastAnswer(
      `主角｜角色甲｜声优甲、声优乙\n配角｜角色乙｜声优丙\n${boundedDisclosure}这就是完整名单。`,
      castRows,
    );
    const absent = validateSubjectCastAnswer(
      `主角｜角色甲｜声优甲、声优乙\n配角｜角色乙｜声优丙\n${boundedDisclosure}其他角色都没有声优。`,
      castRows,
    );

    expect(complete.unsupportedCompletenessClaim).toBe(true);
    expect(complete.passed).toBe(false);
    expect(absent.unsupportedAbsenceClaim).toBe(true);
    expect(absent.passed).toBe(false);
  });

  it('does not let an earlier caveat authorize a later completeness claim in the same sentence', () => {
    const check = validateSubjectCastAnswer(
      `主角｜角色甲｜声优甲、声优乙\n配角｜角色乙｜声优丙\n范围：未显示不代表不存在，不过这仍是完整名单。`,
      castRows,
    );

    expect(check.unsupportedCompletenessClaim).toBe(true);
    expect(check.passed).toBe(false);
  });

  it('requires a current scope and omission caveat even when every pair matches', () => {
    const check = validateSubjectCastAnswer(
      '主角｜角色甲｜声优甲、声优乙\n配角｜角色乙｜声优丙',
      castRows,
    );

    expect(check.castRowsMatchedCount).toBe(2);
    expect(check.boundedCoverageDisclosurePresent).toBe(false);
    expect(check.omissionNotAbsencePresent).toBe(false);
    expect(check.passed).toBe(false);
  });

  it('rejects answer rows that do not use the verifiable relation format', () => {
    const check = validateSubjectCastAnswer(
      `主角｜角色甲｜声优甲、声优乙\n配角｜角色乙｜声优丙\n角色甲是角色乙的前辈。\n${boundedDisclosure}`,
      castRows,
    );

    expect(check.unstructuredAnswerLinesCount).toBe(1);
    expect(check.passed).toBe(false);
  });

  it('prints only sanitized answer-check counts from its stdin interface', () => {
    const answer = `主角｜角色甲｜声优甲、声优乙\n配角｜角色乙｜声优丙\n${boundedDisclosure}`;
    const result = spawnSync(
      process.execPath,
      [join(process.cwd(), 'scripts/acceptance/subject-cast-answer-check.mjs')],
      {
        encoding: 'utf8',
        input: JSON.stringify({ answer, rows: castRows }),
      },
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      castRowsMatchedCount: 2,
      characterActorPairsMatchedCount: 3,
      passed: true,
    });
    expect(result.stdout).not.toContain('角色甲');
    expect(result.stdout).not.toContain('声优甲');
    expect(result.stdout).not.toContain(answer);
  });
});
