#!/usr/bin/env python3
"""Generate the per-tool Bangumi acceptance checklist from the catalog and tests."""
import argparse
import hashlib
import json
import re
from pathlib import Path

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
PUBLIC_API_FAILURE_STATES = {
    'auth_required',
    'error',
    'not_computable',
    'not_found',
    'permission_denied',
    'unavailable',
    'unsupported',
    'upstream_error',
}
PUBLIC_API_REQUIRED_ASSERTIONS = {
    'httpRequestObserved',
    'nonEmptySummary',
    'noErrorResult',
    'nonNegativeCounts',
    'countConsistency',
    'passed',
}
def test_source() -> str:
    chunks = []
    for path in (ROOT / 'tests').rglob('*'):
        if path.suffix in {'.ts', '.tsx', '.js', '.mjs'} and path.is_file():
            chunks.append(path.read_text(encoding='utf-8', errors='ignore'))
    return '\n'.join(chunks)


def direct_execute_occurrences(source: str) -> dict[str, set[int]]:
    occurrences: dict[str, set[int]] = {}

    def record(name: str, position: int) -> None:
        line = source.count('\n', 0, position) + 1
        occurrences.setdefault(name, set()).add(line)

    accessor = re.compile(
        r"(?:reads|auth|authTools|renderTools|tools|registry|toolMap|writeTools|readTools)"
        r"\.get\(['\"](?P<name>bangumi\.[a-z_]+)['\"]\)"
    )
    for match in accessor.finditer(source):
        suffix = source[match.end():]
        prefix = source[max(0, match.start() - 100):match.start()]
        called_execute = re.match(r"\s*!?\s*\.execute\b", suffix) is not None
        passed_to_fixture_wrapper = re.search(
            r"(?:await\s+)?(?:run|expectControlled)\s*\(\s*$", prefix
        ) is not None
        if called_execute or passed_to_fixture_wrapper:
            record(match.group('name'), match.start('name'))
    explicit = re.compile(
        r"(?:executeTool|execute)\(\s*['\"](?P<name>bangumi\.[a-z_]+)['\"]"
    )
    for match in explicit.finditer(source):
        record(match.group('name'), match.start('name'))
    return occurrences


def direct_execute_names(source: str) -> set[str]:
    return set(direct_execute_occurrences(source))


def direct_execute_source_refs(sources: list[tuple[str, str]]) -> dict[str, set[str]]:
    refs: dict[str, set[str]] = {}
    for path, source in sources:
        for name, lines in direct_execute_occurrences(source).items():
            refs.setdefault(name, set()).update(f'{path}:{line}' for line in lines)
    return refs


def direct_execute_sources() -> dict[str, set[str]]:
    sources = []
    for path in (ROOT / 'tests').rglob('*'):
        if path.suffix in {'.ts', '.tsx', '.js', '.mjs'} and path.is_file():
            sources.append((path.relative_to(ROOT).as_posix(), path.read_text(encoding='utf-8', errors='ignore')))
    return direct_execute_source_refs(sources)


def report_source_ref(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        # Test harnesses may deliberately point LIVE_PROBE_DIR at a temporary directory.
        return path.name


def public_api_smoke_sources(catalog: list[dict]) -> dict[str, set[str]]:
    """Trust only current, hash-bound direct ToolRegistry calls with live HTTP results."""
    catalog_sha256 = hashlib.sha256(CATALOG.read_bytes()).hexdigest()
    probe_source_sha256 = hashlib.sha256(
        (ROOT / 'scripts/smoke-public-tools-online.ts').read_bytes()
    ).hexdigest()
    current_names = {item['name'] for item in catalog}
    public_candidates = {
        item['name'] for item in catalog
        if item.get('auth') != 'required' and item['name'] not in NON_PUBLIC_API_TOOLS
    }
    sources: dict[str, set[str]] = {}
    for path in LIVE_PROBE_DIR.glob('public-tools-*.json'):
        try:
            report = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if (
            not isinstance(report, dict)
            or report.get('schemaVersion') != 1
            or report.get('evidenceKind') != 'bangumi_public_api_tool_registry_smoke'
            or report.get('mode') != 'read_only_public_api_smoke'
            or report.get('sourceProgram') != 'scripts/smoke-public-tools-online.ts'
            or report.get('catalogSha256') != catalog_sha256
            or report.get('probeScriptSha256') != probe_source_sha256
        ):
            continue
        selected = report.get('selectedTools')
        results = report.get('results')
        if (
            not isinstance(selected, list)
            or not all(isinstance(name, str) for name in selected)
            or len(set(selected)) != len(selected)
            or set(selected) != public_candidates
            or type(report.get('probeCount')) is not int
            or report['probeCount'] != len(public_candidates)
            or not isinstance(results, list)
            or len(results) != len(public_candidates)
        ):
            continue
        result_by_name = {
            item.get('tool'): item for item in results
            if isinstance(item, dict) and isinstance(item.get('tool'), str)
        }
        if set(result_by_name) != set(selected):
            continue
        for name in selected:
            result = result_by_name[name]
            summary = result.get('result')
            assertions = result.get('assertions')
            request_count = result.get('httpRequests')
            recorded_input = result.get('input')
            if (
                name not in current_names
                or name not in public_candidates
                or not isinstance(summary, dict)
                or not summary
                or summary.get('state') in PUBLIC_API_FAILURE_STATES
                or 'error' in summary
                or not isinstance(assertions, dict)
                or not PUBLIC_API_REQUIRED_ASSERTIONS.issubset(assertions)
                or not all(value is True for value in assertions.values())
                or type(request_count) is not int
                or request_count < 1
                or not isinstance(recorded_input, dict)
                or 'username' in recorded_input
            ):
                continue
            sources.setdefault(name, set()).add(report_source_ref(path))
    return sources


def public_api_smoke_names(catalog: list[dict]) -> set[str]:
    return set(public_api_smoke_sources(catalog))


def model_mcp_e2e_sources(catalog: list[dict]) -> dict[str, set[str]]:
    """Trust passed CLI MCP reports whose individual tool catalog entry is current."""
    sources: dict[str, set[str]] = {}
    current_catalog_sha256 = hashlib.sha256(CATALOG.read_bytes()).hexdigest()
    current_by_name = {item['name']: item for item in catalog}
    catalog_cache: dict[str, dict[str, dict] | None] = {
        current_catalog_sha256: current_by_name,
    }

    def catalog_for_hash(catalog_sha256: object) -> dict[str, dict] | None:
        if not isinstance(catalog_sha256, str) or not re.fullmatch(r'[0-9a-f]{64}', catalog_sha256):
            return None
        if catalog_sha256 in catalog_cache:
            return catalog_cache[catalog_sha256]
        snapshot_path = LIVE_PROBE_DIR / 'catalog-snapshots' / f'{catalog_sha256}.json'
        try:
            snapshot_bytes = snapshot_path.read_bytes()
            snapshot = json.loads(snapshot_bytes)
        except (OSError, ValueError):
            catalog_cache[catalog_sha256] = None
            return None
        if hashlib.sha256(snapshot_bytes).hexdigest() != catalog_sha256 or not isinstance(snapshot, list):
            catalog_cache[catalog_sha256] = None
            return None
        snapshot_by_name = {
            item['name']: item
            for item in snapshot
            if isinstance(item, dict) and isinstance(item.get('name'), str)
        }
        catalog_cache[catalog_sha256] = snapshot_by_name
        return snapshot_by_name

    valid_profiles = {
        'bangumi-compact-v1',
        'bangumi-full-public-qa-v1',
        'bangumi-full-renderer-qa-v1',
        'bangumi-full-operation-qa-v1',
        'bangumi-full-auth-start-qa-v1',
        'bangumi-full-auth-switch-qa-v1',
        'bangumi-full-auth-mutation-qa-v1',
        'bangumi-full-auth-feature-qa-v1',
        'bangumi-full-auth-write-qa-v1',
    }
    for path in LIVE_PROBE_DIR.glob('pariya-agent-*-e2e-*.json'):
        try:
            report = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if not isinstance(report, dict):
            continue
        evidence_by_name = catalog_for_hash(report.get('catalogSha256'))
        if (report.get('schemaVersion') != 1
                or report.get('evidenceKind') != 'antigravity_cli_mcp_tool_use'
                or evidence_by_name is None
                or report.get('profile') not in valid_profiles
                or type(report.get('processExitCode')) is not int
                or report.get('processExitCode') != 0
                or report.get('resultStatus') != 'SUCCESS'
                or type(report.get('resultCount')) is not int
                or report.get('resultCount') < 1
                or report.get('qqPipelineTested') is not False
                or report.get('timClientTested') is not False):
            continue
        scenarios = report.get('scenarios')
        if not isinstance(scenarios, list) or len(scenarios) != report.get('resultCount'):
            continue
        for scenario in scenarios:
            if not isinstance(scenario, dict) or scenario.get('passed') is not True:
                continue
            calls = scenario.get('toolCalls')
            if not isinstance(calls, list) or not calls:
                continue
            if any(not isinstance(call, dict)
                   or call.get('state') != 'DONE'
                   or call.get('name') not in current_by_name
                   or evidence_by_name.get(call.get('name')) != current_by_name.get(call.get('name'))
                   for call in calls):
                continue
            for call in calls:
                sources.setdefault(call['name'], set()).add(report_source_ref(path))
    return sources


def model_mcp_e2e_names(catalog: list[dict]) -> set[str]:
    return set(model_mcp_e2e_sources(catalog))


def auth_gate_denial_sources(catalog: list[dict]) -> dict[str, set[str]]:
    """Trust isolated no-account reports only when they prove an expected auth gate."""
    sources: dict[str, set[str]] = {}
    catalog_sha256 = hashlib.sha256(CATALOG.read_bytes()).hexdigest()
    current_by_name = {item['name']: item for item in catalog}
    for path in LIVE_PROBE_DIR.glob('pariya-agent-full-auth-denial-qa-e2e-*.json'):
        try:
            report = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if (not isinstance(report, dict)
                or report.get('schemaVersion') != 1
                or report.get('evidenceKind') != 'antigravity_cli_mcp_tool_use'
                or report.get('catalogSha256') != catalog_sha256
                or report.get('profile') != 'bangumi-full-auth-denial-qa-v1'
                or report.get('processExitCode') != 0
                or report.get('resultStatus') != 'SUCCESS'
                or report.get('qqPipelineTested') is not False
                or report.get('timClientTested') is not False):
            continue
        scenarios = report.get('scenarios')
        if not isinstance(scenarios, list) or len(scenarios) != 1:
            continue
        scenario = scenarios[0]
        if not isinstance(scenario, dict):
            continue
        name = scenario.get('id')
        tool = current_by_name.get(name)
        calls = scenario.get('toolCalls')
        assertions = scenario.get('assertions')
        if (not tool or tool.get('risk') != 'read' or tool.get('auth') != 'required'
                or scenario.get('passed') is not True
                or calls != [{'name': name, 'state': 'DONE'}]
                or not isinstance(assertions, dict)
                or assertions.get('authRequiredGateObserved') is not True
                or assertions.get('operationExecuted') is not False
                or assertions.get('accountDataReturned') is not False):
            continue
        sources.setdefault(name, set()).add(report_source_ref(path))
    return sources


def auth_gate_denial_names(catalog: list[dict]) -> set[str]:
    return set(auth_gate_denial_sources(catalog))


def status(
    tool: dict,
    catalog_index: int,
    direct_source_refs: dict[str, set[str]],
    public_api_sources: dict[str, set[str]],
    auth_gate_denial_sources: dict[str, set[str]],
    model_mcp_e2e_sources: dict[str, set[str]],
) -> tuple[str, ...]:
    def with_sources(mark: str, sources: set[str]) -> str:
        if not sources:
            return mark
        return mark + '<br>' + '<br>'.join(f'`{path}`' for path in sorted(sources))

    name = tool['name']
    schema = f'`docs/tool-catalog.json#/{catalog_index}`'
    source = '<br>'.join(f'`{path}`' for path in sorted(direct_source_refs.get(name, set()))) or '⬜'
    execute = '✅' if name in direct_source_refs else '⬜'
    # Required-account operations are not anonymous public-API candidates;
    # their remote behavior belongs to the separate account-auth acceptance column.
    if tool.get('auth') == 'required' or name in NON_PUBLIC_API_TOOLS:
        live = '—'
    elif name in public_api_sources:
        live = with_sources('◐', public_api_sources[name])
    else:
        live = '⬜'
    if tool.get('auth') != 'required' or tool.get('risk') != 'read':
        auth_gate = '—'
    elif name in auth_gate_denial_sources:
        auth_gate = with_sources('✅', auth_gate_denial_sources[name])
    else:
        auth_gate = '⬜'
    auth = '—' if tool.get('auth') == 'none' else '⬜'
    agent_mcp = (
        with_sources('✅', model_mcp_e2e_sources[name])
        if name in model_mcp_e2e_sources else '⬜'
    )
    # The 96 per-tool QQ bridge and TIM client stages have separate evidence
    # requirements; Agent/MCP runs never satisfy them.
    qq_pipeline = '⬜'
    tim_client = '⬜'
    return schema, source, execute, live, auth_gate, auth, agent_mcp, qq_pipeline, tim_client


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--check', action='store_true',
        help='fail if the checked-in acceptance table differs from current evidence',
    )
    args = parser.parse_args()
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    source = test_source()
    direct_source_refs = direct_execute_sources()
    direct = set(direct_source_refs)
    public_api_sources = public_api_smoke_sources(catalog)
    public_candidates = {
        item['name'] for item in catalog
        if item.get('auth') != 'required' and item['name'] not in NON_PUBLIC_API_TOOLS
    }
    public_api_sources = {
        name: refs for name, refs in public_api_sources.items()
        if name in public_candidates
    }
    public_api_evidence = set(public_api_sources)
    auth_gate_denial_sources_by_name = auth_gate_denial_sources(catalog)
    auth_gate_denial_set = set(auth_gate_denial_sources_by_name)
    names = {item['name'] for item in catalog}
    model_mcp_sources_by_name = model_mcp_e2e_sources(catalog)
    model_mcp_e2e = set(model_mcp_sources_by_name)
    missing_source = sorted(name for name in names if name not in source)
    if missing_source:
        raise SystemExit('Missing test source references: ' + ', '.join(missing_source))

    direct_count = sum(item['name'] in direct for item in catalog)
    live_count = sum(item['name'] in public_api_evidence for item in catalog)
    auth_count = sum(item.get('auth') != 'none' for item in catalog)
    model_mcp_count = sum(item['name'] in model_mcp_e2e for item in catalog)
    public_not_applicable_count = sum(
        item.get('auth') == 'required' or item['name'] in NON_PUBLIC_API_TOOLS
        for item in catalog
    )
    public_candidate_count = len(catalog) - public_not_applicable_count
    public_pending_count = public_candidate_count - live_count
    auth_gate_total = sum(
        item.get('auth') == 'required' and item.get('risk') == 'read'
        for item in catalog
    )
    auth_gate_count = sum(item['name'] in auth_gate_denial_set for item in catalog)
    lines = [
        '# BangumiAgentKit 逐项验收任务清单',
        '',
        '> 生成自 `docs/tool-catalog.json`、`tests/` 与带目录哈希的 `docs/live-probes/` 证据。每一列对应独立验收面；WebChat、MCP 调用、QQ 管线和 TIM 客户端不互相替代。',
        '',
        '## 总览',
        '',
        f'- [{"x" if direct_count == len(catalog) else " "}] 每个工具都有直接 `execute` 夹具：{direct_count}/{len(catalog)}。',
        f'- [{"x" if public_pending_count == 0 else " "}] 匿名可用的公开 API 工具有逐项实测：{live_count}/{public_candidate_count}；待补 {public_pending_count}。',
        f'- [{"x" if public_not_applicable_count + public_candidate_count == len(catalog) else " "}] 匿名公开 API 不适用项已单独分类：{public_not_applicable_count}/{len(catalog)}；这些工具由账号验收或本地状态验收覆盖。',
        f'- [ ] 需要账号的工具完成真实 OAuth/账号验收：{auth_count} 项目前不能用本地 mock 代替。',
        f'- [{"x" if auth_gate_count == auth_gate_total else " "}] 未认证只读门禁拒绝路径已验证：{auth_gate_count}/{auth_gate_total} 项；门禁通过不代表真实账号功能通过。',
        f'- [{"x" if model_mcp_count == len(catalog) else " "}] 每个工具都有实际 Agent→MCP 模型调用证据：{model_mcp_count}/{len(catalog)}。',
        f'- [ ] 每个工具都有 QQ 消息管线端到端证据：当前 0/{len(catalog)}。',
        f'- [ ] 每个工具都有 TIM 客户端端到端证据：当前 0/{len(catalog)}。',
        '',
        '状态说明：`注册/Schema目录引用` 列指向 `docs/tool-catalog.json` 中该工具由运行时 `ToolRegistry` 生成的精确条目；直接 execute 测试引用列列出调用 `.execute`/`ToolRegistry.executeTool` 或已知执行夹具的文件和行号。真实公开 API、未认证门禁和 Agent/MCP 通过项也列出具体 JSON 报告文件。直接夹具和 Agent/MCP 证据不代表真实账号、QQ/TIM 验收。`◐` 表示有目录/探针源码哈希绑定的只读 ToolRegistry 实测、真实 HTTP 请求、无错误摘要和通过的形状断言；可比对的稳定 ID/计数也会校验。报告不保存数据正文，也不证明完整字段覆盖或长期稳定性；`⬜` 尚未完成；`—` 不适用匿名公开 API（账号必需的私有/写入功能由账号验收列单独跟踪；OAuth 生命周期、本地状态/历史和 operation metadata 没有公开 API 路径）。',
        '',
        '| 工具 | Auth | Risk | 注册/Schema目录引用 | 直接 execute 测试引用 | 直接 execute 夹具 | 真实公开 API | 未认证只读门禁 | 账号认证 | Agent/MCP E2E | QQ 管线 E2E | TIM 客户端 | 下一步 |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        '未认证只读门禁列只记录缺少账号时的安全拒绝；真实 OAuth 与账号授权仍由“账号认证”列单独跟踪。写入/破坏性工具不进入该探针。',
    ]
    for catalog_index, item in enumerate(catalog):
        schema, source_ref, execute, live, auth_gate, auth, agent_mcp, qq_pipeline, tim_client = status(
            item, catalog_index, direct_source_refs, public_api_sources,
            auth_gate_denial_sources_by_name, model_mcp_sources_by_name,
        )
        next_step = []
        if execute == '⬜':
            next_step.append('补直接夹具')
        if live == '⬜' and item.get('auth') == 'none':
            next_step.append('补公开 API')
        if auth == '⬜':
            next_step.append('准备账号验收')
        if auth_gate == '⬜':
            next_step.append('补未认证门禁拒绝测试')
        if agent_mcp == '⬜':
            next_step.append('补 Agent/MCP 实际调用证据')
        if qq_pipeline == '⬜':
            next_step.append('补 QQ 消息管线 E2E')
        if tim_client == '⬜':
            next_step.append('补 TIM 客户端 E2E')
        lines.append(
            f"| `{item['name']}` | `{item.get('auth')}` | `{item.get('risk')}` "
            f"| {schema} | {source_ref} | {execute} | {live} | {auth_gate} | {auth} "
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
        '## QQ/TIM 真人语音输入验收（2026-09-23）',
        '',
        '- [x] 验收时机器人已登录，NapCat、AstrBot、Runner 和 OneBot 处于 READY。',
        '- [x] 用户在机器人私聊使用 TIM 麦克风发送真人语音；脱敏投递审计记录到 1 条入站 `record`，不保留语音或聊天正文。',
        '- [x] AstrBot 将 `record` 解析为 WAV，媒体桥把本轮受限文件路径交给 Antigravity 内置 `view_file`；固定合成探针已验证这条读取路径。',
        '- [x] 用户确认真实 TIM 回复与语音口令完全一致：`7294`。真人结果仅保存 `user_attested` 标记，不保存口令对应的原始聊天内容。',
        '- [ ] 后续只在语音桥、模型 CLI、AstrBot 或 OneBot 媒体处理改动后重跑；本次单次成功不代表各种口音、近音词、时长和编码都已覆盖。',
        '- [ ] QQ 登录掉线率仍需长期观察；语音验收不代表掉线稳定性问题已解决。',
        '',
        '说明：这项真人语音验收与上方 96 个工具逐项的 QQ 管线/TIM 客户端列相互独立；它不把 96 个工具的 QQ/TIM 覆盖数从 0/96 改成已完成。',
        '',
        '这份清单完成前，不再把“完整工具覆盖”简称为“所有工具都真实测试过”。',
    ])
    generated = '\n'.join(lines) + '\n'
    summary = {'catalog': len(catalog), 'direct_execute': direct_count,
               'live_public': live_count, 'auth_required_or_optional': auth_count,
               'auth_gate_denial': len(auth_gate_denial_set),
               'auth_gate_pending': sum(item.get('auth') == 'required' and item.get('risk') == 'read' and item['name'] not in auth_gate_denial_set for item in catalog),
               'agent_mcp_e2e': model_mcp_count, 'qq_pipeline_e2e': 0, 'tim_client_e2e': 0,
               'output': str(OUTPUT)}
    if args.check:
        try:
            current = OUTPUT.read_text(encoding='utf-8')
        except OSError as error:
            raise SystemExit(f'acceptance table unavailable: {error}') from error
        if current != generated:
            raise SystemExit('acceptance table is stale; run python3 scripts/generate-tool-acceptance-tasks.py')
        print(json.dumps({**summary, 'check': 'current'}, ensure_ascii=False))
        return
    OUTPUT.write_text(generated, encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == '__main__':
    main()
