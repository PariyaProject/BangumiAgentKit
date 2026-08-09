# PR-7A2 Official Bangumi API Family Map

审计日期：2026-08-09（Asia/Tokyo）
冻结基线：`9fc2d3dc2aedf40a9a2bc64f0e31577c52ddbe98`
范围：官方 v0 OpenAPI、官方 legacy OpenAPI、生成的官方 API 文档、legacy API 的官方 git 历史，以及 Calendar 证据。本文是研究记录，不实现 Provider、HTML parser 或 PR-7B。

## 结论摘要

| API family       | Contract source                                                                                                                                                                                          | 当前文档化 operation 数 | 结论                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------: | ---------------------------------------------------------------------------------------- |
| Official v0      | [`bangumi/api/open-api/v0.yaml`](https://raw.githubusercontent.com/bangumi/api/master/open-api/v0.yaml)；该文件由 [`bangumi/server`](https://github.com/bangumi/server/blob/master/openapi/v0.yaml) 同步 |                  **55** | 当前主 API family；包含读操作和需授权的收藏/目录写操作                                   |
| Official legacy  | [`bangumi/api/open-api/api.yml`](https://raw.githubusercontent.com/bangumi/api/master/open-api/api.yml)                                                                                                  |                   **1** | 目前仍有官方合同的是 `GET /calendar`                                                     |
| 官方生成文档合计 | [`bangumi.github.io/api/dist.json`](https://bangumi.github.io/api/dist.json)                                                                                                                             |                  **56** | `1 legacy + 55 v0`；不是 56 个 v0 operation                                              |
| legacy 历史峰值  | 2018–2022 期间的 [`api.yml`](https://github.com/bangumi/api/blob/c4e53dff354ced0af57cd68c0be931814ca46be2/open-api/api.yml)                                                                              |                  **14** | 13 个后来从当前 `api.yml` 移除；其中部分旧路由在本次只读探测中仍响应，但没有当前官方合同 |

**最终判断：** future BangumiAgentKit 应按 **B：Official API + legacy wrapper + analytics** 建模；不应把“`api.bgm.tv` 某个旧路径仍返回 JSON”当成当前支持合同。Calendar 的官方 source-of-truth 是 legacy `GET /calendar`；条目详情再由 v0 hydration 补齐。

---

## 1. 审计方法与证据等级

### FACT

本次计数将 OpenAPI `paths` 下的每个 HTTP method 视为一个 operation；不把 schema、参数或 `operationId` 重复计数。对本地 pinned v0、官方仓库当前文件和官方生成 `dist.json` 分别解析后再比较。

### EVIDENCE

- 本地基线文件：[`openapi/upstream/v0.yaml`](../../../openapi/upstream/v0.yaml)，在基线 commit 中解析得到 46 个 path、55 个 method/path operation；SHA-256 为 `5a7ddb7ddec132293b1aa08102e6ac63e31b2925574658e927d6f931df2519da`。
- 官方 `bangumi/api` README 明确说明：[`open-api/v0.yaml` 从 `bangumi/server` 同步](https://github.com/bangumi/api/blob/master/README.md)。因此 server 的 v0 OpenAPI 是解释性的一手来源，而 `bangumi/api` 文件是 API 文档入口。
- 当前官方 legacy 文件的 server 是 `https://api.bgm.tv`，只定义 `/calendar`；当前文件没有 `deprecated: true`。[`api.yml`](https://github.com/bangumi/api/blob/master/open-api/api.yml)
- 官方生成文档的 [`dist.json`](https://bangumi.github.io/api/dist.json) 的 `info.version` 为 `2026-07-24`，包含 `/calendar` 和 55 个 `/v0/...` operation，共 56 个。

### REASONING

`v0.yaml` 的 55 是 v0 family 的精确计数；`api.yml` 的 1 是当前 legacy family 的精确计数；生成文档的 56 是 combined public OpenAPI surface。三者回答的是不同问题，不能用 combined count 代替 v0 count。

### CONFIDENCE

**HIGH（E1：官方 OpenAPI contract；E2：官方 repository/source）。** 计数不依赖页面视觉或旧博客。

### ALTERNATIVES

- 若只数 `operationId`，当前结果仍是 55/1，但会掩盖无 `operationId` 的历史文件，因此本文统一使用 method/path。
- 若把所有 `/v0/*` 与 `/calendar` 视为单一版本，无法解释官方生成文档为何把 Calendar 放在根路径，也会丢失 legacy schema 的兼容性边界。

### IMPLEMENTATION IMPLICATION

未来注册表应至少保留 `family: v0 | legacy`、`contractUrl`、`contractRevision/retrievedAt` 和 `supportStatus`。不要仅根据 URL 前缀推断版本，也不要把历史路由重新加入当前 operation registry。

---

## 2. Official v0 family map（55 operations）

### FACT

基线 v0 的 55 个 operation 按官方 tag 分组如下；括号内为 method/path operation 数。方法计数为 `GET 37 / POST 9 / PUT 3 / PATCH 2 / DELETE 4`。

| Family/tag | Count | Operations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 条目       |     7 | `POST /v0/search/subjects` (`searchSubjects`); `GET /v0/subjects` (`getSubjects`); `GET /v0/subjects/{subject_id}` (`getSubjectById`); `GET /v0/subjects/{subject_id}/image` (`getSubjectImageById`); `GET /v0/subjects/{subject_id}/persons` (`getRelatedPersonsBySubjectId`); `GET /v0/subjects/{subject_id}/characters` (`getRelatedCharactersBySubjectId`); `GET /v0/subjects/{subject_id}/subjects` (`getRelatedSubjectsBySubjectId`)                                                                                                                                                                                                                                                                       |
| 角色       |     7 | `POST /v0/search/characters` (`searchCharacters`); `GET /v0/characters/{character_id}` (`getCharacterById`); `GET /v0/characters/{character_id}/image` (`getCharacterImageById`); `GET /v0/characters/{character_id}/subjects` (`getRelatedSubjectsByCharacterId`); `GET /v0/characters/{character_id}/persons` (`getRelatedPersonsByCharacterId`); `POST /v0/characters/{character_id}/collect` (`collectCharacterByCharacterIdAndUserId`); `DELETE /v0/characters/{character_id}/collect` (`uncollectCharacterByCharacterIdAndUserId`)                                                                                                                                                                         |
| 人物       |     7 | `POST /v0/search/persons` (`searchPersons`); `GET /v0/persons/{person_id}` (`getPersonById`); `GET /v0/persons/{person_id}/image` (`getPersonImageById`); `GET /v0/persons/{person_id}/subjects` (`getRelatedSubjectsByPersonId`); `GET /v0/persons/{person_id}/characters` (`getRelatedCharactersByPersonId`); `POST /v0/persons/{person_id}/collect` (`collectPersonByPersonIdAndUserId`); `DELETE /v0/persons/{person_id}/collect` (`uncollectPersonByPersonIdAndUserId`)                                                                                                                                                                                                                                     |
| 章节       |     2 | `GET /v0/episodes` (`getEpisodes`); `GET /v0/episodes/{episode_id}` (`getEpisodeById`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 用户       |     3 | `GET /v0/users/{username}` (`getUserByName`); `GET /v0/users/{username}/avatar` (`getUserAvatarByName`); `GET /v0/me` (`getMyself`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 收藏       |    12 | `GET /v0/users/{username}/collections` (`getUserCollectionsByUsername`); `GET /v0/users/{username}/collections/{subject_id}` (`getUserCollection`); `POST /v0/users/-/collections/{subject_id}` (`postUserCollection`); `PATCH /v0/users/-/collections/{subject_id}` (`patchUserCollection`); `GET /v0/users/-/collections/{subject_id}/episodes` (`getUserSubjectEpisodeCollection`); `PATCH /v0/users/-/collections/{subject_id}/episodes` (`patchUserSubjectEpisodeCollection`); `GET /v0/users/-/collections/-/episodes/{episode_id}` (`getUserEpisodeCollection`); `PUT /v0/users/-/collections/-/episodes/{episode_id}` (`putUserEpisodeCollection`); 角色收藏 list/detail 两个；人物收藏 list/detail 两个 |
| 编辑历史   |     8 | 人物、角色、条目、章节各有 list/detail：`GET /v0/revisions/{persons                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | characters | subjects | episodes}`与`GET /v0/revisions/{family}/{revision_id}` |
| 目录       |     9 | `POST /v0/indices` (`newIndex`); `GET /v0/indices/{index_id}` (`getIndexById`); `PUT /v0/indices/{index_id}` (`editIndexById`); `GET /v0/indices/{index_id}/subjects` (`getIndexSubjectsByIndexId`); 目录条目 POST/PUT/DELETE 三个；目录收藏 POST/DELETE 两个                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### EVIDENCE

- 本地 pinned file 与官方当前 [`v0.yaml`](https://github.com/bangumi/api/blob/master/open-api/v0.yaml) 的 operation 列表均为 55。
- 当前 server 的 [`web/routes.go`](https://github.com/bangumi/server/blob/master/web/routes.go) 明确注册 `/v0/search/*`、subject/person/character/episode/user/index/revision 路由；它没有在 v0 router 中注册 `/calendar`。

### REASONING

v0 是现在应优先实现和校验的官方 family：其 schema、auth/security、cache description、读写风险和 v0 path 都有合同。它覆盖 subject/person/character/episode/user/collection/index/revision，但不是完整的 Bangumi 网站表面。

### CONFIDENCE

**HIGH（E1/E2）。** 具体字段仍应以 pinned commit 的文件为准；官方 master 可能继续演进。

### ALTERNATIVES

不能把 legacy 旧的 medium/large subject response 当作 v0 的隐式扩展。v0 的 `Subject`、`SlimSubject`、related schemas 与旧 `Legacy_Subject*` 是不同 contract。

### IMPLEMENTATION IMPLICATION

现有 AgentKit 的 operation registry 可以继续以 v0 为主，但需要显式加入 `getCalendar` 到 legacy family，而不是伪造 `/v0/calendar`。v0 operation 的 auth/write 风险保持独立，不能因为 legacy Calendar 是 read-only 就降低 v0 写操作的安全标记。

---

## 3. Current official legacy family

### FACT

当前官方 `api.yml` 只有一个 operation：

| Method | Path        | operationId   | Contract response                                                |
| ------ | ----------- | ------------- | ---------------------------------------------------------------- |
| `GET`  | `/calendar` | `getCalendar` | JSON array of weekday groups; each item is `Legacy_SubjectSmall` |

文件声明 server 为 `https://api.bgm.tv`。operation 没有 query/path/body parameter，也没有 security requirement；这不是“匿名一定永远可用”的承诺，只表示当前 OpenAPI 没有声明授权条件。

### EVIDENCE

- 当前官方 [`api.yml`](https://raw.githubusercontent.com/bangumi/api/master/open-api/api.yml) 的 `paths` 只有 `/calendar`。
- 生成文档 [`dist.json`](https://bangumi.github.io/api/dist.json) 的第一条 path 是 `/calendar` / `getCalendar`，随后是 `/v0/...`；解析所有 method/path 得到 56。
- 官方生成 UI：[https://bangumi.github.io/api/](https://bangumi.github.io/api/)。
- 只读 live probe（2026-08-09，带识别性 User-Agent）：`GET https://api.bgm.tv/calendar` 返回 HTTP 200、`application/json; charset=utf-8`；`GET https://api.bgm.tv/v0/calendar` 返回 HTTP 404。探测没有执行任何 POST/PUT/PATCH/DELETE。

### REASONING

`/calendar` 是 current documented legacy endpoint，而不是 v0 endpoint。它仍然有官方 schema、官方生成文档和 live response 三重证据；`/v0/calendar` 同时没有 contract 且 live 404，不能作为等价路径。

### CONFIDENCE

**HIGH（E1 + E3）。** “当前 documented”由官方文件决定；live probe 只是本次时间点的补充证据。

### ALTERNATIVES

- **v0-only：** 不能重建 Calendar 的 weekday-group contract 和 today membership。
- **website-only：** 能得到用户看见的 HTML，但没有 legacy API 的字段 contract，且页面展示字段与 API schema 不完全相同。
- **所有 legacy 都 deprecated：** 当前 `api.yml` 对 `/calendar` 没有 `deprecated: true`，不能凭 family 名称臆测它已废弃。

### IMPLEMENTATION IMPLICATION

把 `/calendar` 注册为 `OfficialLegacyProvider.getCalendar`，保留原始 weekday/item schema 与来源；不要在 v0 provider 中添加未获官方合同支持的 `/v0/calendar`。

---

## 4. Legacy 历史：14 → 1

### FACT

历史 `api.yml` 的 operation 峰值为 14。官方 git history 显示，旧 API 是分阶段移除而非一次性消失：

| 时间       | 官方 commit                                                                                                                                                                                 | 变化                                                                                                                                       | operation count |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------: |
| 2018-06-05 | [`c4e53dff`](https://github.com/bangumi/api/commit/c4e53dff354ced0af57cd68c0be931814ca46be2)                                                                                                | 完整旧合同的可见快照：用户、条目、章节、Calendar、搜索、进度、收藏                                                                         |              14 |
| 2022-01-10 | [`6d5f3ed0`](https://github.com/bangumi/api/commit/6d5f3ed0f5cd109ba3b4b58db1b8c69fba90bb8f)                                                                                                | 移除 `GET /subject/{subject_id}` 与 `/subject/{subject_id}/ep`                                                                             |              12 |
| 2022-04-23 | [`25ea766a`](https://github.com/bangumi/api/commit/25ea766a2b25be33d0d3158d9c661c4e4f1ff237)                                                                                                | 移除 `GET /user/{username}`                                                                                                                |              11 |
| 2022-04-23 | [`6842de44`](https://github.com/bangumi/api/commit/6842de44723fe035babe7908ce57e20bad4bb444)                                                                                                | 移除 `GET /user/{username}/collection`                                                                                                     |              10 |
| 2022-05-12 | [`5d196b22`](https://github.com/bangumi/api/commit/5d196b229b14e18ebb5b18b11cfde88792375985)                                                                                                | 移除 `GET /user/{username}/collections/{subject_type}`                                                                                     |               9 |
| 2022-05-12 | [`8da01e33`](https://github.com/bangumi/api/commit/8da01e33f371030dd1e16222dbec7c59a5282daf)                                                                                                | 移除 `GET /collection/{subject_id}`                                                                                                        |               8 |
| 2022-05-12 | [`e02eef7d`](https://github.com/bangumi/api/commit/e02eef7da5a5006631df9e3c77ffb0a8d50da75e)                                                                                                | 移除 `GET /user/{username}/collections/status` 与 `/progress`                                                                              |               6 |
| 2022-09-04 | [`d316f213`](https://github.com/bangumi/api/commit/d316f213ab202b9b473aae63dc67c33e9622791a) / [`f9b48fd3`](https://github.com/bangumi/api/commit/f9b48fd3f0fb6a1f73ccc7de3d7fb308a4ce235f) | 标记 episode-status、batch watched-episodes、collection action 等旧写/进度 API deprecated；其中 batch endpoint 还给出 v0 patch replacement |               6 |
| 2022-09-04 | [`b8fbe142`](https://github.com/bangumi/api/commit/b8fbe1429600139593c601a3bcad5aed982cce15)                                                                                                | 从文档中移除两个 episode status、batch progress、collection action，共 4 个；同时将 legacy schema 命名为 `Legacy_*`                        |               2 |
| 2025-07-01 | [`9b4e4267`](https://github.com/bangumi/api/commit/9b4e4267c008218b51c275d640fab292637ca7ae)                                                                                                | 移除 `GET /search/subject/{keywords}`                                                                                                      |               1 |

当前唯一保留的是 `/calendar`。2024-01-30 的 [`f3f58228`](https://github.com/bangumi/api/commit/f3f582286a09996ef0afd4aae03b257f9d3d7d50) 快照仍有 Calendar + legacy search；因此 search 的 2025 移除是可定位的文档变更，不是计数推断。

### EVIDENCE

移除 commit 的 diff 直接显示被删的 path；例如 `9b4e4267` 删除 83 行的 `/search/subject/{keywords}`，`e02eef7` 删除 status/progress 两个 path，`b8fbe142` 的前后 schema/path 集合从 6 降到 2。早期旧 operation 的完整 path 集合是：

```text
GET    /user/{username}
GET    /user/{username}/collection
GET    /user/{username}/collections/{subject_type}
GET    /user/{username}/collections/status
GET    /user/{username}/progress
GET    /subject/{subject_id}
GET    /subject/{subject_id}/ep
GET    /calendar
GET    /search/subject/{keywords}
GET    /ep/{id}/status/{status}
POST   /ep/{id}/status/{status}
POST   /subject/{subject_id}/update/watched_eps
GET    /collection/{subject_id}
POST   /collection/{subject_id}/{action}
```

### REASONING

“removed from current `api.yml`”与“线上仍有旧 handler”是两个维度。历史 diff 证明这些路由不再是当前 documented contract；而 live probe 证明部分 GET 路径在 2026-08-09 仍返回 legacy-shaped JSON 或 auth/validation error。因此正确状态不能简单写成“全部已下线”。

### CONFIDENCE

- **HIGH（E1/E2）：** 当前文档是否仍包含 path、以及何时从官方文件删除。
- **MEDIUM–HIGH（E3）：** 本次 live status 仅覆盖少量只读 GET、一个时间点和一个公开测试参数；不代表 SLA、长期可用性或所有部署节点。
- **LOW（E6）**：未对旧写 endpoint 做 live POST probe，因为它会改变用户数据；不能从未探测推断 runtime 已删除。

### ALTERNATIVES

将“live 返回 200”当成支持合同会把偶然兼容、旧服务 fallback 和正式 API 混为一谈；将“文档删除”直接写成“runtime 404”又与本次 `/search`、`/subject`、`/user` 等观察冲突。本文保留两层状态。

### IMPLEMENTATION IMPLICATION

旧 endpoint 的建议状态如下。`UNCLEAR` 表示“本次 read-only probe 仍得到响应，但当前官方合同已移除”；它不是可依赖状态。`HISTORICAL_ONLY` 表示已从当前合同移除，且未有足够 live 证据证明可安全依赖。

| Historical method/path                            | Current contract status                          | Read-only observation on 2026-08-09                        | Safe replacement/stance                                       |
| ------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `GET /calendar`                                   | `CURRENT_DOCUMENTED`                             | HTTP 200 JSON                                              | 依赖 legacy contract；v0 hydration                            |
| `GET /search/subject/{keywords}`                  | `UNCLEAR`（undocumented）                        | `/search/subject/Bangumi` HTTP 200 legacy shape            | 不依赖；使用 v0 `POST /v0/search/subjects`                    |
| `GET /subject/{subject_id}`                       | `UNCLEAR`（undocumented）                        | `/subject/1` HTTP 200 legacy shape                         | 不依赖；使用 v0 `GET /v0/subjects/{subject_id}`               |
| `GET /subject/{subject_id}/ep`                    | `UNCLEAR`（undocumented）                        | `/subject/1/ep` HTTP 200 legacy shape                      | 不依赖；使用 v0 `GET /v0/episodes?subject_id=...`             |
| `GET /user/{username}`                            | `UNCLEAR`（undocumented）                        | `/user/roach` HTTP 200 legacy shape                        | 不依赖；使用 v0 `GET /v0/users/{username}`                    |
| `GET /user/{username}/collection`                 | `HISTORICAL_ONLY`                                | `/user/roach/collection` HTTP 200 envelope with `code:404` | 使用 v0 user collection endpoints                             |
| `GET /user/{username}/collections/{subject_type}` | `HISTORICAL_ONLY`（documented contract removed） | missing/invalid `app_id` 返回 legacy validation `code:404` | 不依赖；使用 v0 `GET /v0/users/{username}/collections`        |
| `GET /user/{username}/collections/status`         | `HISTORICAL_ONLY`（documented contract removed） | missing/invalid `app_id` 返回 legacy validation `code:404` | 不依赖；使用 v0 collection list/derived aggregation           |
| `GET /user/{username}/progress`                   | `UNCLEAR`（undocumented/auth-gated）             | `/user/roach/progress` HTTP 200 envelope with `code:401`   | 不依赖；使用 v0 episode collection operations                 |
| `GET /ep/{id}/status/{status}`                    | `UNCLEAR`（undocumented/auth-gated）             | `/ep/1/status/watched` HTTP 200 envelope with `code:401`   | 不依赖；使用 v0 episode collection operations                 |
| `POST /ep/{id}/status/{status}`                   | `HISTORICAL_ONLY`                                | 未探测；写操作有副作用                                     | 不探测、不依赖；使用 v0 `PUT/PATCH`                           |
| `POST /subject/{subject_id}/update/watched_eps`   | `HISTORICAL_ONLY`                                | 未探测；写操作有副作用                                     | 使用 v0 `PATCH /v0/users/-/collections/{subject_id}/episodes` |
| `GET /collection/{subject_id}`                    | `UNCLEAR`（undocumented/auth-gated）             | `/collection/1` HTTP 200 envelope with `code:401`          | 使用 v0 user-scoped collection read                           |
| `POST /collection/{subject_id}/{action}`          | `HISTORICAL_ONLY`                                | 未探测；写操作有副作用                                     | 使用 v0 `POST/PATCH /v0/users/-/collections/{subject_id}`     |

这里的“current but deprecated”只适用于历史快照中仍存在且显式标注 `deprecated: true` 的阶段；当前 `api.yml` 中的 `/calendar` 没有该标记。对于旧 GET 的运行时响应，使用 `UNCLEAR` 而不是擅自升级为 `CURRENT_BUT_DEPRECATED`。

---

## 5. Calendar deep evidence

### FACT

#### 5.1 Website surface

官方网页 [`https://bgm.tv/calendar`](https://bgm.tv/calendar) 在本次未登录 HTML 观察中存在，页面标题为“每日放送”。页面显示：

- 顶部当前季度番组数、今日上映数、今日番组收看人数；这些是网页 header 字段，不在 legacy `/calendar` 的 OpenAPI item schema 中。
- 当前日期和星期标题。
- 星期日到星期六的分组，每组包含条目链接、封面背景图、中文标题（若有）和原名。
- 观察到的是服务端 HTML：条目 id 出现在 `/subject/{id}` 链接，封面 URL 以内联 CSS background-image 形式出现；未把页面视觉字段当作 v0 contract。
- 未登录页面没有看到当前用户的 per-subject collection/progress 控件；已登录 cookie 行为本次没有复制或探测。
- 页面没有分页控件；展示的是当前季度的星期分组。精确数量是动态值，不应写入测试 fixture。

#### 5.2 Official legacy response

[`GET https://api.bgm.tv/calendar`](https://api.bgm.tv/calendar) 的官方 schema 是数组：

| Level                             | Fields                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| root item                         | `weekday`, `items`                                                                                                                         |
| `weekday`                         | `en`, `cn`, `ja`, `id`                                                                                                                     |
| `items[]` (`Legacy_SubjectSmall`) | `id`, `url`, `type`, `name`, `name_cn`, `summary`, `air_date`, `air_weekday`, `images`, `eps`, `eps_count`, `rating`, `rank`, `collection` |
| `images`                          | `large`, `common`, `medium`, `small`, `grid`                                                                                               |
| `rating`                          | `total`, `count`（1–10 分桶）, `score`                                                                                                     |
| `collection`                      | `wish`, `collect`, `doing`, `on_hold`, `dropped`                                                                                           |

只读 live response 在 2026-08-09 观察到 7 个 weekday groups、115 个 item；这只是动态样本。样本 item 的 union keys 为 `id,url,type,name,name_cn,summary,air_date,air_weekday,rating,rank,images,collection`，optional 的 `eps/eps_count` 在样本中没有出现。Schema 字段与当前响应的可选性必须同时保留。

#### 5.3 v0 differential

官方 [`v0.yaml`](https://raw.githubusercontent.com/bangumi/api/master/open-api/v0.yaml) 没有 `/calendar` path。可相关但不等价的 v0 operations 是：

- `GET /v0/subjects`：按 `type/cat/series/platform/sort/year/month` 浏览，返回分页 subject 数据；没有 legacy weekday-group contract。
- `GET /v0/subjects/{subject_id}`：可补充当前 canonical subject metadata、images、date、episodes、rating、collection 等；不能从单个 subject detail 重建“今天上映人数/收看人数”。
- `GET /v0/episodes?subject_id=...`：可提供 episode airdate，但需要先有 subject 集合，不能替代 Calendar membership。

直接请求 [`https://api.bgm.tv/v0/calendar`](https://api.bgm.tv/v0/calendar) 在本次 probe 返回 HTTP 404，进一步确认没有同路径 v0 contract。

### EVIDENCE

- Calendar legacy contract：[`api.yml`](https://github.com/bangumi/api/blob/master/open-api/api.yml) 的 `/calendar` 与 `Legacy_SubjectSmall`。
- 官方生成文档：[`dist.json`](https://bangumi.github.io/api/dist.json) 的 `/calendar` path。
- Website HTML：[`bgm.tv/calendar`](https://bgm.tv/calendar)，检索日期 2026-08-09。
- Official current v0 route source：[`bangumi/server/web/routes.go`](https://github.com/bangumi/server/blob/master/web/routes.go) 的 v0 route registration；Calendar 不在其 v0 route list。
- API service read-only observations：`GET /calendar` = 200 JSON；`GET /v0/calendar` = 404 JSON。

### REASONING

Calendar membership、weekday、subject small payload 的最强来源是 legacy contract；subject 深度字段的最强来源是 v0。网页顶部的“当前季度总数/今日收看人数”超出 legacy schema，且本次没有官方 source code 或 documented structured endpoint 证明其取值链，因此应标记为 website-observed、provenance unresolved，而不是强行声称由 legacy API 返回。

### CONFIDENCE

- **HIGH（E1/E3）：** Calendar 存在于 website、legacy `api.yml`、生成文档和 live endpoint；不在 v0。
- **HIGH（E1）：** legacy 字段 schema。
- **MEDIUM（E4/E6）：** 网页额外 header 字段及 HTML→backend 的具体数据来源；页面观察证明展示，不证明内部调用链。
- **LOW–MEDIUM：** 未登录与已登录页面可能有差异；本次不复制 cookie，也不假设 auth effect。

### ALTERNATIVES

| Option                     | 优点                                                             | 失败点                                                    | 结论                  |
| -------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- | --------------------- |
| `LEGACY_ONLY`              | 合同最直接；有 weekday grouping                                  | 缺少 v0 canonical hydration；不能稳定表达网页 header      | 不作为完整产品方案    |
| `LEGACY_PLUS_V0_HYDRATION` | membership/weekday 用 legacy，subject fields 用 v0；来源分工清晰 | 多一次请求与 merge；要处理 field provenance               | **推荐**              |
| `LEGACY_PLUS_WEBSITE`      | 可补网站 header 与显示语义                                       | HTML/source chain 无合同，解析和登录差异风险              | 仅作为可选 supplement |
| `WEBSITE_STRUCTURED`       | 可能较新、数据丰富                                               | 本次未找到公开、稳定、官方 documented structured endpoint | 不采用为基线          |
| `HTML_REQUIRED`            | 能复现用户看见的网页                                             | 对 Calendar 核心 membership 来说没有必要，成本/脆弱性更高 | 不采用为核心 provider |

### IMPLEMENTATION IMPLICATION

推荐 future provider contract：

```text
OfficialLegacyProvider.getCalendar()
  -> calendar membership + weekday + Legacy_SubjectSmall + source=official-legacy
  -> optional V0Provider.getSubject(subject_id)
  -> merge only fields with explicit provenance
  -> optional website supplement for header-only fields
```

合并规则：legacy 决定“属于哪个 weekday/calendar snapshot”；v0 决定 canonical subject detail；website 只能填充明确标注 `website_html_observed` 的补充字段，不能覆盖 API 的 core field。若 header-only 字段无法获得，应返回 `unavailable`，不能伪造“今日收看人数”。

---

## 6. Source-of-truth 与历史 API 使用政策

### FACT

官方历史 diff 显示旧 API 的 replacement 方向已经在 v0 文档中出现，例如 batch watched-episodes 旧 endpoint 明确建议使用 `patchUserSubjectEpisodeCollection`；当前 server source 也只注册 v0 router。

### EVIDENCE

- [`f9b48fd3`](https://github.com/bangumi/api/commit/f9b48fd3f0fb6a1f73ccc7de3d7fb308a4ce235f) 将 batch watched-episodes 标成 deprecated，并给出 v0 patch replacement。
- [`bangumi/server/web/routes.go`](https://github.com/bangumi/server/blob/master/web/routes.go) 当前注册的 public API 是 `/v0/...` family。
- 官方 API README 的同步说明：[`bangumi/api/README.md`](https://github.com/bangumi/api/blob/master/README.md)。

### REASONING

“官方 legacy”需要拆成两类：

1. **Current documented legacy：** 只有 `GET /calendar`，可以作为明确的只读 provider contract。
2. **Historical runtime-compatible paths：** 旧路径可能仍被后端兼容层响应，但已不在 current `api.yml`；没有版本、SLA、schema 变更保证，不可作为生产依赖。

### CONFIDENCE

**HIGH** for source-of-truth policy; **MEDIUM** for any individual old runtime route because the probe is time-bounded and deliberately avoids writes.

### ALTERNATIVES

如果未来需要研究旧 GET 的兼容性，应把它放在单独的 compatibility experiment，记录 status/content-type/body schema/date，并默认关闭。不能因为一次 HTTP 200 就把 `supportStatus` 改为 current。

### IMPLEMENTATION IMPLICATION

建议的 provider taxonomy（设计，不在本 PR 实现）：

```text
OfficialApiProvider
├── V0Provider       # 55 current documented operations
└── LegacyProvider   # 1 current documented operation: GET /calendar

WebsiteProvider     # separate research decision; not part of this file's count
SnapshotProvider    # historical/velocity data
DerivedProvider     # relation/analytics calculations
```

每个结果应携带：`sourceFamily`、`sourceUrl`、`contractStatus`、`retrievedAt`、`confidence`、`derived` 和 `limitations`。任何 historical-only/unclear path 都应在 registry 中拒绝或显式 opt-in，而不是 silent fallback。

---

## 7. Final answer to the family question

### FACT

当前官方公开、可定位的 OpenAPI surface 是：55 个 v0 operation + 1 个 legacy Calendar operation。Website HTML 展示了更多产品字段，但这不增加官方 OpenAPI operation count。

### EVIDENCE

计数和 Calendar 证据分别来自 pinned/local v0、官方 `api.yml`、官方生成 `dist.json`、官方仓库历史和 live read-only probes，见本文各节的 direct links。

### REASONING

因此未来 BangumiAgentKit 不是单纯的 v0-only wrapper；同时也没有证据支持把全部旧 API 或网站 HTML 混入官方 API family。最小正确架构是 **官方 v0 + 官方 current legacy + derived analytics**，网站/HTML 以后按 capability 单独决策。

### CONFIDENCE

**HIGH** for the family count and Calendar classification. Website extra header provenance remains explicitly **MEDIUM/UNRESOLVED** and must not be silently promoted.

### ALTERNATIVES

若 PR-7B 的产品目标要求“完全复刻网页 Calendar header”，再单独评估 `Legacy + Website supplement`；这不会改变官方 family count，也不应提前实现 HTML provider。

### IMPLEMENTATION IMPLICATION

本文件的唯一 actionable conclusion 是：在后续设计中保留 v0/legacy family seam，Calendar 走 legacy-first + v0 hydration，历史旧 endpoint 不进入当前 contract。PR-7A2 research side task 到此为止，不实现下一阶段功能。
