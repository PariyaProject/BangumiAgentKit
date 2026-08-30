import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CharacterCreditIntegrityService,
  type CharacterCreditIntegrityResult,
} from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  buildCharacterCreditIntegrityViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';
import { getTemplate } from '../../packages/renderer/src/templates/TemplateRegistry.js';

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('character-credit-integrity renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders stable-ID evidence and risks without image hydration', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/characters/100')) {
        return json({
          id: 100,
          name: '角色卡片',
          type: 1,
          summary: '不应触发图片下载的角色简介',
          locked: false,
          stat: {},
          images: { large: 'https://example.invalid/character.png' },
        });
      }
      if (path.endsWith('/subjects')) {
        return json([
          { id: 10, type: 2, name: '同名作品', name_cn: '同名作品', staff: '主角', eps: '1' },
          { id: 11, type: 2, name: '同名作品', name_cn: '同名作品', staff: '配角', eps: '2' },
        ]);
      }
      return json([
        {
          id: 20,
          name: '同名 CV',
          type: 1,
          subject_id: 10,
          subject_type: 2,
          subject_name: '同名作品',
          subject_name_cn: '同名作品',
          staff: '声优',
        },
      ]);
    };
    const result = await new CharacterCreditIntegrityService(
      new HttpClient({ fetchFn }),
    ).getCharacterCreditIntegrity(100);
    const viewModel = buildCharacterCreditIntegrityViewModel(result);

    expect(viewModel.template).toBe('character-credit-integrity');
    expect(getTemplate('character-credit-integrity').version).toBe(1);
    expect(extractImageUrls(viewModel)).toEqual([]);
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('角色出演作品与 CV 完整性');
    expect(html).toContain('同名不同 ID');
    expect(html).toContain('不做名称合并');
    expect(html).not.toContain('character.png');
  });

  it('renders dense and sparse state fixtures as bounded 640px and 960px PNGs', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/characters/100')) {
        return json({
          id: 100,
          name: '角色卡片',
          type: 1,
          summary: '长简介'.repeat(100),
          locked: false,
          stat: {},
        });
      }
      if (path.endsWith('/subjects')) {
        return json([
          { id: 10, type: 2, name: '同名作品', name_cn: '同名作品', staff: '主角', eps: '1' },
          { id: 11, type: 2, name: '同名作品', name_cn: '同名作品', staff: '配角', eps: '2' },
        ]);
      }
      return json([
        {
          id: 20,
          name: '同名 CV',
          type: 1,
          subject_id: 10,
          subject_type: 2,
          subject_name: '同名作品',
          subject_name_cn: '同名作品',
          staff: '声优',
        },
      ]);
    };
    const baseResult = await new CharacterCreditIntegrityService(
      new HttpClient({ fetchFn }),
    ).getCharacterCreditIntegrity(100);
    const variants: Array<[string, CharacterCreditIntegrityResult]> = [
      ['complete', baseResult],
      [
        'partial',
        {
          ...baseResult,
          state: 'partial',
          coverage: {
            ...baseResult.coverage,
            subjects: { ...baseResult.coverage.subjects, state: 'partial', truncated: true },
            output: { ...baseResult.coverage.output, truncated: true },
          },
          warnings: [
            ...baseResult.warnings,
            { code: 'FIXTURE_PARTIAL', state: 'partial', message: '部分来源 fixture' },
          ],
        },
      ],
      [
        'conflict',
        {
          ...baseResult,
          state: 'conflict',
          warnings: [
            ...baseResult.warnings,
            { code: 'FIXTURE_CONFLICT', state: 'conflict', message: '冲突 fixture' },
          ],
        },
      ],
      [
        'unavailable',
        {
          ...baseResult,
          state: 'unavailable',
          character: undefined,
          subjectCredits: [],
          personCredits: [],
          risks: [],
          coverage: {
            ...baseResult.coverage,
            detail: { ...baseResult.coverage.detail, state: 'unavailable' },
            subjects: {
              ...baseResult.coverage.subjects,
              state: 'unavailable',
              uniqueIdsObserved: 0,
            },
            persons: { ...baseResult.coverage.persons, state: 'unavailable', uniqueIdsObserved: 0 },
            output: {
              ...baseResult.coverage.output,
              returnedSubjects: 0,
              returnedPersons: 0,
              risksReturned: 0,
              risksOmitted: 0,
              truncated: false,
            },
          },
        },
      ],
      [
        'not_found',
        {
          ...baseResult,
          state: 'not_found',
          character: undefined,
          subjectCredits: [],
          personCredits: [],
          risks: [],
          coverage: {
            ...baseResult.coverage,
            detail: { ...baseResult.coverage.detail, state: 'not_found' },
            subjects: { ...baseResult.coverage.subjects, state: 'not_found', uniqueIdsObserved: 0 },
            persons: { ...baseResult.coverage.persons, state: 'not_found', uniqueIdsObserved: 0 },
            output: {
              ...baseResult.coverage.output,
              returnedSubjects: 0,
              returnedPersons: 0,
              risksReturned: 0,
              risksOmitted: 0,
              truncated: false,
            },
          },
        },
      ],
    ];
    const denseResult: CharacterCreditIntegrityResult = {
      ...baseResult,
      personCredits: [
        {
          ...baseResult.personCredits[0]!,
          name: '长人物'.repeat(80),
          subjects: Array.from({ length: 20 }, (_, index) => ({
            subjectId: 100 + index,
            subjectType: 2,
            subjectName: `长作品 ${index} `.repeat(20),
            subjectNameCn: `长作品中文 ${index} `.repeat(20),
            staff: '声优',
          })),
          subjectsOmitted: 0,
        },
      ],
      coverage: {
        ...baseResult.coverage,
        persons: { ...baseResult.coverage.persons, uniqueIdsObserved: 1, returnedRows: 1 },
        output: {
          ...baseResult.coverage.output,
          returnedPersons: 1,
          returnedPersonSubjectCredits: 20,
          omittedPersonSubjectCredits: 0,
        },
      },
    };
    const denseViewModel = buildCharacterCreditIntegrityViewModel(denseResult);
    expect(denseViewModel.presentation).toMatchObject({
      state: 'partial',
      personSubjects: { available: 20, rendered: 5, omitted: 15 },
    });
    expect(renderHtmlTemplate(denseViewModel, 'bangumi-dark', {}, 640)).toContain(
      '另有 15 个作品关系省略',
    );

    const personCapResult: CharacterCreditIntegrityResult = {
      ...baseResult,
      personCredits: Array.from({ length: 13 }, (_, personIndex) => ({
        ...baseResult.personCredits[0]!,
        id: 200 + personIndex,
        name: `CV ${personIndex}`,
        observedRows: 1,
        duplicateRows: 0,
        duplicateRelationRows: 0,
        subjects: Array.from({ length: personIndex === 12 ? 3 : 1 }, (_, subjectIndex) => ({
          subjectId: 1_000 + personIndex * 10 + subjectIndex,
          subjectType: 2,
          subjectName: `作品 ${personIndex}-${subjectIndex}`,
          subjectNameCn: `作品 ${personIndex}-${subjectIndex}`,
          staff: '声优',
        })),
        subjectsOmitted: 0,
      })),
      coverage: {
        ...baseResult.coverage,
        persons: { ...baseResult.coverage.persons, uniqueIdsObserved: 13, returnedRows: 13 },
        output: {
          ...baseResult.coverage.output,
          returnedPersons: 13,
          returnedPersonSubjectCredits: 15,
          omittedPersonSubjectCredits: 0,
        },
      },
    };
    const personCapViewModel = buildCharacterCreditIntegrityViewModel(personCapResult, {
      maxPersons: 12,
    });
    expect(personCapViewModel.presentation).toMatchObject({
      state: 'partial',
      persons: { available: 13, rendered: 12, omitted: 1 },
      personSubjects: { available: 15, rendered: 12, omitted: 3 },
    });
    expect(renderHtmlTemplate(personCapViewModel, 'bangumi-dark', {}, 640)).toContain('12/15');

    for (const [label, stateResult] of [
      ...variants,
      ['nested-cap', denseResult] as const,
      ['person-cap', personCapResult] as const,
    ]) {
      const viewModel = buildCharacterCreditIntegrityViewModel(stateResult);
      expect(extractImageUrls(viewModel), label).toEqual([]);
      for (const width of [640, 960]) {
        const rendered = await renderService.renderCard(viewModel, {
          width,
          deviceScaleFactor: 1,
          cache: false,
        });
        expect(rendered.template, `${label} template`).toBe('character-credit-integrity');
        expect(rendered.width, `${label} width`).toBe(width);
        expect(
          rendered.buffer
            .subarray(0, 8)
            .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
          label,
        ).toBe(true);
        expect(rendered.buffer.length, `${label} PNG size`).toBeGreaterThan(1000);
        expect(rendered.height, `${label} PNG height`).toBeLessThan(5_000);
      }
    }
  });
});
