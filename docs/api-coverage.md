# Bangumi API 覆盖与生成策略

## 1. OpenAPI 覆盖状态

- **设计基准**：Bangumi API (v0) + 旧版 `/calendar`
- **Metadata Coverage**: 56/56 Operations (100% 元数据注册)
- **Functional Contract Coverage**: 56/56 Operations (100% 经过真实 HTTP Request-level 契约测试验证，确保无未替换 Path 占位符、参数正确 URL 编码、HTTP 204 与 302 重定向正确处理)

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
- **同步脚本**: `scripts/sync-openapi.ts`
- **Client 生成脚本**: `scripts/generate-openapi-client.ts` (自动 Dereference `$ref`、合并 Path/Operation 参数、做 `encodeURIComponent` 替换)
- **注册表生成脚本**: `scripts/generate-operation-registry.ts` (结合 OpenAPI `operation.security` 与 `openapi/operation-overrides.yaml`)
- **生成产物**:
  - `openapi/upstream/v0.yaml`
  - `openapi/operation-overrides.yaml`
  - `openapi/generated-operation-registry.json`
  - `packages/bangumi-openapi/src/generated/index.ts`
  - `packages/bangumi-openapi/src/operation-registry.ts`
  - `packages/bangumi-openapi/src/calendar-client.ts`

---

## 3. CI / Contract 校验

- `pnpm test:contract`: 执行请求级契约测试，模拟实际 HTTP 请求断言全部 56 个 Operation 不残留 `{...}` 占位符。
- `pnpm openapi:verify`: 校验全部生成产物，确保无人为篡改或模型游离。
