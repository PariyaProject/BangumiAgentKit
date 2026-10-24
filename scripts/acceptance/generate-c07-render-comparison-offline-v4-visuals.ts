import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GeneratedBangumiOpenApiClient } from '../../packages/bangumi-openapi/dist/index.js';
import { compareSubjectCohorts } from '../../packages/discovery/dist/index.js';
import { OfficialV0Provider, ProviderRegistry } from '../../packages/provider-core/dist/index.js';
import {
  RenderService,
  buildSubjectCohortComparisonViewModel,
  extractImageUrls,
  type SubjectCohortComparisonViewModel,
} from '../../packages/renderer/dist/index.js';
import {
  C07_RENDER_COMPARISON_OFFLINE_V4_PROFILE_ID,
  getC07RenderComparisonOfflineConfig,
} from '../lib/c07-render-comparison-offline-profile.mjs';
import { createC07RenderComparisonOfflineFetch } from '../lib/c07-render-comparison-offline-fixture.mjs';
import { computeMcpBundleSha256, readG26McpBundleAttestation } from '../lib/g26-mcp-bundle.mjs';
import { computeC07V4VisualQaGenerationSourceSha256 } from '../lib/c07-render-comparison-v4-visual-qa.mjs';

const PROFILE_ID = C07_RENDER_COMPARISON_OFFLINE_V4_PROFILE_ID;
const OUTPUT_DIR = path.resolve(
  '.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v40',
);
const WIDTHS = [320, 360, 520, 640, 960];
const DESIGN_PACKS = ['warm-editorial', 'clean-gallery', 'graphic-zine'] as const;
const THEMES = ['bangumi-light', 'bangumi-dark'] as const;
const SYNTHETIC_RETRIEVED_AT = '2026-10-23T12:00:00.000Z';

const PROFILE = (() => {
  const profile = getC07RenderComparisonOfflineConfig(PROFILE_ID);
  if (!profile || profile.cohorts.length !== 2 || profile.expectedArguments.cohorts.length !== 2) {
    throw new Error('C07 v4 visual fixture requires exactly two registered cohorts.');
  }
  return profile;
})();

const sha256 = (value: Buffer) => createHash('sha256').update(value).digest('hex');

async function createExactCompleteViewModel(): Promise<SubjectCohortComparisonViewModel> {
  const fixture = createC07RenderComparisonOfflineFetch(PROFILE_ID);
  const publicHttpClient = new GeneratedBangumiOpenApiClient({
    baseUrl: 'https://api.bgm.tv',
    fetchFn: fixture.fetchFn,
  });
  const providerRegistry = new ProviderRegistry({
    v0: new OfficialV0Provider(publicHttpClient),
  });
  const result = await compareSubjectCohorts(
    PROFILE.expectedArguments.cohorts,
    { maxSubjects: PROFILE.expectedArguments.maxSubjects },
    providerRegistry,
    { authScope: 'public' },
  );
  const snapshot = fixture.snapshot();
  if (
    snapshot.requestCount !== 4 ||
    snapshot.searchRequestCount !== 2 ||
    snapshot.subjectDetailRequestCount !== 2 ||
    snapshot.duplicateRequestCount !== 0 ||
    snapshot.unexpectedRequestCount !== 0 ||
    snapshot.authorizationHeaderCount !== 0 ||
    !snapshot.expectedOperationsComplete ||
    snapshot.rawFixturePayloadStored
  ) {
    throw new Error(
      `C07 v4 visual fixture did not complete its exact local operations: ${JSON.stringify(snapshot)}`,
    );
  }

  const viewModel = buildSubjectCohortComparisonViewModel(result, { maxSubjectsPerCohort: 1 });
  if (!viewModel) throw new Error('C07 v4 renderer did not produce a ViewModel.');
  for (const [index, expected] of PROFILE.cohorts.entries()) {
    const cohort = viewModel.cohorts[index];
    const subject = cohort?.subjects[0];
    if (
      !cohort ||
      !subject ||
      cohort.label !== expected.cohortLabel ||
      subject.id !== expected.subjectId ||
      subject.name !== expected.subjectName ||
      subject.displayName !== expected.subjectNameCn ||
      subject.score !== expected.score
    ) {
      throw new Error(`C07 v4 visual cohort ${index} no longer matches its fixed local fixture.`);
    }
  }
  if (viewModel.state !== 'complete' || viewModel.cohorts.length !== 2) {
    throw new Error(
      `C07 v4 visual ViewModel state mismatch: ${JSON.stringify({
        state: viewModel.state,
        cohortCount: viewModel.cohorts.length,
        cohorts: viewModel.cohorts.map((cohort) => ({
          label: cohort.label,
          queryState: cohort.coverage.query.state,
          subjectCount: cohort.subjects.length,
          detailHydrationsSucceeded: cohort.coverage.detailHydrationsSucceeded,
          detailHydrationsFailed: cohort.coverage.detailHydrationsFailed,
        })),
        metricStates: viewModel.metrics.map((metric) => ({ key: metric.key, state: metric.state })),
      })}`,
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
  const secondCohortLabel = PROFILE.cohorts[1]!.cohortLabel;
  return {
    ...complete,
    state: 'partial' as const,
    cohorts: complete.cohorts.map((cohort, index) =>
      index === 1
        ? {
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
          }
        : cohort,
    ),
    metrics: complete.metrics.map((metric) => ({
      ...metric,
      averages: [metric.averages?.[0], undefined],
      partialAverages: [metric.partialAverages?.[0], undefined],
      validCounts: [metric.validCounts?.[0] ?? 0, 0],
      partialCounts: [metric.partialCounts?.[0] ?? 0, 0],
      missingCounts: [metric.missingCounts?.[0] ?? 0, 1],
      conflictCounts: [metric.conflictCounts?.[0] ?? 0, 0],
      notComputableCounts: [metric.notComputableCounts?.[0] ?? 0, 0],
      delta: undefined,
      state: 'partial' as const,
    })),
    coverage: {
      ...complete.coverage,
      totalSubjectsReturned: 1,
      cohortsComplete: 1,
      cohortsPartial: 1,
      detailHydrationsSucceeded: 1,
      detailHydrationsFailed: 1,
      warnings: {
        ...complete.coverage.warnings,
        retained: (complete.coverage.warnings?.retained ?? 0) + 1,
      },
    },
    warnings: [
      {
        code: 'SYNTHETIC_PARTIAL_FIXTURE',
        state: 'partial' as const,
        message: '第二个合成 cohort 的作品详情暂不可用；缺失字段不会按 0 计算。',
        cohort: secondCohortLabel,
      },
    ],
    limitations: [
      '第二个合成 cohort 的作品详情不可用，因此该 cohort 不显示作品行。',
      '详情缺失不等于数值为 0，也不能据此判断该作品不存在或未匹配。',
      '本图使用本地合成数据，不代表 Bangumi 全部条目。',
    ],
  } satisfies SubjectCohortComparisonViewModel;
}

function assertNoExternalImageUrls(viewModel: SubjectCohortComparisonViewModel) {
  if (extractImageUrls(viewModel).length !== 0) {
    throw new Error('C07 v4 visual fixture unexpectedly contains an external image URL.');
  }
}

async function main() {
  const buildBundleSha256 = computeMcpBundleSha256(process.cwd());
  if (readG26McpBundleAttestation(process.cwd()) !== buildBundleSha256) {
    throw new Error('C07 v4 visual QA requires a current exact renderer bundle attestation.');
  }
  await mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: false });
  const complete = await createExactCompleteViewModel();
  const cases = [
    { id: 'complete-two-cohort', viewModel: complete },
    { id: 'partial-two-cohort', viewModel: buildPartialViewModel(complete) },
  ];
  const renderer = new RenderService();
  const images: Array<Record<string, unknown>> = [];

  try {
    for (const visualCase of cases) {
      assertNoExternalImageUrls(visualCase.viewModel);
      for (const designPack of DESIGN_PACKS) {
        for (const theme of THEMES) {
          for (const width of WIDTHS) {
            const rendered = await renderer.renderCard(visualCase.viewModel, {
              designPack,
              theme,
              width,
              deviceScaleFactor: 2,
              cache: false,
            });
            if (
              rendered.width !== width * 2 ||
              rendered.height < 1 ||
              rendered.height > 5000 ||
              rendered.buffer.length > 2 * 1024 * 1024 ||
              rendered.buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
            ) {
              throw new Error(
                `C07 v4 generated an invalid ${visualCase.id}/${designPack}/${theme} PNG at ${width}px.`,
              );
            }
            const filename = `${visualCase.id}-${designPack}-${theme}-${width}.png`;
            await writeFile(path.join(OUTPUT_DIR, filename), rendered.buffer, { flag: 'wx' });
            images.push({
              case: visualCase.id,
              designPack,
              theme,
              file: filename,
              cssWidth: width,
              pixelWidth: rendered.width,
              pixelHeight: rendered.height,
              byteLength: rendered.buffer.length,
              sha256: sha256(rendered.buffer),
              visualReview: { decision: 'PENDING', finding: 'Pending individual inspection.' },
            });
          }
        }
      }
    }
  } finally {
    await renderer.close();
  }

  const generationSourceSha256 = computeC07V4VisualQaGenerationSourceSha256(process.cwd());
  const manifest = {
    schemaVersion: 1,
    profileId: PROFILE_ID,
    artifactDirectory: path.relative(process.cwd(), OUTPUT_DIR).split(path.sep).join('/'),
    cssWidths: WIDTHS,
    designPacks: DESIGN_PACKS,
    themes: THEMES,
    deviceScaleFactor: 2,
    buildBundleSha256,
    generationSourceSha256,
    reviewAcknowledgement: {
      decision: 'PENDING',
      allImagesIndividuallyInspected: false,
      reviewedBy: 'Codex',
      reviewedAt: null,
      summary: 'Pending individual inspection of all 60 images.',
    },
    images,
  };
  await writeFile(
    path.join(OUTPUT_DIR, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    {
      flag: 'wx',
    },
  );
  process.stdout.write(`${JSON.stringify({ outputDir: OUTPUT_DIR, files: images.length })}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(`C07 v4 offline visual generation failed: ${message}\n`);
  process.exitCode = 1;
});
