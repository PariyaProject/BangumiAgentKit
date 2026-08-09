import React from 'react';
import { PersonProfileViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { PersonAvatar } from '../components/PersonAvatar.js';
import { TitleBlock } from '../components/TitleBlock.js';

export interface PersonProfileCardProps {
  viewModel: PersonProfileViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
  width?: number;
}

function bloodTypeLabel(value?: number): string | undefined {
  return value === undefined
    ? undefined
    : { 1: 'A', 2: 'B', 3: 'AB', 4: 'O' }[value] || `未知 (${value})`;
}

function DistributionList({
  title,
  items,
  theme,
}: {
  title: string;
  items: PersonProfileViewModel['mediaBreakdown'];
  theme: ThemeTokens;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: '260px',
        backgroundColor: theme.surfaceAlt,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius.md,
        padding: theme.spacing.md,
      }}
    >
      <div
        style={{
          color: theme.text,
          fontSize: '14px',
          fontWeight: 700,
          marginBottom: theme.spacing.sm,
        }}
      >
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '12px' }}>暂无可分组关系</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
          {items.map((item) => (
            <div
              key={item.label}
              style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.sm }}
            >
              <span style={{ color: theme.textMuted, fontSize: '13px' }}>{item.label}</span>
              <span style={{ color: theme.accent, fontSize: '13px', fontWeight: 700 }}>
                {item.count}
                {item.uniqueSubjects > 0 && (
                  <span style={{ color: theme.textMuted, fontWeight: 400 }}>
                    {' '}
                    · {item.uniqueSubjects}部
                  </span>
                )}
                {item.rawCodes && item.rawCodes.length > 0 && (
                  <span style={{ color: theme.textMuted, fontWeight: 400, fontSize: '11px' }}>
                    {' '}
                    · v0: {item.rawCodes.join(', ')}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreditList({
  title,
  items,
  hiddenCount,
  unobservedCount,
  theme,
}: {
  title: string;
  items: PersonProfileViewModel['subjectCredits'];
  hiddenCount?: number;
  unobservedCount?: number;
  theme: ThemeTokens;
}) {
  return (
    <div style={{ flex: 1, minWidth: '360px' }}>
      <div
        style={{
          color: theme.text,
          fontSize: '14px',
          fontWeight: 700,
          marginBottom: theme.spacing.sm,
        }}
      >
        {title}
      </div>
      {items.length === 0 ? (
        <div
          style={{
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            color: theme.textMuted,
            fontSize: '12px',
          }}
        >
          未返回关系明细
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
          {items.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              style={{
                backgroundColor: theme.surfaceAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.sm,
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              }}
            >
              <div style={{ color: theme.text, fontSize: '13px', fontWeight: 600 }}>
                {item.nameCn || item.name}
              </div>
              {item.nameCn && item.nameCn !== item.name && (
                <div style={{ color: theme.textMuted, fontSize: '11px' }}>{item.name}</div>
              )}
              {(item.role || item.subjectNameCn || item.subjectName || item.eps) && (
                <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '2px' }}>
                  {[item.role, item.subjectNameCn || item.subjectName, item.eps]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
          ))}
          {hiddenCount && hiddenCount > 0 && (
            <div style={{ color: theme.textMuted, fontSize: '11px', textAlign: 'center' }}>
              另有 {hiddenCount} 条已返回关系未展示
            </div>
          )}
          {unobservedCount && unobservedCount > 0 && (
            <div style={{ color: theme.warning, fontSize: '11px', textAlign: 'center' }}>
              另有 {unobservedCount} 条关系未读取
            </div>
          )}
        </div>
      )}
      {items.length === 0 && unobservedCount && unobservedCount > 0 && (
        <div style={{ color: theme.warning, fontSize: '11px', marginTop: theme.spacing.xs }}>
          另有 {unobservedCount} 条关系未读取
        </div>
      )}
      {items.length === 0 && hiddenCount && hiddenCount > 0 && (
        <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: theme.spacing.xs }}>
          另有 {hiddenCount} 条已返回关系未展示
        </div>
      )}
    </div>
  );
}

export const PersonProfileCard: React.FC<PersonProfileCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
  width,
}) => {
  const { person, summary, source, coverage } = viewModel;
  const avatarSrc = person.image ? resolvedImages[person.image] || person.image : undefined;
  const sourceLabel = source.retrievedAt ? `${source.label} · ${source.retrievedAt}` : source.label;
  const bloodType = bloodTypeLabel(person.bloodType);
  const stateLabel =
    viewModel.state === 'complete'
      ? '完整'
      : viewModel.state === 'unavailable'
        ? '不可用'
        : viewModel.state === 'not_computable'
          ? '不可计算'
          : '部分';
  const stateColor = viewModel.state === 'complete' ? theme.textMuted : theme.warning;

  return (
    <CardFrame theme={theme} width={width}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.lg, flexWrap: 'wrap' }}
      >
        <PersonAvatar src={avatarSrc} name={person.name} theme={theme} size={76} showName={false} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.sm,
            flex: '1 1 320px',
            minWidth: 0,
          }}
        >
          <TitleBlock title={person.name} subtitle={`Person ID: ${person.id}`} theme={theme} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            {person.career.length > 0 ? (
              person.career.map((career) => (
                <span
                  key={career}
                  style={{
                    color: theme.accent,
                    backgroundColor: theme.surfaceAlt,
                    border: `1px solid ${theme.border}`,
                    borderRadius: theme.radius.sm,
                    padding: '3px 8px',
                    fontSize: '11px',
                  }}
                >
                  {career}
                </span>
              ))
            ) : (
              <span style={{ color: theme.textMuted, fontSize: '12px' }}>未提供职业标签</span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          backgroundColor: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.xs,
        }}
      >
        <div style={{ color: theme.text, fontSize: '13px', fontWeight: 700 }}>
          {person.typeLabel || '人物类型未知'}
          {person.gender ? ` · ${person.gender}` : ''}
          {person.birthDate ? ` · ${person.birthDate}` : ''}
          {bloodType ? ` · 血型 ${bloodType}` : ''}
        </div>
        {person.aliases && person.aliases.length > 0 && (
          <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
            别名：{person.aliases.join('、')}
          </div>
        )}
        {person.summary && (
          <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
            {person.summary}
          </div>
        )}
        {person.identityMissingFields.length > 0 && (
          <div style={{ color: theme.warning, fontSize: '11px' }}>
            未提供身份字段：{person.identityMissingFields.join('、')}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {[
          ['去重作品', summary.uniqueSubjects],
          ['作品关系', summary.subjectCredits],
          ['去重角色', summary.uniqueCharacters],
          ['角色关系', summary.characterCredits],
          ['角色作品', summary.characterSubjects],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              flex: '1 1 140px',
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm,
              textAlign: 'center',
            }}
          >
            <div style={{ color: theme.accent, fontSize: '22px', fontWeight: 700 }}>{value}</div>
            <div style={{ color: theme.textMuted, fontSize: '11px' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <DistributionList title="作品媒介" items={viewModel.mediaBreakdown} theme={theme} />
        <DistributionList
          title="角色媒介"
          items={viewModel.characterMediaBreakdown}
          theme={theme}
        />
        <DistributionList
          title="作品职位（原始标签）"
          items={viewModel.roleBreakdown}
          theme={theme}
        />
        <DistributionList
          title="角色关系（原始标签）"
          items={viewModel.characterRoleBreakdown}
          theme={theme}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.lg }}>
        <CreditList
          title="作品关系（返回样本）"
          items={viewModel.subjectCredits}
          hiddenCount={viewModel.hiddenSubjectCredits}
          unobservedCount={viewModel.unobservedSubjectCredits}
          theme={theme}
        />
        <CreditList
          title="角色关系（返回样本）"
          items={viewModel.characterCredits}
          hiddenCount={viewModel.hiddenCharacterCredits}
          unobservedCount={viewModel.unobservedCharacterCredits}
          theme={theme}
        />
      </div>

      <div
        style={{
          backgroundColor: coverage.state === 'partial' ? `${theme.warning}18` : theme.surfaceAlt,
          border: `1px solid ${coverage.state === 'partial' ? theme.warning : theme.border}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          color: coverage.state === 'partial' ? theme.warning : theme.textMuted,
          fontSize: '12px',
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 700 }}>
          状态：{stateLabel} · 覆盖：{coverage.state === 'partial' ? '部分' : '完整'} · 已观察{' '}
          {coverage.observed} 条，返回 {coverage.returned} 条，展示 {coverage.rendered} 条
          {coverage.unobserved > 0 ? `，未读取 ${coverage.unobserved} 条` : ''}
        </div>
        {viewModel.limitations.map((limitation) => (
          <div key={limitation}>• {limitation}</div>
        ))}
        {viewModel.warnings.map((warning) => (
          <div
            key={warning.code}
            style={{ color: warning.state === 'not_computable' ? theme.textMuted : stateColor }}
          >
            ⚠ {warning.message}
          </div>
        ))}
      </div>

      <Footer label={sourceLabel} theme={theme} />
    </CardFrame>
  );
};
