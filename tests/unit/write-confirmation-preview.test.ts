import { afterEach, describe, expect, it, vi } from 'vitest';
import { encryptToken } from '@bangumi-agent-kit/auth';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  getUserFacingToolDescription,
  ToolRegistry,
  createRuntimeDependencies,
} from '@bangumi-agent-kit/tools';
import { toMcpTool } from '../../apps/mcp/src/catalog.js';

const SECRET_KEY = 'write-confirmation-preview-test-secret';
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function readResponse(pathname: string) {
  if (pathname.includes('/collections/10') && !pathname.includes('/episodes/')) {
    return {
      subject_id: 10,
      type: 2,
      rate: 7,
      tags: ['old'],
      comment: 'old comment',
      subject: { name: 'Fixture Subject', name_cn: '测试条目', type: 2 },
    };
  }
  if (pathname.includes('/episodes/')) return { type: 0 };
  if (pathname.includes('/characters/20')) {
    return { id: 20, name: 'Fixture Character', type: 1, created_at: '2026-01-01' };
  }
  if (pathname.includes('/persons/21')) {
    return { id: 21, name: 'Fixture Person', type: 1, career: [], created_at: '2026-01-01' };
  }
  if (pathname === '/v0/indices/30') {
    return { id: 30, title: 'Fixture Index', desc: 'old description', total: 1 };
  }
  if (pathname === '/v0/indices/30/subjects') {
    return {
      data: [
        { id: 40, name: 'Fixture Subject', name_cn: '测试条目', order: 1, comment: 'old note' },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    };
  }
  return {};
}

async function addAccount(
  storage: MemoryStorage,
  principalId: string,
  id: string,
  username: string,
  bangumiUserId: number,
) {
  const account = await storage.upsertBangumiAccount({
    id,
    bangumiUserId,
    username,
    nickname: `${username} fixture`,
  });
  await storage.replaceActiveBinding(principalId, account.id);
  await storage.upsertCredential({
    id: `credential-${id}`,
    bangumiAccountId: account.id,
    encryptedAccessToken: encryptToken(`token-${id}`, SECRET_KEY, 'v1'),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    requestedCapabilities: ['write:collection', 'write:indices'],
    reportedScopes: ['write:collection', 'write:indices'],
    scopeEvidence: 'reported',
    keyVersion: 'v1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return account;
}

async function setup(fetchFn: typeof fetch) {
  const storage = new MemoryStorage();
  const principal = await storage.findOrCreatePrincipal({
    provider: 'local-mcp',
    botInstanceId: 'fixture-bot',
    externalUserId: 'fixture-user',
  });
  await addAccount(storage, principal.id, 'account-a', 'fixture_a', 101);
  const registry = new ToolRegistry(
    createRuntimeDependencies({
      storage,
      publicHttpClient: new HttpClient({ fetchFn }),
      secretKey: SECRET_KEY,
    }),
  );
  return { registry, storage, principal };
}

function confirmationId(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const id = message.match(/Confirmation ID: (\S+)/u)?.[1];
  expect(id).toMatch(/^cfm_/u);
  return id!;
}

describe('account write confirmation previews', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('exposes confirmation policy in client tool descriptions without changing read/raw tools', async () => {
    const { registry } = await setup(async () => new Response('{}', { status: 200 }));
    const updateEpisode = registry.getTool('bangumi.update_episode_progress')!;
    const rawOperation = registry.getTool('bangumi.call_operation')!;
    const readTool = registry.getTool('bangumi.get_subject')!;

    const userFacing = getUserFacingToolDescription(updateEpisode);
    expect(userFacing).toContain('每次账户内容写入都必须');
    expect(userFacing).not.toContain('超过 20 集的大批量变更将自动要求二次确认');
    expect(toMcpTool(updateEpisode).description).toBe(userFacing);
    expect(getUserFacingToolDescription(rawOperation)).toBe(rawOperation.description);
    expect(getUserFacingToolDescription(readTool)).toBe(readTool.description);
  });

  it('requires a preview-bound confirmation before every account-content write action', async () => {
    const calls: Array<{ pathname: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method || 'GET';
      calls.push({ pathname: url.pathname, method });
      if (WRITE_METHODS.has(method)) return new Response(null, { status: 204 });
      return new Response(JSON.stringify(readResponse(url.pathname)), { status: 200 });
    };
    const { registry, storage, principal } = await setup(fetchFn);
    const unpreviewableContentWrites = registry
      .getTools()
      .filter(
        (tool) =>
          tool.name !== 'bangumi.call_operation' &&
          tool.risk !== 'read' &&
          tool.scopes.some((scope) => scope === 'write:collection' || scope === 'write:indices') &&
          !tool.prepareConfirmation,
      );
    expect(unpreviewableContentWrites).toEqual([]);
    const actions: Array<{
      toolName: string;
      input: Record<string, unknown>;
      expectedSummary: string[];
    }> = [
      {
        toolName: 'bangumi.update_collection',
        input: { subjectId: 10, status: 'doing' },
        expectedSummary: ['old comment', 'doing'],
      },
      {
        toolName: 'bangumi.update_episode_progress',
        input: { subjectId: 10, episodeIds: [1, 2] },
        expectedSummary: ['uncollected', 'watched'],
      },
      {
        toolName: 'bangumi.manage_character_collection',
        input: { characterId: 20, action: 'collect' },
        expectedSummary: ['Fixture Character', 'collected'],
      },
      {
        toolName: 'bangumi.manage_character_collection',
        input: { characterId: 20, action: 'uncollect' },
        expectedSummary: ['Fixture Character', 'not_collected'],
      },
      {
        toolName: 'bangumi.manage_person_collection',
        input: { personId: 21, action: 'collect' },
        expectedSummary: ['Fixture Person', 'collected'],
      },
      {
        toolName: 'bangumi.manage_person_collection',
        input: { personId: 21, action: 'uncollect' },
        expectedSummary: ['Fixture Person', 'not_collected'],
      },
      {
        toolName: 'bangumi.manage_index',
        input: { action: 'create', title: 'New Index' },
        expectedSummary: ['New Index', '当前不存在'],
      },
      {
        toolName: 'bangumi.manage_index',
        input: { action: 'edit', indexId: 30, title: 'New Title' },
        expectedSummary: ['Fixture Index', 'old description', 'New Title'],
      },
      {
        toolName: 'bangumi.manage_index',
        input: { action: 'add_subject', indexId: 30, subjectId: 40 },
        expectedSummary: ['测试条目', 'old note', 'present'],
      },
      {
        toolName: 'bangumi.manage_index',
        input: { action: 'remove_subject', indexId: 30, subjectId: 40 },
        expectedSummary: ['测试条目', 'old note', 'present'],
      },
    ];

    for (const action of actions) {
      const error = await registry
        .executeTool(action.toolName, action.input, {
          principalId: principal.id,
          botInstanceId: 'fixture-bot',
          conversationId: `preview-${action.toolName}-${JSON.stringify(action.input)}`,
        })
        .then(
          () => undefined,
          (caught: unknown) => caught as { code?: string; message?: string },
        );
      expect(error?.code, `${action.toolName} ${JSON.stringify(action.input)}`).toBe(
        'CONFIRMATION_REQUIRED',
      );
      expect(error?.message).toContain('fixture_a');
      for (const expected of action.expectedSummary) expect(error?.message).toContain(expected);
    }

    expect(calls.filter((call) => WRITE_METHODS.has(call.method))).toEqual([]);
    expect(storage.getAuditEvents()).toHaveLength(0);
  });

  it('rejects confirmation after the active Bangumi account changes', async () => {
    const calls: Array<{ pathname: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method || 'GET';
      calls.push({ pathname: url.pathname, method });
      return new Response(JSON.stringify(readResponse(url.pathname)), { status: 200 });
    };
    const { registry, storage, principal } = await setup(fetchFn);
    const input = { subjectId: 10, status: 'doing' };
    const context = {
      principalId: principal.id,
      botInstanceId: 'fixture-bot',
      conversationId: 'account-switch',
    };
    const preview = await registry.executeTool('bangumi.update_collection', input, context).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect((preview as { code?: string }).code).toBe('CONFIRMATION_REQUIRED');
    const id = confirmationId(preview);
    await addAccount(storage, principal.id, 'account-b', 'fixture_b', 202);

    await expect(
      registry.executeTool('bangumi.update_collection', input, { ...context, confirmationId: id }),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_INVALID' });
    expect(calls.filter((call) => WRITE_METHODS.has(call.method))).toEqual([]);
  });

  it('rejects confirmation after the request payload changes', async () => {
    const calls: Array<{ pathname: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method || 'GET';
      calls.push({ pathname: url.pathname, method });
      return new Response(JSON.stringify(readResponse(url.pathname)), { status: 200 });
    };
    const { registry, principal } = await setup(fetchFn);
    const context = {
      principalId: principal.id,
      botInstanceId: 'fixture-bot',
      conversationId: 'payload-change',
    };
    const preview = await registry
      .executeTool('bangumi.update_collection', { subjectId: 10, status: 'doing' }, context)
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    expect((preview as { code?: string }).code).toBe('CONFIRMATION_REQUIRED');
    const id = confirmationId(preview);

    await expect(
      registry.executeTool(
        'bangumi.update_collection',
        { subjectId: 10, status: 'dropped' },
        { ...context, confirmationId: id },
      ),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_INVALID' });
    expect(calls.filter((call) => WRITE_METHODS.has(call.method))).toEqual([]);
  });

  it('rejects confirmation after the previewed current state changes', async () => {
    const calls: Array<{ pathname: string; method: string }> = [];
    let currentType = 2;
    let collectionReads = 0;
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method || 'GET';
      calls.push({ pathname: url.pathname, method });
      if (url.pathname === '/v0/users/fixture_a/collections/10') {
        collectionReads += 1;
        if (collectionReads > 1) currentType = 3;
        return new Response(JSON.stringify({ ...readResponse(url.pathname), type: currentType }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify(readResponse(url.pathname)), { status: 200 });
    };
    const { registry, principal } = await setup(fetchFn);
    const context = {
      principalId: principal.id,
      botInstanceId: 'fixture-bot',
      conversationId: 'state-change',
    };
    const input = { subjectId: 10, status: 'doing' };
    const preview = await registry.executeTool('bangumi.update_collection', input, context).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect((preview as { code?: string }).code).toBe('CONFIRMATION_REQUIRED');
    const id = confirmationId(preview);

    await expect(
      registry.executeTool('bangumi.update_collection', input, { ...context, confirmationId: id }),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_INVALID' });
    expect(calls.filter((call) => WRITE_METHODS.has(call.method))).toEqual([]);
  });

  it('fails closed when the current collection status is unknown', async () => {
    const calls: Array<{ pathname: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method || 'GET';
      calls.push({ pathname: url.pathname, method });
      return new Response(
        JSON.stringify({
          subject_id: 10,
          type: 99,
          subject: { name: 'Fixture Subject', name_cn: '测试条目', type: 2 },
        }),
        { status: 200 },
      );
    };
    const { registry, storage, principal } = await setup(fetchFn);

    await expect(
      registry.executeTool(
        'bangumi.update_collection',
        { subjectId: 10, status: 'doing' },
        {
          principalId: principal.id,
          botInstanceId: 'fixture-bot',
          conversationId: 'unknown-collection-state',
        },
      ),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_PREVIEW_UNAVAILABLE' });
    expect(storage.getPendingActions()).toHaveLength(0);
    expect(calls.filter((call) => WRITE_METHODS.has(call.method))).toEqual([]);
  });

  it('fails closed when any episode current status is unknown', async () => {
    const calls: Array<{ pathname: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method || 'GET';
      calls.push({ pathname: url.pathname, method });
      if (url.pathname.includes('/episodes/')) {
        return new Response(JSON.stringify({ type: 99 }), { status: 200 });
      }
      return new Response(JSON.stringify(readResponse(url.pathname)), { status: 200 });
    };
    const { registry, storage, principal } = await setup(fetchFn);

    await expect(
      registry.executeTool(
        'bangumi.update_episode_progress',
        { subjectId: 10, episodeIds: [1] },
        {
          principalId: principal.id,
          botInstanceId: 'fixture-bot',
          conversationId: 'unknown-episode-state',
        },
      ),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_PREVIEW_UNAVAILABLE' });
    expect(storage.getPendingActions()).toHaveLength(0);
    expect(calls.filter((call) => WRITE_METHODS.has(call.method))).toEqual([]);
  });

  it('rejects an unsupported legacy episode status before reading a preview', async () => {
    const calls: Array<{ pathname: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      calls.push({ pathname: url.pathname, method: init?.method || 'GET' });
      return new Response(JSON.stringify(readResponse(url.pathname)), { status: 200 });
    };
    const { registry, storage, principal } = await setup(fetchFn);

    await expect(
      registry.executeTool(
        'bangumi.update_episode_progress',
        { subjectId: 10, episodeIds: [1], type: 9 },
        {
          principalId: principal.id,
          botInstanceId: 'fixture-bot',
          conversationId: 'invalid-legacy-episode-status',
        },
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(calls).toEqual([]);
    expect(storage.getPendingActions()).toHaveLength(0);
  });

  it('uses the explicit episode status when deprecated type conflicts', async () => {
    const calls: Array<{ pathname: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      calls.push({ pathname: url.pathname, method: init?.method || 'GET' });
      if (url.pathname.includes('/episodes/')) {
        return new Response(JSON.stringify({ type: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify(readResponse(url.pathname)), { status: 200 });
    };
    const { registry, principal } = await setup(fetchFn);

    const error = await registry
      .executeTool(
        'bangumi.update_episode_progress',
        { subjectId: 10, episodeIds: [1], status: 'watched', type: 3 },
        {
          principalId: principal.id,
          botInstanceId: 'fixture-bot',
          conversationId: 'status-overrides-deprecated-type',
        },
      )
      .then(
        () => undefined,
        (caught: unknown) => caught as { code?: string; message?: string },
      );

    expect(error?.code).toBe('CONFIRMATION_REQUIRED');
    expect(error?.message).toContain('请求状态 "watched"');
    expect(calls.filter((call) => WRITE_METHODS.has(call.method))).toEqual([]);
  });

  it('fails closed before confirmation when a through-N target resolves only a prefix', async () => {
    const calls: Array<{ pathname: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method || 'GET';
      calls.push({ pathname: url.pathname, method });
      if (url.pathname === '/v0/episodes') {
        return new Response(
          JSON.stringify({
            data: [
              { id: 1, type: 0, sort: 1, ep: 1, name: 'Episode 1' },
              { id: 2, type: 0, sort: 2, ep: 2, name: 'Episode 2' },
            ],
            total: 2,
            limit: 100,
            offset: 0,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify(readResponse(url.pathname)), { status: 200 });
    };
    const { registry, storage, principal } = await setup(fetchFn);

    await expect(
      registry.executeTool(
        'bangumi.update_episode_progress',
        { subjectId: 10, target: { kind: 'through', episodeNumber: 3 } },
        {
          principalId: principal.id,
          botInstanceId: 'fixture-bot',
          conversationId: 'partial-through-target',
        },
      ),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_PREVIEW_UNAVAILABLE' });
    expect(calls.some((call) => call.pathname.includes('/episodes/'))).toBe(false);
    expect(storage.getPendingActions()).toHaveLength(0);
    expect(calls.filter((call) => WRITE_METHODS.has(call.method))).toEqual([]);
  });

  it('scans directory membership until an authoritative empty page before previewing absence', async () => {
    const subjectPages: number[] = [];
    const calls: Array<{ pathname: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method || 'GET';
      calls.push({ pathname: url.pathname, method });
      if (url.pathname === '/v0/indices/30/subjects') {
        const offset = Number(url.searchParams.get('offset') || 0);
        subjectPages.push(offset);
        const data =
          offset === 0
            ? Array.from({ length: 20 }, (_, index) => ({
                id: index + 100,
                name: `Subject ${index + 100}`,
                name_cn: '',
                order: index,
              }))
            : [];
        return new Response(JSON.stringify({ data }), { status: 200 });
      }
      return new Response(JSON.stringify(readResponse(url.pathname)), { status: 200 });
    };
    const { registry, principal } = await setup(fetchFn);
    const error = await registry
      .executeTool(
        'bangumi.manage_index',
        { action: 'add_subject', indexId: 30, subjectId: 999 },
        {
          principalId: principal.id,
          botInstanceId: 'fixture-bot',
          conversationId: 'complete-index-scan',
        },
      )
      .then(
        () => undefined,
        (caught: unknown) => caught as { code?: string; message?: string },
      );

    expect(error?.code).toBe('CONFIRMATION_REQUIRED');
    expect(subjectPages).toEqual([0, 20]);
    expect(error?.message).toContain('当前状态');
    expect(calls.filter((call) => WRITE_METHODS.has(call.method))).toEqual([]);
  });

  it('rejects confirmation when a displayed directory title changes', async () => {
    let indexTitle = 'Fixture Index';
    const calls: Array<{ pathname: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method || 'GET';
      calls.push({ pathname: url.pathname, method });
      if (url.pathname === '/v0/indices/30') {
        return new Response(
          JSON.stringify({ id: 30, title: indexTitle, desc: 'old description', total: 1 }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify(readResponse(url.pathname)), { status: 200 });
    };
    const { registry, principal } = await setup(fetchFn);
    const context = {
      principalId: principal.id,
      botInstanceId: 'fixture-bot',
      conversationId: 'index-title-change',
    };
    const input = { action: 'add_subject', indexId: 30, subjectId: 40 };
    const preview = await registry.executeTool('bangumi.manage_index', input, context).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect((preview as { code?: string }).code).toBe('CONFIRMATION_REQUIRED');
    const id = confirmationId(preview);
    indexTitle = 'Renamed Index';

    await expect(
      registry.executeTool('bangumi.manage_index', input, { ...context, confirmationId: id }),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_INVALID' });
    expect(calls.filter((call) => WRITE_METHODS.has(call.method))).toEqual([]);
  });

  it('fails closed when directory paging contradicts its reported total', async () => {
    const calls: Array<{ pathname: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method || 'GET';
      calls.push({ pathname: url.pathname, method });
      if (url.pathname === '/v0/indices/30/subjects') {
        return new Response(JSON.stringify({ data: [], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify(readResponse(url.pathname)), { status: 200 });
    };
    const { registry, principal, storage } = await setup(fetchFn);

    await expect(
      registry.executeTool(
        'bangumi.manage_index',
        { action: 'add_subject', indexId: 30, subjectId: 999 },
        {
          principalId: principal.id,
          botInstanceId: 'fixture-bot',
          conversationId: 'contradictory-index-total',
        },
      ),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_PREVIEW_UNAVAILABLE' });
    expect(storage.getPendingActions()).toHaveLength(0);
    expect(calls.filter((call) => WRITE_METHODS.has(call.method))).toEqual([]);
  });

  it('fails closed when a directory row has no valid resource identity', async () => {
    const calls: Array<{ pathname: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method || 'GET';
      calls.push({ pathname: url.pathname, method });
      if (url.pathname === '/v0/indices/30/subjects') {
        return new Response(JSON.stringify({ data: [{ id: 'unknown' }], total: 1 }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify(readResponse(url.pathname)), { status: 200 });
    };
    const { registry, principal, storage } = await setup(fetchFn);

    await expect(
      registry.executeTool(
        'bangumi.manage_index',
        { action: 'add_subject', indexId: 30, subjectId: 999 },
        {
          principalId: principal.id,
          botInstanceId: 'fixture-bot',
          conversationId: 'invalid-index-row',
        },
      ),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_PREVIEW_UNAVAILABLE' });
    expect(storage.getPendingActions()).toHaveLength(0);
    expect(calls.filter((call) => WRITE_METHODS.has(call.method))).toEqual([]);
  });

  it('fails closed when an index response omits its description', async () => {
    const calls: Array<{ pathname: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method || 'GET';
      calls.push({ pathname: url.pathname, method });
      if (url.pathname === '/v0/indices/30') {
        return new Response(JSON.stringify({ id: 30, title: 'Synthetic index' }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify(readResponse(url.pathname)), { status: 200 });
    };
    const { registry, principal, storage } = await setup(fetchFn);

    await expect(
      registry.executeTool(
        'bangumi.manage_index',
        { action: 'edit', indexId: 30, title: 'Updated title' },
        {
          principalId: principal.id,
          botInstanceId: 'fixture-bot',
          conversationId: 'missing-index-description',
        },
      ),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_PREVIEW_UNAVAILABLE' });
    expect(storage.getPendingActions()).toHaveLength(0);
    expect(calls.filter((call) => WRITE_METHODS.has(call.method))).toEqual([]);
  });
});
