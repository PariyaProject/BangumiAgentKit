# Bangumi MCP 工具完整参考手册

## 语义工具列表

| 工具名称                              | 权限            | 风险等级 | 说明                                                                                                    |
| ------------------------------------- | --------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `bangumi.search_subjects`             | none            | read     | 按关键词搜索动画、书籍、音乐、游戏                                                                      |
| `bangumi.get_subject`                 | optional        | read     | 获取条目详细信息（评分、排名、简介、分类统计）                                                          |
| `bangumi.get_subject_overview`        | none            | read     | 一次获取条目、统计、角色、职员、关联条目的证据型概览                                                    |
| `bangumi.get_subject_relations`       | none            | read     | 查看前传、续集、衍生作、原著                                                                            |
| `bangumi.get_series_watch_order`      | none            | read     | 有界观看顺序、方向路径、媒介排除与覆盖证据                                                              |
| `bangumi.get_subject_cast`            | none            | read     | 查看角色及其声优 (CV) 人物关联                                                                          |
| `bangumi.get_calendar`                | none            | read     | 获取周一至周日新番每日放送进度                                                                          |
| `bangumi.get_episodes`                | none            | read     | 查看章节列表（自动标识正篇/SP）                                                                         |
| `bangumi.get_episode`                 | none            | read     | 查看单个章节详情                                                                                        |
| `bangumi.search_characters`           | none            | read     | 搜索虚拟角色                                                                                            |
| `bangumi.get_character`               | none            | read     | 查看角色详情、关联条目与声优                                                                            |
| `bangumi.search_persons`              | none            | read     | 搜索现实人物/声优                                                                                       |
| `bangumi.get_person`                  | none            | read     | 查看人物详情与参与作品                                                                                  |
| `bangumi.get_user`                    | none            | read     | 查看用户公开主页与收藏                                                                                  |
| `bangumi.get_collection_intelligence` | read:collection | read     | 当前账号有界收藏状态、评分、标签和进度概览                                                              |
| `bangumi.get_collection_backlog`      | read:collection | read     | 当前账号动画 backlog、正篇 sourceTotal、SlimSubject.eps validity、严格 airdate 证据、剩余集数与冲突状态 |
| `bangumi.get_collection_schedule`     | read:collection | read     | 当前账号收藏与官方七日 legacy 日历的 subject ID 对齐、星期、首播日期、收藏信封进度与未匹配覆盖          |
| `bangumi.get_collection_dashboard`    | read:collection | read     | 一次组合当前账号收藏概览、backlog 与七日播出计划；保留区段 evidence/coverage/degraded states 和组合上限 |
| `bangumi.get_revision`                | none            | read     | 查看条目修改修订日志                                                                                    |
| `bangumi.get_index`                   | none            | read     | 查看目录及其包含条目                                                                                    |
| `bangumi.auth_status`                 | none            | read     | 查看当前用户 Bangumi 绑定状态                                                                           |

Renderer companions include `bangumi.render_subject_overview`,
`bangumi.render_series_watch_order`, and
`bangumi.render_collection_backlog`. `render_subject_overview` accepts the
same bounded subject-overview caps as the semantic tool. The series renderer
accepts the same bounded `subjectId`, `depth` (0-2), `maxNodes` (1-16), and `media`
(`anime`/`all`) inputs and returns an ArtifactRef. The card keeps raw relation
labels, directed paths, exclusions, conflicts, and partial/unavailable state
visible rather than presenting a unique official order. The collection-backlog
renderer is current-account-only, image-free, bounded, and preserves partial,
conflict, auth/permission, unavailable, and not-computable states without
rendering comments; it uses a valid complete episode sourceTotal as the
denominator, preserves SlimSubject.eps validity, and exposes strict airdate
completion as finished/ongoing/unknown evidence. Finished is explicitly
qualified as “all currently reported main episodes have past airdates” rather
than an official no-more-episodes claim. Row-level errors retain code, message,
and nextAction.

The collection-schedule semantic tool and renderer are current-account-only,
image-free, and bounded. They join the official seven-day legacy calendar to
the selected current-account animation collection by subject ID, keep
unmatched calendar/collection rows visible, and expose `ep_status` plus
`subject.eps` only as collection-envelope evidence. Unmatched rows distinguish
complete-scan absence from status filtering and incomplete source coverage.
They do not infer an airing time, timezone, episode-level completion, history,
or recommendation, and do not render collection comments or perform writes.

The collection-dashboard semantic tool and renderer are current-account-only,
image-free, and bounded. They schedule the three existing private read paths
sequentially at the top level (the schedule path retains its bounded internal
calendar/collection concurrency) and preserve section-level source evidence, retrieval time, coverage,
warnings, conflicts, unavailable/auth states, and a versioned composition
formula. The aggregate budget is explicit; the dashboard is not a transaction,
does not accept an arbitrary username, does not read comments or infer history,
taste, or recommendations, does not use shared caches or public artifacts, and
does not perform writes.

## 保底 Operation 工具

- `bangumi.list_operations`: 列出全部 56 个底层 Operation ID
- `bangumi.describe_operation`: 查询底层 Operation 参数与规范
- `bangumi.call_operation`: 直接执行底层白名单 Operation
