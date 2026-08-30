import { describe, expect, it } from 'vitest';
import type { SubjectIdentityResult } from '@bangumi-agent-kit/bangumi-core';
import {
  ProviderRegistry,
  type ProviderSubjectIdentityData,
} from '@bangumi-agent-kit/provider-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools } from '@bangumi-agent-kit/tools';

const identityData: ProviderSubjectIdentityData = {
  id: 41529,
  type: 2,
  name: '少女終末旅行',
  nameCn: '少女终末旅行',
  date: '2017-10-06',
  platform: 'TV',
  locked: false,
  nsfw: false,
  series: false,
  volumes: 2,
  eps: 12,
  totalEpisodes: 12,
  metaTags: ['原创'],
  tags: ['末日'],
  images: { common: 'https://example.test/image.png' },
  infobox: {
    state: 'complete',
    rows: [
      { key: '别名', value: [{ k: '日文名', v: '少女終末旅行' }] },
      { key: '原作', value: 'つくみず' },
    ],
    aliases: {
      state: 'known',
      values: ['少女終末旅行'],
      sourceKeys: ['别名'],
      sourceRowIndexes: [0],
    },
    coverage: {
      state: 'complete',
      observedRows: 2,
      returnedRows: 2,
      malformedRows: 0,
      omittedRows: 0,
      nestedValuesObserved: 1,
      nestedValuesReturned: 1,
      nestedValuesOmitted: 0,
      malformedValues: 0,
      truncatedValues: 0,
      truncated: false,
      maxRows: 64,
      maxValuesPerRow: 8,
      maxScalarCharacters: 1000,
    },
  },
  fields: {
    observed: [
      'id',
      'type',
      'name',
      'name_cn',
      'date',
      'platform',
      'locked',
      'nsfw',
      'series',
      'volumes',
      'eps',
      'total_episodes',
      'meta_tags',
      'tags',
      'images',
      'infobox',
    ],
    returned: [
      'id',
      'type',
      'name',
      'name_cn',
      'date',
      'platform',
      'locked',
      'nsfw',
      'series',
      'volumes',
      'eps',
      'total_episodes',
      'meta_tags',
      'tags',
      'images',
      'infobox',
    ],
    missing: [],
    malformed: [],
    empty: [],
    truncated: [],
  },
};

function registry(result: { state: 'ok' | 'partial'; data?: ProviderSubjectIdentityData }) {
  return new ProviderRegistry({
    v0: {
      async getSubject() {
        return { state: 'not_found' as const };
      },
      async getSubjectStats() {
        return { state: 'not_found' as const };
      },
      async getSubjectIdentity() {
        return {
          ...result,
          evidence: {
            name: [
              {
                source: {
                  class: 'official_v0' as const,
                  provider: 'bangumi',
                  operation: 'getSubjectById',
                },
                retrievedAt: '2026-08-30T00:00:00.000Z',
                fieldPath: 'name',
              },
            ],
            'infobox.aliases': [
              {
                source: {
                  class: 'derived' as const,
                  provider: 'bangumi-agent-kit',
                  operation: 'subject-identity-alias-extraction',
                  version: 'subject-identity-alias-v1',
                },
                retrievedAt: '2026-08-30T00:00:00.000Z',
                fieldPath: 'infobox.aliases',
                formula: 'subject-identity-alias-v1',
              },
            ],
          },
          retrievedAt: '2026-08-30T00:00:00.000Z',
        };
      },
    },
  });
}

function getTool() {
  const tool = createReadTools(new HttpClient()).find(
    (candidate) => candidate.name === 'bangumi.get_subject_identity',
  );
  if (!tool) throw new Error('subject identity tool was not registered');
  return tool as unknown as {
    input: { safeParse: (value: unknown) => { success: boolean } };
    execute: (
      input: { subjectId: number },
      context: unknown,
      dependencies: { providerRegistry: ProviderRegistry },
    ) => Promise<SubjectIdentityResult>;
  };
}

describe('subject identity semantic contract', () => {
  it('registers a strict known-subject read and maps official/derived evidence', async () => {
    const tool = getTool();
    expect(tool.input.safeParse({ subjectId: 41529 }).success).toBe(true);
    expect(tool.input.safeParse({ subjectId: 0 }).success).toBe(false);
    expect(tool.input.safeParse({ subjectId: 41529, query: 'unexpected' }).success).toBe(false);

    const result = await tool.execute(
      { subjectId: 41529 },
      { principalId: 'identity-test' },
      { providerRegistry: registry({ state: 'ok', data: identityData }) },
    );

    expect(result).toMatchObject({
      subjectId: 41529,
      state: 'complete',
      data: {
        typeLabel: 'anime',
        nameCn: '少女终末旅行',
        infobox: { aliases: { state: 'known', values: ['少女終末旅行'] } },
      },
      source: {
        class: 'official-v0',
        operation: 'GET /v0/subjects/{subject_id}',
        responseLimitBytes: 1_048_576,
      },
      coverage: { sourceRequestsAttempted: 1, sourceRequestsSucceeded: 1 },
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'official-v0', fieldPath: 'name' }),
        expect.objectContaining({
          source: 'derived-s7',
          formula: 'subject-identity-alias-v1',
          fieldPath: 'infobox.aliases',
        }),
      ]),
    );
  });

  it('does not turn an unknown alias row into a negative assertion', async () => {
    const partial: ProviderSubjectIdentityData = structuredClone(identityData);
    partial.infobox.aliases = {
      state: 'unknown',
      values: [],
      sourceKeys: [],
      sourceRowIndexes: [],
    };
    const result = await getTool().execute(
      { subjectId: 41529 },
      { principalId: 'identity-test' },
      { providerRegistry: registry({ state: 'partial', data: partial }) },
    );

    expect(result.state).toBe('partial');
    expect(result.data?.infobox.aliases.state).toBe('unknown');
    expect(result.limitations.join(' ')).toContain('不代表没有别名');
  });

  it('returns an explicit unavailable result when the provider is absent', async () => {
    const result = await getTool().execute(
      { subjectId: 41529 },
      { principalId: 'identity-test' },
      { providerRegistry: new ProviderRegistry() },
    );

    expect(result.state).toBe('unavailable');
    expect(result.coverage.sourceRequestsAttempted).toBe(1);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SOURCE_NOT_CONFIGURED' })]),
    );
  });
});
