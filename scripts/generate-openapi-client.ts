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
  code.push(`import { HttpClient, HttpClientConfig } from '@bangumi-agent-kit/bangumi-transport';`);
  code.push(`import type { components, operations, paths } from './schema.js';\n`);

  code.push(`export type { components, operations, paths };\n`);

  code.push(`// Helper types to extract operation parameters and responses safely`);
  code.push(
    `export type OperationPath<K extends keyof operations> = operations[K] extends { parameters: { path: infer P } } ? P : (operations[K] extends { parameters?: { path?: infer P } } ? P : Record<string, never>);`,
  );
  code.push(
    `export type OperationQuery<K extends keyof operations> = operations[K] extends { parameters: { query?: infer Q } } ? Q : Record<string, unknown>;`,
  );
  code.push(
    `export type OperationBody<K extends keyof operations> = operations[K] extends { requestBody: { content: { 'application/json': infer B } } } ? B : (operations[K] extends { requestBody?: { content: { 'application/json': infer B } } } ? B : never);`,
  );
  code.push(
    `export type OperationResponse<K extends keyof operations> = operations[K] extends { responses: { 200: { content: { 'application/json': infer R } } } } ? R : (operations[K] extends { responses: { 201: { content: { 'application/json': infer R } } } } ? R : (operations[K] extends { responses: { 302: unknown } } ? { location: string } : (operations[K] extends { responses: { 301: unknown } } ? { location: string } : (operations[K] extends { responses: { 204: unknown } } ? Record<string, never> : (operations[K] extends { responses: { 200: unknown } } ? Record<string, never> : never)))));\n`,
  );

  code.push(`// Re-exported DTO types derived strictly from OpenAPI components schema`);
  code.push(`export type Subject = components['schemas']['Subject'];`);
  code.push(`export type SubjectType = components['schemas']['SubjectType'];`);
  code.push(`export type SubjectCategory = components['schemas']['SubjectCategory'];`);
  code.push(`export type Character = components['schemas']['Character'];`);
  code.push(`export type Person = components['schemas']['Person'];`);
  code.push(`export type User = components['schemas']['User'];`);
  code.push(`export type Episode = components['schemas']['Episode'];`);
  code.push(`export type EpisodeType = components['schemas']['Episode']['type'];`);
  code.push(`export type UserSubjectCollection = components['schemas']['UserSubjectCollection'];`);
  code.push(`export type Index = components['schemas']['Index'];`);
  code.push(`export type Revision = components['schemas']['Revision'];`);
  code.push(`export type PagedSubject = components['schemas']['Paged_Subject'];`);
  code.push(`export type PagedCharacter = components['schemas']['Paged_Character'];`);
  code.push(`export type PagedPerson = components['schemas']['Paged_Person'];`);
  code.push(`export type PagedEpisode = components['schemas']['Paged_Episode'];`);
  code.push(`\n`);

  code.push(`export class GeneratedBangumiOpenApiClient {
  private transport: HttpClient;

  constructor(configOrTransport?: HttpClient | HttpClientConfig) {
    if (configOrTransport && typeof (configOrTransport as any).request === 'function') {
      this.transport = configOrTransport as HttpClient;
    } else {
      this.transport = new HttpClient(configOrTransport as HttpClientConfig);
    }
  }
`);

  for (const [apiPath, pathItem] of Object.entries(spec.paths as Record<string, any>)) {
    for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = pathItem[m];
      if (op && op.operationId) {
        const method = m.toUpperCase();
        const opId = op.operationId;
        const summary = op.summary || opId;

        const rawParams = [...(pathItem.parameters || []), ...(op.parameters || [])];
        const resolvedParamsMap = new Map<string, any>();
        for (const p of rawParams) {
          const resP = resolveRef(spec, p);
          if (resP && resP.name && resP.in) {
            resolvedParamsMap.set(`${resP.in}:${resP.name}`, resP);
          }
        }
        const resolvedParams = Array.from(resolvedParamsMap.values());

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

        const queryParams = resolvedParams.filter((p) => p.in === 'query');
        const hasQueryParams = queryParams.length > 0;
        const queryRequired = queryParams.some((p) => Boolean(p.required));

        const hasBody = !!op.requestBody;
        const resBody = hasBody ? resolveRef(spec, op.requestBody) : null;
        const bodyRequired = Boolean(resBody?.required);

        if (hasBody && resBody?.content) {
          const contentTypes = Object.keys(resBody.content);
          if (contentTypes.length > 0 && !contentTypes.includes('application/json')) {
            throw new Error(
              `UNSUPPORTED_REQUEST_CONTENT_TYPE: Operation '${opId}' has unsupported request content types: ${contentTypes.join(', ')}`,
            );
          }
        }

        const responsesMap = op.responses || {};
        const successCodes = Object.keys(responsesMap).filter(
          (c) => c.startsWith('2') || c.startsWith('3'),
        );
        for (const codeStr of successCodes) {
          const respItem = resolveRef(spec, responsesMap[codeStr]);
          const contentMap = respItem?.content;
          if (codeStr === '200' || codeStr === '201') {
            if (contentMap) {
              const keys = Object.keys(contentMap);
              if (keys.length > 0 && !keys.includes('application/json')) {
                throw new Error(
                  `UNSUPPORTED_SUCCESS_RESPONSE: Operation '${opId}' has unsupported response content type for ${codeStr}: ${keys.join(', ')}`,
                );
              }
            }
          } else if (codeStr === '204') {
            // 204 no content
          } else if (
            codeStr === '301' ||
            codeStr === '302' ||
            codeStr === '307' ||
            codeStr === '308'
          ) {
            // redirect
          } else {
            throw new Error(
              `UNSUPPORTED_SUCCESS_RESPONSE: Operation '${opId}' has unsupported success response status code ${codeStr}`,
            );
          }
        }

        const argsList: string[] = [];
        for (const pName of pathParamNames) {
          argsList.push(`${pName}: OperationPath<'${opId}'>['${pName}']`);
        }

        if (hasQueryParams && hasBody) {
          if (queryRequired) {
            argsList.push(`query: OperationQuery<'${opId}'>`);
          } else {
            argsList.push(`query: OperationQuery<'${opId}'> | undefined`);
          }

          if (bodyRequired) {
            argsList.push(`body: OperationBody<'${opId}'>`);
          } else {
            argsList.push(`body?: OperationBody<'${opId}'>`);
          }
        } else if (hasQueryParams) {
          if (queryRequired) {
            argsList.push(`query: OperationQuery<'${opId}'>`);
          } else {
            argsList.push(`query?: OperationQuery<'${opId}'>`);
          }
        } else if (hasBody) {
          if (bodyRequired) {
            argsList.push(`body: OperationBody<'${opId}'>`);
          } else {
            argsList.push(`body?: OperationBody<'${opId}'>`);
          }
        }

        const argsStr = argsList.join(', ');

        let pathExpr = `\`${apiPath}\``;
        for (const pName of pathParamNames) {
          pathExpr = pathExpr.replace(`{${pName}}`, `\${encodeURIComponent(String(${pName}))}`);
        }

        code.push(`  /** ${summary} (${method} ${apiPath}) */`);
        code.push(`  async ${opId}(${argsStr}): Promise<OperationResponse<'${opId}'>> {`);
        code.push(`    return this.transport.request<OperationResponse<'${opId}'>>({`);
        code.push(`      method: '${method}',`);
        code.push(`      path: ${pathExpr},`);
        if (hasQueryParams) {
          code.push(`      query: query as Record<string, unknown> | undefined,`);
        }
        if (hasBody) {
          code.push(`      body: body as unknown,`);
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
