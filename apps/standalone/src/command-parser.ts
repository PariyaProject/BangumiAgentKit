import { StandaloneCliError } from './errors.js';

export interface CliFlags {
  json: boolean;
  verbose: boolean;
  force: boolean;
  interactive: boolean;
  help: boolean;
  profile: string;
  confirmationId?: string;
  outputPath?: string;
  online: boolean;
  auth: boolean;
  render: boolean;
}

export interface ParsedCliArgs {
  commandArgs: string[];
  flags: CliFlags;
}

const DEFAULT_FLAGS: CliFlags = {
  json: false,
  verbose: false,
  force: false,
  interactive: false,
  help: false,
  profile: 'default',
  online: false,
  auth: false,
  render: false,
};

function readValue(argv: string[], index: number, flag: string): [string, number] {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new StandaloneCliError(`USAGE_ERROR: ${flag} requires a value.`, 2);
  }
  return [value, index + 1];
}

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const args = [...argv];
  if (args[0] === '--') args.shift();
  const flags: CliFlags = { ...DEFAULT_FLAGS };
  const commandArgs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;
    if (arg === '--json') {
      flags.json = true;
    } else if (arg === '--verbose') {
      flags.verbose = true;
    } else if (arg === '--force') {
      flags.force = true;
    } else if (arg === '--interactive') {
      flags.interactive = true;
    } else if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--online') {
      flags.online = true;
    } else if (arg === '--auth') {
      flags.auth = true;
    } else if (arg === '--render') {
      flags.render = true;
    } else if (arg === '--profile') {
      const [value, nextIndex] = readValue(args, index, arg);
      flags.profile = value;
      index = nextIndex;
    } else if (arg.startsWith('--profile=')) {
      flags.profile = arg.slice('--profile='.length);
    } else if (arg === '--confirm' || arg === '--confirmation-id') {
      const [value, nextIndex] = readValue(args, index, arg);
      flags.confirmationId = value;
      index = nextIndex;
    } else if (arg.startsWith('--confirm=')) {
      flags.confirmationId = arg.slice('--confirm='.length);
    } else if (arg === '--output') {
      const [value, nextIndex] = readValue(args, index, arg);
      flags.outputPath = value;
      index = nextIndex;
    } else if (arg.startsWith('--output=')) {
      flags.outputPath = arg.slice('--output='.length);
    } else {
      commandArgs.push(arg);
    }
  }

  return { commandArgs, flags };
}

export function tokenizeCommandLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let quote: 'single' | 'double' | undefined;
  let escaped = false;

  for (const char of line) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && quote !== 'single') {
      escaped = true;
      continue;
    }
    if (char === "'" && quote !== 'double') {
      quote = quote === 'single' ? undefined : 'single';
      continue;
    }
    if (char === '"' && quote !== 'single') {
      quote = quote === 'double' ? undefined : 'double';
      continue;
    }
    if (/\s/u.test(char) && !quote) {
      if (current) {
        result.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (escaped) current += '\\';
  if (quote) throw new StandaloneCliError('USAGE_ERROR: unterminated quote in command.', 2);
  if (current) result.push(current);
  return result;
}
