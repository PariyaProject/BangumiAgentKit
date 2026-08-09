import readline from 'node:readline/promises';
import { stdin as defaultStdin, stdout as defaultStdout } from 'node:process';
import { parseCliArgs, tokenizeCommandLine } from './command-parser.js';
import { StandaloneCommandRegistry } from './command-registry.js';
import { toSafeErrorResult } from './errors.js';
import { Presenter, OutputSink } from './presenter.js';
import { StandaloneHost } from './standalone-host.js';

export interface ReplOptions {
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
}

export async function runRepl(host: StandaloneHost, options: ReplOptions = {}): Promise<number> {
  const input = options.stdin || defaultStdin;
  const sink: OutputSink = {
    stdout: options.stdout || defaultStdout,
    stderr: options.stderr || process.stderr,
  };
  const presenter = new Presenter(sink);
  const registry = new StandaloneCommandRegistry();
  const rl = readline.createInterface({
    input,
    output: options.stdout || defaultStdout,
    prompt: 'bak> ',
  });
  let sigintCount = 0;
  let closed = false;

  rl.on('SIGINT', () => {
    sigintCount += 1;
    if (sigintCount >= 2) {
      closed = true;
      rl.close();
      return;
    }
    presenter.message('Press Ctrl+C again to exit; current input/operation cancelled.');
  });

  presenter.message('BangumiAgentKit Standalone v0.1');
  presenter.message('Type help for commands.');

  const handleLine = async (
    rawLine: string,
    confirm: (details: {
      confirmationId: string;
      summary: string;
      message: string;
    }) => Promise<boolean>,
  ): Promise<boolean> => {
    if (!rawLine.trim()) return false;
    let parsed;
    try {
      parsed = parseCliArgs(tokenizeCommandLine(rawLine));
    } catch (err: unknown) {
      presenter.error(toSafeErrorResult(err), false);
      return false;
    }
    parsed.flags.interactive = true;
    if (parsed.flags.profile !== host.getProfile()) {
      presenter.error(
        toSafeErrorResult(new Error('USAGE_ERROR: profile is selected when Standalone starts.')),
        parsed.flags.json,
      );
      return false;
    }
    try {
      const result = await registry.execute(parsed.commandArgs, {
        host,
        flags: parsed.flags,
        presenter,
        confirm,
      });
      if (result.value !== undefined) presenter.result(result.value, parsed.flags.json);
      return Boolean(result.exit);
    } catch (err: unknown) {
      presenter.error(toSafeErrorResult(err), parsed.flags.json);
      return false;
    }
  };

  try {
    const isPiped = !(input as NodeJS.ReadableStream & { isTTY?: boolean }).isTTY;
    if (isPiped) {
      rl.prompt();
      for await (const line of rl) {
        if (await handleLine(line, async () => false)) {
          closed = true;
          break;
        }
        if (!closed) rl.prompt();
      }
    } else {
      while (!closed) {
        sigintCount = 0;
        let line: string;
        try {
          line = await rl.question('bak> ');
        } catch {
          break;
        }
        const shouldExit = await handleLine(line, async (details) => {
          presenter.message(`⚠ Write confirmation required\n\nOperation:\n${details.summary}`);
          const answer = await rl.question('Confirm? [y/N] ');
          return ['y', 'yes', '确认'].includes(answer.trim().toLowerCase());
        });
        if (shouldExit) break;
      }
    }
  } finally {
    rl.close();
  }
  return 0;
}
