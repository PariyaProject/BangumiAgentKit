import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

const SPEC_PATH = path.join(__dirname, '..', 'openapi', 'upstream', 'v0.yaml');
const GENERATED_DIR = path.join(__dirname, '..', 'packages', 'bangumi-openapi', 'src', 'generated');
const CLIENT_OUTPUT_PATH = path.join(GENERATED_DIR, 'index.ts');

function resolveRef(spec: any, item: any): any {
  if (item && typeof item === 'object' && typeof item.$ref === 'string') {
    const refPath = item.$ref.replace(/^#\//, '').split('/');
    let current = spec;
    for (const segment of refPath) {
      current = current?.[segment];
    }
    return resolveRef(spec, current);
  }
  return item;
}

function generateClient() {
  console.log(`[generate-client] Reading spec from ${SPEC_PATH}...`);
  const content = fs.readFileSync(SPEC_PATH, 'utf-8');
  const spec = YAML.parse(content);

  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  const code: string[] = [];

  code.push(`// Auto-generated Bangumi OpenAPI Client & Types. DO NOT EDIT MANUALLY.`);
  code.push(`// Spec version: Bangumi OpenAPI v0\n`);
  code.push(`import { HttpClient, HttpClientConfig } from '@bangumi-agent-kit/bangumi-transport';\n`);

  // Basic types and Enums
  code.push(`export type SubjectType = 1 | 2 | 3 | 4 | 6; // 1: book, 2: anime, 3: music, 4: game, 6: real`);
  code.push(`export type CollectionStatus = 'wish' | 'collect' | 'do' | 'on_hold' | 'dropped';`);
  code.push(`export type EpisodeType = 0 | 1 | 2 | 3 | 4 | 5; // 0: main, 1: SP, 2: OP, 3: ED, etc.`);

  code.push(`
export interface Subject {
  id: number;
  type: SubjectType;
  name: string;
  name_cn: string;
  summary: string;
  nsfw: boolean;
  locked: boolean;
  date?: string;
  platform?: string;
  images?: {
    large?: string;
    common?: string;
    medium?: string;
    small?: string;
    grid?: string;
  };
  rating?: {
    total: number;
    count: Record<string, number>;
    score: number;
    rank: number;
  };
  collection?: {
    wish: number;
    collect: number;
    doing: number;
    on_hold: number;
    dropped: number;
  };
  eps?: number;
  total_episodes?: number;
}

export interface PagedResult<T> {
  total: number;
  limit: number;
  offset: number;
  data: T[];
}

export interface Character {
  id: number;
  name: string;
  role_name?: string;
  type: number;
  summary: string;
  images?: Record<string, string>;
  comment?: number;
  collects?: number;
}

export interface Person {
  id: number;
  name: string;
  type: number;
  career: string[];
  summary: string;
  images?: Record<string, string>;
}

export interface User {
  id: number;
  username: string;
  nickname: string;
  user_group: number;
  avatar?: Record<string, string>;
  sign?: string;
}

export interface Episode {
  id: number;
  type: EpisodeType;
  name: string;
  name_cn: string;
  sort: number;
  ep?: number;
  airdate?: string;
  comment?: number;
  duration?: string;
  desc?: string;
  disc?: number;
}

export interface Collection {
  subject_id: number;
  rate?: number;
  type: number;
  comment?: string;
  tags?: string[];
  ep_status?: number;
  vol_status?: number;
  updated_at?: string;
  private?: boolean;
}

export interface Index {
  id: number;
  title: string;
  desc: string;
  total: number;
  stat: {
    collects: number;
    comment: number;
  };
  created_at: string;
}

export interface Revision {
  id: number;
  type: number;
  summary: string;
  created_at: string;
  data?: any;
}
`);

  // Generate OpenAPI Client Methods
  code.push(`export class GeneratedBangumiOpenApiClient {
  private transport: HttpClient;

  constructor(configOrTransport?: HttpClient | HttpClientConfig) {
    if (configOrTransport instanceof HttpClient) {
      this.transport = configOrTransport;
    } else {
      this.transport = new HttpClient(configOrTransport);
    }
  }
`);

  // Method signatures for all 55 v0 operations
  for (const [apiPath, pathItem] of Object.entries(spec.paths as Record<string, any>)) {
    for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = pathItem[m];
      if (op && op.operationId) {
        const method = m.toUpperCase();
        const opId = op.operationId;
        const summary = op.summary || opId;

        // Resolve parameters (path + operation levels)
        const rawParams = [
          ...(pathItem.parameters || []),
          ...(op.parameters || []),
        ];

        const resolvedParamsMap = new Map<string, any>();
        for (const p of rawParams) {
          const resP = resolveRef(spec, p);
          if (resP && resP.name && resP.in) {
            resolvedParamsMap.set(`${resP.in}:${resP.name}`, resP);
          }
        }

        const resolvedParams = Array.from(resolvedParamsMap.values());

        // Extract path param names in path order
        const pathMatches = Array.from(apiPath.matchAll(/\{([^}]+)\}/g)).map((match) => match[1]);
        const pathParamNames: string[] = [];
        for (const pName of pathMatches) {
          if (!pathParamNames.includes(pName)) {
            pathParamNames.push(pName);
          }
        }
        for (const resP of resolvedParams) {
          if (resP.in === 'path' && !pathParamNames.includes(resP.name)) {
            pathParamNames.push(resP.name);
          }
        }

        const hasQueryParams = resolvedParams.some((p) => p.in === 'query');
        const hasBody = !!op.requestBody;

        const argsList: string[] = [];
        for (const pName of pathParamNames) {
          argsList.push(`${pName}: string | number`);
        }
        if (hasQueryParams) {
          argsList.push(`query?: Record<string, unknown>`);
        }
        if (hasBody) {
          argsList.push(`body?: unknown`);
        }

        const argsStr = argsList.join(', ');

        // Construct path template expression with encodeURIComponent
        let pathExpr = `\`${apiPath}\``;
        for (const pName of pathParamNames) {
          pathExpr = pathExpr.replace(`{${pName}}`, `\${encodeURIComponent(String(${pName}))}`);
        }

        code.push(`  /** ${summary} (${method} ${apiPath}) */`);
        code.push(`  async ${opId}(${argsStr}): Promise<any> {`);
        code.push(`    return this.transport.request<any>({`);
        code.push(`      method: '${method}',`);
        code.push(`      path: ${pathExpr},`);
        if (hasQueryParams) {
          code.push(`      query,`);
        }
        if (hasBody) {
          code.push(`      body,`);
        }
        code.push(`    });`);
        code.push(`  }\n`);
      }
    }
  }

  code.push(`}\n`);

  fs.writeFileSync(CLIENT_OUTPUT_PATH, code.join('\n'), 'utf-8');
  console.log(`[generate-client] Client generated at ${CLIENT_OUTPUT_PATH}`);
}

generateClient();
