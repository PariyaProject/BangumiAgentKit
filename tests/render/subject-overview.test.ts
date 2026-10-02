import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import type { SubjectOverviewResult } from '@bangumi-agent-kit/bangumi-core';
import {
  ProviderRegistry,
  type CapabilityResult,
  type SubjectStatsData,
} from '@bangumi-agent-kit/provider-core';
import { createRenderPresentationTools } from '@bangumi-agent-kit/tools';
import {
  buildSubjectOverviewViewModel,
  extractImageUrls,
  renderHtmlTemplate,
  RenderService,
} from '@bangumi-agent-kit/renderer';
import {
  AssetHttpTransport,
  AssetNetworkResolver,
  AssetResolver,
  DEFAULT_PLACEHOLDER_DATA_URL,
} from '../../packages/renderer/src/internal/index.js';
import { getSubjectOverview } from '../../packages/tools/src/subject-overview.js';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VALID_PNG_BUFFER = Buffer.from(DEFAULT_PLACEHOLDER_DATA_URL.split(',')[1]!, 'base64');
const LIMITS = { maxCast: 20, maxStaff: 24, maxRelations: 12 };

type FixtureState = 'complete' | 'partial' | 'unavailable' | 'not_found';
type ImageMode = 'valid' | 'failed' | 'ssrf';

const stats: SubjectStatsData = {
  score: 8.6,
  rank: 42,
  ratingTotal: 100,
  ratingHistogram: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
  collection: { wish: 10, collect: 20, doing: 3, onHold: 4, dropped: 2 },
};

function imageUrl(kind: string, index: number, imageMode: ImageMode): string {
  if (imageMode === 'failed' && kind === 'character' && index === 0) {
    return 'https://example.test/missing-character.png';
  }
  if (imageMode === 'ssrf' && kind === 'cover') {
    return 'http://127.0.0.1/rejected-cover.png';
  }
  return `https://example.test/${kind}-${index}.png`;
}

function subjectPayload(imageMode: ImageMode) {
  return {
    id: 123,
    type: 2,
    name: '少女終末旅行',
    name_cn: '少女终末旅行',
    summary:
      '这是用于验证真实语义输出、长 CJK、统计、角色、职员、关联条目和渲染边界的长文本 fixture。',
    nsfw: false,
    locked: false,
    date: '2017-10-06',
    platform: 'TV',
    images: { common: imageUrl('cover', 0, imageMode) },
    eps: 12,
    total_episodes: 12,
    rating: {
      score: 8.6,
      rank: 42,
      total: 100,
      count: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10 },
    },
    collection: { wish: 10, collect: 20, doing: 3, on_hold: 4, dropped: 2 },
  };
}

function charactersPayload(imageMode: ImageMode, count = 9) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `非常に長い角色名称 ${index + 1} チトとユーリの旅路`,
    type: index % 2 === 0 ? 1 : 2,
    summary: '',
    relation: index % 2 === 0 ? '主角' : '配角',
    images: { medium: imageUrl('character', index, imageMode) },
    actors: [
      {
        id: index + 101,
        name: `声优 ${index + 1}`,
        career: ['seiyu'],
        images: {},
      },
    ],
  }));
}

function personsPayload(imageMode: ImageMode) {
  return Array.from({ length: 10 }, (_, index) => ({
    id: index + 201,
    name: `制作人员 ${index + 1}`,
    type: 1,
    career: index % 2 === 0 ? ['director'] : ['writer'],
    relation: index % 2 === 0 ? '导演' : '作画监督',
    eps: '',
    images: { common: imageUrl('staff', index, imageMode) },
  }));
}

function relationsPayload(imageMode: ImageMode) {
  return Array.from({ length: 9 }, (_, index) => ({
    id: index + 301,
    type: index % 2 === 0 ? 2 : 1,
    name: `Related Original Title ${index + 1}`,
    name_cn: `关联作品 ${index + 1}`,
    relation: index % 2 === 0 ? '续集' : '原作',
    images: { common: imageUrl('relation', index, imageMode) },
  }));
}

function buildSemanticClient(
  state: FixtureState,
  imageMode: ImageMode,
  characterCount = 9,
): HttpClient {
  return new HttpClient({
    fetchFn: async (input) => {
      const url = String(input);
      if (url.endsWith('/v0/subjects/123')) {
        const status = state === 'unavailable' ? 503 : state === 'not_found' ? 404 : 200;
        return new Response(
          status === 200
            ? JSON.stringify(subjectPayload(imageMode))
            : JSON.stringify({ error: state }),
          { status },
        );
      }
      if (url.endsWith('/v0/subjects/123/characters')) {
        if (state === 'partial')
          return new Response(JSON.stringify({ error: 'characters unavailable' }), { status: 503 });
        return new Response(JSON.stringify(charactersPayload(imageMode, characterCount)), {
          status: 200,
        });
      }
      if (url.endsWith('/v0/subjects/123/persons')) {
        return new Response(JSON.stringify(personsPayload(imageMode)), { status: 200 });
      }
      if (url.endsWith('/v0/subjects/123/subjects')) {
        return new Response(JSON.stringify(relationsPayload(imageMode)), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    },
  });
}

function buildStatsProvider(): ProviderRegistry {
  return new ProviderRegistry({
    v0: {
      async getSubject() {
        return { state: 'ok' as const, data: undefined };
      },
      async getSubjectStats(): Promise<CapabilityResult<SubjectStatsData>> {
        return {
          state: 'ok',
          data: stats,
          retrievedAt: '2026-08-14T00:00:00.000Z',
          evidence: {
            'rating.score': [
              {
                source: {
                  class: 'official_v0',
                  provider: 'bangumi',
                  operation: 'getSubjectStats',
                },
                retrievedAt: '2026-08-14T00:00:00.000Z',
              },
            ],
          },
        };
      },
    },
  });
}

async function semanticFixture(
  state: FixtureState,
  imageMode: ImageMode = 'valid',
): Promise<SubjectOverviewResult> {
  return getSubjectOverview(123, LIMITS, {
    client: buildSemanticClient(state, imageMode),
    providerRegistry: buildStatsProvider(),
  });
}

function assertTruthfulFixture(result: SubjectOverviewResult): void {
  const sections = [result.stats, result.cast, result.staff, result.relations];
  const complete = sections.filter((section) => section.state === 'complete').length;
  const partial = sections.filter((section) => section.state === 'partial').length;
  const unavailable = sections.filter((section) => section.state === 'unavailable').length;
  const notComputable = sections.filter((section) => section.state === 'not_computable').length;
  const truncated = sections
    .map((section, index) =>
      section.coverage.truncated ? ['stats', 'cast', 'staff', 'relations'][index] : undefined,
    )
    .filter((section): section is string => Boolean(section));

  expect(result.coverage.sourceRequestsSucceeded).toBeLessThanOrEqual(
    result.coverage.sourceRequestsAttempted,
  );
  const successfulSections = sections.filter(
    (section) => section.state !== 'unavailable' && section.state !== 'not_computable',
  ).length;
  expect(result.coverage.sourceRequestsAttempted).toBe(result.subject ? 5 : 1);
  expect(result.coverage.sourceRequestsSucceeded).toBe(result.subject ? successfulSections + 1 : 0);
  expect(result.coverage.sectionsComplete).toBe(complete);
  expect(result.coverage.sectionsPartial).toBe(partial);
  expect(result.coverage.sectionsUnavailable).toBe(unavailable);
  expect(result.coverage.sectionsNotComputable).toBe(notComputable);
  expect(result.coverage.truncatedSections).toEqual(truncated);

  for (const section of sections) {
    expect(section.coverage.returned).toBeLessThanOrEqual(section.coverage.observed);
    if (section.state === 'complete') {
      expect(section.coverage.truncated).toBe(false);
      expect(section.coverage.returned).toBe(section.coverage.observed);
    }
    if (section.state === 'unavailable' || section.state === 'not_computable') {
      expect(section.coverage.observed).toBe(0);
      expect(section.coverage.returned).toBe(0);
    }
  }

  expect(result.cast.actorCoverage.returned).toBeLessThanOrEqual(
    result.cast.actorCoverage.observed,
  );
  for (const item of result.cast.items) {
    expect(item.actorCoverage.returned).toBeLessThanOrEqual(item.actorCoverage.observed);
  }
  expect(result.cast.items.length).toBe(result.cast.coverage.returned);
  expect(result.staff.items.length).toBe(result.staff.coverage.returned);
  expect(result.relations.items.length).toBe(result.relations.coverage.returned);
  const composition = result.evidence.find(
    (item) => item.source === 'derived-s7' && item.operation === 'subject-overview-composition',
  );
  if (result.subject) {
    expect(composition).toEqual(
      expect.objectContaining({
        formulaVersion: 'subject-overview-composition-v1',
        description: expect.stringContaining('without asserting a new upstream source'),
        retrievedAt: expect.any(String),
      }),
    );
    expect(composition?.description).toContain('partial');
  } else {
    expect(composition).toBeUndefined();
  }

  const officialEvidence = result.evidence.filter((entry) => entry.source === 'official-v0');
  expect(officialEvidence).toHaveLength(result.coverage.sourceRequestsAttempted);
  expect(officialEvidence.filter((item) => item.retrievedAt)).toHaveLength(
    result.coverage.sourceRequestsSucceeded,
  );
  for (const item of officialEvidence) {
    if (item.retrievedAt) {
      expect(item.attemptedAt).toEqual(expect.any(String));
    } else {
      expect(item).not.toHaveProperty('retrievedAt');
    }
  }
  expect(result.limitations.length).toBeGreaterThan(0);
  if (result.state === 'complete') expect(result.warnings).toHaveLength(0);
  if (result.state !== 'complete') expect(result.warnings.length).toBeGreaterThan(0);
  if (!result.subject) {
    expect(['unavailable', 'not_found']).toContain(result.state);
    expect(sections.every((section) => section.state === 'unavailable')).toBe(true);
    expect(result.warnings.some((warning) => warning.section === 'subject')).toBe(true);
  }
}

function createDeterministicRenderService(): { service: RenderService; requests: string[] } {
  const requests: string[] = [];
  const transport: AssetHttpTransport = {
    async request(url) {
      requests.push(url);
      if (url.includes('missing')) {
        return {
          status: 404,
          headers: { 'content-type': 'text/plain' },
          buffer: Buffer.alloc(0),
          url,
        };
      }
      return {
        status: 200,
        headers: { 'content-type': 'image/png' },
        buffer: VALID_PNG_BUFFER,
        url,
      };
    },
  };
  const resolver: AssetNetworkResolver = {
    async resolve() {
      return [{ address: '93.184.216.34', family: 4 }];
    },
  };
  return {
    service: new RenderService(undefined, undefined, new AssetResolver(transport, resolver)),
    requests,
  };
}

describe('Subject Overview renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = createDeterministicRenderService().service;
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('builds ViewModels from real semantic output and preserves truthful states', async () => {
    const complete = await semanticFixture('complete');
    const partial = await semanticFixture('partial');
    const unavailable = await semanticFixture('unavailable');
    const notFound = await semanticFixture('not_found');
    [complete, partial, unavailable, notFound].forEach(assertTruthfulFixture);

    const vm = buildSubjectOverviewViewModel(complete);
    expect(vm.template).toBe('subject-overview');
    expect(vm.cast.items).toHaveLength(9);
    expect(vm.cast.state).toBe('complete');
    expect(vm.staff.groups).toHaveLength(2);
    expect(vm.relations.items).toHaveLength(8);
    expect(vm.staff.hiddenCount).toBeGreaterThan(0);

    const html = renderHtmlTemplate(vm, 'bangumi-dark', {}, 640);
    expect(html).toContain('少女终末旅行');
    expect(html).toContain('评分与收藏统计');
    expect(html).toContain('完整');
    expect(html).toContain('有界样本');
    expect(html).not.toContain('example.test');
    expect(
      renderHtmlTemplate(buildSubjectOverviewViewModel(partial), 'bangumi-light', {}, 960),
    ).toContain('部分覆盖');
    expect(
      renderHtmlTemplate(buildSubjectOverviewViewModel(unavailable), 'bangumi-light', {}, 960),
    ).toContain('不可用');
    expect(
      renderHtmlTemplate(buildSubjectOverviewViewModel(notFound), 'bangumi-light', {}, 960),
    ).toContain('未找到');
  });

  it('renders every returned staff member when the requested cap allows it', async () => {
    const complete = await semanticFixture('complete');
    const templateMember = complete.staff.items[0];
    expect(templateMember).toBeDefined();
    if (!templateMember) throw new Error('semantic fixture must include a staff member');

    const staffItems = Array.from({ length: 87 }, (_, index) => ({
      ...templateMember,
      id: 20_000 + index,
      name: `制作职员${String(index + 1).padStart(2, '0')}`,
      relation: `制作组${(index % 12) + 1}`,
    }));
    const staffGroups = Array.from({ length: 12 }, (_, groupIndex) => {
      const members = staffItems.filter((_, index) => index % 12 === groupIndex);
      return {
        relation: `制作组${groupIndex + 1}`,
        count: members.length,
        memberIds: members.map((member) => member.id),
      };
    });
    const result: SubjectOverviewResult = {
      ...complete,
      staff: {
        ...complete.staff,
        items: staffItems,
        groups: staffGroups,
        coverage: { ...complete.staff.coverage, observed: 87, returned: 87, truncated: false },
      },
    };
    const viewModel = buildSubjectOverviewViewModel(result, {
      maxStaffGroups: 100,
      maxStaffMembersPerGroup: 100,
    });

    expect(viewModel.staff.groups).toHaveLength(12);
    expect(viewModel.staff.groups.flatMap((group) => group.members)).toHaveLength(87);
    expect(viewModel.staff.hiddenCount).toBeUndefined();
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 720);
    expect(html).toContain('制作职员01');
    expect(html).toContain('制作职员87');
    expect(html).not.toContain('另有 63 条已返回职员关系未展示');

    const rendered = await renderService.renderCard(viewModel, {
      width: 720,
      deviceScaleFactor: 1,
    });
    expect(rendered.height).toBeLessThanOrEqual(8192);
    expect(rendered.buffer.length).toBeLessThan(1_000_000);
    const visualQaDir = process.env.SUBJECT_OVERVIEW_VISUAL_QA_DIR;
    if (visualQaDir) {
      await mkdir(visualQaDir, { recursive: true });
      await writeFile(
        path.join(visualQaDir, 'subject-overview-full-staff-720.png'),
        rendered.buffer,
      );
    }
  });

  it('extracts only bounded subject-overview assets and resolves cover/character images', async () => {
    const result = await semanticFixture('complete');
    const vm = buildSubjectOverviewViewModel(result);
    const urls = extractImageUrls(vm);

    expect(urls).toHaveLength(10);
    expect(urls).toContain('https://example.test/cover-0.png');
    expect(urls).toContain('https://example.test/character-0.png');
    expect(urls.some((url) => url.includes('/staff-'))).toBe(false);
    expect(urls.some((url) => url.includes('/relation-'))).toBe(false);

    const oversized = {
      ...vm,
      cast: { ...vm.cast, items: [...vm.cast.items, ...vm.cast.items] },
    };
    expect(extractImageUrls(oversized)).toHaveLength(10);

    const isolated = createDeterministicRenderService();
    try {
      await isolated.service.renderCard(oversized, { width: 640 });
      expect(isolated.requests).toHaveLength(10);
    } finally {
      await isolated.service.close();
    }
  });

  it('keeps failed and rejected subject images on the AssetResolver placeholder path', async () => {
    const failed = buildSubjectOverviewViewModel(await semanticFixture('complete', 'failed'));
    const rejected = buildSubjectOverviewViewModel(await semanticFixture('complete', 'ssrf'));

    const isolated = createDeterministicRenderService();
    try {
      const failedRender = await isolated.service.renderCard(failed, { width: 640 });
      const rejectedRender = await isolated.service.renderCard(rejected, { width: 640 });
      expect(isolated.requests).not.toContain('http://127.0.0.1/rejected-cover.png');
      expect(failedRender.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'ASSET_FETCH_FAILED',
            url: 'https://example.test/missing-character.png',
          }),
        ]),
      );
      expect(rejectedRender.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'ASSET_URL_BLOCKED',
            url: 'http://127.0.0.1/rejected-cover.png',
          }),
        ]),
      );
      expect(failedRender.buffer.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
      expect(rejectedRender.buffer.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    } finally {
      await isolated.service.close();
    }
  });

  it('renders semantic complete, partial, unavailable, and not-found states at 720px and 960px', async () => {
    const variants = {
      complete: await semanticFixture('complete'),
      completeFailedImage: await semanticFixture('complete', 'failed'),
      partial: await semanticFixture('partial'),
      unavailable: await semanticFixture('unavailable'),
      notFound: await semanticFixture('not_found'),
    };
    const visualQaDir = process.env.SUBJECT_OVERVIEW_VISUAL_QA_DIR;
    if (visualQaDir) await mkdir(visualQaDir, { recursive: true });

    for (const [name, result] of Object.entries(variants)) {
      assertTruthfulFixture(result);
      const vm = buildSubjectOverviewViewModel(result);
      for (const width of [360, 720, 960]) {
        const deviceScaleFactor = width === 720 ? 1 : 2;
        const rendered = await renderService.renderCard(vm, {
          width,
          deviceScaleFactor,
        });
        expect(rendered.template, `${name} template`).toBe('subject-overview');
        expect(rendered.width, `${name} width`).toBe(width * deviceScaleFactor);
        expect(rendered.buffer.subarray(0, 8).equals(PNG_MAGIC), `${name} PNG`).toBe(true);
        expect(rendered.buffer.length, `${name} bytes`).toBeGreaterThan(1000);
        expect(rendered.height, `${name} height`).toBeLessThanOrEqual(8192);
        if (width === 360 || width === 720) {
          expect(rendered.buffer.length, `${name} mobile payload`).toBeLessThan(1_000_000);
        }
        if (visualQaDir) {
          await writeFile(
            path.join(visualQaDir, `subject-overview-${name}-${width}.png`),
            rendered.buffer,
          );
        }
      }
    }
  }, 20_000);

  it('keeps all nine returned roles through the mobile renderer without hidden truncation', async () => {
    const overview = await semanticFixture('complete');
    const viewModel = buildSubjectOverviewViewModel(overview);
    const rendered = await renderService.renderCard(viewModel, {
      width: 720,
      deviceScaleFactor: 1,
    });

    expect(viewModel.cast.items).toHaveLength(9);
    expect(viewModel.cast.hiddenCount).toBeUndefined();
    expect(rendered.warnings).not.toContainEqual(
      expect.objectContaining({ code: 'RENDERER_CAST_OUTPUT_TRUNCATED' }),
    );
    expect(rendered.height).toBeLessThanOrEqual(8192);
  });

  it('uses the full-sized canvas for the public subject overview artifact by default', async () => {
    const renderCard = vi.fn(
      async (_viewModel: ReturnType<typeof buildSubjectOverviewViewModel>) => ({
        buffer: VALID_PNG_BUFFER,
        mimeType: 'image/png' as const,
        width: 720,
        height: 1200,
        template: 'subject-overview' as const,
        templateVersion: 1,
        cacheKey: 'subject-overview-mobile',
        warnings: [],
      }),
    );
    const artifactStore = {
      saveArtifact: vi.fn(async () => ({
        id: 'mobile-overview-artifact',
        mimeType: 'image/png' as const,
        width: 720,
        height: 1200,
      })),
    };
    const tools = createRenderPresentationTools(
      { renderCard } as unknown as RenderService,
      artifactStore as never,
    );
    const overview = tools.find((tool) => tool.name === 'bangumi.render_subject_overview');
    expect(overview).toBeDefined();

    await overview!.execute({ subjectId: 123 } as never, {} as never, {
      publicHttpClient: buildSemanticClient('complete', 'valid', 9),
      providerRegistry: buildStatsProvider(),
    });

    const renderCall = renderCard.mock.calls[0];
    expect(renderCall).toBeDefined();
    if (!renderCall) throw new Error('overview renderer must receive a view model');
    const renderedViewModel = renderCall[0];
    expect(renderedViewModel.cast.items).toHaveLength(9);
    expect(renderedViewModel.cast.state).toBe('complete');
    expect(renderedViewModel.staff.groups.flatMap((group) => group.members)).toHaveLength(10);
    expect(renderedViewModel.staff.hiddenCount).toBeUndefined();
    expect(renderCard).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'subject-overview' }),
      { width: 720, deviceScaleFactor: 1 },
    );
    expect(artifactStore.saveArtifact).toHaveBeenCalledWith(VALID_PNG_BUFFER, 'image/png', {
      width: 720,
      height: 1200,
    });
  });

  it('routes chat-target overview cards through the 360px viewport at 2x density', async () => {
    const renderCard = vi.fn(
      async (
        _viewModel: ReturnType<typeof buildSubjectOverviewViewModel>,
        options?: { width?: number; deviceScaleFactor?: number },
      ) => ({
        buffer: VALID_PNG_BUFFER,
        mimeType: 'image/png' as const,
        width: (options?.width ?? 960) * (options?.deviceScaleFactor ?? 2),
        height: 1200,
        template: 'subject-overview' as const,
        templateVersion: 1,
        cacheKey: 'subject-overview-chat',
        warnings: [],
      }),
    );
    const artifactStore = {
      saveArtifact: vi.fn(
        async (
          _buffer: Buffer,
          _mimeType: 'image/png',
          size: { width?: number; height?: number },
        ) => ({
          id: 'chat-overview-artifact',
          mimeType: 'image/png' as const,
          ...size,
        }),
      ),
    };
    const tools = createRenderPresentationTools(
      { renderCard } as unknown as RenderService,
      artifactStore as never,
      'chat',
    );
    const overview = tools.find((tool) => tool.name === 'bangumi.render_subject_overview');
    expect(overview).toBeDefined();

    const rendered = await overview!.execute({ subjectId: 123 } as never, {} as never, {
      publicHttpClient: buildSemanticClient('complete', 'valid', 9),
      providerRegistry: buildStatsProvider(),
    });

    expect(rendered).toMatchObject({ artifact: { width: 720, height: 1200 } });
    expect(renderCard).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'subject-overview' }),
      { width: 360, deviceScaleFactor: 2 },
    );
  });
});
