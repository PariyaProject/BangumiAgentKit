# Bangumi Agent Kit 安全设计规范

## 1. 凭证隔离与加密

1. **绝对禁止暴露 Token**
   - Access Token、Refresh Token 与 OAuth Code 绝不能出现在日志、Prompt、错误堆栈、QQ 消息或渲染图片中。
2. **Token Broker 解密**
   - 凭证采用 `AES-256-GCM` 加密存储于数据库。只有 `TokenBroker` 可以在内部解密并注入 HTTP Header，其他模块及 LLM 无法直接读取明文 Token。
3. **最小权限原则**
   - 默认授权仅申请 `write:collection`；仅当用户触发目录管理时才提示申请 `write:indices`。

---

## 2. 交互安全与写操作二次确认

1. **风险等级划分为**：
   - `read`: 搜索、查询等只读操作，直接执行。
   - `write`: 修改单项收藏、修改正篇播放进度，在语义明确时可直接执行。
   - `destructive`: 取消收藏、删除目录条目、解绑账号或涉及超 20 集的批量进度修改，必须经服务端生成 `Pending Action` 进行二次确认。
2. **Pending Action 校验机制**
   - 二次确认基于 `confirmationId` 与 `payloadHash`。必须验证请求来自同一平台用户、同一会话且未超时，禁止模型自行代为确认。

---

## 3. Renderer 防 SSRF 规范

1. Asset Proxy 强制过滤图片 URL，禁止访问 `127.0.0.1`、`localhost`、内网 IP、云厂商 Metadata 服务及 `file://` 协议。
2. ViewModel 输入经 Zod 清洗，防止外部 Prompt Injection 注入恶意 Script 或破坏 DOM。
