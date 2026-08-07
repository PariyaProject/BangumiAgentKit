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
const OVERRIDES_PATH = path.join(__dirname, '..', 'openapi', 'operation-overrides.yaml');
const REGISTRY_JSON_PATH = path.join(__dirname, '..', 'openapi', 'generated-operation-registry.json');
const REGISTRY_TS_PATH = path.join(__dirname, '..', 'packages', 'bangumi-openapi', 'src', 'operation-registry.ts');

function loadOverrides(): Record<string, { risk?: OperationRisk; auth?: AuthRequirement; scopes?: string[] }> {
  if (fs.existsSync(OVERRIDES_PATH)) {
    const raw = fs.readFileSync(OVERRIDES_PATH, 'utf-8');
    const parsed = YAML.parse(raw);
    return parsed?.overrides || {};
  }
  return {};
}

function extractSecurityMeta(op: any): { auth: AuthRequirement; scopes: string[] } {
  const secList: any[] = op.security || [];
  let auth: AuthRequirement = 'none';
  const scopes: string[] = [];

  if (secList.length > 0) {
    for (const secObj of secList) {
      if (typeof secObj !== 'object' || secObj === null) continue;
      for (const [scheme, scopeArray] of Object.entries(secObj as Record<string, string[]>)) {
        if (scheme === 'HTTPBearer' || scheme === 'OAuth2') {
          auth = 'required';
          if (Array.isArray(scopeArray)) {
            for (const s of scopeArray) {
              if (!scopes.includes(s)) scopes.push(s);
            }
          }
        } else if (scheme === 'OptionalHTTPBearer' && auth !== 'required') {
          auth = 'optional';
        }
      }
    }
  }

  return { auth, scopes };
}

function getOperationMeta(
  op: any,
  tag: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  apiPath: string,
  summary: string,
  overrides: Record<string, { risk?: OperationRisk; auth?: AuthRequirement; scopes?: string[] }>
): OperationMeta {
  const opId = op.operationId;
  const { auth: parsedAuth, scopes: parsedScopes } = extractSecurityMeta(op);

  const override = overrides[opId] || {};
  const auth = override.auth || parsedAuth;
  const scopes = override.scopes || parsedScopes;

  let risk: OperationRisk;
  if (override.risk) {
    risk = override.risk;
  } else if (method === 'GET') {
    risk = 'read';
  } else if (method === 'DELETE') {
    risk = 'destructive';
  } else {
    risk = 'write';
  }

  return {
    operationId: opId,
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
  const overrides = loadOverrides();

  const registry: Record<string, OperationMeta> = {};

  for (const [apiPath, pathItem] of Object.entries(spec.paths as Record<string, any>)) {
    for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = pathItem[m];
      if (op && op.operationId) {
        const method = m.toUpperCase() as OperationMeta['method'];
        const tag = op.tags?.[0] || '通用';
        const summary = op.summary || op.description?.split('\n')[0] || op.operationId;
        const meta = getOperationMeta(op, tag, method, apiPath, summary, overrides);
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
