import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';
import type { CharacterCreditIntegrityViewModel } from '../view-models/index.js';
import type { ThemeTokens } from '../themes/index.js';

export interface CharacterCreditIntegrityCardProps {
  viewModel: CharacterCreditIntegrityViewModel;
  theme: ThemeTokens;
  width?: number;
}

function stateLabel(state: CharacterCreditIntegrityViewModel['state']): string {
  return (
    (
      {
        complete: '覆盖完整',
        partial: '部分覆盖',
        conflict: '存在字段冲突',
        unavailable: '来源不可用',
        not_found: '未找到角色',
      } as Record<string, string>
    )[state] || state
  );
}

function boundedText(value: unknown, maximum = 140): string {
  const normalized = String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (normalized.length <= maximum) return normalized || '未知';
  return `${Array.from(normalized)
    .slice(0, maximum - 1)
    .join('')}…`;
}

function panelStyle(theme: ThemeTokens): React.CSSProperties {
  return {
    backgroundColor: theme.surfaceAlt,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    minWidth: 0,
  };
}

function riskLabel(kind: CharacterCreditIntegrityViewModel['risks'][number]['kind']): string {
  if (kind === 'duplicate_stable_id') return '重复稳定 ID';
  if (kind === 'same_name_distinct_ids') return '同名不同 ID';
  return '稳定 ID 字段冲突';
}

function sourceStateLabel(state: string): string {
  if (state === 'complete') return '完整';
  if (state === 'partial') return '部分';
  if (state === 'not_found') return '未找到';
  return '不可用';
}

export const CharacterCreditIntegrityCard: React.FC<CharacterCreditIntegrityCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const tone = viewModel.state === 'complete' ? theme.success : theme.warning;
  const character = viewModel.character;
  const warnings = viewModel.warnings.slice(0, 6);
  const limitations = viewModel.limitations.slice(0, 5);
  const summary = [
    [
      '出演作品',
      `${viewModel.presentation.subjects.rendered}/${viewModel.presentation.subjects.available}`,
    ],
    [
      '相关人物',
      `${viewModel.presentation.persons.rendered}/${viewModel.presentation.persons.available}`,
    ],
    [
      '风险记录',
      `${viewModel.presentation.risks.rendered}/${viewModel.presentation.risks.available}`,
    ],
    ['公式', viewModel.formulaVersion],
  ];

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="角色出演作品与 CV 完整性"
        subtitle={`${boundedText(character?.name || '未知角色', 80)} · 角色 #${character?.id ?? '未知'} · ${stateLabel(viewModel.state)}`}
        theme={theme}
      />

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        仅按 official v0 稳定 ID 读取已知角色的出演作品和相关人物。重复 ID 会计数；不同 ID
        的同名只表示碰撞风险，不表示是同一个实体。
      </div>

      <div style={{ color: tone, fontSize: '11px', lineHeight: 1.5 }}>
        状态：{stateLabel(viewModel.state)} · 来源：{viewModel.source.class} · 检索{' '}
        {boundedText(viewModel.source.retrievedAt, 32)}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: width && width >= 900 ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
          gap: theme.spacing.sm,
        }}
      >
        {summary.map(([label, value]) => (
          <div key={label} style={panelStyle(theme)}>
            <div style={{ color: theme.textMuted, fontSize: '10px' }}>{label}</div>
            <div style={{ color: theme.text, fontSize: '15px', fontWeight: 700 }}>
              {boundedText(value, 56)}
            </div>
          </div>
        ))}
      </div>

      {!character ? (
        <div
          style={{ ...panelStyle(theme), color: theme.warning, fontSize: '12px', lineHeight: 1.5 }}
        >
          未取得可验证的角色详情；作品和人物的空列表不构成不存在结论。
        </div>
      ) : null}

      {viewModel.subjectCredits.length > 0 ? (
        <section>
          <h2 style={{ color: theme.accent, fontSize: '14px', margin: 0 }}>
            出演作品（稳定条目 ID）
          </h2>
          <div style={{ color: theme.text, fontSize: '11px', lineHeight: 1.5 }}>
            {viewModel.subjectCredits
              .map(
                (item) =>
                  `#${item.id} · ${boundedText(item.nameCn || item.name, 80)} · ${boundedText(item.staff || '关系未提供', 50)} · 观测 ${item.observedRows} 次${item.duplicateRows > 0 ? `（重复 ${item.duplicateRows}）` : ''}`,
              )
              .join('\n')}
          </div>
        </section>
      ) : null}

      {viewModel.personCredits.length > 0 ? (
        <section>
          <h2 style={{ color: theme.accent, fontSize: '14px', margin: 0 }}>
            相关人物 / CV（稳定人物 ID）
          </h2>
          <div style={{ color: theme.text, fontSize: '11px', lineHeight: 1.5 }}>
            {viewModel.personCredits
              .map((person) => {
                const subjects = person.subjects
                  .slice(0, 5)
                  .map(
                    (subject) =>
                      `#${subject.subjectId} ${boundedText(subject.subjectNameCn || subject.subjectName, 52)}`,
                  )
                  .join('、');
                return `#${person.id} · ${boundedText(person.name, 70)} · ${subjects || '作品关系未提供'}${person.subjectsOmitted > 0 ? ` · 另有 ${person.subjectsOmitted} 个作品关系省略` : ''}`;
              })
              .join('\n')}
          </div>
        </section>
      ) : null}

      {viewModel.risks.length > 0 ? (
        <section style={panelStyle(theme)}>
          <h2 style={{ color: theme.warning, fontSize: '14px', margin: 0 }}>
            身份风险（不执行合并）
          </h2>
          <div
            style={{ color: theme.text, fontSize: '11px', lineHeight: 1.5, whiteSpace: 'pre-line' }}
          >
            {viewModel.risks
              .map(
                (risk) =>
                  `· ${riskLabel(risk.kind)}：${risk.ids.map((id) => `#${id}`).join('、')} · ${boundedText(risk.names.join(' / '), 130)}${risk.normalizedName ? ` · 归一化键 ${boundedText(risk.normalizedName, 80)}` : ''}\n  ${boundedText(risk.message, 220)}`,
              )
              .join('\n')}
          </div>
        </section>
      ) : null}

      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        详情：{sourceStateLabel(viewModel.coverage.detail.state)} · 作品：
        {sourceStateLabel(viewModel.coverage.subjects.state)}{' '}
        {viewModel.coverage.subjects.returnedRows}/{viewModel.coverage.subjects.uniqueIdsObserved} ·
        人物：{sourceStateLabel(viewModel.coverage.persons.state)}{' '}
        {viewModel.coverage.persons.returnedRows}/{viewModel.coverage.persons.uniqueIdsObserved} ·
        响应上限 {viewModel.coverage.detail.maxResponseBytes} bytes
        <br />
        证据操作：{viewModel.operationEvidence.map((item) => item.operation).join(' · ')}
      </div>

      {warnings.length > 0 ? (
        <div
          style={{
            color: theme.warning,
            fontSize: '10px',
            lineHeight: 1.5,
            whiteSpace: 'pre-line',
          }}
        >
          {warnings
            .map((warning) => `· ${warning.code}：${boundedText(warning.message, 220)}`)
            .join('\n')}
        </div>
      ) : null}

      {limitations.length > 0 ? (
        <div
          style={{
            color: theme.textMuted,
            fontSize: '10px',
            lineHeight: 1.5,
            whiteSpace: 'pre-line',
          }}
        >
          {limitations.map((limitation) => `· ${boundedText(limitation, 220)}`).join('\n')}
        </div>
      ) : null}

      <Footer label="Bangumi Agent Kit · official v0 稳定 ID 观察" theme={theme} />
    </CardFrame>
  );
};
