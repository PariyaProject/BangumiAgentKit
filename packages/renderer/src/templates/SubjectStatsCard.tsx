import React from 'react';
import type { SubjectStatsViewModel } from '../view-models/index.js';
import type { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { safeStatisticsWarningLabels } from './statisticsWarningLabels.js';

export interface SubjectStatsCardProps {
  viewModel: SubjectStatsViewModel;
  theme: ThemeTokens;
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
    `均值和离散度由本次评分分布计算。${completionFormulaNote} 这是一份当前快照，不代表历史趋势或推荐。`,
    ...visibleWarnings,
    ...viewModel.limitations,
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

export const SubjectStatsCard: React.FC<SubjectStatsCardProps> = ({ viewModel, theme, width }) => {
  const raw = viewModel.raw;
  const ratingMax = Math.max(1, ...viewModel.rating.distribution.map((item) => item.count ?? 0));
  const collectionMax = Math.max(
    1,
    ...viewModel.collection.distribution.map((item) => item.count ?? 0),
  );
  const renderedConflicts = uniqueStatsConflicts(viewModel);
  const notes = dataNotes(viewModel);
  const displayedNotes = notes.slice(0, 3);
  const omittedNotes = notes.length - displayedNotes.length;

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title={
          viewModel.subjectIdentity.state === 'available'
            ? viewModel.subjectIdentity.nameCn ||
              viewModel.subjectIdentity.name ||
              '作品名称暂不可用'
            : '作品名称暂不可用'
        }
        subtitle={[
          viewModel.subjectIdentity.state === 'available' &&
          viewModel.subjectIdentity.nameCn &&
          viewModel.subjectIdentity.name &&
          viewModel.subjectIdentity.nameCn !== viewModel.subjectIdentity.name
            ? viewModel.subjectIdentity.name
            : undefined,
          'Bangumi ID ' + viewModel.subjectId,
          viewModel.subjectIdentity.state === 'available'
            ? '官方 v0 条目名称'
            : viewModel.subjectIdentity.state === 'id_mismatch'
              ? '身份与请求不一致'
              : viewModel.subjectIdentity.state === 'not_found'
                ? '身份源未找到'
                : '身份源不可用',
          '统计' + stateLabel(viewModel.state),
        ]
          .filter(Boolean)
          .join(' · ')}
        theme={theme}
      />

      <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
        Bangumi 官方数据 · 更新于{' '}
        {formatRetrievedAt(viewModel.retrievedAt || viewModel.source.official.retrievedAt)}
      </div>

      {viewModel.state === 'unavailable' || viewModel.state === 'not_found' ? (
        <div
          style={{
            color: theme.warning,
            backgroundColor: theme.surfaceAlt,
            border: '1px solid ' + theme.border,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '13px',
            lineHeight: 1.5,
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
              gridTemplateColumns: width && width >= 900 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
              gap: theme.spacing.sm,
            }}
          >
            {[
              ['官方评分', formatNumber(raw.score, 1)],
              ['评分人数', formatNumber(raw.ratingTotal)],
              ['分布均值', formatNumber(viewModel.rating.mean, 2)],
              ['评分离散度', formatNumber(viewModel.rating.standardDeviation, 2)],
              ['收藏人数', formatNumber(viewModel.collection.total)],
              ['完成率', formatRatioPercent(viewModel.collection.completionRate)],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  backgroundColor: theme.surfaceAlt,
                  border: '1px solid ' + theme.border,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.sm,
                  minWidth: 0,
                }}
              >
                <div style={{ color: theme.textMuted, fontSize: '11px' }}>{label}</div>
                <div
                  style={{
                    color: theme.text,
                    fontSize: '20px',
                    fontWeight: 700,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: width && width >= 900 ? '1fr 1fr' : '1fr',
              gap: theme.spacing.md,
            }}
          >
            <section>
              <div style={{ color: theme.accent, fontWeight: 700, fontSize: '15px' }}>评分分布</div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}
              >
                {viewModel.rating.distribution.map((item) => (
                  <div
                    key={item.score}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <span style={{ width: '24px', color: theme.textMuted, fontSize: '12px' }}>
                      {item.score}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: '10px',
                        backgroundColor: theme.surfaceAlt,
                        borderRadius: '5px',
                        overflow: 'hidden',
                      }}
                    >
                      {item.count !== undefined ? (
                        <div
                          style={{
                            width: Math.min(100, (item.count / ratingMax) * 100) + '%',
                            height: '100%',
                            backgroundColor: item.score >= 8 ? theme.accent : theme.border,
                          }}
                        />
                      ) : null}
                    </div>
                    <span
                      style={{
                        width: '92px',
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
                已收到 {viewModel.coverage.ratingBucketsObserved}/
                {viewModel.coverage.ratingBucketsExpected} 档 · {stateLabel(viewModel.rating.state)}
              </div>
            </section>

            <section>
              <div style={{ color: theme.accent, fontWeight: 700, fontSize: '15px' }}>收藏状态</div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}
              >
                {viewModel.collection.distribution.map((item) => (
                  <div
                    key={item.status}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <span style={{ width: '38px', color: theme.textMuted, fontSize: '12px' }}>
                      {collectionLabels[item.status] || '其他'}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: '12px',
                        backgroundColor: theme.surfaceAlt,
                        borderRadius: '6px',
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
                        width: '92px',
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
                {viewModel.coverage.collectionBucketsExpected} 类 ·{' '}
                {stateLabel(viewModel.collection.state)}
                {' · 完成率 ' + metricStateLabel(viewModel.collection.completionState)}
              </div>
            </section>
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
        <div style={{ color: theme.accent, fontWeight: 700, fontSize: '13px' }}>数据说明</div>
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
