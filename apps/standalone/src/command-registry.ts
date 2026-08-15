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
  overview <subjectId> [--max-cast 1..20] [--max-staff 1..80] [--max-relations 1..32]
  watch-order <subjectId> [--depth 0|1|2] [--max-nodes 1..16] [--media anime|all]
  cast <subjectId>
  person <personId>
  staff <subjectId>
  calendar
  episodes <subjectId>
  collection status <subjectId>
  collection intelligence [--max-items 1..200]
  collection dashboard [--max-items 1..100] [--max-subjects 1..30]
                      [--max-episodes 1..1000] [--max-rows 1..100]
                      [--timeout-ms 1000..120000] [--status wish,doing,on_hold]
  collection backlog [--max-items 1..100] [--max-subjects 1..30]
                    [--max-episodes 1..1000] [--status wish,doing,on_hold]
  collection schedule [--max-items 1..200] [--max-rows 1..100]
                      [--status wish,doing,done,on_hold,dropped]
  collection list
  collection set <subjectId> <status>

Auth:
  auth status | login | accounts
  auth switch <accountId-or-index>
  auth remove <accountId-or-index>

Renderer:
  render subject|overview|watch-order|cast|person|calendar|revision|search|collection|collection-backlog|collection-schedule|collection-dashboard <args> [--output <path>] [--force]

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
    if (command === 'person') {
      return {
        value: await runTool(ctx, 'bangumi.get_person_profile', {
          personId: parsePositiveInteger(args[1], 'person id'),
        }),
      };
    }
    if (command === 'staff') {
      return {
        value: await runTool(ctx, 'bangumi.get_subject_staff', {
          subjectId: parsePositiveInteger(args[1], 'subject id'),
        }),
      };
    }
    if (command === 'calendar') return { value: await runTool(ctx, 'bangumi.get_calendar', {}) };
    if (command === 'episodes') {
      return {
        value: await runTool(ctx, 'bangumi.get_episodes', {
          subjectId: parsePositiveInteger(args[1], 'subject id'),
        }),
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
    } else if (kind === 'person') {
      name = 'bangumi.render_person_profile';
      input = { personId: parsePositiveInteger(args[1], 'person id') };
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
    } else if (kind === 'calendar') {
      name = 'bangumi.render_calendar';
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
