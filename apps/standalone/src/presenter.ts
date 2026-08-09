import { inspect } from 'node:util';

export interface OutputSink {
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

function isSecretKey(key: string): boolean {
  const normalized = key.replace(/[-_]/gu, '').toLowerCase();

  if (
    normalized === 'authorizationurl' ||
    normalized === 'authorizationcomplete' ||
    normalized === 'expiresat'
  ) {
    return false;
  }

  if (
    normalized === 'authorization' ||
    normalized === 'authorizationheader' ||
    normalized === 'authorizationvalue'
  ) {
    return true;
  }

  if (
    normalized === 'password' ||
    normalized === 'secret' ||
    normalized.endsWith('secret') ||
    normalized === 'clientsecret' ||
    normalized === 'ciphertext' ||
    normalized === 'authtag' ||
    normalized === 'iv' ||
    normalized === 'encrypted' ||
    normalized === 'credential' ||
    normalized === 'credentials' ||
    normalized.includes('credential')
  ) {
    return true;
  }

  return (
    normalized === 'token' ||
    normalized === 'accesstoken' ||
    normalized === 'refreshtoken' ||
    normalized === 'tokenvalue' ||
    normalized === 'tokenencryptionkey' ||
    (normalized.includes('encrypted') &&
      (normalized.includes('token') || normalized.includes('credential')))
  );
}

function sanitize(value: unknown, key?: string): unknown {
  if (key && isSecretKey(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      result[childKey] = sanitize(childValue, childKey);
    }
    return result;
  }
  return value;
}

export function sanitizeOutput(value: unknown): unknown {
  return sanitize(value);
}

function write(stream: NodeJS.WritableStream, text: string): void {
  stream.write(text.endsWith('\n') ? text : `${text}\n`);
}

function presentSearch(value: Record<string, unknown>): string | undefined {
  const candidates = Array.isArray(value.candidates) ? value.candidates : undefined;
  if (!candidates) return undefined;
  const lines: string[] = [];
  for (const [index, candidate] of candidates.entries()) {
    if (!candidate || typeof candidate !== 'object') continue;
    const item = candidate as Record<string, unknown>;
    const title = String(item.nameCn || item.name || `#${item.id}`);
    lines.push(`${index + 1}. ${title}`);
    lines.push(`   ID: ${String(item.id)}`);
    if (item.score !== undefined) lines.push(`   评分: ${String(item.score)}`);
    if (item.date) lines.push(`   日期: ${String(item.date)}`);
  }
  if (value.status) lines.unshift(`状态: ${String(value.status)}`);
  return lines.join('\n');
}

function presentDiscovery(value: Record<string, unknown>): string | undefined {
  const items = Array.isArray(value.items) ? value.items : undefined;
  if (!items) return undefined;
  const lines: string[] = [];
  if (value.state) lines.push(`状态: ${String(value.state)}`);
  for (const [index, candidate] of items.entries()) {
    if (!candidate || typeof candidate !== 'object') continue;
    const item = candidate as Record<string, unknown>;
    lines.push(`${index + 1}. ${String(item.displayName || item.nameCn || item.name || `#${item.id}`)}`);
    lines.push(`   ID: ${String(item.id)}${item.media ? ` | ${String(item.media)}` : ''}`);
    if (item.score !== undefined) lines.push(`   评分: ${String(item.score)}`);
    if (item.date) lines.push(`   日期: ${String(item.date)}`);
  }
  const coverage = value.coverage;
  if (coverage && typeof coverage === 'object') {
    const details = coverage as Record<string, unknown>;
    lines.push(`覆盖: scanned=${String(details.scanned)} matched=${String(details.matched)} returned=${String(details.returned)}`);
  }
  return lines.join('\n');
}

function presentArtifact(value: Record<string, unknown>): string | undefined {
  const artifact = value.artifact;
  if (!artifact || typeof artifact !== 'object') return undefined;
  const ref = artifact as Record<string, unknown>;
  const dimensions = ref.width && ref.height ? ` (${ref.width}x${ref.height})` : '';
  return `Artifact: ${String(ref.id)}${dimensions}`;
}

export function formatHuman(value: unknown): string {
  const safe = sanitizeOutput(value);
  if (safe && typeof safe === 'object' && !Array.isArray(safe)) {
    const artifact = presentArtifact(safe as Record<string, unknown>);
    if (artifact) return artifact;
    const discovery = presentDiscovery(safe as Record<string, unknown>);
    if (discovery) return discovery;
    const search = presentSearch(safe as Record<string, unknown>);
    if (search) return search;
  }
  if (typeof safe === 'string') return safe;
  return inspect(safe, { colors: false, depth: null, compact: false, breakLength: 120 });
}

export class Presenter {
  constructor(private readonly sink: OutputSink) {}

  result(value: unknown, json: boolean): void {
    const safe = sanitizeOutput(value);
    write(this.sink.stdout, json ? JSON.stringify(safe) : formatHuman(safe));
  }

  error(value: unknown, json: boolean): void {
    const safe = sanitizeOutput(value);
    write(this.sink[json ? 'stdout' : 'stderr'], json ? JSON.stringify(safe) : formatHuman(safe));
  }

  message(message: string, stream: 'stdout' | 'stderr' = 'stdout'): void {
    write(this.sink[stream], message);
  }

  get streams(): OutputSink {
    return this.sink;
  }
}
