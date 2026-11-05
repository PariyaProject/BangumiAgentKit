// Deliberate server preload negative, before ESM guard installation. No real I/O.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRequire } = require('node:module');
const runtime = createRequire('/opt/bangumi/package.json');
const sdk = createRequire(runtime.resolve('@modelcontextprotocol/sdk/client/index.js'));
createRequire(sdk.resolve('express'))('qs');
