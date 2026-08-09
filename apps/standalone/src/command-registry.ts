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
  doctor                       Run local diagnostics
  version                      Show version
  clear                        Clear the terminal
  exit | quit                  Exit

Bangumi:
  search <query> [--type anime] [--limit 5]
  subject <id>
  cast <subjectId>
  calendar
  episodes <subjectId>
  collection status <subjectId>
  collection list
  collection set <subjectId> <status>

Auth:
  auth status | login | accounts
  auth switch <accountId-or-index>
  auth remove <accountId-or-index>

Renderer:
  render subject|cast|calendar|search|collection <args> [--output <path>] [--force]

Developer playground:
  tool list
  tool describe <tool>
  tool call <tool> <json> [--confirm <id>]

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
    if (command === 'search') return { value: await this.search(args.slice(1), ctx) };
    if (command === 'subject') {
      return {
        value: await runTool(ctx, 'bangumi.get_subject', {
          subjectId: parsePositiveInteger(args[1], 'subject id'),
        }),
      };
    }
    if (command === 'cast') {
      return {
        value: await runTool(ctx, 'bangumi.get_subject_cast', {
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

  private async collection(args: string[], ctx: StandaloneCommandContext): Promise<unknown> {
    const subcommand = requireArg(args[0], 'collection subcommand').toLowerCase();
    if (subcommand === 'list') return runTool(ctx, 'bangumi.list_collections', {});
    if (subcommand === 'status') {
      return runTool(ctx, 'bangumi.get_collection', {
        subjectId: parsePositiveInteger(args[1], 'subject id'),
      });
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
    } else if (kind === 'cast') {
      name = 'bangumi.render_cast_card';
      input = { subjectId: parsePositiveInteger(args[1], 'subject id') };
    } else if (kind === 'collection') {
      name = 'bangumi.render_collection_progress';
      input = { subjectId: parsePositiveInteger(args[1], 'subject id') };
    } else if (kind === 'calendar') {
      name = 'bangumi.render_calendar';
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
        category: 'Claude Host',
        status: 'WARN',
        message: 'Claude Host is optional / not configured',
      },
    ];
    return { checks, result: checks.some((check) => check.status === 'FAIL') ? 'FAIL' : 'PASS' };
  }
}

export { HELP_TEXT };
