import { describe, expect, it } from 'vitest';
import {
  OfficialV0Provider,
  SUBJECT_IDENTITY_MAX_INFOBOX_ROWS,
  SUBJECT_IDENTITY_MAX_INFOBOX_VALUES,
  SUBJECT_IDENTITY_MAX_RESPONSE_BYTES,
  SUBJECT_IDENTITY_MAX_SCALAR_CHARACTERS,
  type OfficialV0Api,
} from '@bangumi-agent-kit/provider-core';
import type { Subject } from '@bangumi-agent-kit/bangumi-openapi';
import { BangumiError } from '@bangumi-agent-kit/bangumi-transport';

function identityFixture(): Subject {
  return {
    id: 41529,
    type: 2,
    name: '少女終末旅行',
    name_cn: '少女终末旅行',
    summary: 'fixture',
    series: false,
    nsfw: false,
    locked: false,
    date: '2017-10-06',
    platform: 'TV',
    images: { common: 'https://example.test/subject.png' },
    infobox: [
      { key: '中文名', value: '少女终末旅行' },
      {
        key: '别名',
        value: [{ k: '日文名', v: '少女終末旅行' }, { v: "Girls' Last Tour" }],
      },
      { key: '原作', value: 'つくみず' },
    ],
    volumes: 2,
    eps: 12,
    total_episodes: 12,
    rating: { rank: 1, total: 10, count: { 10: 10 }, score: 9 },
    collection: { wish: 1, collect: 2, doing: 3, on_hold: 4, dropped: 5 },
    meta_tags: ['原创'],
    tags: [{ name: '末日', count: 1, total_count: 1 }],
  } as unknown as Subject;
}

describe('subject identity provider contract', () => {
  it('makes one bounded official detail request and preserves alias provenance', async () => {
    const calls: Array<{ id: number; maxResponseBytes?: number }> = [];
    const api: OfficialV0Api = {
      getSubjectById: async (id, options) => {
        calls.push({ id, maxResponseBytes: options?.maxResponseBytes });
        return identityFixture();
      },
    };

    const result = await new OfficialV0Provider(api).getSubjectIdentity(41529);

    expect(calls).toEqual([{ id: 41529, maxResponseBytes: SUBJECT_IDENTITY_MAX_RESPONSE_BYTES }]);
    expect(result.state).toBe('ok');
    expect(result.data).toMatchObject({
      id: 41529,
      name: '少女終末旅行',
      nameCn: '少女终末旅行',
      platform: 'TV',
      volumes: 2,
      eps: 12,
      totalEpisodes: 12,
      metaTags: ['原创'],
      tags: ['末日'],
      infobox: {
        state: 'complete',
        aliases: {
          state: 'known',
          values: ['少女終末旅行', "Girls' Last Tour"],
          sourceKeys: ['别名'],
          sourceRowIndexes: [1],
        },
      },
    });
    expect(result.evidence?.['infobox.aliases']?.[0]).toMatchObject({
      source: { class: 'derived', operation: 'subject-identity-alias-extraction' },
      formula: 'subject-identity-alias-v1',
      fieldPath: 'infobox.aliases',
    });
    expect(result.coverage?.state).toBe('complete');
  });

  it('reports malformed infobox values and every local cap without dropping valid rows', async () => {
    const raw = identityFixture() as unknown as Record<string, unknown>;
    raw.infobox = [
      {
        key: '别名',
        value: [
          ...Array.from({ length: SUBJECT_IDENTITY_MAX_INFOBOX_VALUES - 1 }, (_, index) => ({
            v: `alias-${index}`,
          })),
          { invalid: true },
          { v: 'omitted' },
        ],
      },
      { key: '长值', value: 'x'.repeat(SUBJECT_IDENTITY_MAX_SCALAR_CHARACTERS + 20) },
      { key: '坏值', value: 42 },
      ...Array.from({ length: SUBJECT_IDENTITY_MAX_INFOBOX_ROWS + 2 }, (_, index) => ({
        key: `row-${index}`,
        value: `value-${index}`,
      })),
    ];

    const result = await new OfficialV0Provider({
      getSubjectById: async () => raw as Subject,
    }).getSubjectIdentity(41529);

    expect(result.state).toBe('partial');
    expect(result.data?.infobox.rows.length).toBeLessThanOrEqual(SUBJECT_IDENTITY_MAX_INFOBOX_ROWS);
    expect(result.data?.infobox.coverage.observedRows).toBe(SUBJECT_IDENTITY_MAX_INFOBOX_ROWS + 5);
    expect(result.data?.infobox.coverage.omittedRows).toBe(5);
    expect(result.data?.infobox.coverage.nestedValuesOmitted).toBeGreaterThanOrEqual(1);
    expect(result.data?.infobox.coverage.malformedValues).toBeGreaterThanOrEqual(1);
    expect(result.data?.infobox.coverage.truncatedValues).toBeGreaterThanOrEqual(1);
    expect(result.warnings?.map((item) => item.code)).toEqual(
      expect.arrayContaining(['INFOBOX_MALFORMED', 'INFOBOX_TRUNCATED']),
    );
  });

  it('keeps missing optional identity fields and aliases explicitly unknown', async () => {
    const raw = identityFixture() as unknown as Record<string, unknown>;
    raw.name_cn = '';
    delete raw.date;
    delete raw.platform;
    raw.infobox = [{ key: '原作', value: 'fixture' }];

    const result = await new OfficialV0Provider({
      getSubjectById: async () => raw as Subject,
    }).getSubjectIdentity(41529);

    expect(result.state).toBe('partial');
    expect(result.data?.nameCn).toBe('');
    expect(result.data?.fields.missing).toEqual(expect.arrayContaining(['date', 'platform']));
    expect(result.data?.fields.empty).toContain('name_cn');
    expect(result.data?.infobox.aliases.state).toBe('unknown');
    expect(result.warnings?.map((item) => item.code)).toContain('ALIAS_UNKNOWN');
  });

  it('maps not-found and response-too-large failures without exposing upstream bodies', async () => {
    const tooLarge = await new OfficialV0Provider({
      getSubjectById: async () => {
        throw new BangumiError('RESPONSE_TOO_LARGE', 'secret oversized body', false);
      },
    }).getSubjectIdentity(41529);
    const notFound = await new OfficialV0Provider({
      getSubjectById: async () => {
        throw new BangumiError('NOT_FOUND', 'private upstream body', false, 404);
      },
    }).getSubjectIdentity(41529);

    expect(tooLarge).toMatchObject({
      state: 'unavailable',
      error: { code: 'response_too_large', retryable: false },
      warnings: [{ code: 'RESPONSE_TOO_LARGE' }],
    });
    expect(notFound.state).toBe('not_found');
    expect(JSON.stringify(tooLarge)).not.toContain('secret oversized body');
    expect(JSON.stringify(notFound)).not.toContain('private upstream body');
  });
});
