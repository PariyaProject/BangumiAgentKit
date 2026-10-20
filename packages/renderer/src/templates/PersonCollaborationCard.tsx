import React from 'react';
import { PersonCollaborationViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';

export interface PersonCollaborationCardProps {
  viewModel: PersonCollaborationViewModel;
  theme: ThemeTokens;
  width?: number;
}

function stateLabel(state: PersonCollaborationViewModel['state']): string {
  return state === 'complete'
    ? '完整'
    : state === 'partial'
      ? '部分覆盖'
      : state === 'unavailable'
        ? '来源不可用'
        : state === 'not_found'
          ? '人物不存在'
          : '当前不可计算';
}

function stateColor(state: PersonCollaborationViewModel['state'], theme: ThemeTokens): string {
  return state === 'complete' ? theme.success : theme.warning;
}

function kindLabel(kind: PersonCollaborationViewModel['kind']): string {
  return kind === 'voice' ? '声优合作' : kind === 'staff' ? '制作人员合作' : '声优与制作人员合作';
}

function mediaLabel(media: PersonCollaborationViewModel['media']): string {
  return media === 'anime' ? '动画' : '全部媒介';
}

function formatEvidenceTimestamp(value?: string): string {
  if (!value) return '未知';
  const match =
    /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?/u.exec(
      value,
    );
  if (!match) return value;

  const [, date, hour, minute, rawZone] = match;
  if (!hour || (hour === '00' && minute === '00' && (!rawZone || rawZone === 'Z' || rawZone === '+00:00' || rawZone === '+0000'))) {
    return date!;
  }
  const zone = rawZone === 'Z' ? ' UTC' : rawZone ? ` ${rawZone}` : '';
  return `${date} ${hour}:${minute}${zone}`;
}

const wrapStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};

export const PersonCollaborationCard: React.FC<PersonCollaborationCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const renderWidth = width ?? 960;
  const compact = renderWidth < 520;
  const narrow = renderWidth < 360;
  const twoColumnStats = renderWidth <= 520;
  const separateAlternateNames = renderWidth < 520;
  const collaboratorDisplayLimit = narrow ? 2 : renderWidth < 520 ? 4 : renderWidth < 900 ? 7 : 10;
  const sharedSubjectDisplayLimit = narrow ? 1 : renderWidth < 520 ? 2 : renderWidth < 900 ? 3 : 5;
  const visibleCollaborators = viewModel.collaborators.slice(0, collaboratorDisplayLimit);
  const omittedReturnedCollaborators = viewModel.collaborators.length - visibleCollaborators.length;
  const tone = stateColor(viewModel.state, theme);
  const visibleWarnings = viewModel.warnings.slice(0, narrow ? 2 : compact ? 4 : 5);
  const visibleLimitations = viewModel.limitations.slice(0, narrow ? 2 : compact ? 3 : 4);
  const visibleOperations = viewModel.sourceOperations.slice(0, compact ? 4 : 8);
  const visibleExclusions = viewModel.exclusions.slice(0, compact ? 3 : 10);
  const formulaEvidence = viewModel.evidence.find((item) => item.source === 'derived-s7');
  const coverageFacts = [
    ['目标关系', `${viewModel.coverage.relationRowsSelected}/${viewModel.coverage.relationRowsObserved}`],
    ['筛选匹配', String(viewModel.coverage.relationRowsMatchingFilters)],
    ['作品 fan-out', `${viewModel.coverage.subjectIdsSelected}/${viewModel.coverage.subjectIdsObserved}`],
    ['请求成功 / 失败', `${viewModel.coverage.participantRequestsSucceeded} / ${viewModel.coverage.participantRequestsFailed}`],
    ['参与者采用 / 观察', `${viewModel.coverage.participantRowsReturned}/${viewModel.coverage.participantRowsObserved}`],
    ...(viewModel.coverage.relationRowsDroppedAtLimit > 0
      ? [['关系省略', String(viewModel.coverage.relationRowsDroppedAtLimit)]]
      : []),
    ...(viewModel.coverage.truncated ? [['样本边界', '已触及']] : []),
  ];
  const contextChips = [
    ['状态', stateLabel(viewModel.state)],
    ['媒介', mediaLabel(viewModel.media)],
    ...(viewModel.targetRole ? [['目标标签', viewModel.targetRole]] : []),
    ...(viewModel.collaboratorRole ? [['合作方职位', viewModel.collaboratorRole]] : []),
  ];
  const stats = [
    ['合作人物', viewModel.coverage.collaboratorsObserved],
    ['返回人物', viewModel.coverage.collaboratorsReturned],
    ['共同作品证据', viewModel.coverage.sharedSubjectRowsReturned],
    ['作品 fan-out', viewModel.coverage.participantRequests],
  ];

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title={viewModel.person.nameCn || viewModel.person.name}
        subtitle={`${kindLabel(viewModel.kind)} · Person ID ${viewModel.person.id}`}
        theme={theme}
        icon="relations"
      />

      <div
        data-layout="collaboration-context"
        style={{
          ...wrapStyle,
          display: 'flex',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
        }}
      >
        {contextChips.map(([label, value]) => (
          <span
            key={label}
            style={{
              ...wrapStyle,
              color: label === '状态' ? tone : theme.textMuted,
              backgroundColor: label === '状态' ? `${tone}18` : theme.surfaceAlt,
              border: `1px solid ${label === '状态' ? tone : theme.border}`,
              borderRadius: theme.design.badgeRadius,
              padding: '4px 8px',
              fontSize: '11px',
              lineHeight: 1.35,
            }}
          >
            <span style={{ color: theme.textMuted }}>{label}</span> {value}
          </span>
        ))}
      </div>

      <div
        data-layout="collaboration-stats"
        style={{
          ...wrapStyle,
          display: twoColumnStats ? 'grid' : 'flex',
          gridTemplateColumns: twoColumnStats ? 'repeat(2, minmax(0, 1fr))' : undefined,
          flexWrap: twoColumnStats ? undefined : 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {stats.map(([label, value]) => (
          <div
            key={String(label)}
            data-layout="collaboration-stat"
            style={{
              ...wrapStyle,
              flex: twoColumnStats ? undefined : '1 1 130px',
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: compact ? theme.spacing.xs : theme.spacing.sm,
              textAlign: 'center',
            }}
          >
            <div style={{ ...wrapStyle, color: theme.accent, fontSize: narrow ? '19px' : '22px', fontWeight: 700 }}>
              {value}
            </div>
            <div style={{ ...wrapStyle, color: theme.textMuted, fontSize: narrow ? '10px' : '11px' }}>{label}</div>
          </div>
        ))}
      </div>

      <div
        data-layout="collaboration-coverage"
        style={{
          ...wrapStyle,
          backgroundColor: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          padding: compact ? theme.spacing.sm : theme.spacing.md,
        }}
      >
        <div style={{ color: theme.text, fontSize: '12px', fontWeight: 700, marginBottom: theme.spacing.xs }}>
          覆盖摘要
        </div>
        <div
          role="list"
          style={{
            ...wrapStyle,
            display: 'grid',
            gridTemplateColumns: compact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
            gap: theme.spacing.xs,
          }}
        >
          {coverageFacts.map(([label, value]) => (
            <div
              key={label}
              role="listitem"
              data-layout="collaboration-coverage-item"
              style={{
                ...wrapStyle,
                padding: '5px 7px',
                borderRadius: theme.radius.sm,
                backgroundColor: theme.surface,
                color: theme.textMuted,
                fontSize: '10px',
                lineHeight: 1.35,
              }}
            >
              <div>{label}</div>
              <div style={{ color: theme.text, fontSize: '12px', fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          ...wrapStyle,
          backgroundColor: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          color: theme.textMuted,
          fontSize: '11px',
          lineHeight: 1.5,
        }}
      >
        <div style={{ color: theme.text, fontSize: '14px', fontWeight: 700, marginBottom: 6 }}>
          证据与来源路径
        </div>
        {formulaEvidence && (
          <div style={wrapStyle}>
            推导公式：{formulaEvidence.formulaVersion || '未记录'} ·{' '}
            {formulaEvidence.description || '按稳定人物 ID 和作品 ID 去重的官方 v0 共同作品观察。'}
          </div>
        )}
        {visibleOperations.map((operation) => {
          const failedOutcomes = operation.outcomes.filter((outcome) => outcome.state === 'failed');
          const latestOutcome = operation.outcomes[operation.outcomes.length - 1];
          return (
            <div key={operation.operation} style={{ ...wrapStyle, marginTop: 4 }}>
              <div>
                {operation.operation} · 成功 {operation.succeeded}/{operation.attempted}
                {operation.failed > 0 ? ` · 失败 ${operation.failed}` : ''}
                {operation.rowsOmitted ? ` · 响应省略 ${operation.rowsOmitted}` : ''}
              </div>
              <div>
                最近检索：{formatEvidenceTimestamp(latestOutcome?.retrievedAt)}
                {failedOutcomes.length > 0
                  ? ` · 失败码：${failedOutcomes.map((outcome) => outcome.errorCode || 'UNKNOWN_ERROR').join('、')}`
                  : ''}
              </div>
            </div>
          );
        })}
        {viewModel.sourceOperations.length > visibleOperations.length ? (
          <div style={{ color: theme.textMuted, marginTop: 4 }}>
            另有 {viewModel.sourceOperations.length - visibleOperations.length} 条来源路径未列出。
          </div>
        ) : null}
      </div>

      <div style={wrapStyle}>
        <div style={{ color: theme.text, fontSize: '14px', fontWeight: 700, marginBottom: 6 }}>
          共同作品数排名
        </div>
        {(viewModel.collaborators.length > 0 || viewModel.hiddenCollaborators > 0) && (
          <div
            style={{
              ...wrapStyle,
              color: theme.textMuted,
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.design.badgeRadius,
              padding: theme.spacing.sm,
              fontSize: '11px',
              lineHeight: 1.5,
              marginBottom: theme.spacing.sm,
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              <span>显示 {visibleCollaborators.length}/{viewModel.collaborators.length} 位合作人物</span>
              <span>每人至多 {sharedSubjectDisplayLimit} 部共同作品</span>
            </div>
            {omittedReturnedCollaborators > 0
              ? `另有 ${omittedReturnedCollaborators} 位已返回合作人物未显示。`
              : ''}
            {viewModel.hiddenCollaborators > 0
              ? `视图模型边界另省略 ${viewModel.hiddenCollaborators} 位。`
              : ''}
          </div>
        )}
        {viewModel.collaborators.length === 0 && viewModel.hiddenCollaborators === 0 ? (
          <div
            style={{
              color: tone,
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              fontSize: '12px',
            }}
          >
            当前边界内没有可展示的合作人物；请结合来源状态、职位字段和覆盖数字阅读。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
            {visibleCollaborators.map((collaborator, index) => {
              const visibleSharedSubjects = collaborator.sharedSubjects.slice(
                0,
                sharedSubjectDisplayLimit,
              );
              const rendererOmittedSharedSubjects =
                collaborator.sharedSubjects.length - visibleSharedSubjects.length;
              return (
                <div
                  key={collaborator.id}
                  style={{
                    ...wrapStyle,
                    backgroundColor: theme.surfaceAlt,
                    border: `1px solid ${theme.border}`,
                    borderRadius: theme.radius.sm,
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  }}
                >
                  <div
                    style={{
                      ...wrapStyle,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <div
                      style={{
                        ...wrapStyle,
                        flex: '1 1 auto',
                      }}
                    >
                      <div style={{ color: theme.text, fontSize: '13px', fontWeight: 700, lineHeight: 1.35 }}>
                        <span style={{ color: theme.accent, marginRight: 5 }}>{index + 1}</span>
                        {collaborator.nameCn || collaborator.name}
                        {!separateAlternateNames &&
                        collaborator.nameCn &&
                        collaborator.nameCn !== collaborator.name ? (
                          <span
                            data-layout="collaboration-name-secondary-inline"
                            style={{ color: theme.textMuted, fontSize: '10px', fontWeight: 400, marginLeft: 6 }}
                          >
                            {collaborator.name}
                          </span>
                        ) : null}
                      </div>
                      {separateAlternateNames &&
                      collaborator.nameCn &&
                      collaborator.nameCn !== collaborator.name ? (
                        <div
                          data-layout="collaboration-name-secondary-row"
                          style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.35, marginTop: 2 }}
                        >
                          {collaborator.name}
                        </div>
                      ) : null}
                    </div>
                    <div
                      style={{
                        ...wrapStyle,
                        flex: '0 0 auto',
                        color: theme.accent,
                        backgroundColor: theme.surface,
                        borderRadius: theme.design.badgeRadius,
                        padding: '3px 7px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {collaborator.uniqueSubjects} 部
                    </div>
                  </div>
                  <div
                    style={{
                      ...wrapStyle,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '3px 6px',
                      marginTop: 4,
                      color: theme.textMuted,
                      fontSize: '10px',
                      lineHeight: 1.4,
                    }}
                  >
                    <span>Person ID {collaborator.id}</span>
                    <span>{collaborator.relationLabels.join('、') || '关系'}</span>
                    <span>{collaborator.creditRows} 行</span>
                    {collaborator.roleLabels.length > 0 ? (
                      <span>原始职位：{collaborator.roleLabels.join('、')}</span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      ...wrapStyle,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      marginTop: 6,
                    }}
                  >
                    {visibleSharedSubjects.map((subject) => (
                      <div
                        key={subject.id}
                        style={{
                          ...wrapStyle,
                          paddingTop: 5,
                          borderTop: `1px solid ${theme.border}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ ...wrapStyle, color: theme.text, fontSize: '11px', fontWeight: 600 }}>
                            {subject.nameCn || subject.name}
                            {!separateAlternateNames &&
                            subject.nameCn &&
                            subject.nameCn !== subject.name ? (
                              <span
                                data-layout="collaboration-name-secondary-inline"
                                style={{ color: theme.textMuted, fontSize: '9px', fontWeight: 400, marginLeft: 5 }}
                              >
                                {subject.name}
                              </span>
                            ) : null}
                          </span>
                          <span style={{ color: theme.textMuted, fontSize: '9px', whiteSpace: 'nowrap' }}>
                            Subject {subject.id}
                          </span>
                        </div>
                        {separateAlternateNames &&
                        subject.nameCn &&
                        subject.nameCn !== subject.name ? (
                          <div
                            data-layout="collaboration-name-secondary-row"
                            style={{ ...wrapStyle, color: theme.textMuted, fontSize: '9px', marginTop: 1 }}
                          >
                            {subject.name}
                          </div>
                        ) : null}
                        <div style={{ ...wrapStyle, color: theme.textMuted, fontSize: '9px', lineHeight: 1.35, marginTop: 3 }}>
                          {[
                            ...subject.relationLabels,
                            ...subject.targetRoles.map((role) => `目标：${role}`),
                            ...subject.collaboratorRoles.map((role) => `合作方：${role}`),
                          ].join(' · ')}
                        </div>
                      </div>
                    ))}
                    {rendererOmittedSharedSubjects > 0 && (
                      <div style={{ ...wrapStyle, color: theme.warning, fontSize: '11px' }}>
                        图片省略 {rendererOmittedSharedSubjects}{' '}
                        条已返回共同作品；剩余行仍计入上方覆盖数字。
                      </div>
                    )}
                    {collaborator.sharedSubjectsOmitted > 0 && (
                      <div style={{ ...wrapStyle, color: theme.warning, fontSize: '11px' }}>
                        另有 {collaborator.sharedSubjectsOmitted} 条共同作品在视图模型边界处未列出。
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {viewModel.hiddenCollaborators > 0 && (
              <div
                style={{
                  ...wrapStyle,
                  color: theme.warning,
                  fontSize: '11px',
                  textAlign: 'center',
                }}
              >
                另有 {viewModel.hiddenCollaborators} 位合作人物因视图模型显示边界未列出。
              </div>
            )}
          </div>
        )}
      </div>

      <div
        data-layout="collaboration-limits"
        style={{
          ...wrapStyle,
          backgroundColor: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          padding: compact ? theme.spacing.sm : theme.spacing.md,
          color: theme.textMuted,
          fontSize: compact ? '10px' : '11px',
          lineHeight: compact ? 1.4 : 1.5,
        }}
      >
        <div>
          并发 {viewModel.coverage.fanoutConcurrency} · 人物上限 {viewModel.coverage.maxCollaborators} ·
          {' '}每人作品上限 {viewModel.coverage.maxSharedSubjects}
        </div>
        <div>
          参与者异常 {viewModel.coverage.malformedParticipantRows} · 自身排除{' '}
          {viewModel.coverage.selfRowsExcluded}
        </div>
        <div>
          职位不匹配 {viewModel.coverage.collaboratorRoleExcludedRows} · 不可用{' '}
          {viewModel.coverage.collaboratorRoleUnavailableRows}
        </div>
        <div>
          作品证据省略 {viewModel.coverage.sharedSubjectRowsOmittedAtLimit} · 目标标签排除{' '}
          {viewModel.coverage.targetRoleExcludedRows}
        </div>
      </div>

      {viewModel.exclusions.length > 0 && (
        <div
          style={{
            ...wrapStyle,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
          }}
        >
          <div style={{ color: theme.text, fontSize: '14px', fontWeight: 700, marginBottom: 6 }}>
            未计入原因
          </div>
          {visibleExclusions.map((item) => (
            <div
              key={item.reason}
              style={{ ...wrapStyle, color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}
            >
              {item.reason}：{item.count} 条
              {item.sampleSubjectIds.length > 0
                ? `（示例 ID：${item.sampleSubjectIds.join('、')}）`
                : ''}
            </div>
          ))}
          {viewModel.exclusions.length > visibleExclusions.length ? (
            <div style={{ ...wrapStyle, color: theme.textMuted, fontSize: '10px', marginTop: 4 }}>
              另有 {viewModel.exclusions.length - visibleExclusions.length} 类未计入原因。
            </div>
          ) : null}
        </div>
      )}

      {visibleWarnings.length > 0 && (
        <div style={{ ...wrapStyle, color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {visibleWarnings.map((warning) => (
            <div key={warning.code}>⚠ {warning.message}</div>
          ))}
          {viewModel.warnings.length > visibleWarnings.length ? (
            <div>另有 {viewModel.warnings.length - visibleWarnings.length} 条警告未显示。</div>
          ) : null}
        </div>
      )}
      {visibleLimitations.length > 0 && (
        <div style={{ ...wrapStyle, color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          <div>限制：{visibleLimitations.join('；')}</div>
          {viewModel.limitations.length > visibleLimitations.length ? (
            <div>另有 {viewModel.limitations.length - visibleLimitations.length} 项限制未显示。</div>
          ) : null}
        </div>
      )}
      <Footer label={viewModel.source.label} theme={theme} />
    </CardFrame>
  );
};
