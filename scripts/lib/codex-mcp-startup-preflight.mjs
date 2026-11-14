import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const MAX_CONFIG_BYTES = 65536;
const MAX_OUTPUT_BYTES = 65536;

/** Use one TOML table to preserve dotted tool names as literal keys. */
export function codexMcpToolLimitsOverride(server, names, limit) {
  if (
    typeof server !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,64}$/u.test(server) ||
    !Array.isArray(names) ||
    !Array.from(names).every(
      (name) => typeof name === 'string' && /^bangumi\.[a-z][a-z0-9_]{0,63}$/u.test(name),
    ) ||
    names.length < 1 ||
    names.length > 8 ||
    new Set(names).size !== names.length ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 32768
  )
    throw new TypeError('MCP_TOOL_LIMITS_INVALID');
  const entries = names.map((name) => `${JSON.stringify(name)}={output_token_limit=${limit}}`);
  return `mcp_servers.${server}.tools={${entries.join(',')}}`;
}

/** Caller-owned startup overrides only. This command never invokes Codex exec. */
export function inspectCodexMcpStartup(overrides, { cwd, env } = {}) {
  if (
    !Array.isArray(overrides) ||
    overrides.length < 1 ||
    overrides.length > 80 ||
    !Array.from(overrides).every(
      (entry) =>
        typeof entry === 'string' &&
        /^[a-zA-Z0-9_][^=\r\n]*=/u.test(entry) &&
        !entry.includes('\0'),
    ) ||
    Buffer.byteLength(JSON.stringify(overrides)) > MAX_CONFIG_BYTES
  )
    throw new TypeError('MCP_STARTUP_OVERRIDES_INVALID');

  const configSha256 = createHash('sha256').update(JSON.stringify(overrides)).digest('hex');
  const result = (reason, cliVersion = null) => ({
    accepted: reason === 'STRICT_STARTUP_CONFIG_ACCEPTED',
    reason,
    configSha256,
    cliVersion,
  });
  const metadata = spawnSync(
    'codex',
    [
      'app-server',
      '--print-startup-config',
      '--strict-config',
      ...overrides.flatMap((override) => ['--config', override]),
    ],
    {
      cwd,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
      maxBuffer: MAX_OUTPUT_BYTES,
    },
  );
  if (metadata.error || metadata.signal) return result('STRICT_STARTUP_CONFIG_UNAVAILABLE');
  let payload;
  try {
    payload = JSON.parse(metadata.stdout);
  } catch {
    return result('STRICT_STARTUP_CONFIG_UNAVAILABLE');
  }
  if (metadata.status !== 0) {
    const error = payload?.error;
    return result(
      error?.code === -32600 &&
        typeof error.message === 'string' &&
        error.message.startsWith('failed to load configuration:')
        ? 'STRICT_STARTUP_CONFIG_REJECTED'
        : 'STRICT_STARTUP_CONFIG_UNAVAILABLE',
    );
  }
  const version = payload?.appServerVersion;
  const requirements = payload?.configRequirements;
  if (
    typeof version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]{1,40})?$/u.test(version) ||
    !Object.hasOwn(payload, 'configRequirements') ||
    (requirements !== null && (typeof requirements !== 'object' || Array.isArray(requirements))) ||
    Object.hasOwn(payload, 'error')
  )
    return result('STRICT_STARTUP_CONFIG_UNAVAILABLE');
  return result('STRICT_STARTUP_CONFIG_ACCEPTED', version);
}
