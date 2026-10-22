import React from 'react';
import type { SubjectStatsViewModel } from '../view-models/index.js';
import type { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { RendererIcon } from '../components/RendererIcon.js';
import { safeStatisticsWarningLabels } from './statisticsWarningLabels.js';

export interface SubjectStatsCardProps {
  viewModel: SubjectStatsViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
  width?: number;
}

function stateLabel(state: SubjectStatsViewModel['state'] | string): string {
  return (
    (
      {
        complete: '覆盖完整',
        partial: '部分覆盖',
        conflict: '存在冲突',
        unavailable: '不可用',
        not_found: '未找到',
        not_computable: '不可计算',
      } as Record<string, string>
    )[state] || state
  );
}

function metricStateLabel(state: string): string {
  return (
    {
      complete: '可计算',
      partial: '数据不全',
      conflict: '来源不一致',
      unavailable: '不可用',
      not_computable: '无法计算',
      unknown: '未知',
    }[state] || '未知'
  );
}

function formatNumber(value: number | undefined, digits = 0): string {
  return value === undefined || !Number.isFinite(value)
    ? '未知'
    : value.toLocaleString('zh-CN', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
}

function formatConflictValue(value: unknown): string {
  if (typeof value === 'number') return formatNumber(value, 2);
  if (value === null || value === undefined) return '未知';
  if (typeof value === 'string' || typeof value === 'boolean') return String(value);
  return '复杂数据；完整内容见详细结果';
}

function formatPercent(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '未知' : `${value.toFixed(1)}%`;
}

function formatRatioPercent(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '未知' : `${(value * 100).toFixed(1)}%`;
}

const collectionLabels: Record<string, string> = {
  wish: '想看',
  collect: '看过',
  doing: '在看',
  on_hold: '搁置',
  dropped: '抛弃',
};

const CONFLICT_FIELD_LABELS: Record<string, string> = {
  score: '官方评分',
  'rating.score': '官方评分',
  histogramMean: '评分分布均值',
  'rating.histogramMean': '评分分布均值',
  'rating.standardDeviation': '评分离散度',
  standardDeviation: '评分离散度',
  'rating.population': '评分样本数',
  'rating.distribution': '评分分布',
  'collection.total': '收藏人数',
  'collection.completionRate': '完成率',
  'collection.distribution': '收藏状态分布',
};

function formatRetrievedAt(value: string | undefined): string {
  if (!value) return '未记录';
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : value;
}

function conflictSourceLabel(source: { class: string; provider: string }): string {
  if (source.class === 'official-v0' || source.provider === 'bangumi') return '官方条目数据';
  if (source.class === 'derived-s7' || source.provider === 'bangumi-agent-kit') return '按分布推算';
  return '其他数据来源';
}

function uniqueStatsConflicts(
  viewModel: SubjectStatsViewModel,
): NonNullable<SubjectStatsViewModel['rating']['conflicts']> {
  const conflicts = [
    ...(viewModel.rating.conflicts || []),
    ...(viewModel.collection.conflicts || []),
    ...(viewModel.conflicts || []),
  ];
  const seen = new Set<string>();
  return conflicts.filter((conflict) => {
    const key = JSON.stringify([
      conflict.scope,
      conflict.fieldPaths,
      conflict.reason,
      conflict.candidates.map((candidate) => [
        candidate.source.class,
        candidate.source.provider,
        candidate.value,
      ]),
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function statsConflictLabel(
  conflict: NonNullable<SubjectStatsViewModel['rating']['conflicts']>[number],
): string {
  const labels = (conflict.fieldPaths || []).map((fieldPath) => {
    if (CONFLICT_FIELD_LABELS[fieldPath]) return CONFLICT_FIELD_LABELS[fieldPath];
    if (/^rating\.count\./u.test(fieldPath) || /ratingHistogram/u.test(fieldPath)) {
      return '评分分布';
    }
    if (/^collection\./u.test(fieldPath)) return '收藏状态分布';
    return undefined;
  });
  const uniqueLabels = [...new Set(labels.filter((label): label is string => Boolean(label)))];
  if (uniqueLabels.length > 0) return uniqueLabels.slice(0, 3).join('、');
  if (conflict.scope === 'rating') return '评分统计';
  if (conflict.scope === 'collection') return '收藏统计';
  if (conflict.scope === 'headline') return '条目统计';
  return '相关统计';
}

function dataNotes(viewModel: SubjectStatsViewModel): string[] {
  const identityNote = (() => {
    switch (viewModel.subjectIdentity.state) {
      case 'not_found':
        return '官方条目身份源未找到该条目；统计仍保留各自的来源状态。';
      case 'id_mismatch':
        return '官方返回的条目 ID 与请求 ID 不一致；名称已隐藏，统计状态保持独立。';
      case 'unavailable':
        return '官方作品名称本次不可用；统计仍保留各自的来源状态和请求 ID。';
      case 'available':
        return viewModel.subjectIdentity.nameTruncated || viewModel.subjectIdentity.nameCnTruncated
          ? '作品标题超过显示上限，已在安全范围内截断。'
          : undefined;
    }
  })();

  if (viewModel.state === 'not_found') {
    return [...(identityNote ? [identityNote] : []), '统计字段保留为未知，不把“未找到”误当作零。'];
  }
  if (viewModel.state === 'unavailable') {
    return [
      ...(identityNote ? [identityNote] : []),
      '统计字段保留为未知，不把“暂时不可用”误当作零。',
    ];
  }

  const repeatedConflictWarning = Boolean(uniqueStatsConflicts(viewModel).length);
  const completionFormulaNote =
    viewModel.collection.formulas.completion.evidenceStatus === 'empirically_verified'
      ? '完成率＝看过人数 ÷ 五类收藏状态总人数；样本验证，并非官方 API 契约。'
      : '完成率按当前返回的五类收藏状态计算。';
  const visibleWarnings = safeStatisticsWarningLabels(
    viewModel.warnings.filter(
      (warning) => !(repeatedConflictWarning && warning.code === 'RATING_MEAN_CONFLICT'),
    ),
    {
      completionMethodologyAlreadyShown:
        viewModel.collection.formulas.completion.evidenceStatus === 'empirically_verified',
    },
  );
  const notes = [
    ...(identityNote ? [identityNote] : []),
    `8–9 分占比只描述这两档在完整当前直方图中的份额；标准差只描述离散程度，不能单独判定两极化、质量、原因或推荐。${completionFormulaNote} 这是一份当前快照，不代表历史趋势。`,
    ...visibleWarnings,
    ...viewModel.limitations.filter((note) => !note.includes('8–9 分占比')),
  ];
  const normalizedNotes = notes.map((note) => note.trim());
  const firstHistoricalNote = normalizedNotes.find((note) => note.includes('历史趋势'));
  return normalizedNotes.filter(
    (note, index, all) =>
      note &&
      all.indexOf(note) === index &&
      (!note.includes('历史趋势') || note === firstHistoricalNote),
  );
}

export const SubjectStatsCard: React.FC<SubjectStatsCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
  width,
}) => {
  const gallery = theme.designPack === 'clean-gallery';
  const zine = theme.designPack === 'graphic-zine';
  const renderWidth = width ?? 960;
  const raw = viewModel.raw;
  const coverUrl = viewModel.subjectIdentity.coverImage;
  const coverSrc = coverUrl ? resolvedImages[coverUrl] || coverUrl : undefined;
  const coverHeight = Math.min(360, Math.max(128, Math.round(renderWidth * 0.36)));
  const hasRank = typeof raw?.rank === 'number' && Number.isFinite(raw.rank);
  const ratingMax = Math.max(1, ...viewModel.rating.distribution.map((item) => item.count ?? 0));
  const collectionMax = Math.max(
    1,
    ...viewModel.collection.distribution.map((item) => item.count ?? 0),
  );
  const renderedConflicts = uniqueStatsConflicts(viewModel);
  const notes = dataNotes(viewModel);
  const displayedNotes = notes.slice(0, 3);
  const omittedNotes = notes.length - displayedNotes.length;
  const originalTitle =
    viewModel.subjectIdentity.state === 'available' &&
    viewModel.subjectIdentity.nameCn &&
    viewModel.subjectIdentity.name &&
    viewModel.subjectIdentity.nameCn !== viewModel.subjectIdentity.name
      ? viewModel.subjectIdentity.name
      : undefined;
  const identityMetadata = [
    `ID ${viewModel.subjectId}`,
    viewModel.subjectIdentity.state === 'available'
      ? '官方 v0 身份'
      : viewModel.subjectIdentity.state === 'id_mismatch'
        ? '身份冲突'
        : viewModel.subjectIdentity.state === 'not_found'
          ? '身份未找到'
          : '身份不可用',
    `统计${
      (
        {
          complete: '完整',
          partial: '部分',
          conflict: '冲突',
          unavailable: '不可用',
          not_found: '未找到',
          not_computable: '不可计算',
        } as Record<string, string>
      )[viewModel.state] || '未知'
    }`,
  ];
  const scoreBand8To9Share = viewModel.rating.scoreBand8To9Share;
  const scoreBand8To9ShareWithSamples =
    scoreBand8To9Share &&
    scoreBand8To9Share.percentage !== undefined &&
    scoreBand8To9Share.count !== undefined &&
    scoreBand8To9Share.population !== undefined
      ? scoreBand8To9Share
      : undefined;
  const scoreBand8To9ShareValue = scoreBand8To9ShareWithSamples
    ? formatPercent(scoreBand8To9ShareWithSamples.percentage)
    : metricStateLabel(scoreBand8To9Share?.state ?? 'unknown');
  const scoreBand8To9ShareDetail = scoreBand8To9ShareWithSamples
    ? `样本数 ${formatNumber(scoreBand8To9ShareWithSamples.count)} / ${formatNumber(scoreBand8To9ShareWithSamples.population)}${scoreBand8To9ShareWithSamples.state === 'conflict' ? ' · 来源冲突' : ''}`
    : undefined;
  const summaryMetrics: Array<{ label: string; value: string; detail?: string }> = [
    { label: '8–9 分占比', value: scoreBand8To9ShareValue, detail: scoreBand8To9ShareDetail },
    { label: '分布均值', value: formatNumber(viewModel.rating.mean, 2) },
    { label: '评分离散度', value: formatNumber(viewModel.rating.standardDeviation, 2) },
    { label: '收藏人数', value: formatNumber(viewModel.collection.total) },
    { label: '完成率', value: formatRatioPercent(viewModel.collection.completionRate) },
  ];
  const ratingDistribution = (
    <section data-layout="stats-rating-distribution">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.xs,
          color: theme.accent,
          fontWeight: 700,
          fontSize: '15px',
        }}
      >
        <RendererIcon name="stats" theme={theme} size={16} />
        评分分布
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
        {viewModel.rating.distribution.map((item) => (
          <div key={item.score} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '24px', color: theme.textMuted, fontSize: '12px' }}>
              {item.score}
            </span>
            <div
              style={{
                flex: 1,
                minWidth: 12,
                height: zine ? '12px' : gallery ? '5px' : '10px',
                backgroundColor: theme.surfaceAlt,
                borderRadius: zine || gallery ? '0' : '5px',
                border: zine ? `1px solid ${theme.text}` : undefined,
                overflow: 'hidden',
              }}
            >
              {item.count !== undefined ? (
                <div
                  style={{
                    width: Math.min(100, (item.count / ratingMax) * 100) + '%',
                    height: '100%',
                    backgroundColor: zine
                      ? item.score >= 9
                        ? theme.tones.coral.foreground
                        : item.score >= 7
                          ? theme.accent
                          : theme.tones.butter.foreground
                      : item.score >= 8
                        ? theme.accent
                        : theme.border,
                  }}
                />
              ) : null}
            </div>
            <span
              style={{
                width: width && width < 520 ? '78px' : '92px',
                flexShrink: 0,
                textAlign: 'right',
                color: theme.text,
                fontSize: '11px',
              }}
            >
              {formatNumber(item.count)} · {formatPercent(item.percentage)}
            </span>
          </div>
        ))}
      </div>
      <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '7px' }}>
        已收到 {viewModel.coverage.ratingBucketsObserved}/{viewModel.coverage.ratingBucketsExpected}{' '}
        档 · {stateLabel(viewModel.rating.state)}
      </div>
    </section>
  );
  const collectionDistribution = (
    <section data-layout="stats-collection-distribution">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.xs,
          color: theme.accent,
          fontWeight: 700,
          fontSize: '15px',
        }}
      >
        <RendererIcon name="collection" theme={theme} size={16} />
        收藏状态
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
        {viewModel.collection.distribution.map((item) => (
          <div key={item.status} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '38px', color: theme.textMuted, fontSize: '12px' }}>
              {collectionLabels[item.status] || '其他'}
            </span>
            <div
              style={{
                flex: 1,
                minWidth: 12,
                height: zine ? '13px' : gallery ? '6px' : '12px',
                backgroundColor: theme.surfaceAlt,
                borderRadius: zine || gallery ? '0' : '6px',
                border: zine ? `1px solid ${theme.text}` : undefined,
                overflow: 'hidden',
              }}
            >
              {item.count !== undefined ? (
                <div
                  style={{
                    width: Math.min(100, (item.count / collectionMax) * 100) + '%',
                    height: '100%',
                    backgroundColor: theme.accent,
                  }}
                />
              ) : null}
            </div>
            <span
              style={{
                width: width && width < 520 ? '78px' : '92px',
                flexShrink: 0,
                textAlign: 'right',
                color: theme.text,
                fontSize: '11px',
              }}
            >
              {formatNumber(item.count)} · {formatPercent(item.percentage)}
            </span>
          </div>
        ))}
      </div>
      <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '7px' }}>
        已收到 {viewModel.coverage.collectionBucketsObserved}/
        {viewModel.coverage.collectionBucketsExpected} 类 · {stateLabel(viewModel.collection.state)}
        {' · 完成率 ' + metricStateLabel(viewModel.collection.completionState)}
      </div>
    </section>
  );

  const coverStage =
    viewModel.subjectIdentity.state === 'available' ? (
      <section
        data-layout="subject-stats-cover-hero"
        style={{
          position: 'relative',
          height: `${coverHeight}px`,
          overflow: 'hidden',
          isolation: 'isolate',
          backgroundColor: theme.surfaceAlt,
          border: `${zine ? '3px' : gallery ? '2px' : '1px'} solid ${zine ? theme.text : theme.border}`,
          borderRadius: zine ? '0' : gallery ? '2px' : theme.radius.md,
          clipPath: zine ? 'polygon(0 0, 100% 0, 100% 92%, 96% 100%, 0 100%)' : undefined,
        }}
      >
        {coverSrc ? (
          <img
            src={coverSrc}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 42%',
              filter: zine
                ? 'saturate(1.22) contrast(1.08)'
                : gallery
                  ? 'saturate(0.84) brightness(1.04)'
                  : 'saturate(0.92)',
            }}
          />
        ) : (
          <div
            role="img"
            aria-label={`${viewModel.subjectIdentity.nameCn || viewModel.subjectIdentity.name || '作品'}：暂无封面`}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: theme.textMuted,
              backgroundColor: theme.surfaceAlt,
              fontSize: '13px',
              fontFamily: theme.design.bodyFontFamily,
            }}
          >
            暂无封面
          </div>
        )}
        {zine ? (
          <div
            data-layout="zine-stats-cover-label"
            style={{
              position: 'absolute',
              left: theme.spacing.md,
              top: theme.spacing.md,
              zIndex: 1,
              padding: `${theme.spacing.xs} ${theme.spacing.md}`,
              color: theme.text,
              backgroundColor: theme.tones.butter.surface,
              border: `2px solid ${theme.text}`,
              boxShadow: `3px 3px 0 ${theme.tones.coral.foreground}`,
              clipPath: 'polygon(0 0, 100% 0, 96% 100%, 0 100%)',
              fontFamily: theme.design.displayFontFamily,
              fontSize: width && width < 520 ? '18px' : '26px',
              fontWeight: 900,
            }}
          >
            评分分布
          </div>
        ) : null}
      </section>
    ) : null;

  return (
    <CardFrame theme={theme} width={width}>
      {!gallery ? coverStage : null}
      <TitleBlock
        title={
          viewModel.subjectIdentity.state === 'available'
            ? viewModel.subjectIdentity.nameCn ||
              viewModel.subjectIdentity.name ||
              '作品名称暂不可用'
            : '作品名称暂不可用'
        }
        subtitle={originalTitle}
        subtitleMaxLines={originalTitle ? 2 : undefined}
        theme={theme}
        icon="stats"
        titleFontSize={
          renderWidth >= 900 ? (zine ? '46px' : '40px') : renderWidth >= 520 ? '30px' : '24px'
        }
        titleMaxLines={2}
      />

      <div
        data-layout="subject-stats-identity-metadata"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: theme.spacing.xs,
          color: theme.textMuted,
          fontSize: '11px',
          lineHeight: 1.35,
        }}
      >
        {identityMetadata.map((item) => (
          <span
            key={item}
            data-layout="subject-stats-identity-chip"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
              padding: '3px 8px',
              backgroundColor: zine
                ? theme.tones.butter.surface
                : gallery
                  ? theme.surface
                  : theme.surfaceAlt,
              border: `${zine ? '2px' : '1px'} solid ${zine ? theme.text : theme.border}`,
              borderRadius: zine ? theme.design.badgeRadius : gallery ? '2px' : '999px',
              boxShadow: zine ? `2px 2px 0 ${theme.border}` : undefined,
              color: zine ? theme.text : theme.textMuted,
            }}
          >
            {item}
          </span>
        ))}
      </div>

      <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
        Bangumi 官方数据 · 更新于{' '}
        {formatRetrievedAt(viewModel.retrievedAt || viewModel.source.official.retrievedAt)}
      </div>

      {gallery ? coverStage : null}

      {raw && !zine ? (
        <section
          data-layout={gallery ? 'gallery-score-distribution-hero' : 'warm-score-distribution-hero'}
          data-render-mask={gallery ? 'panel' : 'panel-alt'}
          style={{
            display: 'grid',
            gridTemplateColumns:
              width && width >= 520 ? 'minmax(0, 0.78fr) minmax(0, 1.22fr)' : 'minmax(0, 1fr)',
            alignItems: 'start',
            gap: theme.spacing.md,
            padding: theme.spacing.md,
            backgroundColor: gallery ? theme.surface : theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: gallery ? '4px' : theme.radius.lg,
            clipPath: gallery ? theme.design.masks.panel : theme.design.masks.panelAlt,
          }}
        >
          <div data-layout="stats-rating-score">
            <div style={{ color: theme.textMuted, fontSize: '12px' }}>官方评分</div>
            <div
              style={{
                color: gallery ? theme.accent : theme.score,
                fontFamily: theme.design.displayFontFamily,
                fontSize: renderWidth < 520 ? '42px' : renderWidth < 900 ? '64px' : '86px',
                fontWeight: theme.design.titleWeight,
                lineHeight: 1,
              }}
            >
              {formatNumber(raw.score, 1)}
              <span style={{ fontSize: '14px', fontWeight: 600 }}> / 10</span>
            </div>
            <div style={{ color: theme.textMuted, fontSize: '12px', marginTop: theme.spacing.sm }}>
              {formatNumber(raw.ratingTotal)} 人评分
            </div>
          </div>
          {ratingDistribution}
        </section>
      ) : null}

      {zine && raw ? (
        <section
          data-layout="zine-score-hero"
          data-render-mask="panel"
          style={{
            display: 'grid',
            gridTemplateColumns:
              width && width >= 520 ? 'minmax(0, 0.86fr) minmax(0, 1.14fr)' : '1fr',
            alignItems: 'center',
            gap: theme.spacing.md,
            padding: theme.spacing.md,
            backgroundColor: theme.tones.coral.surface,
            border: `3px solid ${theme.text}`,
            clipPath: theme.design.masks.panel,
            boxShadow: `4px 4px 0 ${theme.border}`,
          }}
        >
          <div data-layout="stats-rating-score">
            <div style={{ color: theme.tones.coral.foreground, fontSize: '13px', fontWeight: 900 }}>
              综合评分
            </div>
            <div
              style={{
                color: theme.tones.coral.foreground,
                fontFamily: theme.design.displayFontFamily,
                fontSize: renderWidth < 520 ? '54px' : renderWidth < 900 ? '84px' : '108px',
                fontWeight: 900,
                lineHeight: 0.95,
                letterSpacing: '-0.06em',
              }}
            >
              {formatNumber(raw.score, 1)}
              <span style={{ fontSize: '20px', letterSpacing: 0 }}> / 10</span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 800, marginTop: theme.spacing.sm }}>
              评分人数 {formatNumber(raw.ratingTotal)}
              {hasRank ? ` · 排名 ${formatNumber(raw.rank)}` : ''}
            </div>
          </div>
          {ratingDistribution}
        </section>
      ) : null}

      {viewModel.state === 'unavailable' || viewModel.state === 'not_found' ? (
        <div
          data-render-mask="panel-alt"
          style={{
            color: theme.warning,
            backgroundColor: theme.surfaceAlt,
            border: '1px solid ' + theme.border,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '13px',
            lineHeight: 1.5,
            clipPath: theme.design.masks.panelAlt,
          }}
        >
          {viewModel.state === 'not_found'
            ? '官方统计源没有找到该条目。'
            : '官方统计源暂时不可用，未生成猜测的统计值。'}
        </div>
      ) : null}

      {raw ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gap: theme.spacing.md,
            }}
          >
            {collectionDistribution}
          </div>

          <div
            data-layout="stats-secondary-metrics"
            style={{
              display: 'grid',
              gridTemplateColumns:
                width && width >= 900
                  ? gallery
                    ? 'repeat(4, minmax(0, 1fr))'
                    : 'repeat(3, minmax(0, 1fr))'
                  : 'repeat(2, minmax(0, 1fr))',
              gap: theme.spacing.sm,
            }}
          >
            {summaryMetrics.map(({ label, value, detail }) => (
              <div
                key={label}
                style={{
                  gridColumn: width && width < 360 && label === '8–9 分占比' ? '1 / -1' : undefined,
                  backgroundColor: zine ? theme.surface : theme.surfaceAlt,
                  border: `${theme.design.metricBorderWidth} solid ${zine ? theme.text : theme.border}`,
                  borderRadius: theme.design.tagRadius,
                  clipPath: zine ? 'polygon(0 0, 100% 0, 100% 86%, 92% 100%, 0 100%)' : undefined,
                  padding: gallery ? theme.spacing.md : theme.spacing.sm,
                  boxShadow: zine ? `2px 2px 0 ${theme.border}` : undefined,
                  minWidth: 0,
                }}
              >
                <div style={{ color: theme.textMuted, fontSize: '11px' }}>{label}</div>
                <div
                  style={{
                    color: theme.text,
                    fontFamily: theme.design.displayFontFamily,
                    fontSize: zine ? '22px' : gallery ? '18px' : '20px',
                    fontWeight: zine ? 900 : 700,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {value}
                </div>
                {detail ? (
                  <div
                    data-layout="stats-summary-metric-detail"
                    style={{
                      color: theme.textMuted,
                      fontFamily: theme.design.bodyFontFamily,
                      fontSize: '11px',
                      lineHeight: 1.3,
                      marginTop: theme.spacing.xs,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {detail}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {renderedConflicts.length ? (
        <section
          style={{
            backgroundColor: theme.surfaceAlt,
            border: '1px solid ' + theme.warning,
            borderRadius: theme.radius.sm,
            padding: theme.spacing.sm,
          }}
        >
          <div style={{ color: theme.warning, fontWeight: 700, fontSize: '13px' }}>
            统计来源给出的结果不一致
          </div>
          {renderedConflicts.slice(0, 4).map((conflict, conflictIndex) => (
            <div
              key={conflict.reason + '-' + conflictIndex}
              style={{
                color: theme.textMuted,
                fontSize: '12px',
                lineHeight: 1.5,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              <div style={{ color: theme.text, fontWeight: 600, marginBottom: '3px' }}>
                {statsConflictLabel(conflict)}
              </div>
              {conflict.candidates.map((candidate, candidateIndex) => (
                <div
                  key={
                    candidate.source.class + '-' + candidate.source.provider + '-' + candidateIndex
                  }
                >
                  {conflictSourceLabel(candidate.source)}：{formatConflictValue(candidate.value)}
                </div>
              ))}
            </div>
          ))}
          {renderedConflicts.length > 4 ? (
            <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.45 }}>
              另有 {renderedConflicts.length - 4} 条评分差异保留在详细结果中。
            </div>
          ) : null}
        </section>
      ) : null}

      <section
        style={{
          backgroundColor: theme.surfaceAlt,
          border: '1px solid ' + theme.border,
          borderRadius: theme.radius.sm,
          padding: theme.spacing.sm,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.xs,
            color: theme.accent,
            fontWeight: 700,
            fontSize: '13px',
          }}
        >
          <RendererIcon name="overview" theme={theme} size={15} />
          数据说明
        </div>
        {displayedNotes.map((note, index) => (
          <div
            key={note + '-' + index}
            style={{
              color: theme.textMuted,
              fontSize: '11px',
              lineHeight: 1.5,
              marginTop: '4px',
              overflowWrap: 'anywhere',
            }}
          >
            {note}
          </div>
        ))}
        {omittedNotes > 0 ? (
          <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '4px' }}>
            另有 {omittedNotes} 条说明保留在详细结果中。
          </div>
        ) : null}
      </section>

      <Footer label="Bangumi 条目统计 · 当前快照" theme={theme} />
    </CardFrame>
  );
};
