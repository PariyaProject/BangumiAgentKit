# Renderer 封面调查：绿色/占位封面根因

> PR-7A 研究交付物。调查只记录事实与根因，不做 CSS-only 修复，也不修改生产 Renderer。

## 结论

当前问题的故障域是 **AssetResolver → NodeAssetHttpTransport 的自定义 DNS pinning callback**：

1. 18/20 个有源图 URL 的条目从 `lain.bgm.tv` 返回 HTTP 200、`image/jpeg`，全都能被 Sharp 直接解码。
2. 当前 `AssetResolver` 对这 18 个 URL 全部返回固定 1×1 PNG placeholder，并产生 `ASSET_FETCH_FAILED`。
3. 渲染服务能完成 Chromium 截图，但截图使用了 resolver 的 placeholder，因此用户看到的是占位/异常封面。
4. 失败消息是 `TypeError [ERR_INVALID_IP_ADDRESS]: Invalid IP address: undefined`，发生在 Node 的 socket request 阶段。
5. 直接 fetch + Sharp、React view-model、Playwright/Chromium、CSS 布局和色彩 profile 都没有证据显示为根因。

## 可复现实验

研究脚本位于 [`scripts/research/investigate-covers.mjs`](../../scripts/research/investigate-covers.mjs)，只依赖已构建的 renderer dist、官方 v0 API、当前 Sharp/RenderService，不被 runtime import。

```bash
pnpm build
node scripts/research/investigate-covers.mjs
```

实验输出（故意不提交第三方封面截图）保存在：

```text
/tmp/bangumi-pr7a-cover-evidence/cover-investigation.json
/tmp/bangumi-pr7a-cover-evidence/subject-<id>.png
```

样本由官方 v0 `GET /v0/subjects?type=2&sort=rank` 前 10 和 `sort=date` 前 15 去重得到 20 条。脚本为每条捕获：subject ID、源 image URL、HTTP status、最终 URL、content type、源图 bytes、Sharp decoded format/尺寸、AssetResolver data URL/尺寸/warning、Renderer 截图路径/尺寸/warnings。

## 20 条样本证据

表中 `AssetResolver` 的 `png 1×1` 是当前固定 placeholder；截图名对应 `/tmp/bangumi-pr7a-cover-evidence/`，未进入仓库。

| Subject | 标题                              | 源 image URL                                             | 源 HTTP / content type / Sharp    | AssetResolver 输出          | Renderer 截图                    |
| ------: | --------------------------------- | -------------------------------------------------------- | --------------------------------- | --------------------------- | -------------------------------- |
|     876 | CLANNAD 〜AFTER STORY〜           | `https://lain.bgm.tv/pic/cover/l/67/d1/876_dCfrd.jpg`    | 200 / image/jpeg / jpeg 578×800   | png 1×1; ASSET_FETCH_FAILED | `subject-876.png`; warning       |
|     326 | 攻壳机动队 S.A.C. 2nd GIG         | `https://lain.bgm.tv/pic/cover/l/a6/66/326_D8wjw.jpg`    | 200 / image/jpeg / jpeg 724×1024  | png 1×1; ASSET_FETCH_FAILED | `subject-326.png`; warning       |
|   25961 | 猫和老鼠（1965年电视版）          | `https://lain.bgm.tv/pic/cover/l/fd/60/25961_WDKz6.jpg`  | 200 / image/jpeg / jpeg 297×447   | png 1×1; ASSET_FETCH_FAILED | `subject-25961.png`; warning     |
|     253 | 星际牛仔                          | `https://lain.bgm.tv/pic/cover/l/c2/4c/253_jJJj9.jpg`    | 200 / image/jpeg / jpeg 592×900   | png 1×1; ASSET_FETCH_FAILED | `subject-253.png`; warning       |
|     324 | 攻壳机动队 STAND ALONE COMPLEX    | `https://lain.bgm.tv/pic/cover/l/f2/fc/324_psuXk.jpg`    | 200 / image/jpeg / jpeg 488×640   | png 1×1; ASSET_FETCH_FAILED | `subject-324.png`; warning       |
|    1728 | 浪客剑心 追忆篇                   | `https://lain.bgm.tv/pic/cover/l/71/37/1728_HLsCr.jpg`   | 200 / image/jpeg / jpeg 620×833   | png 1×1; ASSET_FETCH_FAILED | `subject-1728.png`; warning      |
|    6049 | 新世纪福音战士剧场版 Air/真心为你 | `https://lain.bgm.tv/pic/cover/l/fe/45/6049_zy52O.jpg`   | 200 / image/jpeg / jpeg 1072×1600 | png 1×1; ASSET_FETCH_FAILED | `subject-6049.png`; warning      |
|   10380 | 命运石之门                        | `https://lain.bgm.tv/pic/cover/l/a9/79/10380_YwP4R.jpg`  | 200 / image/jpeg / jpeg 640×960   | png 1×1; ASSET_FETCH_FAILED | `subject-10380.png`; warning     |
|     237 | 攻壳机动队                        | `https://lain.bgm.tv/pic/cover/l/53/9f/237_78UdL.jpg`    | 200 / image/jpeg / jpeg 550×753   | png 1×1; ASSET_FETCH_FAILED | `subject-237.png`; warning       |
|  211567 | 3月的狮子 第二季                  | `https://lain.bgm.tv/pic/cover/l/5c/49/211567_pGm5Q.jpg` | 200 / image/jpeg / jpeg 560×800   | png 1×1; ASSET_FETCH_FAILED | `subject-211567.png`; warning    |
|  545813 | 寻梦环游记2                       | `https://lain.bgm.tv/pic/cover/l/3e/16/545813_BQKrn.jpg` | 200 / image/jpeg / jpeg 939×672   | png 1×1; ASSET_FETCH_FAILED | `subject-545813.png`; warning    |
|  553250 | 星之子                            | `https://lain.bgm.tv/pic/cover/l/21/ff/553250_22weL.jpg` | 200 / image/jpeg / jpeg 720×1080  | png 1×1; ASSET_FETCH_FAILED | `subject-553250.png`; warning    |
|  528733 | 活力二人组                        | 无图片 URL                                               | 无源请求                          | png 1×1; no warning         | `subject-528733.png`; no warning |
|  507726 | 超人总动员3                       | `https://lain.bgm.tv/pic/cover/l/8e/16/507726_3JL33.jpg` | 200 / image/jpeg / jpeg 1200×1200 | png 1×1; ASSET_FETCH_FAILED | `subject-507726.png`; warning    |
|  479825 | 冰雪奇缘3                         | `https://lain.bgm.tv/pic/cover/l/c9/41/479825_7K8P2.jpg` | 200 / image/jpeg / jpeg 674×999   | png 1×1; ASSET_FETCH_FAILED | `subject-479825.png`; warning    |
|  668349 | 精灵旅社大闹鬼                    | 无图片 URL                                               | 无源请求                          | png 1×1; no warning         | `subject-668349.png`; no warning |
|  618786 | 忍者神龟：变种大乱斗2             | `https://lain.bgm.tv/pic/cover/l/45/c4/618786_29Etl.jpg` | 200 / image/jpeg / jpeg 600×900   | png 1×1; ASSET_FETCH_FAILED | `subject-618786.png`; warning    |
|  691346 | 布鲁伊                            | `https://lain.bgm.tv/pic/cover/l/20/41/691346_CIW79.jpg` | 200 / image/jpeg / jpeg 2400×3000 | png 1×1; ASSET_FETCH_FAILED | `subject-691346.png`; warning    |
|  590141 | 辛普森一家2                       | `https://lain.bgm.tv/pic/cover/l/0d/b8/590141_MaMWM.jpg` | 200 / image/jpeg / jpeg 3277×4096 | png 1×1; ASSET_FETCH_FAILED | `subject-590141.png`; warning    |
|  503237 | 怪物史莱克5                       | `https://lain.bgm.tv/pic/cover/l/fa/7c/503237_B8Czz.jpg` | 200 / image/jpeg / jpeg 612×765   | png 1×1; ASSET_FETCH_FAILED | `subject-503237.png`; warning    |

## 失败点定位

当前 `NodeAssetHttpTransport` 使用自定义 `lookup`，目标是先由 `DefaultAssetNetworkResolver` 做 SSRF 检查和 DNS pinning，再让 HTTPS socket 只连接已批准地址。当前 callback 只返回 scalar 形式：

```text
callback(null, approvedAddress.address, approvedAddress.family)
```

本次 Node 运行时实际调用自定义 lookup 时传入了：

```text
options = { family: undefined, hints: 1024, all: true }
```

Node 进入 `lookupAndConnectMultiple`，此时 lookup callback 必须返回地址数组；scalar callback 会被解释成错误的多地址结果，最终触发：

```text
TypeError [ERR_INVALID_IP_ADDRESS]: Invalid IP address: undefined
```

控制实验把 callback 按 `options.all` 分支返回 `[{ address, family }]`，同一 host/IP pinning 请求得到 `200 image/jpeg` 并完整结束。该实验说明问题在 transport callback 与当前 Node multiple-address contract 的交界处，而不是源图片或 Sharp。

## 故障域排除

| 故障域                | 证据                                                        | 结论                                             |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| 源图片/CDN            | 18 个有图样本均 HTTP 200，content type 为 image/jpeg        | 不是源站不可达或类型拒绝                         |
| Sharp 解码/转换       | 18 个源 buffer 均 decoded format `jpeg`；独立 metadata 成功 | 不是输入格式/Sharp                               |
| AssetResolver         | 18/18 返回 1×1 placeholder 和同类 socket warning            | 直接故障点                                       |
| Node socket transport | error 明确为 invalid IP undefined；`all:true` 控制实验成功  | 根因在自定义 lookup 的 all-address callback 契约 |
| React view model      | view model 正常创建，render service 返回截图                | 不是 React 数据建模                              |
| Chromium/Playwright   | 所有样本均有完成的 PNG 截图                                 | 不是浏览器不可用                                 |
| CSS/object-fit        | 当前 CSS 只会裁切已给图片；resolver 在浏览器前已替换为 1×1  | 不是 CSS-only 问题                               |
| 色彩 profile          | 失败发生在 socket 阶段，没有进入 Sharp 输出                 | 不是颜色管理                                     |

## 修复边界建议（留给后续实现）

修复应保持 SSRF 防护与连接 pinning，只补齐 Node `lookup` 的 `all:true` callback contract，并增加：

- IPv4/IPv6 多地址测试，覆盖 `all:false` 和 `all:true` 两种 callback 形态。
- 对源图 200/image/jpeg → AssetResolver PNG data URL 的回归测试。
- 对 DNS empty、blocked IP、redirect、content-type、oversized image、timeout 的现有安全测试。
- RenderService 断言：源图成功时不产生 `ASSET_FETCH_FAILED`；源图缺失与 transport 失败显示不同 warning。

本 PR-7A 不做该生产修复；研究脚本只用于证据复现。

## 来源

- [固定 v0 OpenAPI](../../openapi/upstream/v0.yaml)
- [Bangumi 图片/条目示例](https://bgm.tv/subject/41529)
- 实验脚本：[`scripts/research/investigate-covers.mjs`](../../scripts/research/investigate-covers.mjs)
