# 概览图展示完整职员列表（2026-09-29）

## 改动

此前 `render_subject_overview` 虽然能读取最多 100 名职员，view-model 却固定只保留 6 个职位组、每组 4 人，因此即使接口返回 87 人，图片也只显示 24 人。现在图片工具默认 `maxStaff=100`，并将该上限同时用于职位组和每组成员展示；显式传入较小的 `maxStaff` 时，图卡仍遵守该上限。通用 view-model 的既有默认值保持不变，避免影响其它组合工具。

## 验证

- `pnpm test`：69 个测试文件、439 个测试通过；新增 87 人/12 组的 720px 渲染回归，确认首尾姓名可见、隐藏计数为零、图像高度不超过 8,192px 且小于 1MB。
- `pnpm typecheck`、`pnpm lint`、定向 Prettier 检查和 `pnpm acceptance:check` 通过。工具目录仍为 96 项，direct execute 96/96；QQ/TIM 源码分支表仍报 `qq_pending=96`，该本地/公开 API 验证不增加真实 QQ/TIM 计数。
- 提交 `b180241cbd97ceab63932df17cc4ce0bdb56fa3c` 后，重新运行只读公开 API/Artifact 探针，报告位于 `docs/live-probes/subject-overview-caps-20260928T194520Z.json`。Bangumi 条目 41529 的 87/87 职员、9/9 cast、7/7 关联项均完整；实际 720×2499 PNG 为 468,508 字节、无 renderer warnings，33 个职位组与 87 个职员姓名全部显示，省略 0 人。图像已放大视觉检查；临时 PNG 随后清理。

此结果证明当前源码分支的 ToolRegistry、公开只读数据和本地 PNG Artifact 链路；不证明该版本已经部署到 PariyaAgent，也不证明 QQ/TIM 的客户端显示效果。
