import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { observeAgentMcpFailure } from '../lib/agent-mcp-failure-observation.mjs';
import { publishAgentMcpFailure } from '../lib/agent-mcp-failure-publication.mjs';

/** Offline stdin adapter only: never launches a process or invokes a service. */
export async function main(argv = process.argv.slice(2), input = process.stdin) {
  if (
    argv.length &&
    (argv.length !== 4 || argv[0] !== '--output-directory' || argv[2] !== '--execution-directory')
  )
    throw new Error('FAILURE_OBSERVATION_ARGS_INVALID');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of input) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 12 * 1024 * 1024) throw new Error('FAILURE_OBSERVATION_INPUT_LIMIT');
    chunks.push(chunk);
  }
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8'));
  } catch {
    throw new Error('FAILURE_OBSERVATION_INPUT_INVALID');
  }
  const observation = observeAgentMcpFailure(value);
  if (argv.length)
    publishAgentMcpFailure(observation, { directory: argv[1], executionDirectory: argv[3] });
  return observation;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
    .then((observation) => process.stdout.write(JSON.stringify(observation) + '\n'))
    .catch((error) => {
      const errorCode = new Set([
        'FAILURE_OBSERVATION_ARGS_INVALID',
        'FAILURE_OBSERVATION_INPUT_LIMIT',
        'FAILURE_OBSERVATION_INPUT_INVALID',
        'FAILURE_OBSERVATION_POLICY_INVALID',
        'FAILURE_OBSERVATION_OUTPUT_LIMIT',
        'FAILURE_OBSERVATION_PUBLICATION_FAILED',
      ]).has(error?.message)
        ? error.message
        : 'FAILURE_OBSERVATION_INPUT_INVALID';
      process.stdout.write(
        JSON.stringify({ errorCode, acceptanceCredit: false, retryAllowed: false }) + '\n',
      );
      process.exitCode = 2;
    });
}
