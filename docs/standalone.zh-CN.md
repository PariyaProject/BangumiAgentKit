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
cast <subjectId>
calendar
episodes <subjectId>
collection status <subjectId>
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
render cast <id>
render calendar
render search <query>
render collection <id>
```

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
