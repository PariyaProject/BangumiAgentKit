import { describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { ProviderRegistry } from '@bangumi-agent-kit/provider-core';
import { createRenderPresentationTools } from '@bangumi-agent-kit/tools';

const context = {
  principalId: 'direct-render-fixture',
  artifactPrincipalKey: 'direct-render-fixture',
  botInstanceId: 'test-bot',
  conversationId: 'test-conversation',
};

function createUnavailableDependencies() {
  const client = new HttpClient({
    fetchFn: vi.fn(async () =>
      new Response(JSON.stringify({ error: 'fixture unavailable' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  });
  const providerRegistry = new ProviderRegistry({
    v0: {
      async getSubject() {
        return { state: 'not_found' as const };
      },
      async getSubjectStats() {
        return { state: 'unavailable' as const };
      },
      async getSubjectIdentity() {
        return { state: 'unavailable' as const };
      },
      async searchSubjects() {
        return { state: 'unavailable' as const };
      },
      async browseSubjects() {
        return { state: 'unavailable' as const };
      },
    } as never,
  });
  const clientProvider = {
    getPublicClient: async () => client,
    getOptionalAuthenticatedClient: async () => client,
    requireAuthenticatedClient: async () => ({
      client,
      account: { id: 'fixture-account', username: 'fixture-user', nickname: 'Fixture' },
    }),
  };
  const artifactStore = {
    saveArtifact: vi.fn(async () => ({
      id: 'fixture-artifact',
      mimeType: 'image/png' as const,
      width: 640,
      height: 320,
    })),
    saveArtifactForPrincipal: vi.fn(async () => ({
      id: 'fixture-private-artifact',
      mimeType: 'image/png' as const,
      width: 640,
      height: 320,
    })),
  };
  const renderService = {
    renderCard: vi.fn(async () => ({
      buffer: Buffer.from('png'),
      width: 640,
      height: 320,
      template: 'fixture',
      templateVersion: 1,
      cacheKey: 'fixture',
      warnings: [],
    })),
  };
  return {
    client,
    providerRegistry,
    clientProvider,
    artifactStore,
    renderService,
    storage: new MemoryStorage(),
  };
}

describe('direct execute coverage for render tools', () => {
  it('executes every remaining render entry point with bounded upstream failure fixtures', async () => {
    const dependencies = createUnavailableDependencies();
    const tools = new Map(
      createRenderPresentationTools(
        dependencies.renderService as never,
        dependencies.artifactStore as never,
      ).map((tool) => [tool.name, tool]),
    );
    const run = async (tool: any, input: Record<string, unknown>, name: string) => {
      let result: any;
      try {
        result = await tool.execute(input, context, dependencies);
      } catch (error) {
        result = error;
      }
      const controlled =
        result instanceof Error
          ? typeof (result as { code?: unknown }).code === 'string'
          : result?.ok === false
            ? typeof result.error?.code === 'string'
            : typeof result?.state === 'string' || result?.artifact !== undefined;
      expect(controlled, name).toBe(true);
    };

    await run(tools.get('bangumi.render_calendar')!, {}, 'bangumi.render_calendar');
    await run(
      tools.get('bangumi.render_character_credit_integrity')!,
      { characterId: 1, maxSubjects: 1, maxPersons: 1 },
      'bangumi.render_character_credit_integrity',
    );
    await run(tools.get('bangumi.render_collection_backlog')!, { maxItems: 1 }, 'bangumi.render_collection_backlog');
    await run(tools.get('bangumi.render_collection_entity_consistency')!, { maxSubjects: 1 }, 'bangumi.render_collection_entity_consistency');
    await run(tools.get('bangumi.render_collection_intelligence')!, { maxItems: 1 }, 'bangumi.render_collection_intelligence');
    await run(tools.get('bangumi.render_collection_schedule')!, { maxRows: 1 }, 'bangumi.render_collection_schedule');
    await run(tools.get('bangumi.render_collection_series_groups')!, { maxItems: 1, maxGroups: 1, maxEdges: 1 }, 'bangumi.render_collection_series_groups');
    await run(tools.get('bangumi.render_episode_guide')!, { subjectId: 1, maxEpisodes: 1 }, 'bangumi.render_episode_guide');
    await run(tools.get('bangumi.render_episode_integrity')!, { subjectId: 1, maxEpisodes: 1 }, 'bangumi.render_episode_integrity');
    await run(tools.get('bangumi.render_latest_subject_revision')!, { subjectId: 1 }, 'bangumi.render_latest_subject_revision');
    await run(tools.get('bangumi.render_person_activity')!, { personId: 1, windowMonths: 3, maxRelations: 1, maxSubjectDetails: 1, maxRows: 1 }, 'bangumi.render_person_activity');
    await run(tools.get('bangumi.render_person_collaboration')!, { personId: 1, maxRelations: 1, maxSubjects: 1, maxCollaborators: 1, maxSharedSubjects: 1 }, 'bangumi.render_person_collaboration');
    await run(tools.get('bangumi.render_person_profile')!, { personId: 1, maxSubjects: 1, maxCharacters: 1, maxCredits: 1 }, 'bangumi.render_person_profile');
    await run(tools.get('bangumi.render_query_subjects')!, { media: 'anime' }, 'bangumi.render_query_subjects');
    await run(tools.get('bangumi.render_revision_timeline')!, { entityType: 'subject', entityId: 1, limit: 1 }, 'bangumi.render_revision_timeline');
    await run(tools.get('bangumi.render_series_watch_order')!, { subjectId: 1, depth: 0, maxNodes: 1 }, 'bangumi.render_series_watch_order');
    await run(tools.get('bangumi.render_subject_card')!, { subjectId: 1 }, 'bangumi.render_subject_card');
    await run(tools.get('bangumi.render_subject_cohort_aggregation')!, { cohort: { query: { media: 'anime', resultMode: 'all' } }, maxSubjects: 1 }, 'bangumi.render_subject_cohort_aggregation');
    await run(tools.get('bangumi.render_subject_cohort_comparison')!, { cohorts: [{ query: { media: 'anime', resultMode: 'all' } }], maxSubjects: 1 }, 'bangumi.render_subject_cohort_comparison');
    await run(tools.get('bangumi.render_subject_comparison')!, { subjectIds: [1, 2], maxCast: 1, maxStaff: 1, maxRelations: 1 }, 'bangumi.render_subject_comparison');
    await run(tools.get('bangumi.render_subject_identity')!, { subjectId: 1 }, 'bangumi.render_subject_identity');
    await run(tools.get('bangumi.render_subject_index_membership')!, { subjectId: 1, indexIds: [1], pageSize: 1, maxPages: 1, maxRows: 1 }, 'bangumi.render_subject_index_membership');
    await run(tools.get('bangumi.render_subject_overlap')!, { subjectIds: [1, 2], maxCast: 1, maxStaff: 1, maxPairs: 1, maxPeople: 1 }, 'bangumi.render_subject_overlap');
    await run(tools.get('bangumi.render_subject_overview')!, { subjectId: 1, maxCast: 1, maxStaff: 1, maxRelations: 1 }, 'bangumi.render_subject_overview');
    await run(tools.get('bangumi.render_subject_stats_history')!, { subjectId: 1 }, 'bangumi.render_subject_stats_history');
    await run(tools.get('bangumi.render_subject_stats_intelligence')!, { subjectId: 1 }, 'bangumi.render_subject_stats_intelligence');
  });
});
