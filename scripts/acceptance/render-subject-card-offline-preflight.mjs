import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpClient } from '../../packages/bangumi-transport/dist/index.js';
import { MemoryStorage } from '../../packages/db/dist/index.js';
import { RenderService } from '../../packages/renderer/dist/index.js';
import {
  createRuntimeDependenciesWithStorage,
  ToolRegistry,
} from '../../packages/tools/dist/index.js';
import {
  createRenderSubjectCardOfflineAssetGuard,
  createRenderSubjectCardOfflineFetch,
  RENDER_SUBJECT_CARD_OFFLINE_V1_ARGUMENTS,
  RENDER_SUBJECT_CARD_OFFLINE_V1_PROFILE_ID,
} from '../lib/render-subject-card-offline-profile.mjs';
import { getAgentMcpProfileById } from '../lib/agent-mcp-profile-claims.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT_DIRECTORY = path.join(
  ROOT,
  'docs/research/assets/run95-render-subject-card-offline-agent-mcp-v1',
);
const IMAGE_PATH = path.join(OUTPUT_DIRECTORY, 'subject-card-warm-editorial-360x2.png');
const MANIFEST_PATH = path.join(OUTPUT_DIRECTORY, 'manifest.json');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readPngDimensions(buffer) {
  if (
    !buffer.subarray(0, 8).equals(PNG_SIGNATURE) ||
    buffer.toString('ascii', 12, 16) !== 'IHDR' ||
    buffer.length < 24
  ) {
    throw new Error('RENDER_SUBJECT_CARD_OFFLINE_PREFLIGHT_PNG_INVALID');
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function main() {
  if (existsSync(IMAGE_PATH) || existsSync(MANIFEST_PATH)) {
    throw new Error('RENDER_SUBJECT_CARD_PREFLIGHT_OUTPUT_ALREADY_EXISTS');
  }

  const profile = getAgentMcpProfileById(RENDER_SUBJECT_CARD_OFFLINE_V1_PROFILE_ID);
  if (!profile) throw new Error('RENDER_SUBJECT_CARD_OFFLINE_PROFILE_NOT_REGISTERED');

  process.env.BANGUMI_RENDER_THEME = 'bangumi-light';
  process.env.BANGUMI_RENDER_DESIGN_PACK = 'warm-editorial';

  const fixture = createRenderSubjectCardOfflineFetch(profile);
  const assetGuard = createRenderSubjectCardOfflineAssetGuard();
  const renderService = new RenderService(undefined, undefined, assetGuard.assetResolver);
  const storage = new MemoryStorage();
  const artifactBuffers = [];
  const artifactStore = {
    async saveArtifact(buffer, mimeType = 'image/png', size = {}) {
      artifactBuffers.push(Buffer.from(buffer));
      return {
        id: 'render-subject-card-offline-preflight',
        mimeType,
        ...size,
        expiresAt: '2099-01-01T00:00:00.000Z',
      };
    },
  };
  const dependencies = createRuntimeDependenciesWithStorage(storage, {
    publicHttpClient: new HttpClient({ baseUrl: 'https://api.bgm.tv', fetchFn: fixture.fetchFn }),
    renderService,
    artifactStore,
  });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });

  try {
    const result = await registry.executeTool(
      profile.toolName,
      RENDER_SUBJECT_CARD_OFFLINE_V1_ARGUMENTS,
      {
        principalId: 'anonymous',
        botInstanceId: 'render-subject-card-offline-preflight',
        conversationId: 'render-subject-card-offline-preflight',
      },
    );

    const artifact = result?.artifact;
    const [png] = artifactBuffers;
    const fetchBoundary = fixture.snapshot();
    const assetBoundary = assetGuard.snapshot();
    if (
      !artifact ||
      artifact.mimeType !== 'image/png' ||
      artifact.width !== 720 ||
      !Number.isInteger(artifact.height) ||
      artifact.height <= 0 ||
      artifactBuffers.length !== 1 ||
      !png ||
      fetchBoundary.requestCount !== 1 ||
      fetchBoundary.unexpectedRequestCount !== 0 ||
      fetchBoundary.authorizationHeaderCount !== 0 ||
      fetchBoundary.collectionRequestCount !== 0 ||
      assetBoundary.assetResolutionCallCount !== 0 ||
      assetBoundary.nonEmptyAssetUrlCount !== 0 ||
      assetBoundary.blockedAssetRequestCount !== 0
    ) {
      throw new Error('RENDER_SUBJECT_CARD_OFFLINE_PREFLIGHT_ASSERTION_FAILED');
    }

    const dimensions = readPngDimensions(png);
    if (dimensions.width !== 720 || dimensions.height !== artifact.height) {
      throw new Error('RENDER_SUBJECT_CARD_OFFLINE_PREFLIGHT_PNG_METADATA_INVALID');
    }

    mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
    writeFileSync(IMAGE_PATH, png, { flag: 'wx', mode: 0o644 });
    const workingTreeStatus = execFileSync(
      'git',
      ['status', '--porcelain', '--untracked-files=all'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const manifest = {
      schema: 'run95-render-subject-card-offline-preflight/v1',
      profileId: profile.id,
      sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim(),
      sourceBinding: {
        workingTreeClean: workingTreeStatus === '',
        exactCandidateEvidence: false,
      },
      toolName: profile.toolName,
      arguments: RENDER_SUBJECT_CARD_OFFLINE_V1_ARGUMENTS,
      render: {
        target: 'chat',
        widthCssPixels: 360,
        deviceScaleFactor: 2,
        theme: 'bangumi-light',
        designPack: 'warm-editorial',
      },
      artifact: {
        path: path.relative(ROOT, IMAGE_PATH),
        mimeType: 'image/png',
        width: dimensions.width,
        height: dimensions.height,
        byteLength: png.length,
        sha256: sha256(png),
        pngSignatureValid: true,
      },
      fetchBoundary,
      assetBoundary,
      rawFixturePayloadStored: false,
    };
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o644,
    });
    console.log(
      JSON.stringify({
        passed: true,
        artifactPath: path.relative(ROOT, IMAGE_PATH),
        width: dimensions.width,
        height: dimensions.height,
        byteLength: png.length,
        sha256: manifest.artifact.sha256,
        requestCount: fetchBoundary.requestCount,
        assetResolutionCallCount: assetBoundary.assetResolutionCallCount,
      }),
    );
  } finally {
    await registry.close();
    await storage.close();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'RENDER_SUBJECT_CARD_OFFLINE_PREFLIGHT_FAILED',
  );
  process.exitCode = 1;
});
