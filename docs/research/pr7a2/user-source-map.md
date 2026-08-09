# User-data source map

## 分类结论

用户资料/公开收藏不是单一来源：S1 v0 覆盖官方公开用户和授权 collection/episode 能力；S3 p1 暴露新版 profile、collections、timeline、blogs、groups、friends 等更宽 surface；S5 仍可观察网页编排。任何“我的”数据都必须先确定 auth scope，再决定是否可缓存/渲染。

**FACT**：无 cookie 的 `GET /p1/users/roach`、`/collections/subjects`、`/timeline`、`/blogs`、`/groups` 曾返回 200；private schema 对多项 endpoint 声明 `CookiesSession`/`HTTPBearer`。

**EVIDENCE**：官方 [`frontend/packages/client/api.yaml`](https://github.com/bangumi/frontend/blob/master/packages/client/api.yaml)、[`bgm.tv/user/roach`](https://bgm.tv/user/roach)、v0 [`open-api/v0.yaml`](https://raw.githubusercontent.com/bangumi/api/master/open-api/v0.yaml)。

**REASONING**：public sample 只证明该用户名的当前可见读面；不能证明所有用户、私密收藏、NSFW 或当前用户 endpoint 无 auth。S3 不能进入公共缓存默认路径。

**CONFIDENCE**：公开 profile/collection shape HIGH；auth/privacy 边界 MEDIUM，需要真实授权矩阵。

**ALTERNATIVES**：站点可能根据用户隐私、封锁、登录和 NSFW 策略返回不同字段；网页显示统计不一定等于 API 字段。

**IMPLEMENTATION IMPLICATION**：UserProvider 的结果和 cache key 必须包含 `authScope`, username, visibility；private result 不进入共享 snapshot，不写日志/PNG metadata；未授权返回 `AUTH_REQUIRED` 而不是 HTML fallback。

## 字段矩阵

| 用户数据                                  | S1 v0                                     | S3 p1                                        | S5 HTML                 | S6/S7                               |
| ----------------------------------------- | ----------------------------------------- | -------------------------------------------- | ----------------------- | ----------------------------------- |
| public profile / nickname / avatar / sign | v0 user detail                            | `/users/{username}` 含 stats/network/site 等 | profile 页面            | identity normalization              |
| public subject collections                | user collections operations               | `/users/{username}/collections/subjects`     | collection list         | tags/type aggregation               |
| current user episode progress             | authenticated v0 user episode collections | p1 `/collections/episodes/{id}`/user paths   | 只作为展示面            | remaining/completion calculation    |
| subject state/rating/comment              | v0 collection model                       | p1 collection model                          | profile/list page       | taste aggregation                   |
| timeline/activity                         | 不作为完整公开 activity contract          | `/users/{username}/timeline`                 | user activity/blog入口  | snapshot velocity                   |
| blogs                                     | legacy schemas/部分 v0 surface            | `/users/{username}/blogs`                    | blog pages              | topic/entity extraction，需政策审查 |
| groups/friends/followers                  | 部分 v0 relationship                      | p1 user/group/social endpoints               | group/user页面          | graph metrics，谨慎隐私             |
| collection history                        | 当前接口不等于历史事件流                  | timeline 也不保证完整 transitions            | page 不保证完整 history | **S6 required**；缺快照不可计算     |
| registration-year demographic stats       | 未验证公开聚合                            | 未验证                                       | 未验证                  | **S8**，不得猜测                    |

## 私有边界

三种结果必须分开：

1. `PUBLIC_USER_DATA`：目标用户明确公开且 endpoint 返回可见字段。
2. `AUTHENTICATED_USER_DATA`：带用户授权，只能在该 auth scope 内使用。
3. `NOT_AVAILABLE`：无授权、私密、字段未验证或历史不可得。

“我的本周计划”“我的未完成集数”属于第二类；不能用公开用户名 endpoint 猜测当前用户数据。Collection 的 `updated_at`（若源返回）也不是完整的状态变更历史。
