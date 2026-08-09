# Website structured endpoints（S3）审计

## 结论

**FACT**：官方 `bangumi/frontend` 当前 client package 维护一份标题为 `bangumi private api` 的 OpenAPI；动态 `https://next.bgm.tv/p1/openapi.json` 在研究时点返回 **155 paths / 201 operations**，并由 frontend 的 generated client 调用 `/p1/*`。

**EVIDENCE**：[`packages/client/api.yaml`](https://github.com/bangumi/frontend/blob/master/packages/client/api.yaml)、[`client.ts`](https://github.com/bangumi/frontend/blob/master/packages/client/client.ts)、[`packages/client/readme.md`](https://raw.githubusercontent.com/bangumi/frontend/master/packages/client/readme.md)（描述为 private api）、[`next.bgm.tv/p1/openapi.json`](https://next.bgm.tv/p1/openapi.json)。`getCalendar()` 明确调用 `/p1/calendar`。

**REASONING**：这证明网页存在真实、广泛、结构化的数据面，不再支持 PR-7A 中“社区只能从 HTML 侦察”的笼统表述；但 private API 的官方身份、认证 schema、无缓存 header 和 live/schema 偏差又不支持把它升级为 PUBLIC_V0/S2。

**CONFIDENCE**：HIGH（来源是官方组织 repo 和 live schema）；长期稳定性为 LOW–MEDIUM。

**ALTERNATIVES**：`next.bgm.tv` 可能只是新版 frontend 的部署面；旧 `bgm.tv` HTML 仍是独立 legacy website。两者不应假定数据同步或相同 cache。

**IMPLEMENTATION IMPLICATION**：PR-7B 前先建立 `StructuredWebProvider` 的隔离研究接口和 contract probes，不把 `/p1` operation 生成进现有官方 v0 registry；默认优先 S1/S2，S3 必须显式 opt-in、限速和可撤销。

## 已验证的 public GET surface

| 领域             | 代表 endpoint                                                                          | live 观察                                      | schema/政策注意                                                                          |
| ---------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Calendar         | `/p1/calendar`                                                                         | 7 个 weekday key，`subject` + `watchers`       | `Calendar` 与 S2 字段/计数不同                                                           |
| Subject          | `/p1/subjects/{id}`                                                                    | detail、rating、collection、infobox、images 等 | 不等于 v0 detail 的字段命名                                                              |
| Subject graph    | `/characters`、`/staffs/persons`、`/staffs/positions`、`/relations`                    | `{data,total}` 分页结构                        | role/position/offprint 等 query 需保留                                                   |
| Content          | `/episodes`、`/comments`、`/reviews`、`/topics`、`/indexes`、`/recs`、`/collects`      | 均可观察到 JSON 数据面                         | 正文/用户隐私/分页 coverage 需隔离                                                       |
| Person/character | `/persons/{id}`、`/works`、`/casts`、`/relations`、`/comments`；角色对应 endpoints     | detail/关系/作品可读                           | person comments 样本返回 raw array，和 `{data,total}` schema pattern 不一致              |
| User             | `/users/{username}`、`/collections/subjects`、`/timeline`、`/blogs`、`/groups`         | public profile/collection/activity 可读        | OpenAPI 带 CookiesSession/HTTPBearer；无 cookie 200 不代表全部场景公开                   |
| Community        | `/subjects/-/topics`、subject comments/reviews、`/groups/-/topics`、group topics/posts | 结构化 topic/reply/group surface               | 需要 public/auth boundary 和正文再分发政策                                               |
| Discovery        | `/trending/subjects`、`/trending/subjects/topics`、subject search/browse paths         | trending/query 可用，缺 required query 会 400  | `type`/`sort`/`mode` 等必填参数必须按 schema/实测双重校验                                |
| Wiki/index       | `/indexes/{id}`、`/wiki/recent/subjects`、revision/history paths                       | index 与 wiki recent 可读                      | `wiki/recent/subjects` schema 将 `since` 声明成 path 参数，但 live no-param 也能返回 200 |

## Live/schema 不一致清单

1. `/p1/persons/{id}/comments` 的样本响应是 raw array，而相邻分页 endpoint 通常是 `{data,total}`。
2. `/p1/groups` schema 将 `sort` 标为 required；live 缺 sort 的请求曾返回 200。`/p1/groups/-/topics` 缺 `mode` 则返回 400。
3. `/p1/wiki/recent/subjects` schema 的 `since` path parameter 与实际无 `{since}` path 不一致。
4. `/p1/trending/subjects` 缺 `type` 返回 400，说明 schema 声明的 query constraint 需要在 adapter 层显式验证。

这些不是错误修复目标，而是 S3 contract probe 的测试样本。Provider 遇到 shape mismatch 应停止该 endpoint、保留 diagnostic、走明确 fallback，而不是宽松猜测。

## HTTP/认证/运营观察

| 属性             | 观察                                                                                | 结论                                                      |
| ---------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Host             | `/p1` 在 `next.bgm.tv` 可用；`bgm.tv/p1/openapi.json` 为 404                        | host 必须配置化，不能硬编码旧站点                         |
| Content          | GET 多返回 JSON                                                                     | 适合结构化 adapter，但不是公共 SLA                        |
| Auth declaration | schema 多数 GET 带 `CookiesSession`/`HTTPBearer` security                           | 未登录可读样本不代表用户/NSFW/私有内容边界已知            |
| CORS/cache       | 观察到 p1 无 CORS、Cache-Control、ETag/Last-Modified；legacy/v0 有更明确缓存 header | 不在浏览器跨域假设下设计；自建短缓存并标 fresh/stale      |
| Writes           | schema 含大量 POST/PUT/PATCH/DELETE                                                 | 本研究只做 GET；未来 Provider 默认禁止写操作              |
| Terms/privacy    | 未形成法律结论                                                                      | 进入实现前需单独 review，不抓 private/auth 内容到公共缓存 |

## S3 的最终地位

S3 对“网站当前数据面”是 **已验证事实**，对“AgentKit 的默认公共数据合同”是 **未批准依赖**。建议名称同时保留两层：

- 实际观测标签：`WEBSITE_STRUCTURED_PUBLIC_READ`（无 cookie 的已验证 GET）。
- 政策/Provider 标签：`INTERNAL_STRUCTURED`（官方 frontend private API，不进 v0/legacy 合同）。

这样既不会否认研究发现，也不会让下游把私有接口包装成官方公开 API。
