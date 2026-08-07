# Bangumi API 覆盖与生成策略

## 1. OpenAPI 覆盖状态 (动态计算基线)

- **设计基准**：Bangumi API (v0) + 旧版 `/calendar`
- **Metadata Coverage**: 56/56 Operations (100% 元数据注册)
- **Path Resolution Coverage**: 56/56 Operations (100% 路径占位符解析验证)
- **Request Contract Coverage**: 56/56 Operations (100% 经过 HTTP Method、参数编码、Body JSON 序列化验证)
- **Response Contract Coverage**: 56/56 Operations (100% 经过 HTTP 200/204/302/Error 状态及 JSON 解析断言验证)

### 操作分类统计 (56 Total)
- **条目 (7)**: `searchSubjects`, `getSubjects`, `getSubjectById`, `getSubjectImageById`, `getRelatedPersonsBySubjectId`, `getRelatedCharactersBySubjectId`, `getRelatedSubjectsBySubjectId`
- **章节 (2)**: `getEpisodes`, `getEpisodeById`
- **角色 (7)**: `searchCharacters`, `getCharacterById`, `getCharacterImageById`, `getRelatedSubjectsByCharacterId`, `getRelatedPersonsByCharacterId`, `collectCharacterByCharacterIdAndUserId`, `uncollectCharacterByCharacterIdAndUserId`
- **人物 (7)**: `searchPersons`, `getPersonById`, `getPersonImageById`, `getRelatedSubjectsByPersonId`, `getRelatedCharactersByPersonId`, `collectPersonByPersonIdAndUserId`, `uncollectPersonByPersonIdAndUserId`
- **用户 (3)**: `getUserByName`, `getUserAvatarByName`, `getMyself`
- **收藏 (12)**: `getUserCollectionsByUsername`, `getUserCollection`, `postUserCollection`, `patchUserCollection`, `getUserSubjectEpisodeCollection`, `patchUserSubjectEpisodeCollection`, `getUserEpisodeCollection`, `putUserEpisodeCollection`, `getUserCharacterCollections`, `getUserCharacterCollection`, `getUserPersonCollections`, `getUserPersonCollection`
- **编辑历史 (8)**: `getPersonRevisions`, `getPersonRevisionByRevisionId`, `getCharacterRevisions`, `getCharacterRevisionByRevisionId`, `getSubjectRevisions`, `getSubjectRevisionByRevisionId`, `getEpisodeRevisions`, `getEpisodeRevisionByRevisionId`
- **目录 (9)**: `newIndex`, `getIndexById`, `editIndexById`, `getIndexSubjectsByIndexId`, `addSubjectToIndexByIndexId`, `editIndexSubjectsByIndexIdAndSubjectID`, `delelteSubjectFromIndexByIndexIdAndSubjectID`, `collectIndexByIndexIdAndUserId`, `uncollectIndexByIndexIdAndUserId`
- **旧版每日放送 (1)**: `getCalendar`

---

## 2. 代码生成与 Transport 架构

- **唯一 Transport 机制**: 所有 OpenAPI 请求与 Legacy Calendar 请求均统一经过 `packages/bangumi-transport` 中的 `HttpClient`，由其统一下发 Timeout、Retry、Cache、User-Agent、Authorization 注入、204/302 处理以及 `BangumiError` 封装。
- **OpenAPI Spec Pinning 策略**: 项目构建与 CI 校验固定基于仓库内 `openapi/upstream/v0.yaml` 镜像。更新 upstream spec 必须通过独立 PR 进行。
- **生成与校验命令**:
  - `pnpm openapi:validate`: 校验本地固定 OpenAPI Spec
  - `pnpm openapi:fetch`: 从 Bangumi 官方 upstream 拉取最新 Spec
  - `pnpm openapi:generate`: 生成 Schema、Typed Client、Registry 与 Coverage 覆盖率指标
  - `pnpm openapi:verify` / `pnpm openapi:check`: CI 产物 Diff 校验

---

## 3. CI / Contract 校验

- `pnpm test:contract`: 执行请求/响应双向契约测试，断言 HTTP Method、Path 编码与参数顺序、Query/Body JSON 校验及 200/204/302/Error 响应。
- `pnpm openapi:verify`: 校验全部生成产物与覆盖率文档，确保产物无手写篡改或模型游离。
