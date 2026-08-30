import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SubjectLatestRevisionResult } from '@bangumi-agent-kit/bangumi-core';
import {
  buildSubjectLatestRevisionViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const baseResult: SubjectLatestRevisionResult = {
  state: 'partial',
  subjectId: 41529,
  selection: {
    strategy: 'offset-zero-source-order',
    limit: 1,
    offset: 0,
    revisionId: 1567985,
  },
  list: {
    state: 'partial',
    observed: 1,
    returned: 1,
    total: 21,
    totalKind: 'exact',
    limit: 1,
    offset: 0,
    truncated: true,
  },
  revision: {
    id: 1567985,
    type: 1,
    summary: '内容扩充',
    createdAt: '2025-06-08T00:00:00Z',
    creator: { username: 'editor', nickname: '编辑者' },
  },
  detail: {
    state: 'complete',
    payload: {
      state: 'complete',
      shape: 'object',
      observedFields: 32,
      returnedFields: 32,
      omittedFields: 0,
      truncatedFields: 0,
      fields: Array.from({ length: 32 }, (_, index) => ({
        key: `字段-${index}`,
        value: `值-${index}`,
        valueKind: 'string' as const,
        truncated: false,
      })),
    },
  },
  source: {
    class: 'official-v0',
    operations: [
      {
        operation: 'GET /v0/revisions/subjects',
        attemptedAt: '2026-08-30T00:00:00Z',
        retrievedAt: '2026-08-30T00:00:01Z',
      },
      {
        operation: 'GET /v0/revisions/subjects/1567985',
        attemptedAt: '2026-08-30T00:00:01Z',
        retrievedAt: '2026-08-30T00:00:02Z',
      },
    ],
  },
  evidence: [
    { source: 'official-v0', operation: 'GET /v0/revisions/subjects' },
    { source: 'official-v0', operation: 'GET /v0/revisions/subjects/1567985' },
  ],
  limitations: ['只展示第一条源顺序记录。', '不重建 before/after 差异。', '其余历史不展开。'],
  warnings: [
    { code: 'SOURCE_ORDER_BOUNDED', state: 'partial', message: '源顺序未保证。' },
    { code: 'EXACT_DIFF_UNSUPPORTED', state: 'partial', message: '精确差异不可计算。' },
  ],
};

describe('subject latest revision renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders a text-first bounded evidence card without resolving images', () => {
    const viewModel = buildSubjectLatestRevisionViewModel(baseResult);

    expect(viewModel.template).toBe('subject-latest-revision');
    expect(viewModel.presentation.fields.rendered).toBeLessThanOrEqual(16);
    expect(extractImageUrls(viewModel)).toEqual([]);
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('条目最新修订证据');
    expect(html).toContain('offset=0');
    expect(html).toContain('before/after');
    expect(html).toContain('安全投影');
    expect(html).toContain('字段-0');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('keeps dense CJK payloads within aggregate presentation bounds and valid PNG output', async () => {
    const longCjk = '长值内容'.repeat(600);
    const dense: SubjectLatestRevisionResult = {
      ...structuredClone(baseResult),
      detail: {
        ...baseResult.detail,
        payload: {
          ...baseResult.detail.payload,
          observedFields: 32,
          returnedFields: 32,
          fields: Array.from({ length: 32 }, (_, index) => ({
            key: `字段-${index}-${longCjk}`,
            value: longCjk,
            valueKind: 'string' as const,
            truncated: false,
          })),
        },
      },
    };
    const viewModel = buildSubjectLatestRevisionViewModel(dense);

    expect(viewModel.presentation.text.truncated).toBe(true);
    expect(viewModel.presentation.text.renderedGraphemes).toBeLessThanOrEqual(
      viewModel.presentation.text.maxGraphemes,
    );
    expect(viewModel.presentation.fields.rendered).toBeLessThanOrEqual(16);
    expect(viewModel.presentation.fields.omitted).toBeGreaterThan(0);

    for (const width of [640, 960]) {
      const rendered = await renderService.renderCard(viewModel, {
        width,
        deviceScaleFactor: 1,
        cache: false,
      });
      expect(rendered.buffer.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
      expect(rendered.width).toBe(width);
      expect(rendered.height).toBeLessThan(4_000);
      expect(rendered.buffer.length).toBeLessThan(5 * 1024 * 1024);
    }
  });

  it('keeps source and presentation truncation counts separate', () => {
    const mixed = structuredClone(baseResult);
    mixed.detail.payload = {
      ...mixed.detail.payload,
      observedFields: 1,
      returnedFields: 1,
      omittedFields: 0,
      truncatedFields: 1,
      fields: [
        {
          key: 'name_cn',
          value: '长值'.repeat(400),
          valueKind: 'string',
          truncated: true,
        },
      ],
    };

    const viewModel = buildSubjectLatestRevisionViewModel(mixed);

    expect(viewModel.presentation.fields).toMatchObject({
      observed: 1,
      available: 1,
      rendered: 1,
      omitted: 0,
      truncated: 1,
      sourceOmitted: 0,
      sourceTruncated: 1,
      presentationOmitted: 0,
      presentationTruncated: 1,
    });
    expect(viewModel.presentation.fields.truncated).not.toBe(2);
    expect(viewModel.presentation.fieldValues[0]).toMatchObject({
      sourceTruncated: true,
      presentationTruncated: true,
      truncated: true,
    });
  });

  it('keeps unavailable and empty states explicit', () => {
    const unavailable = buildSubjectLatestRevisionViewModel({
      ...baseResult,
      state: 'unavailable',
      revision: undefined,
      list: { ...baseResult.list, state: 'unavailable', observed: 0, returned: 0, total: 0 },
      detail: {
        state: 'unavailable',
        payload: {
          ...baseResult.detail.payload,
          state: 'not_computable',
          shape: 'empty',
          fields: [],
        },
      },
    });
    const empty = buildSubjectLatestRevisionViewModel({
      ...baseResult,
      state: 'not_found',
      revision: undefined,
      list: {
        ...baseResult.list,
        state: 'complete',
        observed: 0,
        returned: 0,
        total: 0,
        truncated: false,
      },
      detail: {
        state: 'not_computable',
        payload: {
          ...baseResult.detail.payload,
          state: 'not_computable',
          shape: 'empty',
          fields: [],
        },
      },
    });

    expect(renderHtmlTemplate(unavailable, 'bangumi-dark', {}, 640)).toContain('不可用');
    expect(renderHtmlTemplate(empty, 'bangumi-dark', {}, 640)).toContain('未找到');
  });
});
