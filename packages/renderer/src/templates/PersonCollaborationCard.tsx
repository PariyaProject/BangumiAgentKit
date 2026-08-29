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
  const tone = stateColor(viewModel.state, theme);
  const visibleWarnings = viewModel.warnings.slice(0, 5);
  const visibleLimitations = viewModel.limitations.slice(0, 4);
  const visibleOperations = viewModel.sourceOperations.slice(0, 8);
  const formulaEvidence = viewModel.evidence.find((item) => item.source === 'derived-s7');
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
        状态：{stateLabel(viewModel.state)} · 媒介：{mediaLabel(viewModel.media)}
        {viewModel.targetRole ? ` · 目标标签：${viewModel.targetRole}` : ''}
        {viewModel.collaboratorRole ? ` · 合作方职位：${viewModel.collaboratorRole}` : ''}
      </div>

      <div style={{ ...wrapStyle, display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {stats.map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              ...wrapStyle,
              flex: '1 1 130px',
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm,
              textAlign: 'center',
            }}
          >
            <div style={{ ...wrapStyle, color: theme.accent, fontSize: '22px', fontWeight: 700 }}>
              {value}
            </div>
            <div style={{ ...wrapStyle, color: theme.textMuted, fontSize: '11px' }}>{label}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          ...wrapStyle,
          backgroundColor: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          color: theme.textMuted,
          fontSize: '12px',
          lineHeight: 1.55,
        }}
      >
        目标关系观察 {viewModel.coverage.relationRowsObserved} · 满足筛选{' '}
        {viewModel.coverage.relationRowsMatchingFilters} · 选取{' '}
        {viewModel.coverage.relationRowsSelected}
        {viewModel.coverage.relationRowsDroppedAtLimit > 0
          ? ` · 关系省略 ${viewModel.coverage.relationRowsDroppedAtLimit}`
          : ''}{' '}
        · 作品观察 {viewModel.coverage.subjectIdsObserved} / fan-out{' '}
        {viewModel.coverage.subjectIdsSelected} · 请求成功{' '}
        {viewModel.coverage.participantRequestsSucceeded} / 失败{' '}
        {viewModel.coverage.participantRequestsFailed} · 参与者观察{' '}
        {viewModel.coverage.participantRowsObserved} / 采用{' '}
        {viewModel.coverage.participantRowsReturned}
        {viewModel.coverage.truncated ? ' · 已达到至少一项安全边界' : ''}
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
                最近检索：{latestOutcome?.retrievedAt || '未知'}
                {failedOutcomes.length > 0
                  ? ` · 失败码：${failedOutcomes.map((outcome) => outcome.errorCode || 'UNKNOWN_ERROR').join('、')}`
                  : ''}
              </div>
            </div>
          );
        })}
      </div>

      <div style={wrapStyle}>
        <div style={{ color: theme.text, fontSize: '14px', fontWeight: 700, marginBottom: 6 }}>
          共同作品数排名
        </div>
        {viewModel.collaborators.length === 0 ? (
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
            {viewModel.collaborators.map((collaborator, index) => (
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
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                  }}
                >
                  <div
                    style={{
                      ...wrapStyle,
                      flex: '1 1 auto',
                      color: theme.text,
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    {index + 1}. {collaborator.nameCn || collaborator.name}
                    {collaborator.nameCn && collaborator.nameCn !== collaborator.name
                      ? `（${collaborator.name}）`
                      : ''}
                  </div>
                  <div
                    style={{
                      ...wrapStyle,
                      flex: '0 1 auto',
                      color: theme.accent,
                      fontSize: '12px',
                      fontWeight: 700,
                      textAlign: 'right',
                    }}
                  >
                    {collaborator.uniqueSubjects} 部
                  </div>
                </div>
                <div
                  style={{
                    ...wrapStyle,
                    color: theme.textMuted,
                    fontSize: '11px',
                    lineHeight: 1.45,
                  }}
                >
                  Person ID {collaborator.id} · {collaborator.relationLabels.join('、') || '关系'} ·{' '}
                  {collaborator.creditRows} 行
                  {collaborator.roleLabels.length > 0
                    ? ` · 合作方原始标签：${collaborator.roleLabels.join('、')}`
                    : ''}
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
                  {collaborator.sharedSubjects.map((subject) => (
                    <div
                      key={subject.id}
                      style={{ ...wrapStyle, color: theme.textMuted, fontSize: '11px' }}
                    >
                      <span style={{ color: theme.text }}>
                        {subject.nameCn || subject.name}
                        {subject.nameCn && subject.nameCn !== subject.name
                          ? `（${subject.name}）`
                          : ''}
                      </span>{' '}
                      · Subject {subject.id} · {subject.relationLabels.join('、')}
                      {subject.targetRoles.length > 0
                        ? ` · 目标原始标签：${subject.targetRoles.join('、')}`
                        : ''}
                      {subject.collaboratorRoles.length > 0
                        ? ` · 合作方原始标签：${subject.collaboratorRoles.join('、')}`
                        : ''}
                    </div>
                  ))}
                  {collaborator.sharedSubjectsOmitted > 0 && (
                    <div style={{ ...wrapStyle, color: theme.warning, fontSize: '11px' }}>
                      另有 {collaborator.sharedSubjectsOmitted} 部共同作品因证据显示上限未列出。
                    </div>
                  )}
                </div>
              </div>
            ))}
            {viewModel.hiddenCollaborators > 0 && (
              <div
                style={{
                  ...wrapStyle,
                  color: theme.warning,
                  fontSize: '11px',
                  textAlign: 'center',
                }}
              >
                另有 {viewModel.hiddenCollaborators} 位合作人物因渲染显示上限未列出。
              </div>
            )}
          </div>
        )}
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
        fan-out 并发 {viewModel.coverage.fanoutConcurrency} · 人物输出上限{' '}
        {viewModel.coverage.maxCollaborators} · 每人共同作品上限{' '}
        {viewModel.coverage.maxSharedSubjects} · 参与者异常{' '}
        {viewModel.coverage.malformedParticipantRows} · 自身排除{' '}
        {viewModel.coverage.selfRowsExcluded} · 职位不匹配{' '}
        {viewModel.coverage.collaboratorRoleExcludedRows} · 职位不可用{' '}
        {viewModel.coverage.collaboratorRoleUnavailableRows} · 共同作品证据省略{' '}
        {viewModel.coverage.sharedSubjectRowsOmittedAtLimit} · 目标标签排除{' '}
        {viewModel.coverage.targetRoleExcludedRows}
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
          {viewModel.exclusions.slice(0, 10).map((item) => (
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
        </div>
      )}

      {visibleWarnings.length > 0 && (
        <div style={{ ...wrapStyle, color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {visibleWarnings.map((warning) => (
            <div key={warning.code}>⚠ {warning.message}</div>
          ))}
        </div>
      )}
      {visibleLimitations.length > 0 && (
        <div style={{ ...wrapStyle, color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          限制：{visibleLimitations.join('；')}
        </div>
      )}
      <Footer label={viewModel.source.label} theme={theme} />
    </CardFrame>
  );
};
