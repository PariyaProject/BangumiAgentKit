import { runCli } from './cli.js';

// This file is the CLI entry only. Reusable runtime code is exported from index.ts.
runCli(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
