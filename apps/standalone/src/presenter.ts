import { inspect } from 'node:util';

export interface OutputSink {
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

const SECRET_KEY_PATTERN =
  /(token|secret|password|authorization|credential|ciphertext|autht?ag|\biv\b)/iu;

function sanitize(value: unknown, key?: string): unknown {
  if (key && SECRET_KEY_PATTERN.test(key)) return '[REDACTED]';
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
