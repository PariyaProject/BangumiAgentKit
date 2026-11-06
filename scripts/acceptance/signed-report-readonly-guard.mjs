/** Historical signature validation only; permissions deny writes/children as well. */
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';
import dnsPromises from 'node:dns/promises';
import dgram from 'node:dgram';
import { syncBuiltinESMExports } from 'node:module';
const deny = () => {
  throw Error('SIGNED_REPORT_CONTEXT_NETWORK_DENIED');
};
for (const module of [http, https]) for (const key of ['request', 'get']) module[key] = deny;
for (const [module, names] of [
  [net, ['connect', 'createConnection']],
  [tls, ['connect']],
  [dgram, ['createSocket']],
])
  for (const name of names) module[name] = deny;
net.Socket.prototype.connect = deny;
for (const module of [dns, dnsPromises])
  for (const name of Object.keys(module))
    if (
      (name === 'lookup' ||
        name === 'lookupService' ||
        name === 'reverse' ||
        name.startsWith('resolve')) &&
      typeof module[name] === 'function'
    )
      module[name] = deny;
Object.defineProperty(globalThis, 'fetch', { value: deny, configurable: false, writable: false });
syncBuiltinESMExports();
