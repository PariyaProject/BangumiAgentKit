import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  G02_QUERY_ARGUMENTS,
  type G02AnswerCheckResult,
} from '../../scripts/acceptance/g02-discovery-answer-check.mjs';
import { writeG02AgentMcpReports } from '../../scripts/acceptance/write-g02-agent-mcp-report.mjs';
import { computeMcpBundleSha256 } from '../../scripts/lib/g26-mcp-bundle.mjs';

const canonicalJson = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonicalJson).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map(
            (key) =>
              `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
          )
          .join(',')}}`
      : JSON.stringify(value);
const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

function git(root: string, ...args: string[]) {
  execFileSync('git', args, { cwd: root, stdio: 'ignore' });
}

function makeProbe({
  root,
  sourceRevision,
  bundleSha256,
  toolName,
}: {
  root: string;
  sourceRevision: string;
  bundleSha256: string;
  toolName: 'bangumi.query_subjects' | 'bangumi.render_query_subjects';
}) {
  const catalogBytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((item: { name: string }) => item.name === toolName);
  const expectedArguments = G02_QUERY_ARGUMENTS;
  const argumentHash = sha256(canonicalJson(expectedArguments));
  const isRenderer = toolName === 'bangumi.render_query_subjects';
  const sourceResult = {
    state: 'ok',
    items: [
      {
        id: 390001,
        name: 'Work One',
        nameCn: '作品一',
        date: '2024-01-04',
        media: 'anime',
        collectionTotal: 41801,
        tags: ['异世界'],
      },
      {
        id: 390002,
        name: 'Work Two',
        nameCn: '作品二',
        date: '2024-04-10',
        media: 'anime',
        collectionTotal: 32534,
        tags: ['异世界'],
      },
    ],
    warnings: [{ code: 'EXPERIMENTAL_SOURCE' }],
    coverage: {
      state: 'unknown',
      requested: 10,
      scanned: 20,
      matched: 20,
      returned: 2,
      totalKind: 'estimated',
    },
  };
  const answer = isRenderer
    ? '图片卡已生成。\n范围：2024-01-01至2025-01-01（左闭右开），动画异世界结果覆盖未知、总量为估算，来源为实验性接口；heat 是当前收藏人数，不代表全站完整榜单、不代表讨论热度或历史趋势。'
    : '390001｜作品一｜41801\n390002｜作品二｜32534\n范围：2024-01-01至2025-01-01（左闭右开），动画，精确概念“异世界”；本次搜索扫描到20个候选，符合条件20个，返回2条。官方 v0 搜索为实验性接口，覆盖未知且总量为估算；本列表不代表全站完整榜单。heat 是当前收藏人数，不代表讨论热度或历史趋势。';
  const result = isRenderer
    ? {
        toolName,
        resultState: 'artifact_returned',
        resultByteLength: 4096,
        resultSha256: 'd'.repeat(64),
        sourceOperations: [],
        artifact: {
          returned: true,
          persisted: false,
          mimeType: 'image/png',
          width: 720,
          height: 1200,
          byteLength: 34000,
          sha256: 'a'.repeat(64),
          pngSignatureValid: true,
        },
      }
    : {
        toolName,
        resultState: 'ok',
        resultByteLength: 2048,
        resultSha256: 'e'.repeat(64),
        sourceOperations: [
          {
            operation: 'POST /v0/search/subjects',
            attempted: 1,
            succeeded: 1,
            failed: 0,
          },
        ],
        artifact: { returned: false, persisted: false },
      };
  const serverSummary = {
    serverProfile: 'one-tool-anonymous-public-v1',
    sourceRevision,
    bundleSha256,
    toolName,
    serverToolNames: [toolName],
    serverToolCount: 1,
    expectedArgumentsSha256: argumentHash,
    argumentMatch: true,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
    privacy: {
      authProfile: 'anonymous',
      oauthAttempted: false,
      accountDataRead: false,
      writesAttempted: false,
      qqPipelineTested: false,
      timClientTested: false,
      promptStored: false,
      answerStored: false,
      rawResultStored: false,
      artifactImageBytesStored: false,
      credentialsStored: false,
    },
    result,
  };
  const toolOutput = {
    content: [{ type: 'text', text: JSON.stringify(sourceResult) }],
    structuredContent: sourceResult,
  };
  return {
    toolName,
    codexCliVersion: '0.162.0-alpha.2',
    processExitCode: 0,
    eventStreamParsed: true,
    serverSummary,
    eventsSummary: {
      eventStreamComplete: true,
      codexMcpToolEventCount: 1,
      mcpServerNames: ['bgk_g02_one_tool'],
      nonMcpToolEventCount: 0,
      shellToolCallCount: 0,
      completedMcpCalls: [{ tool: toolName, arguments: expectedArguments, result: toolOutput }],
      toolCalls: [{ name: toolName, state: 'DONE' }],
      answer,
    },
  };
}

describe('G02 sanitized Agent/MCP report writer', () => {
  it('declares the complete query counter shape', () => {
    const counters: NonNullable<G02AnswerCheckResult['resultCounters']> = {
      resultState: 'ok',
      coverageState: 'unknown',
      totalKind: 'estimated',
      requested: 10,
      scanned: 20,
      matched: 20,
      returned: 2,
      warningCodes: ['EXPERIMENTAL_SOURCE'],
      sourceRowsValidated: 2,
      answerRowsMatched: 2,
    };
    expect(counters.requested).toBe(10);
  });

  it('writes exact-candidate reports with only counters, hashes, and artifact metadata', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'g02-report-writer-'));
    try {
      mkdirSync(path.join(root, 'packages', 'fixture', 'dist'), { recursive: true });
      mkdirSync(path.join(root, 'apps', 'mcp', 'dist'), { recursive: true });
      mkdirSync(path.join(root, 'docs', 'product'), { recursive: true });
      mkdirSync(path.join(root, 'docs', 'live-probes'), { recursive: true });
      writeFileSync(
        path.join(root, 'packages/fixture/dist/index.js'),
        'export const fixture = true;\n',
      );
      writeFileSync(path.join(root, 'apps/mcp/dist/index.js'), 'export const server = true;\n');
      const catalog = [
        {
          name: 'bangumi.query_subjects',
          description: 'Bounded anonymous discovery.',
          auth: 'none',
          risk: 'read',
          inputSchema: { type: 'object', properties: { media: { type: 'string' } } },
        },
        {
          name: 'bangumi.render_query_subjects',
          description: 'Render bounded anonymous discovery.',
          auth: 'none',
          risk: 'read',
          inputSchema: { type: 'object', properties: { media: { type: 'string' } } },
        },
      ];
      writeFileSync(path.join(root, 'docs/tool-catalog.json'), `${JSON.stringify(catalog)}\n`);
      const bundleSha256 = computeMcpBundleSha256(root);
      writeFileSync(
        path.join(root, 'docs/product/g26-mcp-bundle-attestation.json'),
        `${JSON.stringify({
          schemaVersion: 1,
          kind: 'g26-mcp-runtime-bundle-attestation-v1',
          bundleSha256,
        })}\n`,
      );
      git(root, 'init', '-q');
      git(root, 'config', 'user.name', 'G02 Report Fixture');
      git(root, 'config', 'user.email', 'g02-report-fixture@example.invalid');
      git(root, 'add', '.');
      git(root, 'commit', '-qm', 'create exact G02 report candidate fixture');
      const candidateRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim();
      const finalBundleSha256 = computeMcpBundleSha256(root);
      expect(finalBundleSha256).toBe(bundleSha256);

      const claimPath = path.join(root, '.git/pariya-agent-state/g02-run95-one-shot-claim.json');
      mkdirSync(path.dirname(claimPath), { recursive: true, mode: 0o700 });
      writeFileSync(
        claimPath,
        `${JSON.stringify({
          schemaVersion: 1,
          runNumber: 95,
          frontierId: 'G02',
          epochId: 'run95-g02-current-agent-mcp',
          toolNames: ['bangumi.query_subjects', 'bangumi.render_query_subjects'],
          expectedArgumentsSha256: sha256(
            canonicalJson({
              'bangumi.query_subjects': G02_QUERY_ARGUMENTS,
              'bangumi.render_query_subjects': G02_QUERY_ARGUMENTS,
            }),
          ),
          sourceRevision: candidateRevision,
          bundleSha256: finalBundleSha256,
          baseSha: 'b'.repeat(40),
          prNumber: 117,
          model: 'gpt-6-luna',
          reasoningEffort: 'max',
          state: 'CLAIMED',
        })}\n`,
        { mode: 0o600 },
      );

      const reports = writeG02AgentMcpReports(
        {
          sourceRevision: candidateRevision,
          bundleSha256: finalBundleSha256,
          prNumber: 117,
          baseSha: 'b'.repeat(40),
          observedAt: '2026-10-09T00:00:00.000Z',
          codexCliVersion: '0.162.0-alpha.2',
          probes: [
            makeProbe({
              root,
              sourceRevision: candidateRevision,
              bundleSha256: finalBundleSha256,
              toolName: 'bangumi.query_subjects',
            }),
            makeProbe({
              root,
              sourceRevision: candidateRevision,
              bundleSha256: finalBundleSha256,
              toolName: 'bangumi.render_query_subjects',
            }),
          ],
        },
        root,
      );
      if (!reports.passed) throw new Error('G02 fixture reports should pass validation.');
      expect(reports.passed).toBe(true);
      expect(reports.reports.map((report) => report.toolName)).toEqual([
        'bangumi.query_subjects',
        'bangumi.render_query_subjects',
      ]);
      expect(reports.reports[0]?.resultCounters).toMatchObject({
        requested: 10,
        scanned: 20,
        matched: 20,
        returned: 2,
      });
      for (const report of reports.reports) {
        const contents = readFileSync(path.join(root, report.path), 'utf8');
        expect(contents).not.toContain('作品一');
        expect(contents).not.toContain('Work One');
        expect(contents).not.toContain('图片卡已生成');
        expect(contents).not.toContain('structuredContent');
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
