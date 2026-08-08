import { z } from 'zod';
import { defineTool, ResolvedToolPolicy } from '../define-tool.js';
import { OPERATION_REGISTRY } from '@bangumi-agent-kit/bangumi-openapi';
import { BangumiError, HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { BangumiClientProvider, TokenBroker } from '@bangumi-agent-kit/auth';
import { MemoryStorage } from '@bangumi-agent-kit/db';

export function createRawOperationTools(
  clientProviderOrHttpClient?: BangumiClientProvider | HttpClient,
) {
  let provider: BangumiClientProvider;

  if (
    clientProviderOrHttpClient &&
    typeof (clientProviderOrHttpClient as any).requireAuthenticatedClient === 'function'
  ) {
    provider = clientProviderOrHttpClient as BangumiClientProvider;
  } else {
    const http =
      clientProviderOrHttpClient &&
      typeof (clientProviderOrHttpClient as any).request === 'function'
        ? (clientProviderOrHttpClient as HttpClient)
        : new HttpClient();
    provider = new TokenBroker(
      new MemoryStorage(),
      { secretKey: 'test-secret-key-123456789' },
      http,
    );
  }

  const listOperations = defineTool({
    name: 'bangumi.list_operations',
    description:
      '列出 Bangumi API 支持的所有底层 Operation ID 以及对应的 tag、HTTP Method 和 Risk 级别。用于保底查找工具。',
    input: z.object({
      tag: z.string().optional().describe('按标签过滤 (如 "条目", "收藏", "章节")'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const result = [];
      for (const [opId, rawMeta] of Object.entries(OPERATION_REGISTRY)) {
        const meta = rawMeta as {
          tag?: string;
          method?: string;
          path?: string;
          risk?: string;
          auth?: string;
          summary?: string;
        };
        if (!input.tag || meta.tag === input.tag) {
          result.push({
            operationId: opId,
            tag: meta.tag,
            method: meta.method,
            path: meta.path,
            risk: meta.risk,
            auth: meta.auth,
            summary: meta.summary,
          });
        }
      }
      return { total: result.length, operations: result };
    },
  });

  const describeOperation = defineTool({
    name: 'bangumi.describe_operation',
    description: '获取指定 Operation ID 的详细元数据、Path 结构、认证与权限要求。',
    input: z.object({
      operationId: z.string().describe('合法 Operation ID (如 "patchUserCollection")'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const meta = OPERATION_REGISTRY[input.operationId];
      if (!meta) {
        throw new Error(
          `Unknown operationId: ${input.operationId}. Use bangumi.list_operations to see available IDs.`,
        );
      }
      return meta;
    },
  });

  const callOperation = defineTool({
    name: 'bangumi.call_operation',
    description:
      '通过官方 Operation ID 直接执行底层 Bangumi API 请求。只能调用白名单允许的 Operation ID。',
    input: z.object({
      operationId: z.string().describe('白名单 Operation ID'),
      pathParams: z
        .record(z.string(), z.union([z.string(), z.number()]))
        .optional()
        .describe('Path 参数'),
      queryParams: z.record(z.string(), z.unknown()).optional().describe('Query 参数'),
      body: z.unknown().optional().describe('Request Body 参数'),
    }),
    auth: 'optional',
    scopes: [],
    risk: 'read',
    resolvePolicy: (input): ResolvedToolPolicy => {
      const meta = OPERATION_REGISTRY[input.operationId];
      if (!meta) {
        return { auth: 'optional', requiredCapabilities: [], risk: 'read' };
      }

      const allowRawWrites = process.env.BANGUMI_ALLOW_RAW_WRITES === 'true';
      if (meta.risk !== 'read' && !allowRawWrites) {
        throw new BangumiError(
          'RAW_WRITE_OPERATION_DISABLED',
          `当前系统配置禁止使用 bangumi.call_operation 执行写/破坏性操作 (${input.operationId})。请改用高层语义 Tool。`,
          false,
          403,
          '使用高层语义 Tool 或在环境变量中开启 BANGUMI_ALLOW_RAW_WRITES=true',
        );
      }

      return {
        auth: meta.auth,
        requiredCapabilities: meta.scopes || [],
        risk: meta.risk,
        actionType: `call_operation_${input.operationId}`,
        summary: `底层 Operation 调用: ${input.operationId}`,
      };
    },
    execute: async (input, context, deps?: Record<string, unknown>) => {
      const meta = OPERATION_REGISTRY[input.operationId];
      if (!meta) {
        throw new Error(
          `Operation "${input.operationId}" is not allowed or does not exist in registry.`,
        );
      }

      const activeProvider: BangumiClientProvider =
        (deps?.clientProvider as BangumiClientProvider) || provider;

      let client;
      const session = (deps as any)?.executionSession;
      if (session?.client) {
        client = session.client;
      } else if (meta.auth === 'required') {
        const authed = await activeProvider.requireAuthenticatedClient(
          context.principalId,
          meta.scopes || [],
        );
        client = authed.client;
      } else if (meta.auth === 'optional') {
        client = await activeProvider.getOptionalAuthenticatedClient(context.principalId);
      } else {
        client = await activeProvider.getPublicClient();
      }

      const pathParamsMap = input.pathParams || {};
      const pathArgs: (string | number)[] = [];

      for (const paramName of meta.pathParameters) {
        const val = pathParamsMap[paramName];
        if (val === undefined || val === null || val === '') {
          throw new Error(
            `MISSING_PATH_PARAMETER: Operation "${input.operationId}" requires path parameter "${paramName}"`,
          );
        }
        pathArgs.push(val);
      }

      const clientFn = (client as any)[input.operationId];
      if (typeof clientFn === 'function') {
        const args: any[] = [...pathArgs];
        const hasQueryMeta = Boolean(meta.queryParameters && meta.queryParameters.length > 0);
        const hasBodyMeta = Boolean(meta.requestBody);

        if (hasQueryMeta && hasBodyMeta) {
          args.push(input.queryParams);
          args.push(input.body);
        } else if (hasQueryMeta) {
          args.push(input.queryParams);
        } else if (hasBodyMeta) {
          args.push(input.body);
        }

        return await clientFn.apply(client, args);
      }

      throw new Error(`Client function "${input.operationId}" not found on OpenApiClient`);
    },
  });

  return [listOperations, describeOperation, callOperation];
}
