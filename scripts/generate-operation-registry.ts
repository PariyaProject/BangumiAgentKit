import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

export type OperationRisk = 'read' | 'write' | 'destructive';
export type AuthRequirement = 'none' | 'optional' | 'required';

export interface OperationMeta {
  operationId: string;
  tag: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  auth: AuthRequirement;
  scopes: string[];
  risk: OperationRisk;
  summary: string;
}

const SPEC_PATH = path.join(__dirname, '..', 'openapi', 'upstream', 'v0.yaml');
const REGISTRY_JSON_PATH = path.join(__dirname, '..', 'openapi', 'generated-operation-registry.json');
const REGISTRY_TS_PATH = path.join(__dirname, '..', 'packages', 'bangumi-openapi', 'src', 'operation-registry.ts');

function getOperationMeta(
  operationId: string,
  tag: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  apiPath: string,
  summary: string,
): OperationMeta {
  // Determine risk, auth, scopes based on operationId and method
  let auth: AuthRequirement = 'none';
  let scopes: string[] = [];
  let risk: OperationRisk = 'read';

  if (method === 'GET') {
    risk = 'read';
    if (operationId === 'getMyself') {
      auth = 'required';
    } else if (
      operationId.includes('Collection') ||
      operationId.includes('User')
    ) {
      auth = 'optional';
    } else {
      auth = 'optional';
    }
  } else {
    // Search operations are read-only POSTs
    if (
      operationId === 'searchSubjects' ||
      operationId === 'searchCharacters' ||
      operationId === 'searchPersons'
    ) {
      risk = 'read';
      auth = 'none';
    } else if (
      operationId.includes('Index') ||
      operationId.includes('SubjectFromIndex')
    ) {
      auth = 'required';
      scopes = ['write:indices'];
      if (
        operationId.includes('delelte') ||
        operationId.includes('delete') ||
        operationId.includes('uncollect')
      ) {
        risk = 'destructive';
      } else {
        risk = 'write';
      }
    } else if (
      operationId.includes('Collection') ||
      operationId.includes('collect') ||
      operationId.includes('uncollect')
    ) {
      auth = 'required';
      scopes = ['write:collection'];
      if (operationId.startsWith('uncollect')) {
        risk = 'destructive';
      } else {
        risk = 'write';
      }
    } else {
      auth = 'required';
      risk = method === 'DELETE' ? 'destructive' : 'write';
    }
  }

  return {
    operationId,
    tag,
    method,
    path: apiPath,
    auth,
    scopes,
    risk,
    summary,
  };
}

function generateRegistry() {
  console.log(`[generate-registry] Reading ${SPEC_PATH}...`);
  const content = fs.readFileSync(SPEC_PATH, 'utf-8');
  const spec = YAML.parse(content);

  const registry: Record<string, OperationMeta> = {};

  for (const [apiPath, pathItem] of Object.entries(spec.paths as Record<string, any>)) {
    for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = pathItem[m];
      if (op && op.operationId) {
        const method = m.toUpperCase() as OperationMeta['method'];
        const tag = op.tags?.[0] || '通用';
        const summary = op.summary || op.description?.split('\n')[0] || op.operationId;
        const meta = getOperationMeta(op.operationId, tag, method, apiPath, summary);
        registry[op.operationId] = meta;
      }
    }
  }

  // Add Legacy Calendar Operation
  registry['getCalendar'] = {
    operationId: 'getCalendar',
    tag: '每日放送',
    method: 'GET',
    path: '/calendar',
    auth: 'none',
    scopes: [],
    risk: 'read',
    summary: '获取每日放送动画列表',
  };

  const totalOps = Object.keys(registry).length;
  console.log(`[generate-registry] Total registered operations: ${totalOps}`);

  if (totalOps !== 56) {
    console.warn(`[generate-registry] WARNING: Expected 56 operations, found ${totalOps}`);
  }

  // Write JSON
  fs.writeFileSync(REGISTRY_JSON_PATH, JSON.stringify(registry, null, 2), 'utf-8');
  console.log(`[generate-registry] Written ${REGISTRY_JSON_PATH}`);

  // Write TypeScript
  const tsContent = `// Auto-generated operation registry. DO NOT EDIT MANUALLY.

export type OperationRisk = 'read' | 'write' | 'destructive';
export type AuthRequirement = 'none' | 'optional' | 'required';

export interface OperationMeta {
  operationId: string;
  tag: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  auth: AuthRequirement;
  scopes: string[];
  risk: OperationRisk;
  summary: string;
}

export const OPERATION_REGISTRY: Record<string, OperationMeta> = ${JSON.stringify(registry, null, 2)};
`;

  fs.writeFileSync(REGISTRY_TS_PATH, tsContent, 'utf-8');
  console.log(`[generate-registry] Written ${REGISTRY_TS_PATH}`);
}

generateRegistry();
