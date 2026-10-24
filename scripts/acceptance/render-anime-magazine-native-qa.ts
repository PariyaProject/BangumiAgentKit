import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GeneratedBangumiOpenApiClient } from '../../packages/bangumi-openapi/dist/index.js';
import { compareSubjectCohorts } from '../../packages/discovery/dist/index.js';
import { OfficialV0Provider, ProviderRegistry } from '../../packages/provider-core/dist/index.js';
import {
  AssetResolver,
  RenderService,
  buildSubjectCohortComparisonViewModel,
  type SubjectCohortComparisonViewModel,
} from '../../packages/renderer/dist/index.js';
import { createC07RenderComparisonOfflineFetch } from '../lib/c07-render-comparison-offline-fixture.mjs';
import {
  C07_RENDER_COMPARISON_OFFLINE_V4_PROFILE_ID,
  getC07RenderComparisonOfflineConfig,
} from '../lib/c07-render-comparison-offline-profile.mjs';

const root = process.cwd();
const profileId = C07_RENDER_COMPARISON_OFFLINE_V4_PROFILE_ID;
const profile = getC07RenderComparisonOfflineConfig(profileId);
if (!profile) throw new Error('The existing two-cohort QA fixture is missing.');
const coverUrls = [
  'https://render-fixtures.invalid/anime-magazine/f.png',
  'https://render-fixtures.invalid/anime-magazine/g.png',
];
const stamp = '2026-10-23T12:00:00.000Z';
const digest = (value: Buffer) => createHash('sha256').update(value).digest('hex');

class ClosedSyntheticAssets extends AssetResolver {
  private data = new Map<string, string>();
  requests = 0;
  async initialize() {
    for (const [index, key] of ['f', 'g'].entries()) {
      const bytes = await readFile(
        path.join(root, `tests/fixtures/render/anime-magazine-cover-${key}.png`),
      );
      this.data.set(coverUrls[index]!, `data:image/png;base64,${bytes.toString('base64')}`);
    }
  }
  override async resolveAsset(url: string): Promise<{ dataUrl: string }> {
    this.requests++;
    const dataUrl = this.data.get(url);
    if (!dataUrl) throw new Error('Native QA refuses every non-fixture image URL.');
    return { dataUrl };
  }
}

async function completeViewModel(): Promise<SubjectCohortComparisonViewModel> {
  const fixture = createC07RenderComparisonOfflineFetch(profileId);
  const fetchFn: typeof fixture.fetchFn = async (input, init) => {
    const response = await fixture.fetchFn(input, init);
    const body = (await response.json()) as Record<string, unknown>;
    for (const candidate of Array.isArray(body.data) ? body.data : []) {
      const index = profile!.cohorts.findIndex((cohort) => cohort.subjectId === candidate.id);
      if (index >= 0) candidate.name_cn = index === 0 ? '星港随笔' : '海岸线日志';
    }
    const index = profile!.cohorts.findIndex((cohort) => cohort.subjectId === body.id);
    if (index >= 0) body.name_cn = index === 0 ? '星港随笔' : '海岸线日志';
    if (index >= 0)
      body.images = {
        grid: coverUrls[index],
        small: coverUrls[index],
        medium: coverUrls[index],
        common: coverUrls[index],
        large: coverUrls[index],
      };
    return new Response(JSON.stringify(body), {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = new GeneratedBangumiOpenApiClient({ baseUrl: 'https://api.bgm.tv', fetchFn });
  const providers = new ProviderRegistry({ v0: new OfficialV0Provider(client) });
  const result = await compareSubjectCohorts(
    profile!.expectedArguments.cohorts,
    { maxSubjects: profile!.expectedArguments.maxSubjects },
    providers,
    { authScope: 'public' },
  );
  const snapshot = fixture.snapshot();
  if (
    snapshot.requestCount !== 4 ||
    snapshot.unexpectedRequestCount !== 0 ||
    snapshot.authorizationHeaderCount !== 0 ||
    !snapshot.expectedOperationsComplete
  ) {
    throw new Error('Native QA must use exactly four closed synthetic source responses.');
  }
  const vm = buildSubjectCohortComparisonViewModel(result, { maxSubjectsPerCohort: 1 });
  if (
    vm.state !== 'complete' ||
    vm.cohorts.some((cohort, index) => cohort.subjects[0]?.image !== coverUrls[index])
  ) {
    throw new Error(
      'Real discovery → ViewModel cover propagation failed: ' +
        JSON.stringify({
          state: vm.state,
          subjects: vm.cohorts.map((c) => c.subjects.map((s) => ({ id: s.id, image: s.image }))),
          warningCodes: vm.warnings.map((w) => w.code),
        }),
    );
  }
  vm.source.official.retrievedAt = stamp;
  vm.source.derived.retrievedAt = stamp;
  vm.retrievedAt = stamp;
  return vm;
}

function partialViewModel(vm: SubjectCohortComparisonViewModel): SubjectCohortComparisonViewModel {
  const partial = structuredClone(vm);
  partial.state = 'partial';
  const cohort = partial.cohorts[1]!;
  cohort.subjects = [];
  cohort.coverage.detailHydrationsSucceeded = 0;
  cohort.coverage.detailHydrationsFailed = 1;
  for (const key of ['score', 'heat', 'episodesReported', 'ratingStandardDeviation'] as const) {
    cohort.coverage.metrics[key] = {
      valid: 0,
      partial: 0,
      missing: 1,
      conflicts: 0,
      notComputable: 0,
      state: 'partial',
    };
  }
  partial.metrics = partial.metrics.map((metric) => ({
    ...metric,
    state: 'partial',
    averages: [metric.averages[0], undefined],
    partialAverages: [metric.partialAverages?.[0], undefined],
    validCounts: [metric.validCounts[0] ?? 0, 0],
    partialCounts: [0, 0],
    missingCounts: [0, 1],
    conflictCounts: [0, 0],
    notComputableCounts: [0, 0],
    delta: undefined,
  }));
  partial.coverage.totalSubjectsReturned = 1;
  partial.coverage.cohortsComplete = 1;
  partial.coverage.cohortsPartial = 1;
  partial.coverage.detailHydrationsSucceeded = 1;
  partial.coverage.detailHydrationsFailed = 1;
  partial.warnings = [
    {
      code: 'SYNTHETIC_PARTIAL_FIXTURE',
      state: 'partial',
      message: '第二组作品详情暂不可用；缺失字段不会按 0 计算。',
    },
  ];
  return partial;
}

async function main() {
  const matrix = process.argv.includes('--matrix');
  const fontSizeScale = process.argv.includes('--large-font') ? 1.25 : 0.75;
  const suffix = process.argv.find((arg) => arg.startsWith('--suffix='))?.slice(9) ?? 'v1';
  if (!/^[a-z0-9-]{1,40}$/u.test(suffix)) throw new Error('Invalid QA output suffix.');
  const output = path.join(
    root,
    `.artifacts/render/anime-magazine-${matrix ? 'matrix' : 'preview'}-${suffix}`,
  );
  await mkdir(output, { recursive: true });
  const complete = await completeViewModel();
  const partial = partialViewModel(complete);
  const missing = structuredClone(complete);
  for (const cohort of missing.cohorts) for (const subject of cohort.subjects) delete subject.image;
  const long = structuredClone(complete);
  long.cohorts[0]!.subjects[0]!.displayName = '在漫长夏日与遥远星港之间寻找尚未说完的故事';
  long.cohorts[0]!.subjects[0]!.name =
    'A Very Long Original Title: Across the Summer Sky and the Distant Harbor';
  const large = structuredClone(complete);
  const longOriginal = structuredClone(complete);
  longOriginal.cohorts[0]!.subjects[0]!.name = '長い原題'.repeat(45);
  longOriginal.cohorts[0]!.subjects[0]!.displayName = '原題境界';
  const heat = large.metrics.find((metric) => metric.key === 'heat')!;
  heat.averages = [2150000, 9600000];
  heat.delta = 7450000;
  const cases = process.argv.includes('--long-original-only')
    ? ([['long-original', longOriginal]] as const)
    : matrix
      ? ([
          ['complete', complete],
          ['partial', partial],
          ['missing-covers', missing],
          ['long-titles', long],
          ['long-original', longOriginal],
          ['large-counts', large],
        ] as const)
      : ([
          ['complete', complete],
          ['partial', partial],
        ] as const);
  if (process.argv.includes('--export-fixtures')) {
    await writeFile(
      path.join(output, 'fixtures.json'),
      JSON.stringify(Object.fromEntries(cases), null, 2) + '\n',
      { flag: 'wx' },
    );
    console.log(JSON.stringify({ output, exportedSyntheticStates: cases.length }));
    return;
  }
  const assets = new ClosedSyntheticAssets();
  await assets.initialize();
  const renderer = new RenderService(undefined, undefined, assets);
  const images = [];
  try {
    for (const [state, vm] of cases) {
      const combinations = matrix
        ? [320, 375, 414, 768].flatMap((width) =>
            (['bangumi-light', 'bangumi-dark'] as const).map((theme) => ({ width, theme })),
          )
        : [
            {
              width: state === 'complete' ? 360 : 320,
              theme: state === 'complete' ? ('bangumi-light' as const) : ('bangumi-dark' as const),
            },
          ];
      for (const { width, theme } of combinations) {
        const result = await renderer.renderCard(vm, {
          designPack: 'anime-magazine',
          theme,
          typography: { fontSizeScale },
          width,
          deviceScaleFactor: 2,
          cache: false,
        });
        const file = `${state}-${theme}-${width}.png`;
        await writeFile(path.join(output, file), result.buffer, { flag: 'wx' });
        images.push({
          state,
          theme,
          width,
          file,
          pixelWidth: result.width,
          pixelHeight: result.height,
          bytes: result.buffer.length,
          sha256: digest(result.buffer),
          warningCount: result.warnings.length,
        });
      }
    }
    const receipt = {
      schema: 'bangumi-native-design-qa/v1',
      designPack: 'anime-magazine',
      fontSizeScale,
      template: 'subject-cohort-comparison',
      reference: 'docs/design/references/c07-anime-magazine-v1.png',
      sourceKind: 'synthetic-closed-fixture',
      externalRequests: 0,
      accountOrClientActions: 0,
      sourceResponses: 4,
      coverResolutions: assets.requests,
      userAestheticAcceptance: 'unobserved',
      images,
    };
    await writeFile(path.join(output, 'manifest.json'), JSON.stringify(receipt, null, 2) + '\n', {
      flag: 'wx',
    });
    console.log(
      JSON.stringify({
        output,
        images: images.length,
        externalRequests: 0,
        coverResolutions: assets.requests,
      }),
    );
  } finally {
    await renderer.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
