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
  depth: number;
  includedInWatchOrder: boolean;
  exclusionReason?:
    'media_type_not_anime' | 'relation_not_watch_step' | 'node_cap' | 'depth_evidence_only';
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
    relationLabels: string[];
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
  directRelationLabels: Set<string>;
  directRelationKinds: Set<SeriesRelationKind>;
  depths: Set<number>;
  direct: boolean;
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
const MAX_RELATED_EVIDENCE = 48;
const MAX_EDGE_EVIDENCE = 64;

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

const ORDERABLE_WATCH_KINDS = new Set<SeriesRelationKind>([
  'prequel',
  'sequel',
  'side_story',
  'recap',
]);

function normalizeRelation(relation: string): SeriesRelationKind {
  return EXACT_RELATION_KINDS[relation.trim()] || 'unknown';
}

function pickImage(images?: Record<string, string>): string | undefined {
  return images?.large || images?.common || images?.medium || images?.small || images?.grid;
}

function isExpandableRelation(item: SubjectRelationItem): boolean {
  return item.type === 'anime' && ORDERABLE_WATCH_KINDS.has(normalizeRelation(item.relation));
}

function makeCandidate(item: SubjectRelationItem, depth: number): RelationCandidate {
  const relation = item.relation.trim() || '关联条目';
  const kind = normalizeRelation(relation);
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    nameCn: item.nameCn,
    image: pickImage(item.images),
    relationLabels: new Set([relation]),
    relationKinds: new Set([kind]),
    directRelationLabels: depth === 0 ? new Set([relation]) : new Set(),
    directRelationKinds: depth === 0 ? new Set([kind]) : new Set(),
    depths: new Set([depth]),
    direct: depth === 0,
  };
}

function addRelationToCandidate(
  candidate: RelationCandidate,
  item: SubjectRelationItem,
  depth: number,
): void {
  const relation = item.relation.trim() || '关联条目';
  const kind = normalizeRelation(relation);
  candidate.relationLabels.add(relation);
  candidate.relationKinds.add(kind);
  candidate.depths.add(depth);
  if (depth === 0) {
    candidate.direct = true;
    candidate.directRelationLabels.add(relation);
    candidate.directRelationKinds.add(kind);
  }
  if (!candidate.name && item.name) candidate.name = item.name;
  if (!candidate.nameCn && item.nameCn) candidate.nameCn = item.nameCn;
  if (!candidate.image) candidate.image = pickImage(item.images);
}

function observeCandidate(
  candidates: Map<number, RelationCandidate>,
  item: SubjectRelationItem,
  depth: number,
  rootId: number,
): void {
  if (item.id === rootId) return;
  const existing = candidates.get(item.id);
  if (existing) {
    addRelationToCandidate(existing, item, depth);
  } else {
    candidates.set(item.id, makeCandidate(item, depth));
  }
}

function nodeFromCandidate(
  candidate: RelationCandidate,
  detail?: DomainSubject,
  directOnly = false,
): SeriesWatchOrderNode {
  const relationLabels =
    directOnly && candidate.direct ? candidate.directRelationLabels : candidate.relationLabels;
  const relationKinds =
    directOnly && candidate.direct ? candidate.directRelationKinds : candidate.relationKinds;
  return {
    id: candidate.id,
    type: detail?.type || candidate.type,
    name: detail?.name || candidate.name,
    nameCn: detail?.nameCn || candidate.nameCn || candidate.name,
    date: detail?.date,
    image: pickImage(detail?.images) || candidate.image,
    relationLabels: [...relationLabels].sort((left, right) => left.localeCompare(right)),
    relationKinds: [...relationKinds].sort(),
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
  if (node.relationKinds.includes('recap')) return 10;
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
  if (node.relationKinds.includes('recap')) return '关系标签标记为总集篇，置于核心条目后';
  if (node.relationKinds.includes('sequel')) return '关系标签标记为续集，置于起始条目后';
  if (node.relationKinds.includes('side_story')) return '关系标签标记为衍生/番外，置于核心条目后';
  return '关系标签未映射到稳定顺序，未纳入观看步骤';
}

function isWatchStep(node: SeriesWatchOrderNode): boolean {
  return (
    node.type === 'anime' &&
    node.relationKinds.length > 0 &&
    node.relationKinds.every((kind) => ORDERABLE_WATCH_KINDS.has(kind))
  );
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
    const evidenceSources: SeriesWatchOrderResult['evidence']['sources'] = [];

    const rootDetailPath = `/v0/subjects/${subjectId}`;
    evidenceSources.push({ operation: 'getSubjectById', path: rootDetailPath });
    const rootSubject = await this.subjectService.getSubjectById(subjectId);
    const root = rootNodeFromSubject(rootSubject);

    let relationRequests = 0;
    let relationFailures = 0;
    const getRelations = async (id: number, required: boolean): Promise<SubjectRelationItem[]> => {
      const path = `/v0/subjects/${id}/subjects`;
      evidenceSources.push({ operation: 'getRelatedSubjectsBySubjectId', path });
      relationRequests += 1;
      try {
        return await this.subjectService.getSubjectRelations(id);
      } catch (error) {
        if (required) throw error;
        relationFailures += 1;
        warnings.push(`关联条目 ${id} 的关系读取失败，未继续展开：${errorText(error)}`);
        return [];
      }
    };

    const rootRelations = await getRelations(subjectId, true);
    const traversedRelations: TraversedRelation[] = rootRelations.map((relation) => ({
      fromId: subjectId,
      depth: 0,
      relation,
    }));
    const candidates = new Map<number, RelationCandidate>();
    rootRelations.forEach((relation) => observeCandidate(candidates, relation, 0, subjectId));

    const visitedForTraversal = new Set<number>([subjectId]);
    const scheduledForTraversal = new Set<number>();
    const nextTraversal = new Map<number, ChildTraversalCandidate>();
    let traversedAnimeNodes = 0;
    let traversalCapTruncated = false;
    let depthTruncated = false;

    const scheduleTraversal = (relation: SubjectRelationItem, nextDepth: number): void => {
      if (
        !isExpandableRelation(relation) ||
        relation.id === subjectId ||
        visitedForTraversal.has(relation.id) ||
        scheduledForTraversal.has(relation.id)
      ) {
        return;
      }
      scheduledForTraversal.add(relation.id);
      if (traversedAnimeNodes + nextTraversal.size >= maxNodes) {
        traversalCapTruncated = true;
        return;
      }
      nextTraversal.set(relation.id, { id: relation.id, depth: nextDepth });
    };

    if (depth === 0) {
      depthTruncated = rootRelations.some(
        (relation) => isExpandableRelation(relation) && relation.id !== subjectId,
      );
    } else {
      [...rootRelations]
        .sort((left, right) => left.id - right.id)
        .forEach((relation) => scheduleTraversal(relation, 1));

      while (nextTraversal.size > 0) {
        const traversal = nextTraversal.values().next().value as
          ChildTraversalCandidate | undefined;
        if (!traversal) break;
        nextTraversal.delete(traversal.id);
        if (visitedForTraversal.has(traversal.id)) continue;
        visitedForTraversal.add(traversal.id);
        traversedAnimeNodes += 1;

        const childRelations = await getRelations(traversal.id, false);
        childRelations.forEach((relation) =>
          observeCandidate(candidates, relation, traversal.depth, subjectId),
        );
        traversedRelations.push(
          ...childRelations.map((relation) => ({
            fromId: traversal.id,
            depth: traversal.depth,
            relation,
          })),
        );

        if (traversal.depth < depth) {
          [...childRelations]
            .sort((left, right) => left.id - right.id)
            .forEach((relation) => scheduleTraversal(relation, traversal.depth + 1));
        } else if (
          childRelations.some(
            (relation) =>
              isExpandableRelation(relation) &&
              relation.id !== subjectId &&
              !visitedForTraversal.has(relation.id) &&
              !scheduledForTraversal.has(relation.id),
          )
        ) {
          depthTruncated = true;
        }
      }
    }

    const candidateIds = [...candidates.keys()].sort((left, right) => left - right);
    const directAnimeCandidateIds = candidateIds.filter((id) => {
      const candidate = candidates.get(id);
      return candidate?.direct && candidate.type === 'anime';
    });
    const returnedAnimeIds = new Set(directAnimeCandidateIds.slice(0, maxNodes));
    const animeCapTruncated = directAnimeCandidateIds.length > returnedAnimeIds.size;

    const details = new Map<number, DomainSubject>();
    let detailsFetched = 0;
    let detailsFailed = 0;
    const detailFailureIds: number[] = [];

    for (const candidateId of [...returnedAnimeIds].sort((left, right) => left - right)) {
      const path = `/v0/subjects/${candidateId}`;
      evidenceSources.push({ operation: 'getSubjectById', path });
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

    const relatedEvidenceLimit = Math.min(MAX_RELATED_EVIDENCE, Math.max(8, maxNodes * 3));
    const returnedRelatedIds = new Set<number>();
    const addRelatedEvidence = (predicate: (candidate: RelationCandidate) => boolean): void => {
      for (const candidateId of candidateIds) {
        const candidate = candidates.get(candidateId);
        if (!candidate || !predicate(candidate) || returnedRelatedIds.has(candidateId)) continue;
        if (returnedRelatedIds.size >= relatedEvidenceLimit) return;
        returnedRelatedIds.add(candidateId);
      }
    };
    addRelatedEvidence((candidate) => candidate.direct && returnedAnimeIds.has(candidate.id));
    addRelatedEvidence((candidate) => candidate.direct && candidate.type !== 'anime');
    addRelatedEvidence((candidate) => !candidate.direct && candidate.type === 'anime');
    addRelatedEvidence((candidate) => !candidate.direct && candidate.type !== 'anime');
    const relatedEvidenceTruncated = returnedRelatedIds.size < candidateIds.length;

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
        relationLabels: node.relationLabels,
        reason,
      });
    };

    for (const candidateId of candidateIds) {
      const candidate = candidates.get(candidateId);
      if (!candidate) continue;
      const detail = details.get(candidateId);
      const relatedNode = nodeFromCandidate(candidate, detail);
      const directNode = candidate.direct ? nodeFromCandidate(candidate, detail, true) : undefined;
      let exclusionReason: SeriesWatchOrderRelated['exclusionReason'];
      if (relatedNode.type !== 'anime') {
        exclusionReason = 'media_type_not_anime';
      } else if (!candidate.direct) {
        exclusionReason = 'depth_evidence_only';
      } else if (!returnedAnimeIds.has(candidateId)) {
        exclusionReason = 'node_cap';
      } else if (!directNode || !isWatchStep(directNode)) {
        exclusionReason = 'relation_not_watch_step';
      }

      const relatedItem: SeriesWatchOrderRelated = {
        ...relatedNode,
        depth: Math.min(...candidate.depths),
        includedInWatchOrder: !exclusionReason,
        exclusionReason,
      };
      if (returnedRelatedIds.has(candidateId)) related.push(relatedItem);
      if (exclusionReason) {
        addCount(exclusionCounts, exclusionReason);
        excludedSample(relatedNode, exclusionReason);
      } else if (directNode) {
        watchOrderCandidates.push({ node: directNode, isRoot: false });
      }
    }

    if (root.type === 'anime') {
      watchOrderCandidates.push({ node: root, isRoot: true });
    }
    watchOrderCandidates.sort(compareNodes);
    const watchOrder = watchOrderCandidates.map((entry, index) => ({
      ...entry.node,
      position: index + 1,
      isRoot: entry.isRoot,
      placementReason: placementReason(entry.node, entry.isRoot),
    }));

    const edges: SeriesWatchOrderEdge[] = traversedRelations
      .slice(0, MAX_EDGE_EVIDENCE)
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
        if (left.depth !== right.depth) return left.depth - right.depth;
        return left.relation.localeCompare(right.relation);
      });

    const truncationReasons: string[] = [];
    if (animeCapTruncated || traversalCapTruncated) truncationReasons.push(`maxNodes=${maxNodes}`);
    if (depthTruncated) truncationReasons.push(`depth=${depth}`);
    if (relatedEvidenceTruncated)
      truncationReasons.push(`related-evidence=${relatedEvidenceLimit}`);
    if (detailsFailed > 0) truncationReasons.push('subject-detail-failure');
    if (relationFailures > 0) truncationReasons.push('relation-read-failure');

    if (detailsFailed > 0) {
      warnings.push(`共有 ${detailsFailed} 个条目的详情不可用；名称和关系仍来自关系接口。`);
    }
    if (animeCapTruncated || traversalCapTruncated) {
      warnings.push(`动画关联节点超过上限 ${maxNodes}，结果只保留确定性选择的一部分。`);
    }
    if (depthTruncated) {
      warnings.push(`关系遍历达到深度上限 ${depth}，未继续展开所有可达的观看关系。`);
    }
    if (relatedEvidenceTruncated) {
      warnings.push(`关联证据超过展示上限 ${relatedEvidenceLimit}，覆盖统计仍保留观察总数。`);
    }
    if (candidateIds.some((id) => candidates.get(id)?.relationKinds.has('unknown'))) {
      warnings.push('存在未映射的原始关系标签；这些标签不会创建观看步骤或继续扩展关系。');
    }
    if (
      candidateIds.some((id) => {
        const candidate = candidates.get(id);
        return Boolean(candidate && candidate.directRelationKinds.size > 1);
      })
    ) {
      warnings.push('部分条目从起点观察到多个关系标签；系统保留原始标签并使用确定性提示。');
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
        sources: evidenceSources,
        derivation: 'series-watch-order-v1',
        retrievedAt,
      },
      warnings,
      limitations,
    };
  }
}
