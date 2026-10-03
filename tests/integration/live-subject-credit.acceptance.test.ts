import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { MemoryStorage } from '../../packages/db/src/index.js';
import { HttpClient } from '../../packages/bangumi-transport/src/index.js';
import { ToolRegistry } from '../../packages/tools/src/index.js';
import {
  RenderService,
  buildCastCardViewModel,
  buildSubjectCardViewModel,
  buildSubjectOverviewViewModel,
} from '@bangumi-agent-kit/renderer';

const RUN_LIVE = process.env.BANGUMI_SUBJECT_CREDIT_LIVE === '1';
const SUBJECT_ID = 218707;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe.skipIf(!RUN_LIVE)('current public subject-credit acceptance', () => {
  const storage = new MemoryStorage();
  const httpClient = new HttpClient({ timeoutMs: 12_000 });
  const registry = new ToolRegistry({ storage, publicHttpClient: httpClient });
  const renderService = new RenderService();

  afterAll(async () => {
    await renderService.close();
  });

  it('preserves cast/staff evidence and renders a bounded phone overview', async () => {
    const context = {
      principalId: 'public-subject-credit-acceptance',
      botInstanceId: 'acceptance-probe',
      conversationId: 'subject-credit-public-read',
    };

    const cast = (await registry.executeTool(
      'bangumi.get_subject_cast',
      { subjectId: SUBJECT_ID, limit: 100 },
      context,
    )) as Record<string, unknown>;
    const staff = (await registry.executeTool(
      'bangumi.get_subject_staff',
      { subjectId: SUBJECT_ID, limit: 100 },
      context,
    )) as Record<string, unknown>;
    const overview = (await registry.executeTool(
      'bangumi.get_subject_overview',
      { subjectId: SUBJECT_ID, maxCast: 20, maxStaff: 24, maxRelations: 12 },
      context,
    )) as Record<string, unknown>;

    expect(cast.subjectId).toBe(SUBJECT_ID);
    expect(cast.status).toBe('ok');
    expect(Array.isArray(cast.cast)).toBe(true);
    expect((cast.cast as unknown[]).length).toBeGreaterThan(0);
    const castRows = cast.cast as Array<{
      character: { id: number; name: string };
      relation: string;
      actors: Array<{ id: number; name: string }>;
    }>;
    const actorLinks = castRows.flatMap((row) => row.actors);
    const castIdentityLinksValid =
      castRows.every(
        (row) =>
          Number.isInteger(row.character?.id) &&
          row.character.id > 0 &&
          Boolean(row.character.name) &&
          Boolean(row.relation.trim()),
      ) &&
      actorLinks.length > 0 &&
      actorLinks.every((actor) => Number.isInteger(actor.id) && actor.id > 0 && actor.name);
    expect(castIdentityLinksValid).toBe(true);

    expect(staff.subjectId).toBe(SUBJECT_ID);
    expect(['complete', 'partial']).toContain(staff.state);
    expect(Array.isArray(staff.productionStaff)).toBe(true);
    expect((staff.productionStaff as unknown[]).length).toBeGreaterThan(0);
    const staffRows = staff.productionStaff as Array<{
      id: number;
      relation: string;
      rawRelation?: string;
    }>;
    const groups = staff.groups as Array<{ relation: string; count: number; memberIds: number[] }>;
    const observedStaffIds = new Set(staffRows.map((member) => member.id));
    expect(groups.length).toBeGreaterThan(0);
    const roleMemberLinksValid = groups.every(
      (group) =>
        Boolean(group.relation.trim()) &&
        group.count === group.memberIds.length &&
        group.memberIds.every((id) => observedStaffIds.has(id)),
    );
    expect(roleMemberLinksValid).toBe(true);

    const overviewResult = overview as {
      subjectId: number;
      state: string;
      subject?: { id: number; name: string; nameCn?: string };
      cast: {
        state: string;
        items: Array<{
          character: { id: number; name: string };
          relation: string;
          actors: Array<{ id: number; name: string }>;
        }>;
        coverage: { returned: number; truncated: boolean };
      };
      staff: {
        state: string;
        items: Array<{ id: number; name: string; relation: string; rawRelation?: string }>;
        groups: Array<{ relation: string; count: number; memberIds: number[] }>;
        coverage: { returned: number; truncated: boolean };
      };
      relations: { state: string; items: Array<{ id: number; relation: string }> };
      warnings: unknown[];
      limitations: unknown[];
    };
    expect(overviewResult.subjectId).toBe(SUBJECT_ID);
    expect(overviewResult.subject?.id).toBe(SUBJECT_ID);
    expect(overviewResult.subject?.nameCn || overviewResult.subject?.name).toBeTruthy();
    expect(['complete', 'partial']).toContain(overviewResult.state);
    expect(overviewResult.cast.items.length).toBeLessThanOrEqual(
      overviewResult.cast.coverage.returned,
    );
    expect(overviewResult.cast.items.length).toBeGreaterThan(0);
    expect(
      overviewResult.cast.items.every(
        (item) =>
          Number.isInteger(item.character?.id) &&
          item.character.id > 0 &&
          Boolean(item.character.name) &&
          Boolean(item.relation.trim()),
      ),
    ).toBe(true);
    expect(overviewResult.cast.items.flatMap((item) => item.actors).length).toBeGreaterThan(0);
    expect(overviewResult.staff.items.length).toBeLessThanOrEqual(
      overviewResult.staff.coverage.returned,
    );
    expect(overviewResult.staff.groups.every((group) => Boolean(group.relation.trim()))).toBe(true);
    const overviewStaffIds = new Set(overviewResult.staff.items.map((member) => member.id));
    expect(
      overviewResult.staff.groups.every((group) => group.count === group.memberIds.length),
    ).toBe(true);
    expect(
      overviewResult.staff.groups
        .flatMap((group) => group.memberIds)
        .every((memberId) => Number.isInteger(memberId) && overviewStaffIds.has(memberId)),
    ).toBe(true);
    expect(
      overviewResult.staff.items.every(
        (member) => Number.isInteger(member.id) && member.id > 0 && Boolean(member.name),
      ),
    ).toBe(true);
    expect(overviewResult.relations.items.every((item) => Boolean(item.relation.trim()))).toBe(
      true,
    );

    const viewModel = buildSubjectOverviewViewModel(overviewResult as never);
    const renderOptions = {
      width: 360,
      deviceScaleFactor: 2,
    } as const;
    const subjectCard = await renderService.renderCard(
      buildSubjectCardViewModel(overviewResult.subject as never),
      renderOptions,
    );
    const castCard = await renderService.renderCard(
      buildCastCardViewModel(
        {
          id: SUBJECT_ID,
          name: overviewResult.subject?.name || '少女終末旅行',
          nameCn: overviewResult.subject?.nameCn,
        },
        cast.cast as never,
      ),
      renderOptions,
    );
    const overviewCard = await renderService.renderCard(viewModel, renderOptions);
    const artifacts = [subjectCard, castCard, overviewCard];
    for (const artifact of artifacts) {
      expect(artifact.width).toBe(720);
      expect(artifact.height).toBeLessThanOrEqual(8192);
      expect(artifact.buffer.subarray(0, 8)).toEqual(PNG_MAGIC);
    }

    const summary = {
      source: 'official-v0 through ToolRegistry',
      subjectId: SUBJECT_ID,
      tools: {
        get_subject_cast: {
          status: cast.status,
          rows: (cast.cast as unknown[]).length,
          actorLinks: actorLinks.length,
          identityLinksValid: castIdentityLinksValid,
          observed: cast.observed,
          returned: cast.returned,
          truncated: cast.truncated,
        },
        get_subject_staff: {
          state: staff.state,
          rows: staffRows.length,
          rawRoleGroupCount: groups.length,
          roleLabels: groups.map((group) => group.relation),
          roleMemberLinksValid,
          observed: staff.observed,
          returned: staff.returned,
          truncated: staff.truncated,
        },
        get_subject_overview: {
          state: overviewResult.state,
          castState: overviewResult.cast.state,
          castRows: overviewResult.cast.items.length,
          castActorLinks: overviewResult.cast.items.flatMap((item) => item.actors).length,
          castTruncated: overviewResult.cast.coverage.truncated,
          staffState: overviewResult.staff.state,
          staffGroups: overviewResult.staff.groups.length,
          staffMembers: overviewResult.staff.items.length,
          staffTruncated: overviewResult.staff.coverage.truncated,
          relationsState: overviewResult.relations.state,
          relationRows: overviewResult.relations.items.length,
          warningCount: overviewResult.warnings.length,
          limitationCount: overviewResult.limitations.length,
        },
      },
      artifacts: Object.fromEntries(
        artifacts.map((artifact) => [
          artifact.template,
          {
            width: artifact.width,
            height: artifact.height,
            bytes: artifact.buffer.length,
            mimeType: artifact.mimeType,
            sha256: createHash('sha256').update(artifact.buffer).digest('hex'),
          },
        ]),
      ),
      oauthUsed: false,
      accountDataUsed: false,
      qqOrTimUsed: false,
    };

    const outputDirectory = process.env.SUBJECT_CREDIT_ACCEPTANCE_DIR;
    if (outputDirectory) {
      await mkdir(outputDirectory, { recursive: true });
      await Promise.all([
        writeFile(join(outputDirectory, 'subject-card-360.png'), subjectCard.buffer),
        writeFile(join(outputDirectory, 'cast-card-360.png'), castCard.buffer),
        writeFile(join(outputDirectory, 'subject-overview-360.png'), overviewCard.buffer),
      ]);
      await writeFile(
        join(outputDirectory, 'summary.json'),
        `${JSON.stringify(summary, null, 2)}\n`,
      );
    }
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  }, 120_000);
});
