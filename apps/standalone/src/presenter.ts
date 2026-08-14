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

const HUMAN_MAX_LINES = 80;
const HUMAN_MAX_GRAPHEMES = 12_000;
const HUMAN_MAX_BYTES = 24_000;
const HUMAN_MAX_FIELD_GRAPHEMES = 240;

type GraphemeSegmenter = new (
  locales?: string | string[],
  options?: { granularity: 'grapheme' },
) => { segment(value: string): Iterable<{ segment: string }> };

function graphemes(value: string): string[] {
  const segmenterConstructor = (Intl as unknown as { Segmenter?: GraphemeSegmenter }).Segmenter;
  if (segmenterConstructor) {
    const segmenter = new segmenterConstructor('zh-CN', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), (item) => item.segment);
  }
  return Array.from(value);
}

function normalizeHumanText(value: unknown): string {
  const normalized = Array.from(String(value ?? ''), (character) => {
    const codePoint = character.codePointAt(0) || 0;
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f) ? ' ' : character;
  }).join('');
  return normalized.replace(/\s+/gu, ' ').trim();
}

function limitGraphemes(value: string, maximum: number): string {
  const parts = graphemes(value);
  if (parts.length <= maximum) return value;
  if (maximum <= 1) return '…'.slice(0, maximum);
  return `${parts.slice(0, maximum - 1).join('')}…`;
}

function humanField(value: unknown, maximum = HUMAN_MAX_FIELD_GRAPHEMES): string {
  return limitGraphemes(normalizeHumanText(value), maximum);
}

function measureHumanText(lines: string[]): { graphemeCount: number; byteCount: number } {
  const text = lines.join('\n');
  return { graphemeCount: graphemes(text).length, byteCount: Buffer.byteLength(text, 'utf8') };
}

function boundHumanLines(lines: string[]): string {
  const normalizedLines = lines.map((line) => humanField(line)).filter(Boolean);
  const kept: string[] = [];
  let truncated = false;
  for (const line of normalizedLines) {
    if (kept.length >= HUMAN_MAX_LINES) {
      truncated = true;
      break;
    }
    const candidate = [...kept, line];
    const measured = measureHumanText(candidate);
    if (measured.graphemeCount > HUMAN_MAX_GRAPHEMES || measured.byteCount > HUMAN_MAX_BYTES) {
      truncated = true;
      break;
    }
    kept.push(line);
  }

  if (truncated) {
    const marker = '…（输出已截断；完整结果请使用 JSON 模式）';
    while (kept.length > 0) {
      const candidate = [...kept, marker];
      const measured = measureHumanText(candidate);
      if (
        candidate.length <= HUMAN_MAX_LINES &&
        measured.graphemeCount <= HUMAN_MAX_GRAPHEMES &&
        measured.byteCount <= HUMAN_MAX_BYTES
      ) {
        kept.push(marker);
        break;
      }
      kept.pop();
    }
    if (kept.length === 0) kept.push(limitGraphemes(marker, HUMAN_MAX_FIELD_GRAPHEMES));
  }

  return kept.join('\n');
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
    `收藏 backlog · 状态: ${humanField(value.state || 'unknown', 64)}`,
    `摘要: 符合 ${humanField(summary.eligibleItems ?? '?', 32)} · 返回 ${humanField(summary.returnedItems ?? '?', 32)} · 已知剩余 ${humanField(summary.knownRemainingEpisodes ?? '?', 32)} 集 · 已播完未看完 ${humanField(summary.finishedIncompleteItems ?? '?', 32)} · 可计算 ${humanField(summary.completeItems ?? '?', 32)}`,
    '说明：已播完仅表示当前报告的正篇 airdate 均已过去，不证明未发布后续或排除 hiatus。',
  ];

  const error = value.error;
  if (error && typeof error === 'object') {
    const errorDetails = error as Record<string, unknown>;
    lines.push(
      `错误: ${humanField(errorDetails.code || 'UNKNOWN_ERROR', 64)} · ${humanField(errorDetails.message || '请求不可用')}${errorDetails.nextAction ? ` · ${humanField(errorDetails.nextAction)}` : ''}`,
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
        `覆盖: 收藏原始 ${humanField(collectionDetails.observedRows ?? '?', 32)} · 去重 ${humanField(collectionDetails.uniqueRows ?? '?', 32)} · 源总数 ${humanField(collectionDetails.sourceTotal ?? '?', 32)}${collectionDetails.truncated ? ' · 已截断' : ''}${collectionDetails.duplicateRows ? ` · 重复 ${humanField(collectionDetails.duplicateRows, 32)}` : ''}`,
      );
    }
    if (hydrationDetails || episodeDetails) {
      lines.push(
        `读取: 条目 ${humanField(hydrationDetails?.succeededSubjects ?? 0, 32)}/${humanField(hydrationDetails?.attemptedSubjects ?? 0, 32)} 成功 · 正篇行 raw=${humanField(episodeDetails?.observedRows ?? 0, 32)}/unique=${humanField(episodeDetails?.uniqueRows ?? '?', 32)}${hydrationDetails?.budgetExceeded ? ' · 达到 hydration 上限' : ''}`,
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
      const title = humanField(item.nameCn || item.name || `#${item.subjectId || '?'}`);
      const status = humanField(item.statusLabel || item.status || '状态未知', 96);
      const airingState = item.airingState;
      const airing =
        airingState === 'finished'
          ? '已播完（日期证据；未证明后续/hiatus）'
          : airingState === 'ongoing'
            ? '可能在播（未来日期证据）'
            : '播出状态未知';
      const progress =
        item.remainingEpisodes !== undefined
          ? `剩余 ${humanField(item.remainingEpisodes, 32)} 集 · 已看 ${humanField(item.watchedEpisodes ?? '?', 32)}/${humanField(item.episodeReportedEpisodes ?? '?', 32)}`
          : item.error && typeof item.error === 'object'
            ? (() => {
                const rowError = item.error as Record<string, unknown>;
                return `${humanField(rowError.code || 'ERROR', 64)} · ${humanField(rowError.message || '进度无法计算')}${rowError.nextAction ? ` · ${humanField(rowError.nextAction)}` : ''}`;
              })()
            : humanField(
                Array.isArray(item.reasons) ? item.reasons[0] || '进度无法计算' : '进度无法计算',
              );
      lines.push(`${index + 1}. ${title} · ${status} · ${airing}`);
      lines.push(`   ${progress} · ${humanField(item.state || 'unknown', 64)}`);
      if (airingState === 'unknown' && item.airingReason) {
        lines.push(`   播出证据：${humanField(item.airingReason)}`);
      }
    }
    if (items.length > 12)
      lines.push(`另有 ${humanField(items.length - 12, 32)} 条已返回条目未展开。`);
  }

  const warnings = value.warnings;
  if (Array.isArray(warnings) && warnings.length > 0) {
    lines.push('告警：');
    for (const warning of warnings.slice(0, 3)) {
      if (!warning || typeof warning !== 'object') {
        lines.push(`- ${humanField(warning)}`);
        continue;
      }
      const warningDetails = warning as Record<string, unknown>;
      lines.push(
        `- ${humanField(warningDetails.code || 'WARNING', 64)} · ${humanField(warningDetails.message || '')}`,
      );
    }
    if (warnings.length > 3)
      lines.push(`- 另有 ${humanField(warnings.length - 3, 32)} 条告警未展开。`);
  }

  return boundHumanLines(lines);
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
