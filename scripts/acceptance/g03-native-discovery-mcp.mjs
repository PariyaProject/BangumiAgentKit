import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MemoryStorage } from '../../packages/db/dist/index.js';
import { GeneratedBangumiOpenApiClient } from '../../packages/bangumi-openapi/dist/index.js';
import { HttpClient } from '../../packages/bangumi-transport/dist/index.js';
import { OfficialV0Provider, ProviderRegistry } from '../../packages/provider-core/dist/index.js';
import { ToolRegistry } from '../../packages/tools/dist/index.js';
import { LocalArtifactStore, RenderService } from '../../packages/renderer/dist/index.js';
import { toMcpTool } from '../../apps/mcp/dist/catalog.js';
import { presentMcpToolResult } from '../../apps/mcp/dist/result-presenter.js';
import {
  createG03NativeVerification,
  G03_NATIVE_CALLS,
} from '../lib/g03-native-discovery-verification.mjs';

/** Construction only. The future model runner owns its separate claim and process latch. */
export async function createG03NativeMcpServer() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bgk-g03-native-'));
  const storage = new MemoryStorage();
  const store = new LocalArtifactStore({ artifactDir: directory, ttlMinutes: 10 });
  let png = null,
    forbiddenServices = 0,
    renderStarted = false,
    closePromise;
  const pending = new Set();
  const ownedFile = async (file) => {
    const info = await fs.lstat(file);
    if (
      !info.isFile() ||
      info.uid !== process.getuid() ||
      info.nlink !== 1 ||
      info.size > 5_000_000
    )
      throw new Error('G03_NATIVE_ARTIFACT_INVALID');
  };
  const observation = createG03NativeVerification({
    readArtifact: async (artifact) => {
      const file = path.join(directory, artifact.id + '.png');
      await ownedFile(file);
      const metadata = await store.getArtifact(artifact.id);
      if (
        metadata?.filePath !== file ||
        metadata.width !== artifact.width ||
        metadata.height !== artifact.height
      )
        throw new Error('G03_NATIVE_ARTIFACT_INVALID');
      const descriptor = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        png = await descriptor.readFile();
      } finally {
        await descriptor.close();
      }
      return png;
    },
  });
  const refuse = async () => {
    forbiddenServices++;
    throw new Error('G03_NATIVE_SERVICE_DISABLED');
  };
  const disabled = new Proxy({}, { get: () => refuse });
  const renderer = new RenderService(undefined, undefined, { resolveAsset: refuse });
  const saveArtifact = store.saveArtifact.bind(store);
  store.saveArtifact = (buffer, mimeType, options) => {
    observation.admitArtifactWrite(buffer, mimeType, options);
    return saveArtifact(buffer, mimeType, options);
  };
  const renderCard = renderer.renderCard.bind(renderer);
  renderer.renderCard = async (viewModel, options) => {
    const fixedOptions = {
      width: options.width,
      deviceScaleFactor: options.deviceScaleFactor,
      cache: false,
      theme: 'light',
      designPack: 'warm-editorial',
      typography: {},
    };
    observation.admitRender(viewModel, fixedOptions);
    renderStarted = true;
    const result = await renderCard(viewModel, fixedOptions);
    observation.observeRender(viewModel, result, fixedOptions);
    return result;
  };
  const publicHttpClient = new HttpClient({ fetchFn: observation.fetchFn });
  const provider = new GeneratedBangumiOpenApiClient(publicHttpClient);
  const registry = new ToolRegistry(
    {
      storage,
      publicHttpClient,
      providerRegistry: new ProviderRegistry({ v0: new OfficialV0Provider(provider) }),
      clientProvider: {
        getPublicClient: async () => provider,
        getOptionalAuthenticatedClient: refuse,
        requireAuthenticatedClient: refuse,
      },
      tokenBroker: disabled,
      oauthService: disabled,
      auditService: disabled,
      renderService: renderer,
      artifactStore: store,
    },
    { profile: 'full', renderTarget: 'chat' },
  );
  const context = Object.freeze({
    principalId: 'g03-synthetic-observation',
    botInstanceId: 'g03-synthetic-observation',
    conversationId: 'g03-synthetic-observation',
  });
  const descriptors = G03_NATIVE_CALLS.map(({ toolName }) => {
    const tool = registry.getTool(toolName);
    if (!tool || tool.auth !== 'none' || tool.risk !== 'read')
      throw new Error('G03_NATIVE_CATALOG_INVALID');
    return toMcpTool(tool);
  });
  const server = new Server(
    { name: 'bgk_g03_native_discovery', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: structuredClone(descriptors),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    try {
      const result = await observation.call(
        (name, args) => {
          const work = registry.executeTool(name, args, context);
          pending.add(work);
          // Track the underlying operation even when the observation has been cancelled.
          void work.then(
            () => pending.delete(work),
            () => pending.delete(work),
          );
          return work;
        },
        request.params.name,
        request.params.arguments,
        { signal: extra.signal },
      );
      const projection = presentMcpToolResult(request.params.name, result);
      return {
        content: [{ type: 'text', text: projection.text }],
        ...(projection.structuredContent
          ? { structuredContent: projection.structuredContent }
          : {}),
      };
    } catch {
      return {
        content: [{ type: 'text', text: 'G03_NATIVE_OBSERVATION_FAILED' }],
        structuredContent: { errorCode: 'G03_NATIVE_OBSERVATION_FAILED' },
        isError: true,
      };
    }
  });
  return {
    server,
    snapshot: () => ({ ...observation.snapshot(), forbiddenServices, renderStarted }),
    verifiedPng: () => {
      if (observation.snapshot().phase !== 'COMPLETE' || !png)
        throw new Error('G03_NATIVE_ARTIFACT_NOT_VERIFIED');
      return Buffer.from(png);
    },
    close() {
      closePromise ??= (async () => {
        observation.stop();
        const results = await Promise.allSettled([
          server.close(),
          registry.close(),
          storage.close(),
        ]);
        // Drain admitted work before removing its private artifact directory.
        await Promise.allSettled([...pending]);
        for (const name of await fs.readdir(directory)) {
          if (!/^art_[0-9a-f]{32}\.(png|json)$/u.test(name))
            throw new Error('G03_NATIVE_CLEANUP_UNEXPECTED_FILE');
          const file = path.join(directory, name);
          await ownedFile(file);
          await fs.unlink(file);
        }
        await fs.rmdir(directory);
        png = null;
        if (results.some((result) => result.status === 'rejected'))
          throw new Error('G03_NATIVE_CLOSE_FAILED');
      })();
      return closePromise;
    },
  };
}
