# Run #95 — Subject Statistics Intelligence 窄屏占比布局 QA（Candidate 9689e83）

## 范围和方法

基线为 BangumiAgentKit `master` `c8b1783a5cbb4aa8fcc5a4f6ed75462d8246189d`。实现源提交为 `9689e830d5cfd552a230c0e99dde7c55df32d098`。只修改 `SubjectStatsCard` 的 8–9 分占比呈现：将百分比保留为主值，把计数/总体数移至独立的“样本数”次级行。统计公式、源字段、覆盖判断和业务状态不变。

使用确定性合成 ViewModel 对 complete、sparse、partial、conflict、unavailable、not-found、not-computable、dense-long-identity 八种状态分别按 320、360、520、640、960 CSS px（DPR 1）渲染。40 张最终 PNG 均逐张打开检查。输出文件和完整生成脚本保存在本机忽略目录：`/Users/wuzhao/Program/Github/BangumiAgentKit-clean-current/.artifacts/render/subject-stats-visual-qa-20261019-candidate/`。manifest 中逐项记录 PNG 尺寸、字节数和 SHA-256。渲染外部请求：0；没有访问账号、OAuth、公开 API、QQ 或 TIM。

## 结果

基线 complete/320 图中，`100.0% (100/100)` 的右括号单独落在下一行。候选图把 `100.0%` 作为醒目主值，将 `样本数 100 / 100` 作为独立的次级说明；五种宽度和各状态均无孤立括号。部分、不可用、未找到和不可计算状态继续显示各自状态，不补造百分比或样本。冲突仍保留冲突信息。

所有 40 张图都没有可见裁切、卡片外溢或内容重叠。320px 的长身份压力卡片高 2138px，仍属长标题压力样本；标题被截断并带省略号，统计和解释完整保留。此次只证明这个 Renderer 卡片的合成布局，不证明 API、Agent/MCP 答案或任何客户端交付。

## 与历史项目的对照边界

[Bangumi-for-QQ](https://github.com/Kurarion/Bangumi-for-QQ/tree/b44d493dd6f5044d6fe305292016908ae15ef933) 与 [Bangumi-QQ-Bot-CPP](https://github.com/Kurarion/Bangumi-QQ-Bot-CPP/tree/f1c75bc366755d8bd7bf35ee5c11b513cb066f8e) 没有与 Subject Statistics Intelligence 等价的统计卡片。此处只沿用已逐张检查过的历史界面共同优点作对照：标题层级、简明事实标签和消息/图片信息一致性；不做像素仿制，也不据一个模板声称整体质量已经高于旧项目。历史截图选样和对照细节见 PariyaAgent 的 `docs/research/ux001-auth-message-and-render-visual-acceptance-plan-2026-10-18.md` 与 `docs/research/run95-ux001-auth-status-and-render-visual-review-2026-10-18.md`。

## 验证和限制

- `pnpm build` — PASS。
- `pnpm exec vitest run tests/render/subject-stats.test.ts --config vitest.mobile-render-audit.config.ts` — 1 个文件、6 个测试 PASS；覆盖 320px 无横向溢出、百分比/样本分离、冲突说明和部分状态不伪造数值。
- `pnpm exec prettier --write packages/renderer/src/templates/SubjectStatsCard.tsx tests/render/subject-stats.test.ts` 与 `git diff --check` — PASS。
- 本图像 QA 未新增 Agent/MCP、账号/OAuth、QQ 或 TIM 验收积分；Run #95 的 Agent/MCP 矩阵仍为 83/96，OP-012 仍为 PARTIAL。
- 原 Run 69 记录要求每个修改后的 Candidate 重新执行一次精确源码自然语言 Agent/MCP 验收。此报告不把合成图或单元测试冒充那项验收。Run #95 将这次调用作为独立门槛，仅在精确 Candidate CI、Harness candidate check 和 Luna Max review PASS 后、合并前执行一次；执行结果另行记录，遵循一次性调用规则。

## 40 张 PNG 逐张审阅收据

| PNG | 状态 | 尺寸 | 字节 | SHA-256 | 单张观察 |
| --- | --- | ---: | ---: | --- | --- |
| `subject-stats-complete-320.png` | complete | 320×1206 | 87744 | `c7cbbc2c0376a2f9b3ca1d9bfde970e90a1cf972ebbfd96941856b98daa25166` | 完整状态：百分比为主值，样本数独立作为次级行；数值清楚，无孤立标点或溢出。 原问题中落单的右括号已消失。 |
| `subject-stats-complete-360.png` | complete | 360×1168 | 88343 | `9fd8737c2417da77bea47f4e78f6b53afb1be22aa9d329c2ac57cf933b56f404` | 完整状态：百分比为主值，样本数独立作为次级行；数值清楚，无孤立标点或溢出。 |
| `subject-stats-complete-520.png` | complete | 520×1116 | 96807 | `2ca3443fd4f23121d89e0b3083da5b71ae2705429a9852aa64d22eb32e692dee` | 完整状态：百分比为主值，样本数独立作为次级行；数值清楚，无孤立标点或溢出。 |
| `subject-stats-complete-640.png` | complete | 640×1095 | 98331 | `e5ba2b90ce3676c1dc7a322afbd5dbf1d97fdde01375dc63a2256588e1dd3ba5` | 完整状态：百分比为主值，样本数独立作为次级行；数值清楚，无孤立标点或溢出。 |
| `subject-stats-complete-960.png` | complete | 960×827 | 95496 | `d6fb483c2b444714a4d8a6e105b03aaf0d936b1e42ba6b4f4c0e8be1c9641306` | 完整状态：百分比为主值，样本数独立作为次级行；数值清楚，无孤立标点或溢出。 |
| `subject-stats-sparse-320.png` | sparse | 320×1206 | 83667 | `0b92096c15850f7237b7a5337d23d1e455593337f18cc24440a58b161a1c4b98` | 稀疏状态：保留 1/1 样本语义，百分比与样本数分层；分布只显示已观察值。 |
| `subject-stats-sparse-360.png` | sparse | 360×1168 | 84173 | `b8150f123761c8b79e4a678481a5648f0e41aa0e65b6c8e78a7bd6e26b4188ce` | 稀疏状态：保留 1/1 样本语义，百分比与样本数分层；分布只显示已观察值。 |
| `subject-stats-sparse-520.png` | sparse | 520×1116 | 93698 | `f280ee8fc9597ddbeb34f2eb59038296c92bb55c659ba2bfff6ffef09cc35698` | 稀疏状态：保留 1/1 样本语义，百分比与样本数分层；分布只显示已观察值。 |
| `subject-stats-sparse-640.png` | sparse | 640×1095 | 95035 | `adab55bb7ad0dffffe519b84ce3fc6db0c4b6c47234757580ade112ceeacf1ef` | 稀疏状态：保留 1/1 样本语义，百分比与样本数分层；分布只显示已观察值。 |
| `subject-stats-sparse-960.png` | sparse | 960×827 | 92449 | `dc745a91abae376e91b3f5754306a2396037c0c6b8e8005e2fe95aa438cea76a` | 稀疏状态：保留 1/1 样本语义，百分比与样本数分层；分布只显示已观察值。 |
| `subject-stats-partial-320.png` | partial | 320×1238 | 93130 | `ac159f105c80d962b1deba4ada5c1222798df8bd86e292cf8d37e26cab2437fc` | 部分状态：显示“数据不全”和未知字段；未把缺失占比/样本数补成完整值。 |
| `subject-stats-partial-360.png` | partial | 360×1184 | 93614 | `6e68b8e4dd2c1f01877e5a0f2410b4e0431201242c6596b2f39274133b18716e` | 部分状态：显示“数据不全”和未知字段；未把缺失占比/样本数补成完整值。 |
| `subject-stats-partial-520.png` | partial | 520×1132 | 100943 | `6780af1cb4455f3b84feb751d864bdb9337c8c56566886266b74ea5e56c4a0bd` | 部分状态：显示“数据不全”和未知字段；未把缺失占比/样本数补成完整值。 |
| `subject-stats-partial-640.png` | partial | 640×1111 | 102651 | `ca23ee2c7a8fb7e25aa4f8a5ec5340d70e842d183026c8fcf3db5e3fe4a955e0` | 部分状态：显示“数据不全”和未知字段；未把缺失占比/样本数补成完整值。 |
| `subject-stats-partial-960.png` | partial | 960×842 | 100756 | `dbf01dbdc61d16dcfa156d8412d4655dbf91f016aef5c8adaac95ebc7a6f9b9d` | 部分状态：显示“数据不全”和未知字段；未把缺失占比/样本数补成完整值。 |
| `subject-stats-conflict-320.png` | conflict | 320×1429 | 110483 | `d287439581ecd4187a88e3e97a23013936a088813b773d065d4a599f2707464c` | 冲突状态：保留冲突提示和原始两方数值；样本副行未遮盖冲突。 |
| `subject-stats-conflict-360.png` | conflict | 360×1391 | 111234 | `7f3fe7ec973135add0a4dd9baf2589694605d9406af5136a5fe9153e4779b1f7` | 冲突状态：保留冲突提示和原始两方数值；样本副行未遮盖冲突。 |
| `subject-stats-conflict-520.png` | conflict | 520×1321 | 120142 | `189e6b7ef41a2ba802fb2ee06ba910bc19e9a0652ac7be37c65ee3a246649ceb` | 冲突状态：保留冲突提示和原始两方数值；样本副行未遮盖冲突。 |
| `subject-stats-conflict-640.png` | conflict | 640×1300 | 122450 | `16a0e2f023b5b444bfb621bdec251555f460001bad2caba76e247ffe173949d9` | 冲突状态：保留冲突提示和原始两方数值；样本副行未遮盖冲突。 |
| `subject-stats-conflict-960.png` | conflict | 960×1032 | 120241 | `28a6196cbb327063b5ae048e626980d7660c977b97d49812f92fd0240644cf0d` | 冲突状态：保留冲突提示和原始两方数值；样本副行未遮盖冲突。 |
| `subject-stats-unavailable-320.png` | unavailable | 320×465 | 35877 | `32c9ab421b6016d6fed648fb20f700211fa862b81108ad4ef0417e36e768ba51` | 不可用状态：明确说明源不可用，没有生成统计值。 |
| `subject-stats-unavailable-360.png` | unavailable | 360×465 | 36247 | `90efa418b8390852fd56d0ace39cc973abae4f759956e1e807424a5212b36323` | 不可用状态：明确说明源不可用，没有生成统计值。 |
| `subject-stats-unavailable-520.png` | unavailable | 520×410 | 36361 | `2907b3c179474588be065de82051fc49f485dbf665d81787e10f8090220b9c2c` | 不可用状态：明确说明源不可用，没有生成统计值。 |
| `subject-stats-unavailable-640.png` | unavailable | 640×389 | 36863 | `f6574d85e1fc3193873c5a3ef391ad79a70b79c1444af39ac0380fe0ca0354e2` | 不可用状态：明确说明源不可用，没有生成统计值。 |
| `subject-stats-unavailable-960.png` | unavailable | 960×389 | 38203 | `a7d1a3a4b9c362c99e37546f06a2cc406bdacab1cd97f5abf9b13cb5c383d6de` | 不可用状态：明确说明源不可用，没有生成统计值。 |
| `subject-stats-not-found-320.png` | not-found | 320×445 | 34685 | `9202d85dc8aa47869b806de13f0949754074c56dfc21a8283bb09b6189ec4384` | 未找到状态：明确说明未找到条目，没有把它显示为空统计。 |
| `subject-stats-not-found-360.png` | not-found | 360×429 | 35060 | `c32d1a5e57b2c49c0c251bbf91834dd641a7e8fdc43dddc4f91fe9d4b137bea2` | 未找到状态：明确说明未找到条目，没有把它显示为空统计。 |
| `subject-stats-not-found-520.png` | not-found | 520×410 | 35560 | `4e4c234ecf0d89ac5516929c7e326598d5eab16f302693a0c9a7be4c9073d497` | 未找到状态：明确说明未找到条目，没有把它显示为空统计。 |
| `subject-stats-not-found-640.png` | not-found | 640×389 | 35986 | `34de3596c510a5f167b354fadfd7336b4361a2aae3c7a05ff0b73685140d1ee8` | 未找到状态：明确说明未找到条目，没有把它显示为空统计。 |
| `subject-stats-not-found-960.png` | not-found | 960×389 | 37319 | `d2114294733a6b9684d05b56931202384520fd520d54968f6a9d8f68d6207557` | 未找到状态：明确说明未找到条目，没有把它显示为空统计。 |
| `subject-stats-not-computable-320.png` | not-computable | 320×1235 | 84583 | `192f86b50ddc04e6b33f8d1a842ca0c1c9c05a644218582b88211b912792d436` | 不可计算状态：显示无法计算/未知，没有把零总体伪装成有效百分比。 |
| `subject-stats-not-computable-360.png` | not-computable | 360×1198 | 85523 | `c202f81d7fa3b72f330712949a4e14079ba85cc307622ada98e14a55b6c66ae5` | 不可计算状态：显示无法计算/未知，没有把零总体伪装成有效百分比。 |
| `subject-stats-not-computable-520.png` | not-computable | 520×1146 | 97136 | `3c6576d9b3b57a432eb4d7cd6ef129bd39cabf9f5bc029fb1f37e314c99cd4d7` | 不可计算状态：显示无法计算/未知，没有把零总体伪装成有效百分比。 |
| `subject-stats-not-computable-640.png` | not-computable | 640×1125 | 98318 | `0d2d5e2afb1e51510a9858a4125f12286b0f2e3660b75b34ff7f28b1161cb22c` | 不可计算状态：显示无法计算/未知，没有把零总体伪装成有效百分比。 |
| `subject-stats-not-computable-960.png` | not-computable | 960×856 | 94457 | `119113b232ff531c33b15bebb6d0e409ec6b069ab50e441ca6dca14659018906` | 不可计算状态：显示无法计算/未知，没有把零总体伪装成有效百分比。 |
| `subject-stats-dense-long-identity-320.png` | dense-long-identity | 320×2138 | 107599 | `f9c9a412945d0211fb487dc734bfef30c063a05a477073799fdcb30a41214e84` | 长身份压力状态：标题按已有上限截断并带省略号；统计、图表和说明均可见，无重叠。 卡片高 2138px；这是长标题压力样本，非普通内容高度。 |
| `subject-stats-dense-long-identity-360.png` | dense-long-identity | 360×1970 | 161187 | `a398fa022f6c9959b53dd166fa8f182e9a2eb108692efc8623eeb0cd213feaf9` | 长身份压力状态：标题按已有上限截断并带省略号；统计、图表和说明均可见，无重叠。 卡片高 1970px；长内容完整流动，未出现水平溢出。 |
| `subject-stats-dense-long-identity-520.png` | dense-long-identity | 520×1574 | 149479 | `9a746d0a198e0e62b8720f1ad9567ce642db6042db31503d2bd0a1956c536fda` | 长身份压力状态：标题按已有上限截断并带省略号；统计、图表和说明均可见，无重叠。 卡片高 1574px；长内容完整流动，未出现水平溢出。 |
| `subject-stats-dense-long-identity-640.png` | dense-long-identity | 640×1460 | 146978 | `c8750cbcb8b30ed0a6f172572e3cc76adc9a123061aa52f69d7a0f2203797275` | 长身份压力状态：标题按已有上限截断并带省略号；统计、图表和说明均可见，无重叠。 长内容按宽屏布局流动，未出现水平溢出。 |
| `subject-stats-dense-long-identity-960.png` | dense-long-identity | 960×1077 | 132153 | `6ec9cdd9d1860895f85ecad17c764450d561df4402c63a49ba8189cc71e78ce8` | 长身份压力状态：标题按已有上限截断并带省略号；统计、图表和说明均可见，无重叠。 长内容按宽屏布局流动，未出现水平溢出。 |
