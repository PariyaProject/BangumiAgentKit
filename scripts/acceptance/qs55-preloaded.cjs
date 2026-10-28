// Negative control: deliberately load qs in the actual server before its trace.
// Node --require must run this CommonJS negative control before ESM hooks.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRequire } = require('node:module');
const runtime = createRequire('/opt/bangumi/package.json');
const sdk = createRequire(runtime.resolve('@modelcontextprotocol/sdk/client/index.js'));
createRequire(sdk.resolve('express'))('qs');
