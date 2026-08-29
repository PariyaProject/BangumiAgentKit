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

function presentEpisodeGuide(value: Record<string, unknown>): string | undefined {
  if (typeof value.subjectId !== 'number' || !Array.isArray(value.items)) return undefined;
  const summary = value.summary;
  const coverage = value.coverage;
  if (!summary || typeof summary !== 'object' || !coverage || typeof coverage !== 'object') {
    return undefined;
  }
  const summaryDetails = summary as Record<string, unknown>;
  const coverageDetails = coverage as Record<string, unknown>;
  const subject = value.subject && typeof value.subject === 'object' ? value.subject : undefined;
  const subjectDetails = subject as Record<string, unknown> | undefined;
  const filters = value.filters && typeof value.filters === 'object' ? value.filters : undefined;
  const filterDetails = filters as Record<string, unknown> | undefined;
  const category = filterDetails?.category || 'all';
  const descriptionMode = filterDetails?.includeDescriptions === false ? '省略简介' : '含简介';
  const episodeCoverageState =
    coverageDetails.episodes && typeof coverageDetails.episodes === 'object'
      ? (coverageDetails.episodes as Record<string, unknown>).state
      : undefined;
  const totalLabel =
    coverageDetails.totalKind === 'exact'
      ? (coverageDetails.sourceTotal ?? '?')
      : coverageDetails.totalKind === 'conflict'
        ? `冲突(${coverageDetails.sourceTotal ?? '?'})`
        : '未知';
  const lines = [
    `章节指南 · 状态: ${humanField(value.state || 'unknown', 64)} · ${humanField(subjectDetails?.nameCn || subjectDetails?.name || `条目 ${value.subjectId}`)}`,
    `筛选: 类别 ${humanField(category, 32)} · 读取上限 ${humanField(coverageDetails.requestedMaxEpisodes ?? '?', 32)} · ${descriptionMode}`,
    `摘要: 返回 ${humanField(summaryDetails.returned ?? '?', 32)} · 观察 ${humanField(coverageDetails.observedRows ?? '?', 32)} · 总数 ${humanField(totalLabel, 32)} · 日期 ${humanField(summaryDetails.withAirdate ?? '?', 32)} · 时长 ${humanField(summaryDetails.withDuration ?? '?', 32)}`,
    `覆盖: ${humanField(coverageDetails.returnedRows ?? '?', 32)}/${humanField(coverageDetails.sourceTotal ?? '?', 32)} 返回 · ${coverageDetails.truncated ? '来源有界' : '来源未显示截断'}`,
    '说明：章节顺序是按类别、ep/sort 和 ID 的确定性排序，不代表官方观看顺序；空结果不证明没有后续内容。',
  ];
  const items = value.items as unknown[];
  if (items.length === 0) {
    lines.push(
      `章节: ${episodeCoverageState === 'unavailable' ? '官方章节源暂时不可用。' : episodeCoverageState === 'not_found' ? '官方章节源未找到章节页面。' : '没有可展示的章节；空结果不证明没有后续内容。'}`,
    );
  } else {
    for (const [index, candidate] of items.slice(0, 12).entries()) {
      if (!candidate || typeof candidate !== 'object') continue;
      const item = candidate as Record<string, unknown>;
      const number =
        item.ep !== undefined
          ? `EP ${item.ep}`
          : item.sort !== undefined
            ? `#${item.sort}`
            : `ID ${item.id}`;
      const title = humanField(item.nameCn || item.name || `章节 ${item.id}`);
      const metadata = [
        item.airdate ? `首播 ${humanField(item.airdate, 32)}` : '首播未知',
        item.duration ? `时长 ${humanField(item.duration, 32)}` : '时长未知',
        item.discussionCount !== undefined
          ? `讨论 ${humanField(item.discussionCount, 32)}`
          : '讨论未知',
      ].join(' · ');
      lines.push(`${index + 1}. ${number} · ${title}`);
      lines.push(`   ${metadata}`);
    }
    if (items.length > 12) lines.push(`另有 ${humanField(items.length - 12, 32)} 条章节未展开。`);
  }
  if (coverageDetails.renderedOmitted) {
    lines.push(`渲染器省略: ${humanField(coverageDetails.renderedOmitted, 32)} 条已返回章节。`);
  }
  if (coverageDetails.overReturnedRows || coverageDetails.sourceLimitMismatch) {
    lines.push(
      `来源上限异常: 超出返回 ${humanField(coverageDetails.overReturnedRows ?? 0, 32)} 条${coverageDetails.sourceLimitMismatch ? '，source limit 与请求不一致' : ''}。`,
    );
  }
  const missingFields = coverageDetails.missingFields;
  if (missingFields && typeof missingFields === 'object') {
    const fields = Object.entries(missingFields as Record<string, unknown>)
      .map(([field, count]) => `${field} ${count}`)
      .join('、');
    if (fields) lines.push(`缺失字段: ${humanField(fields, 220)}`);
  }
  const invalidFields = coverageDetails.invalidFields;
  if (invalidFields && typeof invalidFields === 'object') {
    const fields = Object.entries(invalidFields as Record<string, unknown>)
      .map(([field, count]) => `${field} ${count}`)
      .join('、');
    if (fields) lines.push(`无效字段: ${humanField(fields, 220)}`);
  }
  const identityConflicts = coverageDetails.identityConflicts;
  if (identityConflicts && typeof identityConflicts === 'object') {
    const fields = Object.entries(identityConflicts as Record<string, unknown>)
      .map(([field, count]) => `${field} ${count}`)
      .join('、');
    if (fields) lines.push(`身份冲突: ${humanField(fields, 220)}`);
  }
  const filterConflicts = coverageDetails.filterConflicts;
  if (filterConflicts && typeof filterConflicts === 'object') {
    const fields = Object.entries(filterConflicts as Record<string, unknown>)
      .map(([field, count]) => `${field} ${count}`)
      .join('、');
    if (fields) lines.push(`类别过滤冲突: ${humanField(fields, 220)}`);
  }
  const warnings = value.warnings;
  if (Array.isArray(warnings) && warnings.length > 0) {
    lines.push('告警：');
    for (const warning of warnings.slice(0, 3)) {
      if (!warning || typeof warning !== 'object') continue;
      const details = warning as Record<string, unknown>;
      lines.push(
        `- ${humanField(details.code || 'WARNING', 64)} · ${humanField(details.message || '')}`,
      );
    }
    if (warnings.length > 3)
      lines.push(`- 另有 ${humanField(warnings.length - 3, 32)} 条告警未展开。`);
  }
  return boundHumanLines(lines);
}

function presentCalendar(value: Record<string, unknown>): string | undefined {
  const days = Array.isArray(value.days) ? value.days : undefined;
  const coverage = comparisonRecord(value.coverage);
  if (!days || !coverage) return undefined;

  const requestedWeekday = coverage.requestedWeekday;
  const lines = [
    `每日放送 · 状态: ${comparisonStateLabel(value.state)}`,
    `筛选: ${requestedWeekday === undefined ? '整周' : `星期 ${humanField(requestedWeekday, 16)}`} · 每日上限 ${humanField(coverage.maxPerDay ?? '?', 32)} · 总上限 ${humanField(coverage.maxTotal ?? '?', 32)}`,
    `覆盖: 观察 ${humanField(coverage.observed ?? '?', 32)} · 返回 ${humanField(coverage.returned ?? '?', 32)} · 选择星期 ${humanField(coverage.selectedDays ?? '?', 32)} · 源星期 ${humanField(coverage.sourceDayCount ?? '?', 32)}/${humanField(coverage.expectedDays ?? 7, 32)}`,
    '说明：首播日期不是具体播出时刻；星期沿用官方编号，时区未由源提供；顺序不等同于推荐。',
  ];

  const error = comparisonRecord(value.error);
  if (error) {
    lines.push(
      `错误: ${humanField(error.code || 'UNKNOWN_ERROR', 64)} · ${humanField(error.message || '官方日历源不可用')}`,
    );
  }

  if (days.length === 0) {
    lines.push(
      value.state === 'unavailable'
        ? '条目: 官方日历源暂时不可用，未生成播出样本。'
        : '条目: 当前筛选没有可展示的官方日历样本。',
    );
  }

  for (const [index, rawDay] of days.slice(0, 7).entries()) {
    const day = comparisonRecord(rawDay);
    if (!day) continue;
    const items = Array.isArray(day.items) ? day.items : [];
    const weekdayDetails = comparisonRecord(day.weekday);
    const weekday = humanField(weekdayDetails?.cn || weekdayDetails?.en || `星期 ${index + 1}`, 64);
    lines.push(
      `${weekday} · 返回 ${humanField(day.returned ?? items.length, 32)} · 观察 ${humanField(day.observed ?? items.length, 32)}`,
    );
    for (const [itemIndex, rawItem] of items.slice(0, 8).entries()) {
      const item = comparisonRecord(rawItem);
      if (!item) continue;
      const title = humanField(item.nameCn || item.name || `条目 ${item.id || itemIndex + 1}`, 180);
      const alternate =
        item.nameCn && item.name && item.nameCn !== item.name
          ? ` / ${humanField(item.name, 140)}`
          : '';
      const metadata = [
        item.airDate ? `首播 ${humanField(item.airDate, 32)}` : '首播未知',
        item.typeLabel ? `类型 ${humanField(item.typeLabel, 32)}` : '类型未知',
        item.score !== undefined ? `评分 ${humanField(item.score, 32)}` : '评分未知',
        item.rank !== undefined ? `排名 ${humanField(item.rank, 32)}` : '排名未知',
      ].join(' · ');
      lines.push(`${itemIndex + 1}. ${title}${alternate}`);
      lines.push(`   ${metadata}`);
    }
    if (Number(day.overflowCount || 0) > 0) {
      lines.push(`   另有 ${humanField(day.overflowCount, 32)} 条该星期条目未展开。`);
    }
    if (items.length > 8) {
      lines.push(`   另有 ${humanField(items.length - 8, 32)} 条已返回条目未展开。`);
    }
  }
  if (days.length > 7) lines.push(`另有 ${humanField(days.length - 7, 32)} 个星期未展开。`);

  const missingWeekdays = Array.isArray(coverage.missingWeekdays) ? coverage.missingWeekdays : [];
  if (missingWeekdays.length > 0) {
    lines.push(`缺少星期: ${humanField(missingWeekdays.join('、'), 120)}`);
  }
  const missingFields = coverage.missingFields;
  if (missingFields && typeof missingFields === 'object') {
    const fields = Object.entries(missingFields as Record<string, unknown>)
      .filter(([, count]) => Number(count) > 0)
      .map(([field, count]) => `${field} ${count}`)
      .join('、');
    if (fields) lines.push(`缺失字段: ${humanField(fields, 240)}`);
  }

  const source = comparisonRecord(value.source);
  if (source) {
    lines.push(
      `来源与检索: ${humanField(source.class || 'unknown', 64)} · ${humanField(source.operation || '未记录', 96)} · ${humanField(source.retrievedAt || source.attemptedAt || '未知', 64)}`,
    );
  }
  const evidence = Array.isArray(value.evidence) ? value.evidence : [];
  const evidenceOperations = evidence
    .map(comparisonRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .flatMap((item) => [
      ...(typeof item.operation === 'string' ? [item.operation] : []),
      ...(typeof item.formulaVersion === 'string' ? [item.formulaVersion] : []),
    ]);
  if (evidenceOperations.length > 0) {
    lines.push(`证据: ${humanField([...new Set(evidenceOperations)].join(' · '), 240)}`);
  }

  const warnings = Array.isArray(value.warnings) ? value.warnings : [];
  if (warnings.length > 0) {
    lines.push('告警：');
    for (const rawWarning of warnings.slice(0, 3)) {
      const warning = comparisonRecord(rawWarning);
      if (warning) {
        lines.push(
          `- ${humanField(warning.code || 'WARNING', 64)} · ${humanField(warning.message || '')}`,
        );
      }
    }
    if (warnings.length > 3)
      lines.push(`- 另有 ${humanField(warnings.length - 3, 32)} 条告警未展开。`);
  }

  const limitations = Array.isArray(value.limitations) ? value.limitations : [];
  if (limitations.length > 0) {
    lines.push('限制：');
    for (const limitation of limitations.slice(0, 3)) lines.push(`- ${humanField(limitation)}`);
    if (limitations.length > 3) {
      lines.push(`- 另有 ${humanField(limitations.length - 3, 32)} 条限制未展开。`);
    }
  }

  return boundHumanLines(lines);
}

function comparisonRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function comparisonStateLabel(value: unknown): string {
  const labels: Record<string, string> = {
    complete: '完整',
    partial: '部分',
    unavailable: '不可用',
    not_found: '未找到',
    not_computable: '不可计算',
    unknown: '未知',
    conflict: '冲突',
  };
  return labels[String(value)] || String(value || '未知');
}

function comparisonSubjectTitle(subject: Record<string, unknown>): string {
  const details = comparisonRecord(subject.subject);
  return String(details?.nameCn || details?.name || `条目 ${subject.subjectId || '?'}`);
}

function comparisonFormattedMetricValue(key: unknown, value: unknown): string {
  const numeric = typeof value === 'number' ? value : undefined;
  if (numeric === undefined || !Number.isFinite(numeric)) return '未知';
  if (key === 'collectionCompletionRate') return `${(numeric * 100).toFixed(1)}%`;
  if (key === 'ratingMean' || key === 'ratingStandardDeviation') return numeric.toFixed(2);
  return String(numeric);
}

function comparisonMetricValue(metric: Record<string, unknown>, index: number): string {
  const values = Array.isArray(metric.values) ? metric.values : [];
  const value = values[index] === null || values[index] === undefined ? '未知' : values[index];
  const conflicts = Array.isArray(metric.conflicts) ? metric.conflicts : [];
  const conflict = conflicts
    .map(comparisonRecord)
    .find((item) => item?.side === (index === 0 ? 'A' : 'B'));
  if (!conflict) return humanField(comparisonFormattedMetricValue(metric.key, value), 120);
  const labels = [
    conflict.statsValue === undefined
      ? undefined
      : `统计 ${comparisonFormattedMetricValue(metric.key, conflict.statsValue)}`,
    conflict.subjectValue === undefined
      ? undefined
      : `详情 ${comparisonFormattedMetricValue(metric.key, conflict.subjectValue)}`,
  ];
  const candidates = Array.isArray(conflict.candidates)
    ? conflict.candidates
        .map(comparisonRecord)
        .filter((candidate): candidate is Record<string, unknown> => Boolean(candidate))
        .map((candidate) => {
          const source = comparisonRecord(candidate.source);
          const candidateValue =
            candidate.metricValue !== undefined
              ? candidate.metricValue
              : typeof candidate.value === 'number'
                ? candidate.value
                : '未知';
          return `${humanField(source?.class || 'source', 48)}/${humanField(source?.provider || '?', 48)}=${comparisonFormattedMetricValue(metric.key, candidateValue)}`;
        })
    : [];
  if (candidates.length > 0) labels.push(`候选 ${candidates.join('；')}`);
  return labels.filter((label): label is string => Boolean(label)).join(' / ') || '冲突候选未知';
}

function comparisonDeltaValue(metric: Record<string, unknown>): string {
  const state = String(metric.state || 'unknown');
  if (state === 'conflict') return '冲突，不计算';
  if (metric.delta === null || metric.delta === undefined) return '不可计算';
  const delta = Number(metric.delta);
  if (!Number.isFinite(delta)) return '不可计算';
  const formatted = comparisonFormattedMetricValue(metric.key, delta);
  return delta > 0 ? `+${formatted}` : formatted;
}

function comparisonPercentageValue(value: unknown): string {
  const numeric = typeof value === 'number' ? value : undefined;
  return numeric !== undefined && Number.isFinite(numeric) ? `${numeric.toFixed(1)}%` : '未知';
}

function comparisonStatisticsDistribution(
  value: unknown,
  labels: Record<string, string> | undefined = undefined,
): string {
  if (!Array.isArray(value)) return '未知';
  return value
    .slice(0, 10)
    .map((rawItem) => {
      const item = comparisonRecord(rawItem);
      if (!item) return undefined;
      const key = String(item.score ?? item.status ?? '?');
      const label = labels?.[key] || key;
      return `${label}=${comparisonFormattedMetricValue('ratingPopulation', item.count)} (${comparisonPercentageValue(item.percentage)})`;
    })
    .filter((item): item is string => Boolean(item))
    .join('；');
}

function comparisonStatisticsFormula(value: unknown): string | undefined {
  const formula = comparisonRecord(value);
  if (!formula) return undefined;
  return `${formula.id || 'formula'}@v${formula.version ?? '?'}`;
}

function comparisonStatisticsConflict(value: unknown): string | undefined {
  const conflict = comparisonRecord(value);
  if (!conflict) return undefined;
  const candidates = Array.isArray(conflict.candidates)
    ? conflict.candidates
        .slice(0, 3)
        .map((rawCandidate) => {
          const candidate = comparisonRecord(rawCandidate);
          const source = comparisonRecord(candidate?.source);
          return candidate
            ? `${source?.class || 'source'}/${source?.provider || '?'}=${humanField(candidate.value, 48)}`
            : undefined;
        })
        .filter((item): item is string => Boolean(item))
        .join('；')
    : '';
  const fields = Array.isArray(conflict.fieldPaths) ? conflict.fieldPaths.join(',') : '';
  return `${humanField(conflict.scope || 'unknown', 32)}${fields ? ` · ${humanField(fields, 96)}` : ''} · ${humanField(conflict.reason || 'conflict', 160)}${candidates ? ` · 候选 ${candidates}` : ''}`;
}

function comparisonStatisticsEvidence(value: unknown): string {
  if (!Array.isArray(value)) return '未记录';
  const items = value.slice(0, 6).map((rawItem) => {
    const item = comparisonRecord(rawItem);
    if (!item) return undefined;
    const operation = item.operation || item.formula || 'evidence';
    return item.fieldPath ? `${operation}:${item.fieldPath}` : operation;
  });
  const rendered = items.filter((item): item is string => typeof item === 'string');
  return `${rendered.join(' · ') || '未记录'}${value.length > 6 ? ` · +${value.length - 6}` : ''}`;
}

function presentSubjectComparison(value: Record<string, unknown>): string | undefined {
  const subjectIds = value.subjectIds;
  const subjects = value.subjects;
  const metrics = value.metrics;
  if (
    !Array.isArray(subjectIds) ||
    subjectIds.length !== 2 ||
    !Array.isArray(subjects) ||
    subjects.length !== 2 ||
    !Array.isArray(metrics)
  ) {
    return undefined;
  }

  const coverage = comparisonRecord(value.coverage);
  const lines = [
    `条目并列比较 · 状态: ${comparisonStateLabel(value.state)} · B−A · 不生成推荐或胜负结论`,
    `输入条目: ${humanField(subjectIds[0], 32)} 与 ${humanField(subjectIds[1], 32)} · 读取上限：2 个条目`,
  ];

  for (const [index, rawSubject] of subjects.entries()) {
    const subject = comparisonRecord(rawSubject);
    if (!subject) continue;
    const identity = comparisonRecord(subject.subject);
    const sections = comparisonRecord(subject.sections);
    const subjectCoverage = comparisonRecord(subject.coverage);
    const limits = comparisonRecord(subjectCoverage?.limits);
    const title = humanField(comparisonSubjectTitle(subject), 240);
    const alternateTitle = identity?.nameCn && identity?.name ? ` / ${identity.name}` : '';
    lines.push(
      `${index === 0 ? 'A' : 'B'} · ${title}${humanField(alternateTitle, 180)} · 条目 ${humanField(subject.subjectId, 32)}`,
    );
    lines.push(
      `  类型 ${humanField(identity?.type || '未知', 32)} · 日期 ${humanField(identity?.date || '未知', 32)} · 平台 ${humanField(identity?.platform || '未知', 48)}`,
    );
    lines.push(
      `  话数 ${humanField(identity?.episodesReported ?? '未知', 32)}/${humanField(identity?.totalEpisodesReported ?? '未知', 32)} · 状态 ${comparisonStateLabel(subject.state)}`,
    );
    if (sections) {
      lines.push(
        `  区段：统计 ${comparisonStateLabel(sections.stats)} · 角色 ${comparisonStateLabel(sections.cast)} · 职员 ${comparisonStateLabel(sections.staff)} · 关联 ${comparisonStateLabel(sections.relations)}`,
      );
    }
    if (subjectCoverage) {
      const truncated = Array.isArray(subjectCoverage.truncatedSections)
        ? subjectCoverage.truncatedSections
        : [];
      lines.push(
        `  覆盖：请求 ${humanField(subjectCoverage.sourceRequestsSucceeded ?? '?', 32)}/${humanField(subjectCoverage.sourceRequestsAttempted ?? '?', 32)} 成功 · 区段完整 ${humanField(subjectCoverage.sectionsComplete ?? '?', 32)} · 部分 ${humanField(subjectCoverage.sectionsPartial ?? '?', 32)} · 不可用 ${humanField(subjectCoverage.sectionsUnavailable ?? '?', 32)} · 不可计算 ${humanField(subjectCoverage.sectionsNotComputable ?? '?', 32)}${truncated.length ? ` · 截断 ${humanField(truncated.join('、'), 120)}` : ''}`,
      );
    }
    if (limits) {
      lines.push(
        `  区段上限：角色 ${humanField(limits.maxCast ?? '?', 32)} · 职员 ${humanField(limits.maxStaff ?? '?', 32)} · 关联 ${humanField(limits.maxRelations ?? '?', 32)}`,
      );
    }
    const statistics = comparisonRecord(subject.statistics);
    if (statistics) {
      const rating = comparisonRecord(statistics.rating);
      const collection = comparisonRecord(statistics.collection);
      lines.push(
        `  统计智能：${comparisonStateLabel(statistics.state)} · 评分样本 ${comparisonFormattedMetricValue('ratingPopulation', rating?.population)} · 直方图均值 ${comparisonFormattedMetricValue('ratingMean', rating?.mean)} · 标准差 ${comparisonFormattedMetricValue('ratingStandardDeviation', rating?.standardDeviation)} · 完成率 ${comparisonFormattedMetricValue('collectionCompletionRate', collection?.completionRate)}`,
      );
      lines.push(
        `  统计区段：评分 ${comparisonStateLabel(rating?.state)} · 收藏 ${comparisonStateLabel(collection?.state)} · 完成率 ${comparisonStateLabel(collection?.completionState)}`,
      );
      lines.push(
        `  评分分布：${humanField(comparisonStatisticsDistribution(rating?.distribution), 360)}`,
      );
      lines.push(
        `  收藏分布：${humanField(
          comparisonStatisticsDistribution(collection?.distribution, {
            wish: '想看',
            collect: '看过',
            doing: '在看',
            on_hold: '搁置',
            dropped: '抛弃',
          }),
          240,
        )}`,
      );
      const statisticsCoverage = comparisonRecord(statistics.coverage);
      if (statisticsCoverage) {
        lines.push(
          `  统计覆盖：评分桶 ${humanField(statisticsCoverage.ratingBucketsObserved ?? '?', 32)}/${humanField(statisticsCoverage.ratingBucketsExpected ?? '?', 32)} · 收藏桶 ${humanField(statisticsCoverage.collectionBucketsObserved ?? '?', 32)}/${humanField(statisticsCoverage.collectionBucketsExpected ?? '?', 32)} · 公式完整 ${humanField(statisticsCoverage.formulasComplete ?? '?', 32)}/${humanField(statisticsCoverage.formulasAttempted ?? '?', 32)} · 部分 ${humanField(statisticsCoverage.formulasPartial ?? '?', 32)} · 不可计算 ${humanField(statisticsCoverage.formulasNotComputable ?? '?', 32)} · 冲突 ${humanField(statisticsCoverage.formulasConflict ?? '?', 32)}`,
        );
      }
      const ratingFormulas = comparisonRecord(rating?.formulas);
      const collectionFormulas = comparisonRecord(collection?.formulas);
      const formulaLabels = [
        comparisonStatisticsFormula(ratingFormulas?.percentages),
        comparisonStatisticsFormula(ratingFormulas?.histogramMean),
        comparisonStatisticsFormula(ratingFormulas?.populationStandardDeviation),
        comparisonStatisticsFormula(collectionFormulas?.percentages),
        comparisonStatisticsFormula(collectionFormulas?.completion),
      ].filter((item): item is string => Boolean(item));
      lines.push(`  统计公式：${humanField(formulaLabels.join(' · ') || '未记录', 360)}`);
      const statisticsConflicts = [
        ...(Array.isArray(statistics.conflicts) ? statistics.conflicts : []),
        ...(Array.isArray(rating?.conflicts) ? rating.conflicts : []),
        ...(Array.isArray(collection?.conflicts) ? collection.conflicts : []),
      ]
        .slice(0, 2)
        .map(comparisonStatisticsConflict)
        .filter((item): item is string => Boolean(item));
      if (statisticsConflicts.length > 0) {
        lines.push(`  统计冲突：${humanField(statisticsConflicts.join('；'), 360)}`);
      }
      lines.push(
        `  统计证据：${humanField(comparisonStatisticsEvidence(statistics.evidence), 360)}`,
      );
    }
    const warnings = Array.isArray(subject.warnings) ? subject.warnings : [];
    for (const warning of warnings.slice(0, 2)) {
      const details = comparisonRecord(warning);
      if (details) {
        lines.push(
          `  告警：${humanField(details.code || 'WARNING', 64)} · ${humanField(details.message || '')}`,
        );
      }
    }
    if (warnings.length > 2)
      lines.push(`  另有 ${humanField(warnings.length - 2, 32)} 条条目告警未展开。`);
    const limitations = Array.isArray(subject.limitations) ? subject.limitations : [];
    for (const limitation of limitations.slice(0, 2)) {
      lines.push(`  限制：${humanField(limitation)}`);
    }
    if (limitations.length > 2)
      lines.push(`  另有 ${humanField(limitations.length - 2, 32)} 条条目限制未展开。`);
  }

  lines.push('比较字段：');
  for (const rawMetric of metrics.slice(0, 12)) {
    const metric = comparisonRecord(rawMetric);
    if (!metric) continue;
    const values = [comparisonMetricValue(metric, 0), comparisonMetricValue(metric, 1)];
    lines.push(
      `- ${humanField(metric.label || metric.key || '字段', 96)}：A ${values[0]} · B ${values[1]} · B−A ${comparisonDeltaValue(metric)}${metric.deltaPrecision !== undefined ? `（精度 ${humanField(metric.deltaPrecision, 16)} 位）` : ''}`,
    );
  }
  if (metrics.length > 12)
    lines.push(`另有 ${humanField(metrics.length - 12, 32)} 个比较字段未展开。`);

  const overlaps = comparisonRecord(value.overlaps);
  if (overlaps) {
    lines.push('共同角色与制作人员：');
    for (const [kind, label] of [
      ['cast', '共同声优'],
      ['staff', '共同制作人员'],
    ] as const) {
      const overlap = comparisonRecord(overlaps[kind]);
      if (!overlap) continue;
      const overlapCoverage = comparisonRecord(overlap.coverage);
      const leftCoverage = comparisonRecord(overlapCoverage?.left);
      const rightCoverage = comparisonRecord(overlapCoverage?.right);
      lines.push(
        `- ${label} · 状态 ${comparisonStateLabel(overlap.state)} · A 行 ${humanField(leftCoverage?.rowsReturned ?? '?', 32)}/${humanField(leftCoverage?.rowsObserved ?? '?', 32)} · B 行 ${humanField(rightCoverage?.rowsReturned ?? '?', 32)}/${humanField(rightCoverage?.rowsObserved ?? '?', 32)} · 共同 ID ${humanField(overlapCoverage?.matchedIds ?? '未知', 32)} · 返回 ${humanField(overlapCoverage?.returned ?? '?', 32)} · 省略 ${humanField(overlapCoverage?.omitted ?? '?', 32)}`,
      );
      const items = Array.isArray(overlap.items) ? overlap.items : [];
      for (const rawItem of items.slice(0, 12)) {
        const item = comparisonRecord(rawItem);
        if (!item) continue;
        const credits = Array.isArray(item.credits)
          ? item.credits
              .map(comparisonRecord)
              .filter((credit): credit is Record<string, unknown> => Boolean(credit))
              .map((credit) => {
                if (kind === 'cast') {
                  const characters = Array.isArray(credit.characters)
                    ? credit.characters
                        .map(comparisonRecord)
                        .filter((character): character is Record<string, unknown> =>
                          Boolean(character),
                        )
                        .map(
                          (character) =>
                            `${humanField(character.name || '角色未知', 96)}（${humanField(character.relation || '未知', 48)}）`,
                        )
                        .join('、')
                    : '角色未知';
                  return `${credit.side || '?'}：${characters}`;
                }
                const rawRelations = Array.isArray(credit.rawRelations)
                  ? credit.rawRelations.filter(
                      (relation): relation is string =>
                        typeof relation === 'string' && relation.length > 0,
                    )
                  : [];
                const relations = Array.isArray(credit.relations)
                  ? credit.relations.filter(
                      (relation): relation is string =>
                        typeof relation === 'string' && relation.length > 0,
                    )
                  : [];
                return `${credit.side || '?'}：${rawRelations.concat(rawRelations.length > 0 ? [] : relations).join('、') || '职位未知'}`;
              })
              .join('；')
          : '共同关系未知';
        const variants = Array.isArray(item.nameVariants)
          ? ` · 名称候选 ${item.nameVariants.map((variant) => humanField(variant, 96)).join('、')}`
          : '';
        lines.push(
          `  ${humanField(item.name || `人物 ${item.personId || '?'}`, 180)} · ID ${humanField(item.personId ?? '?', 32)}${item.career && Array.isArray(item.career) ? ` · ${item.career.map((career) => humanField(career, 48)).join('、')}` : ''} · ${credits}${variants}`,
        );
      }
      if (items.length > 12)
        lines.push(`  另有 ${humanField(items.length - 12, 32)} 个共同人物未展开。`);
      if (overlapCoverage?.truncated) {
        lines.push('  说明：交集仅代表已观察覆盖，未读取或缺失关系不等于没有共同人物。');
      }
    }
    if (overlaps.cast || overlaps.staff) {
      lines.push(`共同关系公式：${humanField(value.overlapFormulaVersion || '未知', 64)}`);
    }
  }

  if (coverage) {
    lines.push(
      `组合覆盖：身份已读取 ${humanField(coverage.returnedSubjects ?? '?', 32)}/${humanField(coverage.requestedSubjects ?? '?', 32)} · 完整 ${humanField(coverage.subjectsComplete ?? '?', 32)} · 部分 ${humanField(coverage.subjectsPartial ?? '?', 32)} · 不可用 ${humanField(coverage.subjectsUnavailable ?? '?', 32)} · 未找到 ${humanField(coverage.subjectsNotFound ?? '?', 32)}`,
    );
    const limits = comparisonRecord(coverage.limits);
    if (limits) {
      lines.push(
        `组合上限：条目 ${humanField(limits.maxSubjects ?? '?', 32)} · 角色 ${humanField(limits.maxCast ?? '?', 32)} · 职员 ${humanField(limits.maxStaff ?? '?', 32)} · 关联 ${humanField(limits.maxRelations ?? '?', 32)} · 共同人物 ${humanField(limits.maxOverlapItems ?? '?', 32)}`,
      );
    }
  }

  const source = comparisonRecord(value.source);
  for (const key of ['official', 'derived']) {
    const channel = comparisonRecord(source?.[key]);
    if (!channel) continue;
    const operations = Array.isArray(channel.operations) ? channel.operations : [];
    lines.push(
      `来源 ${key === 'official' ? 'official-v0' : 'derived-s7'}：${humanField(operations.join(' + ') || '未记录', 220)}${channel.retrievedAt ? ` · 获取于 ${humanField(channel.retrievedAt, 48)}` : ''}`,
    );
  }

  const warnings = Array.isArray(value.warnings) ? value.warnings : [];
  if (warnings.length > 0) {
    lines.push('组合告警：');
    for (const warning of warnings.slice(0, 3)) {
      const details = comparisonRecord(warning);
      if (details) {
        lines.push(
          `- ${humanField(details.code || 'WARNING', 64)} · ${humanField(details.message || '')}`,
        );
      }
    }
    if (warnings.length > 3)
      lines.push(`- 另有 ${humanField(warnings.length - 3, 32)} 条组合告警未展开。`);
  }

  const limitations = Array.isArray(value.limitations) ? value.limitations : [];
  if (limitations.length > 0) {
    lines.push('组合限制：');
    for (const limitation of limitations.slice(0, 3)) lines.push(`- ${humanField(limitation)}`);
    if (limitations.length > 3)
      lines.push(`- 另有 ${humanField(limitations.length - 3, 32)} 条组合限制未展开。`);
  }
  return boundHumanLines(lines);
}

function presentSubjectStats(value: Record<string, unknown>): string | undefined {
  const subjectId = value.subjectId;
  const raw = comparisonRecord(value.raw);
  const rating = comparisonRecord(value.rating);
  const collection = comparisonRecord(value.collection);
  if (typeof subjectId !== 'number' || !rating || !collection) return undefined;

  const completionRate =
    typeof collection.completionRate === 'number' && Number.isFinite(collection.completionRate)
      ? `${(collection.completionRate * 100).toFixed(1)}%`
      : '未知';

  const lines = [
    `条目统计智能 · 条目 ${humanField(subjectId, 32)} · 状态: ${comparisonStateLabel(value.state)}`,
    `官方评分 ${humanField(raw?.score ?? '未知', 32)} · 评分人数 ${humanField(raw?.ratingTotal ?? '未知', 32)} · 直方图均值 ${humanField(rating.mean ?? '未知', 32)} · 总体标准差 ${humanField(rating.standardDeviation ?? '未知', 32)}`,
    `收藏总数 ${humanField(collection.total ?? '未知', 32)} · 完成率 ${completionRate} · 评分区段 ${comparisonStateLabel(rating.state)} · 收藏区段 ${comparisonStateLabel(collection.state)} · 完成率状态 ${comparisonStateLabel(collection.completionState)}`,
    '说明：标准差只描述当前官方评分直方图的分散程度，不生成推荐、质量或因果结论。',
  ];

  const ratingDistribution = Array.isArray(rating.distribution) ? rating.distribution : [];
  if (ratingDistribution.length > 0) {
    lines.push('评分分布：');
    for (const item of ratingDistribution) {
      const details = comparisonRecord(item);
      if (!details) continue;
      const percentage =
        typeof details.percentage === 'number' && Number.isFinite(details.percentage)
          ? `${details.percentage.toFixed(1)}%`
          : '未知';
      lines.push(
        `- ${humanField(details.score ?? '?', 16)} 分：${humanField(details.count ?? '?', 32)} · ${percentage}`,
      );
    }
  }

  const collectionDistribution = Array.isArray(collection.distribution)
    ? collection.distribution
    : [];
  if (collectionDistribution.length > 0) {
    lines.push('收藏状态分布：');
    for (const item of collectionDistribution) {
      const details = comparisonRecord(item);
      if (!details) continue;
      const percentage =
        typeof details.percentage === 'number' && Number.isFinite(details.percentage)
          ? `${details.percentage.toFixed(1)}%`
          : '未知';
      lines.push(
        `- ${humanField(details.status ?? '?', 32)}：${humanField(details.count ?? '?', 32)} · ${percentage}`,
      );
    }
  }

  const coverage = comparisonRecord(value.coverage);
  if (coverage) {
    lines.push(
      `覆盖：来源请求 ${humanField(coverage.sourceRequestsSucceeded ?? '?', 32)}/${humanField(coverage.sourceRequestsAttempted ?? '?', 32)} 成功 · 评分桶 ${humanField(coverage.ratingBucketsObserved ?? '?', 32)}/${humanField(coverage.ratingBucketsExpected ?? '?', 32)} · 收藏桶 ${humanField(coverage.collectionBucketsObserved ?? '?', 32)}/${humanField(coverage.collectionBucketsExpected ?? '?', 32)} · 评分样本 ${humanField(coverage.ratingPopulation ?? '?', 32)} · 收藏样本 ${humanField(coverage.collectionPopulation ?? '?', 32)} · 公式完整 ${humanField(coverage.formulasComplete ?? '?', 32)}/${humanField(coverage.formulasAttempted ?? '?', 32)} · 部分 ${humanField(coverage.formulasPartial ?? '?', 32)} · 冲突 ${humanField(coverage.formulasConflict ?? '?', 32)} · 不可计算 ${humanField(coverage.formulasNotComputable ?? '?', 32)}`,
    );
  }

  const formulaGroups = [
    ['评分百分比', comparisonRecord(rating.formulas)?.percentages],
    ['直方图均值', comparisonRecord(rating.formulas)?.histogramMean],
    ['总体标准差', comparisonRecord(rating.formulas)?.populationStandardDeviation],
    ['收藏百分比', comparisonRecord(collection.formulas)?.percentages],
    ['完成率', comparisonRecord(collection.formulas)?.completion],
  ] as const;
  for (const [label, formula] of formulaGroups) {
    const details = comparisonRecord(formula);
    if (!details) continue;
    const inputs = Array.isArray(details.inputs) ? details.inputs.join(', ') : '未知';
    lines.push(
      `公式 ${label}：${humanField(details.id ?? '未知', 96)} v${humanField(details.version ?? '?', 16)} · ${humanField(details.description ?? '未知', 180)} · inputs ${humanField(inputs, 180)}`,
    );
  }

  const source = comparisonRecord(value.source);
  for (const key of ['official', 'derived']) {
    const channel = comparisonRecord(source?.[key]);
    if (!channel) continue;
    const operations = Array.isArray(channel.operations) ? channel.operations : [];
    lines.push(
      `来源 ${key === 'official' ? 'official-v0' : 'derived-s7'}：${humanField(operations.join(' + ') || '未记录', 220)}${channel.retrievedAt ? ` · 获取于 ${humanField(channel.retrievedAt, 48)}` : ''}`,
    );
  }

  const warnings = Array.isArray(value.warnings) ? value.warnings : [];
  if (warnings.length > 0) {
    lines.push('告警：');
    for (const warning of warnings.slice(0, 4)) {
      const details = comparisonRecord(warning);
      if (details) {
        lines.push(
          `- ${humanField(details.code || 'WARNING', 64)} · ${humanField(details.message || '')}`,
        );
      }
    }
    if (warnings.length > 4)
      lines.push(`- 另有 ${humanField(warnings.length - 4, 32)} 条告警未展开。`);
  }

  const limitations = Array.isArray(value.limitations) ? value.limitations : [];
  if (limitations.length > 0) {
    lines.push('限制：');
    for (const limitation of limitations.slice(0, 4)) lines.push(`- ${humanField(limitation)}`);
    if (limitations.length > 4)
      lines.push(`- 另有 ${humanField(limitations.length - 4, 32)} 条限制未展开。`);
  }
  return boundHumanLines(lines);
}

function presentSubjectStatsHistory(value: Record<string, unknown>): string | undefined {
  const subjectId = value.subjectId;
  const collection = comparisonRecord(value.collection);
  const observations = Array.isArray(value.observations) ? value.observations : undefined;
  const changes = Array.isArray(value.changes) ? value.changes : undefined;
  if (typeof subjectId !== 'number' || !collection || !observations || !changes) return undefined;
  const methodology = comparisonRecord(value.methodology);

  const lines = [
    `条目统计观察历史 · 条目 ${humanField(subjectId, 32)} · 状态: ${comparisonStateLabel(value.state)}`,
    `起始 ${humanField(collection.startedAt ?? '尚未开始', 48)} · 记录 ${humanField(collection.recordedObservations ?? '?', 32)} 条 · 保留 ${humanField(collection.retainedObservations ?? '?', 32)} 条 · 返回 ${humanField(collection.observationsReturned ?? '?', 32)} 条 · 完整 ${humanField(collection.completeObservations ?? '?', 32)} 条 · 变化组 ${humanField(collection.changePairs ?? '?', 32)}`,
    `过期 ${humanField(collection.expiredObservations ?? '?', 32)} · 容量淘汰 ${humanField(collection.prunedObservations ?? '?', 32)} · 本次保留策略 ${humanField(collection.retentionDays ?? '?', 32)} 天 · 输出上限 ${humanField(collection.maxObservations ?? '?', 32)}${collection.truncated === true ? ' · 输出有界' : ''}`,
    `方法 ${humanField(methodology?.id ?? '?', 96)}.v${humanField(methodology?.version ?? '?', 16)} · 资源活动条目 ${humanField(collection.resourceBounds ? (comparisonRecord(collection.resourceBounds)?.maxActiveSubjects ?? '?') : '?', 16)} · 跟踪条目上限 ${humanField(collection.resourceBounds ? (comparisonRecord(collection.resourceBounds)?.maxTrackedSubjects ?? '?') : '?', 16)} · host 并发 ${humanField(collection.resourceBounds ? (comparisonRecord(collection.resourceBounds)?.hostConcurrency ?? '?') : '?', 16)}`,
    collection.recordCurrent === true
      ? '本次调用显式请求了 recordCurrent；以下包含本次尝试形成的当前观察。'
      : '本次调用只读取既有观察；需要显式 recordCurrent 才会追加当前快照。',
    '说明：观察时间是本地采样时间，不等于 Bangumi 统计事件时间；不回填、不把缺失值当作零。',
  ];

  if (observations.length > 0) {
    lines.push('观察点：');
    for (const rawObservation of observations.slice(-12)) {
      const observation = comparisonRecord(rawObservation);
      if (!observation) continue;
      const snapshot = comparisonRecord(observation.snapshot);
      const compatibility = comparisonRecord(observation.compatibility);
      const raw = comparisonRecord(snapshot?.raw);
      const snapshotCollection = comparisonRecord(snapshot?.collection);
      const histogram = comparisonRecord(raw?.ratingHistogram);
      const collectionBuckets = comparisonRecord(raw?.collection);
      const coverage = comparisonRecord(snapshot?.coverage);
      const ratingBuckets = histogram
        ? Array.from({ length: 10 }, (_, index) =>
            humanField(histogram[String(index + 1)] ?? '?', 12),
          ).join('/')
        : '未知';
      const collectionValues = collectionBuckets
        ? ['wish', 'collect', 'doing', 'onHold', 'dropped']
            .map((key) => humanField(collectionBuckets[key] ?? '?', 12))
            .join('/')
        : '未知';
      lines.push(
        `- ${humanField(observation.observedAt ?? '?', 48)} · 获取 ${humanField(observation.retrievedAt ?? '?', 48)} · ${comparisonStateLabel(observation.state)} · 兼容 ${humanField(compatibility?.state ?? '?', 24)} · 评分 ${humanField(raw?.score ?? '?', 16)} · 评分人数 ${humanField(raw?.ratingTotal ?? '?', 32)} · 收藏总数 ${humanField(snapshotCollection?.total ?? '?', 32)} · 完成率 ${typeof snapshotCollection?.completionRate === 'number' ? `${(snapshotCollection.completionRate * 100).toFixed(1)}%` : '未知'}`,
      );
      lines.push(
        `  分布 评分[${humanField(ratingBuckets, 120)}] · 收藏[${humanField(collectionValues, 80)}] · 覆盖 评分 ${humanField(coverage?.ratingBucketsObserved ?? '?', 12)}/${humanField(coverage?.ratingBucketsExpected ?? '?', 12)} · 收藏 ${humanField(coverage?.collectionBucketsObserved ?? '?', 12)}/${humanField(coverage?.collectionBucketsExpected ?? '?', 12)}`,
      );
    }
    if (observations.length > 12) {
      lines.push(`- 另有 ${humanField(observations.length - 12, 32)} 条较早观察未展开。`);
    }
  } else {
    lines.push(
      collection.recordCurrent === true
        ? '当前没有形成可读取的本地观察点。'
        : '尚无历史观察；显式请求 recordCurrent 才会追加当前只读快照。',
    );
  }

  if (changes.length > 0) {
    lines.push('相邻变化：');
    for (const rawChange of changes.slice(-12)) {
      const change = comparisonRecord(rawChange);
      if (!change) continue;
      const compatibility = comparisonRecord(change.compatibility);
      const metrics = Array.isArray(change.metrics) ? change.metrics : [];
      const metricLabels = metrics.map((rawMetric) => {
        const metric = comparisonRecord(rawMetric);
        if (!metric) return undefined;
        const label = String(metric.key || '指标');
        if (metric.state === 'complete') {
          const delta = typeof metric.delta === 'number' ? metric.delta : '?';
          return `${label} ${typeof delta === 'number' && delta >= 0 ? '+' : ''}${delta}`;
        }
        return `${label} ${comparisonStateLabel(metric.state)}`;
      });
      lines.push(
        `- ${humanField(change.fromObservedAt ?? '?', 32)} → ${humanField(change.toObservedAt ?? '?', 32)} · ${comparisonStateLabel(change.state)} · 兼容 ${humanField(compatibility?.state ?? '?', 24)}${compatibility?.reason ? ` · ${humanField(compatibility.reason, 160)}` : ''} · ${humanField(metricLabels.filter((item): item is string => Boolean(item)).join(' · ') || '无可计算指标', 360)}`,
      );
    }
    if (changes.length > 12)
      lines.push(`- 另有 ${humanField(changes.length - 12, 32)} 组较早变化未展开。`);
  }

  const source = comparisonRecord(value.source);
  for (const key of ['official', 'derived']) {
    const channel = comparisonRecord(source?.[key]);
    if (!channel) continue;
    const operations = Array.isArray(channel.operations) ? channel.operations : [];
    lines.push(
      `来源 ${key === 'official' ? 'official-v0' : 'derived-s7'}：${humanField(operations.join(' + ') || '未记录', 220)} · 观察 ${humanField(channel.observationCount ?? '?', 32)} 条`,
    );
  }

  const warnings = Array.isArray(value.warnings) ? value.warnings : [];
  if (warnings.length > 0) {
    lines.push('告警：');
    for (const rawWarning of warnings.slice(0, 4)) {
      const warning = comparisonRecord(rawWarning);
      if (warning)
        lines.push(
          `- ${humanField(warning.code || 'WARNING', 64)} · ${humanField(warning.message || '')}`,
        );
    }
    if (warnings.length > 4)
      lines.push(`- 另有 ${humanField(warnings.length - 4, 32)} 条告警未展开。`);
  }
  const limitations = Array.isArray(value.limitations) ? value.limitations : [];
  if (limitations.length > 0) {
    lines.push('限制：');
    for (const limitation of limitations.slice(0, 4)) lines.push(`- ${humanField(limitation)}`);
    if (limitations.length > 4)
      lines.push(`- 另有 ${humanField(limitations.length - 4, 32)} 条限制未展开。`);
  }
  return boundHumanLines(lines);
}

function presentCollectionBacklog(value: Record<string, unknown>): string | undefined {
  const data = value.data;
  if (!data || typeof data !== 'object') return undefined;
  const details = data as Record<string, unknown>;
  if (!Array.isArray(details.items) || !details.summary || typeof details.summary !== 'object') {
    return undefined;
  }

  const summary = details.summary as Record<string, unknown>;
  const sortBy =
    details.sortBy === 'estimated_minutes_asc'
      ? '预计分钟数升序'
      : details.sortBy === 'estimated_minutes_desc'
        ? '预计分钟数降序'
        : '源顺序';
  const knownMinutes =
    typeof summary.knownEstimatedRemainingMinutes === 'number'
      ? ` · 已知待看时长 ${humanField(summary.knownEstimatedRemainingMinutes, 32)} 分`
      : '';
  const lines = [
    `收藏 backlog · 状态: ${humanField(value.state || 'unknown', 64)} · 排序: ${sortBy}`,
    `摘要: 符合 ${humanField(summary.eligibleItems ?? '?', 32)} · 返回 ${humanField(summary.returnedItems ?? '?', 32)} · 已知剩余 ${humanField(summary.knownRemainingEpisodes ?? '?', 32)} 集${knownMinutes} · 已播完未看完 ${humanField(summary.finishedIncompleteItems ?? '?', 32)} · 可计算 ${humanField(summary.completeItems ?? '?', 32)}`,
    `证据摘要: 计划匹配 ${humanField(summary.scheduleMatchedItems ?? '?', 32)} · 未观察 ${humanField(summary.scheduleNotObservedItems ?? '?', 32)} · 未知 ${humanField(summary.scheduleUnknownItems ?? '?', 32)} · 完整度高/中/低/未知 ${humanField(summary.confidenceHighItems ?? '?', 32)}/${humanField(summary.confidenceMediumItems ?? '?', 32)}/${humanField(summary.confidenceLowItems ?? '?', 32)}/${humanField(summary.confidenceUnknownItems ?? '?', 32)}`,
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
    const schedule = coverageDetails.schedule;
    const scheduleDetails =
      schedule && typeof schedule === 'object' ? (schedule as Record<string, unknown>) : undefined;
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
    if (scheduleDetails) {
      const missingWeekdays = Array.isArray(scheduleDetails.missingWeekdays)
        ? scheduleDetails.missingWeekdays.join('、') || '无'
        : '?';
      lines.push(
        `计划覆盖: ${humanField(scheduleDetails.state || 'unknown', 48)} · 星期 ${humanField(scheduleDetails.sourceDayCount ?? '?', 32)}/7 · 日历行 ${humanField(scheduleDetails.observedRows ?? '?', 32)}/unique ${humanField(scheduleDetails.uniqueRows ?? '?', 32)} · 已匹配 ${humanField(scheduleDetails.matchedItems ?? '?', 32)} · 缺少星期 ${humanField(missingWeekdays, 48)}${scheduleDetails.truncated ? ' · 已截断' : ''}`,
      );
    }
  }

  const source = value.source;
  if (source && typeof source === 'object') {
    const sourceDetails = source as Record<string, unknown>;
    lines.push(
      `来源: ${humanField(sourceDetails.class || 'unknown', 64)} · 账号范围 ${humanField(sourceDetails.authScope || 'unknown', 32)}${sourceDetails.retrievedAt ? ` · 取数 ${humanField(sourceDetails.retrievedAt, 64)}` : ''}`,
    );
    const calendar = sourceDetails.calendar;
    if (calendar && typeof calendar === 'object') {
      const calendarDetails = calendar as Record<string, unknown>;
      lines.push(
        `日历来源: ${humanField(calendarDetails.class || 'unknown', 64)} · ${humanField(calendarDetails.operation || '未记录', 96)}${calendarDetails.retrievedAt ? ` · 取数 ${humanField(calendarDetails.retrievedAt, 64)}` : ''}`,
      );
    }
  }
  const evidence = value.evidence;
  if (Array.isArray(evidence)) {
    const formulas = [
      ...new Set(
        evidence
          .filter((candidate) => candidate && typeof candidate === 'object')
          .map((candidate) => (candidate as Record<string, unknown>).formulaVersion)
          .filter(
            (formula): formula is string => typeof formula === 'string' && formula.length > 0,
          ),
      ),
    ];
    if (formulas.length > 0)
      lines.push(`证据公式: ${formulas.map((item) => humanField(item, 64)).join(' · ')}`);
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
      const duration =
        typeof item.estimatedRemainingMinutes === 'number'
          ? `已知约 ${humanField(item.estimatedRemainingMinutes, 32)} 分 · 时长 ${humanField(item.knownDurationEpisodes ?? 0, 32)}/${humanField(item.plannedEpisodes ?? 0, 32)} 集 · 来源 ${humanField(item.durationSource || 'unknown', 48)}${item.unknownDurationEpisodes ? ` · 未解析 ${humanField(item.unknownDurationEpisodes, 32)} 集` : ''}`
          : item.durationState === 'not_applicable'
            ? '待看时长 0 分'
            : `预计分钟数未知 · 来源 ${humanField(item.durationSource || 'unknown', 48)}`;
      const scheduleEvidence = comparisonRecord(item.schedule);
      const weekday = comparisonRecord(scheduleEvidence?.weekday);
      const scheduleLabel =
        scheduleEvidence?.state === 'matched'
          ? `计划 ${humanField(weekday?.cn || weekday?.en || weekday?.ja || '星期未知', 48)}${scheduleEvidence.airDate ? ` · ${humanField(scheduleEvidence.airDate, 48)}` : ''}`
          : scheduleEvidence?.state === 'not_observed'
            ? '计划未在完整七日观察中出现'
            : `计划未知 · ${humanField(scheduleEvidence?.reason || 'schedule evidence 不足', 180)}`;
      const confidence = comparisonRecord(item.confidence);
      const confidenceLabel = `证据完整度 ${humanField(confidence?.level || 'unknown', 32)}`;
      lines.push(`${index + 1}. ${title} · ${status} · ${airing}`);
      lines.push(
        `   ${progress} · ${duration} · ${scheduleLabel} · ${confidenceLabel} · ${humanField(item.state || 'unknown', 64)}`,
      );
      if (Array.isArray(confidence?.reasons) && confidence.reasons.length > 0) {
        lines.push(`   证据边界：${humanField(confidence.reasons[0], 220)}`);
      }
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

  const limitations = value.limitations;
  if (Array.isArray(limitations) && limitations.length > 0) {
    lines.push('限制：');
    for (const limitation of limitations.slice(0, 3)) {
      lines.push(`- ${humanField(limitation)}`);
    }
    if (limitations.length > 3) {
      lines.push(`- 另有 ${humanField(limitations.length - 3, 32)} 条限制未展开。`);
    }
  }

  return boundHumanLines(lines);
}

function presentCollectionSchedule(value: Record<string, unknown>): string | undefined {
  const data = value.data;
  if (!data || typeof data !== 'object') return undefined;
  const details = data as Record<string, unknown>;
  const summary = details.summary;
  if (
    !Array.isArray(details.items) ||
    !summary ||
    typeof summary !== 'object' ||
    !('matchedRows' in (summary as Record<string, unknown>))
  ) {
    return undefined;
  }

  const summaryDetails = summary as Record<string, unknown>;
  const lines = [
    `收藏本周播出计划 · 状态: ${humanField(value.state || 'unknown', 64)}`,
    `摘要: 匹配播出 ${humanField(summaryDetails.matchedRows ?? '?', 32)} · 符合收藏状态 ${humanField(summaryDetails.eligibleCollectionRows ?? '?', 32)} · 未匹配日历 ${humanField(summaryDetails.unmatchedCollectionRows ?? '?', 32)} · 日历未匹配 ${humanField(summaryDetails.unmatchedCalendarRows ?? '?', 32)}`,
    '说明：按 subject ID 对齐；日期是官方日历的首播日期证据，不等同于具体播出时刻或时区。',
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
    const calendar = coverageDetails.calendar;
    const collection = coverageDetails.collection;
    const join = coverageDetails.join;
    const calendarDetails =
      calendar && typeof calendar === 'object' ? (calendar as Record<string, unknown>) : undefined;
    const collectionDetails =
      collection && typeof collection === 'object'
        ? (collection as Record<string, unknown>)
        : undefined;
    const joinDetails =
      join && typeof join === 'object' ? (join as Record<string, unknown>) : undefined;
    if (calendarDetails || collectionDetails || joinDetails) {
      lines.push(
        `覆盖: 日历 ${humanField(calendarDetails?.observedRows ?? '?', 32)} · 收藏 ${humanField(collectionDetails?.observedRows ?? '?', 32)}/${humanField(collectionDetails?.sourceTotal ?? '?', 32)} · 对齐返回 ${humanField(joinDetails?.returnedRows ?? '?', 32)}/${humanField(joinDetails?.maxRows ?? '?', 32)}`,
      );
    }
  }

  const unmatchedCalendar = details.unmatchedCalendar;
  if (Array.isArray(unmatchedCalendar) && unmatchedCalendar.length > 0) {
    const reasonCounts = new Map<string, number>();
    for (const candidate of unmatchedCalendar) {
      if (!candidate || typeof candidate !== 'object') continue;
      const reason = String((candidate as Record<string, unknown>).reason || 'unknown');
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }
    const reasonLabels: Record<string, string> = {
      not_collected: '完整收藏扫描未发现',
      status_filtered: '收藏状态被筛选排除',
      not_observed: '收藏扫描覆盖不完整',
      invalid_collection_status: '收藏状态源值无效',
    };
    lines.push(
      `日历未匹配原因: ${[...reasonCounts.entries()]
        .map(
          ([reason, count]) =>
            `${reasonLabels[reason] || humanField(reason, 64)} ${humanField(count, 32)}`,
        )
        .join(' · ')}`,
    );
  }

  const items = details.items as unknown[];
  if (items.length === 0) {
    lines.push('条目: 没有返回匹配的收藏播出条目；空结果不证明本周没有播出。');
  } else {
    for (const [index, candidate] of items.slice(0, 12).entries()) {
      if (!candidate || typeof candidate !== 'object') continue;
      const item = candidate as Record<string, unknown>;
      const title = humanField(item.nameCn || item.name || `#${item.subjectId || '?'}`);
      const status = humanField(item.statusLabel || item.status || '状态未知', 96);
      const schedule =
        item.schedule && typeof item.schedule === 'object'
          ? (item.schedule as Record<string, unknown>)
          : {};
      const weekday =
        schedule.weekday && typeof schedule.weekday === 'object'
          ? (schedule.weekday as Record<string, unknown>)
          : {};
      const weekdayLabel = humanField(
        weekday.cn || weekday.en || weekday.ja || `星期 ${weekday.id || '?'}`,
        64,
      );
      const progress =
        item.progress && typeof item.progress === 'object'
          ? (item.progress as Record<string, unknown>)
          : {};
      const progressState = progress.state;
      const progressLabel =
        progressState === 'reported'
          ? `已看 ${humanField(progress.watchedEpisodes ?? '?', 32)}/${humanField(progress.reportedTotalEpisodes ?? '?', 32)} · 信封剩余 ${humanField(progress.reportedRemainingEpisodes ?? '?', 32)} 集`
          : `${humanField(progressState || 'unknown', 64)} · ${humanField(Array.isArray(progress.reasons) ? progress.reasons[0] || '进度无法计算' : '进度无法计算')}`;
      lines.push(
        `${index + 1}. ${title} · ${status} · ${weekdayLabel}${schedule.airDate ? ` · ${humanField(schedule.airDate, 32)}` : ''}`,
      );
      lines.push(`   ${progressLabel}`);
    }
    if (items.length > 12)
      lines.push(`另有 ${humanField(items.length - 12, 32)} 条匹配条目未展开。`);
  }

  const unmatchedCollection = details.unmatchedCollection;
  if (Array.isArray(unmatchedCollection) && unmatchedCollection.length > 0) {
    lines.push(`收藏中未匹配日历: ${humanField(unmatchedCollection.length, 32)} 条`);
    for (const candidate of unmatchedCollection.slice(0, 4)) {
      if (!candidate || typeof candidate !== 'object') continue;
      const item = candidate as Record<string, unknown>;
      lines.push(
        `- ${humanField(item.nameCn || item.name || `#${item.subjectId || '?'}`)} · ${humanField(item.statusLabel || item.status || '状态未知', 96)} · ${item.reason === 'not_on_calendar' ? '完整日历观察未发现' : '日历覆盖不完整'}`,
      );
    }
    if (unmatchedCollection.length > 4) {
      lines.push(`- 另有 ${humanField(unmatchedCollection.length - 4, 32)} 条未匹配收藏未展开。`);
    }
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

function presentCollectionSeries(value: Record<string, unknown>): string | undefined {
  const summary = value.summary;
  const groups = value.groups;
  if (!summary || typeof summary !== 'object' || !Array.isArray(groups)) {
    return undefined;
  }

  const summaryDetails = summary as Record<string, unknown>;
  const lines = [
    '收藏系列组 · 状态: ' + humanField(value.state || 'unknown', 64),
    '说明：仅按当前收藏中的直接稳定动画关系分组，不是官方 canonical watch order；未观察部分不会被补猜。',
    '摘要: 动画收藏 ' +
      humanField(summaryDetails.eligibleAnimeItems ?? '?', 32) +
      ' · 系列组 ' +
      humanField(
        value.coverage && typeof value.coverage === 'object'
          ? (value.coverage as Record<string, unknown>).output &&
            typeof (value.coverage as Record<string, unknown>).output === 'object'
            ? ((value.coverage as Record<string, unknown>).output as Record<string, unknown>)
                .returnedGroups
            : '?'
          : '?',
        32,
      ) +
      ' · 已归组 ' +
      humanField(summaryDetails.groupedItems ?? '?', 32) +
      ' · 未归组 ' +
      humanField(summaryDetails.ungroupedItems ?? '?', 32) +
      ' · 关系边 ' +
      humanField(summaryDetails.relationEdges ?? '?', 32),
  ];

  const error = value.error;
  if (error && typeof error === 'object') {
    const errorDetails = error as Record<string, unknown>;
    lines.push(
      '错误: ' +
        humanField(errorDetails.code || 'UNKNOWN_ERROR', 64) +
        ' · ' +
        humanField(errorDetails.message || '请求不可用'),
    );
  }

  for (const [index, candidate] of groups.slice(0, 12).entries()) {
    if (!candidate || typeof candidate !== 'object') continue;
    const group = candidate as Record<string, unknown>;
    const items = Array.isArray(group.items) ? group.items : [];
    const edges = Array.isArray(group.edges) ? group.edges : [];
    lines.push(
      String(index + 1) +
        '. ' +
        humanField(group.groupId || 'series-' + (index + 1), 48) +
        ' · ' +
        humanField(items.length, 32) +
        ' 个收藏条目 · ' +
        humanField(group.state || 'unknown', 32),
    );
    for (const itemCandidate of items.slice(0, 10)) {
      if (!itemCandidate || typeof itemCandidate !== 'object') continue;
      const item = itemCandidate as Record<string, unknown>;
      lines.push(
        '   - ' +
          humanField(item.nameCn || item.subjectName || '#' + (item.subjectId || '?'), 100) +
          ' · ' +
          humanField(item.statusLabel || item.status || '状态未知', 48),
      );
    }
    for (const edgeCandidate of edges.slice(0, 10)) {
      if (!edgeCandidate || typeof edgeCandidate !== 'object') continue;
      const edge = edgeCandidate as Record<string, unknown>;
      lines.push(
        '   关系: ' +
          humanField(edge.fromNameCn || edge.fromName || '#' + (edge.fromSubjectId || '?'), 48) +
          ' —' +
          humanField(edge.relation || edge.relationKind || '关联', 32) +
          '→ ' +
          humanField(edge.toNameCn || edge.toName || '#' + (edge.toSubjectId || '?'), 48) +
          ' ×' +
          humanField(edge.observedCount ?? 1, 16) +
          (edge.conflict ? ' · 冲突' : ''),
      );
    }
    if (Number(group.hiddenItemCount || 0) > 0) {
      lines.push('   另有 ' + humanField(group.hiddenItemCount, 32) + ' 项关系或条目未展开。');
    }
  }
  if (groups.length === 0) lines.push('系列组: 当前观察范围没有形成可确认的系列组。');
  if (groups.length > 12)
    lines.push('另有 ' + humanField(groups.length - 12, 32) + ' 个返回系列组未展开。');

  const ungrouped = value.ungrouped;
  if (Array.isArray(ungrouped) && ungrouped.length > 0) {
    lines.push('未归组条目: ' + humanField(ungrouped.length, 32));
    for (const itemCandidate of ungrouped.slice(0, 12)) {
      if (!itemCandidate || typeof itemCandidate !== 'object') continue;
      const item = itemCandidate as Record<string, unknown>;
      lines.push(
        '- ' +
          humanField(item.nameCn || item.subjectName || '#' + (item.subjectId || '?'), 100) +
          ' · ' +
          humanField(item.statusLabel || item.status || '状态未知', 48),
      );
    }
    if (ungrouped.length > 12) {
      lines.push('另有 ' + humanField(ungrouped.length - 12, 32) + ' 个未归组条目未展开。');
    }
  }

  const coverage = value.coverage;
  if (coverage && typeof coverage === 'object') {
    const coverageDetails = coverage as Record<string, unknown>;
    const collection =
      coverageDetails.collection && typeof coverageDetails.collection === 'object'
        ? (coverageDetails.collection as Record<string, unknown>)
        : undefined;
    const relations =
      coverageDetails.relations && typeof coverageDetails.relations === 'object'
        ? (coverageDetails.relations as Record<string, unknown>)
        : undefined;
    const output =
      coverageDetails.output && typeof coverageDetails.output === 'object'
        ? (coverageDetails.output as Record<string, unknown>)
        : undefined;
    lines.push(
      '覆盖: 收藏 ' +
        humanField(collection?.uniqueRows ?? '?', 32) +
        '/' +
        humanField(collection?.requestedMaxItems ?? '?', 32) +
        (collection?.truncated ? ' · 已截断' : '') +
        ' · 关系成功 ' +
        humanField(relations?.succeededSubjects ?? '?', 32) +
        '/' +
        humanField(relations?.requestedSubjects ?? '?', 32) +
        ' · 输出组 ' +
        humanField(output?.returnedGroups ?? '?', 32) +
        ' · 输出边 ' +
        humanField(output?.returnedEdges ?? '?', 32),
    );
  }

  const excluded = value.excludedRelations;
  if (excluded && typeof excluded === 'object') {
    const details = excluded as Record<string, unknown>;
    lines.push(
      '关系排除: 观察 ' +
        humanField(details.sourceRelations ?? '?', 32) +
        ' · 稳定 ' +
        humanField(details.stableRelations ?? '?', 32) +
        ' · 排除 ' +
        humanField(details.excludedRelations ?? '?', 32) +
        ' · 未知 ' +
        humanField(details.unknownRelations ?? '?', 32) +
        ' · 未匹配目标 ' +
        humanField(details.unmatchedTargets ?? '?', 32),
    );
  }

  const warnings = value.warnings;
  if (Array.isArray(warnings) && warnings.length > 0) {
    lines.push('告警：');
    for (const warning of warnings.slice(0, 4)) {
      if (!warning || typeof warning !== 'object') continue;
      const details = warning as Record<string, unknown>;
      lines.push(
        '- ' +
          humanField(details.code || 'WARNING', 64) +
          ' · ' +
          humanField(details.message || ''),
      );
    }
    if (warnings.length > 4) {
      lines.push('- 另有 ' + humanField(warnings.length - 4, 32) + ' 条告警未展开。');
    }
  }
  const limitations = value.limitations;
  if (Array.isArray(limitations) && limitations.length > 0) {
    lines.push('限制：');
    for (const limitation of limitations.slice(0, 4)) {
      lines.push('- ' + humanField(limitation));
    }
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

function presentPersonCollaboration(value: Record<string, unknown>): string | undefined {
  const personId = value.personId;
  const collaborators = Array.isArray(value.collaborators) ? value.collaborators : undefined;
  const coverage = comparisonRecord(value.coverage);
  const sourceOperations = Array.isArray(value.sourceOperations)
    ? value.sourceOperations
    : undefined;
  const evidence = Array.isArray(value.evidence) ? value.evidence : undefined;
  if (
    typeof personId !== 'number' ||
    !collaborators ||
    !coverage ||
    !sourceOperations ||
    !evidence
  ) {
    return undefined;
  }

  const person = comparisonRecord(value.person);
  const kindLabels: Record<string, string> = {
    voice: '声优合作',
    staff: '制作人员合作',
    all: '声优与制作人员合作',
  };
  const mediaLabels: Record<string, string> = { anime: '动画', all: '全部媒介' };
  const lines = [
    `人物合作网络 · 状态: ${comparisonStateLabel(value.state)} · ${humanField(kindLabels[String(value.kind)] || value.kind || '未知', 48)} · ${humanField(mediaLabels[String(value.media)] || value.media || '未知', 32)}`,
    `人物: ${humanField(person?.nameCn || person?.name || '未知人物', 180)} · ID ${humanField(personId, 32)}`,
  ];
  if (value.targetRole || value.collaboratorRole) {
    lines.push(
      `筛选: ${value.targetRole ? `目标标签 ${humanField(value.targetRole, 96)}` : ''}${value.targetRole && value.collaboratorRole ? ' · ' : ''}${value.collaboratorRole ? `合作方职位 ${humanField(value.collaboratorRole, 96)}` : ''}`,
    );
  }
  lines.push(
    `覆盖: 关系 ${humanField(coverage.relationRowsSelected ?? '?', 32)}/${humanField(coverage.relationRowsObserved ?? '?', 32)} · 作品 ${humanField(coverage.subjectIdsSelected ?? '?', 32)}/${humanField(coverage.subjectIdsObserved ?? '?', 32)} · fan-out ${humanField(coverage.participantRequestsSucceeded ?? '?', 32)}/${humanField(coverage.participantRequests ?? '?', 32)} 成功 · 参与者 ${humanField(coverage.participantRowsReturned ?? '?', 32)}/${humanField(coverage.participantRowsObserved ?? '?', 32)}${coverage.truncated ? ' · 有界/截断' : ''}`,
  );
  lines.push(
    `安全边界: 关系响应省略 ${humanField(coverage.relationRowsDroppedAtSourceLimit ?? 0, 32)} · 关系格式异常 ${humanField(coverage.malformedRelationRows ?? 0, 32)} · fan-out 响应省略 ${humanField(coverage.fanoutRowsDroppedAtSourceLimit ?? 0, 32)} · 参与者省略 ${humanField(coverage.participantRowsDroppedAtSourceLimit ?? 0, 32)} · 共同作品证据省略 ${humanField(coverage.sharedSubjectRowsOmittedAtLimit ?? 0, 32)}`,
  );

  lines.push('来源操作：');
  for (const rawOperation of sourceOperations.slice(0, 8)) {
    const operation = comparisonRecord(rawOperation);
    if (!operation) continue;
    const outcomes = Array.isArray(operation.outcomes) ? operation.outcomes : [];
    const outcomeText = outcomes
      .slice(0, 4)
      .map((rawOutcome) => {
        const outcome = comparisonRecord(rawOutcome);
        if (!outcome) return undefined;
        return `${outcome.state || 'unknown'}${outcome.errorCode ? `/${outcome.errorCode}` : ''}${outcome.retrievedAt ? ` @ ${outcome.retrievedAt}` : ''}`;
      })
      .filter((item): item is string => Boolean(item))
      .join(' · ');
    lines.push(
      `- ${humanField(operation.operation || 'unknown', 180)} · ${humanField(operation.succeeded ?? '?', 16)}/${humanField(operation.attempted ?? '?', 16)} 成功${operation.failed ? ` · 失败 ${humanField(operation.failed, 16)}` : ''}${operation.rowsOmitted ? ` · 省略 ${humanField(operation.rowsOmitted, 16)}` : ''}${outcomeText ? ` · ${humanField(outcomeText, 260)}` : ''}`,
    );
  }
  if (sourceOperations.length > 8) {
    lines.push(`- 另有 ${humanField(sourceOperations.length - 8, 32)} 个来源操作未展开。`);
  }

  lines.push('共同人物：');
  for (const [index, rawCollaborator] of collaborators.slice(0, 12).entries()) {
    const collaborator = comparisonRecord(rawCollaborator);
    if (!collaborator) continue;
    const sharedSubjects = Array.isArray(collaborator.sharedSubjects)
      ? collaborator.sharedSubjects
      : [];
    const sharedEvidence = sharedSubjects
      .slice(0, 3)
      .map((rawSubject) => {
        const subject = comparisonRecord(rawSubject);
        if (!subject) return undefined;
        const relationLabels = Array.isArray(subject.relationKinds)
          ? subject.relationKinds
              .filter((kind): kind is string => typeof kind === 'string')
              .map((kind) => (kind === 'voice' ? '声优' : kind === 'staff' ? '制作人员' : kind))
              .join('、')
          : '关系';
        const targetRoles = Array.isArray(subject.targetRoles)
          ? subject.targetRoles
              .filter((role): role is string => typeof role === 'string')
              .join('、')
          : '';
        const collaboratorRoles = Array.isArray(subject.collaboratorRoles)
          ? subject.collaboratorRoles
              .filter((role): role is string => typeof role === 'string')
              .join('、')
          : '';
        return `${humanField(subject.nameCn || subject.name || `条目 ${subject.id || '?'}`, 96)} · ${humanField(relationLabels || '关系', 64)}${targetRoles ? ` · 目标标签 ${humanField(targetRoles, 96)}` : ''}${collaboratorRoles ? ` · 合作方标签 ${humanField(collaboratorRoles, 96)}` : ''}`;
      })
      .filter((item): item is string => Boolean(item));
    const relationLabels = Array.isArray(collaborator.relationKinds)
      ? collaborator.relationKinds
          .filter((kind): kind is string => typeof kind === 'string')
          .map((kind) => (kind === 'voice' ? '声优' : kind === 'staff' ? '制作人员' : kind))
          .join('、')
      : '关系';
    const roleLabels = Array.isArray(collaborator.roleLabels)
      ? collaborator.roleLabels
          .filter((role): role is string => typeof role === 'string')
          .join('、')
      : '';
    lines.push(
      `${index + 1}. ${humanField(collaborator.nameCn || collaborator.name || `人物 ${collaborator.id || '?'}`, 180)} · ID ${humanField(collaborator.id ?? '?', 32)} · 共同作品 ${humanField(collaborator.uniqueSubjects ?? '?', 32)} · ${humanField(relationLabels || '关系', 64)}${roleLabels ? ` · 职位 ${humanField(roleLabels, 96)}` : ''}${sharedEvidence.length ? ` · ${sharedEvidence.join('；')}` : ''}${collaborator.sharedSubjectsOmitted ? ` · 另有 ${humanField(collaborator.sharedSubjectsOmitted, 32)} 部证据省略` : ''}`,
    );
  }
  if (collaborators.length > 12) {
    lines.push(`另有 ${humanField(collaborators.length - 12, 32)} 位合作人物未展开。`);
  }

  const exclusions = Array.isArray(value.exclusions) ? value.exclusions : [];
  if (exclusions.length > 0) {
    lines.push('未计入原因：');
    for (const rawExclusion of exclusions.slice(0, 8)) {
      const exclusion = comparisonRecord(rawExclusion);
      if (!exclusion) continue;
      const sampleSubjectIds = Array.isArray(exclusion.sampleSubjectIds)
        ? exclusion.sampleSubjectIds
            .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
            .slice(0, 5)
            .join('、')
        : '';
      lines.push(
        `- ${humanField(exclusion.reason || 'unknown', 80)}：${humanField(exclusion.count ?? '?', 32)} 条${sampleSubjectIds ? `（示例 ID：${humanField(sampleSubjectIds, 96)}）` : ''}`,
      );
    }
    if (exclusions.length > 8) {
      lines.push(`- 另有 ${humanField(exclusions.length - 8, 32)} 个未计入原因未展开。`);
    }
  }

  const formula = evidence.find((item) => {
    const details = comparisonRecord(item);
    return details?.source === 'derived-s7';
  });
  const formulaDetails = comparisonRecord(formula);
  if (formulaDetails) {
    lines.push(
      `推导公式: ${humanField(formulaDetails.formulaVersion || '未记录', 96)} · ${humanField(formulaDetails.description || '未记录', 360)}${formulaDetails.retrievedAt ? ` · 获取于 ${humanField(formulaDetails.retrievedAt, 64)}` : ''}`,
    );
  }
  const warnings = Array.isArray(value.warnings) ? value.warnings : [];
  if (warnings.length > 0) {
    lines.push('告警：');
    for (const rawWarning of warnings.slice(0, 4)) {
      const warning = comparisonRecord(rawWarning);
      if (!warning) continue;
      lines.push(
        `- ${humanField(warning.code || 'WARNING', 80)} · ${humanField(warning.message || '')}`,
      );
    }
    if (warnings.length > 4) {
      lines.push(`- 另有 ${humanField(warnings.length - 4, 32)} 条告警未展开。`);
    }
  }
  const limitations = Array.isArray(value.limitations) ? value.limitations : [];
  if (limitations.length > 0) {
    lines.push('限制：');
    for (const limitation of limitations.slice(0, 4)) lines.push(`- ${humanField(limitation)}`);
    if (limitations.length > 4) {
      lines.push(`- 另有 ${humanField(limitations.length - 4, 32)} 条限制未展开。`);
    }
  }
  return boundHumanLines(lines);
}

function presentCollectionDashboard(value: Record<string, unknown>): string | undefined {
  const data = value.data;
  if (!data || typeof data !== 'object') return undefined;
  const dataDetails = data as Record<string, unknown>;
  const sections = dataDetails.sections;
  if (!sections || typeof sections !== 'object') return undefined;

  const sectionDetails = sections as Record<string, unknown>;
  const lines = [
    `收藏 Dashboard · 状态: ${humanField(value.state || 'unknown', 64)}`,
    '说明：收藏概览、backlog 和七日播出计划是分别读取的私有只读区段；空结果不等于源为空。',
  ];

  const sectionLabel: Record<string, string> = {
    intelligence: '收藏概览',
    backlog: 'backlog',
    schedule: '七日播出计划',
  };
  const scheduleForFilters = sectionDetails.schedule;
  const scheduleResultForFilters =
    scheduleForFilters && typeof scheduleForFilters === 'object'
      ? (scheduleForFilters as Record<string, unknown>).result
      : undefined;
  const scheduleFilters =
    scheduleResultForFilters && typeof scheduleResultForFilters === 'object'
      ? (scheduleResultForFilters as Record<string, unknown>).filters
      : undefined;
  const activeStatuses =
    scheduleFilters && typeof scheduleFilters === 'object'
      ? (scheduleFilters as Record<string, unknown>).statuses
      : undefined;
  lines.push(
    `活跃状态过滤: ${Array.isArray(activeStatuses) && activeStatuses.length ? activeStatuses.map((status) => humanField(status, 24)).join('、') : '未设置'}`,
  );
  for (const name of ['intelligence', 'backlog', 'schedule']) {
    const section = sectionDetails[name];
    if (!section || typeof section !== 'object') continue;
    const details = section as Record<string, unknown>;
    lines.push(`${sectionLabel[name]} · 状态: ${humanField(details.state || 'unknown', 64)}`);
    const error = details.error;
    if (error && typeof error === 'object') {
      const errorDetails = error as Record<string, unknown>;
      lines.push(
        `  错误: ${humanField(errorDetails.code || 'ERROR', 64)} · ${humanField(errorDetails.message || '请求不可用')}`,
      );
    }
    const result = details.result;
    if (!result || typeof result !== 'object') {
      lines.push('  未生成该区段结果。');
      continue;
    }
    const resultDetails = result as Record<string, unknown>;
    const resultData = resultDetails.data;
    const resultCoverage = resultDetails.coverage;
    if (name === 'intelligence' && resultData && typeof resultData === 'object') {
      const summary = resultData as Record<string, unknown>;
      const backlog = summary.backlog as Record<string, unknown> | undefined;
      const ratings = summary.ratings as Record<string, unknown> | undefined;
      const tags = summary.tags as Record<string, unknown> | undefined;
      lines.push(
        `  backlog ${humanField(backlog?.total ?? '?', 32)} · 已评分 ${humanField(ratings?.rated ?? '?', 32)}${ratings?.average !== undefined ? ` · 平均 ${humanField(ratings.average, 32)}` : ''} · 标签 ${humanField(tags?.distinct ?? '?', 32)}`,
      );
    } else if (name === 'backlog' && resultData && typeof resultData === 'object') {
      const summary = (resultData as Record<string, unknown>).summary as
        Record<string, unknown> | undefined;
      lines.push(
        `  返回 ${humanField(summary?.returnedItems ?? '?', 32)} · 已知剩余 ${humanField(summary?.knownRemainingEpisodes ?? '?', 32)} 集 · 可计算 ${humanField(summary?.completeItems ?? '?', 32)} · 无法计算 ${humanField(summary?.notComputableItems ?? '?', 32)}`,
      );
    } else if (name === 'schedule' && resultData && typeof resultData === 'object') {
      const summary = (resultData as Record<string, unknown>).summary as
        Record<string, unknown> | undefined;
      lines.push(
        `  匹配播出 ${humanField(summary?.matchedRows ?? '?', 32)} · 收藏未匹配 ${humanField(summary?.unmatchedCollectionRows ?? '?', 32)} · 日历未匹配 ${humanField(summary?.unmatchedCalendarRows ?? '?', 32)}`,
      );
    }
    if (resultCoverage && typeof resultCoverage === 'object') {
      const coverage = resultCoverage as Record<string, unknown>;
      lines.push(`  覆盖状态: ${humanField(coverage.state || 'unknown', 64)}`);
    }
    const source = resultDetails.source;
    if (source && typeof source === 'object') {
      const sourceDetails = source as Record<string, unknown>;
      const sourceLabels =
        name === 'schedule'
          ? [
              sourceDetails.calendar && typeof sourceDetails.calendar === 'object'
                ? (sourceDetails.calendar as Record<string, unknown>).class
                : undefined,
              sourceDetails.collection && typeof sourceDetails.collection === 'object'
                ? (sourceDetails.collection as Record<string, unknown>).class
                : undefined,
            ]
              .filter(Boolean)
              .join(' + ')
          : sourceDetails.class;
      const retrievedAt =
        name === 'schedule'
          ? [
              sourceDetails.calendar && typeof sourceDetails.calendar === 'object'
                ? (sourceDetails.calendar as Record<string, unknown>).retrievedAt
                : undefined,
              sourceDetails.collection && typeof sourceDetails.collection === 'object'
                ? (sourceDetails.collection as Record<string, unknown>).retrievedAt
                : undefined,
            ]
              .filter(Boolean)
              .join(' / ')
          : sourceDetails.retrievedAt;
      lines.push(
        `  来源与检索: ${humanField(sourceLabels || 'unknown', 80)} · ${humanField(retrievedAt || '未知', 64)}`,
      );
    }
    const evidence = resultDetails.evidence;
    if (Array.isArray(evidence) && evidence.length > 0) {
      const operations = evidence.slice(0, 2).flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const details = item as Record<string, unknown>;
        return [
          ...(typeof details.operation === 'string' ? [details.operation] : []),
          ...(Array.isArray(details.operations)
            ? details.operations.filter(
                (operation): operation is string => typeof operation === 'string',
              )
            : []),
        ];
      });
      if (operations.length > 0) lines.push(`  证据: ${humanField(operations.join(' · '), 180)}`);
    }
  }

  const coverage = value.coverage;
  if (coverage && typeof coverage === 'object') {
    const details = coverage as Record<string, unknown>;
    lines.push(
      `组合覆盖: 区段 ${humanField(details.sectionsSucceeded ?? '?', 32)}/${humanField(details.sectionsInvoked ?? details.sectionsAttempted ?? '?', 32)} · 请求 ${humanField(details.sectionsRequested ?? '?', 32)} · 收藏行 ${humanField(details.collectionRowsObserved ?? '?', 32)}/${humanField(details.collectionRowsBound ?? '?', 32)} · episode 行 ${humanField(details.episodeRowsObserved ?? '?', 32)}/${humanField(details.episodeRowsRequested ?? '?', 32)}`,
    );
    lines.push(
      `  资源上限: 并发请求 ${humanField(details.maxConcurrentRequests ?? '?', 32)} · upstream 请求 ${humanField(details.upstreamRequestsBound ?? '?', 32)} · 重试尝试 ${humanField(details.upstreamAttemptsBound ?? '?', 32)} · 时限 ${humanField(details.deadlineMs ?? '?', 32)}ms · 超时区段 ${humanField(details.timedOutSections ?? '?', 32)} · 截止跳过 ${humanField(details.deadlineSkippedSections ?? '?', 32)}`,
    );
  }
  const warnings = value.warnings;
  if (Array.isArray(warnings) && warnings.length > 0) {
    lines.push('告警：');
    for (const warning of warnings.slice(0, 3)) {
      if (!warning || typeof warning !== 'object') continue;
      const warningDetails = warning as Record<string, unknown>;
      lines.push(
        `- ${humanField(warningDetails.section || 'dashboard', 48)} · ${humanField(warningDetails.code || 'WARNING', 64)} · ${humanField(warningDetails.message || '')}`,
      );
    }
    if (warnings.length > 3)
      lines.push(`- 另有 ${humanField(warnings.length - 3, 32)} 条告警未展开。`);
  }
  return boundHumanLines(lines);
}

export function formatHuman(value: unknown): string {
  const safe = sanitizeOutput(value);
  if (safe && typeof safe === 'object' && !Array.isArray(safe)) {
    const artifact = presentArtifact(safe as Record<string, unknown>);
    if (artifact) return artifact;
    const personCollaboration = presentPersonCollaboration(safe as Record<string, unknown>);
    if (personCollaboration) return personCollaboration;
    const calendar = presentCalendar(safe as Record<string, unknown>);
    if (calendar) return calendar;
    const subjectStatsHistory = presentSubjectStatsHistory(safe as Record<string, unknown>);
    if (subjectStatsHistory) return subjectStatsHistory;
    const subjectStats = presentSubjectStats(safe as Record<string, unknown>);
    if (subjectStats) return subjectStats;
    const subjectComparison = presentSubjectComparison(safe as Record<string, unknown>);
    if (subjectComparison) return subjectComparison;
    const collectionDashboard = presentCollectionDashboard(safe as Record<string, unknown>);
    if (collectionDashboard) return collectionDashboard;
    const collectionSeries = presentCollectionSeries(safe as Record<string, unknown>);
    if (collectionSeries) return collectionSeries;
    const collectionSchedule = presentCollectionSchedule(safe as Record<string, unknown>);
    if (collectionSchedule) return collectionSchedule;
    const collectionBacklog = presentCollectionBacklog(safe as Record<string, unknown>);
    if (collectionBacklog) return collectionBacklog;
    const episodeGuide = presentEpisodeGuide(safe as Record<string, unknown>);
    if (episodeGuide) return episodeGuide;
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
