# Bangumi Query Model 设计研究

> PR-7A 设计产物。这里定义可验证的 typed query contract、概念解析和查询计划边界；不实现 PR-7B。

## 设计目标

Query Model 要把自然语言问题变成“可解释、可分页、可追溯、可拒绝”的查询，而不是把所有意图压成一个 `keyword` 字符串。它需要表达：

- 实体类型和关系路径：subject、episode、character、person、user collection、community topic。
- 明确的比较、范围、集合、排除和排序语义。
- 概念解析的不确定性，例如“异世界”不自动等于“转生”，“原创”不自动等于某个 tag。
- 数据源、认证范围、缓存新鲜度、结果置信度和不可计算原因。
- 多跳关系、时间窗口和衍生统计的计算计划。

## 类型草案

以下是契约级 TypeScript-like notation，不是生产代码。所有外部字符串在进入执行器前必须经过解析和验证。

```ts
type EntityKind =
  'subject' | 'episode' | 'character' | 'person' | 'user' | 'collection' | 'topic' | 'index';

type MediaType = 'anime' | 'book' | 'music' | 'game' | 'real';
type SubjectKind = 'tv' | 'movie' | 'ova' | 'ona' | 'special' | 'other';

type QueryRequest = {
  kind: QueryKind;
  select?: FieldSelection;
  where?: Predicate;
  orderBy?: OrderClause[];
  page?: PageRequest;
  window?: TimeWindow;
  auth: AuthScope;
  freshness?: FreshnessRequirement;
  explain?: 'none' | 'compact' | 'full';
};

type QueryKind =
  | SubjectQuery
  | EpisodeQuery
  | PersonWorkQuery
  | CastQuery
  | RelationQuery
  | CollectionQuery
  | CommunityQuery
  | AnalyticsQuery;

type SubjectQuery = {
  type: 'subject';
  media?: MediaType[];
  keyword?: TextMatch;
  subjectType?: SubjectKind[];
  concepts?: ConceptExpression;
  airDate?: DatePredicate;
  rating?: NumericPredicate;
  ratingCount?: NumericPredicate;
  rank?: NumericPredicate;
  nsfw?: 'exclude' | 'include' | 'only';
};

type PersonWorkQuery = {
  type: 'person_work';
  person: EntityRef<'person'>;
  role?: RoleExpression;
  media?: MediaType[];
  subjectType?: SubjectKind[];
  airDate?: DatePredicate;
  include?: 'subjects' | 'characters' | 'staff' | 'all';
};

type RelationQuery = {
  type: 'relation';
  root: EntityRef<'subject' | 'person' | 'character'>;
  edgeTypes: RelationType[];
  depth?: 1 | 2 | 3;
  orderPolicy?: 'release_date' | 'relation_priority' | 'topological';
};

type CollectionQuery = {
  type: 'collection';
  owner: OwnerRef; // public username or authenticated me
  status?: CollectionStatus[];
  media?: MediaType[];
  completion?: 'complete' | 'incomplete' | 'unknown';
  episodeProgress?: ProgressPredicate;
  join?: 'calendar' | 'subject_stats' | 'relations';
};

type CommunityQuery = {
  type: 'community';
  scope: 'rakuen' | 'subject_board' | 'comments' | 'reviews' | 'groups' | 'blogs';
  subject?: EntityRef<'subject'>;
  group?: EntityRef<'index'>;
  metric: 'topics' | 'replies' | 'comments' | 'heat' | 'velocity';
  window?: TimeWindow;
};

type AnalyticsQuery = {
  type: 'analytics';
  analysis:
    | 'PersonActivityAnalysis'
    | 'VoiceActorWorkload'
    | 'StaffActivity'
    | 'SubjectPopularity'
    | 'SeasonRanking'
    | 'SubjectTrend'
    | 'CommunityTrend'
    | 'UserTasteProfile'
    | 'CollectionBacklog'
    | 'SeriesWatchOrder';
  input: Record<string, unknown>;
};
```

## Predicate 与排序语义

```ts
type NumericPredicate =
  | { op: 'eq' | 'gt' | 'gte' | 'lt' | 'lte'; value: number }
  | { op: 'between'; min?: number; max?: number };

type DatePredicate =
  | { op: 'on' | 'before' | 'after'; date: ISODate }
  | { op: 'between'; start: ISODate; end: ISODate; inclusiveEnd?: boolean };

type Predicate =
  | { and: Predicate[] }
  | { or: Predicate[] }
  | { not: Predicate }
  | { field: string; value: string | number | boolean }
  | { concept: ConceptExpression };

type OrderClause = {
  field:
    | 'match'
    | 'heat'
    | 'rank'
    | 'score'
    | 'ratingCount'
    | 'airDate'
    | 'name'
    | 'collectionCount'
    | 'velocity';
  direction: 'asc' | 'desc';
  tieBreak?: OrderClause[];
};
```

API 适配器应把 `gte`/`lte` 等 typed predicate 编译为 v0 的比较字符串，例如 `rating: [">=8"]`、`air_date: [">=2020-07-01", "<2025-01-01"]`。编译失败必须是结构化 unsupported，而不是静默改成关键词搜索。

## ConceptResolver

### 为什么不能静默合并

Bangumi 页面同时使用公共标签和普通标签；官方 search schema 把 `meta_tags` 和 `tag` 区分开，并规定多值 AND 与负值排除。产品词也不一定等于标签：

- “异世界”可能对应精确标签，但不应自动扩展为“转生”“穿越”。
- “轻百合”不能无提示地等于“百合”。
- “原创”可能是标签、infobox 的原作信息或用户语义；三者证据强度不同。
- “主役”“主要角色”“配角”来自角色/出演关系，不是一个稳定的 subject tag。

### 解析结果

```ts
type ConceptExpression = {
  raw: string;
  mode: 'exact' | 'candidate' | 'confirmed';
  candidates: ConceptCandidate[];
  operator: 'all' | 'any' | 'exclude';
};

type ConceptCandidate = {
  value: string;
  vocabulary: 'meta_tag' | 'tag' | 'subject_field' | 'role' | 'media';
  match: 'exact' | 'alias' | 'related' | 'heuristic';
  evidence: EvidenceRef[];
  warning?: 'ambiguous' | 'broader_than_requested' | 'not_officially_defined';
};
```

Resolver 的输出规则：

1. 先 exact：使用官方枚举、页面可见的精确标签或实体字段。
2. 再 alias：只使用有来源的别名，显示“将 X 作为 Y 查询”的解释。
3. related/heuristic 只能作为候选，不得默认加入最终 AND 条件。
4. 有多个候选时返回候选集和数据量影响；只有用户确认或请求“扩大范围”时才执行。
5. 每个候选携带 vocabulary 和证据 URL，避免把 HTML 标签误称为官方字段。

## 查询生命周期

```text
自然语言问题
  → entity/name resolution
  → typed Query AST
  → ConceptResolver（exact / ambiguous / confirmed）
  → capability check（API / authenticated / HTML / derived）
  → QueryPlan（sources, joins, windows, cache, cost）
  → execution + provenance
  → normalized result + explanation + confidence
  → renderer view model
```

### QueryPlan 的最小内容

```ts
type QueryPlan = {
  steps: PlanStep[];
  joins: JoinSpec[];
  requiredAuth: AuthScope;
  sources: SourceRequirement[];
  cachePolicy: CachePolicy;
  unavailable?: UnavailableReason[];
};

type PlanStep = {
  id: string;
  operation: string;
  input: unknown;
  expectedFields: string[];
  pagination?: 'page' | 'cursor' | 'bounded_fanout';
};
```

计划器必须先估算 fan-out：例如 person workload 可能是 person→characters→subjects→staff 的多跳图；超过上限时应返回 partial/needs narrowing，而不是无界抓取。

## 认证、隐私和新鲜度

- `AuthScope = public | optional_bearer | current_user | write`；collection query 的 owner 是 `me` 时只能使用当前绑定账号的认证数据。
- 查询结果分离 public aggregate 与 private row。不能因为渲染卡片需要字段就把私密评论、token 或完整收藏明细放入公共缓存。
- `FreshnessRequirement` 至少包含 `maxAge`, `asOf`, `allowStale`; community trend 默认短 TTL，静态 subject metadata 可长 TTL。
- 每个 step 返回 `retrievedAt`, `sourceKind`, `sourceUrl/operation`, `cacheState`；衍生结果附 `formulaVersion` 和 input evidence IDs。

## 失败与不确定性契约

| 状态                | 触发例子                                          | 用户可见行为                           |
| ------------------- | ------------------------------------------------- | -------------------------------------- |
| `unsupported`       | v0 没有 comments endpoint，且未启用 HTML provider | 明确说明缺少数据源，不伪造空榜单       |
| `auth_required`     | “我的未看完”没有 bearer                           | 要求登录/绑定，说明需要的权限          |
| `ambiguous_concept` | “原创”可解释为 tag 或 infobox 原作                | 返回候选解释，请用户选择或扩大范围     |
| `partial`           | person fan-out 达到上限、部分作品无 air date      | 返回覆盖率、缺失项和置信度             |
| `stale`             | 仅有过期社区快照                                  | 显示 as-of 和 TTL，允许用户要求刷新    |
| `not_computable`    | 没有历史快照却要求 7 日增长                       | 说明需要两个时间点，不能以当前总数代替 |
| `identity_conflict` | 同名 person/character 合并不确定                  | 返回候选实体 ID，不自动合并            |

## 三个编译示例

### “近 5 年评分 8.0 以上且评分人数超过 5000 的原创动画”

```yaml
kind: subject
media: [anime]
airDate: { op: between, start: 2021-01-01, end: 2025-12-31 }
rating: { op: gte, value: 8.0 }
ratingCount: { op: gt, value: 5000 }
concepts:
  raw: 原创
  mode: candidate
  candidates:
    - { vocabulary: meta_tag, value: 原创, match: exact }
    - {
        vocabulary: subject_field,
        value: original_source,
        match: heuristic,
        warning: not_officially_defined,
      }
```

默认只执行 exact tag 候选；若用户选择“按原作字段扩大”，结果必须分层显示。

### “水濑祈最近半年工作量和之前半年相比如何”

```yaml
kind: analytics
analysis: VoiceActorWorkload
input:
  person: { id: 10868, resolvedFrom: 水瀬いのり }
  windows:
    - { start: 2025-08-09, end: 2026-02-08 }
    - { start: 2026-02-09, end: 2026-08-09 }
  media: [anime]
  subjectType: [tv]
  roles: [main, support]
```

计划需记录站点当前日期、角色分类证据、去重策略和缺失 air date 的作品。

### “过去 7 天讨论增长最快的动画”

```yaml
kind: analytics
analysis: CommunityTrend
input:
  metric: replies
  window: { duration: P7D, anchor: retrieval_time }
  entity: subject
  source: rakuen_topiclist
```

没有前一个快照就返回 `not_computable`；不能把当前 topic count 当成增长量。

## 与 Renderer 的边界

Query Model 返回数据和解释，不返回 JSX/HTML。Renderer 只消费稳定 view model：

- `result.rows`：实体、指标和 normalized fields。
- `result.evidence`：来源、时间、缓存状态、证据强度。
- `result.explanation`：过滤、排序、概念解析、缺失数据。
- `result.confidence`：整体等级与逐字段覆盖率。

这样可以让同一查询在 JSON、MCP 和 PNG/HTML 输出中保持语义一致，也不会让模板自行猜测“原创”“完结”或“主役”。

## 参考来源

- [固定 OpenAPI](../../openapi/upstream/v0.yaml)
- [Bangumi API OpenAPI mirror](https://github.com/bangumi/api/blob/master/open-api/v0.yaml)
- [Bangumi 标签页](https://bgm.tv/tag)
- [动画浏览器](https://bgm.tv/anime/browser/web?sort=trends)
- [条目示例](https://bgm.tv/subject/41529)
