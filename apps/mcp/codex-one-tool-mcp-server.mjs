#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  authorizeToolCall,
  authorizeToolCallSequence,
  canonicalJson,
  claimProfileSequenceCall,
  claimSingleToolCall,
  createProfileCallQueue,
  filterAllowedTools,
  publicReadOnlyToolAnnotations,
  summarizeToolResult,
} from '../../scripts/lib/codex-one-tool-evidence.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import {
  computeMcpBundleSha256,
  gitRepositoryText,
  readG26McpBundleAttestation,
} from '../../scripts/lib/g26-mcp-bundle.mjs';
import {
  C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE,
  assertC07CohortRenderOfflineProfile,
  createC07CohortRenderOfflineFixtureFetch,
} from '../../scripts/lib/c07-cohort-render-offline-fixture.mjs';
import {
  A01_RENDER_COHORT_AGGREGATION_PROFILE_ID,
  A01_RENDER_COHORT_AGGREGATION_NETWORK_MODE,
  assertA01RenderCohortAggregationOfflineProfile,
  createA01RenderCohortAggregationOfflineFetch,
} from '../../scripts/lib/a01-render-cohort-aggregation-offline-fixture.mjs';
import {
  createP06RenderPersonProfileAssetGuard,
  createP06RenderPersonProfileOfflineFetch,
  P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
} from '../../scripts/lib/p06-render-person-profile-offline-fixture.mjs';
import {
  assertP02PersonProfileOfflineProfile,
  createP02PersonProfileOfflineFetch,
  P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
} from '../../scripts/lib/p02-person-profile-offline-fixture.mjs';
import {
  assertR04SeriesWatchOrderOfflineProfile,
  createR04SeriesWatchOrderOfflineFetch,
  R04_SERIES_WATCH_ORDER_OFFLINE_NETWORK_MODE,
} from '../../scripts/lib/r04-series-watch-order-offline-fixture.mjs';
import {
  assertR04RenderSeriesWatchOrderOfflineProfile,
  createR04RenderSeriesWatchOrderAssetFence,
  createR04RenderSeriesWatchOrderOfflineFetch,
  R04_RENDER_SERIES_WATCH_ORDER_NETWORK_MODE,
  R04_RENDER_SERIES_WATCH_ORDER_PROFILE_ID,
} from '../../scripts/lib/r04-render-series-watch-order-offline-fixture.mjs';
import {
  assertR01RelationsOfflineFixture,
  createR01RelationsOfflineFetch,
} from '../../scripts/lib/r01-relations-offline-fixture.mjs';
import {
  R01_RELATIONS_OFFLINE_NETWORK_MODE,
  R01_RELATIONS_OFFLINE_PROFILE_ID,
} from '../../scripts/lib/r01-relations-offline-profile.mjs';
import {
  assertC04CohortComparisonPublicProfile,
  createC04CohortComparisonPublicFetch,
  C04_COHORT_COMPARISON_PROFILE_ID,
  C04_COHORT_COMPARISON_NETWORK_MODE,
} from '../../scripts/lib/c04-cohort-comparison-public-profile.mjs';
import {
  assertR02PositiveDirectRelationsProfile,
  createR02PositiveDirectRelationsPublicFetch,
  R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE,
  R02_POSITIVE_DIRECT_RELATIONS_PROFILE_ID,
} from '../../scripts/lib/r02-positive-direct-relations-profile.mjs';
import { inspectC07PngArtifact } from '../../scripts/lib/c07-png-artifact-validation.mjs';
import { buildG06PrivacySummary } from '../../scripts/lib/g06-privacy-summary.mjs';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { RenderService } from '../../packages/renderer/dist/index.js';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { StdioMcpExecutionIdentityProvider } from './dist/identity.js';
import { toMcpTool } from './dist/catalog.js';
import { presentMcpToolResult } from './dist/result-presenter.js';

const PRODUCT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const P07_PERSON_SEASON_PROFILE_ID = 'p07-person-season-distribution-agent-mcp-v1';

class MemoryArtifactStore {
  constructor() {
    this.artifacts = new Map();
  }

  async saveArtifact(buffer, mimeType = 'image/png', options = {}) {
    const id = `art_${randomBytes(16).toString('hex')}`;
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
    const copy = Buffer.from(buffer);
    this.artifacts.set(id, {
      id,
      mimeType,
      width: options.width,
      height: options.height,
      createdAt,
      expiresAt,
      buffer: copy,
    });
    return {
      id,
      mimeType,
      ...(options.width === undefined ? {} : { width: options.width }),
      ...(options.height === undefined ? {} : { height: options.height }),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getArtifact(id) {
    const item = this.artifacts.get(id);
    if (!item) return null;
    return {
      id: item.id,
      mimeType: item.mimeType,
      width: item.width,
      height: item.height,
      filePath: `memory://${item.id}`,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
    };
  }

  async resolveFilePath(_id) {
    return null;
  }

  async cleanExpiredArtifacts() {
    return 0;
  }

  summarize(id, { verifyPng = false } = {}) {
    const item = this.artifacts.get(id);
    if (!item) return { returned: false, persisted: false };
    const summary = {
      returned: true,
      persisted: false,
      mimeType: item.mimeType,
      width: item.width,
      height: item.height,
      byteLength: item.buffer.length,
      sha256: createHash('sha256').update(item.buffer).digest('hex'),
      pngSignatureValid:
        item.mimeType === 'image/png' &&
        item.buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE),
    };
    if (verifyPng) {
      Object.assign(summary, inspectC07PngArtifact(item.buffer, item.width, item.height));
    }
    return summary;
  }
}

function writeSanitizedSummary(summaryPath, summary, serverInstanceId) {
  if (!summaryPath) return;
  const absolute = path.resolve(summaryPath);
  const temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!absolute.startsWith(temporaryRoot)) {
    throw new Error('Summary output must stay inside the operating-system temporary directory.');
  }
  const snapshot = { ...summary, serverInstanceId };
  fs.appendFileSync(`${absolute}.events.jsonl`, `${JSON.stringify(snapshot)}\n`, { mode: 0o600 });
  const temporary = `${absolute}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, absolute);
}

export function parseArguments(argv) {
  // The pure parser validates mandatory '--candidate-sha' and bundle digests.
  return parseCodexOneToolMcpArguments(argv);
}

function runtimeCandidateMatches(sourceRevision, bundleSha256) {
  try {
    const currentRevision = gitRepositoryText(PRODUCT_ROOT, ['rev-parse', 'HEAD']);
    const status = gitRepositoryText(PRODUCT_ROOT, ['status', '--porcelain']);
    return (
      currentRevision === sourceRevision &&
      status === '' &&
      computeMcpBundleSha256(PRODUCT_ROOT) === bundleSha256 &&
      readG26McpBundleAttestation(PRODUCT_ROOT) === bundleSha256
    );
  } catch {
    return false;
  }
}

async function main(argv = process.argv.slice(2)) {
  const config = parseArguments(argv);
  if (config.networkMode === C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE) {
    assertC07CohortRenderOfflineProfile({
      networkMode: config.networkMode,
      toolName: config.toolName,
      expectedArguments: config.expectedArguments,
    });
  }
  if (config.networkMode === A01_RENDER_COHORT_AGGREGATION_NETWORK_MODE) {
    assertA01RenderCohortAggregationOfflineProfile(config.profile);
  }
  if (config.networkMode === P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE) {
    assertP02PersonProfileOfflineProfile(config.profile);
  }
  if (config.networkMode === R04_SERIES_WATCH_ORDER_OFFLINE_NETWORK_MODE) {
    assertR04SeriesWatchOrderOfflineProfile(config.profile);
  }
  if (config.networkMode === R04_RENDER_SERIES_WATCH_ORDER_NETWORK_MODE) {
    assertR04RenderSeriesWatchOrderOfflineProfile(config.profile);
  }
  if (config.networkMode === R01_RELATIONS_OFFLINE_NETWORK_MODE) {
    assertR01RelationsOfflineFixture(config.profile);
  }
  if (config.networkMode === R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE) {
    assertR02PositiveDirectRelationsProfile(config.profile);
  }
  const serverInstanceId = randomUUID();
  for (const key of Object.keys(process.env)) {
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY)/iu.test(key)) {
      delete process.env[key];
    }
  }

  const catalogBytes = fs.readFileSync(path.join(PRODUCT_ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTools = config.toolNames.map((toolName) =>
    catalog.find((item) => item?.name === toolName),
  );
  if (
    catalogTools.some((tool) => !tool || tool.auth !== 'none' || tool.risk !== 'read') ||
    new Set(config.toolNames).size !== config.toolNames.length
  ) {
    throw new Error(
      'Only exact catalogued auth=none, risk=read tools may be exposed by this probe server.',
    );
  }
  const sourceRevision = gitRepositoryText(PRODUCT_ROOT, ['rev-parse', 'HEAD']);
  const bundleSha256 = computeMcpBundleSha256(PRODUCT_ROOT);
  if (
    sourceRevision !== config.candidateSha ||
    bundleSha256 !== config.bundleSha256 ||
    readG26McpBundleAttestation(PRODUCT_ROOT) !== bundleSha256 ||
    !runtimeCandidateMatches(sourceRevision, bundleSha256)
  ) {
    throw new Error('G26 MCP server is not running the immutable exact Candidate bundle.');
  }
  const storage = new MemoryStorage();
  const artifactStore = new MemoryArtifactStore();
  const identityProvider = new StdioMcpExecutionIdentityProvider(storage);
  const c04PublicFetch =
    config.networkMode === C04_COHORT_COMPARISON_NETWORK_MODE
      ? createC04CohortComparisonPublicFetch()
      : null;
  const r02PublicFetch =
    config.networkMode === R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE
      ? createR02PositiveDirectRelationsPublicFetch()
      : null;
  const offlineFixture =
    config.networkMode === A01_RENDER_COHORT_AGGREGATION_NETWORK_MODE
      ? createA01RenderCohortAggregationOfflineFetch()
      : config.networkMode === C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE
        ? createC07CohortRenderOfflineFixtureFetch()
        : config.networkMode === P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE
          ? createP06RenderPersonProfileOfflineFetch()
          : config.networkMode === P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE
            ? createP02PersonProfileOfflineFetch()
            : config.networkMode === R04_SERIES_WATCH_ORDER_OFFLINE_NETWORK_MODE
              ? createR04SeriesWatchOrderOfflineFetch()
              : config.networkMode === R04_RENDER_SERIES_WATCH_ORDER_NETWORK_MODE
                ? createR04RenderSeriesWatchOrderOfflineFetch()
                : config.networkMode === R01_RELATIONS_OFFLINE_NETWORK_MODE
                  ? createR01RelationsOfflineFetch()
                  : null;
  const r04RenderAssetFence =
    config.networkMode === R04_RENDER_SERIES_WATCH_ORDER_NETWORK_MODE
      ? createR04RenderSeriesWatchOrderAssetFence()
      : null;
  const p06AssetGuard =
    config.networkMode === P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE
      ? createP06RenderPersonProfileAssetGuard()
      : null;
  const renderService = p06AssetGuard
    ? new RenderService(undefined, undefined, p06AssetGuard.assetResolver)
    : r04RenderAssetFence
      ? new RenderService(undefined, undefined, r04RenderAssetFence.assetResolver)
      : undefined;
  const publicHttpClient = new HttpClient({
    baseUrl: 'https://api.bgm.tv',
    timeoutMs: 10000,
    ...(offlineFixture
      ? { fetchFn: offlineFixture.fetchFn }
      : c04PublicFetch
        ? { fetchFn: c04PublicFetch.fetchFn }
        : r02PublicFetch
          ? { fetchFn: r02PublicFetch.fetchFn }
          : {}),
  });
  const dependencies = createRuntimeDependenciesWithStorage(storage, {
    publicHttpClient,
    artifactStore,
    ...(renderService ? { renderService } : {}),
  });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });
  if (
    config.profile?.id === C04_COHORT_COMPARISON_PROFILE_ID &&
    !assertC04CohortComparisonPublicProfile(config.profile)
  ) {
    throw new Error(
      'The registered C04 multi-tool profile does not match its fixed public contract.',
    );
  }
  const tools =
    config.toolNames.length === 1
      ? filterAllowedTools(registry.getTools(), config.toolName)
      : filterAllowedTools(registry.getTools(), config.toolNames);
  const mcpTools = tools.map((tool) => ({
    ...toMcpTool(tool),
    annotations: publicReadOnlyToolAnnotations(tool),
  }));
  const toolDescriptors = mcpTools.map((mcpTool) => ({
    toolName: mcpTool.name,
    descriptionSha256: createHash('sha256').update(mcpTool.description, 'utf8').digest('hex'),
    inputSchemaSha256: createHash('sha256')
      .update(canonicalJson(mcpTool.inputSchema), 'utf8')
      .digest('hex'),
  }));
  const primaryToolDescriptor = toolDescriptors[0];
  const server = new Server(
    { name: 'bangumi-codex-one-tool-qa', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  let allowedCalls = 0;
  let deniedCalls = 0;
  let profileSequenceFailed = false;
  const enqueueProfileCall = config.profile ? createProfileCallQueue() : null;
  let summary = {
    schemaVersion: 1,
    ...(config.profile
      ? {
          serverProfile: config.networkMode
            ? config.networkMode === C04_COHORT_COMPARISON_NETWORK_MODE ||
              config.networkMode === R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE
              ? 'closed-profile-sequence-anonymous-public-v1'
              : 'closed-profile-sequence-anonymous-offline-v1'
            : 'closed-profile-sequence-anonymous-public-v1',
        }
      : { serverProfile: 'one-tool-anonymous-public-v1' }),
    ...(config.profile
      ? {
          profileId: config.profile.id,
          argumentProfile: config.profile.argumentProfile,
          expectedCallCount: config.expectedArgumentSequence.length,
          ...(config.profileCallIndex === undefined
            ? {}
            : { profileCallIndex: config.profileCallIndex }),
          ...(config.networkMode ? { networkMode: config.networkMode } : {}),
        }
      : {}),
    sourceRevision,
    bundleSha256,
    catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
    toolName: config.toolName,
    toolDescriptionSha256: primaryToolDescriptor.descriptionSha256,
    inputSchemaSha256: primaryToolDescriptor.inputSchemaSha256,
    serverToolNames: config.toolNames,
    serverToolCount: mcpTools.length,
    ...(toolDescriptors.length > 1 || config.profile?.id === C04_COHORT_COMPARISON_PROFILE_ID
      ? { toolNames: config.toolNames, toolDescriptors }
      : {}),
    expectedArgumentsSha256: config.expectedArgumentsSha256,
    serverResultStatus: 'NOT_RUN',
    allowedCallCount: 0,
    deniedCallCount: 0,
    argumentMatch: false,
    ...(config.profile
      ? { results: Array(config.expectedArgumentSequence.length).fill(null) }
      : { result: null }),
    ...(offlineFixture ? { offlineFixture: offlineFixture.snapshot() } : {}),
    ...(p06AssetGuard ? { offlineAssetBoundary: p06AssetGuard.snapshot() } : {}),
    ...(r04RenderAssetFence ? { rendererAssetBoundary: r04RenderAssetFence.snapshot() } : {}),
    ...(c04PublicFetch ? { publicRequestScope: c04PublicFetch.snapshot() } : {}),
    ...(r02PublicFetch ? { publicRequestScope: r02PublicFetch.snapshot() } : {}),
    privacy: buildG06PrivacySummary(),
  };
  const publicRequestFetch = c04PublicFetch || r02PublicFetch;
  const persistSummary = () =>
    writeSanitizedSummary(
      config.summaryPath,
      publicRequestFetch
        ? { ...summary, publicRequestScope: publicRequestFetch.snapshot() }
        : summary,
      serverInstanceId,
    );
  persistSummary();

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const call = config.profile
      ? authorizeToolCallSequence({
          name: request.params.name,
          args: request.params.arguments || {},
          expectedTool: config.toolName,
          expectedToolSequence: config.expectedToolSequence,
          expectedArgumentSequence: config.expectedArgumentSequence,
          completedCalls: allowedCalls,
        })
      : authorizeToolCall({
          name: request.params.name,
          args: request.params.arguments || {},
          expectedTool: config.toolName,
          expectedArguments: config.expectedArguments,
          completedCalls: allowedCalls,
        });
    if (!call.allowed) {
      deniedCalls += 1;
      summary = { ...summary, deniedCallCount: deniedCalls };
      persistSummary();
      return {
        content: [{ type: 'text', text: `Rejected by one-tool QA server: ${call.code}.` }],
        isError: true,
      };
    }
    const sequenceIndex = config.profile ? call.sequenceIndex : 0;
    const callClaimed = config.profile
      ? claimProfileSequenceCall(`${path.resolve(config.summaryPath)}.call-claimed`, sequenceIndex)
      : claimSingleToolCall(`${path.resolve(config.summaryPath)}.call-claimed`);
    if (!callClaimed) {
      deniedCalls += 1;
      summary = { ...summary, deniedCallCount: deniedCalls };
      persistSummary();
      return {
        content: [{ type: 'text', text: 'Rejected by one-tool QA server: CALL_LIMIT_REACHED.' }],
        isError: true,
      };
    }
    if (!runtimeCandidateMatches(sourceRevision, bundleSha256)) {
      deniedCalls += 1;
      summary = { ...summary, deniedCallCount: deniedCalls };
      persistSummary();
      return {
        content: [{ type: 'text', text: 'Rejected by one-tool QA server: CANDIDATE_DRIFT.' }],
        isError: true,
      };
    }
    allowedCalls += 1;
    summary = { ...summary, allowedCallCount: allowedCalls, argumentMatch: true };
    persistSummary();
    const runAcceptedCall = async () => {
      try {
        if (config.profile && profileSequenceFailed) {
          deniedCalls += 1;
          summary = { ...summary, deniedCallCount: deniedCalls };
          persistSummary();
          return {
            content: [
              {
                type: 'text',
                text: 'Rejected by one-tool QA server: PROFILE_SEQUENCE_PREVIOUS_CALL_FAILED.',
              },
            ],
            isError: true,
          };
        }
        const identity = await identityProvider.resolveContext(request);
        const expectedToolName = config.profile
          ? config.expectedToolSequence[sequenceIndex]
          : config.toolName;
        const expectedArguments = config.profile
          ? config.expectedArgumentSequence[sequenceIndex]
          : config.expectedArguments;
        const result = await registry.executeTool(expectedToolName, expectedArguments, {
          ...identity,
          requestId: `req_${randomUUID()}`,
          confirmationId: undefined,
        });
        if (!runtimeCandidateMatches(sourceRevision, bundleSha256)) {
          if (config.profile) profileSequenceFailed = true;
          summary = {
            ...summary,
            serverResultStatus: 'ERROR',
            errorCode: 'CANDIDATE_DRIFT',
          };
          persistSummary();
          return {
            content: [
              {
                type: 'text',
                text: 'G26 result not accepted: Candidate changed during execution.',
              },
            ],
            isError: true,
          };
        }
        if (config.profile) {
          const artifactSummary =
            config.profile.id === 'p06-render-person-profile-offline-agent-mcp-v1'
              ? artifactStore.summarize(result?.artifact?.id, { verifyPng: true })
              : config.profile.id === A01_RENDER_COHORT_AGGREGATION_PROFILE_ID
                ? artifactStore.summarize(result?.artifact?.id, { verifyPng: true })
                : config.profile.id === R04_RENDER_SERIES_WATCH_ORDER_PROFILE_ID
                  ? artifactStore.summarize(result?.artifact?.id, { verifyPng: true })
                  : config.profile.id === C04_COHORT_COMPARISON_PROFILE_ID &&
                      expectedToolName === 'bangumi.render_subject_cohort_comparison'
                    ? artifactStore.summarize(result?.artifact?.id)
                    : null;
          const resultSummary = summarizeProfileToolResult(
            result,
            expectedArguments,
            config.profile.id,
            artifactSummary,
            expectedToolName,
          );
          const results = [...summary.results];
          results[sequenceIndex] = {
            sequenceIndex,
            ...(config.toolNames.length > 1 ||
            config.profile?.id === C04_COHORT_COMPARISON_PROFILE_ID
              ? { toolName: expectedToolName }
              : {}),
            status: 'SUCCESS',
            resultSummary,
          };
          summary = {
            ...summary,
            serverResultStatus: results.every(Boolean) ? 'SUCCESS' : 'PARTIAL',
            results,
          };
        } else {
          const resultSummary = summarizeToolResult(
            expectedToolName,
            result,
            artifactStore.summarize(result?.artifact?.id, { verifyPng: Boolean(offlineFixture) }),
          );
          summary = {
            ...summary,
            serverResultStatus: 'SUCCESS',
            result: resultSummary,
          };
        }
        if (offlineFixture) summary = { ...summary, offlineFixture: offlineFixture.snapshot() };
        if (p06AssetGuard) summary = { ...summary, offlineAssetBoundary: p06AssetGuard.snapshot() };
        if (r04RenderAssetFence) {
          summary = { ...summary, rendererAssetBoundary: r04RenderAssetFence.snapshot() };
        }
        persistSummary();
        if (config.profile?.id === P07_PERSON_SEASON_PROFILE_ID) {
          const safeProjection = summary.results[sequenceIndex]?.resultSummary;
          if (!safeProjection) {
            summary = {
              ...summary,
              serverResultStatus: 'ERROR',
              results: [{ sequenceIndex, status: 'ERROR', errorCode: 'P07_SUMMARY_UNAVAILABLE' }],
            };
            persistSummary();
            return {
              content: [{ type: 'text', text: 'P07 bounded date summary is unavailable.' }],
              isError: true,
            };
          }
          const text = JSON.stringify(safeProjection);
          return {
            content: [{ type: 'text', text }],
            structuredContent: safeProjection,
          };
        }
        if (config.profile?.id === A01_RENDER_COHORT_AGGREGATION_PROFILE_ID) {
          const safeProjection = summary.results[sequenceIndex]?.resultSummary;
          if (!safeProjection) {
            summary = {
              ...summary,
              serverResultStatus: 'ERROR',
              results: [{ sequenceIndex, status: 'ERROR', errorCode: 'A01_SUMMARY_UNAVAILABLE' }],
            };
            persistSummary();
            return {
              content: [{ type: 'text', text: 'A01 artifact summary is unavailable.' }],
              isError: true,
            };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(safeProjection) }],
            structuredContent: safeProjection,
          };
        }
        if (config.profile?.id === R04_RENDER_SERIES_WATCH_ORDER_PROFILE_ID) {
          const safeProjection = summary.results[sequenceIndex]?.resultSummary;
          if (!safeProjection) {
            summary = {
              ...summary,
              serverResultStatus: 'ERROR',
              results: [
                { sequenceIndex, status: 'ERROR', errorCode: 'R04_RENDER_SUMMARY_UNAVAILABLE' },
              ],
            };
            persistSummary();
            return {
              content: [{ type: 'text', text: 'R04 render artifact summary is unavailable.' }],
              isError: true,
            };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(safeProjection) }],
            structuredContent: safeProjection,
          };
        }
        if (config.profile?.id === R01_RELATIONS_OFFLINE_PROFILE_ID) {
          const safeProjection = summary.results[sequenceIndex]?.resultSummary;
          if (!safeProjection) {
            summary = {
              ...summary,
              serverResultStatus: 'ERROR',
              results: [{ sequenceIndex, status: 'ERROR', errorCode: 'R01_SUMMARY_UNAVAILABLE' }],
            };
            persistSummary();
            return {
              content: [{ type: 'text', text: 'R01 offline relation summary is unavailable.' }],
              isError: true,
            };
          }
          const text = JSON.stringify(safeProjection);
          return {
            content: [{ type: 'text', text }],
            structuredContent: safeProjection,
          };
        }
        if (config.profile?.id === R02_POSITIVE_DIRECT_RELATIONS_PROFILE_ID) {
          const safeProjection = summary.results[sequenceIndex]?.resultSummary;
          if (!safeProjection) {
            summary = {
              ...summary,
              serverResultStatus: 'ERROR',
              results: [{ sequenceIndex, status: 'ERROR', errorCode: 'R02_SUMMARY_UNAVAILABLE' }],
            };
            persistSummary();
            return {
              content: [{ type: 'text', text: 'R02 bounded relation summary is unavailable.' }],
              isError: true,
            };
          }
          const text = JSON.stringify(safeProjection);
          return {
            content: [{ type: 'text', text }],
            structuredContent: safeProjection,
          };
        }
        const toolPresentation = presentMcpToolResult(expectedToolName, result);
        return {
          content: [{ type: 'text', text: toolPresentation.text }],
          ...(toolPresentation.structuredContent
            ? { structuredContent: toolPresentation.structuredContent }
            : {}),
        };
      } catch (error) {
        if (config.profile) profileSequenceFailed = true;
        const publicError = toPublicError(error);
        const errorCode = typeof publicError.code === 'string' ? publicError.code : 'UNKNOWN_ERROR';
        if (config.profile) {
          const results = [...summary.results];
          results[sequenceIndex] = { sequenceIndex, status: 'ERROR', errorCode };
          summary = { ...summary, serverResultStatus: 'ERROR', results };
        } else {
          summary = { ...summary, serverResultStatus: 'ERROR', errorCode };
        }
        if (offlineFixture) summary = { ...summary, offlineFixture: offlineFixture.snapshot() };
        if (p06AssetGuard) summary = { ...summary, offlineAssetBoundary: p06AssetGuard.snapshot() };
        if (r04RenderAssetFence) {
          summary = { ...summary, rendererAssetBoundary: r04RenderAssetFence.snapshot() };
        }
        if (publicRequestFetch) {
          summary = { ...summary, publicRequestScope: publicRequestFetch.snapshot() };
        }
        persistSummary();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ code: publicError.code, message: publicError.message }),
            },
          ],
          isError: true,
        };
      }
    };
    return config.profile ? enqueueProfileCall(runAcceptedCall) : runAcceptedCall();
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  const shutdown = async () => {
    try {
      await server.close();
    } catch {
      /* Continue best-effort cleanup. */
    }
    try {
      await registry.close();
    } catch {
      /* Continue best-effort cleanup. */
    }
    try {
      await storage.close();
    } catch {
      /* Continue best-effort cleanup. */
    }
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `[codex-one-tool-mcp] ${error instanceof Error ? error.message : 'startup error'}`,
    );
    process.exitCode = 1;
  });
}
