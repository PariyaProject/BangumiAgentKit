import React from 'react';
import { PersonProfileViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { PersonAvatar } from '../components/PersonAvatar.js';
import { RendererIcon } from '../components/RendererIcon.js';
import { TitleBlock } from '../components/TitleBlock.js';

export interface PersonProfileCardProps {
  viewModel: PersonProfileViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
  width?: number;
}

function bloodTypeLabel(value?: number | null): string | undefined {
  return value === undefined || value === null
    ? undefined
    : { 1: 'A', 2: 'B', 3: 'AB', 4: 'O' }[value] || `未知 (${value})`;
}

const GENDER_LABELS: Record<string, string> = {
  female: '女性',
  male: '男性',
  unknown: '未知性别',
};

const CAREER_LABELS: Record<string, string> = {
  artist: '歌手/艺术家',
  actor: '演员',
  seiyu: '声优',
  'voice actor': '声优',
  voice_actor: '声优',
  director: '导演',
  writer: '编剧',
  producer: '制作人',
  mangaka: '漫画家',
  illustrator: '插画家',
  composer: '作曲家',
  musician: '音乐人',
};

const MEDIA_LABELS: Record<string, string> = {
  anime: '动画',
  tv: '电视动画',
  movie: '剧场版',
  book: '书籍',
  music: '音乐',
  game: '游戏',
  real: '真人作品',
  other: '其他',
};

const ROLE_LABELS: Record<string, string> = {
  main: '主役',
  assistant: '协役',
};

const IDENTITY_FIELD_LABELS: Record<string, string> = {
  'person.gender': '性别',
  'person.birth_year': '出生日期',
  'person.blood_type': '血型',
};

function humanizeGender(value?: string): string | undefined {
  return value ? GENDER_LABELS[value.toLowerCase()] || value : undefined;
}

function humanizeCareer(value: string): string {
  return CAREER_LABELS[value.trim().toLowerCase()] || value;
}

function humanizeRole(value: string): string {
  return ROLE_LABELS[value.trim().toLowerCase()] || humanizeCareer(value);
}

function humanizeDistributionLabel(label: string, kind: 'media' | 'role'): string {
  const normalized = label.trim().toLowerCase();
  if (kind === 'media') return MEDIA_LABELS[normalized] || label;
  return humanizeRole(label);
}

function DistributionList({
  title,
  items,
  theme,
  compact,
  labelKind,
}: {
  title: string;
  items: PersonProfileViewModel['mediaBreakdown'];
  theme: ThemeTokens;
  compact: boolean;
  labelKind: 'media' | 'role';
}) {
  return (
    <div
      data-render-mask="panel"
      style={{
        flex: compact ? '1 1 100%' : 1,
        minWidth: compact ? 0 : '260px',
        backgroundColor: theme.surfaceAlt,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius.md,
        padding: theme.spacing.md,
        clipPath: theme.design.masks.panel,
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
              <span style={{ color: theme.textMuted, fontSize: '13px', overflowWrap: 'anywhere' }}>
                {humanizeDistributionLabel(item.label, labelKind)}
              </span>
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
                    · 官方类型码：{item.rawCodes.join(', ')}
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
  compact,
  theme,
}: {
  title: string;
  items: PersonProfileViewModel['subjectCredits'];
  hiddenCount?: number;
  unobservedCount?: number;
  compact: boolean;
  theme: ThemeTokens;
}) {
  return (
    <div
      style={{
        flex: compact ? '1 1 100%' : 1,
        minWidth: compact ? 0 : '360px',
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
        <div
          data-render-mask="panel-alt"
          style={{
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            color: theme.textMuted,
            fontSize: '12px',
            clipPath: theme.design.masks.panelAlt,
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
              <div
                style={{
                  color: theme.text,
                  fontSize: '13px',
                  fontWeight: 600,
                  overflowWrap: 'anywhere',
                }}
              >
                {item.nameCn || item.name}
              </div>
              {item.nameCn && item.nameCn !== item.name && (
                <div style={{ color: theme.textMuted, fontSize: '11px', overflowWrap: 'anywhere' }}>
                  {item.name}
                </div>
              )}
              {item.nameCnSource !== undefined && (
                <div style={{ color: theme.textMuted, fontSize: '11px', overflowWrap: 'anywhere' }}>
                  {item.nameCnSource === null
                    ? '本次没有可用的中文名字段（缺失或值无效）'
                    : item.nameCnSource.trim().length === 0
                      ? '上游中文名字段为空'
                      : `上游已提供中文名${item.nameCnSource === item.name ? '（与原名相同）' : ''}`}
                </div>
              )}
              {(item.role || item.subjectNameCn || item.subjectName || item.eps) && (
                <div
                  style={{
                    color: theme.textMuted,
                    fontSize: '11px',
                    marginTop: '2px',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {[
                    item.role ? humanizeRole(item.role) : undefined,
                    item.subjectNameCn || item.subjectName,
                    item.eps,
                  ]
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

function ReleaseChronologyPanel({
  chronology,
  theme,
  compact,
}: {
  chronology: NonNullable<PersonProfileViewModel['releaseChronology']>;
  theme: ThemeTokens;
  compact: boolean;
}) {
  const observations = [
    ...(chronology.earliestObserved
      ? [{ label: '本次样本中最早日期', extreme: chronology.earliestObserved }]
      : []),
    ...(chronology.latestObserved
      ? [{ label: '本次样本中最近日期', extreme: chronology.latestObserved }]
      : []),
  ];
  const coverageItems = [
    ['动画关系', `${chronology.animeRelationRowsReturned} 行`],
    ['去重条目', `${chronology.uniqueAnimeSubjects} 部`],
    [
      '详情读取',
      `${chronology.selectedSubjectDetails} 部 · ${chronology.succeededSubjectDetails} 成功 · ${chronology.failedSubjectDetails} 失败`,
    ],
    ['缺少日期', `${chronology.missingDateSubjects}`],
    ['日期无效', `${chronology.invalidDateSubjects}`],
    ['样本外', `${chronology.omittedAnimeSubjects} 部`],
  ];

  return (
    <section
      data-layout="person-profile-release-chronology"
      data-render-mask="panel-alt"
      style={{
        position: 'relative',
        backgroundColor: theme.surfaceAlt,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius.lg,
        clipPath: theme.design.masks.panelAlt,
        color: theme.text,
        padding: compact ? `${theme.spacing.md} ${theme.spacing.lg}` : theme.spacing.lg,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm,
          flexWrap: 'wrap',
          marginBottom: theme.spacing.md,
        }}
      >
        <RendererIcon name="calendar" theme={theme} badge />
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <div
            style={{
              color: theme.text,
              fontSize: '15px',
              fontWeight: 700,
              lineHeight: 1.3,
              overflowWrap: 'anywhere',
            }}
          >
            动画播出 / 发行日期观察
          </div>
          <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.4 }}>
            只观察本次受限样本
          </div>
        </div>
        <span
          data-render-mask="tag"
          style={{
            backgroundColor: theme.tones.butter.surface,
            border: `1px solid ${theme.tones.butter.border}`,
            clipPath: theme.design.masks.tag,
            color: theme.tones.butter.foreground,
            flex: '0 0 auto',
            fontSize: '10px',
            fontWeight: 700,
            padding: '4px 10px',
          }}
        >
          受限样本
        </span>
      </div>

      {chronology.state === 'not_computable' || observations.length === 0 ? (
        <div
          data-layout="chronology-empty-state"
          style={{
            backgroundColor: theme.background,
            borderLeft: `2px solid ${theme.tones.butter.border}`,
            borderRadius: theme.radius.sm,
            color: theme.textMuted,
            fontSize: '12px',
            lineHeight: 1.55,
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
          }}
        >
          已选取 {chronology.selectedSubjectDetails}{' '}
          部动画作品详情，但样本中没有可用于比较的有效日期。
        </div>
      ) : (
        <div
          data-layout="chronology-timeline"
          style={{
            display: compact ? 'flex' : 'grid',
            flexDirection: compact ? 'column' : undefined,
            gap: compact ? 0 : theme.spacing.lg,
            gridTemplateColumns:
              observations.length > 1 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
            position: 'relative',
          }}
        >
          {!compact && observations.length > 1 && (
            <svg
              aria-hidden="true"
              data-layout="chronology-connector"
              viewBox="0 0 100 32"
              preserveAspectRatio="none"
              style={{
                height: 32,
                left: 0,
                overflow: 'visible',
                pointerEvents: 'none',
                position: 'absolute',
                top: 0,
                width: '100%',
                zIndex: 0,
              }}
            >
              <path
                d="M25 16 C36 -1 64 33 75 16"
                fill="none"
                stroke={theme.tones.butter.border}
                strokeDasharray={theme.design.markerStyle === 'gallery' ? undefined : '2 3'}
                strokeWidth={theme.design.markerStyle === 'zine' ? 2.5 : 1.5}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
          {observations.map(({ label, extreme }, index) => {
            const visibleSubjects = extreme.subjects.slice(0, 3);
            const omittedTies = Math.max(0, extreme.subjects.length - visibleSubjects.length);
            return (
              <div
                key={label}
                data-layout="chronology-observation"
                style={{
                  alignItems: compact ? 'stretch' : undefined,
                  display: compact ? 'flex' : 'block',
                  gap: compact ? theme.spacing.sm : undefined,
                  minWidth: 0,
                  paddingTop: compact ? 0 : 32,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {compact ? (
                  <div
                    aria-hidden="true"
                    style={{
                      alignItems: 'center',
                      display: 'flex',
                      flex: '0 0 16px',
                      flexDirection: 'column',
                    }}
                  >
                    <span
                      data-layout="chronology-node"
                      style={{
                        backgroundColor: theme.tones.butter.foreground,
                        border: `3px solid ${theme.tones.butter.surface}`,
                        borderRadius: '50%',
                        boxSizing: 'border-box',
                        flex: '0 0 14px',
                        height: 14,
                        width: 14,
                      }}
                    />
                    {index < observations.length - 1 && (
                      <svg
                        aria-hidden="true"
                        data-layout="chronology-connector"
                        viewBox="0 0 12 100"
                        preserveAspectRatio="none"
                        style={{
                          flex: '1 1 auto',
                          minHeight: 22,
                          overflow: 'visible',
                          width: 12,
                        }}
                      >
                        <path
                          d="M6 0 C1 28 11 68 6 100"
                          fill="none"
                          stroke={theme.tones.butter.border}
                          strokeDasharray={
                            theme.design.markerStyle === 'gallery' ? undefined : '2 3'
                          }
                          strokeWidth={theme.design.markerStyle === 'zine' ? 2.5 : 1.5}
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    )}
                  </div>
                ) : (
                  <span
                    data-layout="chronology-node"
                    aria-hidden="true"
                    style={{
                      backgroundColor: theme.tones.butter.foreground,
                      border: `3px solid ${theme.tones.butter.surface}`,
                      borderRadius: '50%',
                      boxSizing: 'border-box',
                      height: 14,
                      left: '50%',
                      position: 'absolute',
                      top: 9,
                      transform: 'translateX(-50%)',
                      width: 14,
                      zIndex: 2,
                    }}
                  />
                )}
                <div
                  style={{
                    flex: compact ? '1 1 auto' : undefined,
                    minWidth: 0,
                    paddingBottom:
                      compact && index < observations.length - 1 ? theme.spacing.sm : 0,
                  }}
                >
                  <div
                    style={{
                      color: theme.textMuted,
                      fontSize: '11px',
                      fontWeight: 600,
                      lineHeight: 1.35,
                    }}
                  >
                    {label}
                  </div>
                  <div
                    data-layout="chronology-date"
                    style={{
                      color: theme.text,
                      fontSize: compact ? '18px' : '20px',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 750,
                      letterSpacing: '-0.025em',
                      lineHeight: 1.2,
                      marginTop: '2px',
                    }}
                  >
                    {extreme.date}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: theme.spacing.xs,
                      marginTop: theme.spacing.xs,
                      minWidth: 0,
                    }}
                  >
                    {visibleSubjects.map((subject) => (
                      <span
                        key={`${subject.id}-${subject.name}`}
                        style={{
                          backgroundColor: theme.background,
                          borderRadius: theme.design.tagRadius,
                          color: theme.textMuted,
                          fontSize: '11px',
                          lineHeight: 1.4,
                          maxWidth: '100%',
                          overflowWrap: 'anywhere',
                          padding: '3px 7px',
                        }}
                      >
                        {subject.name} (#{subject.id})
                      </span>
                    ))}
                    {omittedTies > 0 && (
                      <span style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.4 }}>
                        同日另有 {omittedTies} 部
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        data-layout="chronology-coverage"
        style={{
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
          marginTop: theme.spacing.md,
          paddingTop: theme.spacing.sm,
        }}
      >
        {coverageItems.map(([label, value]) => (
          <span
            key={label}
            data-render-mask="tag"
            style={{
              backgroundColor: theme.background,
              border: `1px solid ${theme.border}`,
              clipPath: theme.design.masks.tag,
              color: theme.textMuted,
              fontSize: '10px',
              lineHeight: 1.35,
              padding: '4px 8px',
            }}
          >
            {label} <strong style={{ color: theme.text }}>{value}</strong>
          </span>
        ))}
      </div>

      <div
        data-layout="chronology-limitations"
        style={{
          color: theme.textMuted,
          fontSize: '10px',
          lineHeight: 1.5,
          marginTop: theme.spacing.sm,
          overflowWrap: 'anywhere',
        }}
      >
        上游未说明人物作品关系是否完整；日期仅表示条目的播出 /
        发行日期，不代表人物实际参与时间或完整生涯。
      </div>
    </section>
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
  const gender = humanizeGender(person.gender);
  const title = person.nameCn || person.name;
  const subtitle = [
    person.nameCn && person.nameCn !== person.name ? person.name : undefined,
    `人物编号 ${person.id}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const stateLabel =
    viewModel.state === 'complete'
      ? '本次返回范围未截断'
      : viewModel.state === 'unavailable'
        ? '不可用'
        : viewModel.state === 'not_computable'
          ? '不可计算'
          : '部分';
  const stateColor = viewModel.state === 'complete' ? theme.textMuted : theme.warning;
  const compactLayout = (width ?? 960) < 520;

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
          <TitleBlock title={title} subtitle={subtitle} theme={theme} icon="person" />
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
                  {humanizeCareer(career)}
                </span>
              ))
            ) : (
              <span style={{ color: theme.textMuted, fontSize: '12px' }}>未提供职业标签</span>
            )}
          </div>
        </div>
      </div>

      <div
        data-render-mask="panel"
        style={{
          backgroundColor: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.xs,
          clipPath: theme.design.masks.panel,
        }}
      >
        <div style={{ color: theme.text, fontSize: '13px', fontWeight: 700 }}>
          {person.typeLabel || '人物类型未知'}
          {gender ? ` · ${gender}` : ''}
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
            <span style={{ color: theme.text, fontWeight: 600 }}>
              简介{person.summaryTruncated ? '（摘要）' : ''}：
            </span>
            {person.summary}
          </div>
        )}
        {person.identityMissingFields.length > 0 && (
          <div style={{ color: theme.warning, fontSize: '11px' }}>
            未提供身份字段：
            {person.identityMissingFields
              .map((field) => IDENTITY_FIELD_LABELS[field] || field)
              .join('、')}
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
            data-render-mask="panel-alt"
            style={{
              flex: `1 1 ${compactLayout ? '84px' : '140px'}`,
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm,
              textAlign: 'center',
              clipPath: theme.design.masks.panelAlt,
            }}
          >
            <div style={{ color: theme.accent, fontSize: '22px', fontWeight: 700 }}>{value}</div>
            <div style={{ color: theme.textMuted, fontSize: '11px' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <DistributionList
          title="作品媒介"
          items={viewModel.mediaBreakdown}
          theme={theme}
          compact={compactLayout}
          labelKind="media"
        />
        <DistributionList
          title="角色媒介"
          items={viewModel.characterMediaBreakdown}
          theme={theme}
          compact={compactLayout}
          labelKind="media"
        />
        <DistributionList
          title="作品职位"
          items={viewModel.roleBreakdown}
          theme={theme}
          compact={compactLayout}
          labelKind="role"
        />
        <DistributionList
          title="角色关系"
          items={viewModel.characterRoleBreakdown}
          theme={theme}
          compact={compactLayout}
          labelKind="role"
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.lg }}>
        <CreditList
          title="作品关系（返回样本）"
          items={viewModel.subjectCredits}
          hiddenCount={viewModel.hiddenSubjectCredits}
          unobservedCount={viewModel.unobservedSubjectCredits}
          compact={compactLayout}
          theme={theme}
        />
        <CreditList
          title="角色关系（返回样本）"
          items={viewModel.characterCredits}
          hiddenCount={viewModel.hiddenCharacterCredits}
          unobservedCount={viewModel.unobservedCharacterCredits}
          compact={compactLayout}
          theme={theme}
        />
      </div>

      {viewModel.releaseChronology && (
        <ReleaseChronologyPanel
          chronology={viewModel.releaseChronology}
          theme={theme}
          compact={compactLayout}
        />
      )}

      <div
        data-render-mask="panel"
        style={{
          backgroundColor: coverage.state === 'partial' ? `${theme.warning}18` : theme.surfaceAlt,
          border: `1px solid ${coverage.state === 'partial' ? theme.warning : theme.border}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          color: coverage.state === 'partial' ? theme.warning : theme.textMuted,
          fontSize: '12px',
          lineHeight: 1.5,
          clipPath: theme.design.masks.panel,
        }}
      >
        <div style={{ fontWeight: 700 }}>
          状态：{stateLabel} · 覆盖：
          {coverage.state === 'partial' ? '部分' : '本次返回范围未截断'} · 已观察{' '}
          {coverage.observed} 条，返回 {coverage.returned} 条，展示 {coverage.rendered} 条
          {coverage.unobserved > 0 ? `，未读取 ${coverage.unobserved} 条` : ''}
          {' · 上游未说明作品关系是否完整'}
        </div>
        {viewModel.limitations.map((limitation) => (
          <div key={limitation}>• {limitation}</div>
        ))}
        {viewModel.warnings
          .filter((warning) => warning.code !== 'MISSING_IDENTITY_FIELDS')
          .map((warning) => (
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
