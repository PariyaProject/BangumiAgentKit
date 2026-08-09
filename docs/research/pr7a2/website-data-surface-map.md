# Website data-surface map

本表把旧 `bgm.tv` 页面、`next.bgm.tv` SPA 及其 S3 `/p1` client 分开。S1/S2/S3/S4/S5/S6/S7 采用 [`source-taxonomy.md`](source-taxonomy.md) 的定义。

| ID  | 页面/入口                       | 目的与可见字段                                             | 控件/分页/认证影响                                   | 来源优先级（建议）                  |
| --- | ------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| A   | `/`                             | 首页编排、推荐、活动入口                                   | 编排易变；登录改变模块                               | S1/S2 → S3 → S5                     |
| B   | `/calendar`                     | 周期、weekday、条目名/封面、今日总数/watchers              | 服务器渲染；count 口径可能冲突                       | S2 → S1 hydration → S3 → S5         |
| C   | `/anime`                        | 动画 discovery/季节入口                                    | 新旧站点路由可能不同                                 | S1 → S3 → S5                        |
| D   | `/anime/browser`                | 浏览、sort、年份/月、rank/trends、首字母等                 | query controls 影响结果；HTML 可见                   | S1 `/subjects`/search → S3 → S5     |
| E   | `/anime/tag/*`                  | tag 词表、条目列表、计数                                   | tag alias/分页/排序需记录                            | S1 tags/search → S3 → S5            |
| F   | `/subject/{id}`                 | identity、简介、评分、收藏、标签、links                    | NSFW/locked/auth 影响字段                            | S1 → S3 → S5                        |
| G   | `/subject/{id}/characters`      | 角色、CV、角色图、关系                                     | role tabs、分页；收藏需 auth                         | S1 → S3 → S5                        |
| H   | `/subject/{id}/persons`         | staff/职位分组                                             | position query/网页分组口径                          | S1 → S3 → S5                        |
| I   | `/subject/{id}/ep`              | episodes、类型、标题、日期、时长、讨论入口                 | episode 分页/状态                                    | S1 → S3 → S5                        |
| J   | `/subject/{id}/stats`           | web-specific cross-tabs、用户分布、VIB、放送图表和定义文案 | core histogram/buckets/completion/SD 已由 S1+S7 支撑 | S5 allowlist；S3 若有等价聚合再评估 |
| K   | `/subject/{id}/board`           | 讨论主题/回复入口、时间、回复数                            | 分页、删除/隐私、HTML                                | S3 → S5                             |
| L   | `/subject/{id}/comments`        | 短评/吐槽、作者/时间/类型                                  | `type`/分页/登录影响                                 | S3 → S1 可用字段 → S5               |
| M   | `/subject/{id}/reviews`         | 长评、回复数、时间、正文入口                               | 正文版权/分页/状态                                   | S3 → S5                             |
| N   | `/person/{id}`                  | 人物 identity、career、works/casts                         | 角色/职位/分页                                       | S1 → S3 → S5                        |
| O   | `/character/{id}`               | 角色 identity、出演、CV、评论                              | relation/collect auth                                | S1 → S3 → S5                        |
| P   | `/user/{name}`                  | profile、stats、公开 activity 入口                         | public/private、登录视图                             | S1 → S3 → S5                        |
| Q   | `/user/{name}/collections`      | 用户作品/角色/人物收藏                                     | username scope、分页、权限                           | S1 → S3 → S5                        |
| R   | `/index`                        | 目录 discovery、更新时间、作者、条目数                     | 排序/分页                                            | S1/S3 → S5                          |
| S   | `/index/{id}`                   | 专题内容、关联 subject、评论                               | public/private、分页                                 | S1/S3 → S5                          |
| T   | `/group`                        | 小组列表、成员/主题活动                                    | sort/mode、auth                                      | S3 → S5                             |
| U   | `/group/{name}/topic`           | group topics/replies、时间、作者                           | 分页、写入需 auth                                    | S3 → S5                             |
| V   | `/rakuen/topiclist*`            | 全站/分类 topic activity                                   | filter、分页、HTML聚合口径                           | S3 topics → S5                      |
| W   | `/wiki`                         | wiki 最近变更、subject/person 入口                         | revision window、分页                                | S3 → S1 → S5                        |
| X   | `/subject/{id}/edit`            | 编辑表单/可编辑字段                                        | 必须登录/权限；本研究不提交                          | S3 read metadata → S5；禁止写       |
| Y   | `/subject/{id}/revision`        | 修订记录、差异、时间                                       | 分页/权限/HTML                                       | S3 wiki history → S5                |
| Z   | discovery/ranking/season routes | 趋势、评分/收藏排序、季度 cohort                           | sort/filter 语义与 sample size                       | S1 → S3 → S5                        |

## 页面层与数据层的边界

**FACT**：旧 `/calendar` 是 server-rendered HTML；`next.bgm.tv` 多数入口返回约 693-byte SPA shell，数据由 `/p1` 获取。

**EVIDENCE**：[`bgm.tv/calendar`](https://bgm.tv/calendar)、[`next.bgm.tv`](https://next.bgm.tv/)、官方 [`frontend/packages/client/api.yaml`](https://github.com/bangumi/frontend/blob/master/packages/client/api.yaml)。

**REASONING**：不能用“页面存在”证明“有稳定结构化 endpoint”，也不能用“p1 有 endpoint”证明旧页面所有字段都由同一接口生成。每个页面建议保留 `pageSurface` 与 `dataSource` 两个字段。

**CONFIDENCE**：HIGH（页面/源码/endpoint 均可观察）；具体后端 join 的置信度 MEDIUM。

**ALTERNATIVES**：旧站 HTML 可能由另一个服务层组合数据；frontend schema 可能包含尚未被当前页面调用的 endpoints。

**IMPLEMENTATION IMPLICATION**：Provider 以 capability 为边界，不以 URL 页面为边界；S5 HTML parser 只 allowlist 研究过的页面，S3 adapter 只 allowlist 已验证 GET。
