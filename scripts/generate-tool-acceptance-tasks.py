#!/usr/bin/env python3
"""Generate the per-tool Bangumi acceptance checklist from the catalog and tests."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'docs/tool-catalog.json'
OUTPUT = ROOT / 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'
LIVE_PROBE_DIR = ROOT / 'docs/live-probes'
NON_PUBLIC_API_TOOLS = {
    'bangumi.auth_disconnect',
    'bangumi.auth_list_accounts',
    'bangumi.auth_remove_account',
    'bangumi.auth_start',
    'bangumi.auth_status',
    'bangumi.auth_switch_account',
    'bangumi.describe_operation',
    'bangumi.get_subject_stats_history',
    'bangumi.list_operations',
    'bangumi.render_subject_stats_history',
    'bangumi.resolve_subject_concept',
}


def test_source() -> str:
    chunks = []
    for path in (ROOT / 'tests').rglob('*'):
        if path.suffix in {'.ts', '.tsx', '.js', '.mjs'} and path.is_file():
            chunks.append(path.read_text(encoding='utf-8', errors='ignore'))
    return '\n'.join(chunks)


def direct_execute_names(source: str) -> set[str]:
    names = set(re.findall(
        r"(?:reads|auth|authTools|renderTools|tools|registry|toolMap|writeTools|readTools)\.get\('([^']+)'\)",
        source,
    ))
    names.update(re.findall(
        r"(?:executeTool|execute|registerTool)\(\s*['\"](bangumi\.[a-z_]+)['\"]",
        source,
    ))
    return names


def live_public_names() -> set[str]:
    """Return tools with a structured public read result in a saved probe report."""
    names = set()
    if not LIVE_PROBE_DIR.exists():
        return names
    for path in LIVE_PROBE_DIR.glob('*.json'):
        try:
            report = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        report_items = report.get('results', [])
        if not report_items and isinstance(report.get('tool'), str):
            report_items = [report]
        for item in report_items:
            if not isinstance(item, dict) or not isinstance(item.get('tool'), str):
                continue
            result = item.get('result')
            if not isinstance(result, dict):
                continue
            state = result.get('state')
            if state in {'error', 'unavailable'}:
                continue
            has_structured_value = any(
                key in result for key in ('id', 'itemsCount', 'episodesCount', 'castCount', 'total', 'observed', 'returned')
            )
            if state in {'ok', 'complete', 'partial', 'value'} or has_structured_value:
                names.add(item['tool'])
    return names


def model_mcp_e2e_names(catalog_names: set[str]) -> set[str]:
    """Trust only a passed, catalog-pinned report of actual CLI MCP tool events."""
    names: set[str] = set()
    catalog_sha256 = hashlib.sha256(CATALOG.read_bytes()).hexdigest()
    for path in LIVE_PROBE_DIR.glob('pariya-agent-compact-e2e-*.json'):
        try:
            report = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if not isinstance(report, dict):
            continue
        if (report.get('schemaVersion') != 1
                or report.get('evidenceKind') != 'antigravity_cli_mcp_tool_use'
                or report.get('catalogSha256') != catalog_sha256
                or report.get('profile') != 'bangumi-compact-v1'):
            continue
        scenarios = report.get('scenarios')
        if not isinstance(scenarios, list):
            continue
        for scenario in scenarios:
            if not isinstance(scenario, dict) or scenario.get('passed') is not True:
                continue
            calls = scenario.get('toolCalls')
            if not isinstance(calls, list) or not calls:
                continue
            if any(not isinstance(call, dict)
                   or call.get('state') != 'DONE'
                   or call.get('name') not in catalog_names for call in calls):
                continue
            names.update(call['name'] for call in calls)
    return names


def status(tool: dict, direct: set[str], live_public: set[str], model_mcp_e2e: set[str]) -> tuple[str, ...]:
    name = tool['name']
    schema = '✅'
    source = '✅'
    execute = '✅' if name in direct else '⬜'
    live = '—' if name in NON_PUBLIC_API_TOOLS else ('◐' if name in live_public else '⬜')
    auth = '—' if tool.get('auth') == 'none' else '⬜'
    agent_mcp = '✅' if name in model_mcp_e2e else '⬜'
    # The 96 per-tool QQ bridge and TIM client stages have separate evidence
    # requirements; compact-profile or WebChat runs do not satisfy them.
    qq_pipeline = '⬜'
    tim_client = '⬜'
    return schema, source, execute, live, auth, agent_mcp, qq_pipeline, tim_client


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    source = test_source()
    direct = direct_execute_names(source)
    live_public_names_set = live_public_names()
    names = {item['name'] for item in catalog}
    model_mcp_e2e = model_mcp_e2e_names(names)
    missing_source = sorted(name for name in names if name not in source)
    if missing_source:
        raise SystemExit('Missing test source references: ' + ', '.join(missing_source))

    direct_count = sum(item['name'] in direct for item in catalog)
    live_count = sum(item['name'] in live_public_names_set for item in catalog)
    auth_count = sum(item.get('auth') != 'none' for item in catalog)
    model_mcp_count = sum(item['name'] in model_mcp_e2e for item in catalog)
    lines = [
        '# BangumiAgentKit 逐项验收任务清单',
        '',
        '> 生成自 `docs/tool-catalog.json`、`tests/` 与带目录哈希的 `docs/live-probes/` 证据。每一列对应独立验收面；WebChat、MCP 调用、QQ 管线和 TIM 客户端不互相替代。',
        '',
        '## 总览',
        '',
        f'- [x] 工具目录与注册表/Schema 精确一致：{len(catalog)}/{len(catalog)}。',
        f'- [x] 每个工具有测试源码引用：{len(catalog)}/{len(catalog)}。',
        f'- [ ] 每个工具都有直接 `execute` 夹具：{direct_count}/{len(catalog)}；仍有 {len(catalog) - direct_count} 项待补。',
        f'- [ ] 每个工具都有真实公开 API 证据：当前明确记录 {live_count}/{len(catalog)}。',
        f'- [ ] 需要账号的工具完成真实 OAuth/账号验收：{auth_count} 项目前不能用本地 mock 代替。',
        f'- [ ] 每个工具都有实际 Agent→MCP 模型调用证据：当前 {model_mcp_count}/{len(catalog)}。',
        f'- [ ] 每个工具都有 QQ 消息管线端到端证据：当前 0/{len(catalog)}。',
        f'- [ ] 每个工具都有 TIM 客户端端到端证据：当前 0/{len(catalog)}。',
        '',
        '状态说明：`✅` 已有当前证据；`◐` 有有限/间接证据；`⬜` 尚未完成；`—` 不适用（OAuth 生命周期、本地状态/历史或 operation metadata 不发公开 Bangumi HTTP 请求）。',
        '',
        '| 工具 | Auth | Risk | 目录/Schema | 测试源引用 | 直接 execute 夹具 | 真实公开 API | 账号认证 | Agent/MCP E2E | QQ 管线 E2E | TIM 客户端 | 下一步 |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ]
    for item in catalog:
        schema, source_ref, execute, live, auth, agent_mcp, qq_pipeline, tim_client = status(
            item, direct, live_public_names_set, model_mcp_e2e,
        )
        next_step = []
        if execute == '⬜':
            next_step.append('补直接夹具')
        if live == '⬜' and item.get('auth') == 'none':
            next_step.append('补公开 API')
        if auth == '⬜':
            next_step.append('准备账号验收')
        if agent_mcp == '⬜':
            next_step.append('补 Agent/MCP 实际调用证据')
        if qq_pipeline == '⬜':
            next_step.append('补 QQ 消息管线 E2E')
        if tim_client == '⬜':
            next_step.append('补 TIM 客户端 E2E')
        lines.append(
            f"| `{item['name']}` | `{item.get('auth')}` | `{item.get('risk')}` "
            f"| {schema} | {source_ref} | {execute} | {live} | {auth} "
            f"| {agent_mcp} | {qq_pipeline} | {tim_client} | {'；'.join(next_step)} |"
        )

    lines.extend([
        '',
        '## 认证验收任务',
        '',
        '- [ ] 用真实 Bangumi OAuth 完成 `auth_start` → 回调 → `auth_status`。',
        '- [ ] 用真实账号完成 `auth_list_accounts`、`auth_switch_account`，验证多账号隔离。',
        '- [ ] 在明确确认下完成 `auth_remove_account` / `auth_disconnect`，记录回滚与审计结果。',
        '- [ ] 用真实账号验证所有 `auth: required` 的读工具、写工具和私有 render 工具。',
        '- [ ] 对写入/破坏性工具只使用测试账号和明确二次确认，不把 mock 成功当作线上成功。',
        '',
        '## QQ/TIM 语音输入任务',
        '',
        '- [ ] 确认机器人账号已在 NapCat 登录并处于 `QQ_READY`。',
        '- [ ] 在机器人**私聊**中按住 TIM 麦克风发送一条 5–10 秒普通中文语音；不要发送 WAV 文件卡片，也不要发送音乐。',
        '- [ ] 语音内容建议固定为：`这是 Pariya 语音输入验收，请回复我听到的最后四个字：语音验收通过。`',
        '- [ ] 检查 OneBot 入站段是 `record`，不是 `file`；检查 `pariya.read_media` 收到 `audio/wav`。',
        '- [ ] 检查模型回答是否正确理解语音内容，并记录一次成功即可证明传输/识别路径；不同编码、长语音和长期稳定性另列观察。',
        '',
        '这份清单完成前，不再把“完整工具覆盖”简称为“所有工具都真实测试过”。',
    ])
    OUTPUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps({'catalog': len(catalog), 'direct_execute': direct_count,
                      'live_public': live_count, 'auth_required_or_optional': auth_count,
                      'agent_mcp_e2e': model_mcp_count, 'qq_pipeline_e2e': 0, 'tim_client_e2e': 0,
                      'output': str(OUTPUT)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
