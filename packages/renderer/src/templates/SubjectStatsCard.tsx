import React from 'react';
import type { SubjectStatsViewModel } from '../view-models/index.js';
import type { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';

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

function formatNumber(value: number | undefined, digits = 0): string {
  return value === undefined || !Number.isFinite(value)
    ? '未知'
    : value.toLocaleString('zh-CN', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
}

function formatPercent(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '未知' : `${value.toFixed(1)}%`;
}

function formatRatioPercent(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '未知' : `${(value * 100).toFixed(1)}%`;
}

function sourceLabel(source: 'official-v0' | 'derived-s7'): string {
  return source === 'official-v0' ? 'official-v0' : 'derived-s7';
}

const collectionLabels: Record<string, string> = {
  wish: '想看',
  collect: '看过',
  doing: '在看',
  on_hold: '搁置',
  dropped: '抛弃',
};

const DIAGNOSTIC_RENDER_CAP = 8;

export const SubjectStatsCard: React.FC<SubjectStatsCardProps> = ({ viewModel, theme, width }) => {
  const raw = viewModel.raw;
  const ratingMax = Math.max(1, ...viewModel.rating.distribution.map((item) => item.count ?? 0));
  const collectionMax = Math.max(
    1,
    ...viewModel.collection.distribution.map((item) => item.count ?? 0),
  );
  const formulaLines = [
    viewModel.rating.formulas.percentages,
    viewModel.rating.formulas.histogramMean,
    viewModel.rating.formulas.populationStandardDeviation,
    viewModel.collection.formulas.percentages,
    viewModel.collection.formulas.completion,
  ];
  const renderedConflicts = viewModel.rating.conflicts?.slice(0, DIAGNOSTIC_RENDER_CAP) || [];
  const renderedWarnings = viewModel.warnings.slice(0, DIAGNOSTIC_RENDER_CAP);
  const renderedLimitations = viewModel.limitations.slice(0, DIAGNOSTIC_RENDER_CAP);
  const officialOperations = viewModel.source.official.operations.join(' + ') || '未记录';
  const derivedOperations = viewModel.source.derived.operations.join(' + ') || '未记录';

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="条目统计智能"
        subtitle={`条目 ${viewModel.subjectId} · official v0 + derived-s7 · ${stateLabel(viewModel.state)}`}
        theme={theme}
      />

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        评分样本 {formatNumber(viewModel.coverage.ratingPopulation)} · 收藏总数{' '}
        {formatNumber(viewModel.coverage.collectionPopulation)} · 获取于{' '}
        {viewModel.retrievedAt || viewModel.source.official.retrievedAt || '未知'}
      </div>

      {viewModel.state === 'unavailable' || viewModel.state === 'not_found' ? (
        <div
          style={{
            color: theme.warning,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '12px',
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
              gridTemplateColumns: width && width >= 900 ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
              gap: theme.spacing.sm,
            }}
          >
            {[
              ['官方评分', formatNumber(raw.score, 1)],
              ['评分人数', formatNumber(raw.ratingTotal)],
              ['直方图均值', formatNumber(viewModel.rating.mean, 2)],
              ['总体标准差', formatNumber(viewModel.rating.standardDeviation, 2)],
              ['收藏总数', formatNumber(viewModel.collection.total)],
              ['完成率', formatRatioPercent(viewModel.collection.completionRate)],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  backgroundColor: theme.surfaceAlt,
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.sm,
                  minWidth: 0,
                }}
              >
                <div style={{ color: theme.textMuted, fontSize: '10px' }}>{label}</div>
                <div
                  style={{
                    color: theme.text,
                    fontSize: '17px',
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
              <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>评分分布</div>
              <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
                直方图均值与总体标准差是派生指标；不自动生成“更好”或推荐结论。
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}
              >
                {viewModel.rating.distribution.map((item) => (
                  <div
                    key={item.score}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span style={{ width: '22px', color: theme.textMuted, fontSize: '10px' }}>
                      {item.score}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: '8px',
                        backgroundColor: theme.surfaceAlt,
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, ((item.count ?? 0) / ratingMax) * 100)}%`,
                          height: '100%',
                          backgroundColor: item.score >= 8 ? theme.accent : theme.border,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        width: '82px',
                        textAlign: 'right',
                        color: theme.text,
                        fontSize: '10px',
                      }}
                    >
                      {formatNumber(item.count)} · {formatPercent(item.percentage)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ color: theme.textMuted, fontSize: '10px', marginTop: '5px' }}>
                区段状态：{stateLabel(viewModel.rating.state)} · 样本{' '}
                {formatNumber(viewModel.rating.population)}
              </div>
            </section>

            <section>
              <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>
                收藏状态分布
              </div>
              <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
                完成率 = 看过 /（想看 + 看过 + 在看 + 搁置 + 抛弃）；该公式保留验证状态。
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}
              >
                {viewModel.collection.distribution.map((item) => (
                  <div
                    key={item.status}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span style={{ width: '34px', color: theme.textMuted, fontSize: '10px' }}>
                      {collectionLabels[item.status] || item.status}
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
                      <div
                        style={{
                          width: `${Math.min(100, ((item.count ?? 0) / collectionMax) * 100)}%`,
                          height: '100%',
                          backgroundColor: theme.accent,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        width: '82px',
                        textAlign: 'right',
                        color: theme.text,
                        fontSize: '10px',
                      }}
                    >
                      {formatNumber(item.count)} · {formatPercent(item.percentage)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ color: theme.textMuted, fontSize: '10px', marginTop: '5px' }}>
                区段状态：{stateLabel(viewModel.collection.state)} · 完成率：
                {stateLabel(viewModel.collection.completionState)}
              </div>
            </section>
          </div>
        </>
      ) : null}

      {renderedConflicts.length ? (
        <section
          style={{
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.warning}`,
            borderRadius: theme.radius.sm,
            padding: theme.spacing.sm,
          }}
        >
          <div style={{ color: theme.warning, fontWeight: 700, fontSize: '12px' }}>
            评分来源冲突
          </div>
          {renderedConflicts.map((conflict, conflictIndex) => (
            <div
              key={`${conflict.reason}-${conflictIndex}`}
              style={{
                color: theme.textMuted,
                fontSize: '10px',
                lineHeight: 1.5,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              <div>{conflict.reason}：</div>
              {conflict.candidates.map((candidate, candidateIndex) => (
                <div
                  key={`${candidate.source.class}-${candidate.source.provider}-${candidateIndex}`}
                >
                  候选 {candidate.source.class}/{candidate.source.provider} ={' '}
                  {formatNumber(candidate.value, 2)}
                </div>
              ))}
            </div>
          ))}
          {viewModel.rating.conflicts &&
          viewModel.rating.conflicts.length > renderedConflicts.length ? (
            <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.45 }}>
              另有 {viewModel.rating.conflicts.length - renderedConflicts.length} 条评分冲突未展开。
            </div>
          ) : null}
        </section>
      ) : null}

      <section
        style={{
          backgroundColor: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.sm,
          padding: theme.spacing.sm,
        }}
      >
        <div style={{ color: theme.accent, fontWeight: 700, fontSize: '12px' }}>来源与公式</div>
        <div
          style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5, marginTop: '4px' }}
        >
          official-v0：{officialOperations} · derived-s7：{derivedOperations}
        </div>
        <div
          style={{
            color: theme.textMuted,
            fontSize: '10px',
            lineHeight: 1.5,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          公式：
          {formulaLines.map((formula) => (
            <div key={formula.id}>
              {formula.id} v{formula.version} · {formula.description} · inputs:{' '}
              {formula.inputs.join(', ')}
            </div>
          ))}
        </div>
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          覆盖：来源请求 {viewModel.coverage.sourceRequestsSucceeded}/
          {viewModel.coverage.sourceRequestsAttempted} 成功 · 评分桶{' '}
          {viewModel.coverage.ratingBucketsObserved}/{viewModel.coverage.ratingBucketsExpected} ·
          收藏桶 {viewModel.coverage.collectionBucketsObserved}/
          {viewModel.coverage.collectionBucketsExpected} · 公式完整{' '}
          {viewModel.coverage.formulasComplete}/{viewModel.coverage.formulasAttempted} · 冲突{' '}
          {viewModel.coverage.formulasConflict} · 部分 {viewModel.coverage.formulasPartial} ·
          不可计算 {viewModel.coverage.formulasNotComputable}
        </div>
      </section>

      {renderedWarnings.length > 0 ? (
        <section>
          <div style={{ color: theme.warning, fontWeight: 700, fontSize: '12px' }}>告警</div>
          {renderedWarnings.map((warning, index) => (
            <div
              key={`${warning.code}-${index}`}
              style={{
                color: theme.textMuted,
                fontSize: '10px',
                lineHeight: 1.45,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              {warning.code} · {warning.message}
            </div>
          ))}
          {viewModel.warnings.length > renderedWarnings.length ? (
            <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.45 }}>
              另有 {viewModel.warnings.length - renderedWarnings.length} 条告警未展开。
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.45 }}>
          状态：{stateLabel(viewModel.state)} · 证据通道：
          {viewModel.evidence
            .map((item) => sourceLabel(item.source))
            .filter((item, index, values) => values.indexOf(item) === index)
            .join(' + ') || '未记录'}
        </div>
        <div
          style={{
            color: theme.textMuted,
            fontSize: '10px',
            lineHeight: 1.45,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          限制：
          {renderedLimitations.map((limitation, index) => (
            <div key={`${limitation}-${index}`}>{limitation}</div>
          ))}
          {viewModel.limitations.length > renderedLimitations.length ? (
            <div>
              另有 {viewModel.limitations.length - renderedLimitations.length} 条限制未展开。
            </div>
          ) : null}
        </div>
      </section>

      <Footer label="Bangumi Stats Intelligence · zero-network card" theme={theme} />
    </CardFrame>
  );
};
