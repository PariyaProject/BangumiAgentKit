import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../../packages/bangumi-transport/src/index.js';
import {
  aggregatePersonActivity,
  groupSubjectStaff,
  mapPerson,
  mapPersonNameCn,
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
      { id: 1, name: 'A duplicate row', type: 1, career: [], relation: '导演', eps: '' },
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
          { key: '简体中文名', value: '中文名' },
          {
            key: '别名',
            value: [{ v: 'Alias A' }, { v: 'Alias B' }, { k: 'English', v: 'Alias C' }],
          },
          { key: '国籍', value: '日本' },
        ],
        last_modified: '0001-01-01T00:00:00Z',
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
      nameCn: '中文名',
      aliases: ['Alias A', 'Alias B', 'Alias C'],
      gender: '女性',
      bloodType: 4,
      birthYear: 1995,
      stat: { comments: 3, collects: 4 },
    });
    expect(mapPersonNameCn([{ key: '别名', value: 'not a Chinese name' }])).toBeUndefined();
    expect(
      mapPerson({ id: 22, name: 'Unknown freshness', last_modified: '0001-01-01T00:00:00Z' })
        .lastModified,
    ).toBeUndefined();
    expect(
      mapPerson({ id: 22, name: 'Unknown freshness', last_modified: '0001-01-01T00:00:00Z' })
        .lastModifiedState,
    ).toBe('unknown');
    expect(
      mapPerson({ id: 21, name: 'Fresh', last_modified: '2026-08-10T00:00:00Z' }).lastModified,
    ).toBe('2026-08-10T00:00:00Z');

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

  it('preserves official person-work name_cn separately from its display fallback', () => {
    expect(
      mapPersonRelationSubject({ id: 11, name: 'Original', name_cn: '中文译名' }),
    ).toMatchObject({ name: 'Original', nameCn: '中文译名', nameCnSource: '中文译名' });
    expect(
      mapPersonRelationSubject({ id: 12, name: 'Same title', name_cn: 'Same title' }),
    ).toMatchObject({ name: 'Same title', nameCn: 'Same title', nameCnSource: 'Same title' });
    expect(mapPersonRelationSubject({ id: 13, name: 'Original', name_cn: '' })).toMatchObject({
      name: 'Original',
      nameCn: 'Original',
      nameCnSource: '',
    });
    expect(mapPersonRelationSubject({ id: 14, name: 'Original' })).toMatchObject({
      name: 'Original',
      nameCn: 'Original',
      nameCnSource: null,
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

  it('reports deterministic sampled release-date extrema with bounded detail reads', async () => {
    const animeIds = Array.from({ length: 60 }, (_, index) => index + 1);
    const selectedIds = Array.from({ length: 48 }, (_, index) =>
      animeIds[Math.floor((index * (animeIds.length - 1)) / 47)]!,
    );
    let activeDetails = 0;
    let maxActiveDetails = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/persons/22')) {
        return new Response(JSON.stringify({ id: 22, name: 'Person', career: ['seiyu'] }), {
          status: 200,
        });
      }
      if (url.endsWith('/persons/22/subjects')) {
        return new Response(
          JSON.stringify([
            ...animeIds.map((id) => ({ id, type: 2, name: `Anime ${id}` })),
            { id: 900, type: 3, name: 'Music' },
          ]),
          { status: 200 },
        );
      }
      if (url.endsWith('/persons/22/characters')) {
        return new Response('[]', { status: 200 });
      }
      const match = /\/subjects\/(\d+)$/.exec(url);
      if (!match) throw new Error(`Unexpected URL: ${url}`);
      const id = Number(match[1]);
      activeDetails += 1;
      maxActiveDetails = Math.max(maxActiveDetails, activeDetails);
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeDetails -= 1;
      if (id === selectedIds[4]) {
        return new Response('{"date":"2010-01-01"}', {
          status: 200,
          headers: { 'content-length': '1048577' },
        });
      }
      if (id === selectedIds[2]) return new Response('{"id":3}', { status: 200 });
      if (id === selectedIds[3]) {
        return new Response(JSON.stringify({ id, date: '2020-02-30' }), { status: 200 });
      }
      if (id === selectedIds[0] || id === selectedIds[1]) {
        return new Response(JSON.stringify({ id, date: '2000-01-01' }), { status: 200 });
      }
      if (id === selectedIds[46] || id === selectedIds[47]) {
        return new Response(JSON.stringify({ id, date: '2030-12-31' }), { status: 200 });
      }
      return new Response(JSON.stringify({ id, date: '2010-01-01' }), { status: 200 });
    });
    const service = new PersonService(new HttpClient({ fetchFn: mockFetch }));

    const result = await service.getPersonProfile(22, {
      includeChronology: true,
      maxChronologySubjects: 80,
    });

    expect(result.releaseChronology).toMatchObject({
      state: 'partial',
      sourceCompleteness: 'undocumented',
      dateSemantics: 'official-subject-air-release-date',
      samplingStrategy: 'evenly-spaced-returned-anime-relations',
      relationRowsObserved: 61,
      relationRowsReturned: 61,
      animeRelationRowsReturned: 60,
      uniqueAnimeSubjects: 60,
      selectedSubjectIds: selectedIds,
      selectedSubjectDetails: 48,
      succeededSubjectDetails: 47,
      failedSubjectDetails: 1,
      validDateSubjects: 45,
      missingDateSubjects: 1,
      invalidDateSubjects: 1,
      omittedAnimeSubjects: 12,
      maxConcurrency: 4,
      responseByteLimit: 1_048_576,
      earliestObserved: {
        date: '2000-01-01',
        subjects: [
          { id: selectedIds[0], name: `Anime ${selectedIds[0]}` },
          { id: selectedIds[1], name: `Anime ${selectedIds[1]}` },
        ],
      },
      latestObserved: {
        date: '2030-12-31',
        subjects: [
          { id: selectedIds[46], name: `Anime ${selectedIds[46]}` },
          { id: selectedIds[47], name: `Anime ${selectedIds[47]}` },
        ],
      },
    });
    expect(result.releaseChronology?.selectedSubjectIds).not.toContain(900);
    expect(mockFetch).toHaveBeenCalledTimes(3 + 48);
    expect(maxActiveDetails).toBeGreaterThan(1);
    expect(maxActiveDetails).toBeLessThanOrEqual(4);
  });

  it('marks chronology not computable when the selected animation details have no valid dates', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/persons/23')) {
        return new Response(JSON.stringify({ id: 23, name: 'Person' }), { status: 200 });
      }
      if (url.endsWith('/persons/23/subjects')) {
        return new Response(
          JSON.stringify([
            { id: 31, type: 2, name: 'Missing date' },
            { id: 32, type: 2, name: 'Invalid date' },
          ]),
          { status: 200 },
        );
      }
      if (url.endsWith('/persons/23/characters')) return new Response('[]', { status: 200 });
      if (url.endsWith('/subjects/31')) return new Response('{"id":31}', { status: 200 });
      if (url.endsWith('/subjects/32')) {
        return new Response('{"id":32,"date":"not-a-date"}', { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const service = new PersonService(new HttpClient({ fetchFn: mockFetch }));

    const result = await service.getPersonProfile(23, { includeChronology: true });

    expect(result.releaseChronology).toMatchObject({
      state: 'not_computable',
      selectedSubjectDetails: 2,
      succeededSubjectDetails: 2,
      failedSubjectDetails: 0,
      validDateSubjects: 0,
      missingDateSubjects: 1,
      invalidDateSubjects: 1,
    });
    expect(result.releaseChronology).not.toHaveProperty('earliestObserved');
    expect(result.releaseChronology).not.toHaveProperty('latestObserved');
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
