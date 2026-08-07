import { z } from 'zod';
import { defineTool } from '../define-tool.js';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { OPERATION_REGISTRY, GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';

export function createRawOperationTools(httpClient: HttpClient) {
  const openApiClient = new GeneratedBangumiOpenApiClient({
    baseUrl: (httpClient as any).baseUrl,
    userAgent: (httpClient as any).userAgent,
  });

  const listOperations = defineTool({
    name: 'bangumi.list_operations',
    description: '列出 Bangumi API 支持的所有底层 Operation ID 以及对应的 tag、HTTP Method 和 Risk 级别。用于保底查找工具。',
    input: z.object({
      tag: z.string().optional().describe('按标签过滤 (如 "条目", "收藏", "章节")'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const result = [];
      for (const [opId, meta] of Object.entries(OPERATION_REGISTRY)) {
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
        throw new Error(`Unknown operationId: ${input.operationId}. Use bangumi.list_operations to see available IDs.`);
      }
      return meta;
    },
  });

  const callOperation = defineTool({
    name: 'bangumi.call_operation',
    description: '通过官方 Operation ID 直接执行底层 Bangumi API 请求。只能调用白名单允许的 Operation ID。',
    input: z.object({
      operationId: z.string().describe('白名单 Operation ID'),
      pathParams: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe('Path 参数'),
      queryParams: z.record(z.string(), z.unknown()).optional().describe('Query 参数'),
      body: z.unknown().optional().describe('Request Body 参数'),
    }),
    auth: 'optional',
    scopes: [],
    risk: 'read',
    execute: async (input, context) => {
      const meta = OPERATION_REGISTRY[input.operationId];
      if (!meta) {
        throw new Error(`Operation "${input.operationId}" is not allowed or does not exist in registry.`);
      }

      if (meta.auth === 'required' && !context.accessToken) {
        throw new Error(`Operation "${input.operationId}" requires OAuth authentication. Please bind account first.`);
      }

      // Check if client has method for operationId
      const clientFn = (openApiClient as any)[input.operationId];
      if (typeof clientFn === 'function') {
        // Collect arguments matching operation signature
        const args: any[] = [];
        if (input.pathParams) {
          for (const val of Object.values(input.pathParams)) {
            args.push(val);
          }
        }
        if (input.queryParams) {
          args.push(input.queryParams);
        }
        if (input.body) {
          args.push(input.body);
        }
        return await clientFn.apply(openApiClient, args);
      }

      // Generic fallback request via httpClient
      let resolvedPath = meta.path;
      if (input.pathParams) {
        for (const [k, v] of Object.entries(input.pathParams)) {
          resolvedPath = resolvedPath.replace(`{${k}}`, String(v));
        }
      }

      return await httpClient.request({
        method: meta.method,
        path: resolvedPath,
        query: input.queryParams,
        body: input.body,
        accessToken: context.accessToken,
      });
    },
  });

  return [listOperations, describeOperation, callOperation];
}
