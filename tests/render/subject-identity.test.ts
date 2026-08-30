import { describe, expect, it } from 'vitest';
import type { SubjectIdentityResult } from '@bangumi-agent-kit/bangumi-core';
import {
  buildSubjectIdentityViewModel,
  extractImageUrls,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

const result: SubjectIdentityResult = {
  subjectId: 41529,
  state: 'complete',
  data: {
    id: 41529,
    type: 2,
    typeLabel: 'anime',
    name: '少女終末旅行',
    nameCn: '少女终末旅行',
    date: '2017-10-06',
    platform: 'TV',
    locked: false,
    nsfw: false,
    series: false,
    volumes: 0,
    eps: 12,
    totalEpisodes: 12,
    metaTags: ['原创', '末日'],
    tags: ['旅行', '日常'],
    images: { large: 'https://example.test/image.png' },
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
      observed: ['id', 'type', 'name', 'name_cn', 'infobox'],
      returned: ['id', 'type', 'name', 'name_cn', 'infobox'],
      missing: [],
      malformed: [],
      empty: [],
      truncated: [],
    },
  },
  coverage: {
    sourceRequestsAttempted: 1,
    sourceRequestsSucceeded: 1,
    responseLimitBytes: 1_048_576,
    fields: {
      observed: ['id', 'type', 'name', 'name_cn', 'infobox'],
      returned: ['id', 'type', 'name', 'name_cn', 'infobox'],
      missing: [],
      malformed: [],
      empty: [],
      truncated: [],
    },
    infobox: {
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
  source: {
    class: 'official-v0',
    provider: 'bangumi',
    operation: 'GET /v0/subjects/{subject_id}',
    responseLimitBytes: 1_048_576,
    retrievedAt: '2026-08-30T00:00:00.000Z',
  },
  evidence: [
    { source: 'official-v0', provider: 'bangumi', operation: 'getSubjectById', fieldPath: 'name' },
    {
      source: 'derived-s7',
      provider: 'bangumi-agent-kit',
      operation: 'subject-identity-alias-extraction',
      formula: 'subject-identity-alias-v1',
      fieldPath: 'infobox.aliases',
    },
  ],
  warnings: [],
  limitations: ['当前快照不是历史。'],
  retrievedAt: '2026-08-30T00:00:00.000Z',
};

describe('subject identity renderer', () => {
  it('renders bounded text-first identity metadata without image asset resolution', () => {
    const viewModel = buildSubjectIdentityViewModel(result);

    expect(viewModel.template).toBe('subject-identity');
    expect(viewModel.subject?.imageLinksAvailable).toBe(true);
    expect(extractImageUrls(viewModel)).toEqual([]);

    for (const width of [640, 960]) {
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      expect(html).toContain('条目身份与元数据');
      expect(html).toContain('少女终末旅行');
      expect(html).toContain('别名');
      expect(html).toContain('少女終末旅行');
      expect(html).toContain('official-v0');
      expect(html).not.toContain('https://example.test');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('Infinity');
    }
  });

  it('keeps unavailable cards explicit and empty of invented subject fields', () => {
    const unavailable: SubjectIdentityResult = {
      ...result,
      state: 'unavailable',
      data: undefined,
      coverage: {
        ...result.coverage,
        sourceRequestsSucceeded: 0,
        fields: {
          observed: [],
          returned: [],
          missing: [],
          malformed: [],
          empty: [],
          truncated: [],
        },
        infobox: { ...result.coverage.infobox, state: 'unknown', observedRows: 0, returnedRows: 0 },
      },
      evidence: [],
      warnings: [{ code: 'UPSTREAM_ERROR', state: 'unavailable', message: '源不可用。' }],
    };
    const html = renderHtmlTemplate(
      buildSubjectIdentityViewModel(unavailable),
      'bangumi-dark',
      {},
      640,
    );

    expect(html).toContain('未生成身份数据');
    expect(html).toContain('不可用');
    expect(html).not.toContain('少女终末旅行');
  });
});
