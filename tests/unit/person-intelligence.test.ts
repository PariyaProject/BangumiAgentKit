import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../../packages/bangumi-transport/src/index.js';
import {
  aggregatePersonActivity,
  groupSubjectStaff,
  mapPerson,
  mapPersonRelationCharacter,
  mapPersonRelationSubject,
  mapSubjectStaffMember,
  PersonService,
} from '@bangumi-agent-kit/bangumi-core';

describe('PR-7D person intelligence aggregation', () => {
  it('deduplicates by stable IDs while retaining credit-row counts and raw labels', () => {
    const summary = aggregatePersonActivity(
      [
        {
          id: 1,
          name: 'A',
          nameCn: '甲',
          mediaType: 'anime',
          mediaTypeCode: 2,
          staffRole: '导演',
        },
        {
          id: 1,
          name: 'A',
          nameCn: '甲',
          mediaType: 'anime',
          mediaTypeCode: 2,
          staffRole: '脚本',
        },
        { id: 2, name: 'B', nameCn: '乙', mediaType: 'music', mediaTypeCode: 3 },
      ],
      [
        {
          id: 10,
          name: '角色A',
          subjectId: 1,
          subjectType: 'anime',
          subjectTypeCode: 2,
          staff: '主角',
        },
        {
          id: 10,
          name: '角色A',
          subjectId: 1,
          subjectType: 'anime',
          subjectTypeCode: 2,
          staff: '主角',
        },
        { id: 11, name: '角色B', subjectId: 2, subjectType: 'music', subjectTypeCode: 3 },
      ],
    );

    expect(summary).toMatchObject({
      subjectCredits: 3,
      uniqueSubjects: 2,
      characterCredits: 3,
      uniqueCharacters: 2,
      characterSubjects: 2,
    });
    expect(summary.subjectRoles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '导演', count: 1, uniqueSubjects: 1 }),
        expect.objectContaining({ label: '脚本', count: 1, uniqueSubjects: 1 }),
        expect.objectContaining({ label: '未知', count: 1, uniqueSubjects: 1 }),
      ]),
    );
    expect(summary.characterRoles).toEqual([
      expect.objectContaining({ label: '主角', count: 2, uniqueSubjects: 1 }),
      expect.objectContaining({ label: '未知', count: 1, uniqueSubjects: 1 }),
    ]);
    expect(summary.subjectMedia).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'anime', rawCodes: [2] }),
        expect.objectContaining({ label: 'music', rawCodes: [3] }),
      ]),
    );
  });

  it('groups staff using the exact source relation label', () => {
    const groups = groupSubjectStaff([
      { id: 1, name: 'A', type: 1, career: [], relation: '导演', eps: '' },
      { id: 2, name: 'B', type: 1, career: [], relation: '导演', eps: '' },
      { id: 3, name: 'C', type: 1, career: [], relation: '', eps: '' },
    ]);

    expect(groups[0]).toMatchObject({ relation: '导演', count: 2, memberIds: [1, 2] });
    expect(groups[1]).toMatchObject({ relation: '未知', count: 1, memberIds: [3] });
  });

  it('preserves person identity, aliases, and raw relationship codes alongside labels', () => {
    expect(
      mapPerson({
        id: 20,
        name: 'Person',
        type: 9,
        career: ['seiyu'],
        summary: 'summary',
        infobox: [
          {
            key: '别名',
            value: [{ v: 'Alias A' }, { v: 'Alias B' }, { k: 'English', v: 'Alias C' }],
          },
          { key: '国籍', value: '日本' },
        ],
        gender: '女性',
        blood_type: 4,
        birth_year: 1995,
        birth_mon: 12,
        birth_day: 2,
        stat: { comments: 3, collects: 4 },
      }),
    ).toMatchObject({
      type: 9,
      typeLabel: '未知',
      aliases: ['Alias A', 'Alias B', 'Alias C'],
      gender: '女性',
      bloodType: 4,
      birthYear: 1995,
      stat: { comments: 3, collects: 4 },
    });

    expect(mapPersonRelationSubject({ id: 1, type: 99, staff: '', name: 'A' })).toMatchObject({
      mediaType: 'other',
      mediaTypeCode: 99,
    });
    expect(
      mapPersonRelationCharacter({ id: 2, subject_id: 1, subject_type: 99, name: 'C' }),
    ).toMatchObject({ subjectType: 'other', subjectTypeCode: 99 });
    expect(mapSubjectStaffMember({ id: 3, name: 'Unknown', relation: '  ' })).toMatchObject({
      relation: '未知',
      rawRelation: '  ',
    });
  });

  it('fetches person profile relations with bounded, explicit partial coverage', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/persons/20')) {
        return new Response(
          JSON.stringify({
            id: 20,
            name: 'Person',
            career: ['seiyu'],
            gender: '女性',
            blood_type: 1,
            birth_year: 1995,
            infobox: [{ key: '别名', value: [{ v: 'P' }] }],
          }),
          {
            status: 200,
          },
        );
      }
      if (url.endsWith('/persons/20/subjects')) {
        return new Response(
          JSON.stringify([
            { id: 1, type: 2, name: 'Anime', staff: 'CV' },
            { id: 2, type: 3, name: 'Music', staff: '艺术家' },
          ]),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify([
          {
            id: 10,
            name: 'Character',
            type: 1,
            subject_id: 1,
            subject_type: 2,
            subject_name: 'Anime',
            subject_name_cn: '动画',
            staff: '主角',
          },
        ]),
        { status: 200 },
      );
    });
    const service = new PersonService(new HttpClient({ fetchFn: mockFetch }));

    const result = await service.getPersonProfile(20, { maxSubjects: 1, maxCharacters: 1 });

    expect(result.person.name).toBe('Person');
    expect(result.person).toMatchObject({ typeLabel: '个人', aliases: ['P'], gender: '女性' });
    expect(result.subjects).toMatchObject({ observed: 2, returned: 1, truncated: true });
    expect(result.characters).toMatchObject({ observed: 1, returned: 1, truncated: false });
    expect(result.summary.subjectMedia[0]).toMatchObject({ key: 'anime', count: 1 });
    expect(result.summary.characterRoles[0]).toMatchObject({ label: '主角', count: 1 });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('maps subject staff rows and preserves episode/track participation', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 1,
            name: 'Staff',
            type: 1,
            career: ['writer'],
            relation: '脚本',
            eps: '全12话',
          },
        ]),
        { status: 200 },
      ),
    );
    const service = new PersonService(new HttpClient({ fetchFn: mockFetch }));

    const result = await service.getSubjectStaff(100, 100);

    expect(result).toMatchObject({ observed: 1, returned: 1, truncated: false });
    expect(result.items[0]).toMatchObject({ name: 'Staff', relation: '脚本', eps: '全12话' });
  });
});
