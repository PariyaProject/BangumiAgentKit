import { parseCliArgs } from './command-parser.js';
import { formatSelfTestReport, runSelfTest } from './self-test.js';

const parsed = parseCliArgs(process.argv.slice(2));
runSelfTest({
  profile: parsed.flags.profile,
  online: parsed.flags.online,
  auth: parsed.flags.auth,
  render: parsed.flags.render,
})
  .then((report) => {
    process.stdout.write(
      parsed.flags.json ? `${JSON.stringify(report)}\n` : `${formatSelfTestReport(report)}\n`,
    );
    process.exitCode = report.fail > 0 ? 1 : 0;
  })
  .catch((err: unknown) => {
    process.stderr.write(`${String(err)}\n`);
    process.exitCode = 1;
  });
