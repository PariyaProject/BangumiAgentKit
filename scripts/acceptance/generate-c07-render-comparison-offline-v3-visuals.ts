import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  RenderService,
  buildSubjectCohortComparisonViewModel,
  extractImageUrls,
} from '@bangumi-agent-kit/renderer';
import { cohortComparisonResult } from '../../tests/render/fixtures/subject-cohort-comparison.fixture';

const OUTPUT_DIR = path.resolve('.artifacts/render/c07-cohort-comparison-v3-visual-qa');
const WIDTHS = [320, 360, 520, 640, 960];
const SYNTHETIC_KEYWORD = 'run95 c07 synthetic cohort e offline matrix 20261018';

const baseCohort = cohortComparisonResult.cohorts[0];
if (!baseCohort) throw new Error('C07 v3 visual fixture is missing its base cohort.');
const oneResultQueryCoverage = {
  ...baseCohort.coverage.query.coverage,
  requested: 1,
  scanned: 1,
  matched: 1,
  returned: 1,
};
const oneResultPlan = {
  ...baseCohort.coverage.query.plan,
  requestedTopN: 1,
  budget: {
    ...baseCohort.coverage.query.plan.budget,
    maxReturnedItems: 1,
  },
};
const syntheticCohort = {
  ...baseCohort,
  label: '合成样本 E · 单组结果',
  query: { keyword: SYNTHETIC_KEYWORD, media: 'anime' as const },
  querySummary: '离线合成输入 · cohort E · 仅一条作品',
  subjects: baseCohort.subjects.map((subject) => ({
    ...subject,
    id: 991226,
    name: 'Synthetic Work — Long English Title for Narrow-Width Wrapping Review',
    displayName: '合成作品 E：日本語タイトル / 中文混排与 Latin wrapping 检查',
  })),
  coverage: {
    ...baseCohort.coverage,
    query: {
      ...baseCohort.coverage.query,
      coverage: oneResultQueryCoverage,
      plan: oneResultPlan,
    },
    detailHydrationsAttempted: 1,
    detailHydrationsSucceeded: 1,
    detailHydrationsFailed: 0,
  },
};

const complete = {
  ...cohortComparisonResult,
  state: 'complete' as const,
  cohorts: [syntheticCohort],
  metrics: cohortComparisonResult.metrics.map((metric) => {
    return {
      ...metric,
      delta: undefined,
      averages: [metric.averages[0]],
      validCounts: [metric.validCounts[0]],
      partialCounts: [metric.partialCounts[0]],
      missingCounts: [metric.missingCounts[0]],
      conflictCounts: [metric.conflictCounts[0]],
      notComputableCounts: [metric.notComputableCounts[0]],
    };
  }),
  coverage: {
    ...cohortComparisonResult.coverage,
    maxSubjectsPerCohort: 1,
    totalSubjectsReturned: 1,
    cohortsComplete: 1,
    cohortsPartial: 0,
    detailHydrationsAttempted: 1,
    detailHydrationsSucceeded: 1,
    detailHydrationsFailed: 0,
    overlap: { subjectIds: [], count: 0 },
  },
  source: {
    official: {
      ...cohortComparisonResult.source.official,
      retrievedAt: '2026-10-18T14:00:00.000Z',
    },
    derived: {
      ...cohortComparisonResult.source.derived,
      retrievedAt: '2026-10-18T14:00:00.000Z',
    },
  },
  warnings: [],
  limitations: [
    '本图只展示一条合成作品样本，不能代表 Bangumi 全部条目。',
    '查询和展示字段均来自本地合成数据。',
  ],
};

const partial = {
  ...complete,
  state: 'partial' as const,
  cohorts: [
    {
      ...syntheticCohort,
      subjects: [],
      coverage: {
        ...syntheticCohort.coverage,
        detailHydrationsAttempted: 1,
        detailHydrationsSucceeded: 0,
        detailHydrationsFailed: 1,
        metrics: {
          score: {
            valid: 0,
            partial: 0,
            missing: 1,
            conflicts: 0,
            notComputable: 0,
            state: 'partial' as const,
          },
          heat: {
            valid: 0,
            partial: 0,
            missing: 1,
            conflicts: 0,
            notComputable: 0,
            state: 'partial' as const,
          },
          episodesReported: {
            valid: 0,
            partial: 0,
            missing: 1,
            conflicts: 0,
            notComputable: 0,
            state: 'partial' as const,
          },
          ratingStandardDeviation: {
            valid: 0,
            partial: 0,
            missing: 1,
            conflicts: 0,
            notComputable: 0,
            state: 'partial' as const,
          },
        },
      },
    },
  ],
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
  },
  warnings: [
    {
      code: 'SYNTHETIC_PARTIAL_FIXTURE',
      state: 'partial' as const,
      message: '条目详情暂不可用；缺失字段不会按 0 计算。',
      cohort: '合成样本 E · 单组结果',
    },
  ],
};

const cases = [
  { id: 'complete-single-cohort-e', result: complete },
  { id: 'partial-single-cohort-e', result: partial },
];

async function main() {
  await mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: false });
  const renderer = new RenderService();
  const manifest: Array<Record<string, string | number>> = [];

  try {
    for (const visualCase of cases) {
      const viewModel = buildSubjectCohortComparisonViewModel(visualCase.result, {
        maxSubjectsPerCohort: 1,
      });
      if (extractImageUrls(viewModel).length !== 0) {
        throw new Error('C07 v3 visual fixture unexpectedly contains an external image URL.');
      }

      for (const width of WIDTHS) {
        const rendered = await renderer.renderCard(viewModel, {
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
          sha256: createHash('sha256').update(rendered.buffer).digest('hex'),
        });
      }
    }
  } finally {
    await renderer.close();
  }

  await writeFile(
    path.join(OUTPUT_DIR, 'manifest.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), files: manifest }, null, 2)}\n`,
    { flag: 'wx' },
  );
  process.stdout.write(`${JSON.stringify({ outputDir: OUTPUT_DIR, files: manifest.length })}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(`C07 v3 offline visual generation failed: ${message}\n`);
  process.exitCode = 1;
});
