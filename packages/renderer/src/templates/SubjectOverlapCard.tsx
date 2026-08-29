import React from 'react';
import type {
  SubjectOverlapCastRoleEvidence,
  SubjectOverlapCastRelation,
  SubjectOverlapStaffRelation,
} from '@bangumi-agent-kit/bangumi-core';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { ThemeTokens } from '../themes/index.js';
import { SubjectOverlapViewModel } from '../view-models/index.js';

export interface SubjectOverlapCardProps {
  viewModel: SubjectOverlapViewModel;
  theme: ThemeTokens;
  width?: number;
}

const wrapStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};

const RENDER_PERSON_LIMIT = 8;

function stateLabel(state: SubjectOverlapViewModel['state'] | string): string {
  return (
    (
      {
        complete: '完整',
        partial: '部分覆盖',
        unavailable: '来源不可用',
        not_found: '未找到',
        not_computable: '不可计算',
      } as Record<string, string>
    )[state] || state
  );
}

function kindLabel(kind: SubjectOverlapViewModel['kind']): string {
  return kind === 'cast'
    ? '角色声优重合'
    : kind === 'staff'
      ? '制作人员重合'
      : '角色声优与制作人员重合';
}

function subjectTitle(subject: SubjectOverlapViewModel['subjects'][number]): string {
  return subject.subject?.nameCn || subject.subject?.name || `条目 ${subject.subjectId}`;
}

function percentage(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value)
    ? '不可计算'
    : `${Number((value * 100).toFixed(1))}%`;
}

function relationSummary(
  relation: SubjectOverlapCastRelation | SubjectOverlapStaffRelation,
): string {
  const { coverage } = relation;
  const ratio =
    coverage.overlapRate === undefined
      ? '重合比例不可计算'
      : `重合 ${percentage(coverage.overlapRate)}`;
  const matched =
    coverage.matchedIds === undefined ? '共同 ID 未知' : `共同 ID ${coverage.matchedIds}`;
  const union = coverage.unionIds === undefined ? '并集未知' : `并集 ${coverage.unionIds}`;
  return `${stateLabel(relation.state)} · ${matched} · ${union} · ${ratio} · 返回 ${coverage.returned} · 省略 ${coverage.omitted}`;
}

function castEvidence(relation: SubjectOverlapCastRelation): string {
  return relation.items
    .slice(0, RENDER_PERSON_LIMIT)
    .map((person) => {
      const credits = person.credits
        .map(
          (credit) =>
            `${credit.subjectId}：${
              credit.characters
                .map((character) => `${character.name}（${character.relation}）`)
                .join('、') || '角色未知'
            }`,
        )
        .join('；');
      return `${person.name} [${person.personId}] · ${credits}`;
    })
    .join(' | ');
}

function staffEvidence(relation: SubjectOverlapStaffRelation): string {
  return relation.items
    .slice(0, RENDER_PERSON_LIMIT)
    .map((person) => {
      const credits = person.credits
        .map(
          (credit) =>
            `${credit.subjectId}：${credit.rawRelations.join('、') || credit.relations.join('、') || '职位未知'}`,
        )
        .join('；');
      return `${person.name} [${person.personId}] · ${credits}`;
    })
    .join(' | ');
}

function castRoleEvidence(relation: SubjectOverlapCastRelation): string {
  return (relation.roleEvidence || [])
    .slice(0, RENDER_PERSON_LIMIT)
    .map((person: SubjectOverlapCastRoleEvidence) => {
      const roles = person.credits
        .flatMap((credit) =>
          credit.characters.map((character) => `${character.name}（${character.relation}）`),
        )
        .join('、');
      return `${person.name} [${person.personId}] · ${roles || '角色未知'} · ${person.roleFamily}`;
    })
    .join(' | ');
}

export const SubjectOverlapCard: React.FC<SubjectOverlapCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const tone = viewModel.state === 'complete' ? theme.success : theme.warning;
  const subjectById = new Map(viewModel.subjects.map((subject) => [subject.subjectId, subject]));
  const visiblePairs = viewModel.pairs.slice(0, 12);

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="条目关系重合"
        subtitle={`${kindLabel(viewModel.kind)} · ${viewModel.subjects.length} 个候选条目`}
        theme={theme}
      />

      <div
        style={{
          ...wrapStyle,
          color: tone,
          backgroundColor: `${tone}18`,
          border: `1px solid ${tone}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.sm,
          fontSize: '12px',
          lineHeight: 1.5,
        }}
      >
        状态：{stateLabel(viewModel.state)} · 角色口径：
        {viewModel.castRole === 'main' ? '明确主角/主役标签' : '全部原始角色标签'} · 条目{' '}
        {viewModel.coverage.returnedSubjects}/{viewModel.coverage.requestedSubjects} · 条目对{' '}
        {viewModel.coverage.returnedPairs}/{viewModel.coverage.requestedPairs}
        {viewModel.coverage.omittedPairs > 0 ? ` · 省略 ${viewModel.coverage.omittedPairs}` : ''}
      </div>

      <div style={{ ...wrapStyle, display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {viewModel.subjects.map((subject) => (
          <div
            key={subject.subjectId}
            style={{
              ...wrapStyle,
              flex: '1 1 220px',
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.sm,
              padding: theme.spacing.sm,
              color: theme.text,
              fontSize: '11px',
            }}
          >
            <div style={{ fontWeight: 700 }}>{subjectTitle(subject)}</div>
            <div style={{ color: theme.textMuted, marginTop: 3 }}>
              Subject {subject.subjectId} · {stateLabel(subject.state)} · 声优{' '}
              {subject.coverage.cast.returned}/{subject.coverage.cast.observed} · 职员{' '}
              {subject.coverage.staff.returned}/{subject.coverage.staff.observed}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{ ...wrapStyle, display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}
      >
        <div style={{ color: theme.text, fontSize: '14px', fontWeight: 700 }}>条目对排名</div>
        {visiblePairs.length === 0 ? (
          <div style={{ ...wrapStyle, color: theme.textMuted, fontSize: '12px' }}>
            当前边界内没有可展示的条目对；请结合来源状态和覆盖数字阅读。
          </div>
        ) : (
          visiblePairs.map((pair) => (
            <div
              key={pair.pairId}
              style={{
                ...wrapStyle,
                backgroundColor: theme.surfaceAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
              }}
            >
              <div style={{ ...wrapStyle, color: theme.text, fontSize: '13px', fontWeight: 700 }}>
                #{pair.rank}{' '}
                {subjectById.get(pair.leftSubjectId)
                  ? subjectTitle(subjectById.get(pair.leftSubjectId)!)
                  : `条目 ${pair.leftSubjectId}`}
                {' ↔ '}
                {subjectById.get(pair.rightSubjectId)
                  ? subjectTitle(subjectById.get(pair.rightSubjectId)!)
                  : `条目 ${pair.rightSubjectId}`}
              </div>
              <div style={{ ...wrapStyle, color: theme.textMuted, fontSize: '11px', marginTop: 4 }}>
                排名分数：{pair.rankScore === null ? '不可用' : pair.rankScore} · 依据：
                {pair.rankBasis}
              </div>
              {pair.cast ? (
                <div
                  style={{
                    ...wrapStyle,
                    color: theme.textMuted,
                    fontSize: '11px',
                    lineHeight: 1.5,
                    marginTop: 6,
                  }}
                >
                  <div>声优：{relationSummary(pair.cast)}</div>
                  {pair.cast.items.length > 0 ? <div>证据：{castEvidence(pair.cast)}</div> : null}
                  {pair.cast.items.length > RENDER_PERSON_LIMIT ? (
                    <div>
                      人物渲染上限：{RENDER_PERSON_LIMIT}；另有{' '}
                      {pair.cast.items.length - RENDER_PERSON_LIMIT} 位共同人物未展开。
                    </div>
                  ) : null}
                  {pair.cast.roleEvidence && pair.cast.roleEvidence.length > 0 ? (
                    <div>未纳入明确主役交集的原始标签：{castRoleEvidence(pair.cast)}</div>
                  ) : null}
                  {pair.cast.roleEvidenceOmitted && pair.cast.roleEvidenceOmitted > 0 ? (
                    <div>
                      原始标签证据渲染上限：{RENDER_PERSON_LIMIT}；另有{' '}
                      {pair.cast.roleEvidenceOmitted} 条未展开。
                    </div>
                  ) : null}
                </div>
              ) : null}
              {pair.staff ? (
                <div
                  style={{
                    ...wrapStyle,
                    color: theme.textMuted,
                    fontSize: '11px',
                    lineHeight: 1.5,
                    marginTop: 6,
                  }}
                >
                  <div>制作人员：{relationSummary(pair.staff)}</div>
                  {pair.staff.items.length > 0 ? (
                    <div>证据：{staffEvidence(pair.staff)}</div>
                  ) : null}
                  {pair.staff.items.length > RENDER_PERSON_LIMIT ? (
                    <div>
                      人物渲染上限：{RENDER_PERSON_LIMIT}；另有{' '}
                      {pair.staff.items.length - RENDER_PERSON_LIMIT} 位共同人物未展开。
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
        {viewModel.pairs.length > visiblePairs.length ? (
          <div style={{ ...wrapStyle, color: theme.warning, fontSize: '11px' }}>
            另有 {viewModel.pairs.length - visiblePairs.length} 个条目对因渲染上限未展开。
          </div>
        ) : null}
      </div>

      <div style={{ ...wrapStyle, color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        公式：{viewModel.formulaVersion} · 官方操作：
        {viewModel.source.official.operations.join('、') || '未记录'}
        {' · '}官方获取于：{viewModel.source.official.retrievedAt || '不可用'}
        {' · '}派生操作：{viewModel.source.derived.operations.join('、') || '未记录'}
        {' · '}派生获取于：{viewModel.source.derived.retrievedAt || '不可用'}
      </div>

      {viewModel.operationEvidence.length > 0 ? (
        <div style={{ ...wrapStyle, color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          操作溯源：
          {viewModel.operationEvidence.slice(0, 6).map((operation) => (
            <div key={`${operation.subjectId || 'all'}-${operation.operation}`}>
              {operation.subjectId ? `条目 ${operation.subjectId} · ` : ''}
              {operation.operation} · {operation.outcome}
              {operation.retrievedAt ? ` · ${operation.retrievedAt}` : ' · 未获取'}
              {operation.code ? ` · ${operation.code}` : ''}
            </div>
          ))}
          {viewModel.operationEvidence.length > 6 ? (
            <div>另有 {viewModel.operationEvidence.length - 6} 条操作溯源未展开。</div>
          ) : null}
        </div>
      ) : null}

      {viewModel.warnings.length > 0 ? (
        <div style={{ ...wrapStyle, color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {viewModel.warnings.slice(0, 4).map((warning) => (
            <div key={`${warning.code}-${warning.subjectId || ''}`}>
              ⚠ {warning.code} · {warning.message}
            </div>
          ))}
        </div>
      ) : null}
      {viewModel.limitations.length > 0 ? (
        <div style={{ ...wrapStyle, color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          限制：{viewModel.limitations.slice(0, 4).join('；')}
        </div>
      ) : null}
      <Footer label="Bangumi 官方 v0 · 条目关系重合" theme={theme} />
    </CardFrame>
  );
};
