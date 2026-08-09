# Bangumi Agent Kit 安全设计规范 (PR-3)

## 1. 凭证隔离与加密

1. **绝对禁止暴露 Token**
   - Access Token、Refresh Token 与 OAuth Code 绝不能出现在日志、Prompt、错误堆栈、LLM Context、QQ 消息或渲染图片中。
2. **TokenBroker 代理注入**
   - 凭证采用 `AES-256-GCM` 加密存储于 `Storage`（PostgreSQL 或 MemoryStorage）。
   - 只有 `TokenBroker` 可以在内部并发锁 (`withCredentialLock`) 下解密并代理注入 HTTP Bearer Header，LLM、MCP Client 与 ToolContext 绝无法读取明文 Token。
3. **8-Step Security Pipeline**
   - 包含：1. Target Resolving -> 2. Identity Verification -> 3. Token Resolution -> 4. Policy Check -> 5. Confirmation Gate -> 6. Capability Check -> 7. API Execution -> 8. Audit Logging.

---

## 2. 交互安全与写操作二次确认

1. **风险等级划分**：
   - `read`: 搜索、查询等只读操作，直接执行。
   - `write`: 修改单项收藏、修改正篇播放进度，在语义明确时可直接执行。
   - `destructive`: 取消收藏、删除目录条目、解绑账号或涉及超 20 集的批量进度修改，必须经服务端生成 `PendingAction` 进行二次确认。
2. **PendingAction 状态机与 Canonical Payload Hashing**
   - 二次确认基于 `confirmationId` 与 recursive key-sorted JSON canonical payload hash (`computeCanonicalPayloadHash`)。
   - 严格验证 `principalId`、`botInstanceId`、`conversationKey` 匹配且在有效期内（10 分钟），防止越权与重放。

---

## 3. Scope & Raw Write Protection

1. **Scope Realities Handling**
   - 上游 Bangumi OAuth 接口返回 `scope: null`。系统不凭空构造虚假 Scope Evidence，只校验已保存凭证的可用性。
2. **Raw Write Protection Gate**
   - `BANGUMI_ALLOW_RAW_WRITES` 默认值为 `false`。
   - 任何非只读的 `bangumi.call_operation` 请求若未显式开启该环境变量，将直接拒绝执行并返回 `RAW_WRITE_OPERATION_DISABLED` (403)。

---

## 4. Renderer 防 SSRF 规范

1. Asset Proxy 强制过滤图片 URL，禁止访问 `127.0.0.1`、`localhost`、内网 IP、云厂商 Metadata 服务及 `file://` 协议。
2. ViewModel 输入经 Zod 清洗，防止外部 Prompt Injection 注入恶意 Script 或破坏 DOM。

---

## 5. Standalone 安全边界

Standalone 是一个本地 trusted Host，但仍然使用外部身份模型：

```text
provider=local, botInstanceId=standalone,
externalUserId=<profile>, conversationId=standalone:<profile>
```

它不能通过普通命令注入 `prc_*`，也不把 MCP 当作内部调用路径。命令直接
经过共享 `ToolRegistry.executeTool()`，保留 Zod、auth、scope、PendingAction、
payload hash、audit 和 safe error policy。交互确认只接受 `y`、`yes` 或
`确认`；非交互 CLI 永不自动确认，必须显式提供原操作返回的 `--confirm`
且由服务端再次校验。

Standalone OAuth listener 默认只绑定 `127.0.0.1`，端口由
`BANGUMI_STANDALONE_OAUTH_PORT` 控制。显式非 loopback bind 会警告。OAuth
Token、client secret、encryption key 和内部 credential 字段不会进入人类
输出或 JSON presenter。

Renderer 导出只接受用户指定的目标路径；源文件从受信任 ArtifactStore 派生，
校验 ArtifactRef、metadata、mime、expiry 和 PNG signature，并默认拒绝覆盖。
没有 Chromium 时只降级 render 能力，不影响文本、auth、collection 或 raw
tool 的安全管线。
