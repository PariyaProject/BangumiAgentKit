import { loadRuntimeEnv } from '@bangumi-agent-kit/config';
import { parseCliArgs } from './command-parser.js';
import { StandaloneCommandRegistry } from './command-registry.js';
import { getStandaloneExitCode, toSafeErrorResult } from './errors.js';
import { Presenter, OutputSink } from './presenter.js';
import { runRepl } from './repl.js';
import { StandaloneHost } from './standalone-host.js';

export interface CliOptions {
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
}

export async function runCli(argv: string[], options: CliOptions = {}): Promise<number> {
  const sink: OutputSink = {
    stdout: options.stdout || process.stdout,
    stderr: options.stderr || process.stderr,
  };
  const presenter = new Presenter(sink);
  let parsed;
  try {
    loadRuntimeEnv();
    parsed = parseCliArgs(argv);
  } catch (err: unknown) {
    presenter.error(toSafeErrorResult(err), false);
    return getStandaloneExitCode(err);
  }

  if (parsed.commandArgs.length === 0 || parsed.flags.interactive) {
    let host: StandaloneHost | undefined;
    try {
      host = await StandaloneHost.create({
        profile: parsed.flags.profile,
        warn: (message) => presenter.message(message, 'stderr'),
      });
      return await runRepl(host, options);
    } catch (err: unknown) {
      presenter.error(toSafeErrorResult(err), parsed.flags.json);
      return getStandaloneExitCode(err);
    } finally {
      await host?.close().catch((err: unknown) => presenter.error(toSafeErrorResult(err), false));
    }
  }

  const registry = new StandaloneCommandRegistry();
  let host: StandaloneHost | undefined;
  try {
    const command = parsed.commandArgs[0];
    if (parsed.flags.help || command === 'help' || command === 'version') {
      const value = await registry.execute(parsed.commandArgs, {
        host: undefined as unknown as StandaloneHost,
        flags: parsed.flags,
        presenter,
        confirm: async () => false,
      });
      if (value.value !== undefined) presenter.result(value.value, parsed.flags.json);
      return 0;
    }
    host = await StandaloneHost.create({
      profile: parsed.flags.profile,
      warn: (message) => presenter.message(message, 'stderr'),
    });
    const result = await registry.execute(parsed.commandArgs, {
      host,
      flags: parsed.flags,
      presenter,
      confirm: async () => false,
    });
    if (result.value !== undefined) presenter.result(result.value, parsed.flags.json);
    return 0;
  } catch (err: unknown) {
    presenter.error(toSafeErrorResult(err), parsed.flags.json);
    return getStandaloneExitCode(err);
  } finally {
    await host?.close().catch((err: unknown) => presenter.error(toSafeErrorResult(err), false));
  }
}
