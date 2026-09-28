import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SubjectOverviewResult } from '@bangumi-agent-kit/bangumi-core';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  buildSubjectOverviewViewModel,
  LocalArtifactStore,
  RenderService,
} from '@bangumi-agent-kit/renderer';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';

const LIVE_FLAG = '--live';
const SUBJECT_ID = 41529;
const USER_AGENT = process.env.BANGUMI_USER_AGENT ?? 'BangumiAgentKit/subject-overview-caps-probe';
const scenarios = [
  {
    name: 'smoke_caps',
    input: { subjectId: SUBJECT_ID, maxCast: 2, maxStaff: 2, maxRelations: 2 },
  },
  {
    name: 'maximum_supported_caps',
    input: { subjectId: SUBJECT_ID, maxCast: 20, maxStaff: 100, maxRelations: 32 },
  },
] as const;

function summarize(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return { state: 'unexpected_value' };
  const record = value as Record<string, unknown>;
  if (record.ok === false && record.error && typeof record.error === 'object') {
    const error = record.error as Record<string, unknown>;
    return { state: 'error', code: error.code ?? 'UNKNOWN_ERROR' };
  }

  const summary: Record<string, unknown> = {
    state: typeof record.state === 'string' ? record.state : 'value',
    subjectId: record.subjectId,
    limits:
      record.coverage && typeof record.coverage === 'object'
        ? (record.coverage as Record<string, unknown>).limits
        : undefined,
  };
  const coverage = record.coverage as Record<string, unknown> | undefined;
  if (coverage && typeof coverage === 'object') {
    summary.coverage = Object.fromEntries(
      [
        'sourceRequestsAttempted',
        'sourceRequestsSucceeded',
        'sectionsComplete',
        'sectionsPartial',
        'sectionsUnavailable',
        'sectionsNotComputable',
        'truncatedSections',
      ]
        .filter((key) => coverage[key] !== undefined)
        .map((key) => [key, coverage[key]]),
    );
  }

  const sections: Record<string, unknown> = {};
  for (const name of ['stats', 'cast', 'staff', 'relations']) {
    const section = record[name] as Record<string, unknown> | undefined;
    if (!section || typeof section !== 'object') continue;
    const sectionCoverage = section.coverage as Record<string, unknown> | undefined;
    const info: Record<string, unknown> = { state: section.state };
    if (sectionCoverage && typeof sectionCoverage === 'object') {
      for (const key of ['observed', 'returned', 'truncated', 'schemaDriftRows']) {
        if (sectionCoverage[key] !== undefined) info[key] = sectionCoverage[key];
      }
    }
    if (Array.isArray(section.items)) info.itemCount = section.items.length;
    sections[name] = info;
  }
  summary.sections = sections;

  const warnings = Array.isArray(record.warnings) ? record.warnings : [];
  summary.warnings = warnings.flatMap((warning) => {
    if (!warning || typeof warning !== 'object') return [];
    const item = warning as Record<string, unknown>;
    return typeof item.code === 'string'
      ? [{ code: item.code, section: item.section, state: item.state }]
      : [];
  });
  return summary;
}

async function main(): Promise<void> {
  if (!process.argv.includes(LIVE_FLAG)) {
    throw new Error(`Refusing live requests without ${LIVE_FLAG}.`);
  }

  let requestCount = 0;
  const publicHttpClient = new HttpClient({
    userAgent: USER_AGENT,
    fetchFn: async (input, init) => {
      requestCount += 1;
      return await fetch(input, init);
    },
  });
  const storage = new MemoryStorage();
  const artifactDir = await mkdtemp(join(tmpdir(), 'bangumi-subject-overview-artifacts-'));
  const artifactStore = new LocalArtifactStore({ artifactDir });
  const renderService = new RenderService();
  const dependencies = createRuntimeDependenciesWithStorage(storage, {
    secretKey: 'public-subject-overview-probe-key-2026-09-28',
    publicHttpClient,
    artifactStore,
    renderService,
  });
  const registry = new ToolRegistry(dependencies);
  const observedAt = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];
  let maximumCapsResult: SubjectOverviewResult | undefined;
  let previewPath: string | undefined;
  let rendererWarningCodes: string[] = [];
  let renderSummary: Record<string, unknown> = { state: 'skipped', reason: 'overview_unavailable' };

  try {
    for (const [index, scenario] of scenarios.entries()) {
      const requestsBefore = requestCount;
      let result: unknown;
      try {
        result = await registry.executeTool('bangumi.get_subject_overview', scenario.input, {
          principalId: 'public-overview-probe',
          botInstanceId: 'public-overview-probe',
          conversationId: `public-overview-probe:${scenario.name}`,
        });
        if (scenario.name === 'maximum_supported_caps' && result && typeof result === 'object') {
          maximumCapsResult = result as SubjectOverviewResult;
        }
      } catch (error) {
        const detail = error as { code?: unknown };
        result = { ok: false, error: { code: detail.code ?? 'UNKNOWN_ERROR' } };
      }
      results.push({
        scenario: scenario.name,
        httpRequests: requestCount - requestsBefore,
        result: summarize(result),
      });
      if (index < scenarios.length - 1) await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    if (maximumCapsResult) {
      const originalRenderCard = renderService.renderCard.bind(renderService);
      renderService.renderCard = async (...args) => {
        const rendered = await originalRenderCard(...args);
        rendererWarningCodes = rendered.warnings.map((warning) => warning.code);
        return rendered;
      };
      try {
        const rendered = (await registry.executeTool(
          'bangumi.render_subject_overview',
          scenarios[1].input,
          {
            principalId: 'public-overview-probe',
            botInstanceId: 'public-overview-probe',
            conversationId: 'public-overview-probe:render_maximum_caps',
          },
        )) as {
          artifact?: { id?: unknown; mimeType?: unknown; width?: unknown; height?: unknown };
        };
        const id = rendered.artifact?.id;
        if (typeof id !== 'string') {
          renderSummary = { state: 'error', code: 'ARTIFACT_REFERENCE_MISSING' };
        } else {
          previewPath = (await artifactStore.resolveFilePath(id)) ?? undefined;
          const metadata = await artifactStore.getArtifact(id);
          const fileBytes = previewPath ? (await stat(previewPath)).size : undefined;
          const maxStaff = scenarios[1].input.maxStaff;
          const viewModel = buildSubjectOverviewViewModel(maximumCapsResult, {
            maxStaffGroups: maxStaff,
            maxStaffMembersPerGroup: maxStaff,
          });
          renderSummary = {
            state: previewPath ? 'rendered' : 'artifact_file_missing',
            mimeType: rendered.artifact?.mimeType,
            width: rendered.artifact?.width,
            height: rendered.artifact?.height,
            bytes: fileBytes,
            rendererWarningCodes,
            staffGroupsAvailable: maximumCapsResult.staff.groups.length,
            staffGroupsRendered: viewModel.staff.groups.length,
            staffRowsAvailable: maximumCapsResult.staff.items.length,
            staffNamesVisible: viewModel.staff.groups.reduce(
              (count, group) => count + group.members.length,
              0,
            ),
            staffRowsRendered: viewModel.staff.groups.reduce(
              (count, group) => count + group.members.length,
              0,
            ),
            staffRowsOmittedFromImage: viewModel.staff.hiddenCount ?? 0,
            artifactMetadataFound: Boolean(metadata),
          };
        }
      } catch (error) {
        const detail = error as { code?: unknown; name?: unknown };
        renderSummary = {
          state: 'error',
          code: typeof detail.code === 'string' ? detail.code : (detail.name ?? 'UNKNOWN_ERROR'),
        };
      }
    }
  } finally {
    await registry.close();
  }

  const catalogSha256 = createHash('sha256')
    .update(await readFile(join(process.cwd(), 'docs', 'tool-catalog.json')))
    .digest('hex');
  const probeScriptSha256 = createHash('sha256')
    .update(await readFile(join(process.cwd(), 'scripts', 'probe-subject-overview-caps.ts')))
    .digest('hex');
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const report = {
    schemaVersion: 1,
    evidenceKind: 'bangumi_subject_overview_live_caps_probe',
    observedAt,
    sourceRevision,
    catalogSha256,
    probeScriptSha256,
    mode: 'read_only_public_api_smoke',
    subjectId: SUBJECT_ID,
    probeCount: scenarios.length + 1,
    apiScenarioCount: scenarios.length,
    httpRequests: requestCount,
    limits: [
      'two bounded API cap scenarios plus one render tool invocation',
      'sequential requests',
      'no OAuth',
      'no writes',
      'warning codes only',
      'httpRequests counts Bangumi HttpClient calls, not renderer asset resolution',
    ],
    results,
    render: renderSummary,
  };
  const timestamp = observedAt.replace(/[-:]/gu, '').replace(/\.\d{3}(?=Z$)/u, '');
  const output = join(
    process.cwd(),
    'docs',
    'live-probes',
    `subject-overview-caps-${timestamp}.json`,
  );
  await mkdir(join(process.cwd(), 'docs', 'live-probes'), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const stdoutReport = previewPath ? { ...report, output, previewPath } : { ...report, output };
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(`${JSON.stringify(stdoutReport, null, 2)}\n`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  process.exit(0);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
