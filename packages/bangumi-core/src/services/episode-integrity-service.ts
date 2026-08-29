import { BangumiError } from '@bangumi-agent-kit/bangumi-transport';
import {
  EpisodeGuideCategory,
  EpisodeGuideAirdateRow,
  EpisodeGuideItem,
  EpisodeGuideOptions,
  EpisodeGuideResult,
  EpisodeGuideService,
  EpisodeGuideState,
} from './episode-guide-service.js';

export type EpisodeIntegrityState = EpisodeGuideState | 'conflict' | 'not_computable';

export type EpisodeIntegrityCheckState =
  'consistent' | 'different' | 'conflict' | 'partial' | 'not_computable';

export interface EpisodeIntegrityOptions extends EpisodeGuideOptions {
  /** Explicit UTC calendar date used for the aired-count comparison. */
  asOfDate?: string;
}

export interface EpisodeIntegrityCheck {
  state: EpisodeIntegrityCheckState;
  left?: number;
  right?: number;
  difference?: number;
  reason: string;
}

export interface EpisodeIntegrityResult {
  subjectId: number;
  state: EpisodeIntegrityState;
  subject: EpisodeGuideResult['subject'];
  filters: EpisodeGuideResult['filters'];
  items: EpisodeGuideItem[];
  summary: EpisodeGuideResult['summary'];
  asOf: {
    date: string;
    source: 'explicit' | 'retrieval' | 'evaluation';
    retrievedAt?: string;
    evaluatedAt: string;
  };
  integrity: {
    state: EpisodeIntegrityState;
    formulaVersion: typeof EPISODE_INTEGRITY_FORMULA_VERSION;
    counts: {
      observedRows: number;
      uniqueRows: number;
      returnedRows: number;
      main: number;
      special: number;
      unknown: number;
      airedMain: number;
      futureMain: number;
      mainWithValidAirdate: number;
      mainWithUnknownAirdate: number;
      byCategory: Partial<Record<EpisodeGuideCategory, number>>;
    };
    subjectTotals: {
      episodesReported?: number;
      totalEpisodesReported?: number;
    };
    checks: {
      reportedVsDatabase: EpisodeIntegrityCheck;
      reportedVsObservedMain: EpisodeIntegrityCheck;
      databaseVsObservedMain: EpisodeIntegrityCheck;
      reportedVsAiredMain: EpisodeIntegrityCheck;
    };
    dateCoverage: {
      asOfDate: string;
      observedRows: number;
      uniqueRows: number;
      returnedRows: number;
      validRows: number;
      airedRows: number;
      futureRows: number;
      missingRows: number;
      invalidRows: number;
      unknownRows: number;
      state: 'complete' | 'partial' | 'not_computable';
      basis: 'explicit' | 'episode_retrieval' | 'evaluation';
      populations: {
        observed: EpisodeIntegrityDatePopulation;
        unique: EpisodeIntegrityDatePopulation;
        returned: EpisodeIntegrityDatePopulation;
        omitted: EpisodeIntegrityDatePopulation;
      };
      rows: EpisodeGuideAirdateRow[];
    };
    anomalies: {
      duplicateEpisodeIds: number;
      duplicateAirdateConflicts: number;
      duplicateLogicalKeys: number;
      airdateConflictGroups: number;
      nonMonotonicMainAirdates: number;
      missingAirdates: number;
      invalidAirdates: number;
      duplicateEpisodeIdsList: number[];
      duplicateAirdateConflictIds: number[];
      logicalAirdateConflicts: Array<{
        key: string;
        ids: number[];
        airdates: string[];
      }>;
    };
  };
  coverage: {
    state: EpisodeIntegrityState;
    episodeGuide: EpisodeGuideResult['coverage'];
    integrity: {
      state: EpisodeIntegrityState;
      denominator: 'source_exact' | 'bounded' | 'unknown';
      comparisons: 'complete' | 'partial' | 'not_computable';
    };
  };
  capabilityStates: {
    episodeProgress: 'not_computable';
    watchOrder: 'not_computable';
    airingHistory: 'not_computable';
  };
  source: EpisodeGuideResult['source'];
  evidence: EpisodeGuideResult['evidence'];
  limitations: string[];
  warnings: Array<{
    code: string;
    state: EpisodeIntegrityState;
    message: string;
  }>;
  error?: EpisodeGuideResult['error'];
}

export const EPISODE_INTEGRITY_FORMULA_VERSION = 'episode-integrity-v1' as const;

export interface EpisodeIntegrityDatePopulation {
  rows: number;
  validRows: number;
  airedRows: number;
  futureRows: number;
  missingRows: number;
  invalidRows: number;
  unknownRows: number;
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  );
}

function resolveAsOfDate(
  requestedDate: string | undefined,
  retrievedAt: string | undefined,
  evaluatedAt: string,
): EpisodeIntegrityResult['asOf'] {
  if (requestedDate !== undefined) {
    if (!validIsoDate(requestedDate)) {
      throw new BangumiError(
        'PARSER_ERROR',
        'episode-integrity.asOfDate 应为有效的 UTC 日期 YYYY-MM-DD',
        false,
      );
    }
    return {
      date: requestedDate,
      source: 'explicit',
      evaluatedAt,
      ...(retrievedAt ? { retrievedAt } : {}),
    };
  }
  if (retrievedAt && validIsoDate(retrievedAt.slice(0, 10))) {
    return { date: retrievedAt.slice(0, 10), source: 'retrieval', retrievedAt, evaluatedAt };
  }
  return {
    date: evaluatedAt.slice(0, 10),
    source: 'evaluation',
    evaluatedAt,
  };
}

function countByCategory(items: EpisodeGuideItem[]): Partial<Record<EpisodeGuideCategory, number>> {
  const counts: Partial<Record<EpisodeGuideCategory, number>> = {};
  for (const item of items) counts[item.category] = (counts[item.category] || 0) + 1;
  return counts;
}

function logicalKey(item: EpisodeGuideItem): string | undefined {
  if (item.ep !== undefined) return `${item.category}:ep:${item.ep}`;
  if (item.sort !== undefined) return `${item.category}:sort:${item.sort}`;
  return undefined;
}

function findLogicalAnomalies(items: EpisodeGuideItem[]): {
  duplicateLogicalKeys: number;
  airdateConflictGroups: number;
  nonMonotonicMainAirdates: number;
  logicalAirdateConflicts: Array<{ key: string; ids: number[]; airdates: string[] }>;
} {
  const groups = new Map<string, EpisodeGuideItem[]>();
  for (const item of items) {
    const key = logicalKey(item);
    if (!key) continue;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  let duplicateLogicalKeys = 0;
  let airdateConflictGroups = 0;
  const logicalAirdateConflicts: Array<{ key: string; ids: number[]; airdates: string[] }> = [];
  for (const [key, group] of groups.entries()) {
    if (group.length > 1) duplicateLogicalKeys += group.length - 1;
    const dates = new Set(
      group.map((item) => item.airdate).filter((date): date is string => Boolean(date)),
    );
    if (dates.size > 1) {
      airdateConflictGroups += 1;
      if (logicalAirdateConflicts.length < 24) {
        logicalAirdateConflicts.push({
          key,
          ids: group.slice(0, 12).map((item) => item.id),
          airdates: Array.from(dates).slice(0, 12),
        });
      }
    }
  }

  const mainItems = items.filter((item) => item.category === 'main');
  let previousDate: string | undefined;
  let nonMonotonicMainAirdates = 0;
  for (const item of mainItems) {
    if (!item.airdate) continue;
    if (previousDate && item.airdate < previousDate) nonMonotonicMainAirdates += 1;
    previousDate = item.airdate;
  }

  return {
    duplicateLogicalKeys,
    airdateConflictGroups,
    nonMonotonicMainAirdates,
    logicalAirdateConflicts,
  };
}

function dateRowsForGuide(guide: EpisodeGuideResult): EpisodeGuideAirdateRow[] {
  if (
    guide.coverage.airdateRows &&
    (guide.coverage.airdateRows.length > 0 || guide.items.length === 0)
  ) {
    return guide.coverage.airdateRows;
  }
  return guide.items.map((item) => ({
    id: item.id,
    quality: item.airdate ? 'valid' : 'missing',
    ...(item.airdate ? { airdate: item.airdate } : {}),
    category: item.category,
    ...(item.rawType === undefined ? {} : { rawType: item.rawType }),
    ...(item.ep === undefined ? {} : { ep: item.ep }),
    ...(item.sort === undefined ? {} : { sort: item.sort }),
    unique: true,
    returned: true,
  }));
}

function summarizeDatePopulation(
  rows: EpisodeGuideAirdateRow[],
  asOfDate: string,
): EpisodeIntegrityDatePopulation {
  const validRows = rows.filter((row) => row.quality === 'valid');
  const airedRows = validRows.filter((row) => Boolean(row.airdate && row.airdate <= asOfDate));
  const futureRows = validRows.filter((row) => Boolean(row.airdate && row.airdate > asOfDate));
  const missingRows = rows.filter((row) => row.quality === 'missing').length;
  const invalidRows = rows.filter((row) => row.quality === 'invalid').length;
  return {
    rows: rows.length,
    validRows: validRows.length,
    airedRows: airedRows.length,
    futureRows: futureRows.length,
    missingRows,
    invalidRows,
    unknownRows: missingRows + invalidRows,
  };
}

function comparison(
  left: number | undefined,
  right: number | undefined,
  options: {
    partial?: boolean;
    conflict?: boolean;
    reason: string;
  },
): EpisodeIntegrityCheck {
  if (left === undefined || right === undefined) {
    return { state: 'not_computable', reason: options.reason };
  }
  const difference = left - right;
  if (options.conflict) {
    return { state: 'conflict', left, right, difference, reason: options.reason };
  }
  if (options.partial) {
    return { state: 'partial', left, right, difference, reason: options.reason };
  }
  return {
    state: difference === 0 ? 'consistent' : 'different',
    left,
    right,
    difference,
    reason: options.reason,
  };
}

function notComputable(reason: string): EpisodeIntegrityCheck {
  return { state: 'not_computable', reason };
}

function countValue(
  subject: EpisodeGuideResult['subject'],
  field: 'episodesReported' | 'totalEpisodesReported',
): number | undefined {
  const value = subject?.[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function episodeSourceAttempt(
  source: EpisodeGuideResult['source'],
): EpisodeGuideResult['source']['attempts'][number] | undefined {
  return source.attempts.find((attempt) => attempt.operation === 'GET /v0/episodes');
}

function integrityState(
  guide: EpisodeGuideResult,
  hardConflict: boolean,
  hasAnomalies: boolean,
): EpisodeIntegrityState {
  if (guide.state === 'unavailable') return 'unavailable';
  if (guide.state === 'not_found') return 'not_found';
  if (hardConflict) return 'conflict';
  if (
    guide.items.length === 0 &&
    guide.summary.empty &&
    guide.coverage.episodes.state === 'complete'
  ) {
    return 'not_computable';
  }
  if (guide.state === 'partial' || hasAnomalies) return 'partial';
  return 'complete';
}

function limitations(): string[] {
  return [
    '已播数只把有合法 YYYY-MM-DD 首播日期且不晚于明确 UTC as-of 日期的章节计入；不推断具体播出时刻或本地时区。',
    '总数比较分别保留官方 eps、total_episodes、观察行和去重行；有界或截断页面不会被当作完整分母。',
    '逻辑冲突按同类别的 ep（没有 ep 时用 sort）分组；缺失日期与不同日期分别公开，不把未知日期当作未播。',
    '本能力不读取观看进度、官方观看顺序、播出历史、评论正文或社区来源。',
  ];
}

export class EpisodeIntegrityService {
  private readonly guideService: EpisodeGuideService;

  constructor(
    client: ConstructorParameters<typeof EpisodeGuideService>[0],
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.guideService = new EpisodeGuideService(client);
  }

  async getEpisodeIntegrity(
    subjectId: number,
    options: EpisodeIntegrityOptions = {},
  ): Promise<EpisodeIntegrityResult> {
    const { asOfDate: requestedAsOfDate, ...guideOptions } = options;
    if (requestedAsOfDate !== undefined && !validIsoDate(requestedAsOfDate)) {
      throw new BangumiError(
        'PARSER_ERROR',
        'episode-integrity.asOfDate 应为有效的 UTC 日期 YYYY-MM-DD',
        false,
      );
    }
    const guide = await this.guideService.getEpisodeGuide(subjectId, {
      ...guideOptions,
      includeDescriptions: guideOptions.includeDescriptions ?? false,
    });
    const evaluatedAt = this.clock().toISOString();
    const episodeAttempt = episodeSourceAttempt(guide.source);
    const episodeRetrievedAt =
      episodeAttempt?.state === 'complete' ? episodeAttempt.retrievedAt : undefined;
    const asOf = resolveAsOfDate(requestedAsOfDate, episodeRetrievedAt, evaluatedAt);
    const asOfDate = asOf.date;
    const mainItems = guide.items.filter((item) => item.category === 'main');
    const specialItems = guide.items.filter(
      (item) => item.category !== 'main' && item.category !== 'unknown',
    );
    const unknownItems = guide.items.filter((item) => item.category === 'unknown');
    const airedMainItems = mainItems.filter((item) =>
      Boolean(item.airdate && item.airdate <= asOfDate),
    );
    const futureMainItems = mainItems.filter((item) =>
      Boolean(item.airdate && item.airdate > asOfDate),
    );
    const dateRows = dateRowsForGuide(guide);
    const uniqueDateRows = dateRows.filter((row) => row.unique);
    const returnedDateRows = dateRows.filter((row) => row.returned);
    const omittedDateRows = dateRows.filter((row) => row.unique && !row.returned);
    const datePopulations = {
      observed: summarizeDatePopulation(dateRows, asOfDate),
      unique: summarizeDatePopulation(uniqueDateRows, asOfDate),
      returned: summarizeDatePopulation(returnedDateRows, asOfDate),
      omitted: summarizeDatePopulation(omittedDateRows, asOfDate),
    };
    const missingAirdates = datePopulations.returned.missingRows;
    const invalidAirdates = datePopulations.returned.invalidRows;
    const anomalies = findLogicalAnomalies(guide.items);
    const duplicateAirdateConflicts = guide.coverage.duplicateConflicts?.['episode.airdate'] || 0;
    const duplicateEpisodeIdsList = Array.from(
      new Set(dateRows.filter((row) => !row.unique).map((row) => row.id)),
    ).slice(0, 24);
    const duplicateAirdateConflictIds = Array.from(
      new Set(
        Array.from(
          dateRows
            .reduce((groups, row) => {
              const group = groups.get(row.id) || [];
              group.push(row);
              groups.set(row.id, group);
              return groups;
            }, new Map<number, EpisodeGuideAirdateRow[]>())
            .entries(),
        )
          .filter(([, rows]) => {
            if (rows.length < 2) return false;
            const dates = new Set(
              rows
                .map((row) => row.airdate || row.rawAirdate)
                .filter((value): value is string => Boolean(value)),
            );
            return dates.size > 1;
          })
          .map(([id]) => id),
      ),
    ).slice(0, 24);
    const subjectEpisodes = countValue(guide.subject, 'episodesReported');
    const subjectTotalEpisodes = countValue(guide.subject, 'totalEpisodesReported');
    const categoryFiltered = guide.filters.category !== 'all';
    const pagePartial =
      guide.state === 'partial' ||
      guide.coverage.truncated ||
      guide.coverage.duplicateRows > 0 ||
      guide.coverage.episodes.state !== 'complete';
    const episodeSourceAvailable =
      guide.coverage.episodes.state === 'complete' &&
      (!episodeAttempt || episodeAttempt.state === 'complete');
    const dateCoverageState = !episodeSourceAvailable
      ? 'not_computable'
      : categoryFiltered ||
          guide.state === 'partial' ||
          guide.coverage.truncated ||
          dateRows.some((row) => !row.unique)
        ? 'partial'
        : 'complete';
    const dateCoverageBasis =
      requestedAsOfDate !== undefined
        ? 'explicit'
        : episodeRetrievedAt !== undefined
          ? 'episode_retrieval'
          : 'evaluation';
    const comparisonUnavailableReason = categoryFiltered
      ? '类别筛选只返回部分章节类别，不能将观察行与条目总数作完整比较。'
      : '官方条目总数或章节页面覆盖不足，不能作完整比较。';
    const checks = {
      reportedVsDatabase: comparison(subjectEpisodes, subjectTotalEpisodes, {
        conflict:
          subjectEpisodes !== undefined &&
          subjectTotalEpisodes !== undefined &&
          subjectEpisodes !== subjectTotalEpisodes,
        reason: '比较官方 subject.eps（wiki 报告）与 subject.total_episodes（数据库报告）。',
      }),
      reportedVsObservedMain: categoryFiltered
        ? notComputable(comparisonUnavailableReason)
        : comparison(subjectEpisodes, mainItems.length, {
            partial: pagePartial,
            reason: '比较官方 subject.eps 与本次章节页面观察到的正篇去重行。',
          }),
      databaseVsObservedMain: categoryFiltered
        ? notComputable(comparisonUnavailableReason)
        : comparison(subjectTotalEpisodes, mainItems.length, {
            partial: pagePartial,
            reason: '比较官方 subject.total_episodes 与本次章节页面观察到的正篇去重行。',
          }),
      reportedVsAiredMain: categoryFiltered
        ? notComputable(comparisonUnavailableReason)
        : comparison(subjectEpisodes, airedMainItems.length, {
            partial: pagePartial,
            reason: '比较官方 subject.eps 与截至 UTC as-of 日期已播的正篇行；未来日期不计入。',
          }),
    };
    const hardConflict =
      checks.reportedVsDatabase.state === 'conflict' ||
      guide.coverage.totalKind === 'conflict' ||
      anomalies.airdateConflictGroups > 0 ||
      duplicateAirdateConflicts > 0 ||
      Object.keys(guide.coverage.identityConflicts).length > 0 ||
      Object.keys(guide.coverage.filterConflicts).length > 0;
    const hasNotComputableCheck = Object.values(checks).some(
      (check) => check.state === 'not_computable',
    );
    const hasAnomalies =
      categoryFiltered ||
      guide.coverage.duplicateRows > 0 ||
      duplicateAirdateConflicts > 0 ||
      anomalies.duplicateLogicalKeys > 0 ||
      anomalies.nonMonotonicMainAirdates > 0 ||
      missingAirdates > 0 ||
      invalidAirdates > 0 ||
      (guide.coverage.unknownTypeRows || 0) > 0 ||
      hasNotComputableCheck;
    const state = integrityState(guide, hardConflict, hasAnomalies);
    const comparisons =
      categoryFiltered || pagePartial
        ? 'partial'
        : checks.reportedVsDatabase.state === 'not_computable' ||
            checks.reportedVsObservedMain.state === 'not_computable'
          ? 'not_computable'
          : 'complete';
    const denominator =
      guide.coverage.totalKind === 'exact' && !guide.coverage.truncated
        ? 'source_exact'
        : guide.coverage.totalKind === 'unknown'
          ? 'unknown'
          : 'bounded';

    const warnings: EpisodeIntegrityResult['warnings'] = [...guide.warnings];
    if (state === 'conflict') {
      warnings.push({
        code: 'EPISODE_INTEGRITY_CONFLICT',
        state,
        message: '章节总数或逻辑首播日期存在冲突；冲突字段已保留，未强行选择一个真值。',
      });
    } else if (state === 'partial') {
      warnings.push({
        code: 'EPISODE_INTEGRITY_PARTIAL',
        state,
        message: '章节完整性结论受有界覆盖、缺失/无效日期或重复观察影响；未把未知日期当作未播。',
      });
    } else if (state === 'not_computable') {
      warnings.push({
        code: 'EPISODE_INTEGRITY_NOT_COMPUTABLE',
        state,
        message: '本次没有足够的章节观察来计算完整性结论；空结果不证明条目没有章节。',
      });
    }
    if (asOf.source === 'evaluation') {
      warnings.push({
        code: 'AS_OF_EVALUATION_ONLY',
        state,
        message:
          '章节源没有成功返回可用的获取时间；UTC as-of 仅标记本次评估日期，不把评估时钟伪装成章节源获取时间。',
      });
    }
    return {
      subjectId,
      state,
      subject: guide.subject,
      filters: guide.filters,
      items: guide.items,
      summary: guide.summary,
      asOf,
      integrity: {
        state,
        formulaVersion: EPISODE_INTEGRITY_FORMULA_VERSION,
        counts: {
          observedRows: guide.coverage.observedRows,
          uniqueRows: guide.coverage.uniqueRows,
          returnedRows: guide.coverage.returnedRows,
          main: mainItems.length,
          special: specialItems.length,
          unknown: unknownItems.length,
          airedMain: airedMainItems.length,
          futureMain: futureMainItems.length,
          mainWithValidAirdate: mainItems.filter((item) => Boolean(item.airdate)).length,
          mainWithUnknownAirdate: mainItems.filter((item) => !item.airdate).length,
          byCategory: countByCategory(guide.items),
        },
        subjectTotals: {
          ...(subjectEpisodes === undefined ? {} : { episodesReported: subjectEpisodes }),
          ...(subjectTotalEpisodes === undefined
            ? {}
            : { totalEpisodesReported: subjectTotalEpisodes }),
        },
        checks,
        dateCoverage: {
          asOfDate,
          observedRows: datePopulations.observed.rows,
          uniqueRows: datePopulations.unique.rows,
          returnedRows: datePopulations.returned.rows,
          validRows: datePopulations.returned.validRows,
          airedRows: datePopulations.returned.airedRows,
          futureRows: datePopulations.returned.futureRows,
          missingRows: datePopulations.returned.missingRows,
          invalidRows: datePopulations.returned.invalidRows,
          unknownRows: datePopulations.returned.unknownRows,
          state: dateCoverageState,
          basis: dateCoverageBasis,
          populations: datePopulations,
          rows: dateRows,
        },
        anomalies: {
          duplicateEpisodeIds: guide.coverage.duplicateRows,
          duplicateAirdateConflicts,
          duplicateLogicalKeys: anomalies.duplicateLogicalKeys,
          airdateConflictGroups: anomalies.airdateConflictGroups,
          nonMonotonicMainAirdates: anomalies.nonMonotonicMainAirdates,
          missingAirdates,
          invalidAirdates,
          duplicateEpisodeIdsList,
          duplicateAirdateConflictIds,
          logicalAirdateConflicts: anomalies.logicalAirdateConflicts,
        },
      },
      coverage: {
        state,
        episodeGuide: guide.coverage,
        integrity: {
          state,
          denominator,
          comparisons,
        },
      },
      capabilityStates: {
        episodeProgress: 'not_computable',
        watchOrder: 'not_computable',
        airingHistory: 'not_computable',
      },
      source: guide.source,
      evidence: [
        ...guide.evidence,
        {
          source: 'derived',
          operations: ['episode-integrity-composition'],
          attemptedAt: evaluatedAt,
          formulaVersion: EPISODE_INTEGRITY_FORMULA_VERSION,
          description:
            '由官方 v0 subject 与 episodes 章节指南组合；只比较合法日期与明确 UTC as-of 日期，保留观察/去重/截断、类别、日期和逻辑冲突状态。',
        },
      ],
      limitations: [...guide.limitations, ...limitations()],
      warnings,
      ...(guide.error ? { error: guide.error } : {}),
    };
  }
}
