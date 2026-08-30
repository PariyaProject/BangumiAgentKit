import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { CollectionEntityConsistencyViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';

export interface CollectionEntityConsistencyCardProps {
  viewModel: CollectionEntityConsistencyViewModel;
  theme: ThemeTokens;
  width?: number;
}

function stateLabel(state: CollectionEntityConsistencyViewModel['state']): string {
  if (state === 'complete') return '覆盖完整';
  if (state === 'partial') return '部分覆盖';
  if (state === 'not_computable') return '当前无法计算';
  return '来源不可用';
}

function stateColor(
  state: CollectionEntityConsistencyViewModel['state'],
  theme: ThemeTokens,
): string {
  return state === 'complete' ? theme.success : theme.warning;
}

function boundedText(value: unknown, maximum = 120): string {
  const normalized = String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (normalized.length <= maximum) return normalized;
  return `${Array.from(normalized)
    .slice(0, maximum - 1)
    .join('')}…`;
}

function entityKindLabel(kind: 'character' | 'person'): string {
  return kind === 'character' ? '角色' : '人物';
}

function evidenceKindLabel(
  kind: CollectionEntityConsistencyViewModel['matches'][number]['evidenceKind'],
): string {
  if (kind === 'subject-character') return '条目→角色';
  if (kind === 'subject-person') return '条目→人物';
  return '角色→声优';
}

function subjectLabel(
  subject: CollectionEntityConsistencyViewModel['matches'][number]['subject'],
): string {
  return `${boundedText(subject.nameCn || subject.name || `#${subject.id}`, 54)} (#${subject.id})`;
}

function entityLabel(
  entity: CollectionEntityConsistencyViewModel['matches'][number]['entity'],
): string {
  return `${boundedText(entity.name, 48)} (#${entity.id})`;
}

function filterLabel(viewModel: CollectionEntityConsistencyViewModel): string {
  const values = [
    viewModel.filters.subjectType ? `媒介 ${viewModel.filters.subjectType}` : undefined,
    viewModel.filters.status ? `状态 ${viewModel.filters.status}` : undefined,
  ].filter((value): value is string => Boolean(value));
  return values.length > 0 ? values.join(' · ') : '全部已知媒介与状态';
}

export const CollectionEntityConsistencyCard: React.FC<CollectionEntityConsistencyCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const tone = stateColor(viewModel.state, theme);
  const visibleWarnings = viewModel.warnings.slice(0, 5);
  const visibleLimitations = viewModel.limitations.slice(0, 4);
  const summary = [
    [
      '选取作品',
      `${viewModel.coverage.subjectCollections.rootsSelected}/${viewModel.coverage.subjectCollections.uniqueRootsObserved}`,
    ],
    [
      '关系请求',
      `${viewModel.coverage.relations.sourceRequestsSucceeded}/${viewModel.coverage.relations.sourceRequestsAttempted}`,
    ],
    [
      '正向关联',
      `${viewModel.presentation.matches.rendered}/${viewModel.presentation.matches.available}`,
    ],
    [
      '观察范围内未匹配',
      `${viewModel.presentation.unmatched.rendered}/${viewModel.presentation.unmatched.available}`,
    ],
  ];

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="收藏角色/人物一致性观察"
        subtitle={`当前账号 ${boundedText(viewModel.account.username, 64)} · ${stateLabel(viewModel.state)}`}
        theme={theme}
      />

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        只按官方 v0 稳定 ID，把观察到的收藏作品与当前账号已收藏角色/人物连接起来；
        未匹配项只属于本次已观察范围，未观察到不等于不存在。
      </div>

      <div style={{ color: tone, fontSize: '11px', lineHeight: 1.5 }}>
        状态：{stateLabel(viewModel.state)} · 筛选：{filterLabel(viewModel)} · 公式：
        {viewModel.formulaVersion}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: width && width >= 900 ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
          gap: theme.spacing.sm,
        }}
      >
        {summary.map(([label, value]) => (
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
            <div style={{ color: theme.text, fontSize: '16px', fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      <section>
        <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>
          已确认的正向关联（展示 {viewModel.presentation.matches.rendered}/
          {viewModel.presentation.matches.available}）
        </div>
        {viewModel.matches.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.xs,
              marginTop: theme.spacing.sm,
            }}
          >
            {viewModel.matches.map((match, index) => (
              <div
                key={`${match.subject.id}-${match.entity.kind}-${match.entity.id}-${match.evidenceKind}-${index}`}
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.sm,
                  color: theme.text,
                  fontSize: '11px',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {subjectLabel(match.subject)} → {entityLabel(match.entity)}
                </div>
                <div style={{ color: theme.textMuted }}>
                  {entityKindLabel(match.entity.kind)} · {evidenceKindLabel(match.evidenceKind)} ·
                  原始关系：{boundedText(match.relation, 54)}
                  {match.viaCharacter
                    ? ` · 通过角色 ${boundedText(match.viaCharacter.name, 34)} (#${match.viaCharacter.id})`
                    : ''}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5, marginTop: '5px' }}
          >
            当前观察范围没有已确认的正向关联；这不等于账号收藏之间不存在关联。
          </div>
        )}
        {viewModel.presentation.matches.omitted > 0 ? (
          <div style={{ color: theme.warning, fontSize: '10px', marginTop: '5px' }}>
            另有 {viewModel.presentation.matches.omitted} 条正向关联未在卡片中展示，完整观察数量仍见
            coverage。
          </div>
        ) : null}
      </section>

      {viewModel.unmatchedInObservedScope.length > 0 ? (
        <section>
          <div style={{ color: theme.accent, fontWeight: 700, fontSize: '13px' }}>
            观察范围内未匹配（展示 {viewModel.presentation.unmatched.rendered}/
            {viewModel.presentation.unmatched.available}）
          </div>
          <div
            style={{
              color: theme.textMuted,
              fontSize: '10px',
              lineHeight: 1.5,
              marginTop: '5px',
              whiteSpace: 'pre-line',
            }}
          >
            {viewModel.unmatchedInObservedScope
              .map(
                (item) =>
                  `${entityKindLabel(item.entity.kind)} ${boundedText(item.entity.name, 48)} (#${item.entity.id})`,
              )
              .join('\n')}
          </div>
          {viewModel.presentation.unmatched.omitted > 0 ? (
            <div style={{ color: theme.warning, fontSize: '10px', marginTop: '5px' }}>
              另有 {viewModel.presentation.unmatched.omitted}{' '}
              条观察范围内未匹配项未展示，完整观察数量仍见 coverage。
            </div>
          ) : null}
        </section>
      ) : null}

      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        作品收藏观察：{viewModel.coverage.subjectCollections.pagesSucceeded}/
        {viewModel.coverage.subjectCollections.pagesAttempted} 页成功，观察{' '}
        {viewModel.coverage.subjectCollections.rowsObserved} 行；角色收藏观察{' '}
        {viewModel.coverage.entityCollections.characters.returned}/
        {viewModel.coverage.entityCollections.characters.observed} 行；人物收藏观察{' '}
        {viewModel.coverage.entityCollections.persons.returned}/
        {viewModel.coverage.entityCollections.persons.observed} 行。
      </div>

      {visibleWarnings.length > 0 ? (
        <div
          style={{
            color: theme.warning,
            fontSize: '10px',
            lineHeight: 1.5,
            whiteSpace: 'pre-line',
          }}
        >
          {visibleWarnings
            .map((warning) => `${warning.code}：${boundedText(warning.message)}`)
            .join('\n')}
        </div>
      ) : null}

      <div
        style={{
          color: theme.textMuted,
          fontSize: '10px',
          lineHeight: 1.5,
          whiteSpace: 'pre-line',
        }}
      >
        {visibleLimitations.map((limitation) => `· ${boundedText(limitation)}`).join('\n')}
      </div>

      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        来源：{viewModel.source.class} · 检索 {boundedText(viewModel.source.retrievedAt, 32)}
        <br />
        证据操作：{viewModel.source.operations.join(' · ')}
      </div>

      <Footer label="Bangumi Agent Kit · 当前账号私有观察" theme={theme} />
    </CardFrame>
  );
};
