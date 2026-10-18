import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  RenderService,
  buildSubjectCohortComparisonViewModel,
  extractImageUrls,
} from '@bangumi-agent-kit/renderer';
import { cohortComparisonResult } from '../../tests/render/fixtures/subject-cohort-comparison.fixture';

const OUTPUT_DIR = path.resolve('.artifacts/render/c07-cohort-comparison-v2-visual-qa');
const WIDTHS = [320, 360, 520, 640, 960];

const complete = {
  ...cohortComparisonResult,
  state: 'complete' as const,
  cohorts: cohortComparisonResult.cohorts.map((cohort, index) => ({
    ...cohort,
    label: index === 0 ? '合成样本 D · 2026 春' : 'Synthetic Cohort E · 2026 Summer',
    querySummary:
      index === 0
        ? '离线测试 · TV 动画 · 标题包含中日韩与 Latin text'
        : 'Synthetic offline comparison · 日本語 / 简体中文 / Latin',
    subjects: cohort.subjects.map((subject) => ({
      ...subject,
      id: index === 0 ? 991224 : 991225,
      name:
        index === 0
          ? 'Synthetic Work — A Very Long English Title for Wrapping Review'
          : 'Synthetic Work — 日本語タイトル / 中文混排 Layout Review',
      displayName:
        index === 0
          ? '合成测试作品：跨行排版检查（Bangumi Agent Renderer）'
          : '合成比較作品・長い日本語作品名と Latin typography の確認',
    })),
  })),
  limitations: [
    '本图仅使用本地合成数据，不代表 Bangumi 真实作品或真实用户收藏。',
    'Metrics describe only the returned synthetic sample; they are not recommendations.',
  ],
};

const partial = {
  ...complete,
  state: 'partial' as const,
  cohorts: complete.cohorts.map((cohort, index) =>
    index === 0
      ? cohort
      : {
          ...cohort,
          subjects: [],
          coverage: {
            ...cohort.coverage,
            detailHydrationsAttempted: 1,
            detailHydrationsSucceeded: 0,
            detailHydrationsFailed: 1,
          },
        },
  ),
  metrics: complete.metrics.map((metric) => ({
    ...metric,
    averages: [metric.averages[0], undefined],
    partialAverages: [metric.averages[0], undefined],
    delta: undefined,
    validCounts: [metric.validCounts[0] ?? 1, 0],
    partialCounts: [metric.partialCounts[0] ?? 0, 0],
    missingCounts: [metric.missingCounts[0] ?? 0, 1],
    conflictCounts: [metric.conflictCounts[0] ?? 0, 0],
    notComputableCounts: [metric.notComputableCounts[0] ?? 0, 0],
    state: 'partial' as const,
  })),
  coverage: {
    ...complete.coverage,
    cohortsComplete: 1,
    cohortsPartial: 1,
    totalSubjectsReturned: 1,
    overlap: { subjectIds: [], count: 0 },
  },
  warnings: [
    {
      code: 'SYNTHETIC_PARTIAL_FIXTURE',
      state: 'partial' as const,
      message: '第二组详情不可用；不计算两组差值，也不把缺失值当成 0。',
      cohort: 'Synthetic Cohort E · 2026 Summer',
    },
  ],
};

const cases = [
  { id: 'complete-long-bilingual', result: complete },
  { id: 'partial-missing-cohort', result: partial },
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
        throw new Error('C07 visual QA fixture unexpectedly contains an external image URL.');
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
          throw new Error(`C07 visual QA generated an invalid ${visualCase.id} PNG at ${width}px.`);
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
  process.stderr.write(`C07 offline visual generation failed: ${message}\n`);
  process.exitCode = 1;
});
