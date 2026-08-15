# Standalone v0.1

Standalone 是一个本地、无 LLM 的 BangumiAgentKit Node runtime：一个
`StandaloneHost`、一个本地 SQLite、共享的 `ToolRegistry`，以及可选的
Chromium Renderer。它不启动 MCP 子进程，也不要求 Claude、OpenAI 或其他
模型 API key。

## 启动

```bash
pnpm install
pnpm setup:local
pnpm build
pnpm standalone
```

提示符为 `bak>`。输入 `help` 查看命令，`exit` 或 `quit` 退出。第一次
Ctrl+C 取消当前输入/操作，第二次 Ctrl+C 干净退出。Standalone 不创建全局
单进程锁，多个不同 profile 可以同时使用同一个 SQLite 文件。

## 非交互 CLI

```bash
pnpm bak -- status
pnpm bak -- search "少女终末旅行"
pnpm bak -- subject 218707
pnpm bak -- overview 218707
pnpm bak -- watch-order 218707 --depth 2 --max-nodes 8 --media all
pnpm bak -- collection status 218707
pnpm bak -- render subject 218707 --output "$HOME/Desktop/bangumi.png"
```

全局选项：

- `--profile <name>`：选择 profile，默认 `default`。
- `--json`：stdout 只输出一个 JSON 结果；诊断应写 stderr。
- `--verbose`：在 status 中显示内部 principal ID 等诊断字段。
- `--output <path>`：把 Renderer 返回的 ArtifactRef 导出到用户指定路径。
- `--force`：允许替换已有导出目标；默认拒绝覆盖。

退出码：0 成功；1 运行时失败；2 用法/校验错误；3 需要登录；4 需要确认
或确认无效；5 Renderer 不可用。

## Profile 和身份

profile 只改变 Standalone 的外部身份映射，不创建新的数据库文件：

```text
provider       = local
botInstanceId  = standalone
externalUserId = <profile>
conversationId = standalone:<profile>
```

启动时通过 `Storage.findOrCreatePrincipal()` 获取内部 principal。用户不能
从普通命令输入 `prc_*` 来伪造身份。`alice` 和 `bob` 使用同一个数据库时，
principal、账号绑定、PendingAction 和审计事件仍然相互隔离。

## 命令

只读语义命令直接调用共享 ToolRegistry：

```text
search <query> [--type anime] [--limit 5]
subject <id>
overview <subjectId> [--max-cast 1..20] [--max-staff 1..80] [--max-relations 1..32]
watch-order <subjectId> [--depth 0|1|2] [--max-nodes 1..16] [--media anime|all]
cast <subjectId>
calendar
episodes <subjectId>
collection status <subjectId>
collection intelligence [--max-items 1..200]
collection backlog [--max-items 1..100] [--max-subjects 1..30]
                  [--max-episodes 1..1000] [--status wish,doing,on_hold]
collection schedule [--max-items 1..200] [--max-rows 1..100]
                   [--status wish,doing,done,on_hold,dropped]
collection list
collection set <subjectId> <wish|watching|watched|dropped|...>
```

认证和账号命令：

```text
auth status
auth login
auth accounts
auth switch <accountId-or-index>
auth remove <accountId-or-index>
```

`auth switch` 和 `auth remove` 会先在当前 principal 的绑定列表中解析账号，
数字参数是当前列表的 1-based index，不能选择另一个 profile 的账号。

## OAuth

Standalone 默认启动由它自己拥有的 Fastify listener，绑定
`127.0.0.1:3000`；也可以设置：

```bash
export BANGUMI_STANDALONE_OAUTH_HOST=127.0.0.1
export BANGUMI_STANDALONE_OAUTH_PORT=3000
```

端口设为 `0` 可让测试使用临时端口。非 loopback bind 会发出警告；只有在
明确需要远程回调时才配置。`auth login` 打印授权 URL，浏览器可手动打开；
交互模式会等待最多 120 秒（可用
`BANGUMI_STANDALONE_OAUTH_WAIT_MS` 调整）。OAuth route 复用现有
`apps/api/src/app.ts`，没有第二份 callback 实现。

## 账号和确认

凭证由 TokenBroker 管理并加密保存在 Storage，Standalone 输出会递归隐藏
token、secret、credential 和加密字段。写操作仍经过 auth、capability、
PendingAction、canonical payload hash 和审计管线。

交互模式遇到 `CONFIRMATION_REQUIRED` 时显示操作摘要并提示：只有
`y`、`yes` 或 `确认` 才会用同一业务 payload、同一 profile、同一
conversation 重试，并把服务端返回的 confirmation ID 放进 ToolContext。
其他输入全部取消，不执行写入。

非交互模式绝不自动确认：

```bash
pnpm bak -- collection set 218707 watching
# 若服务端要求确认，退出码为 4，并返回 confirmationId

pnpm bak -- collection set 218707 watching --confirm cfm_xxx
```

`--confirm` 只作为 ToolContext continuation；PendingAction 仍校验账号、
principal、conversation、payload、过期时间和单次 claim。Raw playground
也不能绕过这些检查。

## Raw Tool Playground

```text
tool list
tool describe bangumi.search_subjects
tool call bangumi.search_subjects '{"query":"少女终末旅行"}'
```

Raw call 仍然走 `ToolRegistry.executeTool()`，因此保留 Zod 校验、身份、
auth、scope、confirmation、audit 和 safe error policy；它不会直接调用
`tool.execute()`，也不会独立请求 Bangumi API。

## Renderer 和导出

```text
render subject <id>
render overview <subjectId> [--max-cast 1..20] [--max-staff 1..80] [--max-relations 1..32]
render watch-order <subjectId> [--depth 0|1|2] [--max-nodes 1..16] [--media anime|all]
render cast <id>
render calendar
render search <query>
render collection <id>
render collection-intelligence [--max-items 1..200]
render collection-dashboard [--max-items 1..100] [--max-subjects 1..30]
                           [--max-episodes 1..1000] [--max-rows 1..100]
                           [--status wish,doing,on_hold]
render collection-backlog [--max-items 1..100] [--max-subjects 1..30]
                         [--max-episodes 1..1000] [--status wish,doing,on_hold]
render collection-schedule [--max-items 1..200] [--max-rows 1..100]
                           [--status wish,doing,done,on_hold,dropped]
```

`collection backlog` 只读取当前绑定账号的官方 v0 动画收藏和正篇 episode
collection。默认筛选 `wish`、`doing`、`on_hold`，并在安全上限内显示已看章节、episode sourceTotal 分母、SlimSubject.eps 原始值及 validity、剩余集数、完成度和基于严格 airing certification 的 `finished`/`ongoing`/`unknown` 状态。`finished` 只表示当前报告的完整、去重正篇 episode airdate 均已过去，不证明未发布后续或排除 hiatus；重复、非正篇、缺失/非法 ID、缺失/非法日期、分页失败、sourceTotal 变化或截断都会保留为未知/部分覆盖。条目级 auth、过期、权限、限流、上游和网络错误会保留 code、message 与 nextAction。人类可读输出按字段、行数、字符和 UTF-8 字节数有界；JSON 模式保留结构化证据。该视图不读取评论、不做日历/推荐/历史推断，也不执行写入。

`collection schedule` 只读取当前绑定账号的有界动画收藏，并与官方七日
legacy `/calendar` 按 `subjectId` 对齐。它展示匹配条目的星期、官方
`air_date`、收藏状态、`ep_status`/`subject.eps` 收藏信封进度，以及未匹配的
收藏或日历行；`air_date` 不是具体播出时刻，官方源不提供时区。分页、重复、
缺失、进度 unknown/conflict、auth、上游错误和 partial/unavailable 状态均保留在
JSON 与人类输出中；未匹配会区分完整扫描未发现、状态筛选排除和源覆盖不完整，
无效收藏 status 会单独标记为 partial，不会伪装成状态筛选排除；冲突进度不推导
剩余集数。不读取评论，不读取 episode collection，不执行收藏写入。

`collection dashboard` 一次组合当前绑定账号的收藏智能概览、动画 backlog
和七日收藏播出计划。三个区段并行读取但保留各自的 official v0/legacy
source、retrievedAt、coverage、partial/unavailable/auth/conflict/not_computable
状态；组合结果另列收藏行、episode 行、日历行、输出行和并发上限。它不接受
任意用户名，不读取评论，不推断历史趋势、口味或推荐，不进入共享缓存或公共
ArtifactStore，也不执行收藏写入。文字输出会对三个区段分别给出状态和关键摘要；
JSON 模式保留完整结构化证据。

Renderer Tool 返回 `ArtifactRef`。`--output` 只接受用户明确指定的本地目标，
Standalone 会从 ArtifactStore 校验 ID、mime、expiry、PNG signature 后复制
文件，不信任 Artifact metadata 中的任意 source path，也不会默认覆盖已有
文件。Chromium 不存在时，文字搜索、subject、auth、collection 和 raw tools
仍可用；render 命令返回 `RENDERER_UNAVAILABLE` 并提示
`pnpm renderer:install`。

## Self-Test

默认只做本地/offline 检查，不进行 Bangumi 写入：

```bash
pnpm self-test
pnpm self-test -- --json
```

检查包括配置、数据目录、SQLite、migration、local principal、ToolRegistry、
OAuth local routes、ArtifactStore 和 Renderer 可用性。可选层级：

```bash
pnpm self-test -- --online
pnpm self-test -- --auth
pnpm self-test -- --render
```

JSON 报告包含 `PASS`、`SKIP`、`FAIL` 数量以及 `remoteWrites: 0`，不包含
token、secret、OAuth code 或加密 key。`SKIP` 不会使 self-test 失败。

## 诊断

```bash
pnpm run doctor
pnpm version:check
```

doctor 将 Standalone、Storage、API、MCP 和 Renderer 分开报告；Claude Host
是可选能力，未安装 Claude 不会使 Standalone-only 使用失败。
