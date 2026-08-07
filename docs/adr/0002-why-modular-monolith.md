# 2. 采用模块化单体 (Modular Monolith)

## 状态
已接受

## 上下文
早期如果直接拆分为微服务，会引入过高的分布式事务、RPC 运维与链路复杂度。

## 决策
第一版采用 pnpm workspace 组织模块化单体架构。初期部署为 `bangumi-api`、`bangumi-mcp` 与 `bangumi-bot` 三个子进程。

## 后果
- 模块界限清晰，包之间通过定义明确的 interface 交互。
- 降低运维与测试成本。未来在 Chromium 内存占用变大时可平滑拆分独立 Render Worker。
