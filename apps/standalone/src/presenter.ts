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

function presentArtifact(value: Record<string, unknown>): string | undefined {
  const artifact = value.artifact;
  if (!artifact || typeof artifact !== 'object') return undefined;
  const ref = artifact as Record<string, unknown>;
  const dimensions = ref.width && ref.height ? ` (${ref.width}x${ref.height})` : '';
  return `Artifact: ${String(ref.id)}${dimensions}`;
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
    const collectionDashboard = presentCollectionDashboard(safe as Record<string, unknown>);
    if (collectionDashboard) return collectionDashboard;
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
