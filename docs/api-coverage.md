# Bangumi API 覆盖与生成策略

## 1. OpenAPI 基准与状态

- **设计基准**：Bangumi API (v0) + 旧版 `/calendar`
- **操作总数**：56 个 Operation（全部覆盖，100% 元数据注册）
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

## 2. 代码生成工具链

- **同步脚本**: `scripts/sync-openapi.ts`
- **Client 生成脚本**: `scripts/generate-openapi-client.ts`
- **注册表生成脚本**: `scripts/generate-operation-registry.ts`
- **产物文件**:
  - `openapi/upstream/v0.yaml`
  - `openapi/generated-operation-registry.json`
  - `packages/bangumi-openapi/src/generated/index.ts`
  - `packages/bangumi-openapi/src/operation-registry.ts`
  - `packages/bangumi-openapi/src/calendar-client.ts`

- **CI / Contract 校验**:
  - `pnpm test:contract`: 执行契约测试，断言 56 个 Operation 的元数据、HTTP Method、Risk 级别、Scope 等属性。
  - `pnpm openapi:verify`: 校验 `git diff`，防止生成的代码被人工非法干预。
