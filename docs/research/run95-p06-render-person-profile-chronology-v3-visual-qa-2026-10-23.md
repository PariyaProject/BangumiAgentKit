# Run #95 P06 v3 人物档案时间轴视觉验收

日期：2026-10-23
结果：**PASS（渲染矩阵与视觉检查）**

## 候选与范围

- 渲染源码候选：`512de0b57ef267974a1b39228abd8aa09130ffa9`；基线：`d8b17d10bcb9c6b4b1d6031ceffc8fc5c589d6b1`。
- 源码输入 SHA-256：`6d4531df1500999dc2d2800e499e9677faf0a21c53cf3aa134ba00754e05181e`；渲染构建 SHA-256：`eb8a318b0e527ed42945d396d1c73d57118edc1b83a2781efc892a67edd9a476`。
- 仅用离线合成样例，无真实 Bangumi 数据、OAuth、账号或 QQ/TIM 路径。
- 本次覆盖人物档案时间轴以及三种既有 render 模板；每个模板在三个设计包、明暗两套主题和 320/360/520/640/960 CSS px 下渲染，共 120 张原图。
- P06 v3 仍为 `UNASSESSED`；本报告只记录渲染和布局验收，不建立工具能力验收结论，也没有重跑一次性探测。

## 视觉检查

四张总览各包含 30 个矩阵单元。所有单元均已逐格人工检查；人物档案另有九张全尺寸样例检查。总览图按以下相对路径保留：

| 模板 | 单元数 | 总览图 | SHA-256 |
|---|---:|---|---|
| 人物档案时间轴 | 30 | [run95-p06-render-person-profile-chronology-v3-contact-sheet-2026-10-23.png](assets/run95-p06-render-person-profile-chronology-v3-contact-sheet-2026-10-23.png) | `41e70cc1525d05d5b5cbe9c7ff59985b496e2e6ee55f9d49bb24cc226c3df50c` |
| 修订时间轴 | 30 | [run95-p06-render-matrix-revision-timeline-contact-sheet-2026-10-23.png](assets/run95-p06-render-matrix-revision-timeline-contact-sheet-2026-10-23.png) | `427ac40d0ab205294536dc210ab5b3cc9997782d993104179c9e3e6405b2c198` |
| 条目卡片 | 30 | [run95-p06-render-matrix-subject-card-contact-sheet-2026-10-23.png](assets/run95-p06-render-matrix-subject-card-contact-sheet-2026-10-23.png) | `262a01e322ab279c33c476b386dcde86f2cdd49282f9d56c691a8a183f411d39` |
| 条目统计 | 30 | [run95-p06-render-matrix-subject-stats-contact-sheet-2026-10-23.png](assets/run95-p06-render-matrix-subject-stats-contact-sheet-2026-10-23.png) | `2ac7d9a0669b3ef58c63156ce0ff32b6873e17c776e6c64987578d1eb852eca3` |

全尺寸抽查覆盖六个 320px 人物档案组合，以及暖调编辑 960px、清爽画廊深色 520px、漫画杂志浅色 960px：

- `person-profile-complete-c5685450e6dc-clean-gallery-bangumi-dark-320.png`
- `person-profile-complete-c5685450e6dc-clean-gallery-bangumi-dark-520.png`
- `person-profile-complete-c5685450e6dc-clean-gallery-bangumi-light-320.png`
- `person-profile-complete-c5685450e6dc-graphic-zine-bangumi-dark-320.png`
- `person-profile-complete-c5685450e6dc-graphic-zine-bangumi-light-320.png`
- `person-profile-complete-c5685450e6dc-graphic-zine-bangumi-light-960.png`
- `person-profile-complete-c5685450e6dc-warm-editorial-bangumi-dark-320.png`
- `person-profile-complete-c5685450e6dc-warm-editorial-bangumi-light-320.png`
- `person-profile-complete-c5685450e6dc-warm-editorial-bangumi-light-960.png`

当前候选 `512de0b5` 重新生成了 120 张原图和四张总览。120 张原图逐张与保留的前一轮 120 条哈希收据一致；四张总览哈希也与已检查并跟踪的图片一致，共 **124/124 像素输出相同**。前一轮收据记录了 `31f7c70d` 与 `4a403738`、`65235b5a` 的 124/124 完全一致。因此当前候选与此前人工检查的像素相同，人工结论适用于当前候选。

### 参考风格对照

对照了已有的三张参考板：[暖调编辑](assets/run95-ux002-warm-editorial-board-2026-10-20.png)、[清爽画廊](assets/run95-ux002-clean-gallery-board-2026-10-20.png)、[漫画杂志](assets/run95-ux002-graphic-zine-board-2026-10-20.png)。

| 设计包 | 复核要点 | 结果 |
|---|---|---|
| 暖调编辑 / Warm Editorial | Georgia/Songti display stack, paper palette, folio curl | PASS |
| 清爽画廊 / Clean Gallery | Avenir Next/CJK sans stack, airy cyan/blue, restrained chamfer | PASS |
| 漫画杂志 / Graphic Zine | Impact/Arial Black display stack, bold print palette, angular cut-paper | PASS |

设计包之间保留了不同的字形层级、颜色节奏、图标笔画和有目的的裁切轮廓。暖调编辑采用卷页/纸页式曲线，清爽画廊采用克制的切角，漫画杂志采用有棱角的纸片轮廓；没有为了“不方正”而随机扭曲布局。参考板是风格和版式方向，人物档案组件沿用其视觉语言，不声称与不同页面内容的参考图像素级相同。

### 字体与密度

- 渲染器默认字号比例为 `0.75`，支持分别配置 body/display 字体栈与可信本地字体文件。
- 本矩阵使用三套设计包自带字体栈，没有加载额外字体文件：暖调编辑使用 Georgia/Songti 系列 display 栈，清爽画廊使用 Avenir Next/CJK sans 系列，漫画杂志使用 Impact/Arial Black/CJK sans 系列。
- 本次在 macOS 渲染环境生成；其他操作系统的字体回退可能不同。
- 320px 人物档案由于包含完整合成关系样本、时间轴和限制说明，纵向内容较长；全尺寸抽查未发现横向溢出或文字裁切。该长页面密度仍是后续真实数据验收要继续关注的体验点。
- 按 Hallmark 的组件级检查项复核字体层级、设计 token、视觉对比、排版和 320–960px 适配；本轮没有执行 WCAG 数值对比度审计。输出是静态 PNG，不含可交互控件，因此 hover/focus/active 状态不适用。

## 自动化收据

- 矩阵渲染命令：`PARIYA_UX002_REFERENCE_RUN_ID=run95-p06-chronology-v3-candidate-512de0b5-20261023 node scripts/acceptance/render-ux002-reference-fidelity-matrix.mjs`；内部 `pnpm build` 成功，渲染脚本正常退出。
- 总览命令：`node scripts/create-render-design-pack-contact-sheets.mjs run95-p06-chronology-v3-candidate-512de0b5-20261023`；`receiptVerification=PASS`。
- 120/120 原图的视口宽度与根容器一致；横向溢出 0，评分面板溢出 0。
- 570/570 条预期文本断言通过；每张图都带有效 CSS shape 遮罩收据。未支持的 shape 遮罩 0，错误标记面板 0。
- 人物时间轴在 30/30 组合中均有两条观察记录、两枚节点、一个连接线和可见的限制说明。
- 120/120 原图都有 SHA-256、像素尺寸、字节数、主题、宽度、布局/遮罩收据和总览单元位置；详见 [run95-p06-render-person-profile-chronology-v3-image-manifest-2026-10-23.json](assets/run95-p06-render-person-profile-chronology-v3-image-manifest-2026-10-23.json)。

## 文件保留

120 张全尺寸 PNG 是本次检查的临时输入，合计 35,670,436 bytes；验收后会清理这些副本，只保留四张总览图（4,008,429 bytes）、逐图 JSON 收据和本报告。原图路径和哈希保留在 JSON 中，矩阵可用上面的命令重新生成。
