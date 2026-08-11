import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { DomainSubject, SubjectRelationItem, SubjectType } from '../models/subject.js';
import { SubjectService } from './subject-service.js';

export type SeriesWatchOrderState = 'complete' | 'partial';

export type SeriesWatchOrderCapabilityState = 'bounded_recommendation' | 'not_computable';

export type SeriesRelationKind =
  | 'prequel'
  | 'sequel'
  | 'side_story'
  | 'recap'
  | 'source'
  | 'adaptation'
  | 'book'
  | 'music'
  | 'game'
  | 'real'
  | 'other'
  | 'unknown';

export interface SeriesWatchOrderOptions {
  depth?: number;
  maxNodes?: number;
  media?: 'anime' | 'all';
}

export interface SeriesWatchOrderNode {
  id: number;
  type: SubjectType;
  name: string;
  nameCn: string;
  date?: string;
  image?: string;
  relationLabels: string[];
  relationKinds: SeriesRelationKind[];
}

export interface SeriesWatchOrderItem extends SeriesWatchOrderNode {
  position: number;
  isRoot: boolean;
  placementReason: string;
}

export interface SeriesWatchOrderEdge {
  fromId: number;
  toId: number;
  depth: number;
  relation: string;
  relationKind: SeriesRelationKind;
}

export interface SeriesWatchOrderRelated extends SeriesWatchOrderNode {
  includedInWatchOrder: boolean;
  exclusionReason?: 'media_type_not_anime' | 'relation_not_watch_step' | 'node_cap';
}

export interface SeriesWatchOrderExclusionSummary {
  count: number;
  byReason: Array<{
    reason: NonNullable<SeriesWatchOrderRelated['exclusionReason']>;
    count: number;
  }>;
  samples: Array<{
    id: number;
    type: SubjectType;
    name: string;
    nameCn: string;
    reason: NonNullable<SeriesWatchOrderRelated['exclusionReason']>;
  }>;
}

export interface SeriesWatchOrderResult {
  state: SeriesWatchOrderState;
  subjectId: number;
  root: SeriesWatchOrderNode;
  watchOrder: SeriesWatchOrderItem[];
  related: SeriesWatchOrderRelated[];
  edges: SeriesWatchOrderEdge[];
  excluded: SeriesWatchOrderExclusionSummary;
  coverage: {
    depth: number;
    maxNodes: number;
    media: 'anime' | 'all';
    relationRequests: number;
    relationRowsObserved: number;
    uniqueRelatedObserved: number;
    uniqueRelatedReturned: number;
    detailsFetched: number;
    detailsFailed: number;
    relationFailures: number;
    truncated: boolean;
    truncationReasons: string[];
    retrievedAt: string;
  };
  capabilityStates: {
    watchOrder: SeriesWatchOrderCapabilityState;
  };
  evidence: {
    sources: Array<{
      operation: string;
      path: string;
    }>;
    derivation: 'series-watch-order-v1';
    retrievedAt: string;
  };
  warnings: string[];
  limitations: string[];
}

interface RelationCandidate {
  id: number;
  type: SubjectType;
  name: string;
  nameCn: string;
  image?: string;
  relationLabels: Set<string>;
  relationKinds: Set<SeriesRelationKind>;
}

interface TraversedRelation {
  fromId: number;
  depth: number;
  relation: SubjectRelationItem;
}

interface ChildTraversalCandidate {
  id: number;
  depth: number;
}

const DEFAULT_DEPTH = 1;
const DEFAULT_MAX_NODES = 8;
const MAX_DEPTH = 2;
const MAX_NODES = 16;

const EXACT_RELATION_KINDS: Record<string, SeriesRelationKind> = {
  前传: 'prequel',
  前篇: 'prequel',
  续集: 'sequel',
  续篇: 'sequel',
  衍生: 'side_story',
  外传: 'side_story',
  番外: 'side_story',
  总集篇: 'recap',
  总集: 'recap',
  原作: 'source',
  改编: 'adaptation',
  书籍: 'book',
  小说: 'book',
  漫画: 'book',
  音乐: 'music',
  原声: 'music',
  原声集: 'music',
  片头曲: 'music',
  片尾曲: 'music',
  游戏: 'game',
  真人: 'real',
  其他: 'other',
};

const NON_WATCH_KINDS = new Set<SeriesRelationKind>([
  'source',
  'adaptation',
  'book',
  'music',
  'game',
  'real',
  'other',
]);

function normalizeRelation(relation: string): SeriesRelationKind {
  return EXACT_RELATION_KINDS[relation.trim()] || 'unknown';
}

function pickImage(images?: Record<string, string>): string | undefined {
  return images?.large || images?.common || images?.medium || images?.small || images?.grid;
}

function makeCandidate(item: SubjectRelationItem): RelationCandidate {
  const relation = item.relation.trim() || '关联条目';
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    nameCn: item.nameCn,
    image: pickImage(item.images),
    relationLabels: new Set([relation]),
    relationKinds: new Set([normalizeRelation(relation)]),
  };
}

function addRelationToCandidate(candidate: RelationCandidate, item: SubjectRelationItem): void {
  const relation = item.relation.trim() || '关联条目';
  candidate.relationLabels.add(relation);
  candidate.relationKinds.add(normalizeRelation(relation));
  if (!candidate.name && item.name) candidate.name = item.name;
  if (!candidate.nameCn && item.nameCn) candidate.nameCn = item.nameCn;
  if (!candidate.image) candidate.image = pickImage(item.images);
}

function nodeFromCandidate(
  candidate: RelationCandidate,
  detail?: DomainSubject,
): SeriesWatchOrderNode {
  return {
    id: candidate.id,
    type: detail?.type || candidate.type,
    name: detail?.name || candidate.name,
    nameCn: detail?.nameCn || candidate.nameCn || candidate.name,
    date: detail?.date,
    image: pickImage(detail?.images) || candidate.image,
    relationLabels: [...candidate.relationLabels].sort((left, right) => left.localeCompare(right)),
    relationKinds: [...candidate.relationKinds].sort(),
  };
}

function rootNodeFromSubject(subject: DomainSubject): SeriesWatchOrderNode {
  return {
    id: subject.id,
    type: subject.type,
    name: subject.name,
    nameCn: subject.nameCn || subject.name,
    date: subject.date,
    image: pickImage(subject.images),
    relationLabels: [],
    relationKinds: [],
  };
}

function relationPriority(node: SeriesWatchOrderNode, isRoot: boolean): number {
  if (isRoot) return 0;
  if (node.relationKinds.includes('prequel')) return -30;
  if (node.relationKinds.includes('recap')) return -10;
  if (node.relationKinds.includes('sequel')) return 30;
  if (node.relationKinds.includes('side_story')) return 50;
  return 70;
}

function compareNodes(
  left: { node: SeriesWatchOrderNode; isRoot: boolean },
  right: { node: SeriesWatchOrderNode; isRoot: boolean },
): number {
  const priorityDifference =
    relationPriority(left.node, left.isRoot) - relationPriority(right.node, right.isRoot);
  if (priorityDifference !== 0) return priorityDifference;

  if (left.node.date && right.node.date && left.node.date !== right.node.date) {
    return left.node.date.localeCompare(right.node.date);
  }
  if (left.node.date && !right.node.date) return -1;
  if (!left.node.date && right.node.date) return 1;
  return left.node.id - right.node.id;
}

function placementReason(node: SeriesWatchOrderNode, isRoot: boolean): string {
  if (isRoot) return '请求的起始条目';
  if (node.relationKinds.includes('prequel')) return '关系标签标记为前传，置于起始条目前';
  if (node.relationKinds.includes('recap')) return '关系标签标记为总集篇，置于核心条目前';
  if (node.relationKinds.includes('sequel')) return '关系标签标记为续集，置于起始条目后';
  if (node.relationKinds.includes('side_story')) return '关系标签标记为衍生/番外，置于核心条目后';
  return '关系标签未映射到稳定顺序，使用日期与条目 ID 作为并列时的确定性排序';
}

function isWatchStep(node: SeriesWatchOrderNode): boolean {
  if (node.type !== 'anime') return false;
  return node.relationKinds.every((kind) => !NON_WATCH_KINDS.has(kind));
}

function addCount(
  counts: Map<NonNullable<SeriesWatchOrderRelated['exclusionReason']>, number>,
  reason: NonNullable<SeriesWatchOrderRelated['exclusionReason']>,
): void {
  counts.set(reason, (counts.get(reason) || 0) + 1);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class SeriesService {
  private readonly subjectService: SubjectService;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    this.subjectService = new SubjectService(client);
  }

  async getSeriesWatchOrder(
    subjectId: number,
    options: SeriesWatchOrderOptions = {},
  ): Promise<SeriesWatchOrderResult> {
    const depth = Math.max(0, Math.min(MAX_DEPTH, Math.trunc(options.depth ?? DEFAULT_DEPTH)));
    const maxNodes = Math.max(
      1,
      Math.min(MAX_NODES, Math.trunc(options.maxNodes ?? DEFAULT_MAX_NODES)),
    );
    const media = options.media ?? 'anime';
    const retrievedAt = new Date().toISOString();
    const warnings: string[] = [];
    const limitations = [
      'Bangumi 的关系接口没有发布统一的官方观看顺序；本结果是有限深度、有限节点的确定性推荐。',
      '关系标签和日期缺失时，系统不会把推断结果表述为唯一正确顺序。',
    ];

    const rootSubject = await this.subjectService.getSubjectById(subjectId);
    const root = rootNodeFromSubject(rootSubject);
    const rootRelations = await this.subjectService.getSubjectRelations(subjectId);
    const traversedRelations: TraversedRelation[] = rootRelations.map((relation) => ({
      fromId: subjectId,
      depth: 0,
      relation,
    }));
    const candidates = new Map<number, RelationCandidate>();
    const addCandidate = (relation: SubjectRelationItem): void => {
      if (relation.id === subjectId) return;
      const existing = candidates.get(relation.id);
      if (existing) {
        addRelationToCandidate(existing, relation);
      } else {
        candidates.set(relation.id, makeCandidate(relation));
      }
    };
    rootRelations.forEach(addCandidate);

    const visitedForTraversal = new Set<number>([subjectId]);
    const nextTraversal = new Map<number, ChildTraversalCandidate>();
    rootRelations
      .filter((relation) => relation.type === 'anime')
      .sort((left, right) => left.id - right.id)
      .forEach((relation) => {
        if (!nextTraversal.has(relation.id)) {
          nextTraversal.set(relation.id, { id: relation.id, depth: 1 });
        }
      });

    let relationRequests = 1;
    let relationFailures = 0;
    let depthTruncated = false;

    if (depth > 0) {
      while (nextTraversal.size > 0) {
        const traversal = nextTraversal.values().next().value as
          ChildTraversalCandidate | undefined;
        if (!traversal) break;
        nextTraversal.delete(traversal.id);
        if (visitedForTraversal.has(traversal.id)) continue;
        if (visitedForTraversal.size - 1 >= maxNodes) {
          depthTruncated = true;
          break;
        }
        visitedForTraversal.add(traversal.id);
        try {
          const childRelations = await this.subjectService.getSubjectRelations(traversal.id);
          relationRequests += 1;
          childRelations.forEach(addCandidate);
          traversedRelations.push(
            ...childRelations.map((relation) => ({
              fromId: traversal.id,
              depth: traversal.depth,
              relation,
            })),
          );

          if (traversal.depth < depth) {
            childRelations
              .filter((relation) => relation.type === 'anime')
              .sort((left, right) => left.id - right.id)
              .forEach((relation) => {
                if (!visitedForTraversal.has(relation.id) && !nextTraversal.has(relation.id)) {
                  nextTraversal.set(relation.id, {
                    id: relation.id,
                    depth: traversal.depth + 1,
                  });
                }
              });
          } else if (childRelations.some((relation) => relation.type === 'anime')) {
            depthTruncated = true;
          }
        } catch (error) {
          relationRequests += 1;
          relationFailures += 1;
          warnings.push(`关联条目 ${traversal.id} 的关系读取失败，未继续展开：${errorText(error)}`);
        }
      }
    }

    if (depth > 0 && nextTraversal.size > 0) depthTruncated = true;

    const candidateIds = [...candidates.keys()].sort((left, right) => left - right);
    const eligibleCandidateIds = candidateIds.filter((id) => {
      const candidate = candidates.get(id);
      return candidate && (media === 'all' || candidate.type === 'anime');
    });
    const returnedCandidateIds = new Set(eligibleCandidateIds.slice(0, maxNodes));
    const capTruncated = eligibleCandidateIds.length > returnedCandidateIds.size;
    const details = new Map<number, DomainSubject>();
    let detailsFetched = 0;
    let detailsFailed = 0;
    const detailFailureIds: number[] = [];

    for (const candidateId of returnedCandidateIds) {
      try {
        const detail = await this.subjectService.getSubjectById(candidateId);
        details.set(candidateId, detail);
        detailsFetched += 1;
      } catch (error) {
        detailsFailed += 1;
        detailFailureIds.push(candidateId);
        warnings.push(
          `条目 ${candidateId} 的详情读取失败，保留关系接口中的名称：${errorText(error)}`,
        );
      }
    }

    const relatedNodes = new Map<number, SeriesWatchOrderNode>();
    for (const candidateId of returnedCandidateIds) {
      const candidate = candidates.get(candidateId);
      if (!candidate) continue;
      relatedNodes.set(candidateId, nodeFromCandidate(candidate, details.get(candidateId)));
    }

    const edges: SeriesWatchOrderEdge[] = traversedRelations
      .filter((entry) => returnedCandidateIds.has(entry.relation.id))
      .map((entry) => ({
        fromId: entry.fromId,
        toId: entry.relation.id,
        depth: entry.depth,
        relation: entry.relation.relation.trim() || '关联条目',
        relationKind: normalizeRelation(entry.relation.relation),
      }))
      .sort((left, right) => {
        if (left.fromId !== right.fromId) return left.fromId - right.fromId;
        if (left.toId !== right.toId) return left.toId - right.toId;
        return left.relation.localeCompare(right.relation);
      });

    const exclusionCounts = new Map<
      NonNullable<SeriesWatchOrderRelated['exclusionReason']>,
      number
    >();
    const exclusionSamples: SeriesWatchOrderExclusionSummary['samples'] = [];
    const related: SeriesWatchOrderRelated[] = [];
    const watchOrderCandidates: Array<{ node: SeriesWatchOrderNode; isRoot: boolean }> = [];

    const excludedSample = (
      node: SeriesWatchOrderNode,
      reason: NonNullable<SeriesWatchOrderRelated['exclusionReason']>,
    ): void => {
      if (exclusionSamples.length >= 8) return;
      exclusionSamples.push({
        id: node.id,
        type: node.type,
        name: node.name,
        nameCn: node.nameCn,
        reason,
      });
    };

    for (const candidateId of candidateIds) {
      const candidate = candidates.get(candidateId);
      if (!candidate) continue;
      const node = relatedNodes.get(candidateId) || nodeFromCandidate(candidate);
      let exclusionReason: SeriesWatchOrderRelated['exclusionReason'];
      if (media === 'anime' && node.type !== 'anime') {
        exclusionReason = 'media_type_not_anime';
      } else if (!returnedCandidateIds.has(candidateId)) {
        exclusionReason = 'node_cap';
      } else if (!isWatchStep(node)) {
        exclusionReason =
          node.type === 'anime' ? 'relation_not_watch_step' : 'media_type_not_anime';
      }

      const relatedItem: SeriesWatchOrderRelated = {
        ...node,
        includedInWatchOrder: !exclusionReason,
        exclusionReason,
      };
      if (returnedCandidateIds.has(candidateId)) related.push(relatedItem);
      if (exclusionReason) {
        addCount(exclusionCounts, exclusionReason);
        excludedSample(node, exclusionReason);
      } else {
        watchOrderCandidates.push({ node, isRoot: false });
      }
    }

    const rootIsWatchStep = root.type === 'anime';
    if (rootIsWatchStep) {
      watchOrderCandidates.push({ node: root, isRoot: true });
    }
    watchOrderCandidates.sort(compareNodes);
    const watchOrder = watchOrderCandidates.map((entry, index) => ({
      ...entry.node,
      position: index + 1,
      isRoot: entry.isRoot,
      placementReason: placementReason(entry.node, entry.isRoot),
    }));

    const truncationReasons: string[] = [];
    if (capTruncated) truncationReasons.push(`maxNodes=${maxNodes}`);
    if (depthTruncated) truncationReasons.push(`depth=${depth}`);
    if (detailsFailed > 0) truncationReasons.push('subject-detail-failure');
    if (relationFailures > 0) truncationReasons.push('relation-read-failure');

    if (detailsFailed > 0) {
      warnings.push(`共有 ${detailsFailed} 个条目的详情不可用；名称和关系仍来自关系接口。`);
    }
    if (capTruncated) {
      warnings.push(`关联节点超过上限 ${maxNodes}，结果只保留确定性选择的一部分。`);
    }
    if (depthTruncated) {
      warnings.push(`关系遍历达到深度上限 ${depth} 或节点预算，未继续展开。`);
    }
    if (candidateIds.some((id) => candidates.get(id)?.relationKinds.has('unknown'))) {
      warnings.push('存在未映射的原始关系标签；这些条目的排序只使用透明的并列规则。');
    }
    if (watchOrderCandidates.some((entry) => !entry.node.date)) {
      warnings.push('部分观看步骤没有可用日期；同一关系类别内使用条目 ID 作为确定性并列规则。');
    }

    const capabilityStates: SeriesWatchOrderResult['capabilityStates'] = {
      watchOrder: watchOrder.length > 0 ? 'bounded_recommendation' : 'not_computable',
    };
    if (capabilityStates.watchOrder === 'not_computable') {
      warnings.push(
        '没有足够的动画关系数据计算观看步骤；请查看 related 和 excluded 中的原始覆盖。',
      );
    }
    if (detailFailureIds.length > 0) {
      warnings.push(`详情失败的条目 ID：${detailFailureIds.join(', ')}。`);
    }

    const state: SeriesWatchOrderState = truncationReasons.length > 0 ? 'partial' : 'complete';
    const excludedByReason = [...exclusionCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => left.reason.localeCompare(right.reason));

    return {
      state,
      subjectId,
      root,
      watchOrder,
      related,
      edges,
      excluded: {
        count: excludedByReason.reduce((total, item) => total + item.count, 0),
        byReason: excludedByReason,
        samples: exclusionSamples,
      },
      coverage: {
        depth,
        maxNodes,
        media,
        relationRequests,
        relationRowsObserved: traversedRelations.length,
        uniqueRelatedObserved: candidateIds.length,
        uniqueRelatedReturned: related.length,
        detailsFetched,
        detailsFailed,
        relationFailures,
        truncated: truncationReasons.length > 0,
        truncationReasons,
        retrievedAt,
      },
      capabilityStates,
      evidence: {
        sources: [
          {
            operation: 'getSubjectById',
            path: `/v0/subjects/${subjectId}`,
          },
          {
            operation: 'getRelatedSubjectsBySubjectId',
            path: `/v0/subjects/${subjectId}/subjects`,
          },
        ],
        derivation: 'series-watch-order-v1',
        retrievedAt,
      },
      warnings,
      limitations,
    };
  }
}
