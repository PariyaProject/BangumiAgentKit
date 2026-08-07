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
