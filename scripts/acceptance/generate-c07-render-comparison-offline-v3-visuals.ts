import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { compareSubjectCohorts } from '@bangumi-agent-kit/discovery';
import { OfficialV0Provider, ProviderRegistry } from '@bangumi-agent-kit/provider-core';
import {
  RenderService,
  buildSubjectCohortComparisonViewModel,
  extractImageUrls,
  type SubjectCohortComparisonViewModel,
} from '@bangumi-agent-kit/renderer';
import {
  C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
  getC07RenderComparisonOfflineConfig,
} from '../lib/c07-render-comparison-offline-profile.mjs';
import { createC07RenderComparisonOfflineFetch } from '../lib/c07-render-comparison-offline-fixture.mjs';
import { computeMcpBundleSha256, readG26McpBundleAttestation } from '../lib/g26-mcp-bundle.mjs';
import { computeC07V3VisualQaGenerationSourceSha256 } from '../lib/c07-render-comparison-visual-qa.mjs';

const OUTPUT_DIR = path.resolve(
  '.artifacts/render/c07-cohort-comparison-v3-visual-qa-candidate-bound-20261019-round2',
);
const WIDTHS = [320, 360, 520, 640, 960];
const SYNTHETIC_RETRIEVED_AT = '2026-10-18T14:00:00.000Z';
const EXPECTED_PROFILE_SUBJECT_ID = 991226;

function requireV3Profile() {
  const profile = getC07RenderComparisonOfflineConfig(C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID);
  if (!profile) throw new Error('C07 v3 visual fixture profile is unavailable.');
  return profile;
}

const PROFILE = requireV3Profile();
if (PROFILE.subjectId !== EXPECTED_PROFILE_SUBJECT_ID) {
  throw new Error('C07 v3 visual fixture is not bound to its registered synthetic subject.');
}

const sha256 = (value: Buffer) => createHash('sha256').update(value).digest('hex');

async function createExactCompleteViewModel(): Promise<SubjectCohortComparisonViewModel> {
  const fixture = createC07RenderComparisonOfflineFetch(
    C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
  );
  const publicHttpClient = new HttpClient({
    baseUrl: 'https://api.bgm.tv',
    fetchFn: fixture.fetchFn,
  });
  const providerRegistry = new ProviderRegistry({
    v0: new OfficialV0Provider(new GeneratedBangumiOpenApiClient(publicHttpClient)),
  });
  const result = await compareSubjectCohorts(
    PROFILE.expectedArguments.cohorts,
    { maxSubjects: PROFILE.expectedArguments.maxSubjects },
    providerRegistry,
    { authScope: 'public' },
  );
  const snapshot = fixture.snapshot();
  if (
    snapshot.requestCount !== 2 ||
    snapshot.searchRequestCount !== 1 ||
    snapshot.subjectDetailRequestCount !== 1 ||
    snapshot.duplicateRequestCount !== 0 ||
    snapshot.unexpectedRequestCount !== 0 ||
    snapshot.authorizationHeaderCount !== 0 ||
    !snapshot.expectedOperationsComplete ||
    snapshot.rawFixturePayloadStored
  ) {
    throw new Error(
      `C07 v3 visual fixture did not complete its exact local operations: ${JSON.stringify(snapshot)}`,
    );
  }
  return requireCapturedViewModel(buildSubjectCohortComparisonViewModel(result));
}

function requireCapturedViewModel(
  viewModel: SubjectCohortComparisonViewModel | undefined,
): SubjectCohortComparisonViewModel {
  if (!viewModel) throw new Error('C07 v3 renderer did not produce a ViewModel.');

  const cohort = viewModel.cohorts[0];
  const subject = cohort?.subjects[0];
  const expectedAverages = new Map([
    ['score', 7],
    ['heat', 3],
    ['episodesReported', 1],
    ['ratingStandardDeviation', 0],
  ]);
  const averagesMatch = [...expectedAverages].every(([key, expected]) => {
    const metric = viewModel.metrics.find((candidate) => candidate.key === key);
    return metric?.averages[0] === expected;
  });
  if (
    viewModel.state !== 'complete' ||
    viewModel.cohorts.length !== 1 ||
    cohort?.label !== PROFILE.cohortLabel ||
    subject?.id !== PROFILE.subjectId ||
    subject.name !== PROFILE.subjectName ||
    subject.displayName !== PROFILE.subjectNameCn ||
    subject.score !== 7 ||
    subject.ratingCount !== 10 ||
    subject.ratingHistogramPopulation !== 10 ||
    subject.ratingStandardDeviation !== 0 ||
    subject.collectionTotal !== 3 ||
    subject.episodesReported !== 1 ||
    subject.totalEpisodesReported !== 1 ||
    !averagesMatch
  ) {
    throw new Error(
      'C07 v3 visual ViewModel no longer matches the exact registered local fixture.',
    );
  }

  return {
    ...viewModel,
    source: {
      ...viewModel.source,
      official: { ...viewModel.source.official, retrievedAt: SYNTHETIC_RETRIEVED_AT },
      derived: { ...viewModel.source.derived, retrievedAt: SYNTHETIC_RETRIEVED_AT },
    },
    retrievedAt: SYNTHETIC_RETRIEVED_AT,
  };
}

function buildPartialViewModel(complete: SubjectCohortComparisonViewModel) {
  const missingMetricCoverage = {
    valid: 0,
    partial: 0,
    missing: 1,
    conflicts: 0,
    notComputable: 0,
    state: 'partial' as const,
  };
  return {
    ...complete,
    state: 'partial' as const,
    cohorts: complete.cohorts.map((cohort) => ({
      ...cohort,
      subjects: [],
      coverage: {
        ...cohort.coverage,
        detailHydrationsAttempted: 1,
        detailHydrationsSucceeded: 0,
        detailHydrationsFailed: 1,
        metrics: {
          score: missingMetricCoverage,
          heat: missingMetricCoverage,
          episodesReported: missingMetricCoverage,
          ratingStandardDeviation: missingMetricCoverage,
        },
      },
    })),
    metrics: complete.metrics.map((metric) => ({
      ...metric,
      averages: [undefined],
      partialAverages: [undefined],
      validCounts: [0],
      partialCounts: [0],
      missingCounts: [1],
      conflictCounts: [0],
      notComputableCounts: [0],
      state: 'partial' as const,
    })),
    coverage: {
      ...complete.coverage,
      totalSubjectsReturned: 1,
      cohortsComplete: 0,
      cohortsPartial: 1,
      detailHydrationsSucceeded: 0,
      detailHydrationsFailed: 1,
      warnings: { ...complete.coverage.warnings, retained: 1 },
    },
    warnings: [
      {
        code: 'SYNTHETIC_PARTIAL_FIXTURE',
        state: 'partial' as const,
        message: '条目详情暂不可用；缺失字段不会按 0 计算。',
        cohort: PROFILE.cohortLabel,
      },
    ],
    limitations: [
      '检索返回一条合成作品结果，但作品详情暂不可用，因此本图不显示作品行。',
      '详情缺失不等于数值为 0，也不能据此判断该作品不存在或未匹配。',
      '本图使用本地合成数据，不代表 Bangumi 全部条目。',
    ],
  } satisfies SubjectCohortComparisonViewModel;
}

function assertNoExternalImageUrls(viewModel: SubjectCohortComparisonViewModel) {
  if (extractImageUrls(viewModel).length !== 0) {
    throw new Error('C07 v3 visual fixture unexpectedly contains an external image URL.');
  }
}

async function main() {
  await mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: false });
  const complete = await createExactCompleteViewModel();
  const cases = [
    { id: 'complete-single-cohort-e', viewModel: complete },
    { id: 'partial-single-cohort-e', viewModel: buildPartialViewModel(complete) },
  ];
  const renderer = new RenderService();
  const manifest: Array<Record<string, string | number>> = [];

  try {
    for (const visualCase of cases) {
      assertNoExternalImageUrls(visualCase.viewModel);

      for (const width of WIDTHS) {
        const rendered = await renderer.renderCard(visualCase.viewModel, {
          width,
          deviceScaleFactor: 1,
          cache: false,
        });
        if (
          rendered.width !== width ||
          rendered.buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
        ) {
          throw new Error(`C07 v3 generated an invalid ${visualCase.id} PNG at ${width}px.`);
        }
        const filename = `${visualCase.id}-${width}.png`;
        await writeFile(path.join(OUTPUT_DIR, filename), rendered.buffer, { flag: 'wx' });
        manifest.push({
          case: visualCase.id,
          file: filename,
          cssWidth: width,
          pixelWidth: rendered.width,
          pixelHeight: rendered.height,
          byteLength: rendered.buffer.length,
          sha256: sha256(rendered.buffer),
        });
      }
    }
  } finally {
    await renderer.close();
  }

  const buildBundleSha256 = computeMcpBundleSha256(process.cwd());
  if (readG26McpBundleAttestation(process.cwd()) !== buildBundleSha256) {
    throw new Error('C07 v3 visual QA requires a current exact renderer bundle attestation.');
  }
  const generationSourceSha256 = computeC07V3VisualQaGenerationSourceSha256(process.cwd());

  await writeFile(
    path.join(OUTPUT_DIR, 'manifest.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        buildBundleSha256,
        generationSourceSha256,
        files: manifest,
      },
      null,
      2,
    )}\n`,
    { flag: 'wx' },
  );
  process.stdout.write(`${JSON.stringify({ outputDir: OUTPUT_DIR, files: manifest.length })}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(`C07 v3 offline visual generation failed: ${message}\n`);
  process.exitCode = 1;
});
