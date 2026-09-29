# 概览图展示完整职员列表（2026-09-29）

## 改动

此前 `render_subject_overview` 虽然能读取最多 100 名职员，view-model 却固定只保留 6 个职位组、每组 4 人，因此即使接口返回 87 人，图片也只显示 24 人。现在图片工具默认 `maxStaff=100`，并将该上限同时用于职位组和每组成员展示；显式传入较小的 `maxStaff` 时，图卡仍遵守该上限。通用 view-model 的既有默认值保持不变，避免影响其它组合工具。

## 验证

- `pnpm test`：69 个测试文件、439 个测试通过；新增 87 人/12 组的 720px 渲染回归，确认首尾姓名可见、隐藏计数为零、图像高度不超过 8,192px 且小于 1MB。
- `pnpm typecheck`、`pnpm lint`、定向 Prettier 检查和 `pnpm acceptance:check` 通过。工具目录仍为 96 项，direct execute 96/96；QQ/TIM 源码分支表仍报 `qq_pending=96`，该本地/公开 API 验证不增加真实 QQ/TIM 计数。
- 提交 `b180241cbd97ceab63932df17cc4ce0bdb56fa3c` 后，重新运行只读公开 API/Artifact 探针，报告位于 `docs/live-probes/subject-overview-caps-20260928T194520Z.json`。Bangumi 条目 41529 的 87/87 职员、9/9 cast、7/7 关联项均完整；实际 720×2499 PNG 为 468,508 字节、无 renderer warnings，33 个职位组与 87 个职员姓名全部显示，省略 0 人。图像已放大视觉检查；临时 PNG 随后清理。

此结果证明当前源码分支的 ToolRegistry、公开只读数据和本地 PNG Artifact 链路；不证明该版本已经部署到 PariyaAgent，也不证明 QQ/TIM 的客户端显示效果。

## 默认角色覆盖补齐（2026-09-29）

后续逐项对照发现了同一张概览卡的另一个明确截断：subject `41529` 的当前官方 API 返回 9 个角色/声优，但 `get_subject_overview` 与 `render_subject_overview` 默认只请求 8 个；renderer view model 和 `RenderService` 又各自把图卡默认硬裁到 6 个。结果会把一个官方数据完整、普通规模的角色表显示成 `partial`，且图上只出现 6 个。

修复将两个概览工具的默认 `maxCast` 提高到已有工具上限 20，并将 view model/RenderService 的角色显示安全上限对齐到 20。明确指定较小的 `maxCast` 仍按该值有界显示；过大的输入仍被工具 schema 拒绝。

验证在提交 `e766ea8ae67a05aec1520f937eecaf926f5553ad` 后完成：

- `pnpm test`：69 个文件 / 440 项通过；`pnpm test:integration:sqlite`：18 个文件 / 52 项通过；typecheck、lint、acceptance:check、auth:check、定向 Prettier 均通过。
- `pnpm exec vitest run tests/semantic/subject-overview.test.ts tests/render/subject-overview.test.ts tests/unit/subject-overview-limit-schema.test.ts`：24/24 通过。回归夹具验证常见的 9 角色条目经 get 工具、view model 和手机 renderer 后保持 `complete`，无隐藏裁切且高度在 8192px 内；生成的图片请求仍只加载每个角色的图片，不抓职员头像。
- 之后对同一公开条目执行 hash 绑定在线探针 [`subject-overview-caps-20260929T050028Z.json`](../live-probes/subject-overview-caps-20260929T050028Z.json)：source revision 精确为 `e766ea8`，15 个只读 API 请求；显式最大支持值下角色 9/9、职员 87/87、关联 7/7 完整。实际图片为 720×2623、483,559 字节，33/33 职位组、87/87 职员可见，renderer warnings 为 0。PNG 临时预览已视觉检查；不保存公开角色/职员图片或文本为额外数据文件。

这是当前 BangumiAgentKit 源分支上的 API/Artifact 证据，不增加 QQ/TIM 客户端计数，也不证明该代码已合并到 master 或部署至 PariyaAgent。
