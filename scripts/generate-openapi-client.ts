import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

const SPEC_PATH = path.join(__dirname, '..', 'openapi', 'upstream', 'v0.yaml');
const GENERATED_DIR = path.join(__dirname, '..', 'packages', 'bangumi-openapi', 'src', 'generated');
const CLIENT_OUTPUT_PATH = path.join(GENERATED_DIR, 'index.ts');

function generateClient() {
  console.log(`[generate-client] Reading spec from ${SPEC_PATH}...`);
  const content = fs.readFileSync(SPEC_PATH, 'utf-8');
  const spec = YAML.parse(content);

  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  const code: string[] = [];

  code.push(`// Auto-generated Bangumi OpenAPI Client & Types. DO NOT EDIT MANUALLY.`);
  code.push(`// Spec version: Bangumi OpenAPI v0\n`);

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
  code.push(`export interface BangumiRawClientConfig {
  baseUrl?: string;
  userAgent?: string;
  accessToken?: string;
}

export class GeneratedBangumiOpenApiClient {
  private baseUrl: string;
  private userAgent: string;
  private accessToken?: string;

  constructor(config: BangumiRawClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'https://api.bgm.tv';
    this.userAgent = config.userAgent || 'BangumiAgentKit/0.1.0';
    this.accessToken = config.accessToken;
  }

  private async request<T>(method: string, path: string, options: { query?: Record<string, any>; body?: any } = {}): Promise<T> {
    let url = \`\${this.baseUrl}\${path}\`;
    if (options.query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined && v !== null) {
          params.append(k, String(v));
        }
      }
      const queryString = params.toString();
      if (queryString) {
        url += \`?\${queryString}\`;
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': this.userAgent,
    };

    if (this.accessToken) {
      headers['Authorization'] = \`Bearer \${this.accessToken}\`;
    }

    let reqBody: string | undefined = undefined;
    if (options.body) {
      headers['Content-Type'] = 'application/json';
      reqBody = JSON.stringify(options.body);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: reqBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(\`Bangumi API Request Failed [\${response.status}]: \${errorText}\`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }
`);

  // Method signatures for all 55 operations
  for (const [apiPath, pathItem] of Object.entries(spec.paths as Record<string, any>)) {
    for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = pathItem[m];
      if (op && op.operationId) {
        const method = m.toUpperCase();
        const opId = op.operationId;
        const summary = op.summary || opId;

        // Path params extraction
        const pathParams = (op.parameters || [])
          .filter((p: any) => p.in === 'path')
          .map((p: any) => p.name);

        const hasQueryParams = (op.parameters || []).some((p: any) => p.in === 'query');
        const hasBody = !!op.requestBody;

        const argsList: string[] = [];
        for (const p of pathParams) {
          argsList.push(`${p}: string | number`);
        }
        if (hasQueryParams) {
          argsList.push(`query?: Record<string, unknown>`);
        }
        if (hasBody) {
          argsList.push(`body?: unknown`);
        }

        const argsStr = argsList.join(', ');

        // Path string replace
        let pathExpr = `\`${apiPath}\``;
        for (const p of pathParams) {
          pathExpr = pathExpr.replace(`{${p}}`, `\${${p}}`);
        }

        code.push(`  /** ${summary} (${method} ${apiPath}) */`);
        code.push(`  async ${opId}(${argsStr}): Promise<any> {`);
        const optProps: string[] = [];
        if (hasQueryParams) optProps.push('query');
        if (hasBody) optProps.push('body');
        const optStr = optProps.length > 0 ? `, { ${optProps.join(', ')} }` : '';
        code.push(`    return this.request<any>('${method}', ${pathExpr}${optStr});`);
        code.push(`  }\n`);
      }
    }
  }

  code.push(`}\n`);

  fs.writeFileSync(CLIENT_OUTPUT_PATH, code.join('\n'), 'utf-8');
  console.log(`[generate-client] Client generated at ${CLIENT_OUTPUT_PATH}`);
}

generateClient();
