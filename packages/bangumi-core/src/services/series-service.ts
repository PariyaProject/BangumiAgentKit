import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { DomainSubject, SubjectRelationItem, SubjectType } from '../models/subject.js';
import { SubjectService } from './subject-service.js';

export type SeriesWatchOrderState = 'complete' | 'partial' | 'not_computable';

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

export type SeriesRelationPlacement = 'before_root' | 'after_root';

export type SeriesWatchOrderExclusionReason =
  | 'media_type_not_anime'
  | 'root_not_anime'
  | 'relation_not_watch_step'
  | 'conflicting_direct_relations'
  | 'conflicting_paths'
  | 'node_cap'
  | 'depth_evidence_only'
  | 'evidence_cap';

export interface SeriesWatchOrderOptions {
  depth?: number;
  maxNodes?: number;
  media?: 'anime' | 'all';
}

export interface SeriesWatchOrderPath {
  fromId: number;
  toId: number;
  depth: number;
  relation: string;
  relationKind: SeriesRelationKind;
  pathIds: number[];
  pathKinds: SeriesRelationKind[];
  direct: boolean;
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
  relationPaths: SeriesWatchOrderPath[];
}

export interface SeriesWatchOrderItem extends SeriesWatchOrderNode {
  position: number;
  isRoot: boolean;
  placement: 'root' | SeriesRelationPlacement;
  placementReason: string;
  derivedDepth?: number;
}

export type SeriesWatchOrderEdge = SeriesWatchOrderPath;

export interface SeriesWatchOrderRelated extends SeriesWatchOrderNode {
  depth: number;
  includedInWatchOrder: boolean;
  exclusionReason?: SeriesWatchOrderExclusionReason;
}

export interface SeriesWatchOrderExclusionSample {
  id: number;
  type: SubjectType;
  name: string;
  nameCn: string;
  relationLabels: string[];
  relationKinds: SeriesRelationKind[];
  relationPaths: SeriesWatchOrderPath[];
  reason: SeriesWatchOrderExclusionReason;
}

export interface SeriesWatchOrderExclusionSummary {
  count: number;
  byReason: Array<{
    reason: SeriesWatchOrderExclusionReason;
    count: number;
  }>;
  samples: SeriesWatchOrderExclusionSample[];
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
    animeNodeLimit: number;
    nonAnimeEvidenceLimit: number;
    relatedLimit: number;
    relationRequests: number;
    relationRowsObserved: number;
    uniqueRelatedObserved: number;
    uniqueRelatedReturned: number;
    animeNodesObserved: number;
    animeNodesSelected: number;
    nonAnimeRowsObserved: number;
    nonAnimeRowsReturned: number;
    detailsAttempted: number;
    detailsFetched: number;
    detailsFailed: number;
    relationFailures: number;
    edgeEvidenceLimit: number;
    edgeEvidenceReturned: number;
    edgeEvidenceTruncated: boolean;
    relatedEvidenceTruncated: boolean;
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
      status: 'succeeded' | 'failed';
      subjectId: number;
      depth?: number;
    }>;
    derivation: 'series-watch-order-v2';
    retrievedAt: string;
  };
  warnings: string[];
  limitations: string[];
}

type RelationObservation = SeriesWatchOrderPath;

interface RelationCandidate {
  id: number;
  type: SubjectType;
  name: string;
  nameCn: string;
  image?: string;
  observations: Map<string, RelationObservation>;
  directObservations: Map<string, RelationObservation>;
  depths: Set<number>;
  direct: boolean;
}

interface TraversalCandidate {
  id: number;
  depth: number;
  pathIds: number[];
  pathKinds: SeriesRelationKind[];
}

interface PlacementCandidate {
  candidate: RelationCandidate;
  node: SeriesWatchOrderNode;
  placement: SeriesRelationPlacement;
  path: SeriesWatchOrderPath;
  derivedDepth: number;
  direct: boolean;
}

const DEFAULT_DEPTH = 1;
const DEFAULT_MAX_NODES = 8;
const MAX_DEPTH = 2;
const MAX_NODES = 16;
const MAX_NON_ANIME_EVIDENCE = 8;
const MAX_EDGE_EVIDENCE = 64;
const MAX_RELATED_PATHS_PER_NODE = 8;
const MAX_EXCLUSION_SAMPLES = 12;

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

const COMPOSABLE_CHAIN_KINDS = new Set<SeriesRelationKind>(['prequel', 'sequel']);

const EXCLUSION_REASON_ORDER: SeriesWatchOrderExclusionReason[] = [
  'root_not_anime',
  'conflicting_direct_relations',
  'conflicting_paths',
  'relation_not_watch_step',
  'depth_evidence_only',
  'node_cap',
  'media_type_not_anime',
  'evidence_cap',
];

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeRelation(relation: string): SeriesRelationKind {
  return EXACT_RELATION_KINDS[relation.trim()] || 'unknown';
}

function cleanRelationLabel(relation: string): string {
  return relation.trim() || '关联条目';
}

function pickImage(images?: Record<string, string>): string | undefined {
  return images?.large || images?.common || images?.medium || images?.small || images?.grid;
}

function isStableWatchRelation(relation: SubjectRelationItem): boolean {
  return (
    relation.type === 'anime' && ORDERABLE_WATCH_KINDS.has(normalizeRelation(relation.relation))
  );
}

function isComposablePath(pathKinds: readonly SeriesRelationKind[]): boolean {
  return (
    pathKinds.length > 0 &&
    pathKinds.every((kind) => COMPOSABLE_CHAIN_KINDS.has(kind)) &&
    new Set(pathKinds).size === 1
  );
}

function pathKey(path: SeriesWatchOrderPath): string {
  return `${path.pathIds.join(',')}|${path.relation}`;
}

function comparePath(left: SeriesWatchOrderPath, right: SeriesWatchOrderPath): number {
  if (left.pathIds.length !== right.pathIds.length) {
    return left.pathIds.length - right.pathIds.length;
  }
  const pathLength = Math.min(left.pathIds.length, right.pathIds.length);
  for (let index = 0; index < pathLength; index += 1) {
    const difference = (left.pathIds[index] || 0) - (right.pathIds[index] || 0);
    if (difference !== 0) return difference;
  }
  const kindLength = Math.min(left.pathKinds.length, right.pathKinds.length);
  for (let index = 0; index < kindLength; index += 1) {
    const difference = compareText(left.pathKinds[index] || '', right.pathKinds[index] || '');
    if (difference !== 0) return difference;
  }
  return compareText(left.relation, right.relation);
}

function makePath(
  fromId: number,
  relation: SubjectRelationItem,
  depth: number,
  pathIds: number[],
  pathKinds: SeriesRelationKind[],
): RelationObservation {
  const relationLabel = cleanRelationLabel(relation.relation);
  const relationKind = normalizeRelation(relationLabel);
  return {
    fromId,
    toId: relation.id,
    depth,
    relation: relationLabel,
    relationKind,
    pathIds: [...pathIds, relation.id],
    pathKinds: [...pathKinds, relationKind],
    direct: depth === 0,
  };
}

function makeCandidate(
  relation: SubjectRelationItem,
  observation: RelationObservation,
): RelationCandidate {
  const observationKey = pathKey(observation);
  return {
    id: relation.id,
    type: relation.type,
    name: relation.name,
    nameCn: relation.nameCn || relation.name,
    image: pickImage(relation.images),
    observations: new Map([[observationKey, observation]]),
    directObservations: observation.direct ? new Map([[observationKey, observation]]) : new Map(),
    depths: new Set([observation.depth]),
    direct: observation.direct,
  };
}

function observeCandidate(
  candidates: Map<number, RelationCandidate>,
  relation: SubjectRelationItem,
  observation: RelationObservation,
  rootId: number,
): void {
  if (relation.id === rootId) return;
  const existing = candidates.get(relation.id);
  if (!existing) {
    candidates.set(relation.id, makeCandidate(relation, observation));
    return;
  }

  existing.observations.set(pathKey(observation), observation);
  if (observation.direct) {
    existing.direct = true;
    existing.directObservations.set(pathKey(observation), observation);
  }
  existing.depths.add(observation.depth);
  if (!existing.name && relation.name) existing.name = relation.name;
  if (!existing.nameCn && relation.nameCn) existing.nameCn = relation.nameCn;
  if (!existing.image) existing.image = pickImage(relation.images);
}

function observations(candidate: RelationCandidate): RelationObservation[] {
  return [...candidate.observations.values()].sort(comparePath);
}

function directObservations(candidate: RelationCandidate): RelationObservation[] {
  return [...candidate.directObservations.values()].sort(comparePath);
}

function relationLabels(candidate: RelationCandidate, directOnly = false): string[] {
  const source = directOnly ? directObservations(candidate) : observations(candidate);
  return [...new Set(source.map((item) => item.relation))].sort(compareText);
}

function relationKinds(candidate: RelationCandidate, directOnly = false): SeriesRelationKind[] {
  const source = directOnly ? directObservations(candidate) : observations(candidate);
  return [...new Set(source.map((item) => item.relationKind))].sort(compareText);
}

function boundedPaths(candidate: RelationCandidate, directOnly = false): SeriesWatchOrderPath[] {
  return (directOnly ? directObservations(candidate) : observations(candidate)).slice(
    0,
    MAX_RELATED_PATHS_PER_NODE,
  );
}

function nodeFromCandidate(
  candidate: RelationCandidate,
  detail?: DomainSubject,
  directOnly = false,
): SeriesWatchOrderNode {
  return {
    id: candidate.id,
    type: detail?.type || candidate.type,
    name: detail?.name || candidate.name,
    nameCn: detail?.nameCn || candidate.nameCn || candidate.name,
    date: detail?.date,
    image: pickImage(detail?.images) || candidate.image,
    relationLabels: relationLabels(candidate, directOnly),
    relationKinds: relationKinds(candidate, directOnly),
    // Keep the complete directed evidence on a selected step even when its
    // stable placement was determined by direct labels.  Otherwise a reverse,
    // cross-franchise, or deeper path can disappear from the evidence that
    // explains why the node was included.
    relationPaths: boundedPaths(candidate),
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
    relationPaths: [],
  };
}

function placementGroup(kind: SeriesRelationKind): SeriesRelationPlacement | undefined {
  if (kind === 'prequel') return 'before_root';
  if (kind === 'sequel' || kind === 'side_story' || kind === 'recap') {
    return 'after_root';
  }
  return undefined;
}

function directPlacement(
  candidate: RelationCandidate,
):
  | { placement: SeriesRelationPlacement; path: SeriesWatchOrderPath }
  | { reason: 'conflicting_direct_relations' | 'relation_not_watch_step' } {
  const direct = directObservations(candidate).filter((item) => placementGroup(item.relationKind));
  const groups = new Set(
    direct
      .map((item) => placementGroup(item.relationKind))
      .filter((item): item is SeriesRelationPlacement => Boolean(item)),
  );
  if (groups.size > 1) return { reason: 'conflicting_direct_relations' };
  const placement = [...groups][0];
  if (!placement) return { reason: 'relation_not_watch_step' };
  const path = direct
    .filter((item) => placementGroup(item.relationKind) === placement)
    .sort((left, right) => {
      const leftPriority = left.relationKind === 'prequel' ? 0 : 1;
      const rightPriority = right.relationKind === 'prequel' ? 0 : 1;
      return leftPriority - rightPriority || comparePath(left, right);
    })[0];
  return { placement, path: path! };
}

function derivedPlacements(
  candidate: RelationCandidate,
):
  | { placement: SeriesRelationPlacement; path: SeriesWatchOrderPath }
  | { reason: 'conflicting_paths' | 'depth_evidence_only' } {
  const safe = observations(candidate).filter(
    (item) => !item.direct && isComposablePath(item.pathKinds),
  );
  const groups = new Set(
    safe
      .map((item) => placementGroup(item.pathKinds[0] || item.relationKind))
      .filter((item): item is SeriesRelationPlacement => Boolean(item)),
  );
  if (groups.size > 1) return { reason: 'conflicting_paths' };
  const placement = [...groups][0];
  if (!placement || safe.length === 0) return { reason: 'depth_evidence_only' };
  const path = safe
    .filter((item) => placementGroup(item.pathKinds[0] || item.relationKind) === placement)
    .sort((left, right) => {
      if (left.pathIds.length !== right.pathIds.length) {
        return placement === 'before_root'
          ? right.pathIds.length - left.pathIds.length
          : left.pathIds.length - right.pathIds.length;
      }
      return comparePath(left, right);
    })[0];
  return { placement, path: path! };
}

function candidatePlacement(
  candidate: RelationCandidate,
  detail?: DomainSubject,
): PlacementCandidate | { reason: SeriesWatchOrderExclusionReason } {
  const node = nodeFromCandidate(candidate, detail, candidate.direct);
  if (candidate.type !== 'anime' || node.type !== 'anime') {
    return { reason: 'media_type_not_anime' };
  }

  const placement = candidate.direct ? directPlacement(candidate) : derivedPlacements(candidate);
  if ('reason' in placement) return placement;
  return {
    candidate,
    node,
    placement: placement.placement,
    path: placement.path,
    derivedDepth: placement.path.pathKinds.length,
    direct: candidate.direct,
  };
}

function orderPriority(placement: PlacementCandidate): number {
  if (placement.placement === 'before_root') return 0;
  return placement.path.relationKind === 'recap'
    ? 1
    : placement.path.relationKind === 'sequel'
      ? 2
      : 3;
}

function comparePlacements(left: PlacementCandidate, right: PlacementCandidate): number {
  if (left.placement !== right.placement) {
    return left.placement === 'before_root' ? -1 : 1;
  }
  if (left.placement === 'before_root' && left.derivedDepth !== right.derivedDepth) {
    return right.derivedDepth - left.derivedDepth;
  }
  if (left.placement === 'after_root' && left.derivedDepth !== right.derivedDepth) {
    return left.derivedDepth - right.derivedDepth;
  }
  const priorityDifference = orderPriority(left) - orderPriority(right);
  if (priorityDifference !== 0) return priorityDifference;
  const leftDate = left.node.date;
  const rightDate = right.node.date;
  if (leftDate && rightDate && leftDate !== rightDate) return compareText(leftDate, rightDate);
  if (leftDate && !rightDate) return -1;
  if (!leftDate && rightDate) return 1;
  return left.node.id - right.node.id;
}

function placementReason(placement: PlacementCandidate): string {
  if (placement.direct) {
    if (placement.placement === 'before_root') return '起点直接关系标记为前传，置于起点前';
    if (placement.path.relationKind === 'recap') return '起点直接关系标记为总集篇，置于起点后';
    if (placement.path.relationKind === 'side_story')
      return '起点直接关系标记为衍生/番外，置于起点后';
    return '起点直接关系标记为续集，置于起点后';
  }
  if (placement.placement === 'before_root') {
    return `沿连续前传路径推导（距起点 ${placement.derivedDepth} 条关系）`;
  }
  return `沿连续续集路径推导（距起点 ${placement.derivedDepth} 条关系）`;
}

function addCount(
  counts: Map<SeriesWatchOrderExclusionReason, number>,
  reason: SeriesWatchOrderExclusionReason,
): void {
  counts.set(reason, (counts.get(reason) || 0) + 1);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function candidateDepth(candidate: RelationCandidate): number {
  return Math.min(...candidate.depths);
}

function candidateEvidencePriority(classification: {
  reason?: SeriesWatchOrderExclusionReason;
  selected: boolean;
}): number {
  if (classification.selected) return 0;
  switch (classification.reason) {
    case 'conflicting_direct_relations':
      return 1;
    case 'conflicting_paths':
      return 2;
    case 'relation_not_watch_step':
      return 3;
    case 'depth_evidence_only':
      return 4;
    case 'node_cap':
      return 5;
    case 'media_type_not_anime':
      return 6;
    case 'root_not_anime':
      return 6;
    default:
      return 7;
  }
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
    const nonAnimeEvidenceLimit = media === 'all' ? MAX_NON_ANIME_EVIDENCE : 0;
    const relatedLimit = maxNodes + nonAnimeEvidenceLimit;
    const retrievedAt = new Date().toISOString();
    const warnings: string[] = [];
    const limitations = [
      'Bangumi 的关系接口没有发布统一的官方观看顺序；本结果是有限深度、有限节点的确定性推荐。',
      '只有起点直接关系或连续同向的前传/续集路径可以进入步骤；反向、未知和混合方向证据不会覆盖起点语义。',
      '日期、关系标签和源覆盖可能不完整；本结果不等同于唯一正确或官方 canonical 顺序。',
    ];
    const evidenceSources: SeriesWatchOrderResult['evidence']['sources'] = [];

    const recordSource = (
      operation: string,
      path: string,
      requestedSubjectId: number,
      requestedDepth?: number,
    ): SeriesWatchOrderResult['evidence']['sources'][number] => {
      const source = {
        operation,
        path,
        status: 'failed' as const,
        subjectId: requestedSubjectId,
        ...(requestedDepth === undefined ? {} : { depth: requestedDepth }),
      };
      evidenceSources.push(source);
      return source;
    };

    const rootDetailSource = recordSource('getSubjectById', `/v0/subjects/${subjectId}`, subjectId);
    let rootSubject: DomainSubject;
    try {
      rootSubject = await this.subjectService.getSubjectById(subjectId);
      rootDetailSource.status = 'succeeded';
    } catch (error) {
      rootDetailSource.status = 'failed';
      throw error;
    }
    const root = rootNodeFromSubject(rootSubject);

    let relationRequests = 0;
    let relationRowsObserved = 0;
    let relationFailures = 0;
    const traversedRelations: RelationObservation[] = [];
    const candidates = new Map<number, RelationCandidate>();

    const getRelations = async (
      id: number,
      requestedDepth: number,
      pathIds: number[],
      pathKinds: SeriesRelationKind[],
      required: boolean,
    ): Promise<SubjectRelationItem[]> => {
      const source = recordSource(
        'getRelatedSubjectsBySubjectId',
        `/v0/subjects/${id}/subjects`,
        id,
        requestedDepth,
      );
      relationRequests += 1;
      try {
        const rows = await this.subjectService.getSubjectRelations(id);
        source.status = 'succeeded';
        relationRowsObserved += rows.length;
        for (const relation of rows) {
          const observation = makePath(id, relation, requestedDepth, pathIds, pathKinds);
          traversedRelations.push(observation);
          observeCandidate(candidates, relation, observation, subjectId);
        }
        return rows;
      } catch (error) {
        source.status = 'failed';
        if (required) throw error;
        relationFailures += 1;
        warnings.push(`关联条目 ${id} 的关系读取失败，未继续展开：${errorText(error)}`);
        return [];
      }
    };

    const rootRelations = await getRelations(subjectId, 0, [subjectId], [], true);

    const visitedForTraversal = new Set<number>([subjectId]);
    const scheduledForTraversal = new Set<number>();
    const pendingTraversal = new Map<number, TraversalCandidate>();
    let traversedAnimeNodes = 0;
    let traversalCapTruncated = false;
    let depthTruncated = false;

    const canExpandCandidate = (id: number): boolean => {
      const candidate = candidates.get(id);
      if (!candidate || candidate.type !== 'anime') return true;
      const direct = directPlacement(candidate);
      return !('reason' in direct && direct.reason === 'conflicting_direct_relations');
    };

    const scheduleTraversal = (
      relation: SubjectRelationItem,
      nextDepth: number,
      parentPathIds: number[],
      parentPathKinds: SeriesRelationKind[],
    ): void => {
      if (
        !isStableWatchRelation(relation) ||
        relation.id === subjectId ||
        visitedForTraversal.has(relation.id) ||
        scheduledForTraversal.has(relation.id) ||
        !canExpandCandidate(relation.id)
      ) {
        return;
      }
      scheduledForTraversal.add(relation.id);
      if (traversedAnimeNodes + pendingTraversal.size >= maxNodes) {
        traversalCapTruncated = true;
        return;
      }
      pendingTraversal.set(relation.id, {
        id: relation.id,
        depth: nextDepth,
        pathIds: [...parentPathIds, relation.id],
        pathKinds: [...parentPathKinds, normalizeRelation(cleanRelationLabel(relation.relation))],
      });
    };

    const rootTraversalRows = [...rootRelations].sort(
      (left, right) =>
        left.id - right.id ||
        compareText(cleanRelationLabel(left.relation), cleanRelationLabel(right.relation)),
    );
    if (root.type !== 'anime') {
      // A non-anime root can expose relationship evidence, but it cannot
      // establish an anime watch-order direction or spend traversal/detail
      // budget on a recommendation that would be semantically misleading.
    } else if (depth === 0) {
      depthTruncated = rootTraversalRows.some(
        (relation) => isStableWatchRelation(relation) && canExpandCandidate(relation.id),
      );
    } else {
      for (const relation of rootTraversalRows) {
        scheduleTraversal(relation, 1, [subjectId], []);
      }

      while (pendingTraversal.size > 0) {
        const traversal = pendingTraversal.values().next().value as TraversalCandidate | undefined;
        if (!traversal) break;
        pendingTraversal.delete(traversal.id);
        if (visitedForTraversal.has(traversal.id)) continue;
        visitedForTraversal.add(traversal.id);
        traversedAnimeNodes += 1;

        const childRelations = await getRelations(
          traversal.id,
          traversal.depth,
          traversal.pathIds,
          traversal.pathKinds,
          false,
        );

        const sortedChildRelations = [...childRelations].sort(
          (left, right) =>
            left.id - right.id ||
            compareText(cleanRelationLabel(left.relation), cleanRelationLabel(right.relation)),
        );
        if (traversal.depth < depth) {
          for (const relation of sortedChildRelations) {
            scheduleTraversal(
              relation,
              traversal.depth + 1,
              traversal.pathIds,
              traversal.pathKinds,
            );
          }
        } else if (
          sortedChildRelations.some(
            (relation) =>
              isStableWatchRelation(relation) &&
              relation.id !== subjectId &&
              !visitedForTraversal.has(relation.id) &&
              !scheduledForTraversal.has(relation.id) &&
              canExpandCandidate(relation.id),
          )
        ) {
          depthTruncated = true;
        }
      }
    }

    const candidateIds = [...candidates.keys()].sort((left, right) => left - right);
    const detailCandidates = new Map<number, DomainSubject>();
    const placementCandidates: PlacementCandidate[] = [];
    const exclusionReasons = new Map<number, SeriesWatchOrderExclusionReason>();

    for (const candidateId of candidateIds) {
      const candidate = candidates.get(candidateId);
      if (!candidate) continue;
      if (root.type !== 'anime') {
        exclusionReasons.set(candidateId, 'root_not_anime');
        continue;
      }
      const classification = candidatePlacement(candidate);
      if ('reason' in classification) {
        exclusionReasons.set(candidateId, classification.reason);
      } else {
        placementCandidates.push(classification);
      }
    }

    placementCandidates.sort(comparePlacements);
    const selectedPlacements = placementCandidates.slice(0, maxNodes);
    const selectedIds = new Set(selectedPlacements.map((item) => item.node.id));
    const nodeCapTruncated = placementCandidates.length > selectedPlacements.length;
    for (const placement of placementCandidates) {
      if (!selectedIds.has(placement.node.id)) {
        exclusionReasons.set(placement.node.id, 'node_cap');
      }
    }

    let detailsAttempted = 0;
    let detailsFetched = 0;
    let detailsFailed = 0;
    const detailFailureIds: number[] = [];
    for (const placement of selectedPlacements.sort(
      (left, right) => left.node.id - right.node.id,
    )) {
      const source = recordSource(
        'getSubjectById',
        `/v0/subjects/${placement.node.id}`,
        placement.node.id,
        placement.derivedDepth - 1,
      );
      detailsAttempted += 1;
      try {
        const detail = await this.subjectService.getSubjectById(placement.node.id);
        source.status = 'succeeded';
        detailCandidates.set(placement.node.id, detail);
        detailsFetched += 1;
        if (detail.type !== 'anime') {
          selectedIds.delete(placement.node.id);
          exclusionReasons.set(placement.node.id, 'media_type_not_anime');
          warnings.push(
            `条目 ${placement.node.id} 的详情媒介不是动画，已从观看步骤移除并保留为媒介证据。`,
          );
        }
      } catch (error) {
        source.status = 'failed';
        detailsFailed += 1;
        detailFailureIds.push(placement.node.id);
        warnings.push(
          `条目 ${placement.node.id} 的详情读取失败，保留关系接口中的名称：${errorText(error)}`,
        );
      }
    }

    const refreshedPlacements = placementCandidates
      .filter((item) => selectedIds.has(item.node.id))
      .map((item) => {
        const detail = detailCandidates.get(item.node.id);
        return {
          ...item,
          node: nodeFromCandidate(item.candidate, detail, item.direct),
        };
      })
      .sort(comparePlacements);
    const refreshedPlacementById = new Map(
      refreshedPlacements.map((item) => [item.node.id, item.node] as const),
    );

    const watchOrderEntries: Array<{
      node: SeriesWatchOrderNode;
      isRoot: boolean;
      placement: 'root' | SeriesRelationPlacement;
      derivedDepth?: number;
      placementReason?: string;
    }> = [];
    for (const placement of refreshedPlacements) {
      watchOrderEntries.push({
        node: placement.node,
        isRoot: false,
        placement: placement.placement,
        derivedDepth: placement.derivedDepth,
        placementReason: placementReason(placement),
      });
    }
    if (root.type === 'anime') {
      watchOrderEntries.push({
        node: root,
        isRoot: true,
        placement: 'root',
        placementReason: '请求的起始条目',
      });
    }
    watchOrderEntries.sort((left, right) => {
      const placementRank = (placement: 'root' | SeriesRelationPlacement): number =>
        placement === 'before_root' ? 0 : placement === 'root' ? 1 : 2;
      const placementDifference = placementRank(left.placement) - placementRank(right.placement);
      if (placementDifference !== 0) return placementDifference;
      if (left.derivedDepth !== undefined && right.derivedDepth !== undefined) {
        if (left.placement === 'before_root' && left.derivedDepth !== right.derivedDepth) {
          return right.derivedDepth - left.derivedDepth;
        }
        if (left.placement === 'after_root' && left.derivedDepth !== right.derivedDepth) {
          return left.derivedDepth - right.derivedDepth;
        }
      }
      const leftDate = left.node.date;
      const rightDate = right.node.date;
      if (leftDate && rightDate && leftDate !== rightDate) return compareText(leftDate, rightDate);
      if (leftDate && !rightDate) return -1;
      if (!leftDate && rightDate) return 1;
      return left.node.id - right.node.id;
    });
    const watchOrder: SeriesWatchOrderItem[] = watchOrderEntries.map((entry, index) => ({
      ...entry.node,
      position: index + 1,
      isRoot: entry.isRoot,
      placement: entry.placement,
      placementReason: entry.placementReason || '有界关系证据',
      ...(entry.derivedDepth === undefined ? {} : { derivedDepth: entry.derivedDepth }),
    }));

    const candidateClassifications = candidateIds.map((candidateId) => {
      const candidate = candidates.get(candidateId)!;
      const detail = detailCandidates.get(candidateId);
      const placement = placementCandidates.find((item) => item.node.id === candidateId);
      const node =
        refreshedPlacementById.get(candidateId) ||
        (placement
          ? nodeFromCandidate(candidate, detail, placement.direct)
          : nodeFromCandidate(candidate, detail));
      const reason = exclusionReasons.get(candidateId);
      return {
        candidate,
        node,
        placement,
        reason,
        selected: selectedIds.has(candidateId),
      };
    });

    const animeClassifications = candidateClassifications
      .filter((item) => item.node.type === 'anime')
      .sort((left, right) => {
        if (left.selected !== right.selected) return left.selected ? -1 : 1;
        const leftPriority = candidateEvidencePriority(left);
        const rightPriority = candidateEvidencePriority(right);
        return leftPriority - rightPriority || left.node.id - right.node.id;
      });
    const nonAnimeClassifications = candidateClassifications
      .filter((item) => item.node.type !== 'anime')
      .sort((left, right) => left.node.id - right.node.id);

    const relatedAnime = animeClassifications.slice(0, maxNodes);
    const relatedNonAnime =
      media === 'all' ? nonAnimeClassifications.slice(0, nonAnimeEvidenceLimit) : [];
    const relatedClassifications = [...relatedAnime, ...relatedNonAnime];
    const relatedEvidenceTruncated =
      animeClassifications.length > relatedAnime.length ||
      (media === 'all' && nonAnimeClassifications.length > relatedNonAnime.length);
    const related = relatedClassifications.map((item): SeriesWatchOrderRelated => ({
      ...item.node,
      relationPaths: boundedPaths(item.candidate),
      depth: candidateDepth(item.candidate),
      includedInWatchOrder: item.selected,
      ...(item.selected || !item.reason ? {} : { exclusionReason: item.reason }),
    }));

    const exclusionCounts = new Map<SeriesWatchOrderExclusionReason, number>();
    const exclusionItems: SeriesWatchOrderExclusionSample[] = [];
    for (const item of candidateClassifications) {
      if (item.selected) continue;
      const reason = item.reason || 'evidence_cap';
      addCount(exclusionCounts, reason);
      exclusionItems.push({
        id: item.node.id,
        type: item.node.type,
        name: item.node.name,
        nameCn: item.node.nameCn,
        relationLabels: item.node.relationLabels,
        relationKinds: item.node.relationKinds,
        relationPaths: boundedPaths(item.candidate),
        reason,
      });
    }
    if (relatedEvidenceTruncated) {
      warnings.push(
        `关联证据达到有界上限 ${relatedLimit}，未展示的条目仍通过排除统计、边证据或覆盖字段标识。`,
      );
    }
    const excludedSamples = exclusionItems
      .sort((left, right) => {
        const leftReason = EXCLUSION_REASON_ORDER.indexOf(left.reason);
        const rightReason = EXCLUSION_REASON_ORDER.indexOf(right.reason);
        return leftReason - rightReason || left.id - right.id;
      })
      .slice(0, MAX_EXCLUSION_SAMPLES);

    const edges = traversedRelations.slice().sort(comparePath).slice(0, MAX_EDGE_EVIDENCE);
    const edgeEvidenceTruncated = traversedRelations.length > MAX_EDGE_EVIDENCE;
    if (edgeEvidenceTruncated) {
      warnings.push(`关系边证据达到上限 ${MAX_EDGE_EVIDENCE}；coverage 已标记为 partial。`);
    }

    const conflictingCount = [...exclusionCounts.entries()]
      .filter(
        ([reason]) => reason === 'conflicting_direct_relations' || reason === 'conflicting_paths',
      )
      .reduce((sum, [, count]) => sum + count, 0);
    if (conflictingCount > 0) {
      warnings.push('存在方向冲突的关系证据；冲突条目不会进入 definitive 观看步骤。');
    }
    if (
      candidateIds.some(
        (id) =>
          candidates.get(id)?.observations &&
          relationKinds(candidates.get(id)!).includes('unknown'),
      )
    ) {
      warnings.push('存在未映射的原始关系标签；这些标签不会创建观看步骤或继续扩展关系。');
    }
    if (detailsFailed > 0) {
      warnings.push(`共有 ${detailsFailed} 个条目的详情不可用；名称和关系仍来自关系接口。`);
    }
    if (relationFailures > 0) {
      warnings.push(`共有 ${relationFailures} 个可选关系读取失败；未读取的分支不会被假设为完整。`);
    }
    if (traversalCapTruncated || nodeCapTruncated) {
      warnings.push(`动画推荐/遍历节点达到上限 ${maxNodes}；结果只保留确定性选择的一部分。`);
    }
    if (depthTruncated) {
      warnings.push(`关系遍历达到深度上限 ${depth}；仍有未访问的 eligible 观看关系。`);
    }
    if (watchOrder.some((item) => !item.date)) {
      warnings.push('部分观看步骤没有可用日期；同一确定性位置内使用条目 ID 作为并列规则。');
    }
    if (detailFailureIds.length > 0) {
      warnings.push(`详情失败的条目 ID：${detailFailureIds.join(', ')}。`);
    }
    if (root.type !== 'anime') {
      warnings.push('起始条目不是动画；本次结果只能展示关系证据，不能计算动画观看步骤。');
    } else if (watchOrder.length === 1) {
      warnings.push(
        '没有足够的可排序动画关系；起始条目仍作为唯一的 bounded recommendation 步骤展示。',
      );
    }

    const truncationReasons: string[] = [];
    if (traversalCapTruncated || nodeCapTruncated) truncationReasons.push(`maxNodes=${maxNodes}`);
    if (depthTruncated) truncationReasons.push(`depth=${depth}`);
    if (edgeEvidenceTruncated) truncationReasons.push(`edge-evidence=${MAX_EDGE_EVIDENCE}`);
    if (relatedEvidenceTruncated) truncationReasons.push(`related-evidence=${relatedLimit}`);
    if (detailsFailed > 0) truncationReasons.push('subject-detail-failure');
    if (relationFailures > 0) truncationReasons.push('relation-read-failure');
    if (conflictingCount > 0) truncationReasons.push('semantic-conflict');

    const capabilityStates: SeriesWatchOrderResult['capabilityStates'] = {
      watchOrder: root.type === 'anime' ? 'bounded_recommendation' : 'not_computable',
    };
    const partial = truncationReasons.length > 0;
    const nonAnimeRowsObserved = nonAnimeClassifications.length;
    const nonAnimeRowsReturned = relatedNonAnime.length;

    return {
      state: root.type !== 'anime' ? 'not_computable' : partial ? 'partial' : 'complete',
      subjectId,
      root,
      watchOrder,
      related,
      edges,
      excluded: {
        count: [...exclusionCounts.values()].reduce((total, count) => total + count, 0),
        byReason: EXCLUSION_REASON_ORDER.filter((reason) => exclusionCounts.has(reason)).map(
          (reason) => ({ reason, count: exclusionCounts.get(reason)! }),
        ),
        samples: excludedSamples,
      },
      coverage: {
        depth,
        maxNodes,
        media,
        animeNodeLimit: maxNodes,
        nonAnimeEvidenceLimit,
        relatedLimit,
        relationRequests,
        relationRowsObserved,
        uniqueRelatedObserved: candidateIds.length,
        uniqueRelatedReturned: related.length,
        animeNodesObserved: animeClassifications.length,
        animeNodesSelected: selectedIds.size,
        nonAnimeRowsObserved,
        nonAnimeRowsReturned,
        detailsAttempted,
        detailsFetched,
        detailsFailed,
        relationFailures,
        edgeEvidenceLimit: MAX_EDGE_EVIDENCE,
        edgeEvidenceReturned: edges.length,
        edgeEvidenceTruncated,
        relatedEvidenceTruncated,
        truncated: partial,
        truncationReasons,
        retrievedAt,
      },
      capabilityStates,
      evidence: {
        sources: evidenceSources,
        derivation: 'series-watch-order-v2',
        retrievedAt,
      },
      warnings,
      limitations,
    };
  }
}
