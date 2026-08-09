# Standalone 手工 QA Checklist

以下检查使用临时 profile 和测试账号。写操作具有破坏性，默认跳过；只有
明确准备好测试账号和回滚方案时才执行标记为 `[可选/有写入]` 的项目。

## 安装与启动

- [ ] 在 fresh checkout 执行 `pnpm install`。
- [ ] 执行 `pnpm setup:local`，确认 `.env.local` 为私有文件。
- [ ] 执行 `pnpm build` 和 `pnpm self-test`。
- [ ] 启动 `pnpm standalone -- --profile qa`。
- [ ] `status` 显示 SQLite、profile、OAuth callback 和 Renderer 状态，不显示 token/key。

## 文本和身份

- [ ] `search 少女终末旅行` 返回语义候选，而非 CLI 自行请求 API。
- [ ] `subject 218707` 返回 subject 详情。
- [ ] `cast 218707`、`calendar`、`episodes 218707` 可用。
- [ ] `tool list`、`tool describe bangumi.search_subjects`、`tool call bangumi.search_subjects '{"query":"少女终末旅行"}'` 可用。
- [ ] `pnpm bak -- --json status` stdout 可直接 `JSON.parse`。
- [ ] 使用 `--profile qa-a`、`--profile qa-b` 检查两个 profile 共享 DB 但状态隔离。

## OAuth 和账号

- [ ] `auth status` 在未绑定时显示未绑定，不泄露任何 credential。
- [ ] `auth login` 打印 `127.0.0.1` callback URL；浏览器完成授权。
- [ ] `auth accounts` 显示账号和 active marker。
- [ ] `auth switch <index>` 只能切换当前 profile 的账号。
- [ ] 另一个 profile 不能切换或移除该账号。

## Confirmation

- [ ] 触发一个需要确认的 bulk/destructive operation，确认出现摘要。
- [ ] 输入 `n`、`no`、`取消` 或任意其他文本，确认没有远程写入。
- [ ] 重新触发并明确输入 `y`/`yes`/`确认`，只执行原 payload。
- [ ] 改变 payload、换 profile、重放 confirmation ID 都被拒绝。
- [ ] 非交互命令无 `--confirm` 时退出码为 4，不会自动确认。

## Renderer 和导出

- [ ] `render subject 218707` 返回 ArtifactRef，不返回绝对 source path。
- [ ] `render search 少女终末旅行 --output <new-path>` 生成 PNG。
- [ ] 目标已存在时不覆盖；加 `--force` 才允许替换。
- [ ] 未安装 Chromium 时，text/search/auth/collection/tool 仍工作，render 返回
      `RENDERER_UNAVAILABLE` 和 `pnpm renderer:install` 指引。

## 重启和退出

- [ ] 退出并重新启动同一 profile，principal 和账号绑定仍存在。
- [ ] 启动第二个不同 profile 的 Standalone，不出现全局进程锁。
- [ ] 在输入时按一次 Ctrl+C，操作取消；再次按 Ctrl+C，进程干净退出。
- [ ] 检查 SQLite、artifact 和 host listener 没有孤立进程或明文 secret。

## 自动化对应项

```bash
pnpm test:standalone
pnpm self-test -- --json
pnpm smoke:standalone
pnpm smoke:v0.1
```
