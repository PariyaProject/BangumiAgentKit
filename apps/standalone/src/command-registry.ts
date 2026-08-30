import { z } from 'zod';
import { ToolDefinition } from '@bangumi-agent-kit/tools';
import { StandaloneHost } from './standalone-host.js';
import { CliFlags } from './command-parser.js';
import { StandaloneCliError } from './errors.js';
import { Presenter } from './presenter.js';

export interface StandaloneCommandContext {
  host: StandaloneHost;
  flags: CliFlags;
  presenter: Presenter;
  confirm: (details: {
    confirmationId: string;
    summary: string;
    message: string;
  }) => Promise<boolean>;
}

export interface CommandResult {
  value: unknown;
  exit?: boolean;
}

const HELP_TEXT = `BangumiAgentKit Standalone v0.1

General:
  help                         Show this help
  status                       Show local runtime status
  provider status              Show provider readiness and source policy
  provider explain subject <id>  Explain subject evidence (safe metadata only)
  doctor                       Run local diagnostics
  version                      Show version
  clear                        Clear the terminal
  exit | quit                  Exit

Bangumi:
  search <query> [--type anime] [--limit 5]
  discover [--media anime] [--season 2026-summer] [--concept 后宫]
           [--sort heat|score|rank|date] [--limit 20] [--all] [--explain]
  subject <id>
  subject-identity <subjectId>
  subject-index-membership <subjectId> --index <indexId> [--index <indexId> ...]
                            [--page-size 1..50] [--max-pages 1..8] [--max-rows 1..400]
  revision-latest <subjectId>
  stats <subjectId>
  stats-history <subjectId> [--record-current] [--max-observations 1..120]
               [--retention-days 1..3650]
  overview <subjectId> [--max-cast 1..20] [--max-staff 1..80] [--max-relations 1..32]
  compare <subjectIdA> <subjectIdB> [--max-cast 1..20] [--max-staff 1..80] [--max-relations 1..32]
  compare-cohorts --a-query '<json>' --b-query '<json>' [--a-label <label>] [--b-label <label>]
                  [--max-subjects 1..60]
  aggregate-cohort --query '<json>' [--label <label>] [--max-subjects 1..60]
  overlap <subjectId...> [--kind cast|staff|all] [--cast-role all|main]
          [--max-cast 1..80] [--max-staff 1..80] [--max-pairs 1..28] [--max-people 1..24]
  watch-order <subjectId> [--depth 0|1|2] [--max-nodes 1..16] [--media anime|all]
  cast <subjectId>
  character-integrity <characterId> [--max-subjects 1..64] [--max-persons 1..64]
  person <personId>
  activity <personId> [--kind voice|staff|all] [--media tv|anime|all]
           [--staff-role director] [--months 3|6|12|36] [--max-relations 1..120]
           [--max-details 1..48] [--max-rows 1..60] [--compare-previous]
  collaborators <personId> [--kind voice|staff|all] [--media anime|all]
               [--target-role <label>] [--collaborator-role <label>]
               [--max-relations 1..120] [--max-subjects 1..36]
               [--max-collaborators 1..50] [--max-shared-subjects 1..20]
  staff <subjectId>
  calendar [--weekday 1..7] [--max-per-day 1..8] [--max-total 1..56]
           官方日历；首播日期是首播日期证据，不是具体播出时刻；时区未由源提供；顺序不等同于推荐
  episodes <subjectId>
  episode-guide <subjectId> [--category all|main|sp|op|ed|pv|mad|other]
                [--max-episodes 1..200] [--no-descriptions]
  episode-integrity <subjectId> [--category all|main|sp|op|ed|pv|mad|other]
                   [--max-episodes 1..200] [--as-of-date YYYY-MM-DD] [--no-descriptions]
  collection status <subjectId>
  collection intelligence [--max-items 1..200]
  collection dashboard [--max-items 1..100] [--max-subjects 1..30]
                      [--max-episodes 1..1000] [--max-rows 1..100]
                      [--timeout-ms 1000..120000] [--status wish,doing,on_hold]
  collection backlog [--max-items 1..100] [--max-subjects 1..30]
                    [--max-episodes 1..1000] [--status wish,doing,on_hold]
                    [--sort source|estimated-minutes-asc|estimated-minutes-desc]
  collection schedule [--max-items 1..200] [--max-rows 1..100]
                      [--status wish,doing,done,on_hold,dropped]
  collection series [--max-items 1..100] [--max-relation-subjects 1..36]
                    [--max-relations-per-subject 1..96] [--max-groups 1..36]
                    [--max-edges 1..144] [--status wish,doing,done,on_hold,dropped]
  collection consistency [--subject-type book|anime|music|game|real]
                       [--status wish|doing|done|on_hold|dropped]
                       [--max-subjects 1..24] [--max-pages 1..8]
                       [--max-relations 1..80] [--max-output 1..60]
  collection list
  collection set <subjectId> <status>

Auth:
  auth status | login | accounts
  auth switch <accountId-or-index>
  auth remove <accountId-or-index>

Renderer:
  render subject|subject-identity|revision-latest|stats|stats-history|overview|compare|compare-cohorts|aggregate-cohort|overlap|watch-order|cast|character-integrity|person|activity|collaboration|episode-guide|episode-integrity|calendar|revision|search|collection|collection-backlog|collection-schedule|collection-dashboard|collection-series|collection-consistency|subject-index-membership <args> [--output <path>] [--force]

Developer playground:
  tool list
  tool describe <tool>
  tool call bangumi.search_subjects '{"query":"少女终末旅行"}' [--confirm <id>]

Non-interactive flags:
  --json       Emit JSON only to stdout
  --profile    Select the persistent Standalone profile (default: default)
  --verbose    Include diagnostic identifiers
  --confirm    Continue an exact previously-confirmation-gated operation

Exit codes: 0 success, 1 runtime failure, 2 usage/validation, 3 auth required,
4 confirmation required, 5 renderer unavailable.`;

function requireArg(value: string | undefined, description: string): string {
  if (!value) throw new StandaloneCliError(`USAGE_ERROR: ${description} is required.`, 2);
  return value;
}

function parsePositiveInteger(value: string | undefined, description: string): number {
  const parsed = Number(requireArg(value, description));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new StandaloneCliError(`USAGE_ERROR: ${description} must be a positive integer.`, 2);
  }
  return parsed;
}

function parseNonNegativeInteger(value: string | undefined, description: string): number {
  const parsed = Number(requireArg(value, description));
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new StandaloneCliError(`USAGE_ERROR: ${description} must be a non-negative integer.`, 2);
  }
  return parsed;
}

function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new StandaloneCliError(`USAGE_ERROR: ${name} requires a value.`, 2);
  }
  return value;
}

function withoutOptions(args: string[], names: string[]): string[] {
  const result: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg && names.includes(arg)) {
      index += 1;
      continue;
    }
    result.push(arg as string);
  }
  return result;
}

function parseCalendarOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  const optionNames = new Set(['--weekday', '--max-per-day', '--max-total']);
  const seen = new Set<string>();

  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    if (!name || !optionNames.has(name)) {
      throw new StandaloneCliError(`USAGE_ERROR: unknown calendar argument "${name || ''}".`, 2);
    }
    if (seen.has(name)) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} may only be specified once.`, 2);
    }
    seen.add(name);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} requires a value.`, 2);
    }
    if (name === '--weekday') input.weekday = optionNumber(value, 'weekday', true, 1, 7);
    if (name === '--max-per-day') {
      input.maxPerDay = optionNumber(value, 'max-per-day', true, 1, 8);
    }
    if (name === '--max-total') input.maxTotal = optionNumber(value, 'max-total', true, 1, 56);
  }

  return input;
}

function parseSubjectIndexMembershipOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {
    subjectId: parsePositiveInteger(args[0], 'subject id'),
  };
  const indexIds: number[] = [];
  const optionNames = new Set(['--index', '--page-size', '--max-pages', '--max-rows']);
  const seen = new Set<string>();
  for (let index = 1; index < args.length; index += 1) {
    const name = args[index];
    if (!name || !optionNames.has(name)) {
      throw new StandaloneCliError(
        `USAGE_ERROR: unknown subject-index-membership argument "${name || ''}".`,
        2,
      );
    }
    if (name === '--index') {
      const value = args[++index];
      if (!value || value.startsWith('--')) {
        throw new StandaloneCliError('USAGE_ERROR: --index requires a value.', 2);
      }
      indexIds.push(parsePositiveInteger(value, 'index id'));
      continue;
    }
    if (seen.has(name)) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} may only be specified once.`, 2);
    }
    seen.add(name);
    const value = args[++index];
    if (!value || value.startsWith('--')) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} requires a value.`, 2);
    }
    if (name === '--page-size') {
      input.pageSize = optionNumber(value, 'page-size', true, 1, 50);
    } else if (name === '--max-pages') {
      input.maxPages = optionNumber(value, 'max-pages', true, 1, 8);
    } else {
      input.maxRows = optionNumber(value, 'max-rows', true, 1, 400);
    }
  }
  if (indexIds.length === 0) {
    throw new StandaloneCliError('USAGE_ERROR: at least one --index is required.', 2);
  }
  input.indexIds = indexIds;
  return input;
}

function parsePersonActivityOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {
    personId: parsePositiveInteger(args[0], 'person id'),
  };
  const kind = takeOption(args, '--kind');
  const media = takeOption(args, '--media');
  const staffRole = takeOption(args, '--staff-role');
  const months = takeOption(args, '--months');
  const maxRelations = takeOption(args, '--max-relations');
  const maxDetails = takeOption(args, '--max-details');
  const maxRows = takeOption(args, '--max-rows');
  const comparePrevious = args.includes('--compare-previous');
  if (kind !== undefined) {
    if (kind !== 'voice' && kind !== 'staff' && kind !== 'all') {
      throw new StandaloneCliError('USAGE_ERROR: --kind must be voice, staff, or all.', 2);
    }
    input.kind = kind;
  }
  if (media !== undefined) {
    if (media !== 'tv' && media !== 'anime' && media !== 'all') {
      throw new StandaloneCliError('USAGE_ERROR: --media must be tv, anime, or all.', 2);
    }
    input.media = media;
  }
  if (staffRole !== undefined) {
    if (staffRole !== 'director') {
      throw new StandaloneCliError('USAGE_ERROR: --staff-role must be director.', 2);
    }
    input.staffRole = staffRole;
  }
  if (months !== undefined) {
    const parsed = parsePositiveInteger(months, 'months');
    if (parsed !== 3 && parsed !== 6 && parsed !== 12 && parsed !== 36) {
      throw new StandaloneCliError('USAGE_ERROR: --months must be 3, 6, 12, or 36.', 2);
    }
    input.windowMonths = parsed;
  }
  if (maxRelations !== undefined)
    input.maxRelations = optionNumber(maxRelations, 'max-relations', true);
  if (maxDetails !== undefined)
    input.maxSubjectDetails = optionNumber(maxDetails, 'max-details', true);
  if (maxRows !== undefined) input.maxRows = optionNumber(maxRows, 'max-rows', true);
  if (comparePrevious) input.comparePreviousWindow = true;
  return input;
}

function parsePersonCollaborationOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {
    personId: parsePositiveInteger(args[0], 'person id'),
  };
  const optionNames = new Set([
    '--kind',
    '--media',
    '--target-role',
    '--collaborator-role',
    '--max-relations',
    '--max-subjects',
    '--max-collaborators',
    '--max-shared-subjects',
  ]);
  const seen = new Set<string>();
  for (let index = 1; index < args.length; index += 1) {
    const name = args[index];
    if (!name || !optionNames.has(name)) {
      throw new StandaloneCliError(
        `USAGE_ERROR: unknown collaborators argument "${name || ''}".`,
        2,
      );
    }
    if (seen.has(name)) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} may only be specified once.`, 2);
    }
    seen.add(name);
    const value = args[++index];
    if (!value || value.startsWith('--')) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} requires a value.`, 2);
    }
    if (name === '--kind') {
      if (value !== 'voice' && value !== 'staff' && value !== 'all') {
        throw new StandaloneCliError('USAGE_ERROR: --kind must be voice, staff, or all.', 2);
      }
      input.kind = value;
    } else if (name === '--media') {
      if (value !== 'anime' && value !== 'all') {
        throw new StandaloneCliError('USAGE_ERROR: --media must be anime or all.', 2);
      }
      input.media = value;
    } else if (name === '--target-role') {
      input.targetRole = requireArg(value.trim(), 'target role');
    } else if (name === '--collaborator-role') {
      input.collaboratorRole = requireArg(value.trim(), 'collaborator role');
    } else if (name === '--max-relations') {
      input.maxRelations = optionNumber(value, 'max-relations', true, 1, 120);
    } else if (name === '--max-subjects') {
      input.maxSubjects = optionNumber(value, 'max-subjects', true, 1, 36);
    } else if (name === '--max-collaborators') {
      input.maxCollaborators = optionNumber(value, 'max-collaborators', true, 1, 50);
    } else {
      input.maxSharedSubjects = optionNumber(value, 'max-shared-subjects', true, 1, 20);
    }
  }
  return input;
}

function parseEpisodeGuideOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {
    subjectId: parsePositiveInteger(args[0], 'subject id'),
  };
  const category = takeOption(args, '--category');
  const maxEpisodes = takeOption(args, '--max-episodes');
  if (category !== undefined) {
    const categories = ['all', 'main', 'sp', 'op', 'ed', 'pv', 'mad', 'other'];
    if (!categories.includes(category)) {
      throw new StandaloneCliError(
        'USAGE_ERROR: --category must be all, main, sp, op, ed, pv, mad, or other.',
        2,
      );
    }
    input.category = category;
  }
  if (maxEpisodes !== undefined) {
    input.maxEpisodes = optionNumber(maxEpisodes, 'max-episodes', true, 1, 200);
  }
  if (args.includes('--no-descriptions')) input.includeDescriptions = false;
  return input;
}

function parseEpisodeIntegrityOptions(args: string[]): Record<string, unknown> {
  const input = parseEpisodeGuideOptions(args);
  const asOfDate = takeOption(args, '--as-of-date');
  if (asOfDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(asOfDate)) {
      throw new StandaloneCliError('USAGE_ERROR: --as-of-date must use YYYY-MM-DD.', 2);
    }
    input.asOfDate = asOfDate;
  }
  return input;
}

function parseCharacterCreditIntegrityOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {
    characterId: parsePositiveInteger(args[0], 'character id'),
  };
  const optionNames = new Set(['--max-subjects', '--max-persons']);
  const seen = new Set<string>();
  for (let index = 1; index < args.length; index += 2) {
    const name = args[index];
    if (!name || !optionNames.has(name)) {
      throw new StandaloneCliError(
        `USAGE_ERROR: unknown character-integrity argument "${name || ''}".`,
        2,
      );
    }
    if (seen.has(name)) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} may only be specified once.`, 2);
    }
    seen.add(name);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} requires a value.`, 2);
    }
    if (name === '--max-subjects') {
      input.maxSubjects = optionNumber(value, 'max-subjects', true, 1, 64);
    } else {
      input.maxPersons = optionNumber(value, 'max-persons', true, 1, 64);
    }
  }
  return input;
}

function parseSubjectComparisonOptions(args: string[]): Record<string, unknown> {
  const firstSubjectId = parsePositiveInteger(args[0], 'first subject id');
  const secondSubjectId = parsePositiveInteger(args[1], 'second subject id');
  if (firstSubjectId === secondSubjectId) {
    throw new StandaloneCliError('USAGE_ERROR: subject ids must be different.', 2);
  }
  const input: Record<string, unknown> = {
    subjectIds: [firstSubjectId, secondSubjectId],
  };
  const optionNames = new Set(['--max-cast', '--max-staff', '--max-relations']);
  const seen = new Set<string>();
  for (let index = 2; index < args.length; index += 2) {
    const name = args[index];
    if (!name || !name.startsWith('--') || !optionNames.has(name)) {
      throw new StandaloneCliError(`USAGE_ERROR: unknown compare argument "${name || ''}".`, 2);
    }
    if (seen.has(name)) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} may only be specified once.`, 2);
    }
    seen.add(name);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} requires a value.`, 2);
    }
    if (name === '--max-cast') {
      input.maxCast = optionNumber(value, 'max-cast', true, 1, 20);
    } else if (name === '--max-staff') {
      input.maxStaff = optionNumber(value, 'max-staff', true, 1, 80);
    } else {
      input.maxRelations = optionNumber(value, 'max-relations', true, 1, 32);
    }
  }
  return input;
}

function parseSubjectCohortComparisonOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  const optionNames = new Set([
    '--a-query',
    '--b-query',
    '--a-label',
    '--b-label',
    '--max-subjects',
  ]);
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    if (!name || !optionNames.has(name)) {
      throw new StandaloneCliError(
        `USAGE_ERROR: unknown compare-cohorts argument "${name || ''}".`,
        2,
      );
    }
    if (seen.has(name)) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} may only be specified once.`, 2);
    }
    seen.add(name);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} requires a value.`, 2);
    }
    if (name === '--max-subjects') {
      input.maxSubjects = optionNumber(value, 'max-subjects', true, 1, 60);
      continue;
    }
    if (name.endsWith('label')) {
      input[name === '--a-label' ? 'aLabel' : 'bLabel'] = requireArg(value.trim(), name.slice(2));
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} must be valid JSON.`, 2);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} must be a JSON object.`, 2);
    }
    input[name === '--a-query' ? 'aQuery' : 'bQuery'] = parsed;
  }
  if (!input.aQuery || !input.bQuery) {
    throw new StandaloneCliError(
      'USAGE_ERROR: compare-cohorts requires both --a-query and --b-query.',
      2,
    );
  }
  return {
    cohorts: [
      { ...(input.aLabel ? { label: input.aLabel } : {}), query: input.aQuery },
      { ...(input.bLabel ? { label: input.bLabel } : {}), query: input.bQuery },
    ],
    ...(input.maxSubjects ? { maxSubjects: input.maxSubjects } : {}),
  };
}

function parseSubjectCohortAggregationOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  const optionNames = new Set(['--query', '--label', '--max-subjects']);
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    if (!name || !optionNames.has(name)) {
      throw new StandaloneCliError(
        `USAGE_ERROR: unknown aggregate-cohort argument "${name || ''}".`,
        2,
      );
    }
    if (seen.has(name)) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} may only be specified once.`, 2);
    }
    seen.add(name);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} requires a value.`, 2);
    }
    if (name === '--max-subjects') {
      input.maxSubjects = optionNumber(value, 'max-subjects', true, 1, 60);
      continue;
    }
    if (name === '--label') {
      input.label = requireArg(value.trim(), 'label');
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new StandaloneCliError('USAGE_ERROR: --query must be valid JSON.', 2);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new StandaloneCliError('USAGE_ERROR: --query must be a JSON object.', 2);
    }
    input.query = parsed;
  }
  if (!input.query) {
    throw new StandaloneCliError('USAGE_ERROR: aggregate-cohort requires --query.', 2);
  }
  return {
    cohort: { ...(input.label ? { label: input.label } : {}), query: input.query },
    ...(input.maxSubjects ? { maxSubjects: input.maxSubjects } : {}),
  };
}

function parseSubjectOverlapOptions(args: string[]): Record<string, unknown> {
  const subjectIds: number[] = [];
  let index = 0;
  while (index < args.length && !args[index]!.startsWith('--')) {
    subjectIds.push(parsePositiveInteger(args[index], 'subject id'));
    index += 1;
  }
  if (subjectIds.length < 2 || subjectIds.length > 8) {
    throw new StandaloneCliError('USAGE_ERROR: overlap requires 2 to 8 subject ids.', 2);
  }
  if (new Set(subjectIds).size !== subjectIds.length) {
    throw new StandaloneCliError('USAGE_ERROR: overlap subject ids must be different.', 2);
  }
  const input: Record<string, unknown> = { subjectIds };
  const optionNames = new Set([
    '--kind',
    '--cast-role',
    '--max-cast',
    '--max-staff',
    '--max-pairs',
    '--max-people',
  ]);
  const seen = new Set<string>();
  for (; index < args.length; index += 2) {
    const name = args[index];
    if (!name || !optionNames.has(name)) {
      throw new StandaloneCliError(`USAGE_ERROR: unknown overlap argument "${name || ''}".`, 2);
    }
    if (seen.has(name)) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} may only be specified once.`, 2);
    }
    seen.add(name);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} requires a value.`, 2);
    }
    if (name === '--kind') {
      if (value !== 'cast' && value !== 'staff' && value !== 'all') {
        throw new StandaloneCliError('USAGE_ERROR: --kind must be cast, staff, or all.', 2);
      }
      input.kind = value;
    } else if (name === '--cast-role') {
      if (value !== 'all' && value !== 'main') {
        throw new StandaloneCliError('USAGE_ERROR: --cast-role must be all or main.', 2);
      }
      input.castRole = value;
    } else if (name === '--max-cast') {
      input.maxCast = optionNumber(value, 'max-cast', true, 1, 80);
    } else if (name === '--max-staff') {
      input.maxStaff = optionNumber(value, 'max-staff', true, 1, 80);
    } else if (name === '--max-pairs') {
      input.maxPairs = optionNumber(value, 'max-pairs', true, 1, 28);
    } else {
      input.maxPeople = optionNumber(value, 'max-people', true, 1, 24);
    }
  }
  return input;
}

function parseSubjectStatsHistoryOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {
    subjectId: parsePositiveInteger(args[0], 'subject id'),
  };
  const optionNames = new Set(['--record-current', '--max-observations', '--retention-days']);
  const seen = new Set<string>();
  for (let index = 1; index < args.length; index += 1) {
    const name = args[index];
    if (!name || !optionNames.has(name)) {
      throw new StandaloneCliError(
        `USAGE_ERROR: unknown stats-history argument "${name || ''}".`,
        2,
      );
    }
    if (seen.has(name)) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} may only be specified once.`, 2);
    }
    seen.add(name);
    if (name === '--record-current') {
      input.recordCurrent = true;
      continue;
    }
    const value = args[++index];
    if (!value || value.startsWith('--')) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} requires a value.`, 2);
    }
    if (name === '--max-observations') {
      input.maxObservations = optionNumber(value, 'max-observations', true, 1, 120);
    } else {
      input.retentionDays = optionNumber(value, 'retention-days', true, 1, 3650);
    }
  }
  return input;
}

function optionNumber(
  value: string,
  name: string,
  positive = false,
  minimum?: number,
  maximum?: number,
): number {
  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    !Number.isInteger(parsed) ||
    (positive ? parsed <= 0 : parsed < 0) ||
    (minimum !== undefined && parsed < minimum) ||
    (maximum !== undefined && parsed > maximum)
  ) {
    const range =
      minimum !== undefined && maximum !== undefined
        ? ` from ${minimum} to ${maximum}`
        : minimum !== undefined
          ? ` at least ${minimum}`
          : maximum !== undefined
            ? ` at most ${maximum}`
            : '';
    throw new StandaloneCliError(
      `USAGE_ERROR: ${name} must be an integer${positive ? ' greater than zero' : ''}${range}.`,
      2,
    );
  }
  return parsed;
}

function appendOption(
  input: Record<string, unknown>,
  key: string,
  value: string,
  alwaysArray = false,
): void {
  const current = input[key];
  if (current === undefined) input[key] = alwaysArray ? [value] : value;
  else if (Array.isArray(current)) current.push(value);
  else input[key] = [current, value];
}

function parseStatus(value: string): 'wish' | 'doing' | 'done' | 'on_hold' | 'dropped' {
  const map: Record<string, 'wish' | 'doing' | 'done' | 'on_hold' | 'dropped'> = {
    wish: 'wish',
    want: 'wish',
    watching: 'doing',
    doing: 'doing',
    done: 'done',
    watched: 'done',
    on_hold: 'on_hold',
    hold: 'on_hold',
    dropped: 'dropped',
  };
  const status = map[value.toLowerCase()];
  if (!status) {
    throw new StandaloneCliError(
      'USAGE_ERROR: collection status must be wish, doing/watching, done/watched, on_hold, or dropped.',
      2,
    );
  }
  return status;
}

function parseBacklogOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  const maxItems = takeOption(args, '--max-items');
  const maxSubjects = takeOption(args, '--max-subjects');
  const maxEpisodes = takeOption(args, '--max-episodes');
  const statuses = takeOption(args, '--status');
  const sort = takeOption(args, '--sort');
  if (maxItems !== undefined) input.maxItems = optionNumber(maxItems, 'max-items', true);
  if (maxSubjects !== undefined)
    input.maxSubjects = optionNumber(maxSubjects, 'max-subjects', true);
  if (maxEpisodes !== undefined) {
    input.maxEpisodesPerSubject = optionNumber(maxEpisodes, 'max-episodes', true);
  }
  if (statuses !== undefined) {
    const values = statuses
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map(parseStatus);
    if (values.length === 0) {
      throw new StandaloneCliError('USAGE_ERROR: --status requires at least one status.', 2);
    }
    input.statuses = [...new Set(values)];
  }
  if (sort !== undefined) {
    const sortBy =
      sort === 'source'
        ? 'source'
        : sort === 'estimated-minutes-asc'
          ? 'estimated_minutes_asc'
          : sort === 'estimated-minutes-desc'
            ? 'estimated_minutes_desc'
            : undefined;
    if (!sortBy) {
      throw new StandaloneCliError(
        'USAGE_ERROR: --sort must be source, estimated-minutes-asc, or estimated-minutes-desc.',
        2,
      );
    }
    input.sortBy = sortBy;
  }
  return input;
}

function parseCollectionScheduleOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  const maxItems = takeOption(args, '--max-items');
  const maxRows = takeOption(args, '--max-rows');
  const statuses = takeOption(args, '--status');
  if (maxItems !== undefined) input.maxCollectionItems = optionNumber(maxItems, 'max-items', true);
  if (maxRows !== undefined) input.maxRows = optionNumber(maxRows, 'max-rows', true);
  if (statuses !== undefined) {
    const values = statuses
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map(parseStatus);
    if (values.length === 0) {
      throw new StandaloneCliError('USAGE_ERROR: --status requires at least one status.', 2);
    }
    input.statuses = [...new Set(values)];
  }
  return input;
}

function parseCollectionDashboardOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  const maxItems = takeOption(args, '--max-items');
  const maxSubjects = takeOption(args, '--max-subjects');
  const maxEpisodes = takeOption(args, '--max-episodes');
  const maxRows = takeOption(args, '--max-rows');
  const timeoutMs = takeOption(args, '--timeout-ms');
  const statuses = takeOption(args, '--status');
  if (maxItems !== undefined) input.maxCollectionItems = optionNumber(maxItems, 'max-items', true);
  if (maxSubjects !== undefined)
    input.maxSubjects = optionNumber(maxSubjects, 'max-subjects', true);
  if (maxEpisodes !== undefined) {
    input.maxEpisodesPerSubject = optionNumber(maxEpisodes, 'max-episodes', true);
  }
  if (maxRows !== undefined) input.maxRows = optionNumber(maxRows, 'max-rows', true);
  if (timeoutMs !== undefined) {
    input.maxDurationMs = optionNumber(timeoutMs, 'timeout-ms', true, 1000, 120000);
  }
  if (statuses !== undefined) {
    const values = statuses
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map(parseStatus);
    if (values.length === 0) {
      throw new StandaloneCliError('USAGE_ERROR: --status requires at least one status.', 2);
    }
    input.statuses = [...new Set(values)];
  }
  return input;
}

function parseCollectionSeriesOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  const maxItems = takeOption(args, '--max-items');
  const maxRelationSubjects = takeOption(args, '--max-relation-subjects');
  const maxRelationsPerSubject = takeOption(args, '--max-relations-per-subject');
  const maxGroups = takeOption(args, '--max-groups');
  const maxEdges = takeOption(args, '--max-edges');
  const statuses = takeOption(args, '--status');
  if (maxItems !== undefined) input.maxItems = optionNumber(maxItems, 'max-items', true, 1, 100);
  if (maxRelationSubjects !== undefined) {
    input.maxRelationSubjects = optionNumber(
      maxRelationSubjects,
      'max-relation-subjects',
      true,
      1,
      36,
    );
  }
  if (maxRelationsPerSubject !== undefined) {
    input.maxRelationsPerSubject = optionNumber(
      maxRelationsPerSubject,
      'max-relations-per-subject',
      true,
      1,
      96,
    );
  }
  if (maxGroups !== undefined) input.maxGroups = optionNumber(maxGroups, 'max-groups', true, 1, 36);
  if (maxEdges !== undefined) input.maxEdges = optionNumber(maxEdges, 'max-edges', true, 1, 144);
  if (statuses !== undefined) {
    const values = statuses
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map(parseStatus);
    if (values.length === 0) {
      throw new StandaloneCliError('USAGE_ERROR: --status requires at least one status.', 2);
    }
    input.statuses = [...new Set(values)];
  }
  return input;
}

function parseCollectionEntityConsistencyOptions(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  const optionNames = new Set([
    '--subject-type',
    '--status',
    '--max-subjects',
    '--max-pages',
    '--max-relations',
    '--max-output',
  ]);
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    if (!name || !optionNames.has(name)) {
      throw new StandaloneCliError(
        `USAGE_ERROR: unknown collection consistency argument "${name || ''}".`,
        2,
      );
    }
    if (seen.has(name)) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} may only be specified once.`, 2);
    }
    seen.add(name);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new StandaloneCliError(`USAGE_ERROR: ${name} requires a value.`, 2);
    }
    if (name === '--subject-type') {
      if (!['book', 'anime', 'music', 'game', 'real'].includes(value)) {
        throw new StandaloneCliError(
          'USAGE_ERROR: --subject-type must be book, anime, music, game, or real.',
          2,
        );
      }
      input.subjectType = value;
    } else if (name === '--status') {
      input.status = parseStatus(value);
    } else if (name === '--max-subjects') {
      input.maxSubjects = optionNumber(value, 'max-subjects', true, 1, 24);
    } else if (name === '--max-pages') {
      input.maxSubjectPages = optionNumber(value, 'max-pages', true, 1, 8);
    } else if (name === '--max-relations') {
      input.maxRelationsPerSubject = optionNumber(value, 'max-relations', true, 1, 80);
    } else {
      input.maxOutputRows = optionNumber(value, 'max-output', true, 1, 60);
    }
  }
  return input;
}

async function runTool(
  ctx: StandaloneCommandContext,
  name: string,
  input: unknown,
): Promise<unknown> {
  return ctx.host.executeTool(name, input, {
    confirmationId: ctx.flags.confirmationId,
    interactive: ctx.flags.interactive,
    confirm: ctx.confirm,
  });
}

async function authAccountId(ctx: StandaloneCommandContext, value: string): Promise<string> {
  const accounts = (await runTool(ctx, 'bangumi.auth_list_accounts', {})) as Array<{
    accountId: string;
    username: string;
  }>;
  const byId = accounts.find((account) => account.accountId === value);
  if (byId) return byId.accountId;
  const index = Number(value);
  if (Number.isInteger(index) && index >= 1 && index <= accounts.length) {
    return accounts[index - 1]!.accountId;
  }
  throw new StandaloneCliError(
    `VALIDATION_ERROR: account ${value} is not bound to this profile.`,
    2,
  );
}

function describeTool(tool: ToolDefinition): Record<string, unknown> {
  const schema = z.toJSONSchema(tool.input) as Record<string, unknown>;
  delete schema.$schema;
  return {
    name: tool.name,
    description: tool.description,
    auth: tool.auth,
    scopes: tool.scopes,
    risk: tool.risk,
    inputSchema: schema,
  };
}

export class StandaloneCommandRegistry {
  async execute(args: string[], ctx: StandaloneCommandContext): Promise<CommandResult> {
    const command = args[0]?.toLowerCase();
    if (!command || command === 'help' || ctx.flags.help) {
      return { value: HELP_TEXT };
    }
    if (command === 'exit' || command === 'quit') return { value: undefined, exit: true };
    if (command === 'clear') {
      ctx.presenter.message('\u001b[2J\u001b[H');
      return { value: undefined };
    }
    if (command === 'version') return { value: { version: '0.1.0' } };
    if (command === 'status') return { value: await ctx.host.getStatus(ctx.flags.verbose) };
    if (command === 'doctor') return { value: await this.doctor(ctx) };
    if (command === 'provider') return { value: await this.provider(args.slice(1), ctx) };
    if (command === 'search') return { value: await this.search(args.slice(1), ctx) };
    if (command === 'discover') return { value: await this.discover(args.slice(1), ctx) };
    if (command === 'subject') {
      return {
        value: await runTool(ctx, 'bangumi.get_subject', {
          subjectId: parsePositiveInteger(args[1], 'subject id'),
        }),
      };
    }
    if (command === 'subject-identity' || command === 'identity') {
      return {
        value: await runTool(ctx, 'bangumi.get_subject_identity', {
          subjectId: parsePositiveInteger(args[1], 'subject id'),
        }),
      };
    }
    if (command === 'subject-index-membership' || command === 'index-membership') {
      return {
        value: await runTool(
          ctx,
          'bangumi.get_subject_index_membership',
          parseSubjectIndexMembershipOptions(args.slice(1)),
        ),
      };
    }
    if (command === 'revision-latest' || command === 'latest-revision') {
      return {
        value: await runTool(ctx, 'bangumi.get_latest_subject_revision', {
          subjectId: parsePositiveInteger(args[1], 'subject id'),
        }),
      };
    }
    if (command === 'stats') {
      return {
        value: await runTool(ctx, 'bangumi.get_subject_stats_intelligence', {
          subjectId: parsePositiveInteger(args[1], 'subject id'),
        }),
      };
    }
    if (command === 'stats-history') {
      return {
        value: await runTool(
          ctx,
          'bangumi.get_subject_stats_history',
          parseSubjectStatsHistoryOptions(args.slice(1)),
        ),
      };
    }
    if (command === 'overview') {
      const overviewArgs = args.slice(1);
      const input: Record<string, unknown> = {
        subjectId: parsePositiveInteger(overviewArgs[0], 'subject id'),
      };
      const maxCast = takeOption(overviewArgs, '--max-cast');
      const maxStaff = takeOption(overviewArgs, '--max-staff');
      const maxRelations = takeOption(overviewArgs, '--max-relations');
      if (maxCast !== undefined) input.maxCast = parsePositiveInteger(maxCast, 'max-cast');
      if (maxStaff !== undefined) input.maxStaff = parsePositiveInteger(maxStaff, 'max-staff');
      if (maxRelations !== undefined) {
        input.maxRelations = parsePositiveInteger(maxRelations, 'max-relations');
      }
      return { value: await runTool(ctx, 'bangumi.get_subject_overview', input) };
    }
    if (command === 'compare') {
      return {
        value: await runTool(
          ctx,
          'bangumi.get_subject_comparison',
          parseSubjectComparisonOptions(args.slice(1)),
        ),
      };
    }
    if (command === 'compare-cohorts') {
      return {
        value: await runTool(
          ctx,
          'bangumi.compare_subject_cohorts',
          parseSubjectCohortComparisonOptions(args.slice(1)),
        ),
      };
    }
    if (command === 'aggregate-cohort') {
      return {
        value: await runTool(
          ctx,
          'bangumi.aggregate_subject_cohort',
          parseSubjectCohortAggregationOptions(args.slice(1)),
        ),
      };
    }
    if (command === 'overlap') {
      return {
        value: await runTool(
          ctx,
          'bangumi.get_subject_overlap',
          parseSubjectOverlapOptions(args.slice(1)),
        ),
      };
    }
    if (command === 'watch-order') {
      const watchArgs = args.slice(1);
      const input: Record<string, unknown> = {
        subjectId: parsePositiveInteger(watchArgs[0], 'subject id'),
      };
      const depth = takeOption(watchArgs, '--depth');
      const maxNodes = takeOption(watchArgs, '--max-nodes');
      const media = takeOption(watchArgs, '--media');
      if (depth !== undefined) input.depth = parseNonNegativeInteger(depth, 'depth');
      if (maxNodes !== undefined) input.maxNodes = parsePositiveInteger(maxNodes, 'max-nodes');
      if (media !== undefined && media !== 'anime' && media !== 'all') {
        throw new StandaloneCliError('USAGE_ERROR: media must be anime or all.', 2);
      }
      if (media !== undefined) input.media = media;
      return { value: await runTool(ctx, 'bangumi.get_series_watch_order', input) };
    }
    if (command === 'cast') {
      return {
        value: await runTool(ctx, 'bangumi.get_subject_cast', {
          subjectId: parsePositiveInteger(args[1], 'subject id'),
        }),
      };
    }
    if (command === 'character-integrity' || command === 'character-credits') {
      return {
        value: await runTool(
          ctx,
          'bangumi.get_character_credit_integrity',
          parseCharacterCreditIntegrityOptions(args.slice(1)),
        ),
      };
    }
    if (command === 'person') {
      return {
        value: await runTool(ctx, 'bangumi.get_person_profile', {
          personId: parsePositiveInteger(args[1], 'person id'),
        }),
      };
    }
    if (command === 'activity') {
      return {
        value: await runTool(
          ctx,
          'bangumi.get_person_activity',
          parsePersonActivityOptions(args.slice(1)),
        ),
      };
    }
    if (command === 'collaborators') {
      return {
        value: await runTool(
          ctx,
          'bangumi.get_person_collaboration',
          parsePersonCollaborationOptions(args.slice(1)),
        ),
      };
    }
    if (command === 'staff') {
      return {
        value: await runTool(ctx, 'bangumi.get_subject_staff', {
          subjectId: parsePositiveInteger(args[1], 'subject id'),
        }),
      };
    }
    if (command === 'calendar') {
      return {
        value: await runTool(
          ctx,
          'bangumi.get_calendar_intelligence',
          parseCalendarOptions(args.slice(1)),
        ),
      };
    }
    if (command === 'episodes') {
      return {
        value: await runTool(ctx, 'bangumi.get_episodes', {
          subjectId: parsePositiveInteger(args[1], 'subject id'),
        }),
      };
    }
    if (command === 'episode-guide') {
      return {
        value: await runTool(
          ctx,
          'bangumi.get_episode_guide',
          parseEpisodeGuideOptions(args.slice(1)),
        ),
      };
    }
    if (command === 'episode-integrity') {
      return {
        value: await runTool(
          ctx,
          'bangumi.get_episode_integrity',
          parseEpisodeIntegrityOptions(args.slice(1)),
        ),
      };
    }
    if (command === 'collection') return { value: await this.collection(args.slice(1), ctx) };
    if (command === 'auth' || command === 'login' || command === 'accounts') {
      const authArgs = command === 'auth' ? args.slice(1) : [command, ...args.slice(1)];
      return { value: await this.auth(authArgs, ctx) };
    }
    if (command === 'render') return { value: await this.render(args.slice(1), ctx) };
    if (command === 'tool') return { value: await this.tool(args.slice(1), ctx) };
    if (command === 'mcp' && args[1] === 'smoke') {
      return {
        value: {
          status: 'not-run',
          message:
            'Use the existing built MCP smoke command when MCP transport testing is required.',
        },
      };
    }
    throw new StandaloneCliError(`USAGE_ERROR: unknown command "${args[0]}". Run help.`, 2);
  }

  private async search(args: string[], ctx: StandaloneCommandContext): Promise<unknown> {
    const queryArgs = withoutOptions(args, ['--type', '--limit']);
    const query = requireArg(queryArgs[0], 'search query');
    const type = takeOption(args, '--type');
    const limitValue = takeOption(args, '--limit');
    const input: Record<string, unknown> = { query };
    if (type) input.type = type;
    if (limitValue) input.limit = parsePositiveInteger(limitValue, 'limit');
    return runTool(ctx, 'bangumi.search_subjects', input);
  }

  private async discover(args: string[], ctx: StandaloneCommandContext): Promise<unknown> {
    const input: Record<string, unknown> = {};
    let all = false;
    let explain = false;
    const withValue = new Set([
      '--keyword',
      '--media',
      '--category',
      '--year',
      '--month',
      '--season',
      '--from',
      '--to',
      '--tag',
      '--meta-tag',
      '--exclude-meta-tag',
      '--concept',
      '--rating-min',
      '--rating-max',
      '--rating-count-min',
      '--rating-count-max',
      '--rank-min',
      '--rank-max',
      '--collection-count-min',
      '--collection-count-max',
      '--nsfw',
      '--sort',
      '--order',
      '--limit',
      '--explain',
    ]);
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === '--all') {
        all = true;
        continue;
      }
      if (arg === '--explain') {
        const next = args[index + 1];
        if (next && !next.startsWith('--')) {
          index += 1;
          if (next !== 'compact' && next !== 'full') {
            throw new StandaloneCliError('USAGE_ERROR: --explain must be compact or full.', 2);
          }
          input.explain = next;
        } else {
          explain = true;
        }
        continue;
      }
      if (!arg || !withValue.has(arg)) {
        throw new StandaloneCliError(`USAGE_ERROR: unknown discover option "${arg}".`, 2);
      }
      const value = requireArg(args[++index], arg);
      switch (arg) {
        case '--keyword':
          input.keyword = value;
          break;
        case '--media':
          appendOption(input, 'media', value);
          break;
        case '--category':
          appendOption(input, 'categories', value, true);
          break;
        case '--year':
          input.year = optionNumber(value, '--year');
          break;
        case '--month':
          input.month = optionNumber(value, '--month', true);
          break;
        case '--season':
          input.season = value;
          break;
        case '--from':
          input.from = value;
          break;
        case '--to':
          input.to = value;
          break;
        case '--tag':
          appendOption(input, 'tags', value, true);
          break;
        case '--meta-tag':
          appendOption(input, 'metaTags', value, true);
          break;
        case '--exclude-meta-tag':
          appendOption(input, 'excludeMetaTags', value, true);
          break;
        case '--concept':
          appendOption(input, 'concepts', value, true);
          break;
        case '--rating-min':
          input.rating = { ...(input.rating as object | undefined), min: Number(value) };
          break;
        case '--rating-max':
          input.rating = { ...(input.rating as object | undefined), max: Number(value) };
          break;
        case '--rating-count-min':
          input.ratingCount = { ...(input.ratingCount as object | undefined), min: Number(value) };
          break;
        case '--rating-count-max':
          input.ratingCount = { ...(input.ratingCount as object | undefined), max: Number(value) };
          break;
        case '--rank-min':
          input.rank = { ...(input.rank as object | undefined), min: Number(value) };
          break;
        case '--rank-max':
          input.rank = { ...(input.rank as object | undefined), max: Number(value) };
          break;
        case '--collection-count-min':
          input.collectionCount = {
            ...(input.collectionCount as object | undefined),
            min: Number(value),
          };
          break;
        case '--collection-count-max':
          input.collectionCount = {
            ...(input.collectionCount as object | undefined),
            max: Number(value),
          };
          break;
        case '--nsfw':
          if (
            value !== 'include' &&
            value !== 'exclude' &&
            value !== 'only' &&
            value !== 'true' &&
            value !== 'false'
          ) {
            throw new StandaloneCliError(
              'USAGE_ERROR: --nsfw must be include, exclude, only, true, or false.',
              2,
            );
          }
          input.nsfw = value === 'true' ? true : value === 'false' ? false : value;
          break;
        case '--sort':
          input.sort = value;
          break;
        case '--order':
          input.order = value;
          break;
        case '--limit':
          input.limit = optionNumber(value, '--limit', true);
          break;
        case '--explain':
          input.explain = value;
          break;
      }
    }
    if (all) input.resultMode = 'all';
    if (explain) input.explain = 'full';
    if (all && input.limit === undefined) input.limit = 100;
    return runTool(ctx, 'bangumi.query_subjects', input);
  }

  private async collection(args: string[], ctx: StandaloneCommandContext): Promise<unknown> {
    const subcommand = requireArg(args[0], 'collection subcommand').toLowerCase();
    if (subcommand === 'list') return runTool(ctx, 'bangumi.list_collections', {});
    if (subcommand === 'status') {
      return runTool(ctx, 'bangumi.get_collection', {
        subjectId: parsePositiveInteger(args[1], 'subject id'),
      });
    }
    if (subcommand === 'intelligence' || subcommand === 'summary') {
      const maxItems = takeOption(args, '--max-items');
      const input: Record<string, unknown> = {};
      if (maxItems !== undefined) input.maxItems = optionNumber(maxItems, 'max-items', true);
      return runTool(ctx, 'bangumi.get_collection_intelligence', input);
    }
    if (subcommand === 'backlog') {
      return runTool(ctx, 'bangumi.get_collection_backlog', parseBacklogOptions(args));
    }
    if (subcommand === 'schedule' || subcommand === 'airing') {
      return runTool(ctx, 'bangumi.get_collection_schedule', parseCollectionScheduleOptions(args));
    }
    if (subcommand === 'dashboard' || subcommand === 'summary-dashboard') {
      return runTool(
        ctx,
        'bangumi.get_collection_dashboard',
        parseCollectionDashboardOptions(args),
      );
    }
    if (subcommand === 'series' || subcommand === 'series-groups') {
      return runTool(
        ctx,
        'bangumi.get_collection_series_groups',
        parseCollectionSeriesOptions(args),
      );
    }
    if (subcommand === 'consistency' || subcommand === 'entity-consistency') {
      return runTool(
        ctx,
        'bangumi.get_collection_entity_consistency',
        parseCollectionEntityConsistencyOptions(args.slice(1)),
      );
    }
    if (subcommand === 'set') {
      return runTool(ctx, 'bangumi.update_collection', {
        subjectId: parsePositiveInteger(args[1], 'subject id'),
        status: parseStatus(requireArg(args[2], 'collection status')),
      });
    }
    throw new StandaloneCliError(`USAGE_ERROR: unknown collection command "${args[0]}".`, 2);
  }

  private async auth(args: string[], ctx: StandaloneCommandContext): Promise<unknown> {
    const subcommand = (args[0] || 'status').toLowerCase();
    if (subcommand === 'status') return runTool(ctx, 'bangumi.auth_status', {});
    if (subcommand === 'accounts' || subcommand === 'list') {
      return runTool(ctx, 'bangumi.auth_list_accounts', {});
    }
    if (subcommand === 'login' || subcommand === 'start') {
      const oauth = await ctx.host.startOAuth();
      const rawResult = await runTool(ctx, 'bangumi.auth_start', {});
      const result: Record<string, unknown> =
        rawResult && typeof rawResult === 'object' ? (rawResult as Record<string, unknown>) : {};
      const output: Record<string, unknown> = { ...result, callbackUrl: oauth.callbackUrl };
      if (ctx.flags.interactive && !ctx.flags.json) {
        ctx.presenter.message('Bangumi authorization required.');
        ctx.presenter.message(`Open:\n${String(output['authorizationUrl'])}`);
        ctx.presenter.message('Waiting for authorization...');
      }
      if (ctx.flags.interactive) {
        const timeoutMs = Number(process.env.BANGUMI_STANDALONE_OAUTH_WAIT_MS || 120_000);
        const auth = await ctx.host.waitForAuthorization(timeoutMs);
        if (auth.bound) {
          return { ...output, authorizationComplete: true, account: auth.account };
        }
        return { ...output, authorizationComplete: false };
      }
      return output;
    }
    if (subcommand === 'switch' || subcommand === 'remove') {
      const accountId = await authAccountId(ctx, requireArg(args[1], 'account id or index'));
      if (subcommand === 'switch') {
        return runTool(ctx, 'bangumi.auth_switch_account', { accountId });
      }
      return runTool(ctx, 'bangumi.auth_remove_account', { accountId });
    }
    throw new StandaloneCliError(`USAGE_ERROR: unknown auth command "${args[0]}".`, 2);
  }

  private async render(args: string[], ctx: StandaloneCommandContext): Promise<unknown> {
    const kind = requireArg(args[0], 'render target').toLowerCase();
    let name: string;
    let input: Record<string, unknown> = {};
    if (kind === 'subject') {
      name = 'bangumi.render_subject_card';
      input = { subjectId: parsePositiveInteger(args[1], 'subject id') };
    } else if (kind === 'subject-identity' || kind === 'identity') {
      name = 'bangumi.render_subject_identity';
      input = { subjectId: parsePositiveInteger(args[1], 'subject id') };
    } else if (kind === 'subject-index-membership' || kind === 'index-membership') {
      name = 'bangumi.render_subject_index_membership';
      input = parseSubjectIndexMembershipOptions(args.slice(1));
    } else if (kind === 'revision-latest' || kind === 'latest-revision') {
      name = 'bangumi.render_latest_subject_revision';
      input = { subjectId: parsePositiveInteger(args[1], 'subject id') };
    } else if (kind === 'stats' || kind === 'subject-stats') {
      name = 'bangumi.render_subject_stats_intelligence';
      input = { subjectId: parsePositiveInteger(args[1], 'subject id') };
    } else if (kind === 'stats-history' || kind === 'subject-stats-history') {
      name = 'bangumi.render_subject_stats_history';
      input = parseSubjectStatsHistoryOptions(args.slice(1));
    } else if (kind === 'overview') {
      name = 'bangumi.render_subject_overview';
      input = { subjectId: parsePositiveInteger(args[1], 'subject id') };
      const maxCast = takeOption(args, '--max-cast');
      const maxStaff = takeOption(args, '--max-staff');
      const maxRelations = takeOption(args, '--max-relations');
      if (maxCast !== undefined) input.maxCast = parsePositiveInteger(maxCast, 'max-cast');
      if (maxStaff !== undefined) input.maxStaff = parsePositiveInteger(maxStaff, 'max-staff');
      if (maxRelations !== undefined) {
        input.maxRelations = parsePositiveInteger(maxRelations, 'max-relations');
      }
    } else if (kind === 'compare') {
      name = 'bangumi.render_subject_comparison';
      input = parseSubjectComparisonOptions(args.slice(1));
    } else if (kind === 'compare-cohorts' || kind === 'cohorts') {
      name = 'bangumi.render_subject_cohort_comparison';
      input = parseSubjectCohortComparisonOptions(args.slice(1));
    } else if (kind === 'aggregate-cohort' || kind === 'cohort') {
      name = 'bangumi.render_subject_cohort_aggregation';
      input = parseSubjectCohortAggregationOptions(args.slice(1));
    } else if (kind === 'overlap') {
      name = 'bangumi.render_subject_overlap';
      input = parseSubjectOverlapOptions(args.slice(1));
    } else if (kind === 'watch-order') {
      input = {
        subjectId: parsePositiveInteger(args[1], 'subject id'),
      };
      const depth = takeOption(args, '--depth');
      const maxNodes = takeOption(args, '--max-nodes');
      const media = takeOption(args, '--media');
      if (depth !== undefined) input.depth = parseNonNegativeInteger(depth, 'depth');
      if (maxNodes !== undefined) input.maxNodes = parsePositiveInteger(maxNodes, 'max-nodes');
      if (media !== undefined && media !== 'anime' && media !== 'all') {
        throw new StandaloneCliError('USAGE_ERROR: media must be anime or all.', 2);
      }
      if (media !== undefined) input.media = media;
      name = 'bangumi.render_series_watch_order';
    } else if (kind === 'cast') {
      name = 'bangumi.render_cast_card';
      input = { subjectId: parsePositiveInteger(args[1], 'subject id') };
    } else if (kind === 'character-integrity' || kind === 'character-credits') {
      name = 'bangumi.render_character_credit_integrity';
      input = parseCharacterCreditIntegrityOptions(args.slice(1));
    } else if (kind === 'person') {
      name = 'bangumi.render_person_profile';
      input = { personId: parsePositiveInteger(args[1], 'person id') };
    } else if (kind === 'activity') {
      name = 'bangumi.render_person_activity';
      input = parsePersonActivityOptions(args.slice(1));
    } else if (kind === 'collaboration' || kind === 'collaborators') {
      name = 'bangumi.render_person_collaboration';
      input = parsePersonCollaborationOptions(args.slice(1));
    } else if (kind === 'episode-guide' || kind === 'episodes-guide') {
      name = 'bangumi.render_episode_guide';
      input = parseEpisodeGuideOptions(args.slice(1));
    } else if (kind === 'episode-integrity' || kind === 'episodes-integrity') {
      name = 'bangumi.render_episode_integrity';
      input = parseEpisodeIntegrityOptions(args.slice(1));
    } else if (kind === 'collection') {
      name = 'bangumi.render_collection_progress';
      input = { subjectId: parsePositiveInteger(args[1], 'subject id') };
    } else if (kind === 'collection-intelligence' || kind === 'collection-summary') {
      name = 'bangumi.render_collection_intelligence';
      const maxItems = takeOption(args, '--max-items');
      if (maxItems !== undefined) input.maxItems = optionNumber(maxItems, 'max-items', true);
    } else if (kind === 'collection-backlog' || kind === 'backlog') {
      name = 'bangumi.render_collection_backlog';
      input = parseBacklogOptions(args);
    } else if (kind === 'collection-schedule' || kind === 'schedule' || kind === 'airing') {
      name = 'bangumi.render_collection_schedule';
      input = parseCollectionScheduleOptions(args);
    } else if (kind === 'collection-dashboard' || kind === 'dashboard') {
      name = 'bangumi.render_collection_dashboard';
      input = parseCollectionDashboardOptions(args);
    } else if (kind === 'collection-series' || kind === 'series-groups') {
      name = 'bangumi.render_collection_series_groups';
      input = parseCollectionSeriesOptions(args);
    } else if (
      kind === 'collection-consistency' ||
      kind === 'collection-entity-consistency' ||
      kind === 'consistency'
    ) {
      name = 'bangumi.render_collection_entity_consistency';
      input = parseCollectionEntityConsistencyOptions(args.slice(1));
    } else if (kind === 'calendar') {
      name = 'bangumi.render_calendar';
      input = parseCalendarOptions(args.slice(1));
    } else if (kind === 'revision') {
      name = 'bangumi.render_revision_timeline';
      input = {
        entityType: requireArg(args[1], 'revision entity type').toLowerCase(),
        entityId: parsePositiveInteger(args[2], 'entity id'),
      };
    } else if (kind === 'search') {
      name = 'bangumi.render_search';
      input = { query: requireArg(args[1], 'search query') };
    } else {
      throw new StandaloneCliError(`USAGE_ERROR: unknown render target "${args[0]}".`, 2);
    }
    const result = (await runTool(ctx, name, input)) as Record<string, unknown>;
    if (!ctx.flags.outputPath) return result;
    const exported = await ctx.host.exportArtifact(
      result.artifact,
      ctx.flags.outputPath,
      ctx.flags.force,
    );
    return { ...result, export: exported };
  }

  private async tool(args: string[], ctx: StandaloneCommandContext): Promise<unknown> {
    const subcommand = requireArg(args[0], 'tool subcommand').toLowerCase();
    if (subcommand === 'list') {
      return ctx.host
        .getRegistry()
        .getTools()
        .map((tool) => ({
          name: tool.name,
          description: tool.description,
          auth: tool.auth,
          risk: tool.risk,
        }));
    }
    const toolName = requireArg(args[1], 'tool name');
    if (subcommand === 'describe') {
      const tool = ctx.host.getRegistry().getTool(toolName);
      if (!tool) throw new StandaloneCliError(`NOT_FOUND: tool ${toolName} is not registered.`, 2);
      return describeTool(tool);
    }
    if (subcommand === 'call') {
      const rawJson = requireArg(args[2], 'JSON input');
      let input: unknown;
      try {
        input = JSON.parse(rawJson);
      } catch {
        throw new StandaloneCliError('USAGE_ERROR: tool call input must be valid JSON.', 2);
      }
      return runTool(ctx, toolName, input);
    }
    throw new StandaloneCliError(`USAGE_ERROR: unknown tool command "${args[0]}".`, 2);
  }

  private async provider(args: string[], ctx: StandaloneCommandContext): Promise<unknown> {
    const subcommand = requireArg(args[0], 'provider subcommand').toLowerCase();
    const registry = ctx.host.getDependencies().providerRegistry;
    if (!registry) {
      throw new StandaloneCliError('RUNTIME_ERROR: provider registry is unavailable.', 1);
    }
    if (subcommand === 'status') return registry.getStatus();
    if (subcommand === 'explain') {
      const capability = requireArg(args[1], 'provider capability').toLowerCase();
      if (capability !== 'subject') {
        throw new StandaloneCliError(
          `USAGE_ERROR: provider explain currently supports subject <id>.`,
          2,
        );
      }
      const subjectId = parsePositiveInteger(args[2], 'subject id');
      return {
        capability,
        subjectId,
        result: await registry.getSubject(subjectId),
      };
    }
    throw new StandaloneCliError(`USAGE_ERROR: unknown provider command "${args[0]}".`, 2);
  }

  private async doctor(ctx: StandaloneCommandContext): Promise<unknown> {
    const status = await ctx.host.getStatus(ctx.flags.verbose);
    const checks = [
      { category: 'Standalone', status: 'PASS', message: 'Standalone runtime initialized' },
      { category: 'Storage', status: 'PASS', message: 'SQLite storage and migrations are ready' },
      {
        category: 'API',
        status: status.oauthCallback.ready ? 'PASS' : 'WARN',
        message: status.oauthCallback.ready
          ? 'Local OAuth routes are ready'
          : 'Local OAuth routes are disabled',
      },
      {
        category: 'MCP',
        status: 'WARN',
        message: 'MCP is an optional external transport for Standalone',
      },
      {
        category: 'Renderer',
        status: status.renderer === 'ready' ? 'PASS' : 'WARN',
        message:
          status.renderer === 'ready'
            ? 'Chromium renderer is ready'
            : 'Renderer is optional and unavailable',
      },
      {
        category: 'Providers',
        status: status.providers.some((provider) => provider.state === 'READY') ? 'PASS' : 'WARN',
        message: status.providers.some((provider) => provider.state === 'READY')
          ? 'Official provider adapters are ready'
          : 'No official provider adapter is ready',
      },
      {
        category: 'Claude Host',
        status: 'WARN',
        message: 'Claude Host is optional / not configured',
      },
    ];
    return { checks, result: checks.some((check) => check.status === 'FAIL') ? 'FAIL' : 'PASS' };
  }
}

export { HELP_TEXT };
