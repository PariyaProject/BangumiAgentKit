export interface StatisticsWarningCode {
  code: string;
}

const SAFE_STATISTICS_WARNING_LABELS: Record<string, string> = {
  FORMULA_EMPIRICALLY_VERIFIED: '完成率公式经样本验证，并非官方 API 契约。',
  FORMULA_SUPPRESSED: '部分评分或收藏数据未返回，相关统计无法完整计算。',
  MISSING_FIELD: '部分统计字段未返回，相关指标保持未知。',
  RATING_MEAN_CONFLICT: '官方评分与评分分布推算均值不一致，两项结果均保留。',
  RATING_TOTAL_MISMATCH: '官方评分人数与评分分布样本数不一致，两项数据均保留。',
  UPSTREAM_UNAVAILABLE: '官方统计源暂时不可用，未生成猜测值。',
  ZERO_POPULATION: '当前没有可用于计算的评分或收藏样本。',
  SUBJECT_STATE_DEGRADED: '部分条目资料不完整，缺失区段不会被当作空值。',
  COMPARISON_VALUES_UNKNOWN: '部分比较字段缺少两侧可比数据，差值保持未知。',
  COMPARISON_VALUES_CONFLICT: '部分比较字段存在来源差异，未生成差值。',
};

const SAFE_UNKNOWN_WARNING_LABEL = '存在一项来源提示，卡片只展示可确认内容。';

export function safeStatisticsWarningLabels(
  warnings: readonly StatisticsWarningCode[],
  options: { completionMethodologyAlreadyShown?: boolean } = {},
): string[] {
  const labels = warnings.flatMap(({ code }) => {
    if (code === 'FORMULA_EMPIRICALLY_VERIFIED' && options.completionMethodologyAlreadyShown) {
      return [];
    }
    return [SAFE_STATISTICS_WARNING_LABELS[code] || SAFE_UNKNOWN_WARNING_LABEL];
  });

  return [...new Set(labels)];
}

export function formatSafeStatisticsWarnings(
  warnings: readonly StatisticsWarningCode[],
  limit: number,
  options: { completionMethodologyAlreadyShown?: boolean } = {},
  overflowLabel = '告警',
): string | undefined {
  const labels = safeStatisticsWarningLabels(warnings, options);
  if (labels.length === 0) return undefined;
  const visible = labels.slice(0, limit).join('；');
  const omitted = labels.length - limit;
  return omitted > 0 ? `${visible}；另有 ${omitted} 条${overflowLabel}` : visible;
}
