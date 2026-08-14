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
    lines.push(
      `${index + 1}. ${String(item.displayName || item.nameCn || item.name || `#${item.id}`)}`,
    );
    lines.push(`   ID: ${String(item.id)}${item.media ? ` | ${String(item.media)}` : ''}`);
    if (item.score !== undefined) lines.push(`   评分: ${String(item.score)}`);
    if (item.date) lines.push(`   日期: ${String(item.date)}`);
  }
  const coverage = value.coverage;
  if (coverage && typeof coverage === 'object') {
    const details = coverage as Record<string, unknown>;
    lines.push(
      `覆盖: scanned=${String(details.scanned)} matched=${String(details.matched)} returned=${String(details.returned)}`,
    );
  }
  return lines.join('\n');
}

function presentCollectionBacklog(value: Record<string, unknown>): string | undefined {
  const data = value.data;
  if (!data || typeof data !== 'object') return undefined;
  const details = data as Record<string, unknown>;
  if (!Array.isArray(details.items) || !details.summary || typeof details.summary !== 'object') {
    return undefined;
  }

  const summary = details.summary as Record<string, unknown>;
  const lines = [
    `收藏 backlog · 状态: ${String(value.state || 'unknown')}`,
    `摘要: 符合 ${String(summary.eligibleItems ?? '?')} · 返回 ${String(summary.returnedItems ?? '?')} · 已知剩余 ${String(summary.knownRemainingEpisodes ?? '?')} 集 · 已完结未看完 ${String(summary.finishedIncompleteItems ?? '?')} · 可计算 ${String(summary.completeItems ?? '?')}`,
  ];

  const error = value.error;
  if (error && typeof error === 'object') {
    const errorDetails = error as Record<string, unknown>;
    lines.push(
      `错误: ${String(errorDetails.code || 'UNKNOWN_ERROR')} · ${String(errorDetails.message || '请求不可用')}${errorDetails.nextAction ? ` · ${String(errorDetails.nextAction)}` : ''}`,
    );
  }

  const coverage = value.coverage;
  if (coverage && typeof coverage === 'object') {
    const coverageDetails = coverage as Record<string, unknown>;
    const collection = coverageDetails.collection;
    const hydration = coverageDetails.hydration;
    const episodeProgress = coverageDetails.episodeProgress;
    const collectionDetails =
      collection && typeof collection === 'object'
        ? (collection as Record<string, unknown>)
        : undefined;
    const hydrationDetails =
      hydration && typeof hydration === 'object'
        ? (hydration as Record<string, unknown>)
        : undefined;
    const episodeDetails =
      episodeProgress && typeof episodeProgress === 'object'
        ? (episodeProgress as Record<string, unknown>)
        : undefined;
    if (collectionDetails) {
      lines.push(
        `覆盖: 收藏原始 ${String(collectionDetails.observedRows ?? '?')} · 去重 ${String(collectionDetails.uniqueRows ?? '?')} · 源总数 ${String(collectionDetails.sourceTotal ?? '?')}${collectionDetails.truncated ? ' · 已截断' : ''}${collectionDetails.duplicateRows ? ` · 重复 ${String(collectionDetails.duplicateRows)}` : ''}`,
      );
    }
    if (hydrationDetails || episodeDetails) {
      lines.push(
        `读取: 条目 ${String(hydrationDetails?.succeededSubjects ?? 0)}/${String(hydrationDetails?.attemptedSubjects ?? 0)} 成功 · 正篇行 ${String(episodeDetails?.observedRows ?? 0)}${hydrationDetails?.budgetExceeded ? ' · 达到 hydration 上限' : ''}`,
      );
    }
  }

  const items = details.items as unknown[];
  if (items.length === 0) {
    lines.push('条目: 没有可展示的收藏条目。');
  } else {
    for (const [index, candidate] of items.slice(0, 12).entries()) {
      if (!candidate || typeof candidate !== 'object') continue;
      const item = candidate as Record<string, unknown>;
      const title = String(item.nameCn || item.name || `#${item.subjectId || '?'}`);
      const status = String(item.statusLabel || item.status || '状态未知');
      const airing = String(item.airingState || 'unknown');
      const progress =
        item.remainingEpisodes !== undefined
          ? `剩余 ${String(item.remainingEpisodes)} 集 · 已看 ${String(item.watchedEpisodes ?? '?')}/${String(item.episodeReportedEpisodes ?? '?')}`
          : item.error && typeof item.error === 'object'
            ? `${String((item.error as Record<string, unknown>).code || 'ERROR')} · ${String((item.error as Record<string, unknown>).message || '进度无法计算')}`
            : String(
                Array.isArray(item.reasons) ? item.reasons[0] || '进度无法计算' : '进度无法计算',
              );
      lines.push(`${index + 1}. ${title} · ${status} · ${airing}`);
      lines.push(`   ${progress} · ${String(item.state || 'unknown')}`);
    }
    if (items.length > 12) lines.push(`另有 ${items.length - 12} 条已返回条目未展开。`);
  }

  const warnings = value.warnings;
  if (Array.isArray(warnings) && warnings.length > 0) {
    lines.push(
      `告警: ${warnings
        .slice(0, 3)
        .map((warning) => {
          if (!warning || typeof warning !== 'object') return String(warning);
          const item = warning as Record<string, unknown>;
          return `${String(item.code || 'WARNING')} · ${String(item.message || '')}`;
        })
        .join('；')}${warnings.length > 3 ? `；另有 ${warnings.length - 3} 条` : ''}`,
    );
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
    const collectionBacklog = presentCollectionBacklog(safe as Record<string, unknown>);
    if (collectionBacklog) return collectionBacklog;
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
